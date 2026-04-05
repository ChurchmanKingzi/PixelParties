// ═══════════════════════════════════════════
//  CARD EFFECT: "Performance"
//  Ability — attaches on top of ANY existing
//  Ability with level <3. Increases that
//  Ability's level by 1. Visually transforms
//  into a copy of the Ability below it.
//  When played: the Hero takes 50 damage.
//
//  Performance copies the ability below it,
//  so it delegates to the copied ability's
//  onPlay and onCardLeaveZone hooks. This
//  makes stat bonuses (Fighting ATK, Toughness
//  HP, etc.) apply and reverse correctly.
// ═══════════════════════════════════════════

const { loadCardEffect } = require('./_loader');

module.exports = {
  activeIn: ['ability'],

  // When stacked on an ability, Performance counts as that ability's
  // spell school for spell-school requirement checks.
  isWildcardAbility: true,

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

      // Performance copies the ability below it — delegate to that ability's onPlay.
      // This makes Performance trigger stat bonuses (Fighting ATK, Toughness HP, etc.)
      // just like a real copy of that ability would.
      const ps = ctx.players[ctx.cardOwner];
      const zone = (ps.abilityZones[ctx.cardHeroIdx] || [])[ctx.card.zoneSlot] || [];
      if (zone.length < 2) return; // No ability below (shouldn't happen with customPlacement)
      const baseAbilityName = zone[0]; // The ability Performance is copying
      ctx.card.counters.copiedAbility = baseAbilityName; // Remember for onCardLeaveZone

      const baseScript = loadCardEffect(baseAbilityName);
      if (baseScript?.hooks?.onPlay) {
        await baseScript.hooks.onPlay(ctx);
      }
    },

    onCardLeaveZone: async (ctx) => {
      // Only react when an ability card leaves (not creatures dying in support zones)
      if (ctx.fromZone !== 'ability') return;
      // When Performance leaves, reverse the copied ability's effects.
      // Delegate to the copied ability's onCardLeaveZone hook so that
      // stat bonuses (Fighting ATK, Toughness HP, etc.) are properly removed.
      const copiedAbility = ctx.card.counters.copiedAbility;
      if (!copiedAbility) return;

      const baseScript = loadCardEffect(copiedAbility);
      if (baseScript?.hooks?.onCardLeaveZone) {
        await baseScript.hooks.onCardLeaveZone(ctx);
      }
    },
  },
};
