// ═══════════════════════════════════════════
//  CARD EFFECT: "Slippery Skates"
//  Artifact (Equipment) — Active equip effect.
//  Once per turn, move a Creature from the
//  equipped Hero's Support Zone to an adjacent
//  ally Hero's free Support Zone.
// ═══════════════════════════════════════════

const { loadCardEffect } = require('./_loader');

const CARD_NAME = 'Slippery Skates';
const SPELL_SCHOOLS_ALL = [
  'Destruction Magic', 'Decay Magic', 'Magic Arts', 'Support Magic', 'Summoning Magic',
];

// Effective Spell-School level for a hero (mirrors _cpu's logic). Counts
// real stacked abilities, then takes the max with any virtual floor the
// hero's own card script declares (e.g. Beato = 1, Ascended Beato = 9).
// Inlined here so the card stays self-contained and avoids importing
// from _cpu (which would create a circular dependency at load time).
function _effectiveSchoolLevel(engine, pi, hi, school) {
  const ps = engine.gs.players[pi];
  const hero = ps?.heroes?.[hi];
  if (!hero?.name) return 0;
  const abZones = ps.abilityZones?.[hi] || [];
  const real = engine.countAbilitiesForSchool(school, abZones);
  const heroScript = loadCardEffect(hero.name);
  const v = heroScript?.virtualSpellSchoolLevel;
  let floor = 0;
  if (typeof v === 'function') {
    try { const f = v(school, engine, pi, hi); if (f != null) floor = f; } catch {}
  } else if (typeof v === 'number') {
    floor = v;
  }
  return Math.max(real, floor);
}

// A "summoner" hero here = can legally summon a Creature of level ≥ 1 via
// any spell school. Beato (virtual Lv1 everywhere) qualifies; plain atk
// heroes with no abilities don't.
function _isSummonerHero(engine, pi, hi) {
  const hero = engine.gs.players[pi]?.heroes?.[hi];
  if (!hero?.name || hero.hp <= 0) return false;
  for (const s of SPELL_SCHOOLS_ALL) {
    if (_effectiveSchoolLevel(engine, pi, hi, s) >= 1) return true;
  }
  return false;
}

module.exports = {
  equipEffect: true,

  /**
   * Only one copy of Slippery Skates per Hero. Prevents the CPU (and any
   * future scripted flow using this hook) from stacking duplicates.
   */
  canEquipToHero(gs, pi, hi, engine) {
    return !engine.cardInstances.some(c =>
      c.owner === pi && c.zone === 'support' &&
      c.heroIdx === hi && c.name === CARD_NAME
    );
  },

  /**
   * CPU equip-target preference: strongly prefer heroes that can summon
   * Creatures of level ≥ 1 so the move ability actually has creatures to
   * relocate (and to keep the equip value-positive).
   */
  cpuPrefersEquipTarget(engine, pi, hi, _cardData) {
    return _isSummonerHero(engine, pi, hi);
  },

  /**
   * Numeric ranking among the preferred pool. The base brain picks at
   * random inside the pool; with this override we can route Skates onto
   * the hero that can summon the HIGHEST-level creatures (e.g. Ascended
   * Beato's virtual Lv9 beats any real Lv1 summoner), with a tiebreak
   * toward heroes that aren't already carrying an equipment.
   */
  cpuEquipTargetScore(engine, pi, hi, _cardData) {
    let maxLvl = 0;
    for (const s of SPELL_SCHOOLS_ALL) {
      const lvl = _effectiveSchoolLevel(engine, pi, hi, s);
      if (lvl > maxLvl) maxLvl = lvl;
    }
    if (maxLvl === 0) return 0; // Non-summoner — last choice.
    // Count existing NON-Creature support cards as "already equipped."
    // Fewer existing equips = higher score within the same level tier.
    const ps = engine.gs.players[pi];
    const zones = ps?.supportZones?.[hi] || [];
    const cardDB = engine._getCardDB();
    let equipCount = 0;
    for (const slot of zones) {
      if (!slot || slot.length === 0) continue;
      const cd = cardDB[slot[0]];
      if (cd && cd.cardType !== 'Creature') equipCount++;
    }
    return maxLvl * 100 - equipCount;
  },

  /**
   * CPU activation guard: during Main Phase 1 / Action Phase the CPU still
   * needs to keep summoner-hero zones open so it can actually play the
   * Creatures in its hand. Skates moves a Creature onto an adjacent ally
   * hero's zone, occupying one more slot. If the team currently has fewer
   * than 2 free summoner-hero zones, we defer — the activation can still
   * happen in Main Phase 2 (phase 4+) when the Action-Phase summon is
   * already behind us. After Action Phase: always proceed.
   */
  cpuCanActivateEquip(engine, pi, _hi, _zoneSlot) {
    const phase = engine.gs.currentPhase;
    if (phase >= 4) return true; // Main Phase 2 — Action Phase is over
    const ps = engine.gs.players[pi];
    if (!ps) return true;
    let summonerFree = 0;
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      if (!_isSummonerHero(engine, pi, hi)) continue;
      for (let zi = 0; zi < 3; zi++) {
        if (((ps.supportZones?.[hi] || [])[zi] || []).length === 0) summonerFree++;
      }
    }
    return summonerFree >= 2;
  },

  /**
   * Can activate when equipped hero has 1+ Creatures AND
   * 1+ adjacent ally heroes have 1+ free Support Zones.
   */
  canActivateEquipEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOriginalOwner;
    const ps = gs.players[pi];
    const heroIdx = ctx.cardHeroIdx;
    if (!ps) return false;

    // Check for 1+ creatures on this hero
    const hasCreature = _getCreaturesOnHero(ps, heroIdx, engine).length > 0;
    if (!hasCreature) return false;

    // Check for 1+ adjacent heroes with free zones
    return _getAdjacentFreeZones(ps, heroIdx).length > 0;
  },

  async onEquipEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOriginalOwner;
    const ps = gs.players[pi];
    const heroIdx = ctx.cardHeroIdx;
    if (!ps) return false;

    // Suppress card reveal until effect is confirmed
    const savedReveal = gs._pendingCardReveal;
    delete gs._pendingCardReveal;

    const creatures = _getCreaturesOnHero(ps, heroIdx, engine);
    if (creatures.length === 0) return false;
    const freeZones = _getAdjacentFreeZones(ps, heroIdx);
    if (freeZones.length === 0) return false;

    // Single combined prompt — client handles two-step click flow
    const result = await engine.promptGeneric(pi, {
      type: 'skatesMove',
      title: 'Slippery Skates',
      ownerIdx: pi,
      heroIdx,
      creatures: creatures.map(c => ({ zoneSlot: c.zoneSlot, name: c.name })),
      destZones: freeZones.map(z => ({ heroIdx: z.heroIdx, slotIdx: z.slotIdx })),
      cancellable: true,
    });

    if (!result || result.cancelled) return false;
    const srcSlot = result.creatureSlot;
    const destHeroIdx = result.destHeroIdx;
    const destSlot = result.destSlot;
    if (srcSlot == null || destHeroIdx == null || destSlot == null) return false;

    // Verify source creature still exists
    const srcCards = (ps.supportZones[heroIdx] || [])[srcSlot] || [];
    if (srcCards.length === 0) return false;
    const inst = engine.cardInstances.find(ci =>
      ci.owner === pi && ci.zone === 'support' && ci.heroIdx === heroIdx && ci.zoneSlot === srcSlot
    );
    if (!inst) return false;

    // Verify destination is still free
    if (((ps.supportZones[destHeroIdx] || [])[destSlot] || []).length > 0) return false;

    // Fire the card reveal now
    if (savedReveal) {
      gs._pendingCardReveal = savedReveal;
      engine._firePendingCardReveal();
    }

    // Suppress damage numbers for the creature leaving its zone
    engine._broadcastEvent('creature_zone_move', { owner: pi, heroIdx, zoneSlot: srcSlot });

    // Remove from source
    const srcSlotArr = (ps.supportZones[heroIdx] || [])[srcSlot] || [];
    const srcIdx = srcSlotArr.indexOf(inst.name);
    if (srcIdx >= 0) srcSlotArr.splice(srcIdx, 1);

    // Animate slide (reuse Slippery Fridge's play_card_transfer)
    engine._broadcastEvent('play_card_transfer', {
      sourceOwner: pi,
      sourceHeroIdx: heroIdx,
      sourceZoneSlot: srcSlot,
      targetOwner: pi,
      targetHeroIdx: destHeroIdx,
      targetZoneSlot: destSlot,
      cardName: inst.name,
      duration: 600,
      particles: null,
    });
    engine.sync();
    await engine._delay(500);

    // Place into destination
    if (!ps.supportZones[destHeroIdx]) ps.supportZones[destHeroIdx] = [[], [], []];
    if (!ps.supportZones[destHeroIdx][destSlot]) ps.supportZones[destHeroIdx][destSlot] = [];
    ps.supportZones[destHeroIdx][destSlot].push(inst.name);

    // Update card instance
    inst.heroIdx = destHeroIdx;
    inst.zoneSlot = destSlot;

    engine.sync();

    // Fire onCardEnterZone for the moved card
    await engine.runHooks('onCardEnterZone', {
      _onlyCard: inst, enteringCard: inst,
      toZone: 'support', toHeroIdx: destHeroIdx,
      _skipReactionCheck: true,
    });

    engine.log('slippery_skates_move', {
      card: inst.name,
      fromHero: ps.heroes[heroIdx]?.name || '?',
      toHero: ps.heroes[destHeroIdx]?.name || '?',
      player: ps.username,
    });

    engine.sync();
    return true;
  },
};

/**
 * Get all Creatures on a hero's support zones.
 */
function _getCreaturesOnHero(ps, heroIdx, engine) {
  const result = [];
  const cardDB = engine._getCardDB();
  for (let zi = 0; zi < (ps.supportZones[heroIdx] || []).length; zi++) {
    const slot = (ps.supportZones[heroIdx] || [])[zi] || [];
    if (slot.length === 0) continue;
    const name = slot[0];
    const cd = cardDB[name];
    if (!cd || cd.cardType !== 'Creature') continue;
    const inst = engine.cardInstances.find(c =>
      c.zone === 'support' && c.heroIdx === heroIdx && c.zoneSlot === zi && c.name === name
    );
    if (!inst || inst.faceDown) continue;
    result.push({ name, zoneSlot: zi, inst });
  }
  return result;
}

/**
 * Get free Support Zones on adjacent heroes.
 * Adjacency: hero 0↔1, hero 1↔2 (hero 0 and 2 are NOT adjacent).
 */
function _getAdjacentFreeZones(ps, heroIdx) {
  const adjacent = [];
  if (heroIdx > 0) adjacent.push(heroIdx - 1);
  if (heroIdx < 2) adjacent.push(heroIdx + 1);

  const result = [];
  for (const hi of adjacent) {
    const hero = ps.heroes?.[hi];
    if (!hero?.name) continue;
    for (let zi = 0; zi < 3; zi++) {
      if (((ps.supportZones[hi] || [])[zi] || []).length === 0) {
        result.push({ heroIdx: hi, slotIdx: zi });
      }
    }
  }
  return result;
}
