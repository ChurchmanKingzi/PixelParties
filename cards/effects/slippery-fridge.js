// ═══════════════════════════════════════════
//  CARD EFFECT: "Slippery Fridge"
//  Normal Artifact — Manual activation only.
//  Choose an Equip Artifact on the board and
//  move it to a different Hero of the same
//  controller (without paying Cost again).
//
//  Equip detection covers three sources:
//  1. cardDB subtype === 'Equipment'
//  2. inst.counters.treatAsEquip (Initiation Ritual heroes)
//  3. script.isEquip === true (Flying Island, etc.)
//
//  An equip is only eligible if its controller
//  has another living Hero with a free base
//  Support Zone (slots 0–2, not island zones).
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const { loadCardEffect } = require('./_loader');

// ─── MODULE-LEVEL CARD DB (cached) ───────

let _cardDBCache = null;
function _getCardDB() {
  if (_cardDBCache) return _cardDBCache;
  try {
    const allCards = JSON.parse(
      require('fs').readFileSync(require('path').join(__dirname, '../../data/cards.json'), 'utf-8')
    );
    _cardDBCache = {};
    allCards.forEach(c => { _cardDBCache[c.name] = c; });
    return _cardDBCache;
  } catch { return {}; }
}

// ─── EQUIP DETECTION ─────────────────────

function _isEquipByData(cardName) {
  const cardDB = _getCardDB();
  const cd = cardDB[cardName];
  if (!cd) return false;
  if ((cd.subtype || '').toLowerCase() === 'equipment') return true;
  if (hasCardType(cd, 'Hero') || hasCardType(cd, 'Ascended Hero')) return true;
  const script = loadCardEffect(cardName);
  if (script?.isEquip) return true;
  return false;
}

function _isEquipInstance(inst) {
  if (!inst || inst.zone !== 'support') return false;
  if (inst.counters?.immovable) return false;
  if (inst.counters?.treatAsEquip) return true;
  const script = inst.loadScript();
  if (script?.isEquip) return true;
  const cardDB = _getCardDB();
  const cd = cardDB[inst.name];
  if (cd && (cd.subtype || '').toLowerCase() === 'equipment') return true;
  return false;
}

// ─── ZONE HELPERS ────────────────────────

function _getFreeBaseZones(ps, heroIdx) {
  const free = [];
  for (let si = 0; si < 3; si++) {
    if (((ps.supportZones[heroIdx] || [])[si] || []).length === 0) {
      free.push(si);
    }
  }
  return free;
}

function _hasOtherHeroWithFreeZone(ps, heroIdx) {
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    if (hi === heroIdx) continue;
    const h = ps.heroes[hi];
    if (!h?.name || h.hp <= 0) continue;
    if (_getFreeBaseZones(ps, hi).length > 0) return true;
  }
  return false;
}

function _findEligibleEquips(gs, engine) {
  const eligible = [];
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support') continue;
    if (!_isEquipInstance(inst)) continue;
    const ps = gs.players[inst.owner];
    if (!ps) continue;
    const hero = ps.heroes?.[inst.heroIdx];
    if (!hero?.name || hero.hp <= 0) continue;
    if (!_hasOtherHeroWithFreeZone(ps, inst.heroIdx)) continue;
    eligible.push(inst);
  }
  return eligible;
}

// ─── MODULE EXPORTS ──────────────────────

module.exports = {
  isTargetingArtifact: true,

  canActivate(gs, pi) {
    // Check if any equip on the board can be moved
    // Erst-Runden-Immunität (Als Regel): Fridge bleibt in Runde 1
    // spielbar, aber NUR auf eigene Equips — die Karten des geschützten
    // Spielers sind unantastbar. Ohne diese Zeile meldete das Gate
    // "spielbar", weil es fremde Equips mitzählte, während der zentrale
    // Ziel-Filter sie im Picker anschließend entfernt hätte: Karte
    // gespielt, Gold weg, leerer Picker.
    const ftProtected = gs.firstTurnProtectedPlayer;
    for (let pIdx = 0; pIdx < 2; pIdx++) {
      if (ftProtected != null && pIdx === ftProtected && pi !== ftProtected) continue;
      const ps = gs.players[pIdx];
      for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
        const hero = ps.heroes[hi];
        if (!hero?.name || hero.hp <= 0) continue;
        for (let si = 0; si < (ps.supportZones[hi] || []).length; si++) {
          const slot = (ps.supportZones[hi] || [])[si] || [];
          if (slot.length === 0) continue;
          if (!_isEquipByData(slot[0])) continue;
          if (_hasOtherHeroWithFreeZone(ps, hi)) return true;
        }
      }
    }
    return false;
  },

  animationType: 'none',

  // ── CPU-Auswahl (cpuResponse-Intercept, Muster Slippery Pengu) ─────
  // Fridge hatte KEINE eigene CPU-Logik — beide Prompts beantwortete der
  // generische Responder, dessen Bewertung Ascension-Fortschritt nicht
  // kennt. Live-Folge (Shadows over Blackport): Fridge zog Equips VON
  // Arthor weg, statt das zweite Ascension-Equip ZU ihm zu schieben.
  // Politik, in Prioritätsreihenfolge:
  //   1. VOLLENDER: Ein eigenes Equip, das ein anderer eigener Held für
  //      seine Ascension braucht (ascensionNeedsCard), wird dorthin
  //      bewegt — Arthors Circle von Jenny zu Arthor.
  //   2. SABOTAGE: Ein gegnerisches Ascension-Item (ascensionItems des
  //      nicht-aufgestiegenen Trägers) wird von diesem weggezogen.
  //   3. TRÄGER-SCHUTZ: Eigene Ascension-Items werden NIE vom
  //      nicht-aufgestiegenen Träger wegbewegt.
  //   4. Rest: Ziel per gelerntem equipPlacementBonus, sonst uniform.
  // Keine Rollouts — läuft in MCTS-Sims identisch und billig.
  cpuResponse(engine, kind, payload) {
    if (kind !== 'effectTarget') return undefined;
    const config = payload?.config;
    const title = config?.title || '';
    const validTargets = payload?.validTargets || [];
    const pi = payload?.playerIdx;
    if (typeof pi !== 'number') return undefined;
    const gs = engine.gs;

    const heroScript = (owner, hi) => {
      const name = gs.players?.[owner]?.heroes?.[hi]?.name;
      if (!name) return null;
      try { return loadCardEffect(name); } catch { return null; }
    };
    const heroAlive = (owner, hi) => {
      const h = gs.players?.[owner]?.heroes?.[hi];
      return !!(h?.name && h.hp > 0);
    };
    const needsForAscension = (owner, hi, equipName) => {
      if (!heroAlive(owner, hi)) return false;
      const script = heroScript(owner, hi);
      if (typeof script?.ascensionNeedsCard !== 'function') return false;
      try { return !!script.ascensionNeedsCard(equipName, null, engine, owner, hi); }
      catch { return false; }
    };
    const isProtectedOnBearer = (owner, hi, equipName) => {
      if (!heroAlive(owner, hi)) return false;
      const script = heroScript(owner, hi);
      return Array.isArray(script?.ascensionItems) && script.ascensionItems.includes(equipName);
    };
    const someOtherHeroNeeds = (owner, srcHi, equipName) => {
      for (let hi = 0; hi < (gs.players?.[owner]?.heroes || []).length; hi++) {
        if (hi === srcHi) continue;
        if (needsForAscension(owner, hi, equipName)) return hi;
      }
      return -1;
    };

    // ── Phase 1: Equip-Wahl ──
    if (title === 'Slippery Fridge') {
      const equips = validTargets.filter(t => t.type === 'equip');
      if (equips.length === 0) return [];
      // Priorität 1: eigener Vollender-Move
      for (const t of equips) {
        if (t.owner !== pi) continue;
        if (someOtherHeroNeeds(t.owner, t.heroIdx, t.cardName) >= 0) return [t.id];
      }
      // Priorität 2: Gegner-Sabotage (Ascension-Item vom Träger wegziehen)
      for (const t of equips) {
        if (t.owner === pi) continue;
        if (isProtectedOnBearer(t.owner, t.heroIdx, t.cardName)) return [t.id];
      }
      // Priorität 3: Träger-Schutz — geschützte eigene Equips aus dem Pool
      const pool = equips.filter(t => !(t.owner === pi && isProtectedOnBearer(t.owner, t.heroIdx, t.cardName)));
      if (pool.length === 0) return []; // nichts Sinnvolles → cancel, Karte bleibt in der Hand
      return [pool[Math.floor(Math.random() * pool.length)].id];
    }

    // ── Phase 2: Ziel-Wahl ──
    if (title.startsWith('Slippery Fridge — Move ')) {
      const equipName = title.slice('Slippery Fridge — Move '.length);
      const heroTargets = validTargets.filter(t => t.type === 'hero');
      const pickFor = (hi) => {
        const h = heroTargets.find(t => t.heroIdx === hi);
        if (h) return [h.id];
        const z = validTargets.find(t => t.type === 'equip' && t.heroIdx === hi);
        return z ? [z.id] : null;
      };
      const owner = (heroTargets[0] || validTargets[0])?.owner;
      // Vollender: der Held, der das Equip für seine Ascension braucht
      if (typeof owner === 'number') {
        for (const t of heroTargets.length ? heroTargets : validTargets) {
          if (needsForAscension(owner, t.heroIdx, equipName)) {
            const picked = pickFor(t.heroIdx);
            if (picked) return picked;
          }
        }
      }
      // Gelernte Platzierungs-Priors (nur für eigene Moves sinnvoll)
      if (owner === pi) {
        let deckProfile = null;
        try { deckProfile = require('./_deck-profile'); } catch {}
        if (deckProfile) {
          let bestHi = -1, bestV = 4; // Schwelle wie pickHeroForEquip
          const his = [...new Set(validTargets.map(t => t.heroIdx))];
          for (const hi of his) {
            const heroName = gs.players?.[pi]?.heroes?.[hi]?.name;
            if (!heroName) continue;
            const v = deckProfile.equipPlacementBonus(engine, pi, equipName, heroName);
            if (v > bestV) { bestV = v; bestHi = hi; }
          }
          if (bestHi >= 0) {
            const picked = pickFor(bestHi);
            if (picked) return picked;
          }
        }
      }
      // Fallback: uniform
      const t = validTargets[Math.floor(Math.random() * validTargets.length)];
      return t ? [t.id] : [];
    }

    return undefined;
  },

  // ── RESOLVE ────────────────────────────
  // Moves exactly ONE Equip Artifact to a different Hero of the same controller.
  // First prompt is cancellable — cancelling returns card to hand.
  resolve: async (engine, pi) => {
    const gs = engine.gs;

    // ── Step 1: Find eligible equips ──
    const eligible = _findEligibleEquips(gs, engine);
    if (eligible.length === 0) return { cancelled: true }; // Fizzle — no valid targets

    const equipTargets = eligible.map(inst => ({
      id: `equip-${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`,
      type: 'equip',
      owner: inst.owner,
      heroIdx: inst.heroIdx,
      slotIdx: inst.zoneSlot,
      cardName: inst.name,
      cardInstance: inst,
    }));

    // ── Step 2: Select equip to move (cancellable) ──
    const pickedIds = await engine.promptEffectTarget(pi, equipTargets, {
      title: 'Slippery Fridge',
      description: 'Select an equipped Artifact to move.',
      confirmLabel: '🧊 Select!',
      confirmClass: 'btn-info',
      cancellable: true,
      exclusiveTypes: true,
      maxPerType: { equip: 1 },
    });

    if (!pickedIds || pickedIds.length === 0) return { cancelled: true };

    const picked = equipTargets.find(t => t.id === pickedIds[0]);
    if (!picked) return true;

    const inst = picked.cardInstance;
    const equipOwner = inst.owner;
    const ps = gs.players[equipOwner];
    const srcHeroIdx = inst.heroIdx;
    const srcSlot = inst.zoneSlot;

    // ── Step 3: Build destination targets ──
    const destTargets = [];
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      if (hi === srcHeroIdx) continue;
      const hero = ps.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      const freeZones = _getFreeBaseZones(ps, hi);
      for (const si of freeZones) {
        destTargets.push({
          id: `equip-${equipOwner}-${hi}-${si}`,
          type: 'equip',
          owner: equipOwner,
          heroIdx: hi,
          slotIdx: si,
          cardName: '',
        });
      }
      // Also allow clicking the hero directly (auto-picks first free slot)
      if (freeZones.length > 0) {
        destTargets.push({
          id: `hero-${equipOwner}-${hi}`,
          type: 'hero',
          owner: equipOwner,
          heroIdx: hi,
          cardName: hero.name,
        });
      }
    }

    if (destTargets.length === 0) return true; // Fizzle

    // ── Step 4: Select destination (non-cancellable) ──
    const destIds = await engine.promptEffectTarget(pi, destTargets, {
      title: `Slippery Fridge — Move ${inst.name}`,
      description: `Select a Support Zone to move ${inst.name} to.`,
      confirmLabel: '🧊 Move!',
      confirmClass: 'btn-info',
      cancellable: false,
      greenSelect: true,
      exclusiveTypes: false,
      maxPerType: { hero: 1, equip: 1 },
    });

    if (!destIds || destIds.length === 0) return true; // Safety

    const dest = destTargets.find(t => t.id === destIds[0]);
    if (!dest) return true;

    let destHeroIdx, destSlot;
    if (dest.type === 'equip') {
      destHeroIdx = dest.heroIdx;
      destSlot = dest.slotIdx;
    } else {
      destHeroIdx = dest.heroIdx;
      const freeZones = _getFreeBaseZones(ps, destHeroIdx);
      if (freeZones.length === 0) return true;
      destSlot = freeZones[0];
    }

    // ── Step 5: Execute the move ──

    // 5a: Fire onCardLeaveZone for ONLY the moved card (prevents other equips revoking ATK).
    //
    // Equipment scripts (Legendary Sword, Vampiric Sword, Sun Sword, both
    // Hammers, both Blades, etc.) gate their leave-zone hook on
    //   ctx.fromOwner === ctx.cardOwner
    //   ctx.fromHeroIdx === ctx.card.heroIdx
    //   ctx.fromZoneSlot === ctx.card.zoneSlot
    // — the "did THIS card actually leave?" check. Omitting `fromOwner`
    // or `fromZoneSlot` here makes those checks evaluate
    // `undefined !== ctx.cardOwner` and bail silently, which used to
    // skip revokeAtk (old hero kept the +X ATK), expireAdditionalAction
    // (Sword's summon token persisted on the old hero), and equipment-
    // specific ascension re-checks (checkArthorAscension on the source
    // hero). Pass the full canonical payload — same shape as
    // _engine.js's death/move paths and the runHooks call at line 14045.
    await engine.runHooks('onCardLeaveZone', {
      _onlyCard: inst, card: inst,
      fromZone: 'support',
      fromOwner: equipOwner,
      fromHeroIdx: srcHeroIdx,
      fromZoneSlot: srcSlot,
      _skipReactionCheck: true,
    });

    // 5a-cleanup: Reset atkGranted counter so re-grant on new hero starts fresh
    // (revokeAtk subtracts from hero.atk but doesn't reset the counter)
    if (inst.counters.atkGranted) inst.counters.atkGranted = 0;

    // 5b: Remove from source support zone
    const srcSlotArr = (ps.supportZones[srcHeroIdx] || [])[srcSlot] || [];
    const srcIdx = srcSlotArr.indexOf(inst.name);
    if (srcIdx >= 0) srcSlotArr.splice(srcIdx, 1);

    // 5c: Animate slide
    engine._broadcastEvent('play_card_transfer', {
      sourceOwner: equipOwner,
      sourceHeroIdx: srcHeroIdx,
      sourceZoneSlot: srcSlot,
      targetOwner: equipOwner,
      targetHeroIdx: destHeroIdx,
      targetZoneSlot: destSlot,
      cardName: inst.name,
      duration: 600,
      particles: null,
    });
    engine.sync();
    await engine._delay(500);

    // 5d: Place into destination support zone
    if (!ps.supportZones[destHeroIdx]) ps.supportZones[destHeroIdx] = [[], [], []];
    if (!ps.supportZones[destHeroIdx][destSlot]) ps.supportZones[destHeroIdx][destSlot] = [];
    ps.supportZones[destHeroIdx][destSlot].push(inst.name);

    // 5e: Update card instance
    inst.zone = 'support';
    inst.heroIdx = destHeroIdx;
    inst.zoneSlot = destSlot;

    engine.sync();

    // 5f: Fire onCardEnterZone for ONLY the moved card
    await engine.runHooks('onCardEnterZone', {
      _onlyCard: inst, enteringCard: inst,
      toZone: 'support', toHeroIdx: destHeroIdx,
    });

    // 5g: Re-fire onPlay so the equip re-grants ATK on the new hero
    await engine.runHooks('onPlay', {
      _onlyCard: inst, playedCard: inst,
      cardName: inst.name, zone: 'support',
      heroIdx: destHeroIdx, zoneSlot: destSlot,
    });

    engine.log('slippery_fridge_move', {
      card: inst.name,
      fromHero: ps.heroes[srcHeroIdx]?.name || '?',
      toHero: ps.heroes[destHeroIdx]?.name || '?',
      player: ps.username,
    });

    engine.sync();
    return true;
  },
};
