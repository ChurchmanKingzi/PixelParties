// ═══════════════════════════════════════════
//  CARD EFFECT: "Tea"
//  Artifact — Choose own target with negative
//  statuses, heal any number. Then choose a
//  second target and inflict removed statuses.
//  Special poison handling: stacks transfer.
// ═══════════════════════════════════════════

const { STATUS_EFFECTS, getCleansableStatuses } = require('./_hooks');

function getTargetStatuses(target, engine) {
  if (target.type === 'hero') {
    const hero = engine.gs.players[target.owner]?.heroes?.[target.heroIdx];
    if (!hero?.statuses) return [];
    // v1101: gemeinsamer Bauer — er liefert `stacks` und `statusData`
    // gleich mit und kennt zusaetzlich die Anhaengsel.
    return engine.cleansableHeroEntries(target.owner, target.heroIdx);
  }
  if (target.type === 'equip') {
    const inst = engine.cardInstances.find(c =>
      c.owner === target.owner && c.zone === 'support' &&
      c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx
    );
    if (!inst) return [];
    // Instance-aware: also includes per-instance-cleansable negation
    // (Unwanted Audience) on top of the global cleansable set.
    return engine.getCleansableCreatureStatusKeys(inst)
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
  const negKeys = getCleansableStatuses();

  const heroes = engine.getHeroTargets(pi).filter(t => {
    const hero = gs.players[pi].heroes[t.heroIdx];
    return hero.statuses && negKeys.some(k => hero.statuses[k]);
  });

  const creatures = engine.getCreatureTargets(pi).filter(t => {
    const inst = t.cardInstance;
    return inst && engine.getCleansableCreatureStatusKeys(inst).length > 0;
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
function getSecondTargets(gs, engine, firstTarget, removedStatuses, poisonStacks, anhaengselStatus = []) {
  // ★★ v1168 (Als allgemeine Regel 17.9.): Wird ein Status uebertragen,
  // den ein ANHAENGSEL zugefuegt hat (Decisive Defeat → `negated`), zieht
  // die Karte mit in die Support Zone des neuen Traegers. Wer dort keinen
  // freien Platz hat, kommt als neuer Traeger nicht in Frage.
  const brauchtPlatz = anhaengselStatus.length > 0;
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
      if (brauchtPlatz && !engine.hatFreienSupportPlatz(pi, t.heroIdx)) continue;   // v1168
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
  cpuMeta: { statusHealChannel: true }, // Status-Heilungs-Lernkanal (siehe _deck-profile.js)
  isTargetingArtifact: true,

  canActivate: (gs, pi, engine) => {
    // Schnellpfad: Helden-Status.
    const negKeys = getCleansableStatuses();
    const ps = gs.players[pi];
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      if (hero.statuses && negKeys.some(k => hero.statuses[k])) return true;
    }
    // BUGFIX: Der Kartentext erlaubt JEDES eigene Ziel ("Choose a
    // target you control") — Kreaturen-Status (der häufige Fall:
    // Freezes!) machten Tea spielbar, aber canActivate prüfte nur
    // Helden. Der CPU-Planner übergibt engine als 3. Argument; damit
    // deckt die getValidTargets-Prüfung (inkl. Kreaturen) den Rest ab.
    // Ergebnis vorher: Tea war für die CPU in JEDEM Test unsichtbar,
    // sobald nur Kreaturen verstatust waren.
    if (engine) {
      try { return getOwnStatusedTargets(gs, pi, engine).length > 0; }
      catch { return false; }
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
    let removedStatuses = statusResult.selectedStatuses || [];
    if (removedStatuses.length === 0) return; // Nothing selected — done (fizzle)

    // Get poison stacks if removing poison
    let poisonStacks = 0;
    if (removedStatuses.includes('poisoned')) {
      const ps = statuses.find(s => s.key === 'poisoned');
      poisonStacks = ps?.stacks || 1;
    }

    // Step 2: Remove statuses from first target. The cleanse helpers skip
    // unhealable statuses and poison while Stinky Stables is up — keep only
    // the ones that actually got removed. Statuses that couldn't be healed
    // stay on the first target AND don't transfer to a second target; from
    // Tea's perspective they were never selected at all.
    // ★★ v1168 (Als allgemeine Regel 17.9.): Anhaengsel-Status ziehen mit
    // um. Die Karten VOR dem Heilen merken und markieren — sonst wuerfe
    // ihr eigener Status-Hook sie schon beim Heilen in die Ablage.
    const anhaengsel = [];     // [{ key, inst }]
    if (firstTarget.type === 'hero') {
      for (const k of removedStatuses) {
        const inst = engine.anhaengselFuerStatus?.(firstTarget.owner, firstTarget.heroIdx, k);
        if (!inst) continue;
        inst.counters = inst.counters || {};
        inst.counters._anhaengselZiehtUm = true;
        anhaengsel.push({ key: k, inst });
      }
    }
    const anhaengselFreigeben = async (umgezogen) => {
      for (const { inst } of anhaengsel) {
        delete inst.counters._anhaengselZiehtUm;
        // Kein Umzug → die Regel fuer geheilte Anhaengsel-Status greift:
        // Ablage des urspruenglichen Besitzers, mit Flug.
        if (!umgezogen && inst.zone === 'support') {
          await engine.sendBoardCardToDiscard(inst, { source: { name: 'Tea' } });
        }
      }
    };

    let actuallyRemoved = [];
    if (firstTarget.type === 'hero') {
      const hero = engine.gs.players[firstTarget.owner]?.heroes?.[firstTarget.heroIdx];
      if (hero?.statuses) {
        actuallyRemoved = engine.cleanseHeroStatuses(hero, firstTarget.owner, firstTarget.heroIdx, removedStatuses, 'Tea') || [];
      }
    } else if (firstTarget.type === 'equip') {
      const inst = engine.cardInstances.find(c =>
        c.owner === firstTarget.owner && c.zone === 'support' &&
        c.heroIdx === firstTarget.heroIdx && c.zoneSlot === firstTarget.slotIdx
      );
      if (inst) {
        actuallyRemoved = engine.cleanseCreatureStatuses(inst, removedStatuses, 'Tea') || [];
      }
    }

    removedStatuses = actuallyRemoved;
    if (removedStatuses.length === 0) { await anhaengselFreigeben(false); return; }
    if (!removedStatuses.includes('poisoned')) poisonStacks = 0;

    // Play tea steam on first target (the cure already applied above)
    const zs1 = firstTarget.type === 'equip' ? firstTarget.slotIdx : -1;
    engine._broadcastEvent('play_zone_animation', { type: 'tea_steam', owner: firstTarget.owner, heroIdx: firstTarget.heroIdx, zoneSlot: zs1 });
    engine.sync();
    await engine._delay(500);

    // Only GLOBALLY-cleansable statuses are carried to the second
    // target. A per-instance-cleansable negation (Unwanted Audience —
    // globally `cleansable:false`) is CURED off the first target but
    // NOT transferred: re-applying it would create a permanent,
    // uncleansable creature negation via applyCreatureStatus.
    // ★★ v1169 (Al 17.9.): PASSIVE Status (`sourceBound` — eine Karte
    // haelt sie aufrecht: Bishop of Kings [B], Water Golem, Weakening
    // Crystal) lassen sich NICHT uebertragen. Tea heilt sie nur; ihre
    // Quelle legt sie zum naechsten Rundenbeginn ohnehin neu an.
    const passivGeheilt = (statuses || [])
      .filter(s0 => s0?.statusData?.sourceBound)
      .map(s0 => s0.key);
    const transferStatuses = removedStatuses.filter(
      k => STATUS_EFFECTS[k]?.cleansable !== false && !passivGeheilt.includes(k));
    if (!transferStatuses.includes('poisoned')) poisonStacks = 0;
    if (transferStatuses.length === 0) {
      engine.log('tea_cure_no_transfer', { removedStatuses });
      await anhaengselFreigeben(false);
      return; // Pure cure — nothing to pass on
    }

    // Step 3: Find eligible second targets
    const anhaengselKeys = anhaengsel.filter(a => transferStatuses.includes(a.key)).map(a => a.key);
    const secondTargets = getSecondTargets(engine.gs, engine, firstTarget, transferStatuses, poisonStacks, anhaengselKeys);
    if (secondTargets.length === 0) {
      engine.log('tea_no_second_target', { removedStatuses: transferStatuses });
      await anhaengselFreigeben(false);
      return; // No eligible targets — effect is done
    }

    // Step 4: Prompt for second target
    const picked = await engine.promptEffectTarget(pi, secondTargets, {
      maxTotal: 1,   // Einfachauswahl: ein Klick TAUSCHT das Ziel
      title: 'Tea — Inflict',
      description: 'Choose a target to inflict the removed status effects.',
      confirmLabel: '🍵 Serve!',
      confirmClass: 'btn-danger',
      cancellable: false,
      exclusiveTypes: true,
      maxPerType: { hero: 1, equip: 1 },
    });

    if (!picked || picked.length === 0) { await anhaengselFreigeben(false); return; }
    const secondTarget = secondTargets.find(t => t.id === picked[0]);
    if (!secondTarget) { await anhaengselFreigeben(false); return; }

    // Step 5: Apply statuses to second target (as many as possible)
    // Build lookup for captured status properties (duration, _baihuPetrify, etc.)
    const statusDataMap = {};
    for (const s of statuses) statusDataMap[s.key] = s.statusData || {};

    for (const key of transferStatuses) {
      if (secondTarget.type === 'hero') {
        if (key === 'poisoned') {
          await engine.addHeroStatus(secondTarget.owner, secondTarget.heroIdx, 'poisoned', { stacks: poisonStacks, appliedBy: pi });
        } else {
          // Preserve special properties (Baihu duration, _baihuPetrify, unhealable, etc.)
          const origData = statusDataMap[key] || {};
          const opts = {};
          if (origData.duration) opts.duration = origData.duration;
          if (origData._baihuPetrify) opts._baihuPetrify = true;
          if (origData.unhealable) opts.unhealable = true;
          opts.appliedBy = pi;
          await engine.addHeroStatus(secondTarget.owner, secondTarget.heroIdx, key, opts);
        }
      } else if (secondTarget.type === 'equip') {
        const inst = engine.cardInstances.find(c =>
          c.owner === secondTarget.owner && c.zone === 'support' &&
          c.heroIdx === secondTarget.heroIdx && c.zoneSlot === secondTarget.slotIdx
        );
        // Cardinal Beasts (and anything else with `_cardinalImmune`)
        // refuse every status, including the ones Tea is "redirecting"
        // here — canApplyCreatureStatus is the single point of truth.
        if (inst) {
          await engine.applyCreatureStatus(inst, key, {
            stacks: key === 'poisoned' ? poisonStacks : undefined,
            sourceOwner: pi,
            source: 'Tea',
          });
        }
      }
    }

    // ★★ v1168: Die Anhaengsel ziehen zum neuen Traeger um (nur Helden
    // koennen sie tragen). Klappt ein Umzug nicht, gilt wieder die
    // Heil-Regel: Ablage des urspruenglichen Besitzers.
    for (const { key, inst } of anhaengsel) {
      delete inst.counters._anhaengselZiehtUm;
      const umziehen = transferStatuses.includes(key)
        && secondTarget.type === 'hero'
        && inst.zone === 'support';
      const ok = umziehen
        ? await engine.anhaengselUmziehen(inst, secondTarget.owner, secondTarget.heroIdx)
        : false;
      if (!ok && inst.zone === 'support') {
        await engine.sendBoardCardToDiscard(inst, { source: { name: 'Tea' } });
      } else if (ok) {
        // Der Status am neuen Traeger gehoert jetzt dieser Karte.
        const neuHero = engine.gs.players[secondTarget.owner]?.heroes?.[secondTarget.heroIdx];
        if (neuHero?.statuses?.[key]) neuHero.statuses[key]._fromAttachment = inst.name;
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
