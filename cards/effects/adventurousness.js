// ═══════════════════════════════════════════
//  CARD EFFECT: "Adventurousness"
//  Ability — Action-costing activation.
//  Gains 10 × level Gold when activated.
//  HOPT across ALL heroes (only 1 per turn).
// ═══════════════════════════════════════════

// Als Ruling 17.8. ("Tuscan Aristocrat"), analog zum Zieh-Riegel:
// ist der Gold-Gewinn der EINZIGE Nutzen, wird die Karte gesperrt
// statt wirkungslos zu feuern. Auslegung in `_gold-block-shared.js`.
const { goldGainWouldBeBlocked } = require('./_gold-block-shared');

module.exports = {
  actionCost: true,

  // "use your Action to gain 10/20/30 Gold" — kein anderer Ertrag,
  // und es KOSTET eine Aktion. Gesperrt statt wirkungslos; das
  // Once-per-turn bleibt dabei unverbraucht.
  canActivateAction(gs, playerIdx, heroIdx, level, engine) {
    return !goldGainWouldBeBlocked(engine, playerIdx);
  },

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
