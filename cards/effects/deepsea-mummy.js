// ═══════════════════════════════════════════
//  CARD EFFECT: "Deepsea Mummy"
//  Creature (Summoning Magic Lv1) — 100 HP
//
//  Signature Deepsea bounce-placement.
//  On-summon (optional): stun a chosen target
//  for 1 turn. 1 per turn.
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
  promptOptionalOnSummon,
} = require('./_deepsea-shared');

const CARD_NAME = 'Deepsea Mummy';

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

      if (!(await promptOptionalOnSummon(ctx, CARD_NAME, 'Stun a target for 1 turn?'))) return;

      const target = await ctx.promptDamageTarget({
        side: 'any', types: ['hero', 'creature'],
        title: CARD_NAME,
        description: 'Choose a target to Stun for 1 turn.',
        confirmLabel: '💫 Stun!',
        confirmClass: 'btn-info',
        cancellable: true,
      });
      if (!target) return;

      const engine = ctx._engine;
      if (target.type === 'hero') {
        await engine.addHeroStatus(target.owner, target.heroIdx, 'stunned', {
          duration: 1, appliedBy: ctx.cardOwner, animationType: 'electric_strike',
        });
      } else if (target.cardInstance && engine.canApplyCreatureStatus(target.cardInstance, 'stunned')) {
        target.cardInstance.counters.stunned = 1;
        target.cardInstance.counters.stunnedAppliedBy = ctx.cardOwner;
        engine._broadcastEvent('play_zone_animation', {
          type: 'electric_strike', owner: target.owner,
          heroIdx: target.heroIdx, zoneSlot: target.slotIdx,
        });
        engine.log('stun', { target: target.cardInstance.name, by: CARD_NAME, type: 'creature' });
      }
      engine.sync();
    },
  },
};
