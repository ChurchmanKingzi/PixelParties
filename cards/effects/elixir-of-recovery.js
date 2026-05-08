// ═══════════════════════════════════════════
//  CARD EFFECT: "Elixir of Recovery"
//  Potion — Remove any number of status effects
//  from any number of targets you control. Then,
//  draw a card for each effect removed from each
//  Hero (max 5).
//
//  Status scope mirrors Juice / Beer
//  (`getCleansableStatuses` from _hooks.js): all
//  negative statuses except `negated` and `nulled`
//  (those are intentionally non-cleansable per the
//  registry's `cleansable: false` flag).
//
//  Draw count rule: only Hero status removals
//  contribute. Removing two effects from one Hero
//  and one from another is 3 draws; removing
//  three statuses from a Creature is 0 draws.
//  Hard-capped at 5 across the whole resolution.
// ═══════════════════════════════════════════

const { STATUS_EFFECTS, getCleansableStatuses } = require('./_hooks');

const MAX_DRAWS = 5;

function getTargetStatuses(target, engine) {
  if (target.type === 'hero') {
    const hero = engine.gs.players[target.owner]?.heroes?.[target.heroIdx];
    if (!hero?.statuses) return [];
    return getCleansableStatuses()
      .filter(k => hero.statuses[k])
      .map(k => ({ key: k, label: STATUS_EFFECTS[k].label, icon: STATUS_EFFECTS[k].icon }));
  }
  if (target.type === 'equip') {
    const inst = engine.cardInstances.find(c =>
      c.owner === target.owner && c.zone === 'support' &&
      c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx
    );
    if (!inst) return [];
    return getCleansableStatuses()
      .filter(k => inst.counters[k])
      .map(k => ({ key: k, label: STATUS_EFFECTS[k].label, icon: STATUS_EFFECTS[k].icon }));
  }
  return [];
}

function getOwnTargetsWithStatuses(gs, pi, engine) {
  const negKeys = getCleansableStatuses();
  const targets = [];
  const ps = gs.players[pi];
  if (!ps) return targets;

  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name || hero.hp <= 0) continue;
    if (!hero.statuses) continue;
    if (!negKeys.some(k => hero.statuses[k])) continue;
    targets.push({
      id: `hero-${pi}-${hi}`,
      type: 'hero',
      owner: pi,
      heroIdx: hi,
      cardName: hero.name,
    });
  }

  for (const inst of engine.cardInstances) {
    if (inst.owner !== pi) continue;
    if (inst.zone !== 'support') continue;
    if (inst.faceDown) continue;
    if (!inst.counters) continue;
    if (!negKeys.some(k => inst.counters[k])) continue;
    targets.push({
      id: `equip-${pi}-${inst.heroIdx}-${inst.zoneSlot}`,
      type: 'equip',
      owner: pi,
      heroIdx: inst.heroIdx,
      slotIdx: inst.zoneSlot,
      cardName: inst.name,
      cardInstance: inst,
    });
  }

  return targets;
}

module.exports = {
  isPotion: true,

  canActivate(gs, pi, engine) {
    return getOwnTargetsWithStatuses(gs, pi, engine).length > 0;
  },

  getValidTargets(gs, pi, engine) {
    return getOwnTargetsWithStatuses(gs, pi, engine);
  },

  targetingConfig(gs, pi) {
    // maxTotal = number of own targets with cleansable statuses (so
    // "any number of targets" up to all eligible ones).
    return {
      title: 'Elixir of Recovery',
      description: 'Choose any of your targets. You will pick which status effects to remove from each.',
      confirmLabel: '💧 Cleanse',
      confirmClass: 'btn-success',
      cancellable: true,
      maxTotal: 6, // generous upper bound; UI just shows the count
      minRequired: 1,
    };
  },

  validateSelection(selectedIds) {
    return selectedIds && selectedIds.length >= 1;
  },

  animationType: 'recovery_drops',

  async resolve(engine, pi, selectedIds, validTargets) {
    if (!selectedIds || selectedIds.length === 0) return;
    const targets = selectedIds.map(id => validTargets.find(t => t.id === id)).filter(Boolean);
    if (targets.length === 0) return;

    let heroStatusesRemoved = 0;

    for (const target of targets) {
      const statuses = getTargetStatuses(target, engine);
      if (statuses.length === 0) continue;

      // Per-target status picker — same UI Juice uses.
      const result = await engine.promptGeneric(pi, {
        type: 'statusSelect',
        targetName: target.cardName,
        statuses,
        title: `Elixir of Recovery — ${target.cardName}`,
        description: `Choose status effects to remove from ${target.cardName}.`,
        confirmLabel: '💧 Cleanse',
        cancellable: false,
      });

      if (!result) continue;
      const selectedStatuses = result.selectedStatuses || [];
      if (selectedStatuses.length === 0) continue;

      if (target.type === 'hero') {
        const hero = engine.gs.players[target.owner]?.heroes?.[target.heroIdx];
        if (hero?.statuses) {
          engine.cleanseHeroStatuses(hero, target.owner, target.heroIdx, selectedStatuses, 'Elixir of Recovery');
          heroStatusesRemoved += selectedStatuses.length;
        }
        engine._broadcastEvent('play_zone_animation', {
          type: 'recovery_drops', owner: target.owner, heroIdx: target.heroIdx, zoneSlot: -1,
        });
      } else if (target.type === 'equip') {
        const inst = engine.cardInstances.find(c =>
          c.owner === target.owner && c.zone === 'support' &&
          c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx
        );
        if (inst) {
          engine.cleanseCreatureStatuses(inst, selectedStatuses, 'Elixir of Recovery');
        }
        engine._broadcastEvent('play_zone_animation', {
          type: 'recovery_drops', owner: target.owner, heroIdx: target.heroIdx, zoneSlot: target.slotIdx,
        });
      }

      engine.sync();
      await engine._delay(150);
    }

    const draws = Math.min(MAX_DRAWS, heroStatusesRemoved);
    if (draws > 0) {
      await engine.actionDrawCards(pi, draws);
    }

    engine.log('elixir_of_recovery', {
      player: engine.gs.players[pi]?.username,
      heroStatusesRemoved,
      draws,
    });
    engine.sync();
  },
};
