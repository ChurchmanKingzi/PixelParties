// ═══════════════════════════════════════════
//  CARD EFFECT: "Cloud Pillow"
//  Artifact (Normal, 4 Gold) — Choose a living
//  target (Hero or Creature) you control. That
//  target gets "Cloudy" buff until the start of
//  your next turn (after Poison/Burn).
//
//  Cloudy: all damage taken is halved (rounded
//  up). Damage that cannot be reduced (Ida) is
//  NOT affected.
//
//  Uses the generic buff system:
//  - Heroes: hero.buffs.cloudy
//  - Creatures: inst.counters.buffs.cloudy
// ═══════════════════════════════════════════

module.exports = {
  isTargetingArtifact: true,

  canActivate(gs, pi) {
    const ps = gs.players[pi];
    // Need at least one living hero or creature
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (hero?.name && hero.hp > 0) return true;
    }
    return false;
  },

  getValidTargets(gs, pi) {
    const ps = gs.players[pi];
    const targets = [];
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      // Don't target already-cloudy heroes
      if (hero.buffs?.cloudy) continue;
      targets.push({
        id: `hero-${pi}-${hi}`, type: 'hero', owner: pi,
        heroIdx: hi, cardName: hero.name,
      });
      // Creatures in this hero's support zones
      for (let si = 0; si < (ps.supportZones[hi] || []).length; si++) {
        const slot = (ps.supportZones[hi] || [])[si] || [];
        if (slot.length === 0) continue;
        targets.push({
          id: `equip-${pi}-${hi}-${si}`, type: 'equip', owner: pi,
          heroIdx: hi, slotIdx: si, cardName: slot[0],
        });
      }
    }
    return targets;
  },

  targetingConfig: {
    description: 'Choose a target you control to give Cloudy (half damage).',
    confirmLabel: '☁️ Cloud Up!',
    confirmClass: 'btn-success',
    cancellable: true,
    greenSelect: true,
    exclusiveTypes: true,
    maxPerType: { hero: 1, equip: 1 },
  },

  validateSelection: (selectedIds) => selectedIds && selectedIds.length === 1,

  animationType: 'cloud_gather',

  resolve: async (engine, pi, selectedIds, validTargets) => {
    if (!selectedIds || selectedIds.length === 0) return false;

    const target = validTargets.find(t => t.id === selectedIds[0]);
    if (!target) return false;

    const gs = engine.gs;
    // Buff expires at the START of the caster's NEXT turn.
    // In a 2-player game, that's currentTurn + 2.
    const expiresTurn = gs.turn + 2;

    if (target.type === 'hero') {
      const hero = gs.players[pi].heroes[target.heroIdx];
      if (!hero?.name || hero.hp <= 0) return false;

      await engine.actionAddBuff(hero, pi, target.heroIdx, 'cloudy', {
        expiresAtTurn: expiresTurn,
        expiresForPlayer: pi,
        source: 'Cloud Pillow',
        addAnim: 'cloud_gather',
        removeAnim: 'cloud_disperse',
      });
    } else if (target.type === 'equip') {
      const inst = engine.cardInstances.find(c =>
        c.owner === pi && c.zone === 'support' &&
        c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx
      );
      if (!inst) return false;

      await engine.actionAddCreatureBuff(inst, 'cloudy', {
        expiresAtTurn: expiresTurn,
        expiresForPlayer: pi,
        source: 'Cloud Pillow',
        addAnim: 'cloud_gather',
        removeAnim: 'cloud_disperse',
      });
    }

    engine.log('cloud_pillow', { player: gs.players[pi].username, target: target.cardName });
    await engine._delay(800);
    return true;
  },
};
