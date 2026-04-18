// ═══════════════════════════════════════════
//  CARD EFFECT: "Deepsea Zombie"
//  Creature (Summoning Magic Lv1) — 50 HP
//
//  Signature Deepsea bounce-placement.
//  On-summon: opponent must discard 1 card
//  from their hand (THEIR choice via the
//  standard forceDiscard prompt).
//  1 per turn.
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

const CARD_NAME = 'Deepsea Zombie';

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

      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const oi = pi === 0 ? 1 : 0;
      const ops = engine.gs.players[oi];
      if (!ops || (ops.hand || []).length === 0) return;

      await engine.actionPromptForceDiscard(oi, 1, {
        title: CARD_NAME,
        description: 'Your opponent summoned Deepsea Zombie — discard 1 card.',
        source: CARD_NAME,
      });
      engine.sync();
    },
  },
};
