// ═══════════════════════════════════════════
//  CARD EFFECT: "Poison Vial"
//  Potion — Choose any target (not shielded
//  or poison-immune) and apply 2 Poison stacks.
//  Goes to deleted pile after use.
// ═══════════════════════════════════════════

const { STATUS_EFFECTS } = require('./_hooks');

module.exports = {
  isPotion: true,

  canActivate(gs, playerIdx) {
    return this.getValidTargets(gs, playerIdx).length > 0;
  },

  getValidTargets(gs, playerIdx) {
    const targets = [];
    for (let pi = 0; pi < 2; pi++) {
      const ps = gs.players[pi];
      for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
        const hero = ps.heroes[hi];
        if (!hero?.name || hero.hp <= 0) continue;
        if (hero.statuses?.shielded) continue;
        if (hero.statuses?.poison_immune) continue;
        targets.push({
          id: `hero-${pi}-${hi}`,
          type: 'hero',
          owner: pi,
          heroIdx: hi,
          cardName: hero.name,
        });
        // Creatures in support zones
        for (let si = 0; si < (ps.supportZones[hi] || []).length; si++) {
          const slot = (ps.supportZones[hi] || [])[si] || [];
          if (slot.length === 0) continue;
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
    return targets;
  },

  targetingConfig: {
    description: 'Select a target to Poison (2 stacks).',
    confirmLabel: '☠️ Poison!',
    confirmClass: 'btn-danger',
    cancellable: true,
    exclusiveTypes: true,
    maxPerType: { hero: 1, equip: 1 },
  },

  validateSelection(selectedIds, validTargets) {
    return selectedIds && selectedIds.length === 1;
  },

  animationType: 'poison_vial',

  async resolve(engine, pi, selectedIds, validTargets) {
    if (!selectedIds || selectedIds.length === 0) return;
    const target = validTargets.find(t => t.id === selectedIds[0]);
    if (!target) return;

    if (target.type === 'hero') {
      // Apply 2 stacks of poison
      await engine.addHeroStatus(target.owner, target.heroIdx, 'poisoned', { addStacks: 2, appliedBy: pi });
    } else if (target.type === 'equip') {
      const inst = engine.cardInstances.find(c =>
        c.owner === target.owner && c.zone === 'support' &&
        c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx
      );
      if (inst) {
        if (inst.counters.poison_immune) return; // Immune to poison
        if (inst.counters.poisoned) {
          inst.counters.poisonStacks = (inst.counters.poisonStacks || 1) + 2;
        } else {
          inst.counters.poisoned = 1;
          inst.counters.poisonStacks = 2;
        }
      }
    }

    // Animation is handled by the potion_resolved event
    engine.log('poison_applied', { target: target.cardName, stacks: 2, by: 'Poison Vial' });
    engine.sync();
  },
};
