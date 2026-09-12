// ═══════════════════════════════════════════
//  CARD EFFECT: "Cool Repair"
//  Artifact (Normal, Cost 1)
//
//  "Choose an equippable Artifact from your discard pile and equip it
//   to a Hero you control without paying its Cost. This Artifact's
//   Cost becomes half the equipped Artifact's Cost (rounded up)."
//   (Text v669, Al 30.8.: der „since the beginning of your last turn"-
//   Filter ist gestrichen — der Turn-Snapshot liess frisch abgelegte
//   Karten nie zu.)
//
//  Nicht mehr `isTargetingArtifact` (v669): der vorgeschaltete
//  Bestaetigungsdialog war ueberfluessig, die Galerie hat ihren
//  eigenen Cancel — ein Abbruch dort liefert `{ cancelled: true }`,
//  der Server laesst die Karte dann in der Hand und zahlt nichts.
//  `manualGoldCost`: den halben Preis zahlt die Karte selbst, erst
//  nachdem der Zielplatz steht.
//
//  Beim Anlegen setzt sie `inst.counters._viaCoolRepair` — Cool Tech
//  Jetpack bleibt nur ueber diesen Weg liegen.
// ═══════════════════════════════════════════
const { loadCardEffect } = require('./_loader');
const { getCardDB: _getCardDB } = require('./_card-db');

// ─── MODULE-LEVEL CARD DB (cached) ───────

/** Count occurrences of a card name in an array. */
function _countIn(arr, name) {
  let n = 0;
  for (const x of arr) if (x === name) n++;
  return n;
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
function _buildEligibleGallery(gs, pi, engine) {
  const ps = gs.players[pi];
  const cardDB = _getCardDB();
  const gold = ps.gold || 0;
  const seen = new Map(); // cardName → { cost, count }

  for (const cardName of (ps.discardPile || [])) {
    if (!_isEquipByData(cardName)) continue;
    const cd = cardDB[cardName];
    const equipCost = cd.cost || 0;
    // Bezahlbarkeit des halben Preises (inkl. Kreditrahmen).
    if (engine && !engine.canAffordGold(pi, Math.ceil(equipCost / 2), 'Cool Repair')) continue;
    if (!engine && Math.ceil(equipCost / 2) > gold) continue;

    if (seen.has(cardName)) continue; // Dedup — count handled below
    seen.set(cardName, { cost: equipCost, count: _countIn(ps.discardPile, cardName) });
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
  // ── CPU: Ziel-Intercept (Shield-of-Life-Klasse) ──────────────────
  // Cancellable Utility-Ziel ohne baseDamage fällt sonst auf den
  // Engine-Decline durch. Politik: Equip-Ziel = erster eigener Held (Standard-Equip-Bias greift über die Galerie davor)
  cpuResponse(engine, kind, payload) {
    if (kind !== 'effectTarget') return undefined;
    const vt = payload?.validTargets || [];
    if (vt.length === 0) return undefined;
    const pick = vt[0];
    return [typeof pick === 'object' ? pick.id : pick];
  },


  manualGoldCost: true,
  activeIn: ['hand'],

  canActivate(gs, pi, engine) {
    const ps = gs.players[pi];
    if (!_hasHeroWithFreeZone(ps)) return false;
    const gallery = _buildEligibleGallery(gs, pi, engine);
    return gallery.length > 0;
  },

  resolve: async (engine, pi) => {
    const gs = engine.gs;
    const ps = gs.players[pi];
    const cardDB = _getCardDB();

    // ── Step 1: Build eligible equip gallery ──
    const gallery = _buildEligibleGallery(gs, pi, engine);
    if (gallery.length === 0) return { cancelled: true };

    // Show card gallery with cost info
    const result = await engine.promptGeneric(pi, {
      type: 'cardGallery',
      cards: gallery,
      title: 'Cool Repair',
      description: 'Choose an Equipment Artifact to recover from your discard pile.',
      cancellable: true,
    });

    if (!result || result.cancelled || !result.cardName) return { cancelled: true };

    const equipName = result.cardName;
    const cd = cardDB[equipName];
    if (!cd) return { cancelled: true };
    if (!ps.discardPile.includes(equipName)) return { cancelled: true };
    if (!_isEquipByData(equipName)) return { cancelled: true };

    // ── Step 2: Calculate and check dynamic cost ──
    const equipCost = cd.cost || 0;
    const repairCost = Math.ceil(equipCost / 2);

    // Bezahlbarkeit inkl. Kreditrahmen (16.8.): ohne den blockiert
    // diese Zeile genau die Zahlung, die der Ziel-Waehler oben
    // bereits erlaubt hat — Als Book-of-Doom-Report.
    if (!engine.canAffordGold(pi, repairCost, 'Cool Repair')) {
      engine.log('cool_repair_no_gold', { player: ps.username, needed: repairCost, have: ps.gold || 0 });
      return { cancelled: true };
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

    if (destTargets.length === 0) return { cancelled: true };

    const destIds = await engine.promptEffectTarget(pi, destTargets, {
      maxTotal: 1,   // Einfachauswahl: ein Klick TAUSCHT das Ziel
      title: `Cool Repair — Equip ${equipName}`,
      source: 'Cool Repair', // Skript-Dispatch trotz dynamischem Titel
      description: `Select a Support Zone to equip ${equipName} to. (Cost: ${repairCost}G)`,
      confirmLabel: '🔧 Equip!',
      confirmClass: 'btn-info',
      cancellable: true,
      greenSelect: true,
      exclusiveTypes: false,
      maxPerType: { hero: 1, equip: 1 },
    });

    if (!destIds || destIds.length === 0) return { cancelled: true };

    const dest = destTargets.find(t => t.id === destIds[0]);
    if (!dest) return { cancelled: true };

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
      if (destSlot === undefined) return { cancelled: true };
    }

    // Final validation: slot still free?
    if (((ps.supportZones[destHeroIdx] || [])[destSlot] || []).length > 0) return { cancelled: true };

    // ── Step 4: Deduct dynamic gold cost ──
    if (repairCost > 0) {
      await engine._payCardCost(pi, repairCost);
      engine.log('gold_spend', { player: ps.username, amount: repairCost, total: ps.gold, for: 'Cool Repair' });
    }

    // ── Step 5: Remove equip from discard pile ──
    const _taken_discardIdx = await engine.takeFromPile(ps, 'discard', equipName, { source: 'cool-repair' });   // v820: Stapel-Schicht
    if (!_taken_discardIdx) return { cancelled: true };

    // ── Step 6: Place equip in support zone ──
    if (!ps.supportZones[destHeroIdx]) ps.supportZones[destHeroIdx] = [[], [], []];
    if (!ps.supportZones[destHeroIdx][destSlot]) ps.supportZones[destHeroIdx][destSlot] = [];
    ps.supportZones[destHeroIdx][destSlot].push(equipName);

    // Track as card instance
    const inst = engine._trackCard(equipName, pi, 'support', destHeroIdx, destSlot);
    // v668: Herkunftsmarke — Cool Tech Jetpack bleibt NUR liegen, wenn es
    // ueber Cool Repair kam („except with the effect of Cool Repair").
    inst.counters._viaCoolRepair = true;

    engine.sync();

    // ── Step 7: Staggered 💥 explosion animation on the equipped zone ──
    // Awaited rather than scheduled via setTimeout so the broadcasts
    // can't leak past an MCTS rollout boundary (see Treasure Hunter's
    // Backpack for the full rationale — same pattern, same bug class).
    const broadcastExplosion = () => engine._broadcastEvent('play_zone_animation', {
      type: 'explosion', owner: pi,
      heroIdx: destHeroIdx, zoneSlot: destSlot,
    });
    broadcastExplosion();
    await engine._delay(200);
    broadcastExplosion();
    await engine._delay(250);
    broadcastExplosion();
    await engine._delay(250);
    broadcastExplosion();
    await engine._delay(700);

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
