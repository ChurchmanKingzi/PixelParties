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
//  (holdDuration: 900 on actionMillCards).
// ═══════════════════════════════════════════

const { loadCardEffect } = require('./_loader');

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
    // Exclude:
    //   • The just-discarded name (Step 1 cost) so the mill yields a
    //     DIFFERENT name in discard and doubles the unique-name churn.
    //   • Cards that opt into `selfDeleteOnExternalDiscard` (Rebelliokai
    //     archetype). Milling these routes the card straight to the
    //     deleted pile via the engine's external-discard redirect — it
    //     never lands in discard, so any "feed the discard pile"
    //     calculus the eval-delta scorer captures over-credits the mill.
    //     The resolver's snapshot doesn't replicate the redirect, so the
    //     scorer would happily target a Rebelliokai. Hard skip is
    //     simpler and correct: the CPU should never elect to mill a
    //     self-deleting card.
    const eligibleCards = cards.filter(c => {
      if (justDiscardedName && c.name === justDiscardedName) return false;
      const cs = loadCardEffect(c.name);
      if (cs?.selfDeleteOnExternalDiscard) return false;
      return true;
    });
    // Defensive: if filtering would empty the pool (deck contains only
    // copies of the just-discarded name or self-deleting cards —
    // pathological), fall back to the full pool so the prompt still
    // resolves. The CPU shouldn't soft-lock on an unwinnable choice.
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

      // Declarative `cpuMeta.onMillBenefit` — eval-delta above only
      // captures "card moved from deck to discard"; it does NOT fire
      // the would-be `onMill` hook (no `actionMillCards` call inside
      // the snapshot frame, since that's async + side-effecting).
      // Cards whose mill triggers a beneficial payoff (Mystery Box's
      // "draw 2 when milled", any future similar trigger) advertise
      // their post-mill value via this field so the picker correctly
      // rewards selecting them as targets. Number or function form
      // both supported — function gets `(engine, pi)` so the card
      // can self-gate on HOPT / per-turn-once / etc.
      const cs = loadCardEffect(name);
      const benefit = cs?.cpuMeta?.onMillBenefit;
      let benefitValue = 0;
      if (typeof benefit === 'number') benefitValue = benefit;
      else if (typeof benefit === 'function') {
        try { benefitValue = benefit(engine, pi) || 0; } catch { benefitValue = 0; }
      }
      score += benefitValue;

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

    // ★ Kanonischer Abwurf statt rohem Hand-Splice (Als Befund 19.8.:
    // erst ein Abwurf-Klang ohne sichtbare Wirkung, dann ein extrem
    // schneller, unvollstaendig aussehender Abwurf mit zweitem Klang).
    // Ursache war genau dieser Handgriff: der eigene `forceDiscard`-
    // Prompt spielte den Klang, danach entfernte ein roher Splice die
    // Karte — ohne Hand→Ablage-Flug, ohne Quellen-Glow, ohne die
    // ON_DISCARD-Hooks. Den Rest erledigte der Diff-Erkenner des
    // Clients, daher das abgehackte Bild und der zweite Klang.
    // `actionPromptForceDiscard` macht all das an EINER Stelle; der
    // Helfer kann seit v507 auch abbrechen und liefert die Namen.
    const abgeworfen = await engine.actionPromptForceDiscard(pi, 1, {
      source: CARD_NAME,
      selfInflicted: true,           // freiwillige Kosten, kein Zwang
      // ★ NICHT abbrechbar (Als Vorgabe 19.8.): „Der Effekt sollte,
      // sobald man im Forced-Discard-Handler angekommen ist, schlicht
      // nicht cancellable sein." Das „may" der Karte entscheidet sich
      // davor — beim Aktivieren des Heldeneffekts. Ist man einmal im
      // Abwurf, wird abgeworfen.
      cancellable: false,
      // ★ Kein Quellen-Glow (Als Vorgabe 19.8.): er kostet 500 ms
      // zwischen „Held angeklickt" und „Abwurf-Dialog da". Bei einem
      // selbst ausgeloesten Effekt weiss der Spieler ohnehin, was er
      // angeklickt hat.
      skipSourceGlow: true,
      title: CARD_NAME,
      description: 'Discard a card from your hand to choose a card from your deck to send to the discard pile.',
    });
    if (!abgeworfen || abgeworfen.length === 0) return false;
    const discardName = abgeworfen[0];
    engine.log('magenta_discard', { player: ps.username, discarded: discardName });
    engine.sync();

    if ((ps.mainDeck || []).length === 0) {
      // Deck leer — fertig. Die ON_DISCARD-Hooks hat der Helfer bereits
      // gefeuert; sie hier ein zweites Mal zu feuern haette Glass of
      // Marbles & Co. doppelt ausgeloest.
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

    // ★ Das frühere Nachfeuern von `onDiscard` ist ENTFALLEN: seit dem
    // Umbau auf `actionPromptForceDiscard` feuert der Helfer die Hooks
    // selbst, direkt beim Abwurf. Es hier zu wiederholen hätte Glass
    // of Marbles & Co. ein zweites Mal ausgelöst.
    // Die alte Reihenfolge („erst die Deck-Karte festlegen, dann
    // onDiscard") diente genau einem Zweck: Glass of Marbles sollte
    // die gleich gemillte Karte nicht zurückziehen können. Das ist
    // weiterhin gewahrt — `actionMillCards` zieht sie unten mit
    // `targetCardName` gezielt aus dem Deck, und der Helfer hat den
    // Abwurf schon abgeschlossen, bevor hier überhaupt gewählt wurde.

    // ── Step 3: mill via the standard function so ALL mill synergies fire ─
    // targetCardName pulls the specific card from anywhere in the deck.
    // ★ KEINE blockierende Haltezeit mehr (Als Befund 19.8., zweiter
    // Anlauf: „Der Delay am Ende ihres Effekts ist auch immer noch
    // da"). Der erste Anlauf senkte `holdDuration` von 2000 auf 900 —
    // gewartet wurde aber `travel + hold + fade + Puffer`, also
    // 700+900+300+100 = 2000 ms, praktisch unveraendert.
    // Mit `holdDuration: 0` entfaellt der Warteblock ganz; die
    // Deck→Ablage-Animation laeuft weiter, nur haelt sie den Zug nicht
    // mehr an. Wer wieder eine Lesepause will, dreht diese eine Zahl.
    // selfInflicted bypasses first-turn protection (player's own voluntary effect).
    await engine.actionMillCards(pi, 1, {
      targetCardName: targetName,
      holdDuration:   0,
      source:         CARD_NAME,
      selfInflicted:  true,
    });

    engine.sync();
    return true;
  },
};
