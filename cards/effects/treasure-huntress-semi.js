// ═══════════════════════════════════════════
//  CARD EFFECT: "Treasure Huntress Semi"
//  Hero — You gain 6 additional Gold during
//  your Resource Phase.
// ═══════════════════════════════════════════

module.exports = {
  activeIn: ['hero'],

  // CPU threat assessment (gold supporter). Passive +6 gold each Resource Phase.
  supportYield() {
    return { goldPerTurn: 6 };
  },

  hooks: {
    onResourceGain: (ctx) => {
      // Only boost during Resource Phase
      if (ctx.phaseIndex !== 1) return;
      // v1344: NUR das Rundeneinkommen erhoehen (`_isResourceGain`), nicht
      // jeden Gewinn in der Resource Phase. Seit Golden Ladybug gibt es dort
      // auch Effekt-Gold — der Bonus haette sich sonst je Gewinn wiederholt.
      if (!ctx._isResourceGain) return;
      // Only boost the owner's gold
      if (ctx.playerIdx !== ctx.cardOwner) return;
      ctx.modifyAmount(6);
    },
  },
};
