// ═══════════════════════════════════════════
//  CARD EFFECT: "Dark Gear"
//  Artifact (Normal, 5 Gold base)
//
//  Conditions:
//  - Player controls no opponent-original creatures
//  - Opponent controls 1+ creatures
//  - Player has a free support zone (any hero, even dead)
//  - Player has gold >= creature level × cost
//
//  Effect:
//  1. Select an opponent's creature
//  2. Select a free support zone on your side
//  3. Pay gold (base cost × creature level)
//  4. Move creature to your zone, transfer control
//  5. Apply un-removable "dark_gear_negated" debuff
//     for rest of turn (clears negated on expiry)
//
//  Animation: gear spin CW → card flies across → gear spin CCW
// ═══════════════════════════════════════════

const { hasNumericCreatureLevel } = require('./_hooks');

const BASE_COST = 5;

/**
 * Get all free support zones for a player (including dead heroes).
 */
function getFreeZones(gs, playerIdx) {
  const ps = gs.players[playerIdx];
  const zones = [];
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name) continue;
    for (let si = 0; si < (ps.supportZones[hi] || []).length; si++) {
      const slot = (ps.supportZones[hi] || [])[si] || [];
      if (slot.length === 0) {
        zones.push({ heroIdx: hi, slotIdx: si, label: `${hero.name} — Slot ${si + 1}` });
      }
    }
  }
  return zones;
}

/**
 * Check if the player controls any creature originally owned by the opponent.
 */
function hasOpponentCreatures(engine, playerIdx) {
  for (const inst of engine.cardInstances) {
    if (inst.controller === playerIdx && inst.zone === 'support' && inst.owner !== playerIdx) {
      return true;
    }
  }
  return false;
}

/**
 * Get opponent's creatures as targeting options.
 * Filtered by affordability (gold >= level × BASE_COST).
 */
function getStealableCreatures(engine, playerIdx) {
  const oppIdx = playerIdx === 0 ? 1 : 0;
  const ps = engine.gs.players[playerIdx];
  const gold = ps.gold || 0;
  const cardDB = engine._getCardDB();
  return engine.getCreatureTargets(oppIdx).filter(t => {
    const inst = t.cardInstance;
    if (inst && engine.isCreatureImmune(inst, 'targeting_immune')) return false;
    if (inst && engine.isCreatureImmune(inst, 'control_immune')) return false;
    const cd = cardDB[t.cardName];
    // Dark Gear's cost scales with the target's level, so level-less
    // Creatures (Artifact-Creatures like Pollution Spewer) are NOT valid
    // targets — `hasNumericCreatureLevel` returns false for `level: null`,
    // filtering them out here and anywhere else that needs a numeric level.
    if (!hasNumericCreatureLevel(cd)) return false;
    const level = cd.level;
    const cost = level * BASE_COST;
    if (gold < cost) return false;
    t.level = level;
    t.cost = cost;
    return true;
  });
}

module.exports = {
  isTargetingArtifact: true,

  canActivate(gs, pi, engine) {
    // Need engine reference — passed by the server for targeting artifacts
    const eng = engine || gs._engineRef;
    if (!eng) {
      // Fallback: check basic conditions without engine
      const oppIdx = pi === 0 ? 1 : 0;
      const oppPs = gs.players[oppIdx];
      let hasOppCreatures = false;
      for (let hi = 0; hi < (oppPs?.heroes || []).length; hi++) {
        for (let si = 0; si < (oppPs?.supportZones?.[hi] || []).length; si++) {
          if ((oppPs.supportZones[hi][si] || []).length > 0) { hasOppCreatures = true; break; }
        }
        if (hasOppCreatures) break;
      }
      if (!hasOppCreatures) return false;
      if (getFreeZones(gs, pi).length === 0) return false;
      return true;
    }
    // Full check with engine
    if (hasOpponentCreatures(eng, pi)) return false;
    const targets = getStealableCreatures(eng, pi);
    if (targets.length === 0) return false;
    if (getFreeZones(gs, pi).length === 0) return false;
    return true;
  },

  getValidTargets(gs, pi, engine) {
    const eng = engine || gs._engineRef;
    if (!eng) return [];
    if (hasOpponentCreatures(eng, pi)) return [];
    return getStealableCreatures(eng, pi);
  },

  targetingConfig: {
    description: 'Select an opponent\'s Creature to take control of.',
    confirmLabel: '⚙️ Steal!',
    confirmClass: 'btn-danger',
    cancellable: true,
    exclusiveTypes: true,
    maxPerType: { equip: 1 },
  },

  validateSelection: (selectedIds) => selectedIds && selectedIds.length === 1,

  animationType: 'dark_gear_spin_cw',

  resolve: async (engine, pi, selectedIds, validTargets) => {
    if (!selectedIds || selectedIds.length === 0) return { aborted: true };

    const target = validTargets.find(t => t.id === selectedIds[0]);
    if (!target) return { aborted: true };

    const gs = engine.gs;
    const ps = gs.players[pi];
    const oppIdx = pi === 0 ? 1 : 0;
    const cardDB = engine._getCardDB();
    const cd = cardDB[target.cardName];
    const level = cd?.level || 1;
    const totalCost = level * BASE_COST;

    // Final gold check (may have changed since canActivate)
    if ((ps.gold || 0) < totalCost) {
      engine.log('dark_gear_fizzle', { player: ps.username, reason: 'insufficient_gold', cost: totalCost, gold: ps.gold });
      return { aborted: true };
    }

    // Prompt for a free support zone on the player's side
    const freeZones = getFreeZones(gs, pi);
    if (freeZones.length === 0) {
      engine.log('dark_gear_fizzle', { player: ps.username, reason: 'no_free_zones' });
      return { aborted: true };
    }

    let chosenZone;
    if (freeZones.length === 1) {
      chosenZone = freeZones[0];
    } else {
      const picked = await engine.promptGeneric(pi, {
        type: 'zonePick',
        zones: freeZones,
        title: 'Dark Gear — Placement',
        description: `Choose a Support Zone to place ${target.cardName} into.`,
        cancellable: false,
      });
      chosenZone = (picked && freeZones.find(z => z.heroIdx === picked.heroIdx && z.slotIdx === picked.slotIdx)) || freeZones[0];
    }

    // ── Pay gold ──
    ps.gold -= totalCost;
    engine.log('gold_spent', { player: ps.username, amount: totalCost, reason: 'Dark Gear' });
    engine._broadcastEvent('gold_change', { owner: pi, amount: -totalCost });

    // ── Animation phase 1: Gear spin CW on source ──
    engine._broadcastEvent('play_zone_animation', {
      type: 'dark_gear_spin_cw', owner: target.owner,
      heroIdx: target.heroIdx, zoneSlot: target.slotIdx,
    });
    engine.sync();
    await engine._delay(1500);

    // ── Move creature ──
    const inst = target.cardInstance || engine.cardInstances.find(c =>
      c.owner === oppIdx && c.zone === 'support' &&
      c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx
    );
    if (!inst) return;

    const destHi = chosenZone.heroIdx;
    const destSi = chosenZone.slotIdx;

    // Transfer creature to player's control (handles zone move, animation, hooks, guardian sync)
    const transferResult = await engine.actionTransferCreature(inst, pi, destHi, destSi);
    if (!transferResult.success) return;

    // ── Animation phase 2: Gear spin CCW on destination ──
    engine._broadcastEvent('play_zone_animation', {
      type: 'dark_gear_spin_ccw', owner: pi,
      heroIdx: destHi, zoneSlot: destSi,
    });
    await engine._delay(1500);

    // ── Apply un-removable effect negation ──
    engine.actionNegateCreature(inst, 'Dark Gear', {
      expiresAtTurn: gs.turn + 1,
      expiresForPlayer: pi === 0 ? 1 : 0, // expires at start of OPPONENT's next turn (= end of this turn cycle)
    });

    engine.log('dark_gear', {
      player: ps.username,
      creature: target.cardName,
      cost: totalCost,
      fromHero: oppPs.heroes[target.heroIdx]?.name,
      toHero: ps.heroes[destHi]?.name,
    });

    engine.sync();
    return true;
  },
};
