// ═══════════════════════════════════════════
//  CARD EFFECT: "Deepsea Witch"
//  Creature (Summoning Magic Lv2) — 50 HP
//
//  Signature Deepsea bounce-placement.
//  On-summon (optional): search your deck for
//  a Deepsea Creature, reveal it, and add it
//  to your hand. Deck is shuffled after.
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

const CARD_NAME = 'Deepsea Witch';

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
      const ps = engine.gs.players[pi];
      if (!ps) return;
      // Hand lock blocks any card-adding effect — skip the prompt
      // entirely rather than walking the player through a tutor that
      // can't add the chosen card.
      if (ps.handLocked) return;

      const seen = new Set();
      const eligible = [];
      for (const name of (ps.mainDeck || [])) {
        if (seen.has(name)) continue;
        if (!isDeepseaCreature(name, engine)) continue;
        seen.add(name);
        eligible.push({ name, source: 'deck' });
      }
      if (eligible.length === 0) return;

      if (!(await promptOptionalOnSummon(ctx, CARD_NAME,
        'Search your deck for a Deepsea Creature and add it to your hand?'
      ))) return;

      const picked = await ctx.promptCardGallery(eligible, {
        title: CARD_NAME,
        description: 'Choose a Deepsea Creature to add to your hand.',
        cancellable: true,
      });
      if (!picked?.cardName) return;

      await engine.actionAddCardFromDeckToHand(pi, picked.cardName, {
        source: CARD_NAME,
        shuffle: true,
        reveal: true,
      });
    },
  },
};
