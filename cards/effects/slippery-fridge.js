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
    for (let pIdx = 0; pIdx < 2; pIdx++) {
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
