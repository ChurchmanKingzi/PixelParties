// ═══════════════════════════════════════════
//  CARD EFFECT: "Juice"
//  Reaction Artifact — Choose any 1 target on
//  the board with negative statuses. Heal it
//  from any number of them. Orange bubbles.
//  Can be activated in response to ANY event.
// ═══════════════════════════════════════════

const { STATUS_EFFECTS, getNegativeStatuses } = require('./_hooks');

function getTargetStatuses(target, engine) {
  if (target.type === 'hero') {
    const hero = engine.gs.players[target.owner]?.heroes?.[target.heroIdx];
    if (!hero?.statuses) return [];
    return getNegativeStatuses()
      .filter(k => hero.statuses[k])
      .map(k => ({ key: k, label: STATUS_EFFECTS[k].label, icon: STATUS_EFFECTS[k].icon }));
  }
  if (target.type === 'equip') {
    const inst = engine.cardInstances.find(c =>
      c.owner === target.owner && c.zone === 'support' &&
      c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx
    );
    if (!inst) return [];
    return getNegativeStatuses()
      .filter(k => inst.counters[k])
      .map(k => ({ key: k, label: STATUS_EFFECTS[k].label, icon: STATUS_EFFECTS[k].icon }));
  }
  return [];
}

function getValidTargets(gs, engine) {
  if (!engine) return [];
  const negKeys = getNegativeStatuses();
  const targets = [];
  for (let pi = 0; pi < 2; pi++) {
    const heroes = engine.getHeroTargets(pi).filter(t => {
      const hero = gs.players[pi].heroes[t.heroIdx];
      return hero.statuses && negKeys.some(k => hero.statuses[k]);
    });
    const creatures = engine.getCreatureTargets(pi).filter(t => {
      const inst = t.cardInstance;
      return inst && negKeys.some(k => inst.counters[k]);
    });
    targets.push(...heroes, ...creatures);
  }
  return targets;
}

module.exports = {
  isReaction: true,
  isTargetingArtifact: true,

  reactionCondition: (gs, pi, engine) => {
    return getValidTargets(gs, engine).length > 0;
  },

  canActivate: (gs, pi) => {
    // Proactive check (no engine access) — optimistic, real check in getValidTargets
    for (let phi = 0; phi < 2; phi++) {
      const ps = gs.players[phi];
      for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
        const hero = ps.heroes[hi];
        if (!hero?.name || hero.hp <= 0) continue;
        if (hero.statuses && getNegativeStatuses().some(k => hero.statuses[k])) return true;
      }
    }
    return false;
  },

  getValidTargets: (gs, pi, engine) => {
    return getValidTargets(gs, engine);
  },

  targetingConfig: {
    description: 'Select a target to cleanse.',
    confirmLabel: '🧃 Squeeze!',
    confirmClass: 'btn-success',
    cancellable: true,
    greenSelect: true,
    exclusiveTypes: true,
    maxPerType: { hero: 1, equip: 1 },
  },

  validateSelection: (selectedIds) => selectedIds && selectedIds.length === 1,

  animationType: 'juice_bubbles',

  resolve: async (engine, pi, selectedIds, validTargets) => {
    // Determine flow: proactive (selectedIds provided) vs reaction (no selectedIds)
    let target;

    if (selectedIds && validTargets) {
      // Proactive flow — target already selected via targeting UI
      target = validTargets.find(t => t.id === selectedIds[0]);
    } else {
      // Reaction flow — need to show targeting
      const targets = getValidTargets(engine.gs, engine);
      if (targets.length === 0) {
        engine.log('reaction_fizzle', { card: 'Juice', reason: 'no valid targets' });
        return false;
      }

      const picked = await engine.promptEffectTarget(pi, targets, {
        title: 'Juice',
        description: 'Select a target to cleanse.',
        confirmLabel: '🧃 Squeeze!',
        confirmClass: 'btn-success',
        cancellable: false,
        exclusiveTypes: true,
        maxPerType: { hero: 1, equip: 1 },
      });

      if (!picked || picked.length === 0) return false;
      target = targets.find(t => t.id === picked[0]);
    }

    if (!target) return false;

    // Status selection for the target
    const statuses = getTargetStatuses(target, engine);
    if (statuses.length === 0) return false;

    const result = await engine.promptGeneric(pi, {
      type: 'statusSelect',
      targetName: target.cardName,
      statuses,
      title: `Juice — ${target.cardName}`,
      description: `Choose status effects to remove from ${target.cardName}.`,
      confirmLabel: '🧃 Cheers!',
      cancellable: false,
    });

    if (!result) return false;
    const selectedStatuses = result.selectedStatuses || [];
    if (selectedStatuses.length === 0) return true;

    // Execute — remove statuses + play orange bubbles
    if (target.type === 'hero') {
      const hero = engine.gs.players[target.owner]?.heroes?.[target.heroIdx];
      if (hero?.statuses) {
        engine.cleanseHeroStatuses(hero, target.owner, target.heroIdx, selectedStatuses, 'Juice');
      }
      engine._broadcastEvent('play_zone_animation', { type: 'juice_bubbles', owner: target.owner, heroIdx: target.heroIdx, zoneSlot: -1 });
    } else if (target.type === 'equip') {
      const inst = engine.cardInstances.find(c =>
        c.owner === target.owner && c.zone === 'support' &&
        c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx
      );
      if (inst) {
        engine.cleanseCreatureStatuses(inst, selectedStatuses, 'Juice');
      }
      engine._broadcastEvent('play_zone_animation', { type: 'juice_bubbles', owner: target.owner, heroIdx: target.heroIdx, zoneSlot: target.slotIdx });
    }

    engine.sync();
    await engine._delay(800);
    return true;
  },
};
