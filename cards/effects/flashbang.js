// ═══════════════════════════════════════════
//  CARD EFFECT: "Flashbang"
//  Potion (Normal)
//
//  Your opponent's NEXT turn ends immediately
//  after they perform their first Action.
//
//  Implementation
//  --------------
//  • The potion's resolve() tracks a fresh
//    instance of itself directly into the
//    deleted pile, stamping per-instance
//    counters that identify the target player
//    AND mark the trigger as not-yet-armed.
//  • `activeIn: ['deleted']` keeps the instance
//    firing hooks while it sits in the deleted
//    pile.
//  • onTurnStart of the target's next turn arms
//    the trigger.
//  • The first onActionUsed by the target on
//    that turn forces a phase advance straight
//    to End Phase, then untracks the instance
//    so subsequent turns are unaffected.
//  • A `_flashbangedDebuff` flag is set on the
//    target's player state for the entire
//    duration the card is "in flight" (used →
//    triggered or expired). The board UI reads
//    that flag to render the "Flashbanged"
//    debuff banner. onTurnEnd cleans up the
//    flag if the target ended their turn
//    without consuming an action (rare but
//    legal — e.g. they had nothing to play).
//
//  Animation
//  ---------
//  Pure screen-wide white flash — broadcast as a
//  dedicated `flashbang_screen` event so the
//  client can fade a full-viewport overlay
//  independent of the per-zone animation system.
// ═══════════════════════════════════════════

const CARD_NAME = 'Flashbang';

// Per-instance counter keys
const TARGET_KEY = 'flashbangTargetIdx';
const ARMED_KEY  = 'flashbangArmedTurn';

module.exports = {
  isPotion: true,
  // Hooks must keep firing while sitting in the deleted pile.
  activeIn: ['deleted'],

  resolve: async (engine, pi) => {
    const gs = engine.gs;
    const oppIdx = pi === 0 ? 1 : 0;
    const oppPs = gs.players[oppIdx];
    const ps    = gs.players[pi];
    if (!oppPs || !ps) return;

    // Track a Flashbang instance directly in the deleted pile so the
    // hooks below fire for it. We DON'T add the card name to ps.deletedPile
    // here — the standard potion-resolution path in server.js does that
    // after resolve() returns. Tracking is purely for hook attachment.
    const inst = engine._trackCard(CARD_NAME, pi, 'deleted', -1, -1);
    if (!inst.counters) inst.counters = {};
    inst.counters[TARGET_KEY] = oppIdx;
    // Not yet armed — only arms once the target's turn actually begins.
    inst.counters[ARMED_KEY] = -1;

    // Surface the "Flashbanged" status to the board UI.
    oppPs._flashbangedDebuff = true;

    // ── Screen-wide white flash ──
    engine._broadcastEvent('flashbang_screen', { source: pi });
    await engine._delay(900);

    engine.log('flashbang_used', {
      player: ps.username,
      target: oppPs.username,
    });
    engine.sync();
  },

  hooks: {
    /**
     * Arm the trigger at the start of the target's NEXT turn (any turn
     * after this potion was used where the active player matches our
     * stamped target index).
     */
    onTurnStart: (ctx) => {
      const targetIdx = ctx.card.counters?.[TARGET_KEY];
      if (targetIdx == null) return;
      if (ctx.activePlayer !== targetIdx) return;
      // Don't double-arm if onTurnStart fires twice (it shouldn't, but
      // defensive — the second arm would otherwise replace the original).
      if (ctx.card.counters[ARMED_KEY] === ctx.turn) return;
      // Arm now — the next onActionUsed by `targetIdx` will skip-end.
      ctx.card.counters[ARMED_KEY] = ctx.turn;
      // Re-assert the debuff flag in case it was cleared somehow.
      const ps = ctx._engine.gs.players[targetIdx];
      if (ps) ps._flashbangedDebuff = true;
      ctx._engine.log('flashbang_armed', {
        target: ps?.username,
      });
    },

    /**
     * On the first action the armed target performs this turn, force
     * the turn straight to End Phase. Then untrack this instance so
     * subsequent turns aren't affected.
     *
     * Listens on `onAnyActionResolved` (NOT `onActionUsed`) so the
     * trigger fires for ALL Action types — including inherent
     * (Quick Attack, Tarleinn's Floating Island when she casts it),
     * additional, and free-action plays. The plain `onActionUsed`
     * hook skips inherent + free plays so cards like Reiza's
     * second-action grant don't false-fire on Quick Attack; Flashbang
     * needs the broader signal.
     */
    onAnyActionResolved: async (ctx) => {
      const armedTurn = ctx.card.counters?.[ARMED_KEY];
      const targetIdx = ctx.card.counters?.[TARGET_KEY];
      const engine = ctx._engine;
      const gs = engine.gs;

      if (targetIdx == null) return;
      if (armedTurn !== gs.turn) return;
      // Only the target's own actions count.
      if (ctx.playerIdx !== targetIdx) return;

      // Disarm immediately so a chain of recursive onActionUsed events
      // (e.g. additional actions, follow-up plays in the same handler)
      // doesn't re-fire.
      ctx.card.counters[ARMED_KEY] = -1;

      // Clear the debuff flag — the trigger has fired.
      const targetPs = gs.players[targetIdx];
      if (targetPs) delete targetPs._flashbangedDebuff;

      // Visual: short flash to show the round-ending pop. Falls back
      // gracefully on the client if `flashbang_screen` isn't registered.
      engine._broadcastEvent('flashbang_screen', { source: ctx.cardOwner });
      await engine._delay(450);

      // The active player must still be the target — otherwise advanceToPhase
      // is a no-op (it gates on `playerIdx === gs.activePlayer`).
      if (gs.activePlayer === targetIdx) {
        // legalTransitions: MAIN1→END, ACTION→END, MAIN2→END all allowed.
        // From START/RESOURCE the card text doesn't really apply (no actions
        // can be taken there), so we don't bother handling those.
        const cur = gs.currentPhase;
        if (cur >= 2 && cur <= 4) {
          await engine.advanceToPhase(targetIdx, 5);
        }
      }

      engine.log('flashbang_triggered', {
        target: gs.players[targetIdx]?.username,
        atPhase: gs.currentPhase,
      });

      // Untrack the instance so this Flashbang doesn't fire again.
      engine._untrackCard(ctx.card.id);
      engine.sync();
    },

    /**
     * If the target ended their turn without consuming an action (rare
     * — e.g. they had nothing legal to play), clean up the debuff
     * banner and untrack the instance so future turns are unaffected.
     */
    onTurnEnd: (ctx) => {
      const targetIdx = ctx.card.counters?.[TARGET_KEY];
      const armedTurn = ctx.card.counters?.[ARMED_KEY];
      if (targetIdx == null) return;
      if (ctx.activePlayer !== targetIdx) return;
      // Only fire cleanup if THIS turn was the one we'd armed for.
      if (armedTurn !== ctx.turn) return;

      const engine = ctx._engine;
      const targetPs = engine.gs.players[targetIdx];
      if (targetPs) delete targetPs._flashbangedDebuff;
      engine._untrackCard(ctx.card.id);
      engine.log('flashbang_expired', { target: targetPs?.username });
      engine.sync();
    },
  },
};
