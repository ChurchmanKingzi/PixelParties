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

      // Valid targets: heroes + creatures that aren't immune, negated, or shielded
      const targets = [];
      for (let pi = 0; pi < 2; pi++) {
        const ps = ctx.players[pi];
        for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
          const hero = ps.heroes[hi];
          if (!hero?.name || hero.hp <= 0) continue;
          if (hero.statuses?.immune || hero.statuses?.negated) continue;
          targets.push({
            id: `hero-${pi}-${hi}`,
            type: 'hero',
            owner: pi,
            heroIdx: hi,
            cardName: hero.name,
          });
          // Creatures in this hero's support zones
          for (let si = 0; si < (ps.supportZones[hi] || []).length; si++) {
            const slot = (ps.supportZones[hi] || [])[si] || [];
            if (slot.length === 0) continue;
            const inst = engine.cardInstances.find(c => c.owner === pi && c.zone === 'support' && c.heroIdx === hi && c.zoneSlot === si);
            if (inst && inst.counters.negated) continue;
            targets.push({
              id: `equip-${pi}-${hi}-${si}`,
              type: 'equip',
              owner: pi,
              heroIdx: hi,
              slotIdx: si,
              cardName: slot[0],
            });
          }
        }
      }

      if (targets.length === 0) return;

      const selectedIds = await ctx.promptTarget(targets, {
        title: 'Sparky Slime',
        description: 'Select a target to Negate.',
        confirmLabel: 'Negate!',
        confirmClass: 'btn-warning',
        cancellable: false,
        exclusiveTypes: true,
        maxPerType: { hero: 1, equip: 1 },
      });

      if (!selectedIds || selectedIds.length === 0) return;
      const target = targets.find(t => t.id === selectedIds[0]);
      if (!target) return;

      if (target.type === 'hero') {
        await engine.addHeroStatus(target.owner, target.heroIdx, 'negated', {
          appliedBy: ctx.cardOwner,
          animationType: 'electric_strike',
        });
      } else if (target.type === 'equip') {
        const inst = engine.cardInstances.find(c => c.owner === target.owner && c.zone === 'support' && c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx);
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
