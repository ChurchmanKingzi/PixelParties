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
      if (!ctx.hardOncePerTurn('fiery-slime-summon')) return;

      const engine = ctx._engine;

      // Note: Burned ignores Immune — so we do NOT filter out immune heroes
      const selected = await ctx.promptMultiTarget({
        types: ['hero', 'creature'],
        side: 'any',
        max: 1,
        title: 'Fiery Slime',
        description: 'Select a target to Burn.',
        confirmLabel: 'Burn!',
        confirmClass: 'btn-danger',
        cancellable: false,
        condition: (t, eng) => {
          if (t.type === 'hero') {
            const hero = eng.gs.players[t.owner]?.heroes?.[t.heroIdx];
            return hero && !hero.statuses?.burned;
          }
          if (t.type === 'equip' && t.cardInstance) {
            return !t.cardInstance.counters?.burned;
          }
          return true;
        },
      });

      if (selected.length === 0) return;
      const target = selected[0];

      if (target.type === 'hero') {
        await engine.addHeroStatus(target.owner, target.heroIdx, 'burned', {
          appliedBy: ctx.cardOwner,
          animationType: 'flame_strike',
        });
      } else if (target.type === 'equip') {
        const inst = target.cardInstance || engine.cardInstances.find(c => c.owner === target.owner && c.zone === 'support' && c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx);
        if (inst) {
          inst.counters.burned = 1;
          inst.counters.burnAppliedBy = ctx.cardOwner;
          engine._broadcastEvent('play_zone_animation', { type: 'flame_strike', owner: target.owner, heroIdx: target.heroIdx, zoneSlot: target.slotIdx });
        }
      }
      engine.log('burn', { target: target.cardName, by: 'Fiery Slime', type: target.type });
    },

    onTurnStart: async (ctx) => {
      if (!ctx.isMyTurn) return;
      await ctx.changeLevel(1);
    },
  },
};
