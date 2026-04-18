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
      if (!ctx.hardOncePerTurn('sparky-slime-summon')) return;

      const engine = ctx._engine;

      const selected = await ctx.promptMultiTarget({
        types: ['hero', 'creature'],
        side: 'any',
        max: 1,
        title: 'Sparky Slime',
        description: 'Select a target to Negate.',
        confirmLabel: 'Negate!',
        confirmClass: 'btn-warning',
        cancellable: false,
        condition: (t, eng) => {
          if (t.type === 'hero') {
            const hero = eng.gs.players[t.owner]?.heroes?.[t.heroIdx];
            return hero && !hero.statuses?.immune && !hero.statuses?.negated;
          }
          if (t.type === 'equip' && t.cardInstance) {
            return !(t.cardInstance.counters?.negated || t.cardInstance.counters?.nulled);
          }
          return true;
        },
      });

      if (selected.length === 0) return;
      const target = selected[0];

      if (target.type === 'hero') {
        await engine.addHeroStatus(target.owner, target.heroIdx, 'negated', {
          appliedBy: ctx.cardOwner,
          animationType: 'electric_strike',
        });
      } else if (target.type === 'equip') {
        const inst = target.cardInstance || engine.cardInstances.find(c => c.owner === target.owner && c.zone === 'support' && c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx);
        if (inst) {
          inst.counters.negated = 1;
          engine._broadcastEvent('play_zone_animation', { type: 'electric_strike', owner: target.owner, heroIdx: target.heroIdx, zoneSlot: target.slotIdx });
        }
      }
      engine.log('negate', { target: target.cardName, by: 'Sparky Slime', type: target.type });
    },

    onTurnStart: async (ctx) => {
      if (!ctx.isMyTurn) return;
      await ctx.changeLevel(1);
    },
  },
};
