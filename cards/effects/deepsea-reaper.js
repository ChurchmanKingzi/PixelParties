// ═══════════════════════════════════════════
//  CARD EFFECT: "Deepsea Reaper"
//  Creature (Summoning Magic Lv2) — 10 HP
//
//  Signature Deepsea bounce-placement.
//  On-summon (optional): pick any Creature on
//  the board and defeat it (send to discard).
//  1 per turn.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
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

const CARD_NAME = 'Deepsea Reaper';

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
      const cardDB = engine._getCardDB();

      const creatures = [];
      for (const inst of engine.cardInstances) {
        if (inst.zone !== 'support') continue;
        if (inst.id === ctx.card.id) continue;
        const cd = cardDB[inst.name];
        if (!cd || !hasCardType(cd, 'Creature')) continue;
        if (inst.faceDown) continue;
        creatures.push(inst);
      }
      if (creatures.length === 0) return;

      if (!(await promptOptionalOnSummon(ctx, CARD_NAME,
        'Defeat any Creature on the board?'
      ))) return;

      const target = await ctx.promptDamageTarget({
        side: 'any', types: ['creature'],
        title: CARD_NAME,
        description: 'Pick a Creature to defeat.',
        confirmLabel: '💀 Defeat!',
        confirmClass: 'btn-danger',
        cancellable: true,
        excludeSelf: true,
      });
      if (!target || !target.cardInstance) return;

      // Scythe cut animation on the victim BEFORE destruction so the
      // player sees the blade that killed the creature.
      const victim = target.cardInstance;
      engine._broadcastEvent('play_zone_animation', {
        type: 'scythe_cut', owner: victim.controller ?? victim.owner,
        heroIdx: victim.heroIdx, zoneSlot: victim.zoneSlot,
      });
      await engine._delay(550);

      await engine.actionDestroyCard(ctx.card, victim);
      engine.sync();
    },
  },
};
