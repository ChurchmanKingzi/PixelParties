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
      // Only react to Flying Island's own departure from a Support Zone.
      // Fire-site shapes vary (some pass fromOwner/fromZoneSlot, some
      // don't) — only REJECT when a field is explicitly present and
      // mismatches. Engine fire sites that set `_onlyCard` have already
      // filtered this down to the actual leaving instance, so in that
      // case all of these checks pass trivially.
      if (ctx.fromZone !== 'support') return;
      if (ctx.fromOwner !== undefined && ctx.fromOwner !== ctx.cardOwner) return;
      if (ctx.fromHeroIdx !== undefined && ctx.fromHeroIdx !== ctx.cardHeroIdx) return;
      if (ctx.fromZoneSlot !== undefined && ctx.card?.zoneSlot !== undefined
          && ctx.fromZoneSlot !== ctx.card.zoneSlot) return;
      // Remove ONLY the 2 islands this specific card added. Passing the
      // explicit count keeps stacked Flying Islands from wiping each other
      // out when just one is destroyed.
      const engine = ctx._engine;
      await engine.removeIslandZones(ctx.cardOwner, ctx.cardHeroIdx, 2);
    },
  },
};
