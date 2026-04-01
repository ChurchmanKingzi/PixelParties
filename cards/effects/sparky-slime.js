// ═══════════════════════════════════════════
//  CARD EFFECT: "Sparky Slime"
//  Creature — On summon, choose any target
//  that is not Immune and Negate it.
//  At the start of owner's turn, gain 1 level.
//  Negated = hero + ability effects silenced,
//  but support/creature effects still active.
// ═══════════════════════════════════════════

module.exports = {
  activeIn: ['support'],

  hooks: {
    onPlay: async (ctx) => {
      // Hard Once Per Turn — only one Sparky Slime summon effect per turn
      if (!ctx.hardOncePerTurn('sparky-slime-summon')) return;

      const engine = ctx._engine;

      // Valid targets: all living heroes that aren't immune or already negated
      const targets = [];
      for (let pi = 0; pi < 2; pi++) {
        const ps = ctx.players[pi];
        for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
          const hero = ps.heroes[hi];
          if (!hero?.name || hero.hp <= 0) continue;
          if (hero.statuses?.immune || hero.statuses?.negated || hero.statuses?.shielded) continue;
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
        title: 'Sparky Slime',
        description: 'Select a target to Negate.',
        confirmLabel: 'Negate!',
        confirmClass: 'btn-warning',
        cancellable: false,
        exclusiveTypes: false,
        maxPerType: { hero: 1 },
      });

      if (!selectedIds || selectedIds.length === 0) return;
      const target = targets.find(t => t.id === selectedIds[0]);
      if (!target) return;

      await engine.addHeroStatus(target.owner, target.heroIdx, 'negated', {
        appliedBy: ctx.cardOwner,
        animationType: 'electric_strike',
      });
      engine.log('negate', { target: target.cardName, by: 'Sparky Slime' });
    },

    onTurnStart: (ctx) => {
      if (!ctx.isMyTurn) return;
      // Gain 1 level each turn
      ctx.card.counters.level = (ctx.card.counters.level || 0) + 1;
    },
  },
};
