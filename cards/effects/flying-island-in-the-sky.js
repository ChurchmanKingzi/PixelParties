// ═══════════════════════════════════════════
//  CARD EFFECT: "Flying Island in the Sky"
//  Artifact (Equipment) — Equip to a Hero.
//  Adds 2 creature-only Support Zones.
//  When removed, creatures in those zones
//  are defeated and go to discard.
// ═══════════════════════════════════════════

module.exports = {
  activeIn: ['support'],
  isEquip: true,

  hooks: {
    onPlay: async (ctx) => {
      // Add 2 island zones to the equipped hero
      const engine = ctx._engine;
      engine.addIslandZones(ctx.cardOwner, ctx.cardHeroIdx, 2);
    },

    onCardLeaveZone: async (ctx) => {
      // When this card leaves its support zone, remove island zones
      // (creatures inside are defeated)
      const engine = ctx._engine;
      await engine.removeIslandZones(ctx.cardOwner, ctx.cardHeroIdx);
    },
  },
};
