// ═══════════════════════════════════════════
//  CARD EFFECT: "Cute Nerd Magenta"
//  Hero — 350 HP, 30 ATK
//  Starting abilities: Charme, Creativity
//  Archetype: Cute
//
//  Once per turn: discard a card from hand,
//  then choose a card from your deck and
//  send it directly to your discard pile
//  (targeted self-mill — fires onMill, not
//  onDiscard; no shuffle).
//
//  The milled card is revealed face-up for
//  ~2 seconds as it flies to the discard pile
//  (holdDuration: 2000 on actionMillCards).
// ═══════════════════════════════════════════

const CARD_NAME = 'Cute Nerd Magenta';

module.exports = {
  activeIn: ['hero'],
  heroEffect: true,

  // CPU threat assessment (draw supporter). Targeted-self-mill cycles the
  // deck: counts as 2 draws worth of support per user calibration.
  supportYield() {
    return { drawsPerTurn: 2 };
  },

  /**
   * CPU prompt response for the deck-mill cardGallery (Step 2 below).
   * The default `pickBestGalleryCard` scores candidates by
   * `estimateHandCardValueFor` — which is the "if it were in hand"
   * value, the OPPOSITE of what a mill prompt wants (we want the
   * candidate whose move from deck → discard creates the most value).
   * Use `evaluateState` delta directly: snapshot, splice the candidate
   * from deck onto discard, score, restore. Picks the highest delta.
   *
   * For a controller with any pileFuel-armed source (Soul Shards →
   * `SOUL_SHARD_PILE_FUEL.discardFilter` matches Shards in discard),
   * milling a Soul Shard from deck flips evaluator-positive without
   * any per-archetype hardcoding here — just the pileFuel declaration
   * on the relevant cards.
   *
   * Skipped during MCTS rollouts (per-candidate eval inside an outer
   * rollout would be O(N) extra eval calls per gallery prompt). The
   * gate at the call site (`engine._inMctsSim` defers to the default).
   */
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic') return undefined;
    if (promptData?.type !== 'cardGallery') return undefined;
    if (promptData?.title !== CARD_NAME) return undefined;
    if (engine._inMctsSim) return undefined;
    const pi = engine._cpuPlayerIdx;
    const ps = engine.gs.players?.[pi];
    if (!ps) return undefined;
    const cards = promptData.cards || [];
    if (!cards.length) return undefined;
    const evalState = engine._cpuEvaluateState;
    if (typeof evalState !== 'function') return undefined;
    // Magenta's Step 1 (hand-discard) has already pushed the chosen
    // card name onto the top of the discard pile by the time this
    // gallery prompt fires. Excluding that exact name from the deck-
    // mill candidate set ensures the two halves of Magenta's effect
    // contribute DIFFERENT names to discard — milling the same name
    // would just stack a second copy that the deck already had to
    // give up, halving the unique-name yield. The eval-delta scorer
    // would happily pick the same name in pileFuel-stacking decks
    // (each copy in discard scores separately), so this filter is a
    // hard rule, not a heuristic.
    const justDiscardedName = ps.discardPile?.[ps.discardPile.length - 1] || null;
    const eligibleCards = justDiscardedName
      ? cards.filter(c => c.name !== justDiscardedName)
      : cards;
    // Defensive: if filtering would empty the pool (deck contains only
    // copies of the just-discarded name — pathological), fall back to
    // the full pool so the prompt still resolves.
    const pool = eligibleCards.length > 0 ? eligibleCards : cards;
    let best = null;
    let bestScore = -Infinity;
    for (const c of pool) {
      const name = c.name;
      const idx = (ps.mainDeck || []).indexOf(name);
      if (idx < 0) continue;
      ps.mainDeck.splice(idx, 1);
      ps.discardPile.push(name);
      let score = -Infinity;
      try { score = evalState(pi); } catch {}
      ps.discardPile.pop();
      ps.mainDeck.splice(idx, 0, name);
      if (score > bestScore) { bestScore = score; best = c; }
    }
    if (!best) return undefined;
    return { cardName: best.name, source: best.source };
  },

  canActivateHeroEffect(ctx) {
    const ps = ctx.players[ctx.cardOwner];
    return (ps?.hand || []).length > 0 && (ps?.mainDeck || []).length > 0;
  },

  async onHeroEffect(ctx) {
    const engine  = ctx._engine;
    const gs      = engine.gs;
    const pi      = ctx.cardOwner;
    const ps      = gs.players[pi];
    if (!ps) return false;

    // ── Step 1: discard a card from hand (cancellable) ───────────────────

    const discardResult = await engine.promptGeneric(pi, {
      type:        'forceDiscardCancellable',
      title:       CARD_NAME,
      description: 'Discard a card from your hand to choose a card from your deck to send to the discard pile.',
      cancellable: true,
    });

    if (!discardResult || discardResult.cancelled) return false;

    const { cardName: discardName, handIndex } = discardResult;
    if (discardName === undefined || handIndex === undefined) return false;

    if (ps.hand[handIndex] === discardName) {
      ps.hand.splice(handIndex, 1);
    } else {
      const fi = ps.hand.indexOf(discardName);
      if (fi < 0) return false;
      ps.hand.splice(fi, 1);
    }
    ps.discardPile.push(discardName);
    // Don't fire onDiscard yet — Glass of Marbles (and similar) should draw
    // AFTER the full effect resolves, not before the mill target is chosen.
    engine.log('magenta_discard', { player: ps.username, discarded: discardName });
    engine.sync();

    if ((ps.mainDeck || []).length === 0) {
      // Deck empty — fire onDiscard now and exit
      await engine.runHooks('onDiscard', {
        playerIdx: pi, cardName: discardName, discardedCardName: discardName,
        _fromHand: true, _skipReactionCheck: true,
      });
      return true;
    }

    // ── Step 2: choose a card from deck to mill ──────────────────────────

    const cardDB = engine._getCardDB();
    const seen   = new Set();
    const gallery = [];
    for (const cn of ps.mainDeck) {
      if (seen.has(cn)) continue;
      seen.add(cn);
      const cd = cardDB[cn];
      if (!cd) continue;
      gallery.push({ name: cn, source: 'deck' });
    }
    gallery.sort((a, b) => a.name.localeCompare(b.name));

    const picked = await engine.promptGeneric(pi, {
      type:         'cardGallery',
      cards:        gallery,
      title:        CARD_NAME,
      description:  'Choose a card from your deck to send to the discard pile.',
      confirmLabel: '🗑️ Mill it!',
      confirmClass: 'btn-danger',
      cancellable:  false, // Discard cost already paid
    });

    if (!picked || !picked.cardName) return true;

    const targetName = picked.cardName;
    if (!ps.mainDeck.includes(targetName)) return true;

    // Fire onDiscard for the hand cost NOW — targetCardName ensures the chosen
    // card is removed from the deck before anything is drawn, so Glass of
    // Marbles cannot draw back the card about to be milled. The draw overlaps
    // the animation.
    await engine.runHooks('onDiscard', {
      playerIdx: pi, cardName: discardName, discardedCardName: discardName,
      _fromHand: true, _skipReactionCheck: true,
    });

    // ── Step 3: mill via the standard function so ALL mill synergies fire ─
    // targetCardName pulls the specific card from anywhere in the deck.
    // holdDuration shows the card face-up for 2 s (same as before).
    // selfInflicted bypasses first-turn protection (player's own voluntary effect).
    await engine.actionMillCards(pi, 1, {
      targetCardName: targetName,
      holdDuration:   2000,
      source:         CARD_NAME,
      selfInflicted:  true,
    });

    engine.sync();
    return true;
  },
};
