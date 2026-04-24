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

  // CPU threat assessment (gold supporter). +20 gold per triggered status
  // instance on her — use her current statuses as a proxy for "has been
  // statused this game". If she's currently carrying any negative status,
  // treat her as generating the full 20 gold-per-turn; otherwise 0.
  supportYield(ctx) {
    const hero = ctx.engine.gs.players[ctx.pi]?.heroes?.[ctx.hi];
    const statuses = hero?.statuses || {};
    for (const k of Object.keys(statuses)) {
      if (statuses[k]) return { goldPerTurn: 20 };
    }
    return { goldPerTurn: 0 };
  },

  // CPU self-status target score. Fiona gains 20 gold per negative-status
  // application, so the CPU should eagerly aim self-status cards
  // (Sickly Cheese, Zsos'Ssar cost, …) at her when she's on its side.
  cpuStatusSelfValue(statusName) {
    return STATUS_EFFECTS[statusName]?.negative ? 40 : 0;
  },

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
