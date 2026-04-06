// ═══════════════════════════════════════════
//  CARD EFFECT: "Icebolt"
//  Spell (Destruction Magic Lv2)
//  Choose a target and deal 120 damage to it.
//  If the target can be Frozen, Freeze it.
//  Uses an ice projectile animation with
//  ice_encase on impact.
// ═══════════════════════════════════════════

module.exports = {
  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = ctx.gameState;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;

      // Select any target (heroes + creatures, either side)
      const target = await ctx.promptDamageTarget({
        side: 'any',
        types: ['hero', 'creature'],
        damageType: 'destruction_spell',
        title: 'Icebolt',
        description: 'Choose a target to deal 120 damage and Freeze.',
        confirmLabel: '❄️ Icebolt! (120)',
        confirmClass: 'btn-info',
        cancellable: true,
      });

      if (!target) return; // Cancelled

      // Play ice projectile animation from casting hero to target
      engine._broadcastEvent('play_projectile_animation', {
        sourceOwner: ctx.cardHeroOwner,
        sourceHeroIdx: heroIdx,
        targetOwner: target.owner,
        targetHeroIdx: target.heroIdx,
        targetZoneSlot: target.type === 'equip' ? target.slotIdx : -1,
        projectileClass: 'projectile-ice-bolt',
        trailClass: 'projectile-ice-trail',
        duration: 500,
      });

      await engine._delay(450); // Wait for projectile to arrive

      // Play ice impact animation on target
      if (target.type === 'hero') {
        engine._broadcastEvent('play_zone_animation', {
          type: 'ice_encase', owner: target.owner,
          heroIdx: target.heroIdx, zoneSlot: -1,
        });
      } else {
        engine._broadcastEvent('play_zone_animation', {
          type: 'ice_encase', owner: target.owner,
          heroIdx: target.heroIdx, zoneSlot: target.slotIdx,
        });
      }

      await engine._delay(300);

      // Deal 120 damage
      if (target.type === 'hero') {
        const hero = gs.players[target.owner].heroes[target.heroIdx];
        if (hero && hero.hp > 0) {
          await ctx.dealDamage(hero, 120, 'destruction_spell');

          // Freeze the hero if still alive
          if (hero.hp > 0) {
            await engine.addHeroStatus(target.owner, target.heroIdx, 'frozen', {
              appliedBy: pi,
              animationType: 'freeze',
            });
          }
        }
      } else if (target.type === 'equip') {
        const inst = target.cardInstance || engine.cardInstances.find(c =>
          c.owner === target.owner && c.zone === 'support' &&
          c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx
        );
        if (inst) {
          await engine.actionDealCreatureDamage(
            { name: 'Icebolt', owner: pi, heroIdx },
            inst, 120, 'destruction_spell',
            { sourceOwner: pi, canBeNegated: true },
          );

          // Freeze the creature if still on the board and not immune
          const stillAlive = engine.cardInstances.find(c => c.id === inst.id && c.zone === 'support');
          if (stillAlive && !stillAlive.counters.frozen && engine.canApplyCreatureStatus(stillAlive, 'frozen')) {
            stillAlive.counters.frozen = 1;
            engine.log('freeze', { target: inst.name, by: 'Icebolt', type: 'creature' });
          }
        }
      }

      engine.log('icebolt', { player: gs.players[pi].username, target: target.cardName, damage: 120 });
      engine.sync();
    },
  },
};
