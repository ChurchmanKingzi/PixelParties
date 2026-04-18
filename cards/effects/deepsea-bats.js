// ═══════════════════════════════════════════
//  CARD EFFECT: "Deepsea Bats"
//  Creature (Summoning Magic Lv1) — 50 HP
//
//  Signature Deepsea bounce-placement.
//  On-summon (optional): pick a Lv1-or-lower
//  Deepsea Creature from your discard pile and
//  place it into the free Support Zone of any
//  Hero you control, but negate its effects.
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
  isDeepseaCreature,
  promptOptionalOnSummon,
} = require('./_deepsea-shared');

const CARD_NAME = 'Deepsea Bats';

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
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      if (!ps) return;

      // Build list of eligible creatures in discard (level 1 or lower, Deepsea).
      const cardDB = engine._getCardDB();
      const seen = new Set();
      const eligible = [];
      for (const name of (ps.discardPile || [])) {
        if (seen.has(name)) continue;
        const cd = cardDB[name];
        if (!cd || cd.cardType !== 'Creature') continue;
        if ((cd.level || 0) > 1) continue;
        if (!isDeepseaCreature(name, engine)) continue;
        seen.add(name);
        eligible.push({ name, source: 'discard', cost: cd.level || 0 });
      }
      if (eligible.length === 0) return;

      // Any free support zone on any hero we control (living OR dead).
      const freeZones = engine.getFreeSupportZones(pi);
      if (freeZones.length === 0) return;

      if (!(await promptOptionalOnSummon(ctx, CARD_NAME,
        'Revive a Lv1-or-lower Deepsea Creature from your discard pile (its effects will be negated)?'
      ))) return;

      const picked = await ctx.promptCardGallery(eligible, {
        title: CARD_NAME,
        description: 'Pick a Lv1-or-lower Deepsea Creature to place (effects negated).',
        cancellable: true,
      });
      if (!picked?.cardName) return;

      const zone = await ctx.promptZonePick(freeZones, {
        title: CARD_NAME,
        description: `Place ${picked.cardName} into which free Support Zone?`,
        cancellable: true,
      });
      if (!zone) return;

      await engine.actionPlaceCreature(picked.cardName, pi, zone.heroIdx, zone.slotIdx, {
        source: 'discard',
        sourceName: CARD_NAME,
        negateEffects: true,
        animationType: 'deep_sea_bubbles',
      });
      engine.sync();
    },
  },
};
