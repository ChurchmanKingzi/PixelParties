// ═══════════════════════════════════════════
//  CARD EFFECT: "Torchure"
//  Spell (Magic Arts Lv3) — Inherent additional
//  Action, Main Phase 1 only.
//  Inflict 2 Poison Stacks (permanent) on one
//  of your own unpoisoned Heroes.
//  Grants 1 bonus main Action during Action Phase.
// ═══════════════════════════════════════════

module.exports = {
  // Inherent only during Main Phase 1
  inherentAction(gs) {
    return gs.currentPhase === 2; // PHASES.MAIN1
  },

  // Gray out when not Main Phase 1 or no unpoisoned heroes
  spellPlayCondition(gs, pi) {
    if (gs.currentPhase !== 2) return false;
    const ps = gs.players[pi];
    return (ps.heroes || []).some(h => h?.name && h.hp > 0 && !h.statuses?.poisoned);
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = ctx.gameState;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      if (!ps) return;

      // Prompt player to pick one of their own unpoisoned heroes
      const target = await ctx.promptDamageTarget({
        side: 'my',
        types: ['hero'],
        damageType: null,
        title: 'Torchure',
        description: 'Choose one of your Heroes to Poison (2 stacks, permanent).',
        confirmLabel: '\u2620\uFE0F Torchure!',
        confirmClass: 'btn-danger',
        cancellable: true,
        condition: (t) => {
          const h = gs.players[t.owner]?.heroes?.[t.heroIdx];
          return h && !h.statuses?.poisoned;
        },
      });

      if (!target) {
        gs._spellCancelled = true;
        return;
      }

      // Apply 2 stacks of permanent Poison
      await engine.addHeroStatus(pi, target.heroIdx, 'poisoned', {
        stacks: 2,
        permanent: true,
      });

      engine.log('torchure_poison', {
        player: ps.username,
        hero: ps.heroes[target.heroIdx]?.name,
      });

      // Grant the second-action grace slot. Does NOT stack with itself —
      // casting Torchure multiple times still only grants ONE bonus action
      // (the second slot of Action Phase). Consumption and slot-position
      // checks are handled by the server's action handlers + engine.
      ps._bonusMainActions = 1;
    },
  },
};
