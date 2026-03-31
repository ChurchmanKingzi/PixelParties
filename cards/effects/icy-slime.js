// ═══════════════════════════════════════════
//  CARD EFFECT: "Icy Slime"
//  Creature — On summon, choose any target
//  that is not Frozen or Immune and Freeze it.
//  At the start of owner's turn, gain 1 level.
// ═══════════════════════════════════════════

module.exports = {
  activeIn: ['support'],

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = ctx.players;
      const oppIdx = ctx.cardOwner === 0 ? 1 : 0;

      // Compute valid targets: all heroes (both players) that aren't dead, frozen, or immune
      const targets = [];
      for (let pi = 0; pi < 2; pi++) {
        const ps = ctx.players[pi];
        for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
          const hero = ps.heroes[hi];
          if (!hero?.name || hero.hp <= 0) continue;
          if (hero.statuses?.frozen || hero.statuses?.immune) continue;
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

      // Uncancellable target picker
      const selectedIds = await ctx.promptTarget(targets, {
        title: 'Icy Slime',
        description: 'Select a target to Freeze.',
        confirmLabel: 'Freeze!',
        confirmClass: 'btn-info',
        cancellable: false,
        exclusiveTypes: false,
        maxPerType: { hero: 1 },
      });

      if (!selectedIds || selectedIds.length === 0) return;
      const target = targets.find(t => t.id === selectedIds[0]);
      if (!target) return;

      await engine.addHeroStatus(target.owner, target.heroIdx, 'frozen', { appliedBy: ctx.cardOwner, animationType: 'ice_encase' });
      engine.log('freeze', { target: target.cardName, by: 'Icy Slime' });
    },

    onTurnStart: (ctx) => {
      if (!ctx.isMyTurn) return;
      // Gain 1 level each turn
      ctx.card.counters.level = (ctx.card.counters.level || 0) + 1;
    },
  },
};
