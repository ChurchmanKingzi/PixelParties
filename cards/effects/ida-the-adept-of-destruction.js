// ═══════════════════════════════════════════
//  CARD EFFECT: "Ida, the Adept of Destruction"
//  Hero — Two passive effects:
//
//  1) All Destruction Spell damage dealt by cards
//     played through this Hero gets the "cannot be
//     negated" flag (pierces Diamond, etc.).
//     Tracked via source.heroIdx matching Ida's index.
//
//  2) Multi-target Destruction Spells cast by this
//     Hero become single-target instead. The normal
//     AoE/multi-target handling is replaced by the
//     generic single-target picker.
//     Implemented via a flag: heroFlags[pi-heroIdx]
//     .forcesSingleTarget = true.
//     Spell scripts check this flag during resolution.
// ═══════════════════════════════════════════

module.exports = {
  activeIn: ['hero'],

  hooks: {
    /**
     * On game start + on play: register the single-target override flag.
     * Stored on gameState so spell scripts can access it.
     */
    onGameStart: (ctx) => {
      const gs = ctx.gameState;
      if (!gs.heroFlags) gs.heroFlags = {};
      gs.heroFlags[`${ctx.cardOriginalOwner}-${ctx.cardHeroIdx}`] = { forcesSingleTarget: true };
    },

    onPlay: (ctx) => {
      const gs = ctx.gameState;
      if (!gs.heroFlags) gs.heroFlags = {};
      gs.heroFlags[`${ctx.cardOriginalOwner}-${ctx.cardHeroIdx}`] = { forcesSingleTarget: true };
    },

    /**
     * Effect 1: Destruction Spell damage dealt by Ida cannot be negated.
     * Hooks into beforeCreatureDamageBatch to modify entries.
     */
    beforeCreatureDamageBatch: (ctx) => {
      const entries = ctx.entries;
      if (!entries) return;

      for (const e of entries) {
        if (e.cancelled) continue;
        // Only affects destruction_spell damage from Ida's hero slot
        if (e.type !== 'destruction_spell') continue;
        if (e.sourceOwner !== ctx.cardOwner) continue;
        if (e.sourceHeroIdx !== ctx.cardHeroIdx) continue;
        // Mark as un-negatable
        e.canBeNegated = false;
      }
    },

    /**
     * Effect 1 (hero damage): Destruction Spell damage dealt by Ida
     * to heroes also cannot be negated. Sets a flag on the hookCtx
     * for future negation systems to check.
     */
    beforeDamage: (ctx) => {
      if (ctx.type !== 'destruction_spell') return;
      if (ctx.sourceHeroIdx < 0 || ctx.sourceHeroIdx !== ctx.cardHeroIdx) return;
      // Verify source belongs to same player as Ida
      const srcOwner = ctx.source?.owner ?? ctx.source?.controller ?? -1;
      if (srcOwner !== ctx.cardOwner) return;
      // Mark as un-negatable for any future hero-damage-negation effects
      ctx.cannotBeNegated = true;
    },

    /**
     * Clean up flag when Ida is removed from play (hero KO).
     */
    onHeroKO: (ctx) => {
      if (!ctx.hero || ctx.hero.name !== 'Ida, the Adept of Destruction') return;
      // Find which player/hero this is
      const gs = ctx.gameState;
      if (gs.heroFlags) {
        const key = `${ctx.cardOwner}-${ctx.cardHeroIdx}`;
        delete gs.heroFlags[key];
      }
    },
  },
};
