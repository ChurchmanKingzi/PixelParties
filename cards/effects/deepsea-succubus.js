// ═══════════════════════════════════════════
//  CARD EFFECT: "Deepsea Succubus"
//  Creature (Summoning Magic Lv2) — 40 HP
//
//  Signature Deepsea bounce-placement.
//  On-summon: pick any target your opponent
//  controls and take control of it until the
//  end of the turn. The stolen target cannot
//  take damage and cannot be defeated while
//  under your control.
//
//  Heroes: uses stealHero (same mechanism as
//  Charme Lv3 — charm status, support-zone
//  lock, revert at turn-start).
//
//  Creatures: uses stealCreature — the
//  creature STAYS in its original Support Zone
//  but its `controller` is flipped to us, and
//  _stealImmortal blocks damage & destruction
//  while stolen. Revert at turn-start.
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
const CARD_NAME = 'Deepsea Succubus';

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

      const target = await ctx.promptDamageTarget({
        side: 'enemy', types: ['hero', 'creature'],
        title: CARD_NAME,
        description: "Take control of an enemy target until end of turn (untouchable while stolen).",
        confirmLabel: '💋 Charm!',
        confirmClass: 'btn-success',
        cancellable: true,
      });
      if (!target) return;

      if (target.type === 'hero') {
        const ok = engine.actionStealHero(pi, target.owner, target.heroIdx, { sourceName: CARD_NAME });
        if (ok) {
          engine._broadcastEvent('play_zone_animation', {
            type: 'heal_sparkle', owner: target.owner, heroIdx: target.heroIdx, zoneSlot: -1,
          });
        }
      } else if (target.cardInstance) {
        // actionStealCreature marks controller and damage-immune flag. No move.
        engine.actionStealCreature(pi, target.cardInstance, {
          damageImmune: true, sourceName: CARD_NAME,
        });
        engine._broadcastEvent('play_zone_animation', {
          type: 'heal_sparkle', owner: target.owner,
          heroIdx: target.heroIdx, zoneSlot: target.slotIdx,
        });
      }
      engine.sync();
    },
  },
};
