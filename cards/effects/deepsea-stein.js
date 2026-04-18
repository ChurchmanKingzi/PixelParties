// ═══════════════════════════════════════════
//  CARD EFFECT: "Deepsea Stein"
//  Creature (Summoning Magic Lv1) — 100 HP
//
//  Signature Deepsea bounce-placement.
//  On-summon (optional): pick up to 3 cards
//  with different names from your discard
//  pile and shuffle them back into your deck.
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
  promptOptionalOnSummon,
} = require('./_deepsea-shared');

const CARD_NAME = 'Deepsea Stein';
const MAX_PICKS = 3;

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
      if (!ps || (ps.discardPile || []).length === 0) return;

      if (!(await promptOptionalOnSummon(ctx, CARD_NAME,
        'Shuffle up to 3 different-named cards from discard back into your deck?'
      ))) return;

      // Build unique-name gallery from discard.
      const seen = new Set();
      const gallery = [];
      for (const n of ps.discardPile) {
        if (seen.has(n)) continue;
        seen.add(n);
        gallery.push({ name: n, source: 'discard' });
      }
      if (gallery.length === 0) return;

      const picked = await ctx.promptCardGalleryMulti(gallery, {
        title: CARD_NAME,
        description: `Pick up to ${MAX_PICKS} different cards to shuffle into your deck.`,
        selectCount: Math.min(MAX_PICKS, gallery.length),
        minSelect: 1,
        cancellable: true,
      });
      const chosen = picked?.selectedCards || [];
      if (chosen.length === 0) return;

      const recycled = await engine.actionRecycleCards(pi, chosen, {
        source: CARD_NAME,
        shuffle: true,
      });
      engine.log('deepsea_stein_shuffle', {
        player: ps.username, cards: recycled, count: recycled.length,
      });
      engine.sync();
    },
  },
};
