// ═══════════════════════════════════════════
//  CARD EFFECT: "Idej Lord Daiyo"
//  Hero (Idej) — 100 HP / 120 ATK — Fighting / Wisdom
//
//  "At the start of the game, before both players draw their starting
//   hands, search your deck for up to 3 "Idej Projection" cards and
//   attach them to this Hero."
//
//  Also the cost-0 partner for "Idej Sword - Kogarasu" — see
//  `equipCostReduction`.
// ═══════════════════════════════════════════

const { idejLordStartOfGame } = require('./_idej-shared');

const PAIRED_SWORD = 'Idej Sword - Kogarasu';

module.exports = {
  activeIn: ['hero'],

  hooks: {
    onBeforeHandDraw: async (ctx) => {
      await idejLordStartOfGame(ctx, { projections: 3, blades: 0 });
    },
  },

  // "If you equip Idej Sword - Kogarasu to Idej Lord Daiyo, its Cost
  // becomes 0." — the engine's equip handler subtracts this from the
  // Sword's base cost (server doPlayArtifact `equipCostReduction`).
  equipCostReduction(gs, pi, heroIdx, cardData /*, engine */) {
    if (!cardData || cardData.name !== PAIRED_SWORD) return 0;
    return cardData.cost || 0;
  },
};
