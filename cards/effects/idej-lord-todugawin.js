// ═══════════════════════════════════════════
//  CARD EFFECT: "Idej Lord Todugawin"
//  Hero (Idej) — 100 HP / 120 ATK — Fighting / Infiltration
//
//  "At the start of the game, before both players draw their starting
//   hands, search your deck for up to 3 "Idej Blade" cards and equip
//   them to this Hero."
//
//  Also the cost-0 partner for "Idej Sword - Onima" — see
//  `equipCostReduction`.
// ═══════════════════════════════════════════

const { idejLordStartOfGame } = require('./_idej-shared');

const PAIRED_SWORD = 'Idej Sword - Onima';

module.exports = {
  activeIn: ['hero'],

  hooks: {
    onBeforeHandDraw: async (ctx) => {
      await idejLordStartOfGame(ctx, { projections: 0, blades: 3 });
    },
  },

  equipCostReduction(gs, pi, heroIdx, cardData /*, engine */) {
    if (!cardData || cardData.name !== PAIRED_SWORD) return 0;
    return cardData.cost || 0;
  },
};
