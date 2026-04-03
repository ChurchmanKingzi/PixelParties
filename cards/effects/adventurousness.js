// ═══════════════════════════════════════════
//  CARD EFFECT: "Adventurousness"
//  Ability — Action-costing activation.
//  Gains 10 × level Gold when activated.
//  HOPT across ALL heroes (only 1 per turn).
// ═══════════════════════════════════════════

module.exports = {
  actionCost: true,

  onActivate: async (ctx, level) => {
    const goldGain = 10 * level;
    await ctx.gainGold(goldGain);
    ctx.log('adventurousness_activated', { hero: ctx.heroName(), level, gold: goldGain });
  },
};
