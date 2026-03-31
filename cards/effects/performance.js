// ═══════════════════════════════════════════
//  CARD EFFECT: "Performance"
//  Ability — attaches on top of ANY existing
//  Ability with level <3. Increases that
//  Ability's level by 1. Visually transforms
//  into a copy of the Ability below it.
//  When played: the Hero takes 50 damage.
// ═══════════════════════════════════════════

module.exports = {
  activeIn: ['ability'],

  // Custom placement rules — overrides standard ability placement.
  // Performance can ONLY go onto occupied ability zones with <3 cards.
  // It CANNOT go into empty zones, and it works on ANY ability type.
  customPlacement: {
    /**
     * Check if this card can be placed in a specific zone.
     * @param {Array} zone - The ability zone array (e.g. ["Destruction Magic", "Destruction Magic"])
     * @returns {boolean}
     */
    canPlace: (zone) => {
      return zone.length > 0 && zone.length < 3;
    },
  },

  hooks: {
    onPlay: async (ctx) => {
      // Deal 50 damage to the hero this was attached to
      const hero = ctx.attachedHero;
      if (hero) {
        await ctx.dealDamage(hero, 50);
      }
    },
  },
};
