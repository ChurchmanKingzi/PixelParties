// ═══════════════════════════════════════════
//  CARD EFFECT: "Adventurousness"
//  Ability — Action-costing activation.
//  Gains 10 × level Gold when activated.
//  HOPT across ALL heroes (only 1 per turn).
// ═══════════════════════════════════════════

module.exports = {
  actionCost: true,

  // CPU threat assessment: +10 gold per level when activated. HOPT is
  // team-wide (only 1 per turn across all heroes), but per-hero potential
  // is the full yield — good enough for ranking.
  supportYield(level) {
    return { goldPerTurn: 10 * level };
  },

  onActivate: async (ctx, level) => {
    const goldGain = 10 * level;
    await ctx.gainGold(goldGain);
    ctx.log('adventurousness_activated', { hero: ctx.heroName(), level, gold: goldGain });
  },
};
