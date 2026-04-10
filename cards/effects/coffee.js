// ═══════════════════════════════════════════
//  CARD EFFECT: "Coffee"
//  Artifact — Target own Hero with non-this-turn
//  negative statuses. Remove selected ones.
//  If 1+ removed, may perform an immediate
//  additional Action with that Hero.
// ═══════════════════════════════════════════

const { STATUS_EFFECTS, getNegativeStatuses } = require('./_hooks');

/** Get non-this-turn negative statuses on a hero */
function getEligibleStatuses(hero, currentTurn) {
  if (!hero?.statuses) return [];
  const negKeys = getNegativeStatuses();
  return negKeys
    .filter(k => {
      if (!hero.statuses[k]) return false;
      const appliedTurn = hero.statuses[k].appliedTurn;
      return appliedTurn !== undefined && appliedTurn < currentTurn;
    })
    .map(k => {
      const s = { key: k, label: STATUS_EFFECTS[k].label, icon: STATUS_EFFECTS[k].icon };
      if (k === 'poisoned') s.stacks = hero.statuses.poisoned.stacks || 1;
      return s;
    });
}

module.exports = {
  isTargetingArtifact: true,

  canActivate(gs, pi) {
    const ps = gs.players[pi];
    const negKeys = getNegativeStatuses();
    const currentTurn = gs.turn || 0;
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      if (!hero.statuses) continue;
      const hasOld = negKeys.some(k => hero.statuses[k] && hero.statuses[k].appliedTurn < currentTurn);
      if (hasOld) return true;
    }
    return false;
  },

  getValidTargets(gs, pi, engine) {
    const ps = gs.players[pi];
    const targets = [];
    const currentTurn = gs.turn || 0;
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      const statuses = getEligibleStatuses(hero, currentTurn);
      if (statuses.length === 0) continue;
      targets.push({
        id: `hero-${pi}-${hi}`,
        type: 'hero',
        owner: pi,
        heroIdx: hi,
        cardName: hero.name,
      });
    }
    return targets;
  },

  targetingConfig: {
    description: 'Select a Hero to cleanse and energize.',
    confirmLabel: '☕ Brew!',
    confirmClass: 'btn-success',
    cancellable: true,
    greenSelect: true,
    exclusiveTypes: true,
    maxPerType: { hero: 1 },
  },

  validateSelection: (selectedIds) => selectedIds && selectedIds.length === 1,

  animationType: 'coffee_steam',

  resolve: async (engine, pi, selectedIds, validTargets) => {
    if (!selectedIds || selectedIds.length === 0) return;
    const target = validTargets.find(t => t.id === selectedIds[0]);
    if (!target || target.type !== 'hero') return;

    const ps = engine.gs.players[pi];
    const hero = ps.heroes[target.heroIdx];
    if (!hero?.name) return;
    const currentTurn = engine.gs.turn || 0;

    // Step 1: Status selection (only non-this-turn statuses)
    const statuses = getEligibleStatuses(hero, currentTurn);
    if (statuses.length === 0) return;

    const statusResult = await engine.promptGeneric(pi, {
      type: 'statusSelect',
      targetName: hero.name,
      statuses,
      title: `Coffee — ${hero.name}`,
      description: `Choose status effects to remove from ${hero.name}.`,
      confirmLabel: 'Next →',
      cancellable: true,
    });

    if (!statusResult) return { aborted: true };
    const removedStatuses = statusResult.selectedStatuses || [];
    if (removedStatuses.length === 0) return; // Nothing selected — fizzle

    // Step 2: Remove selected statuses
    engine.cleanseHeroStatuses(hero, pi, heroIdx, removedStatuses, 'Coffee');

    // Play coffee animation on hero
    engine._broadcastEvent('play_zone_animation', { type: 'coffee_steam', owner: pi, heroIdx: target.heroIdx, zoneSlot: -1 });
    engine.sync();
    await engine._delay(600);

    // Step 3: Immediate action with this hero (modular engine method)
    await engine.performImmediateAction(pi, target.heroIdx, {
      title: 'Coffee',
      description: `Use an additional Action with ${hero.name}!`,
    });
  },
};
