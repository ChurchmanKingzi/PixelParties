// ═══════════════════════════════════════════
//  CARD EFFECT: "Fiona, the Princess of Blackport"
//  Hero — Wealth / Wealth
//
//  Whenever this Hero is afflicted by any
//  negative status effect, the player gains
//  20 Gold. Triggers per status instance
//  (not per stack). This effect CANNOT be
//  negated by Frozen, Stunned, Negated, or
//  any other negative status.
// ═══════════════════════════════════════════

const { STATUS_EFFECTS } = require('./_hooks');

module.exports = {
  activeIn: ['hero'],

  // This hero's effects fire even while Frozen/Stunned/Negated
  bypassStatusFilter: true,

  hooks: {
    onStatusApplied: async (ctx) => {
      // Only trigger when THIS hero receives the status
      const target = ctx.target;
      if (!target) return;

      const heroOwner = ctx.heroOwner;
      const heroIdx = ctx.heroIdx;
      if (heroOwner !== ctx.cardOwner || heroIdx !== ctx.cardHeroIdx) return;

      // Must be a negative status
      const statusName = ctx.statusName;
      const statusDef = STATUS_EFFECTS[statusName];
      if (!statusDef?.negative) return;

      // Hero must be alive
      const hero = ctx.attachedHero;
      if (!hero?.name || hero.hp <= 0) return;

      // Gain 20 Gold with sparkle animation
      const engine = ctx._engine;
      engine._broadcastEvent('play_zone_animation', {
        type: 'gold_sparkle', owner: heroOwner,
        heroIdx, zoneSlot: -1,
      });

      await ctx.gainGold(20);

      engine.log('fiona_gold', {
        hero: hero.name, status: statusName, gold: 20,
        player: engine.gs.players[heroOwner]?.username,
      });
    },
  },
};
