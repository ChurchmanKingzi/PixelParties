// ═══════════════════════════════════════════
//  CARD EFFECT: "The Great Clock Tower Big Gwen"
//  Spell (Magic Arts Lv1, Area)
//  Pollution archetype.
//
//  You don't have to delete cards from your hand
//  immediately when you exceed your max hand size
//  while controlling Pollution Tokens (but your
//  max hand size is still reduced).
//
//  Effectively: Big Gwen turns the reactive hand-
//  limit enforcement off, so a player accumulating
//  Pollution Tokens can sit over the cap. At end
//  of turn the normal limit reasserts, and when
//  Big Gwen leaves play the reactive check runs
//  immediately to force any pending deletions.
//
//  Implementation:
//    • activeIn: ['hand', 'area'] — hand is needed so
//      the self-cast onPlay hook actually fires (at
//      cast time the CardInstance is still in 'hand');
//      area keeps the passive bypass + onCardLeaveZone
//      hook live while it's on the board.
//    • onPlay in 'hand' → placeArea + clock dial.
//    • onCardLeaveZone → reactive hand-limit recheck.
// ═══════════════════════════════════════════

const { placeArea } = require('./_area-shared');
const { countPollutionTokens } = require('./_pollution-shared');

module.exports = {
  activeIn: ['hand', 'area'],

  hooks: {
    /**
     * Place onto the caster's Area zone when cast from hand, then play the
     * signature clock dial animation (full-screen, above the battlefield).
     */
    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'hand') return;
      if (ctx.playedCard?.id !== ctx.card.id) return;
      const engine = ctx._engine;
      await placeArea(engine, ctx.cardOwner, ctx.card);
      // Big Gwen's signature: a giant clock face materializes over the
      // board, hands ticking from 11:55 to 12:00 sharp. Fires AFTER
      // placeArea so the card is already sitting in its zone when the
      // clock overlays; the event is standalone (not a zone animation),
      // so the client renders it centered above the battlefield.
      engine._broadcastEvent('big_gwen_clock_activation', {
        owner: ctx.cardOwner,
      });
      await engine._delay(2200);
    },

    /**
     * When Big Gwen leaves the Area zone, any Pollution-Token hand-cap
     * overhang the owner was carrying must be resolved immediately.
     *
     * Two subtleties:
     *   1. The leave hook fires BEFORE actionMoveCard finishes its zone
     *      transition — at hook-time this Big Gwen is still sitting in
     *      gs.areaZones[owner], so a synchronous hand-limit check would
     *      re-detect the bypass and do nothing. We defer via setImmediate
     *      so the transition completes first.
     *   2. Multiple stacked Big Gwens: the bypass stays active as long
     *      as ANY copy remains. Only the LAST Big Gwen leaving should
     *      kick the recheck, so we count remaining copies post-transition
     *      and no-op if any are still on the board.
     */
    onCardLeaveZone: async (ctx) => {
      if (ctx.fromZone !== 'area') return;
      if (ctx.fromOwner !== undefined && ctx.fromOwner !== ctx.cardOwner) return;
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const BIG_GWEN = 'The Great Clock Tower "Big Gwen"';
      setImmediate(() => {
        const remaining = engine.cardInstances.filter(c =>
          c.zone === 'area' && c.owner === pi && c.name === BIG_GWEN
        );
        if (remaining.length > 0) return;
        // Fire-and-forget the async check. If it needs a force-delete
        // prompt the engine's prompt pipeline handles the socket round-trip.
        engine._checkReactiveHandLimits(pi).catch(err =>
          console.error('[Big Gwen] hand-limit recheck failed:', err?.message || err)
        );
      });
    },
  },

  /**
   * Bypass predicate read by the engine's hand-limit helpers.
   * If this player has at least one Pollution Token on their side, the
   * hand-limit enforcement is deferred — the card name in hand stays.
   *
   * The engine's _shouldBypassHandLimit walks all hero bypassHandLimit
   * flags. We use the same convention but the flag lives on the card
   * module: the engine's walker will call any module's bypassHandLimit
   * function if present. This keeps Big Gwen's logic in its module.
   */
  bypassHandLimit: (engine, playerIdx) => {
    // Only applies to this Area's owner (not to both players)
    // — we look up the enchantment's active card instance.
    const ownAreas = engine.cardInstances.filter(c =>
      c.zone === 'area' &&
      c.owner === playerIdx &&
      c.name === 'The Great Clock Tower "Big Gwen"'
    );
    if (ownAreas.length === 0) return false;
    // Require the Pollution-Token pre-condition
    return countPollutionTokens(engine, playerIdx) > 0;
  },
};
