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
      // ★★ v1121 (Als Vorgabe 15.9.): „Karten wie Deepsea Witch sollten
      // nicht mal ihren optionalen Effekt ANBIETEN, das sollte alles
      // geskipped werden!"
      //
      // Derselbe Gedanke wie beim Hand-Lock eine Zeile darueber: wer
      // die gefundene Karte ohnehin nicht bekommt, soll auch nicht
      // gefragt werden, ob er suchen moechte. Die Sperre am Prompt
      // (v1117) greift erst an der GALERIE — die Ja/Nein-Frage davor
      // haette der Spieler trotzdem gesehen.
      if (engine._isSearchBlocked(pi, {}, 'deck')) {
        engine.log('search_offer_skipped', { player: ps.username, card: CARD_NAME });
        return;
      }

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
        'Search your deck for a Deepsea Creature and add it to your hand?',
        { searchToHand: true, searchPile: 'deck' },   // v1121
      ))) return;

      const picked = await ctx.promptCardGallery(eligible, {
        searchToHand: true, searchPile: 'deck',   // v1120
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
