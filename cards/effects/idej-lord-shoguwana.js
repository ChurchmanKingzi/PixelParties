// ═══════════════════════════════════════════
//  CARD EFFECT: "Idej Lord Shoguwana"
//  Hero (Idej) — 100 HP / 120 ATK — Diplomacy / Fighting
//
//  "At the start of the game, before both players draw their starting
//   hands, search your deck for up to 1 "Idej Projection" card and
//   2 "Idej Blade" cards and attach them to this Hero."
//
//  Also the cost-0 partner for "Idej Sword - Kunagi" — see
//  `equipCostReduction`.
// ═══════════════════════════════════════════

const { idejLordStartOfGame } = require('./_idej-shared');

const PAIRED_SWORD = 'Idej Sword - Kunagi';

module.exports = {
  activeIn: ['hero'],

  hooks: {
    onBeforeHandDraw: async (ctx) => {
      await idejLordStartOfGame(ctx, { projections: 1, blades: 2 });
    },
  },

  equipCostReduction(gs, pi, heroIdx, cardData /*, engine */) {
    if (!cardData || cardData.name !== PAIRED_SWORD) return 0;
    return cardData.cost || 0;
  },
};
