// ═══════════════════════════════════════════
//  CARD EFFECT: "Deepsea Pirate"
//  Creature (Summoning Magic Lv1) — 40 HP
//
//  Signature Deepsea bounce-placement.
//  On-summon: steal 6 Gold from the opponent.
//  Uses the shared stealGoldFromOpponent helper,
//  which fizzles on Turn-1 protection or when
//  the opponent is already at 0 Gold. 1 per
//  turn.
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

const CARD_NAME = 'Deepsea Pirate';
const STEAL_AMOUNT = 6;

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
      await ctx._engine.actionStealGold(ctx.cardOwner, STEAL_AMOUNT, {
        sourceName: CARD_NAME,
      });
    },
  },
};
