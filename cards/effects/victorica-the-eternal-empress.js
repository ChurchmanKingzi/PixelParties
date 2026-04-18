// ═══════════════════════════════════════════
//  CARD EFFECT: "Victorica, the Eternal Empress"
//  Hero — Activated effect, once per turn.
//
//  Remove a Pollution Token from your side of the
//  board that was NOT placed there this turn.
//
//  Uses the engine's generic hero-effect scaffold
//  (activeIn: 'hero' + heroEffect + canActivateHeroEffect
//  + onHeroEffect) — HOPT is enforced by the engine.
//
//  Token bookkeeping lives entirely in _pollution-shared:
//    • Every placed Pollution Token records
//      `inst.counters.placedOnTurn = gs.turn` on placement.
//    • `removePollutionTokens(..., { filter })` accepts a
//      per-instance predicate so Victorica can restrict the
//      removable pool to tokens older than the current turn.
//
//  Animation: `victorica_holy_cleanse` plays on the slot
//  BEFORE the shared `pollution_evaporate` fires, selling
//  the "holy magic burns away corruption" theme.
// ═══════════════════════════════════════════

const { removePollutionTokens, getPollutionTokens } = require('./_pollution-shared');

module.exports = {
  activeIn: ['hero'],
  heroEffect: true,

  /**
   * Activatable only when at least one Pollution Token on our side
   * was placed BEFORE the current turn.
   */
  canActivateHeroEffect(ctx) {
    const engine = ctx._engine;
    const turn = engine.gs.turn || 0;
    const tokens = getPollutionTokens(engine, ctx.cardOwner);
    return tokens.some(inst => (inst.counters?.placedOnTurn ?? -1) !== turn);
  },

  /**
   * Remove one eligible Pollution Token. Shared helper handles
   * the zone-pick prompt (if multiple), the evaporate animation,
   * the untrack, and the onPollutionTokenRemoved hook broadcast.
   */
  async onHeroEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const turn = engine.gs.turn || 0;

    // Pick the eligible pool up front so we know which token to
    // anoint with the holy-cleanse VFX. When there's exactly one
    // choice we skip the picker and broadcast on that specific
    // token; with multiple, we pre-broadcast on every candidate
    // so the aura precedes the player's pick.
    const eligible = getPollutionTokens(engine, pi)
      .filter(inst => (inst.counters?.placedOnTurn ?? -1) !== turn);
    if (eligible.length === 0) return false;

    // Fire holy cleanse on all candidates BEFORE removal begins,
    // so the visual reads as a divine wave washing over tainted
    // zones. The shared pollution_evaporate still fires after on
    // the picked slot — combined, the token is cleansed then
    // evaporated.
    for (const inst of eligible) {
      engine._broadcastEvent('play_zone_animation', {
        type: 'victorica_holy_cleanse',
        owner: inst.owner,
        heroIdx: inst.heroIdx,
        zoneSlot: inst.zoneSlot,
      });
    }
    await engine._delay(450);

    const { removed } = await removePollutionTokens(engine, pi, 1, 'Victorica, the Eternal Empress', {
      promptCtx: ctx,
      filter: (inst) => (inst.counters?.placedOnTurn ?? -1) !== turn,
    });

    if (removed > 0) {
      engine.log('victorica_cleanse', {
        player: engine.gs.players[pi]?.username,
        removed,
      });
    }
    return removed > 0;
  },
};
