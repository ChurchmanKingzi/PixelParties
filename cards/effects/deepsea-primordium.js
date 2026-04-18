// ═══════════════════════════════════════════
//  CARD EFFECT: "Deepsea Primordium"
//  Creature (Summoning Magic Lv0) — 1 HP
//
//  Signature Deepsea bounce-placement.
//  On-summon (optional): grant an additional
//  action this turn for summoning a Deepsea
//  Creature from hand. 1 per turn.
//
//  The additional-action type is player-shared
//  (any Primordium grants into the same pool)
//  and is consumed when the controller plays
//  any Deepsea Creature. Expires at turn end.
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
  isDeepseaCreature,
  promptOptionalOnSummon,
} = require('./_deepsea-shared');

const CARD_NAME = 'Deepsea Primordium';
const ADDITIONAL_TYPE = 'summon_deepsea_primordium';

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

      if (!(await promptOptionalOnSummon(ctx, CARD_NAME,
        'Gain an additional action for summoning a Deepsea Creature from hand this turn?'
      ))) return;

      const engine = ctx._engine;
      engine.registerAdditionalActionType(ADDITIONAL_TYPE, {
        label: CARD_NAME,
        allowedCategories: ['creature'],
        filter: (cardData) => {
          if (!cardData || !hasCardType(cardData, 'Creature')) return false;
          // Read archetype via the shared helper so Deepsea Spores (all
          // creatures treated as Deepsea) works.
          return isDeepseaCreature(cardData.name, engine);
        },
      });
      ctx.grantAdditionalAction(ADDITIONAL_TYPE);
      engine.log('deepsea_primordium_extra', {
        player: engine.gs.players[ctx.cardOwner]?.username,
      });
      engine.sync();
    },
  },
};
