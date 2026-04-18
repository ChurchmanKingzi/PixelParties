// ═══════════════════════════════════════════
//  CARD EFFECT: "Deepsea Poltergeister"
//  Creature (Summoning Magic Lv2) — 50 HP
//
//  Signature Deepsea bounce-placement.
//  On-summon (optional): pick any Artifact on
//  the board and send it to the discard pile.
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

const CARD_NAME = 'Deepsea Poltergeister';

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

      // Build direct-click targets for every Artifact on the board —
      // both own and opponent's. Targets use `type: 'equip'` with the
      // standard `equip-{pi}-{hi}-{si}` id so the client's generic
      // support-zone click highlight engages without a modal.
      const targets = [];
      for (const inst of engine.cardInstances) {
        if (inst.zone !== 'support') continue;
        if (inst.faceDown) continue;
        const cd = cardDB[inst.name];
        if (!cd || !hasCardType(cd, 'Artifact')) continue;
        const ownerPi = inst.controller ?? inst.owner;
        targets.push({
          id: `equip-${ownerPi}-${inst.heroIdx}-${inst.zoneSlot}`,
          type: 'equip', owner: ownerPi,
          heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot,
          cardName: inst.name, cardInstance: inst,
        });
      }
      if (targets.length === 0) return;

      if (!(await promptOptionalOnSummon(ctx, CARD_NAME,
        'Destroy an Artifact on the board?'
      ))) return;

      const selectedIds = await engine.promptEffectTarget(ctx.cardOwner, targets, {
        title: CARD_NAME,
        description: 'Click an Artifact on the board to destroy it.',
        confirmLabel: '💥 Destroy',
        confirmClass: 'btn-danger',
        cancellable: true,
        maxTotal: 1,
      });
      if (!selectedIds || selectedIds.length === 0) return;
      const chosen = targets.find(t => t.id === selectedIds[0]);
      if (!chosen?.cardInstance) return;

      // Spooky ghost haunts the Artifact slot BEFORE it's destroyed so
      // the player sees the cause-and-effect.
      engine._broadcastEvent('play_zone_animation', {
        type: 'spooky_ghost', owner: chosen.owner,
        heroIdx: chosen.heroIdx, zoneSlot: chosen.slotIdx,
      });
      await engine._delay(900);

      await engine.actionDestroyCard(ctx.card, chosen.cardInstance);
      engine.sync();
    },
  },
};
