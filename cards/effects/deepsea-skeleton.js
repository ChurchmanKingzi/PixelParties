// ═══════════════════════════════════════════
//  CARD EFFECT: "Deepsea Skeleton"
//  Creature (Summoning Magic Lv1) — 50 HP
//
//  Signature Deepsea bounce-placement.
//  On-summon (optional): choose up to 2 cards
//  in your deck and send them directly to
//  your discard pile (targeted self-mill — no
//  shuffle). Patterned after Cute Nerd
//  Magenta's hero effect. 1 per turn.
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

const CARD_NAME = 'Deepsea Skeleton';

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
      if (!ps || (ps.mainDeck || []).length === 0) return;

      if (!(await promptOptionalOnSummon(ctx, CARD_NAME,
        'Choose up to 2 cards in your deck to send to the discard pile?'
      ))) return;

      // Build a gallery of unique card names in the deck — same shape as
      // Magenta's effect. Sorted alphabetically so duplicates of the same
      // name collapse to one tile (actionMillCards with targetCardName
      // pulls a specific copy per call, so two picks of the same name
      // mill two copies).
      const cardDB = engine._getCardDB();
      const seen = new Set();
      const gallery = [];
      for (const cn of ps.mainDeck) {
        if (seen.has(cn)) continue;
        seen.add(cn);
        if (!cardDB[cn]) continue;
        gallery.push({ name: cn, source: 'deck' });
      }
      gallery.sort((a, b) => a.name.localeCompare(b.name));
      if (gallery.length === 0) return;

      const picked = await engine.promptGeneric(pi, {
        type: 'cardGalleryMulti',
        cards: gallery,
        title: CARD_NAME,
        description: 'Choose up to 2 cards in your deck to send to the discard pile.',
        selectCount: Math.min(2, ps.mainDeck.length),
        minSelect: 0,
        confirmLabel: '🗑️ Mill!',
        confirmClass: 'btn-danger',
        cancellable: true,
      });
      if (!picked || picked.cancelled) return;
      const chosen = Array.isArray(picked.selectedCards) ? picked.selectedCards : [];
      if (chosen.length === 0) return;

      // Mill both cards in a SINGLE batch so the deck→discard animation
      // staggers them 200ms apart (via the batch handler's `i * 200`
      // delay) instead of waiting the full hold+fade between cards.
      // selfInflicted bypasses first-turn protection (voluntary self-
      // mill); holdDuration matches Magenta's 2s face-up reveal.
      await engine.actionMillCards(pi, chosen.length, {
        targetCardNames: chosen,
        holdDuration: 2000,
        source: CARD_NAME,
        selfInflicted: true,
      });

      engine.sync();
    },
  },
};
