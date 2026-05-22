// ═══════════════════════════════════════════
//  CARD EFFECT: "Idej Lord Nobunakin"
//  Hero (Idej) — 100 HP / 120 ATK — Fighting / Luck
//
//  "At the start of the game, before both players draw their starting
//   hands, search your deck for up to 2 "Idej Projection" cards and
//   1 "Idej Blade" card and attach them to this Hero."
//
//  Also the cost-0 partner for "Idej Sword - Muras" — see
//  `equipCostReduction`.
// ═══════════════════════════════════════════

const { idejLordStartOfGame } = require('./_idej-shared');

const PAIRED_SWORD = 'Idej Sword - Muras';

module.exports = {
  activeIn: ['hero'],

  hooks: {
    onBeforeHandDraw: async (ctx) => {
      await idejLordStartOfGame(ctx, { projections: 2, blades: 1 });
    },
  },

  equipCostReduction(gs, pi, heroIdx, cardData /*, engine */) {
    if (!cardData || cardData.name !== PAIRED_SWORD) return 0;
    return cardData.cost || 0;
  },
};
