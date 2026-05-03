// ═══════════════════════════════════════════
//  CARD EFFECT: "Champion, the Stormbringer"
//  Hero — Activated effect, once per turn.
//
//  Spend your Action to discard up to 5 cards
//  from your hand, then draw that many cards.
//  Afterwards, your opponent must discard the
//  same number of cards and draw that many
//  cards. This draw cannot be prevented.
//
//  Activation pattern (Adventurousness-style):
//    • Action Phase — consumes the player's main
//      Action slot (or a bonus / second-action
//      grant if the slot is already used).
//    • Main Phase — requires an additional-action
//      provider (Friendship / Wolflesia / etc.).
//    Driven by `heroEffectActionCost: true`; see
//    server.js `doActivateHeroEffect` for the
//    action-resource gate that mirrors
//    creatureActionCost / actionCost-Ability
//    bookkeeping.
//
//  Resource cap: discard count = min(5, own hand,
//  opp hand). The opponent must be able to also
//  discard the same number — if either side has
//  zero cards, the cap is zero and the activation
//  is gated off entirely (canActivateHeroEffect).
//
//  Visual: each of the player's discarded cards
//  flies hand → discard via the windstorm flight
//  style first added for Tengu Windstorm
//  (`flightStyle: 'windstorm'` on
//  `play_pile_transfer`). The opponent's forced
//  discards use the standard force-discard UI
//  without the wind sweep — the wind only blows
//  Champion's own hand away.
//
//  "This draw cannot be prevented" — the opp's
//  forced draw passes `_unpreventable: true` to
//  `actionDrawCards`, bypassing both the
//  handLocked debuff and any BEFORE_DRAW
//  cancellation listener.
// ═══════════════════════════════════════════

const CARD_NAME    = 'Champion, the Stormbringer';
const MAX_DISCARDS = 5;
const STAGGER_MS   = 140; // gap between consecutive windstorm flights
const WIND_TAIL_MS = 1200; // total client-side animation length for windstorm

/** Min(5, own hand, opp hand). Caps the discard prompt's max. */
function _stormCap(gs, pi) {
  const oi = pi === 0 ? 1 : 0;
  const myHand = (gs.players[pi]?.hand || []).length;
  const oppHand = (gs.players[oi]?.hand || []).length;
  return Math.max(0, Math.min(MAX_DISCARDS, myHand, oppHand));
}

module.exports = {
  activeIn: ['hero'],
  heroEffect: true,
  // Adventurousness-style activation cost: spend an Action (Action Phase
  // or Main Phase via additional-action provider). Engine + server
  // wiring lives in `getActiveHeroEffects` and `doActivateHeroEffect`.
  heroEffectActionCost: true,

  // CPU threat assessment: a 5-discard / 5-draw on each side is a
  // ~zero-net hand-quality refresh — value depends on archetype-fit.
  // Rough single-resolution swing: +1 effective card from the filter
  // out / filter in churn for the player.
  supportYield() {
    return { drawsPerTurn: 1 };
  },

  canActivateHeroEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    // First-turn protection: Champion's effect forces the OPPONENT
    // to discard. While the opp is the first-turn-protected player,
    // every part of the effect that touches their hand is blocked
    // (forced discards refuse via the `firstTurnProtectedPlayer`
    // gate in `actionPromptForceDiscard`). The "this draw cannot be
    // prevented" rider on the opp's draw doesn't override turn-1
    // protection either — the protection is absolute. Rather than
    // letting the player burn their Action on a fizzle, gate the
    // activation entirely while turn-1 shielding is up.
    const oi = pi === 0 ? 1 : 0;
    if (gs.firstTurnProtectedPlayer === oi) return false;
    return _stormCap(gs, pi) >= 1;
  },

  async onHeroEffect(ctx) {
    const engine  = ctx._engine;
    const gs      = engine.gs;
    const pi      = ctx.cardOwner;
    const oi      = pi === 0 ? 1 : 0;
    const ps      = gs.players[pi];
    const ops     = gs.players[oi];
    if (!ps || !ops) return false;

    const cap = _stormCap(gs, pi);
    if (cap < 1) return false;

    // ── Step 1: pick own hand cards to discard (handPick) ──
    // Mulligan-style click-on-hand selection. Cancel = abort the
    // activation so the action cost is refunded (server.js
    // refundActionCost path).
    const eligibleIndices = ps.hand.map((_, i) => i);
    const handPick = await engine.promptGeneric(pi, {
      type:           'handPick',
      title:          CARD_NAME,
      description:    `Click 1 to ${cap} card${cap === 1 ? '' : 's'} in your hand to discard. You and your opponent will each draw the same number.`,
      eligibleIndices,
      maxSelect:      cap,
      minSelect:      1,
      confirmLabel:   '🌪️ Storm!',
      cancellable:    true,
    });
    if (!handPick || handPick.cancelled || !Array.isArray(handPick.selectedCards) || handPick.selectedCards.length === 0) {
      return false; // refund — server-side refundActionCost handles the rollback
    }

    // Sort by descending hand index so name-based splices below peel
    // right-to-left when duplicate names are picked.
    const picked = [...handPick.selectedCards].sort((a, b) => b.handIndex - a.handIndex);
    const N = picked.length;

    // ── Step 2: discard each picked card with a windstorm flight ──
    // Stagger the broadcasts so the cards visibly cascade off the hand
    // strip into the discard pile rather than launching as one
    // simultaneous mass. Each flight is `flightStyle: 'windstorm'` so
    // the keyframe / glow / duration match Tengu Windstorm's
    // board → deck animation. Standard `actionDiscardHandCard` does
    // the state mutation + onDiscard hook firing; the broadcast is
    // purely visual.
    for (let i = 0; i < picked.length; i++) {
      const { cardName, handIndex } = picked[i];
      // Re-resolve handIndex (state may have shifted between picks if
      // any prior `actionDiscardHandCard` triggered a hook that touched
      // the hand). Fall back to first-by-name.
      let resolvedIdx = handIndex;
      if (resolvedIdx == null || resolvedIdx < 0
          || resolvedIdx >= ps.hand.length || ps.hand[resolvedIdx] !== cardName) {
        resolvedIdx = ps.hand.indexOf(cardName);
      }
      if (resolvedIdx < 0) continue;

      engine._broadcastEvent('play_pile_transfer', {
        owner:       pi,
        cardName,
        from:        'hand',
        to:          'discard',
        fromHandIdx: resolvedIdx,
        flightStyle: 'windstorm',
      });

      await engine.actionDiscardHandCard(pi, cardName, resolvedIdx, {
        source: CARD_NAME,
      });

      if (i < picked.length - 1) await engine._delay(STAGGER_MS);
    }

    // Wait for the last flight to finish landing before the draw begins
    // — without it, the deck → hand draw animation can race ahead while
    // the windstorm tail is still mid-air, which reads chaotically.
    await engine._delay(WIND_TAIL_MS);

    // ── Step 3: own draw N ──
    await engine.actionDrawCards(pi, N, { source: CARD_NAME });
    engine.sync();
    await engine._delay(250);

    // ── Step 4: opp must discard N ──
    // Forced discard via the standard prompt. `flightStyle: 'windstorm'`
    // mirrors the player's own discards — each card the opp picks flies
    // out of their hand toward the discard pile via the chaotic gust
    // keyframe (Tengu Windstorm style). The flight broadcast fires
    // per-card inside `actionPromptForceDiscard`, just before the sync
    // that propagates the splice — so the source hand-slot rect is
    // still in the client DOM when the animation captures it.
    if ((ops.hand || []).length > 0) {
      await engine.actionPromptForceDiscard(oi, N, {
        source:        CARD_NAME,
        selfInflicted: false,
        title:         `${CARD_NAME} — Forced Discard`,
        description:   `${gs.players[pi].username} forces you to discard ${N} card${N === 1 ? '' : 's'}.`,
        flightStyle:   'windstorm',
      });
      // Hold for the last opp-side gust to land before the draw begins,
      // identical pacing to the player's own discard → draw transition
      // above. Without this the opp's tutor flies in while their wind-
      // tail is still mid-air, which reads chaotically.
      await engine._delay(WIND_TAIL_MS);
    }

    // ── Step 5: opp draw N (cannot be prevented) ──
    // `_unpreventable: true` bypasses handLocked + any BEFORE_DRAW
    // cancel listener — see actionDrawCards in _engine.js for the
    // bypass branches added alongside this card.
    await engine.actionDrawCards(oi, N, {
      source: CARD_NAME,
      _unpreventable: true,
    });

    engine.log('champion_storm', {
      player:    ps.username,
      opponent:  ops.username,
      discarded: picked.map(p => p.cardName),
      n:         N,
    });
    engine.sync();
    return true;
  },
};
