// ═══════════════════════════════════════════
//  CARD EFFECT: "Deepsea Jack O' Lantern"
//  Creature (Summoning Magic Lv1) — 40 HP
//
//  Signature Deepsea bounce-placement.
//  On the bounce-placement path: draw cards
//  equal to the bounced Creature's level.
//  On a normal summon path: no draw (there's
//  no "returned Creature" to reference).
//
//  The bounce-placement flow in _deepsea-shared
//  stashes the bounced Creature's level on the
//  new instance's counters (_bouncedFromLevel),
//  so we just read it here. 1 per turn.
// ═══════════════════════════════════════════

const {
  inherentActionIfBounceable,
  canBypassLevelReqIfBounceable,
  canBypassFreeZoneIfBounceable,
  canPlaceOnOccupiedSlotIfBounceable,
  getBouncePlacementTargetsList,
  tryBouncePlace,
  canSummonPerTurnLimit,
  markSummonedPerTurnLimit,
} = require('./_deepsea-shared');

const CARD_NAME = "Deepsea Jack O' Lantern";

module.exports = {
  inherentAction: inherentActionIfBounceable,
  canBypassLevelReq: canBypassLevelReqIfBounceable,
  canBypassFreeZoneRequirement: canBypassFreeZoneIfBounceable,
  canPlaceOnOccupiedSlot: canPlaceOnOccupiedSlotIfBounceable,
  getBouncePlacementTargets: getBouncePlacementTargetsList,
  beforeSummon: tryBouncePlace,
  canSummon: (ctx) => canSummonPerTurnLimit(ctx, CARD_NAME),

  hooks: {
    onPlay: async (ctx) => {
      markSummonedPerTurnLimit(ctx, CARD_NAME);

      const bouncedLevel = ctx.card?.counters?._bouncedFromLevel;
      if (bouncedLevel == null || bouncedLevel <= 0) return;

      const engine = ctx._engine;
      // Hand lock blocks any card-adding effect — skip the draw entirely
      // rather than calling into a fizzling actionDrawCards.
      if (engine.gs.players[ctx.cardOwner]?.handLocked) return;

      await ctx.drawCards(ctx.cardOwner, bouncedLevel);
      engine.log('deepsea_jack_lantern_draw', {
        player: engine.gs.players[ctx.cardOwner]?.username, cards: bouncedLevel,
      });
      engine.sync();
    },
  },
};
