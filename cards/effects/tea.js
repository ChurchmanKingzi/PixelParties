// ═══════════════════════════════════════════
//  CARD EFFECT: "Tea"
//  Artifact — Choose own target with negative
//  statuses, heal any number. Then choose a
//  second target and inflict removed statuses.
//  Special poison handling: stacks transfer.
// ═══════════════════════════════════════════

const { STATUS_EFFECTS, getNegativeStatuses } = require('./_hooks');

function getTargetStatuses(target, engine) {
  if (target.type === 'hero') {
    const hero = engine.gs.players[target.owner]?.heroes?.[target.heroIdx];
    if (!hero?.statuses) return [];
    return getNegativeStatuses()
      .filter(k => hero.statuses[k])
      .map(k => {
        const s = { key: k, label: STATUS_EFFECTS[k].label, icon: STATUS_EFFECTS[k].icon };
        if (k === 'poisoned') s.stacks = hero.statuses.poisoned.stacks || 1;
        return s;
      });
  }
  if (target.type === 'equip') {
    const inst = engine.cardInstances.find(c =>
      c.owner === target.owner && c.zone === 'support' &&
      c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx
    );
    if (!inst) return [];
    return getNegativeStatuses()
      .filter(k => inst.counters[k])
      .map(k => {
        const s = { key: k, label: STATUS_EFFECTS[k].label, icon: STATUS_EFFECTS[k].icon };
        if (k === 'poisoned') s.stacks = inst.counters.poisonStacks || 1;
        return s;
      });
  }
  return [];
}

function getOwnStatusedTargets(gs, pi, engine) {
  if (!engine) return [];
  const negKeys = getNegativeStatuses();

  const heroes = engine.getHeroTargets(pi).filter(t => {
    const hero = gs.players[pi].heroes[t.heroIdx];
    return hero.statuses && negKeys.some(k => hero.statuses[k]);
  });

  const creatures = engine.getCreatureTargets(pi).filter(t => {
    const inst = t.cardInstance;
    return inst && negKeys.some(k => inst.counters[k]);
  });

  return [...heroes, ...creatures];
}

/** Check if a target is immune to ALL of the given statuses */
function isImmuneToAll(target, statusKeys, engine) {
  if (target.type === 'hero') {
    const hero = engine.gs.players[target.owner]?.heroes?.[target.heroIdx];
    if (!hero?.name || hero.hp <= 0) return true;
    const CC_STATUSES = ['frozen', 'stunned', 'negated'];
    return statusKeys.every(k => {
      if (hero.statuses?.shielded) return true;
      if (hero.statuses?.immune && CC_STATUSES.includes(k)) return true;
      // Per-status immunity (e.g. poison_immune blocks poisoned)
      const statusDef = STATUS_EFFECTS[k];
      if (statusDef?.immuneKey && hero.statuses?.[statusDef.immuneKey]) return true;
      // Already has this status (can't double-apply) — except poisoned with fewer stacks
      if (k === 'poisoned') return false; // Poison is always transferable (replaces stacks)
      if (hero.statuses?.[k]) return true;
      return false;
    });
  }
  if (target.type === 'equip') {
    const inst = engine.cardInstances.find(c =>
      c.owner === target.owner && c.zone === 'support' &&
      c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx
    );
    if (!inst) return true;
    return statusKeys.every(k => {
      const statusDef = STATUS_EFFECTS[k];
      if (statusDef?.immuneKey && inst.counters[statusDef.immuneKey]) return true;
      if (k === 'poisoned') return false;
      if (inst.counters[k]) return true;
      return false;
    });
  }
  return true;
}

/** Get all board targets eligible for receiving the removed statuses */
function getSecondTargets(gs, engine, firstTarget, removedStatuses, poisonStacks) {
  const targets = [];
  for (let pi = 0; pi < 2; pi++) {
    // Heroes
    for (const t of engine.getHeroTargets(pi)) {
      if (t.id === firstTarget.id) continue;
      const hero = gs.players[pi].heroes[t.heroIdx];
      if (removedStatuses.includes('poisoned') && hero.statuses?.poisoned) {
        const existingStacks = hero.statuses.poisoned.stacks || 1;
        if (existingStacks >= poisonStacks) {
          const otherStatuses = removedStatuses.filter(k => k !== 'poisoned');
          if (otherStatuses.length === 0 || isImmuneToAll(t, otherStatuses, engine)) continue;
        }
      } else if (isImmuneToAll(t, removedStatuses, engine)) continue;
      targets.push(t);
    }

    // Creatures
    for (const ct of engine.getCreatureTargets(pi)) {
      if (ct.id === firstTarget.id) continue;
      const inst = ct.cardInstance;
      if (!inst) continue;
      if (removedStatuses.includes('poisoned') && inst.counters.poisoned) {
        const existingStacks = inst.counters.poisonStacks || 1;
        if (existingStacks >= poisonStacks) {
          const otherStatuses = removedStatuses.filter(k => k !== 'poisoned');
          if (otherStatuses.length === 0 || isImmuneToAll(ct, otherStatuses, engine)) continue;
        }
      } else if (isImmuneToAll(ct, removedStatuses, engine)) continue;
      targets.push(ct);
    }
  }
  return targets;
}

module.exports = {
  isTargetingArtifact: true,

  canActivate: (gs, pi) => {
    const negKeys = getNegativeStatuses();
    const ps = gs.players[pi];
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      if (hero.statuses && negKeys.some(k => hero.statuses[k])) return true;
    }
    return false;
  },

  getValidTargets: (gs, pi, engine) => getOwnStatusedTargets(gs, pi, engine),

  targetingConfig: {
    description: 'Select your target to cleanse.',
    confirmLabel: '🍵 Brew!',
    confirmClass: 'btn-success',
    cancellable: true,
    greenSelect: true,
    exclusiveTypes: true,
    maxPerType: { hero: 1, equip: 1 },
  },

  validateSelection: (selectedIds) => selectedIds && selectedIds.length === 1,

  animationType: 'tea_steam',

  resolve: async (engine, pi, selectedIds, validTargets) => {
    if (!selectedIds || selectedIds.length === 0) return;
    const firstTarget = validTargets.find(t => t.id === selectedIds[0]);
    if (!firstTarget) return;

    // Step 1: Status selection for first target
    const statuses = getTargetStatuses(firstTarget, engine);
    if (statuses.length === 0) return;

    const statusResult = await engine.promptGeneric(pi, {
      type: 'statusSelect',
      targetName: firstTarget.cardName,
      statuses,
      title: `Tea — ${firstTarget.cardName}`,
      description: `Choose status effects to remove from ${firstTarget.cardName}.`,
      confirmLabel: 'Next →',
      cancellable: true,
    });

    if (!statusResult) return { aborted: true }; // Back to targeting
    const removedStatuses = statusResult.selectedStatuses || [];
    if (removedStatuses.length === 0) return; // Nothing selected — done (fizzle)

    // Get poison stacks if removing poison
    let poisonStacks = 0;
    if (removedStatuses.includes('poisoned')) {
      const ps = statuses.find(s => s.key === 'poisoned');
      poisonStacks = ps?.stacks || 1;
    }

    // Step 2: Remove statuses from first target
    if (firstTarget.type === 'hero') {
      const hero = engine.gs.players[firstTarget.owner]?.heroes?.[firstTarget.heroIdx];
      if (hero?.statuses) {
        engine.cleanseHeroStatuses(hero, firstTarget.owner, firstTarget.heroIdx, removedStatuses, 'Tea');
      }
    } else if (firstTarget.type === 'equip') {
      const inst = engine.cardInstances.find(c =>
        c.owner === firstTarget.owner && c.zone === 'support' &&
        c.heroIdx === firstTarget.heroIdx && c.zoneSlot === firstTarget.slotIdx
      );
      if (inst) {
        engine.cleanseCreatureStatuses(inst, removedStatuses, 'Tea');
      }
    }

    // Play tea steam on first target
    const zs1 = firstTarget.type === 'equip' ? firstTarget.slotIdx : -1;
    engine._broadcastEvent('play_zone_animation', { type: 'tea_steam', owner: firstTarget.owner, heroIdx: firstTarget.heroIdx, zoneSlot: zs1 });
    engine.sync();
    await engine._delay(500);

    // Step 3: Find eligible second targets
    const secondTargets = getSecondTargets(engine.gs, engine, firstTarget, removedStatuses, poisonStacks);
    if (secondTargets.length === 0) {
      engine.log('tea_no_second_target', { removedStatuses });
      return; // No eligible targets — effect is done
    }

    // Step 4: Prompt for second target
    const picked = await engine.promptEffectTarget(pi, secondTargets, {
      title: 'Tea — Inflict',
      description: 'Choose a target to inflict the removed status effects.',
      confirmLabel: '🍵 Serve!',
      confirmClass: 'btn-danger',
      cancellable: false,
      exclusiveTypes: true,
      maxPerType: { hero: 1, equip: 1 },
    });

    if (!picked || picked.length === 0) return;
    const secondTarget = secondTargets.find(t => t.id === picked[0]);
    if (!secondTarget) return;

    // Step 5: Apply statuses to second target (as many as possible)
    for (const key of removedStatuses) {
      if (secondTarget.type === 'hero') {
        if (key === 'poisoned') {
          await engine.addHeroStatus(secondTarget.owner, secondTarget.heroIdx, 'poisoned', { stacks: poisonStacks, appliedBy: pi });
        } else {
          await engine.addHeroStatus(secondTarget.owner, secondTarget.heroIdx, key, { appliedBy: pi });
        }
      } else if (secondTarget.type === 'equip') {
        const inst = engine.cardInstances.find(c =>
          c.owner === secondTarget.owner && c.zone === 'support' &&
          c.heroIdx === secondTarget.heroIdx && c.zoneSlot === secondTarget.slotIdx
        );
        if (inst) {
          if (key === 'poisoned') {
            inst.counters.poisoned = 1;
            inst.counters.poisonStacks = poisonStacks;
          } else {
            inst.counters[key] = 1;
          }
        }
      }
    }

    // Play tea steam on second target
    const zs2 = secondTarget.type === 'equip' ? secondTarget.slotIdx : -1;
    engine._broadcastEvent('play_zone_animation', { type: 'tea_steam', owner: secondTarget.owner, heroIdx: secondTarget.heroIdx, zoneSlot: zs2 });
    engine.log('tea_inflict', { target: secondTarget.cardName, statuses: removedStatuses });
    engine.sync();
    await engine._delay(800);
  },
};
