// ═══════════════════════════════════════════
//  CARD EFFECT: "Deepsea Werewolf"
//  Creature (Summoning Magic Lv2) — 80 HP
//
//  Signature Deepsea bounce-placement.
//  On-summon: deal 80 damage to a target
//  (hero or creature). 1 per turn.
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

const CARD_NAME = 'Deepsea Werewolf';
const DAMAGE = 80;

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

      const target = await ctx.promptDamageTarget({
        side: 'any', types: ['hero', 'creature'],
        damageType: 'creature',
        title: CARD_NAME,
        description: `Deal ${DAMAGE} damage to a target.`,
        confirmLabel: `🐺 ${DAMAGE} Damage!`,
        confirmClass: 'btn-danger',
        cancellable: true,
      });
      if (!target) return;

      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      engine._broadcastEvent('play_zone_animation', {
        type: 'claw_maul',
        owner: target.owner,
        heroIdx: target.heroIdx,
        zoneSlot: target.type === 'hero' ? -1 : target.slotIdx,
      });
      await engine._delay(450);

      if (target.type === 'hero') {
        const tHero = engine.gs.players[target.owner]?.heroes?.[target.heroIdx];
        if (tHero?.name && tHero.hp > 0) {
          await ctx.dealDamage(tHero, DAMAGE, 'creature');
        }
      } else if (target.cardInstance) {
        await engine.actionDealCreatureDamage(
          ctx.card, target.cardInstance, DAMAGE, 'creature',
          { sourceOwner: pi, canBeNegated: true },
        );
      }
      engine.sync();
    },
  },
};
