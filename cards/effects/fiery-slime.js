// ═══════════════════════════════════════════
//  CARD EFFECT: "Fiery Slime"
//  Creature — On summon, choose any target
//  that is not already Burned and Burn it.
//  Burned ignores Immune.
//  At the start of owner's turn, gain 1 level.
// ═══════════════════════════════════════════

module.exports = {
  activeIn: ['support'],

  hooks: {
    onPlay: async (ctx) => {
      // Hard Once Per Turn
      if (!ctx.hardOncePerTurn('fiery-slime-summon')) return;

      const engine = ctx._engine;

      // Valid targets: all living heroes that aren't already burned
      // Burned ignores Immune — so we do NOT filter out immune heroes
      const targets = [];
      for (let pi = 0; pi < 2; pi++) {
        const ps = ctx.players[pi];
        for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
          const hero = ps.heroes[hi];
          if (!hero?.name || hero.hp <= 0) continue;
          if (hero.statuses?.burned || hero.statuses?.shielded) continue; // Can't double-burn, can't burn shielded
          targets.push({
            id: `hero-${pi}-${hi}`,
            type: 'hero',
            owner: pi,
            heroIdx: hi,
            cardName: hero.name,
          });
        }
      }

      if (targets.length === 0) return; // Fizzles

      const selectedIds = await ctx.promptTarget(targets, {
        title: 'Fiery Slime',
        description: 'Select a target to Burn.',
        confirmLabel: 'Burn!',
        confirmClass: 'btn-danger',
        cancellable: false,
        exclusiveTypes: false,
        maxPerType: { hero: 1 },
      });

      if (!selectedIds || selectedIds.length === 0) return;
      const target = targets.find(t => t.id === selectedIds[0]);
      if (!target) return;

      await engine.addHeroStatus(target.owner, target.heroIdx, 'burned', {
        appliedBy: ctx.cardOwner,
        animationType: 'flame_strike',
      });
      engine.log('burn', { target: target.cardName, by: 'Fiery Slime' });
    },

    onTurnStart: (ctx) => {
      if (!ctx.isMyTurn) return;
      // Gain 1 level each turn
      ctx.card.counters.level = (ctx.card.counters.level || 0) + 1;
    },
  },
};
