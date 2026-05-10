// ═══════════════════════════════════════════
//  CARD EFFECT: "Visionary Genius Heinz"
//  Hero — Active effect (HOPT).
//
//  You may once per turn discard up to 4 copies
//  of the SAME card name from your hand to draw
//  that many cards.
//
//  Flow (single in-place click-to-mark prompt):
//   1. All hand cards are highlighted. Player
//      clicks a card to mark it for discard.
//   2. The first click locks the card NAME —
//      every hand card with a different name
//      dims and becomes un-clickable. Further
//      clicks toggle copies of the SAME name on
//      and off.
//   3. The confirm button shows "Discard X" with
//      X = current marked count, capped at 4.
//   4. Cancel / Esc aborts. Confirm discards
//      every marked card, then draws X.
//   5. Toggling the LAST marked card off re-
//      enables every hand card (the lock lifts).
//
//  Implementation:
//   • One `handPick` prompt with `nameLock-
//     OnFirstSelect: true` — the client renders
//     the dynamic eligibility, dimming, and the
//     "Discard X" button label.
//   • Discards selected indices in descending
//     order so each splice doesn't shift the
//     remaining picks.
//   • 300ms breathing pause before
//     `actionDrawCards` so the client commits
//     the post-discard state separately from
//     the first draw — without it, React 18
//     batches the two sync events and the first
//     draw lands without its hand-fly-in
//     animation (same fix shape as Triceras).
// ═══════════════════════════════════════════

const CARD_NAME = 'Visionary Genius Heinz';
const MAX_DISCARDS = 4;

module.exports = {
  activeIn: ['hero'],
  heroEffect: true,

  // CPU rough threat: averages ~2 draws per activation when the
  // archetype is set up. Lower bound 1, upper bound 4 — the gate
  // already evaluates the actual hand state, so this is just a
  // ballpark for the recon prior.
  supportYield() {
    return { drawsPerTurn: 2 };
  },

  canActivateHeroEffect(ctx) {
    const pi = ctx.cardOwner;
    const ps = ctx.players[pi];
    if (!ps) return false;
    if (ps.handLocked) return false;
    return (ps.hand?.length || 0) >= 1;
  },

  async onHeroEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const ps = ctx.players[pi];
    if (!ps || (ps.hand?.length || 0) < 1) return false;

    const eligibleIndices = (ps.hand || []).map((_, i) => i);
    const result = await engine.promptGeneric(pi, {
      type: 'handPick',
      title: CARD_NAME,
      description: 'Click a card in your hand. Click further copies of the same card to mark them too. Click again to unmark. Up to 4 total.',
      eligibleIndices,
      minSelect: 1,
      maxSelect: MAX_DISCARDS,
      // Engages the client's name-lock UX: after the first click,
      // only same-name copies are clickable, and the confirm button
      // becomes "Discard X" where X = current marked count.
      nameLockOnFirstSelect: true,
      cancellable: true,
      confirmLabel: 'Discard',
    });
    if (!result || result.cancelled
        || !Array.isArray(result.selectedCards)
        || result.selectedCards.length === 0) {
      return false;
    }

    // Defensive — every selected card should share the same name
    // (the client enforced the lock), but verify.
    const targetName = result.selectedCards[0].cardName;
    const picked = result.selectedCards.filter(s => s.cardName === targetName);
    if (picked.length === 0) return false;

    // Sort descending so each splice doesn't shift remaining indices.
    picked.sort((a, b) => b.handIndex - a.handIndex);

    // Stagger the discards: per-card pile-transfer broadcast +
    // sync + brief delay. Without staggering, `actionDiscardHand-
    // Card` mutates state silently and the client only sees the
    // cumulative shrink on the first post-discard sync — every
    // discard "fly to pile" animation is lost AND the first draw's
    // sync arrives with a net-negative hand delta, which the diff
    // detector doesn't classify as a draw event so its hand-fly-in
    // animation is skipped too. Matches Champion the Stormbringer's
    // explicit-broadcast pattern.
    const STAGGER_MS = 120;
    let discarded = 0;
    for (const { cardName, handIndex } of picked) {
      // Re-resolve the index — a chained hook between picks could
      // have shifted the hand. Fall back to first-by-name.
      let resolvedIdx = handIndex;
      if (resolvedIdx == null || resolvedIdx < 0
          || resolvedIdx >= ps.hand.length || ps.hand[resolvedIdx] !== cardName) {
        resolvedIdx = ps.hand.indexOf(cardName);
      }
      if (resolvedIdx < 0) continue;
      // Broadcast the hand → discard flight BEFORE the splice so
      // the client captures the source slot's bounding rect while
      // it's still rendered.
      engine._broadcastEvent('play_pile_transfer', {
        owner: pi, cardName,
        from: 'hand', to: 'discard',
        fromHandIdx: resolvedIdx,
      });
      const ok = await engine.actionDiscardHandCard(pi, cardName, resolvedIdx, {
        source: CARD_NAME,
      });
      if (!ok) continue;
      discarded++;
      // Sync each discard so the client commits the hand-shrink
      // separately, and pause briefly so successive discards
      // visibly chain rather than fire as a single mass.
      engine.sync();
      if (discarded < picked.length) await engine._delay(STAGGER_MS);
    }
    if (discarded === 0) return false;

    // Breathing room before the draws so the client commits the
    // post-discard state separately from the first draw — same fix
    // applied to Triceras. Without this, React 18 batches the
    // discard-shrink and the iter-0 draw-grow into a single render
    // and the first card's hand-fly-in animation is skipped.
    await engine._delay(300);
    await engine.actionDrawCards(pi, discarded);

    engine.log('heinz_research', {
      player: ps.username, cardName: targetName, discarded, drew: discarded,
    });
    engine.sync();
    return true;
  },
};
