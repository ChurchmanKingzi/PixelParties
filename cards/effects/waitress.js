// ═══════════════════════════════════════════
//  CARD EFFECT: "Waitress"
//  Creature (Summoning Magic Lv 0, 20 HP)
//
//  Two effects:
//
//  1. ALTERNATIVE SUMMON — at play time, IF an
//     own Hero has at least one cleansable
//     negative status, the card opts into the
//     "inherent additional Action" path. On that
//     path, `beforeSummon` prompts the player for
//     the own Hero to cleanse, removes ALL of
//     that Hero's cleansable statuses, plays the
//     Beer-bubble animation on the target, and
//     summons Waitress as a free Action. With no
//     statused own Hero, the card falls back to
//     the standard summon path (Lv 0 Summoning
//     Magic, costs the main action, no cleanse).
//
//  2. HOPT FREE CLEANSE — once per turn, choose
//     ANY own target (Hero OR Creature) with at
//     least one cleansable negative status, then
//     pick which statuses to remove. Mirrors
//     Beer's UX (`statusSelect` prompt + per-key
//     iteration), but free of charge and limited
//     to one target.
//
//  Wiring notes:
//    • Cleansable-status filter mirrors Beer:
//      `getCleansableStatuses` excludes the
//      permanent-silence statuses (negated /
//      nulled) that Beer / Tea / Cure also can't
//      remove. So a Negated Hero is NOT a valid
//      summon candidate for the alt path, and
//      isn't offered in the HOPT picker either.
//    • Summon-path cleanse is automatic (all
//      cleansable statuses go); HOPT cleanse is
//      a player choice via `statusSelect`.
//    • Both flows broadcast `beer_bubbles` on
//      each cleansed target's zone — same audio
//      cue and visual as Beer.
// ═══════════════════════════════════════════

const { STATUS_EFFECTS, getCleansableStatuses } = require('./_hooks');

const CARD_NAME = 'Waitress';
const ANIM_HOLD_MS = 550;

// ─── HELPERS ─────────────────────────────

function getTargetCleansableStatuses(target, engine) {
  if (target.type === 'hero') {
    const hero = engine.gs.players[target.owner]?.heroes?.[target.heroIdx];
    if (!hero?.statuses) return [];
    return getCleansableStatuses()
      .filter(k => hero.statuses[k])
      .map(k => ({ key: k, label: STATUS_EFFECTS[k].label, icon: STATUS_EFFECTS[k].icon }));
  }
  if (target.type === 'equip') {
    const inst = target.cardInstance;
    if (!inst?.counters) return [];
    return getCleansableStatuses()
      .filter(k => inst.counters[k])
      .map(k => ({ key: k, label: STATUS_EFFECTS[k].label, icon: STATUS_EFFECTS[k].icon }));
  }
  return [];
}

function buildOwnStatusedHeroes(engine, pi) {
  const ps = engine.gs.players[pi];
  if (!ps) return [];
  const negKeys = getCleansableStatuses();
  const out = [];
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const h = ps.heroes[hi];
    if (!h?.name || h.hp <= 0) continue;
    if (!h.statuses) continue;
    if (!negKeys.some(k => h.statuses[k])) continue;
    out.push({
      id: `hero-${pi}-${hi}`, type: 'hero',
      owner: pi, heroIdx: hi, cardName: h.name,
    });
  }
  return out;
}

function buildOwnStatusedTargets(engine, pi) {
  const targets = buildOwnStatusedHeroes(engine, pi);
  const negKeys = getCleansableStatuses();
  for (const inst of engine.cardInstances) {
    if (inst.owner !== pi || inst.zone !== 'support' || inst.faceDown) continue;
    if (!negKeys.some(k => inst.counters?.[k])) continue;
    targets.push({
      id: `equip-${pi}-${inst.heroIdx}-${inst.zoneSlot}`,
      type: 'equip',
      owner: pi, heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot,
      cardName: inst.name, cardInstance: inst,
    });
  }
  return targets;
}

async function cleanseTargetWithBeerBubbles(engine, target, statusKeys, sourceName) {
  const slot = target.type === 'hero' ? -1 : target.slotIdx;
  engine._broadcastEvent('play_zone_animation', {
    type: 'beer_bubbles',
    owner: target.owner, heroIdx: target.heroIdx, zoneSlot: slot,
  });
  await engine._delay(ANIM_HOLD_MS);

  if (target.type === 'hero') {
    const hero = engine.gs.players[target.owner]?.heroes?.[target.heroIdx];
    if (hero) {
      engine.cleanseHeroStatuses(hero, target.owner, target.heroIdx, statusKeys, sourceName);
    }
  } else if (target.cardInstance) {
    engine.cleanseCreatureStatuses(target.cardInstance, statusKeys, sourceName);
  }
}

// ─── CARD MODULE ─────────────────────────

module.exports = {
  activeIn: ['support'],

  // Inherent additional Action whenever an own Hero has at least
  // one cleansable status — the engine stamps `ctx.isInherentAction`
  // and `beforeSummon` charges the cleanse cost.
  inherentAction(gs, pi, heroIdx, engine) {
    return buildOwnStatusedHeroes(engine, pi).length > 0;
  },

  // Custom host pick — engine flag the client reads from
  // `gameState.customHostPickCards`. When set, a click play of this
  // card skips the generic spellHeroPick panel and `beforeSummon`
  // runs the richer zonePick host picker (with eligible heroes'
  // free Support Zones AND the heroes themselves clickable, like
  // the normal summoning UX). Drag-drop bypasses the picker
  // entirely — see `viaDragDrop` below.
  usesCustomHostPick: true,

  /**
   * Pre-placement cost. Only fires on the inherent path — a normal
   * Lv 0 main-action summon proceeds without cleansing anything.
   * Returning false aborts the summon (card returns to hand, action
   * slot stays unspent).
   *
   * Two independent picks happen here:
   *
   *   1. HOST zone — which Support Zone of which own Hero summons
   *      Waitress. Three sub-paths:
   *        • Drag-drop — `ctx.viaDragDrop` is true, the engine's
   *          drop hero/slot is taken as-is. No prompt.
   *        • Single eligible zone — auto-pick.
   *        • Multiple eligible zones — `zonePick` prompt, with each
   *          eligible Hero AND each free Support Zone clickable on
   *          the board (matches the normal-summoning UX).
   *
   *   2. CLEANSE target — which own Hero gets cleansed. Independent
   *      from the host: you can summon onto Hero B while cleansing
   *      Hero A.
   *
   * If the chosen host/slot differs from the engine's pre-pinned
   * drop slot, we manually place Waitress via `actionPlaceCreature`
   * and stamp `ps._placementConsumedByCard` so the server's default
   * placement is skipped — same path Steam Dwarf Dragon Pilot uses
   * for its all-full-slot summon.
   */
  async beforeSummon(ctx) {
    if (!ctx.isInherentAction) return true;
    const engine = ctx._engine;
    const pi     = ctx.cardOwner;
    const ps     = engine.gs.players[pi];
    if (!ps) return false;

    // ── Step 1: pick the HOST Hero + slot ───────────────────────
    // Eligible hosts: alive own Heroes that aren't Frozen / Stunned
    // / Bound, who MEET Waitress's school/level requirements (so
    // Heroes locked out of Summoning Magic don't appear), and who
    // have at least one free Support Zone slot. The level check
    // mirrors the normal-summon gate (`heroMeetsLevelReq` — same
    // helper `getHeroPlayableCards` uses to decide which Heroes
    // light up under a Creature drag).
    const cardDB = engine._getCardDB();
    const cd     = cardDB[CARD_NAME];
    const hostZones = [];
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const h = ps.heroes[hi];
      if (!h?.name || h.hp <= 0) continue;
      if (h.statuses?.frozen || h.statuses?.stunned || h.statuses?.bound) continue;
      if (cd && !engine.heroMeetsLevelReq(pi, hi, cd)) continue;
      const sup = ps.supportZones?.[hi] || [[], [], []];
      for (let z = 0; z < 3; z++) {
        if ((sup[z] || []).length === 0) {
          hostZones.push({
            heroIdx: hi, slotIdx: z,
            label: `${h.name} — Support ${z + 1}`,
          });
        }
      }
    }
    if (hostZones.length === 0) return false; // no valid host

    let hostHeroIdx, hostFreeSlot;
    if (ctx.viaDragDrop) {
      // Drag-drop pinned the host: use the dropped hero/slot.
      // ps._requestedNormalSummonSlot is set by doPlayCreature for
      // every normal-summon emit (including drag-drop). Validate the
      // drop is still actually free as a defensive guard against the
      // rare race where another effect filled it during animation.
      hostHeroIdx  = ctx.cardHeroIdx;
      hostFreeSlot = ps._requestedNormalSummonSlot?.slotIdx;
      const stillFree = hostFreeSlot != null
        && hostZones.some(z => z.heroIdx === hostHeroIdx && z.slotIdx === hostFreeSlot);
      if (!stillFree) {
        const fallback = hostZones.find(z => z.heroIdx === hostHeroIdx);
        if (!fallback) return false;
        hostFreeSlot = fallback.slotIdx;
      }
    } else if (hostZones.length === 1) {
      hostHeroIdx  = hostZones[0].heroIdx;
      hostFreeSlot = hostZones[0].slotIdx;
    } else {
      const picked = await engine.promptGeneric(pi, {
        type: 'zonePick',
        zones: hostZones,
        title: CARD_NAME,
        description: 'Choose which Support Zone summons Waitress (independent of the cleanse target).',
        previewCardName: CARD_NAME,
        cancellable: true,
      });
      if (!picked || picked.cancelled) return false;
      const chosen = hostZones.find(z => z.heroIdx === picked.heroIdx && z.slotIdx === picked.slotIdx);
      if (!chosen) return false;
      hostHeroIdx  = chosen.heroIdx;
      hostFreeSlot = chosen.slotIdx;
    }

    // ── Step 2: pick the CLEANSE target ─────────────────────────
    const cleanseCandidates = buildOwnStatusedHeroes(engine, pi);
    if (cleanseCandidates.length === 0) return false; // race — statuses cleared

    const pickedCleanse = await engine.promptEffectTarget(pi, cleanseCandidates, {
      title: CARD_NAME,
      description: 'Heal one of your Heroes from ALL of their status effects.',
      confirmLabel: '🍺 Cleanse!',
      confirmClass: 'btn-success',
      cancellable: true,
      greenSelect: true,
      exclusiveTypes: true,
      maxPerType: { hero: 1 },
    });
    if (!pickedCleanse || pickedCleanse.length === 0) return false;
    const cleanseTarget = cleanseCandidates.find(t => t.id === pickedCleanse[0]);
    if (!cleanseTarget) return false;

    // ── Step 3: cleanse + animate ───────────────────────────────
    const allKeys = getCleansableStatuses();
    await cleanseTargetWithBeerBubbles(engine, cleanseTarget, allKeys, CARD_NAME);

    // ── Step 4: redirect placement if host/slot differs from drop ──
    // The engine's default placement uses ctx.cardHeroIdx +
    // ps._requestedNormalSummonSlot.slotIdx (the click-flow's first-
    // free-slot pick OR the drag-drop slot). If the player picked a
    // different host or slot via zonePick, we manually place Waitress
    // and stamp `_placementConsumedByCard` so doPlayCreature skips
    // its summonCreature call.
    const drop = ps._requestedNormalSummonSlot;
    const sameAsDrop = drop
      && hostHeroIdx === ctx.cardHeroIdx
      && hostFreeSlot === drop.slotIdx;
    if (!sameAsDrop) {
      await engine.actionPlaceCreature(CARD_NAME, pi, hostHeroIdx, hostFreeSlot, {
        source: 'external', sourceName: CARD_NAME, fireHooks: true,
      });
      ps._placementConsumedByCard = CARD_NAME;
    }

    engine.log('waitress_summon_cleanse', {
      player: ps.username,
      host: ps.heroes?.[hostHeroIdx]?.name,
      cleansed: cleanseTarget.cardName,
    });
    engine.sync();
    return true;
  },

  // ── HOPT: free single-target cleanse, player picks statuses ──
  creatureEffect: true,

  canActivateCreatureEffect(ctx) {
    return buildOwnStatusedTargets(ctx._engine, ctx.cardOwner).length > 0;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi     = ctx.cardOwner;

    const targets = buildOwnStatusedTargets(engine, pi);
    if (targets.length === 0) return false;

    // ── Step 1: pick the target ──
    const picked = await engine.promptEffectTarget(pi, targets, {
      title: CARD_NAME,
      description: 'Choose a target you control to cleanse.',
      confirmLabel: '🍺 Serve!',
      confirmClass: 'btn-success',
      cancellable: true,
      greenSelect: true,
      exclusiveTypes: false,
      maxPerType: { hero: 1, equip: 1 },
    });
    if (!picked || picked.length === 0) return false;

    const target = targets.find(t => t.id === picked[0]);
    if (!target) return false;

    // ── Step 2: pick which statuses to remove (Beer's pattern) ──
    const statusOptions = getTargetCleansableStatuses(target, engine);
    if (statusOptions.length === 0) return false; // race — statuses cleared mid-flow

    const result = await engine.promptGeneric(pi, {
      type: 'statusSelect',
      targetName: target.cardName,
      statuses: statusOptions,
      title: CARD_NAME,
      description: `Choose status effects to remove from ${target.cardName}.`,
      confirmLabel: '🍺 Cheers!',
      cancellable: true,
    });
    if (!result || !Array.isArray(result.selectedStatuses) || result.selectedStatuses.length === 0) {
      return false; // player picked target then cancelled / chose 0 — no HOPT consumed
    }

    await cleanseTargetWithBeerBubbles(engine, target, result.selectedStatuses, CARD_NAME);

    engine.log('waitress_hopt_cleanse', {
      player: engine.gs.players[pi]?.username,
      target: target.cardName,
      removed: result.selectedStatuses,
    });
    engine.sync();
    return true;
  },
};
