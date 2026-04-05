// ═══════════════════════════════════════════
//  CARD EFFECT: "Treasure Huntress Semi"
//  Hero — You gain 6 additional Gold during
//  your Resource Phase.
// ═══════════════════════════════════════════

module.exports = {
  activeIn: ['hero'],

  hooks: {
    onResourceGain: (ctx) => {
      // Only boost during Resource Phase
      if (ctx.phaseIndex !== 1) return;
      // Only boost the owner's gold
      if (ctx.playerIdx !== ctx.cardOwner) return;
      ctx.modifyAmount(6);
    },
  },
};
