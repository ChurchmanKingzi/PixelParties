// ═══════════════════════════════════════════
//  CARD EFFECT: "Juice"
//  Reaction Artifact — Choose any 1 target on
//  the board with negative statuses. Heal it
//  from any number of them. Orange bubbles.
//  Triggers only during opponent's phase changes.
//  Can also be activated proactively on own turn.
// ═══════════════════════════════════════════

const { STATUS_EFFECTS, getCleansableStatuses } = require('./_hooks');

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
    // Instance-aware: includes any per-instance-cleansable negation
    // (Unwanted Audience) on top of the globally-cleansable set.
    return engine.getCleansableCreatureStatusKeys(inst)
      .map(k => ({ key: k, label: STATUS_EFFECTS[k].label, icon: STATUS_EFFECTS[k].icon }));
  }
  return [];
}

function getValidTargets(gs, engine) {
  if (!engine) return [];
  const negKeys = getCleansableStatuses();
  const targets = [];
  for (let pi = 0; pi < 2; pi++) {
    const heroes = engine.getHeroTargets(pi).filter(t => {
      const hero = gs.players[pi].heroes[t.heroIdx];
      return hero.statuses && negKeys.some(k => hero.statuses[k]);
    });
    const creatures = engine.getCreatureTargets(pi).filter(t => {
      const inst = t.cardInstance;
      return inst && engine.getCleansableCreatureStatusKeys(inst).length > 0;
    });
    targets.push(...heroes, ...creatures);
  }
  return targets;
}

module.exports = {
  cpuMeta: { statusHealChannel: true }, // Status-Heilungs-Lernkanal (siehe _deck-profile.js)
  isReaction: true,
  isTargetingArtifact: true,
  proactivePlay: true,

  // CPU sanity gate. Juice's server-side `canActivate` returns true if
  // EITHER side has a cleansable status — without this guard the CPU
  // would proactively play it on opp-side-only statuses (no-op or
  // accidental cleanse of opp's debuff). Skip the play unless an own-
  // side cleansable target exists.
  cpuShouldPlay(engine, pi) {
    const { getCleansableStatuses } = require('./_hooks');
    const ps = engine.gs.players[pi];
    const negKeys = getCleansableStatuses();
    for (const h of (ps?.heroes || [])) {
      if (!h?.name || h.hp <= 0) continue;
      if (h.statuses && negKeys.some(k => h.statuses[k])) return true;
    }
    for (const inst of engine.cardInstances) {
      if (inst.zone !== 'support') continue;
      if ((inst.controller ?? inst.owner) !== pi) continue;
      if (negKeys.some(k => inst.counters?.[k])) return true;
    }
    return false;
  },

  reactionCondition: (gs, pi, engine, chainCtx) => {
    // Only trigger as a reaction during the opponent's phase transitions
    if (gs.activePlayer === pi) return false;
    if (chainCtx?.eventDesc !== 'The phase has ended') return false;
    return getValidTargets(gs, engine).length > 0;
  },

  canActivate: (gs, pi) => {
    // Proactive check (no engine access) — optimistic, real check in getValidTargets
    for (let phi = 0; phi < 2; phi++) {
      const ps = gs.players[phi];
      for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
        const hero = ps.heroes[hi];
        if (!hero?.name || hero.hp <= 0) continue;
        if (hero.statuses && getCleansableStatuses().some(k => hero.statuses[k])) return true;
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

  // ── CPU-Zielwahl (1.8., Als Report) ──────────────────────────────
  // Der Kartentext erlaubt ausdrücklich JEDES Ziel auf dem Feld, also
  // liefert `getValidTargets` beide Seiten. Ohne eigene Antwort greift
  // die generische CPU-Regel "nimm das erste Ziel" — und die traf im
  // Mitschnitt Als Cool Rescuer Monia: die CPU heilte den GEGNERISCHEN
  // Helden von Burn.
  //
  // Die Karte hatte diese Falle für den PROAKTIVEN Fall schon erkannt
  // (`canActivate` verlangt ein eigenes cleansables Ziel, siehe Kommentar
  // oben), nur die Zielwahl selbst blieb ungeschützt.
  //
  // Regel: ausschließlich eigene Ziele; darunter zuerst Helden (die
  // sterben, Kreaturen kommen nach), und unter denen der mit den MEISTEN
  // negativen Effekten. Findet sich kein eigenes Ziel, gibt die Karte
  // keine Antwort und die Engine entscheidet wie bisher.
  cpuResponse(engine, kind, payload) {
    if (kind !== 'effectTarget') return undefined;
    const pi = engine._cpuPlayerIdx;
    if (!(pi >= 0)) return undefined;
    const vt = (payload?.validTargets || []).filter(t => t && t.owner === pi);
    if (vt.length === 0) return undefined;
    const anzahl = (t) => {
      try {
        if (t.type === 'hero') {
          const h = engine.gs.players[t.owner]?.heroes?.[t.heroIdx];
          return getCleansableStatuses().filter(k => h?.statuses?.[k]).length;
        }
        return engine.getCleansableCreatureStatusKeys(t.cardInstance).length;
      } catch { return 0; }
    };
    vt.sort((a, b) => (b.type === 'hero') - (a.type === 'hero') || anzahl(b) - anzahl(a));
    return [vt[0].id];
  },

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
