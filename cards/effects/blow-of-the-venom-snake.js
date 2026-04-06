// ═══════════════════════════════════════════
//  CARD EFFECT: "Blow of the Venom Snake"
//  Attack (Fighting Lv1, Normal)
//  Deals damage equal to the user's BASE ATK.
//  If the target is NOT already Poisoned,
//  inflict Poison (1 stack, 2 if 2nd Attack,
//  3 if 3rd Attack this turn).
//
//  Animation: ram + 🐍 + impact particles.
// ═══════════════════════════════════════════

module.exports = {
  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const ps = gs.players[pi];
      const hero = ps?.heroes?.[heroIdx];
      if (!hero?.name || hero.hp <= 0) return;

      const baseAtk = hero.baseAtk || 0;
      const attackNumber = (ps.attacksPlayedThisTurn || 0) + 1;
      const poisonStacks = attackNumber >= 3 ? 3 : attackNumber >= 2 ? 2 : 1;

      let desc = `Deal ${baseAtk} base ATK damage. Poison target (${poisonStacks} stack${poisonStacks > 1 ? 's' : ''} = ${poisonStacks * 30} dmg/turn).`;

      // Prompt for target
      const target = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'attack',
        title: 'Blow of the Venom Snake',
        description: desc,
        confirmLabel: `🐍 Strike! (${baseAtk})`,
        confirmClass: 'btn-danger',
        cancellable: true,
        condition: (t) => !(t.type === 'hero' && t.owner === pi && t.heroIdx === heroIdx),
      });

      if (!target) return;

      const tgtOwner = target.owner;
      const tgtHeroIdx = target.heroIdx;
      const tgtZoneSlot = target.type === 'hero' ? undefined : target.slotIdx;

      // Ram animation
      engine._broadcastEvent('play_ram_animation', {
        sourceOwner: ctx.cardHeroOwner, sourceHeroIdx: heroIdx,
        targetOwner: tgtOwner, targetHeroIdx: tgtHeroIdx,
        targetZoneSlot: tgtZoneSlot,
        cardName: hero.name, duration: 1200,
      });
      await engine._delay(150);

      // Impact
      const impactSlot = target.type === 'hero' ? -1 : target.slotIdx;
      engine._broadcastEvent('play_zone_animation', { type: 'explosion', owner: tgtOwner, heroIdx: tgtHeroIdx, zoneSlot: impactSlot });
      engine._broadcastEvent('play_zone_animation', { type: 'snake_impact', owner: tgtOwner, heroIdx: tgtHeroIdx, zoneSlot: impactSlot });
      await engine._delay(200);

      // Deal base ATK damage
      const attackSource = { name: 'Blow of the Venom Snake', owner: pi, heroIdx, controller: pi };

      if (target.type === 'hero') {
        const targetHero = gs.players[tgtOwner]?.heroes?.[tgtHeroIdx];
        if (targetHero && targetHero.hp > 0) {
          await engine.actionDealDamage(attackSource, targetHero, baseAtk, 'attack');
        }
      } else if (target.type === 'equip') {
        const inst = target.cardInstance || engine.cardInstances.find(c =>
          c.owner === tgtOwner && c.zone === 'support' &&
          c.heroIdx === tgtHeroIdx && c.zoneSlot === target.slotIdx
        );
        if (inst) {
          await engine.actionDealCreatureDamage(
            attackSource, inst, baseAtk, 'attack',
            { sourceOwner: pi, canBeNegated: true },
          );
        }
      }

      // Wait for ram return
      await engine._delay(500);

      // Poison the target if not already Poisoned
      if (target.type === 'hero') {
        const targetHero = gs.players[tgtOwner]?.heroes?.[tgtHeroIdx];
        if (targetHero && targetHero.hp > 0 && !targetHero.statuses?.poisoned) {
          await engine.addHeroStatus(tgtOwner, tgtHeroIdx, 'poisoned', {
            appliedBy: pi,
            stacks: poisonStacks,
            animationType: 'poison_splash',
          });
        }
      } else if (target.type === 'equip') {
        const inst = target.cardInstance || engine.cardInstances.find(c =>
          c.owner === tgtOwner && c.zone === 'support' &&
          c.heroIdx === tgtHeroIdx && c.zoneSlot === target.slotIdx
        );
        if (inst && !inst.counters.poisoned) {
          if (engine.canApplyCreatureStatus(inst, 'poisoned')) {
            inst.counters.poisoned = 1;
            inst.counters.poisonStacks = poisonStacks;
            inst.counters.poisonAppliedBy = pi;
            engine._broadcastEvent('play_zone_animation', {
              type: 'poison_splash', owner: tgtOwner,
              heroIdx: tgtHeroIdx, zoneSlot: target.slotIdx,
            });
            engine.log('poison_applied', { target: inst.name, by: 'Blow of the Venom Snake', stacks: poisonStacks });
          }
        }
      }

      engine.log('venom_snake', { player: ps.username, target: target.cardName, baseAtk, attackNumber, poisonStacks });
      engine.sync();
    },
  },
};
