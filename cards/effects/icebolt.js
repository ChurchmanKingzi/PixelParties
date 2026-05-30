// ═══════════════════════════════════════════
//  CARD EFFECT: "Icebolt"
//  Spell (Destruction Magic Lv2)
//  Choose a target and deal 120 damage to it.
//  If the target can be Frozen, Freeze it.
//  Uses an ice projectile animation with
//  ice_encase on impact.
// ═══════════════════════════════════════════

module.exports = {
  requiresTarget: true,
  // ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).
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
        baseDamage: 120,
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

      // Deal 120 damage. Capture cancellation so the Freeze rider
      // skips when the hit was fully negated by a reaction (Idej
      // Projection, Spectral Armor zero-cap, Anti Magic void) —
      // "negate that damage AND all associated effects" covers the
      // freeze. `ctx.dealDamage` is the engine's bound wrapper around
      // `actionDealDamage` and returns the same `{ dealt, cancelled }`
      // shape.
      if (target.type === 'hero') {
        const hero = gs.players[target.owner].heroes[target.heroIdx];
        if (hero && hero.hp > 0) {
          const r = await ctx.dealDamage(hero, 120, 'destruction_spell');
          if (r?.cancelled) {
            engine.log('icebolt_rider_skipped', { reason: 'damage_cancelled' });
          } else if (hero.hp > 0) {
            // Freeze the hero if still alive
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
          const r = await engine.actionDealCreatureDamage(
            { name: 'Icebolt', owner: pi, heroIdx },
            inst, 120, 'destruction_spell',
            { sourceOwner: pi, canBeNegated: true },
          );

          if (r?.cancelled) {
            engine.log('icebolt_rider_skipped', { reason: 'damage_cancelled' });
          } else {
            // Freeze the creature if still on the board. Routed through
            // applyCreatureStatus so ON_STATUS_APPLIED fires (Bear Rider /
            // Chilly Wizard / Colored Snow / future listeners).
            const stillAlive = engine.cardInstances.find(c => c.id === inst.id && c.zone === 'support');
            if (stillAlive) {
              const applied = await engine.applyCreatureStatus(stillAlive, 'frozen', {
                sourceOwner: pi,
                source: 'Icebolt',
              });
              if (applied) engine.log('freeze', { target: inst.name, by: 'Icebolt', type: 'creature' });
            }
          }
        }
      }

      engine.log('icebolt', { player: gs.players[pi].username, target: target.cardName, damage: 120 });
      engine.sync();
    },
  },
};
