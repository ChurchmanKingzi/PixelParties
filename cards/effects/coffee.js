// ═══════════════════════════════════════════
//  CARD EFFECT: "Coffee"
//  Artifact — Target own Hero with non-this-turn
//  negative statuses. Remove selected ones.
//  If 1+ removed, may perform an immediate
//  additional Action with that Hero.
// ═══════════════════════════════════════════

const { STATUS_EFFECTS, getCleansableStatuses } = require('./_hooks');

/** Get non-this-turn negative statuses on a hero */
function getEligibleStatuses(hero, currentTurn, engine, owner, heroIdx) {
  if (!hero?.statuses) return [];
  // ★ v1101: gemeinsamer Bauer, wenn die Herkunft bekannt ist — er
  // liefert `appliedTurn` fuer Status UND Anhaengsel („Decisive
  // Defeat", „Curse of Aging"), sodass Coffees Runden-Filter auch auf
  // sie passt. Ohne Engine-Angabe bleibt der alte Weg.
  if (engine && typeof owner === 'number' && typeof heroIdx === 'number') {
    return engine.cleansableHeroEntries(owner, heroIdx)
      .filter(e => e.appliedTurn !== undefined && e.appliedTurn < currentTurn);
  }
  const negKeys = getCleansableStatuses();
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
  cpuMeta: { statusHealChannel: true }, // Status-Heilungs-Lernkanal (siehe _deck-profile.js)
  isTargetingArtifact: true,

  // W16e (F01-11): „a Hero you control" = Kontrolle (`heroesControlledBy`: eigene Spalte ohne abgegebene + uebernommene), IDs/`owner` = Brettseite.
  canActivate(gs, pi, engine) {
    const negKeys = getCleansableStatuses();
    const currentTurn = gs.turn || 0;
    const helden = engine?.heroesControlledBy
      ? engine.heroesControlledBy(pi).map(e => e.hero)
      : (gs.players[pi].heroes || []);
    for (const hero of helden) {
      if (!hero?.name || hero.hp <= 0) continue;
      if (!hero.statuses) continue;
      const hasOld = negKeys.some(k => hero.statuses[k] && hero.statuses[k].appliedTurn < currentTurn);
      if (hasOld) return true;
    }
    return false;
  },

  getValidTargets(gs, pi, engine) {
    const targets = [];
    const currentTurn = gs.turn || 0;
    const helden = engine?.heroesControlledBy
      ? engine.heroesControlledBy(pi)
      : (gs.players[pi].heroes || []).map((hero, heroIdx) => ({ physOwner: pi, heroIdx, hero }));
    for (const { physOwner, heroIdx: hi, hero } of helden) {
      if (!hero?.name || hero.hp <= 0) continue;
      const statuses = getEligibleStatuses(hero, currentTurn, engine, physOwner, hi);
      if (statuses.length === 0) continue;
      targets.push({
        id: `hero-${physOwner}-${hi}`,
        type: 'hero',
        owner: physOwner,
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

    const seite = target.owner ?? pi;   // Brettseite des (ggf. uebernommenen) Helden
    const hero = engine.gs.players[seite]?.heroes?.[target.heroIdx];
    if (!hero?.name) return;
    const currentTurn = engine.gs.turn || 0;

    // Step 1: Status selection (only non-this-turn statuses)
    const statuses = getEligibleStatuses(hero, currentTurn, engine, seite, target.heroIdx);
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
    engine.cleanseHeroStatuses(hero, seite, target.heroIdx, removedStatuses, 'Coffee');

    // Play coffee animation on hero
    engine._broadcastEvent('play_zone_animation', { type: 'coffee_steam', owner: seite, heroIdx: target.heroIdx, zoneSlot: -1 });
    engine.sync();
    await engine._delay(600);

    // Step 3: Immediate action with this hero (modular engine method)
    await engine.performImmediateAction(pi, target.heroIdx, {
      title: 'Coffee',
      description: `Use an additional Action with ${hero.name}!`,
      ...(seite !== pi ? { heroOwner: seite } : {}),
    });
  },
};
