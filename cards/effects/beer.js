// ═══════════════════════════════════════════
//  CARD EFFECT: "Beer"
//  Artifact — Choose any number of own targets
//  with negative statuses. Cost = 4 × targets.
//  For each target, choose which statuses to
//  remove. Beer bubbles animation on cleanse.
// ═══════════════════════════════════════════

const { STATUS_EFFECTS, getNegativeStatuses } = require('./_hooks');

function getTargetStatuses(target, engine) {
  // Hero statuses
  if (target.type === 'hero') {
    const hero = engine.gs.players[target.owner]?.heroes?.[target.heroIdx];
    if (!hero?.statuses) return [];
    return Object.keys(hero.statuses)
      .filter(k => STATUS_EFFECTS[k]?.negative)
      .map(k => ({ key: k, label: STATUS_EFFECTS[k].label, icon: STATUS_EFFECTS[k].icon }));
  }
  // Creature statuses (stored in counters)
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

module.exports = {
  isTargetingArtifact: true,

  canActivate: (gs, pi) => {
    // Can activate if any own hero or creature has a negative status
    const ps = gs.players[pi];
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      if (hero.statuses && getNegativeStatuses().some(k => hero.statuses[k])) return true;
      // Check creatures in support zones — need engine access, but canActivate doesn't have it
      // For now, just check heroes. The full check happens in getValidTargets.
    }
    // Also check creature counters via gameState creatureCounters — but we don't have engine here
    // Return true optimistically if any heroes are alive; the targeting will show 0 targets if none qualify
    return true;
  },

  getValidTargets: (gs, pi, engine) => {
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
  },

  targetingConfig: (gs, pi, cost) => ({
    description: 'Select targets to cleanse.',
    confirmLabel: '🍺 Drink!',
    confirmClass: 'btn-success',
    cancellable: true,
    alwaysConfirmable: true,
    greenSelect: true,
    dynamicCostPerTarget: cost,
    exclusiveTypes: false,
    maxPerType: { hero: 99, equip: 99 },
  }),

  validateSelection: () => true, // 0+ targets always valid

  // Resolve handles gold deduction manually
  manualGoldCost: true,
  animationType: 'beer_bubbles',

  resolve: async (engine, pi, selectedIds, validTargets) => {
    if (!selectedIds || selectedIds.length === 0) return; // 0 targets — nothing happens

    const baseCost = engine._getCardDB()['Beer']?.cost || 4;
    const totalCost = baseCost * selectedIds.length;
    const ps = engine.gs.players[pi];

    // Check gold
    if ((ps.gold || 0) < totalCost) return;

    // Map selected IDs to targets
    const targets = selectedIds.map(id => validTargets.find(t => t.id === id)).filter(Boolean);
    if (targets.length === 0) return;

    // Per-target status selection — sequential prompts
    const cleanseActions = []; // [{target, statuses: [key]}]

    for (let ti = 0; ti < targets.length; ti++) {
      const target = targets[ti];
      const statuses = getTargetStatuses(target, engine);
      if (statuses.length === 0) {
        cleanseActions.push({ target, statuses: [] });
        continue;
      }

      let result = null;
      while (true) {
        // Create a dummy card instance for the prompt context
        const dummyInst = { name: 'Beer', owner: pi, controller: pi, zone: 'hand', heroIdx: -1, zoneSlot: -1, counters: {} };
        result = await engine.promptGeneric(pi, {
          type: 'statusSelect',
          targetName: target.cardName,
          statuses,
          title: `Beer — ${target.cardName} (${ti + 1}/${targets.length})`,
          description: `Choose status effects to remove from ${target.cardName}.`,
          confirmLabel: ti === targets.length - 1 ? '🍺 Cheers!' : 'Next →',
          cancellable: true,
        });

        if (result === null) {
          // Cancelled — go back
          if (ti === 0) return { aborted: true }; // Back to targeting selection
          ti -= 2; // Will be incremented by for loop, so effectively goes back 1
          cleanseActions.pop(); // Remove last action
          break;
        } else {
          cleanseActions.push({ target, statuses: result.selectedStatuses || [] });
          break;
        }
      }
    }

    if (cleanseActions.length !== targets.length) return; // Aborted

    // Execute: deduct gold
    ps.gold -= totalCost;
    engine.log('beer_used', { player: ps.username, targets: targets.length, totalCost });

    // Remove selected statuses and play animations
    for (const { target, statuses } of cleanseActions) {
      if (statuses.length === 0) continue;

      if (target.type === 'hero') {
        const hero = ps.heroes[target.heroIdx];
        if (hero?.statuses) {
          for (const key of statuses) {
            if (hero.statuses[key]) {
              delete hero.statuses[key];
              engine.log('status_remove', { target: hero.name, status: key, by: 'Beer' });
            }
          }
        }
        // Play beer bubbles on the hero
        const ownerLabel = target.owner === 0 ? 'me' : 'opp';
        const sel = `[data-hero-zone][data-hero-owner="${ownerLabel}"][data-hero-idx="${target.heroIdx}"]`;
        engine._broadcastEvent('play_zone_animation', { type: 'beer_bubbles', owner: target.owner, heroIdx: target.heroIdx, zoneSlot: -1 });
      } else if (target.type === 'equip') {
        const inst = engine.cardInstances.find(c =>
          c.owner === target.owner && c.zone === 'support' &&
          c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx
        );
        if (inst) {
          for (const key of statuses) {
            if (inst.counters[key]) {
              delete inst.counters[key];
              engine.log('status_remove', { target: inst.name, status: key, by: 'Beer' });
            }
          }
        }
        engine._broadcastEvent('play_zone_animation', { type: 'beer_bubbles', owner: target.owner, heroIdx: target.heroIdx, zoneSlot: target.slotIdx });
      }
    }

    engine.sync();
    await engine._delay(800); // Let animations play
  },
};
