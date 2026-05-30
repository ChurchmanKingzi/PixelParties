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
     * On game start + on play + every turn start: register the single-
     * target override flag. Merged rather than replaced so other flags
     * set on the same hero-slot key (Monia / Nao / Toras / etc.) survive.
     * `onTurnStart` re-asserts defensively in case Ida was KO'd earlier
     * (which deletes the flag) and later revived — revival doesn't fire
     * onGameStart or onPlay, so without this the passive would stay off
     * after any resurrection.
     */
    onGameStart: (ctx) => {
      const gs = ctx.gameState;
      if (!gs.heroFlags) gs.heroFlags = {};
      const key = `${ctx.cardOriginalOwner}-${ctx.cardHeroIdx}`;
      gs.heroFlags[key] = { ...(gs.heroFlags[key] || {}), forcesSingleTarget: true };
    },

    onPlay: (ctx) => {
      const gs = ctx.gameState;
      if (!gs.heroFlags) gs.heroFlags = {};
      const key = `${ctx.cardOriginalOwner}-${ctx.cardHeroIdx}`;
      gs.heroFlags[key] = { ...(gs.heroFlags[key] || {}), forcesSingleTarget: true };
    },

    onTurnStart: (ctx) => {
      // Ida is alive + active (hooks filter dead / frozen / stunned /
      // negated heroes). Re-assert the flag so revives don't leave her
      // passive silently disabled.
      const hero = ctx.attachedHero;
      if (!hero?.name || hero.hp <= 0) return;
      const gs = ctx.gameState;
      if (!gs.heroFlags) gs.heroFlags = {};
      const key = `${ctx.cardOriginalOwner}-${ctx.cardHeroIdx}`;
      gs.heroFlags[key] = { ...(gs.heroFlags[key] || {}), forcesSingleTarget: true };
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
     * cannot be reduced OR negated, and ignores any effect that would
     * make a target unaffected by it (Anti Magic etc.). Stamps both
     * `cannotBeReduced` and `cannotBeNegated` via the engine's
     * canonical mutators — `ctx.lockReduction()` writes to the
     * underlying hookCtx (which the damage pipeline reads to skip the
     * buff multiplier pass), and `ctx.setFlag('cannotBeNegated', true)`
     * writes to the same hookCtx (the Anti Magic gate reads it to
     * skip the void). Direct `ctx.foo = true` assignment doesn't
     * propagate because `_createContext` spreads hookCtx into a fresh
     * object — fixed here so the card text actually works.
     */
    beforeDamage: (ctx) => {
      if (ctx.type !== 'destruction_spell') return;
      if (ctx.sourceHeroIdx < 0 || ctx.sourceHeroIdx !== ctx.cardHeroIdx) return;
      // Verify source belongs to same player as Ida
      const srcOwner = ctx.source?.owner ?? ctx.source?.controller ?? -1;
      if (srcOwner !== ctx.cardOwner) return;
      ctx.lockReduction();
      ctx.setFlag('cannotBeNegated', true);
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
