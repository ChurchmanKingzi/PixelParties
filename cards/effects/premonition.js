// ═══════════════════════════════════════════
//  CARD EFFECT: "Premonition"
//  Ability — Free activation (once per turn,
//  any of own Phase 2 / 3 / 4)
//
//  Lv1: Search your deck for 1 card.
//  Lv2: Search your deck for up to 2 cards.
//  Lv3: Search your deck for up to 3 cards.
//
//  Reveal each searched card to the opponent
//  (deckSearchReveal popup, same stream pattern
//  Magnetic Glove uses) and place it face-down
//  on top of your deck. The placement order is
//  the pick order — the last picked card ends
//  up on the very top (drawn next).
//
//  Immediately end your turn afterwards.
//
//  Wiring notes:
//   • `freeActivation` (vs `actionCost`) so the
//     player can fire it during Main Phase 1
//     without an additional-action provider —
//     the card's cost IS ending the turn, not
//     spending an Action.
//   • `actionPhaseEligible: true` so it also
//     works in Action Phase (the engine gates
//     free-abilities to Main Phase by default).
//   • `gs._spellEndsTurn = true` consumed by
//     `doActivateFreeAbility` after onFreeActivate
//     resolves (parallel to the spell + action-
//     cost-ability paths).
//
//  The face-down stash is publicly known: both
//  players (and spectators) see the top cards
//  semi-transparently rendered on the deck pile
//  via the engine's `deckTopVisible` tracker.
//  The tracker is shifted on draw and cleared
//  on shuffle so visibility decays naturally.
// ═══════════════════════════════════════════

const CARD_NAME = 'Premonition';

module.exports = {
  activeIn: ['ability'],
  freeActivation: true,
  actionPhaseEligible: true,

  // CPU gating — Premonition ENDS the turn after resolution. A naïve
  // MCTS scoring "stash a card vs. do nothing" sees the immediate
  // upside and triggers it on the first runMainPhase pass, ending the
  // CPU's turn with most of its actions unspent. This hook defers the
  // activation to Main Phase 2 — by then the Action Phase has been
  // spent and the runMainPhase loop has already drained the rest of
  // its play list (artifacts, potions, ability attaches, surprises,
  // additional actions, creature/hero/equip/area effects). Activating
  // here turns Premonition into a "pass the rest of turn while
  // stashing N cards" instead of a turn-shotgun.
  cpuMeta: {
    shouldActivateNow(engine, cpuIdx) {
      // PHASES.MAIN2 = 4. Defer in Main 1 (skips Action Phase) and
      // Action Phase (consumes the Action slot for nothing useful);
      // only commit once we're in Main 2.
      return engine.gs.currentPhase === 4;
    },
  },

  /**
   * Gate: deck must have at least 1 card to search. HOPT and standard
   * Hero alive / not-frozen / not-stunned checks are handled by the
   * engine's doActivateFreeAbility wrapper.
   */
  canFreeActivate(ctx, level) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const ps = gs.players[pi];
    if (!ps) return false;
    return (ps.mainDeck || []).length > 0;
  },

  async onFreeActivate(ctx, level) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const oi = pi === 0 ? 1 : 0;
    const ps = gs.players[pi];
    if (!ps) return false;
    if ((ps.mainDeck || []).length === 0) return false;

    // Lv1 says "1 card" (mandatory). Lv2/Lv3 say "up to N" (the first
    // pick is cancellable so the player can decline searching at all).
    const maxPicks = Math.max(1, Math.min(3, level));
    const minPicks = level === 1 ? 1 : 0;

    let picksTaken = 0;

    while (picksTaken < maxPicks) {
      // The first `picksTaken` slots of mainDeck are already-stashed
      // cards from this activation — exclude them from the gallery so
      // the player can't re-pick what they just placed.
      const available = ps.mainDeck.slice(picksTaken);
      if (available.length === 0) break;

      // Deduplicated gallery with copy counts (same shape Magnetic Glove
      // builds for its tutor prompt).
      const countMap = {};
      for (const name of available) countMap[name] = (countMap[name] || 0) + 1;
      const galleryCards = Object.entries(countMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, count]) => ({ name, source: 'deck', count }));

      const cancellable = picksTaken >= minPicks;
      const slotLabel = `${picksTaken + 1}/${maxPicks}`;
      const baseDesc = `Choose a Card from your deck to place face-down on top of your deck (${slotLabel}).`;
      const description = cancellable
        ? `${baseDesc} Cancel to stop searching.`
        : baseDesc;

      const choice = await engine.promptGeneric(pi, {
        type: 'cardGallery',
        cards: galleryCards,
        title: CARD_NAME,
        description,
        confirmLabel: '🔮 Stash',
        confirmClass: 'btn-info',
        cancellable,
      });
      if (!choice?.cardName) break;

      const pickedName = choice.cardName;

      // Splice the first matching copy out of the available portion of
      // the deck (offset within `available`, then translate back to the
      // full mainDeck index).
      const offset = available.indexOf(pickedName);
      if (offset < 0) break;
      const fullIdx = picksTaken + offset;
      ps.mainDeck.splice(fullIdx, 1);

      // Place face-down on top — the chosen card becomes mainDeck[0].
      // Successive picks keep unshifting, so the LAST picked card ends
      // up at the very top (drawn next), matching pick-order = stack-
      // build-order from the spec.
      ps.mainDeck.unshift(pickedName);
      if (!ps.deckTopVisible) ps.deckTopVisible = [];
      ps.deckTopVisible.unshift(pickedName);

      engine.log('premonition_stash', {
        player: ps.username, card: pickedName, slot: picksTaken + 1, level,
      });

      // Stream the pick to the opponent — same `deckSearchReveal` popup
      // Magnetic Glove and other tutor cards use. The searcher already
      // saw the card in the gallery, so no separate reveal for them.
      // Sync first so opp sees the deckTopVisible update behind the
      // popup; then small delay to pace the popups when picking 2+.
      engine.sync();
      await engine._delay(300);
      await engine.promptGeneric(oi, {
        type: 'deckSearchReveal',
        cardName: pickedName,
        searcherName: ps.username,
        title: CARD_NAME,
        cancellable: false,
      });

      picksTaken++;
    }

    // "Immediately end your turn afterwards." Set the rider that
    // doActivateAbility consumes after onActionUsed hooks fire — the
    // turn advance has to happen there, not here, because we're
    // inside the ability's resolve path. (Same pattern as Tanuki
    // Escape's spell-side use of this flag.) Fires regardless of
    // pick count: activating Premonition commits to ending the turn
    // even when 0 cards were stashed at Lv2/3.
    gs._spellEndsTurn = true;

    engine.sync();
    return true;
  },
};
