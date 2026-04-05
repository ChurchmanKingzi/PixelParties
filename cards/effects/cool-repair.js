// ═══════════════════════════════════════════
//  CARD EFFECT: "Cool Repair"
//  Artifact (Normal) — Choose an equippable
//  Artifact from your discard pile that was
//  not sent there this turn. Equip it to a
//  Hero you control without paying its Cost.
//  This Artifact's Cost becomes half the
//  equipped Artifact's Cost (rounded up).
//
//  Uses snapshot tracking at turn start to
//  determine which cards were already in the
//  discard pile before this turn.
//
//  Equip detection: cardDB subtype 'Equipment'
//  (Initiation Ritual heroes with treatAsEquip
//  are tracked separately and not in discard.)
// ═══════════════════════════════════════════

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

// ─── DISCARD SNAPSHOT HELPERS ────────────

/** Initialize or retrieve the turn-start discard snapshot. */
function _ensureSnapshot(gs) {
  const turn = gs.turn || 0;
  if (!gs._coolRepairSnapshots) gs._coolRepairSnapshots = {};
  // Return existing snapshot for this turn
  if (gs._coolRepairSnapshots[turn]) return gs._coolRepairSnapshots[turn];
  // No snapshot yet (Cool Repair wasn't in hand at turn start) → fallback:
  // Snapshot the current state (slightly lenient — cards discarded before this
  // point in the turn will be treated as "not discarded this turn")
  gs._coolRepairSnapshots[turn] = [
    [...(gs.players[0]?.discardPile || [])],
    [...(gs.players[1]?.discardPile || [])],
  ];
  return gs._coolRepairSnapshots[turn];
}

/** Count occurrences of a card name in an array. */
function _countIn(arr, name) {
  let n = 0;
  for (const x of arr) if (x === name) n++;
  return n;
}

/**
 * Get the number of ELIGIBLE copies of a card in the discard pile.
 * Eligible = was already in the discard at the start of this turn.
 */
function _eligibleCount(gs, pi, cardName) {
  const snapshot = _ensureSnapshot(gs);
  const snapshotPile = snapshot[pi] || [];
  const currentPile = gs.players[pi]?.discardPile || [];
  const currentCount = _countIn(currentPile, cardName);
  const snapshotCount = _countIn(snapshotPile, cardName);
  // Cards in snapshot = were there before this turn → eligible
  // Additional copies beyond snapshot count = added this turn → ineligible
  return Math.min(currentCount, snapshotCount);
}

// ─── EQUIP ELIGIBILITY ───────────────────

/** Check if a card name is an Equipment Artifact by card data. */
function _isEquipByData(cardName) {
  const cardDB = _getCardDB();
  const cd = cardDB[cardName];
  if (!cd) return false;
  return (cd.subtype || '').toLowerCase() === 'equipment';
}

/** Check if a player has at least 1 living hero with a free base Support Zone. */
function _hasHeroWithFreeZone(ps) {
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name || hero.hp <= 0) continue;
    for (let si = 0; si < 3; si++) {
      if (((ps.supportZones[hi] || [])[si] || []).length === 0) return true;
    }
  }
  return false;
}

/**
 * Build deduplicated gallery of eligible equips from the player's discard pile.
 * Each entry: { name, cost, count } where count = eligible copies.
 */
function _buildEligibleGallery(gs, pi) {
  const ps = gs.players[pi];
  const cardDB = _getCardDB();
  const gold = ps.gold || 0;
  const seen = new Map(); // cardName → { cost, count }

  for (const cardName of (ps.discardPile || [])) {
    if (!_isEquipByData(cardName)) continue;
    const cd = cardDB[cardName];
    const equipCost = cd.cost || 0;
    // Cost filter: equip cost ≤ 2× player's current gold
    if (equipCost > gold * 2) continue;

    if (seen.has(cardName)) continue; // Dedup — count handled below

    const eligible = _eligibleCount(gs, pi, cardName);
    if (eligible <= 0) continue;

    seen.set(cardName, { cost: equipCost, count: eligible });
  }

  return [...seen.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, data]) => ({
      name,
      source: 'discard',
      cost: data.cost,
      repairCost: Math.ceil(data.cost / 2),
      count: data.count,
    }));
}

// ─── MODULE EXPORTS ──────────────────────

module.exports = {
  isTargetingArtifact: true,
  manualGoldCost: true,
  activeIn: ['hand'],

  hooks: {
    /**
     * At each turn start, snapshot both players' discard piles.
     * Used for "not sent there this turn" eligibility check.
     */
    onTurnStart: async (ctx) => {
      const gs = ctx._engine.gs;
      const turn = gs.turn || 0;
      if (!gs._coolRepairSnapshots) gs._coolRepairSnapshots = {};
      gs._coolRepairSnapshots[turn] = [
        [...(gs.players[0]?.discardPile || [])],
        [...(gs.players[1]?.discardPile || [])],
      ];
      // Cleanup old snapshots (keep last 4 turns)
      for (const t of Object.keys(gs._coolRepairSnapshots)) {
        if (Number(t) < turn - 3) delete gs._coolRepairSnapshots[t];
      }
    },
  },

  canActivate(gs, pi) {
    const ps = gs.players[pi];
    if (!_hasHeroWithFreeZone(ps)) return false;
    const gallery = _buildEligibleGallery(gs, pi);
    return gallery.length > 0;
  },

  // Self-targeting — card gallery handles selection
  getValidTargets: () => [],

  targetingConfig: {
    description: 'Recover an Equipment Artifact from your discard pile.',
    confirmLabel: '🔧 Repair!',
    confirmClass: 'btn-info',
    cancellable: true,
    alwaysConfirmable: true,
  },

  validateSelection: () => true,

  animationType: 'none',

  resolve: async (engine, pi) => {
    const gs = engine.gs;
    const ps = gs.players[pi];
    const cardDB = _getCardDB();

    // ── Step 1: Build eligible equip gallery ──
    const gallery = _buildEligibleGallery(gs, pi);
    if (gallery.length === 0) return { aborted: true };

    // Show card gallery with cost info
    const result = await engine.promptGeneric(pi, {
      type: 'cardGallery',
      cards: gallery,
      title: 'Cool Repair',
      description: 'Choose an Equipment Artifact to recover from your discard pile.',
      cancellable: true,
    });

    if (!result || !result.cardName) return { aborted: true };

    const equipName = result.cardName;
    const cd = cardDB[equipName];
    if (!cd) return { aborted: true };

    // Verify the card is still eligible
    const stillEligible = _eligibleCount(gs, pi, equipName);
    if (stillEligible <= 0) return { aborted: true };
    if (!_isEquipByData(equipName)) return { aborted: true };

    // ── Step 2: Calculate and check dynamic cost ──
    const equipCost = cd.cost || 0;
    const repairCost = Math.ceil(equipCost / 2);

    if ((ps.gold || 0) < repairCost) {
      engine.log('cool_repair_no_gold', { player: ps.username, needed: repairCost, have: ps.gold || 0 });
      return { aborted: true };
    }

    // ── Step 3: Select destination hero + support zone ──
    const destTargets = [];
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      if (hero.statuses?.frozen) continue; // Can't equip to frozen heroes
      let hasFree = false;
      for (let si = 0; si < 3; si++) {
        if (((ps.supportZones[hi] || [])[si] || []).length === 0) {
          hasFree = true;
          destTargets.push({
            id: `equip-${pi}-${hi}-${si}`,
            type: 'equip',
            owner: pi,
            heroIdx: hi,
            slotIdx: si,
            cardName: '',
          });
        }
      }
      // Also allow clicking the hero directly
      if (hasFree) {
        destTargets.push({
          id: `hero-${pi}-${hi}`,
          type: 'hero',
          owner: pi,
          heroIdx: hi,
          cardName: hero.name,
        });
      }
    }

    if (destTargets.length === 0) return { aborted: true };

    const destIds = await engine.promptEffectTarget(pi, destTargets, {
      title: `Cool Repair — Equip ${equipName}`,
      description: `Select a Support Zone to equip ${equipName} to. (Cost: ${repairCost}G)`,
      confirmLabel: '🔧 Equip!',
      confirmClass: 'btn-info',
      cancellable: true,
      greenSelect: true,
      exclusiveTypes: false,
      maxPerType: { hero: 1, equip: 1 },
    });

    if (!destIds || destIds.length === 0) return { aborted: true };

    const dest = destTargets.find(t => t.id === destIds[0]);
    if (!dest) return { aborted: true };

    let destHeroIdx, destSlot;
    if (dest.type === 'equip') {
      destHeroIdx = dest.heroIdx;
      destSlot = dest.slotIdx;
    } else {
      destHeroIdx = dest.heroIdx;
      // Auto-pick first free base zone
      for (let si = 0; si < 3; si++) {
        if (((ps.supportZones[destHeroIdx] || [])[si] || []).length === 0) {
          destSlot = si;
          break;
        }
      }
      if (destSlot === undefined) return { aborted: true };
    }

    // Final validation: slot still free?
    if (((ps.supportZones[destHeroIdx] || [])[destSlot] || []).length > 0) return { aborted: true };

    // ── Step 4: Deduct dynamic gold cost ──
    if (repairCost > 0) {
      ps.gold -= repairCost;
      engine.log('gold_spend', { player: ps.username, amount: repairCost, total: ps.gold, for: 'Cool Repair' });
    }

    // ── Step 5: Remove equip from discard pile ──
    const discardIdx = ps.discardPile.indexOf(equipName);
    if (discardIdx < 0) return { aborted: true };
    ps.discardPile.splice(discardIdx, 1);

    // ── Step 6: Place equip in support zone ──
    if (!ps.supportZones[destHeroIdx]) ps.supportZones[destHeroIdx] = [[], [], []];
    if (!ps.supportZones[destHeroIdx][destSlot]) ps.supportZones[destHeroIdx][destSlot] = [];
    ps.supportZones[destHeroIdx][destSlot].push(equipName);

    // Track as card instance
    const inst = engine._trackCard(equipName, pi, 'support', destHeroIdx, destSlot);

    engine.sync();

    // ── Step 7: Staggered 💥 explosion animation on the equipped zone ──
    const animSlots = [
      { delay: 0,   type: 'explosion' },
      { delay: 200, type: 'explosion' },
      { delay: 450, type: 'explosion' },
      { delay: 700, type: 'explosion' },
    ];
    for (const a of animSlots) {
      setTimeout(() => {
        engine._broadcastEvent('play_zone_animation', {
          type: a.type,
          owner: pi,
          heroIdx: destHeroIdx,
          zoneSlot: destSlot,
        });
      }, a.delay);
    }

    await engine._delay(1400); // Wait for all explosions to finish

    // ── Step 8: Fire entry hooks for the equipped card ──
    await engine.runHooks('onPlay', {
      _onlyCard: inst, playedCard: inst, cardName: equipName,
      zone: 'support', heroIdx: destHeroIdx, zoneSlot: destSlot,
    });
    await engine.runHooks('onCardEnterZone', {
      enteringCard: inst, toZone: 'support', toHeroIdx: destHeroIdx,
    });

    engine.log('cool_repair', {
      player: ps.username,
      equip: equipName,
      hero: ps.heroes[destHeroIdx]?.name || '?',
      slot: destSlot,
      goldPaid: repairCost,
    });

    engine.sync();
    return true;
  },
};
