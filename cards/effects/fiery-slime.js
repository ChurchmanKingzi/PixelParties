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

      // Valid targets: all living heroes AND creatures that aren't already burned
      // Burned ignores Immune — so we do NOT filter out immune heroes
      const targets = [];
      for (let pi = 0; pi < 2; pi++) {
        const ps = ctx.players[pi];
        for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
          const hero = ps.heroes[hi];
          if (!hero?.name || hero.hp <= 0) continue;
          if (hero.statuses?.burned) continue; // Can't double-burn
          targets.push({
            id: `hero-${pi}-${hi}`,
            type: 'hero',
            owner: pi,
            heroIdx: hi,
            cardName: hero.name,
          });
          // Also add creatures in this hero's support zones
          for (let si = 0; si < (ps.supportZones[hi] || []).length; si++) {
            const slot = (ps.supportZones[hi] || [])[si] || [];
            if (slot.length === 0) continue;
            const creatureName = slot[0];
            // Check if creature is already burned via engine counters
            const inst = engine.cardInstances.find(c => c.owner === pi && c.zone === 'support' && c.heroIdx === hi && c.zoneSlot === si);
            if (inst && inst.counters.burned) continue;
            targets.push({
              id: `equip-${pi}-${hi}-${si}`,
              type: 'equip',
              owner: pi,
              heroIdx: hi,
              slotIdx: si,
              cardName: creatureName,
            });
          }
        }
      }

      if (targets.length === 0) return; // Fizzles

      const selectedIds = await ctx.promptTarget(targets, {
        title: 'Fiery Slime',
        description: 'Select a target to Burn.',
        confirmLabel: 'Burn!',
        confirmClass: 'btn-danger',
        cancellable: false,
        exclusiveTypes: true,
        maxPerType: { hero: 1, equip: 1 },
      });

      if (!selectedIds || selectedIds.length === 0) return;
      const target = targets.find(t => t.id === selectedIds[0]);
      if (!target) return;

      if (target.type === 'hero') {
        await engine.addHeroStatus(target.owner, target.heroIdx, 'burned', {
          appliedBy: ctx.cardOwner,
          animationType: 'flame_strike',
        });
      } else if (target.type === 'equip') {
        // Burn a creature — mark it in counters, play animation
        const inst = engine.cardInstances.find(c => c.owner === target.owner && c.zone === 'support' && c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx);
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
