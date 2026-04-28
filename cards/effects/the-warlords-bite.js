// ═══════════════════════════════════════════
//  CARD EFFECT: "The Warlord's Bite"
//  Spell (Decay Magic Lv1)
//
//  Choose a target (Hero or Creature, friend
//  or foe) that is NOT already Poisoned and
//  inflict Poison Stacks based on the caster's
//  combined Decay Magic + Performance level:
//    Lv1: 1 stack
//    Lv2: 2 stacks
//    Lv3: 4 stacks
//
//  Animation: snake bite → purple poison liquid.
// ═══════════════════════════════════════════

module.exports = {
  cpuMeta: { scalesWithSchool: 'Decay Magic' },
  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const ps = gs.players[pi];
      const hero = ps?.heroes?.[heroIdx];
      if (!hero?.name || hero.hp <= 0) return;

      // Determine combined Decay Magic + Performance level
      const abZones = ps.abilityZones[heroIdx] || [];
      const decayLevel = engine.countAbilitiesForSchool('Decay Magic', abZones);
      const perfLevel = engine.countAbilitiesForSchool('Performance', abZones);
      const combinedLevel = decayLevel + perfLevel;
      const stacks = combinedLevel >= 3 ? 4 : combinedLevel >= 2 ? 2 : 1;

      // Prompt for target — only unpoisoned heroes/creatures
      const target = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: null,
        title: "The Warlord's Bite",
        description: `Inflict ${stacks} Poison Stack${stacks > 1 ? 's' : ''} to an unpoisoned target.`,
        confirmLabel: `🐍 Bite! (${stacks} stack${stacks > 1 ? 's' : ''})`,
        confirmClass: 'btn-danger',
        cancellable: true,
        condition: (t) => {
          // Filter out already-poisoned targets
          if (t.type === 'hero') {
            const h = gs.players[t.owner]?.heroes?.[t.heroIdx];
            return h && !h.statuses?.poisoned;
          }
          if (t.type === 'equip' && t.cardInstance) {
            return !t.cardInstance.counters?.poisoned;
          }
          return true;
        },
      });

      if (!target) return;

      const tgtOwner = target.owner;
      const tgtHeroIdx = target.heroIdx;
      const tgtSlot = target.type === 'hero' ? -1 : target.slotIdx;

      // Snake bite animation
      engine._broadcastEvent('play_zone_animation', {
        type: 'snake_impact', owner: tgtOwner,
        heroIdx: tgtHeroIdx, zoneSlot: tgtSlot,
      });
      await engine._delay(600);

      // Purple poison liquid animation
      engine._broadcastEvent('play_zone_animation', {
        type: 'poison_splash', owner: tgtOwner,
        heroIdx: tgtHeroIdx, zoneSlot: tgtSlot,
      });
      await engine._delay(400);

      // Apply poison
      if (target.type === 'hero') {
        const tgtHero = gs.players[tgtOwner]?.heroes?.[tgtHeroIdx];
        if (tgtHero && tgtHero.hp > 0) {
          await engine.addHeroStatus(tgtOwner, tgtHeroIdx, 'poisoned', {
            addStacks: stacks,
            appliedBy: pi,
          });
        }
      } else if (target.type === 'equip') {
        const inst = target.cardInstance || engine.cardInstances.find(c =>
          c.owner === tgtOwner && c.zone === 'support' &&
          c.heroIdx === tgtHeroIdx && c.zoneSlot === target.slotIdx
        );
        if (inst && engine.canApplyCreatureStatus(inst, 'poisoned')) {
          inst.counters.poisoned = 1;
          inst.counters.poisonStacks = stacks;
          inst.counters.poisonAppliedBy = pi;
          engine.log('poison_applied', {
            target: inst.name, by: "The Warlord's Bite", stacks,
          });
        }
      }

      engine.log('warlords_bite', {
        player: ps.username, hero: hero.name,
        target: target.cardName, stacks, combinedLevel,
      });

      engine.sync();
    },
  },
};
