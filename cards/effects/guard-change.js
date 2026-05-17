// ═══════════════════════════════════════════
//  CARD EFFECT: "Guard Change"
//  Spell (Support Magic, Lv1, Normal)
//
//  "Choose any number of Creatures you control (min. 1) and place
//   them into free Support Zones of other Heroes you control. You can
//   also swap Creatures between Heroes you control. If the user has
//   at least Support Magic 2, this counts as an additional Action.
//   You can only play 1 "Guard Change" per turn."
//
//  ── Movement system ─────────────────────────────────────────────
//  A broader cousin of the Slippery archetype's interactive mover
//  (`_slippery-shared`): same click-a-Creature → click-a-destination
//  flow and `play_card_transfer` flight, but
//    • destinations are NOT restricted to neighbouring Heroes — any
//      free Support Zone on ANY OTHER Hero you control is legal;
//    • a Creature may instead be SWAPPED with another Creature on a
//      different Hero (both fly to their new zones simultaneously);
//    • each Creature may only be moved OR swapped once per cast.
//  Driven by the `guardChangeMove` prompt (frontend reuses the
//  Slippery render path, extended with swap highlighting).
//
//  ── Action economy ──────────────────────────────────────────────
//  "If the user has at least Support Magic 2, this counts as an
//   additional Action." Modelled exactly like Shapeshift: dynamic
//   `inherentAction` (Main-Phase self-provide) + `_spellFreeAction`
//   (Action-Phase slot refund) when the casting Hero's Support Magic
//   level ≥ 2 (Performance on Support Magic counts via the engine
//   helper).
//
//  "You can only play 1 Guard Change per turn" — the HOPT registry
//  (`guard-change:<pi>`), claimed only AFTER ≥1 Creature actually
//  moved so a min-1 cancel doesn't burn the turn's use.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Guard Change';
const HOPT_KEY  = 'guard-change';

/** Casting Hero's Support Magic level (base + Performance wildcard). */
function supportMagicLevel(engine, pi, heroIdx) {
  if (!engine || heroIdx == null || heroIdx < 0) return 0;
  const abZones = engine.gs.players[pi]?.abilityZones?.[heroIdx] || [];
  return engine.countAbilitiesForSchool('Support Magic', abZones);
}

/** Own support-zone CREATURE instances (NOT Equip Artifacts, which
 *  also live in Support Zones). Mirrors the engine's own
 *  support-creature gate: skip `treatAsEquip` and require an
 *  effective cardType of Creature. */
function ownSupportCreatures(engine, pi) {
  const cardDB = engine._getCardDB();
  const out = [];
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support' || inst.faceDown) continue;
    if ((inst.controller ?? inst.owner) !== pi) continue;
    if (inst.counters?.treatAsEquip) continue; // Equip Artifact, not a Creature
    const cd = engine.getEffectiveCardData(inst) || cardDB[inst.name];
    if (!cd || !hasCardType(cd, 'Creature')) continue;
    out.push(inst);
  }
  return out;
}

/** Free Support slots on every OTHER Hero (any column — not
 *  neighbour-restricted). Heroes are columns; dead/empty columns
 *  still count (Creatures are independent of their Hero). */
function destsFor(engine, pi, inst) {
  const ps = engine.gs.players[pi];
  const out = [];
  for (let hi = 0; hi < 3; hi++) {
    if (hi === inst.heroIdx) continue;             // "other Heroes"
    const zones = ps.supportZones?.[hi] || [[], [], []];
    for (let zi = 0; zi < 3; zi++) {
      if ((zones[zi] || []).length === 0) out.push({ heroIdx: hi, slotIdx: zi });
    }
  }
  return out;
}

/**
 * Build the movable-Creature list for the prompt. `movedIds` =
 * Creatures already moved/swapped this cast (each only once).
 */
function collectMovable(engine, pi, movedIds) {
  const creatures = ownSupportCreatures(engine, pi).filter(c => !movedIds.has(c.id));
  const list = [];
  for (const inst of creatures) {
    const dests = destsFor(engine, pi, inst);
    // Swap partners: another not-yet-moved own Creature on a
    // DIFFERENT Hero ("swap Creatures between Heroes you control").
    const swaps = creatures
      .filter(o => o.id !== inst.id && o.heroIdx !== inst.heroIdx)
      .map(o => o.id);
    if (dests.length === 0 && swaps.length === 0) continue;
    list.push({ inst, dests, swaps });
  }
  return list;
}

/** Single move: `inst` → a free slot on another Hero. Mirrors the
 *  Slippery mover's animation/flow (creature_zone_move floater
 *  suppression + play_card_transfer flight + _isMove enter hook). */
async function moveCreature(engine, pi, inst, destHeroIdx, destSlot) {
  const ps = engine.gs.players[pi];
  const sH = inst.heroIdx, sS = inst.zoneSlot;
  const sArr = (ps.supportZones?.[sH] || [])[sS] || [];
  const sIdx = sArr.indexOf(inst.name);
  if (sIdx < 0) return false;
  if (((ps.supportZones?.[destHeroIdx] || [])[destSlot] || []).length > 0) return false;

  engine._broadcastEvent('creature_zone_move', { owner: pi, heroIdx: sH, zoneSlot: sS });
  sArr.splice(sIdx, 1);
  engine._broadcastEvent('play_card_transfer', {
    sourceOwner: pi, sourceHeroIdx: sH, sourceZoneSlot: sS,
    targetOwner: pi, targetHeroIdx: destHeroIdx, targetZoneSlot: destSlot,
    cardName: inst.name, duration: 500, particles: null,
  });
  engine.sync();
  await engine._delay(420);

  if (!ps.supportZones[destHeroIdx]) ps.supportZones[destHeroIdx] = [[], [], []];
  if (!ps.supportZones[destHeroIdx][destSlot]) ps.supportZones[destHeroIdx][destSlot] = [];
  ps.supportZones[destHeroIdx][destSlot].push(inst.name);
  inst.heroIdx = destHeroIdx;
  inst.zoneSlot = destSlot;
  engine.sync();

  await engine.runHooks('onCardEnterZone', {
    enteringCard: inst, toZone: 'support', toHeroIdx: destHeroIdx,
    _skipReactionCheck: true, _isMove: true,
  });
  return true;
}

/** Swap two Creatures on different Heroes — BOTH fly to their new
 *  zones at the same time (both transfers broadcast before the
 *  shared delay, then both placed). */
async function swapCreatures(engine, pi, a, b) {
  const ps = engine.gs.players[pi];
  const aH = a.heroIdx, aS = a.zoneSlot, bH = b.heroIdx, bS = b.zoneSlot;
  const aArr = (ps.supportZones?.[aH] || [])[aS] || [];
  const bArr = (ps.supportZones?.[bH] || [])[bS] || [];
  const aIdx = aArr.indexOf(a.name);
  const bIdx = bArr.indexOf(b.name);
  if (aIdx < 0 || bIdx < 0) return false;

  engine._broadcastEvent('creature_zone_move', { owner: pi, heroIdx: aH, zoneSlot: aS });
  engine._broadcastEvent('creature_zone_move', { owner: pi, heroIdx: bH, zoneSlot: bS });
  aArr.splice(aIdx, 1);
  bArr.splice(bIdx, 1);
  // Simultaneous: A → B's slot, B → A's slot (both overlays animate
  // concurrently — onCardTransfer keys each by a unique id).
  engine._broadcastEvent('play_card_transfer', {
    sourceOwner: pi, sourceHeroIdx: aH, sourceZoneSlot: aS,
    targetOwner: pi, targetHeroIdx: bH, targetZoneSlot: bS,
    cardName: a.name, duration: 500, particles: null,
  });
  engine._broadcastEvent('play_card_transfer', {
    sourceOwner: pi, sourceHeroIdx: bH, sourceZoneSlot: bS,
    targetOwner: pi, targetHeroIdx: aH, targetZoneSlot: aS,
    cardName: b.name, duration: 500, particles: null,
  });
  engine.sync();
  await engine._delay(420);

  if (!ps.supportZones[bH]) ps.supportZones[bH] = [[], [], []];
  if (!ps.supportZones[bH][bS]) ps.supportZones[bH][bS] = [];
  if (!ps.supportZones[aH]) ps.supportZones[aH] = [[], [], []];
  if (!ps.supportZones[aH][aS]) ps.supportZones[aH][aS] = [];
  ps.supportZones[bH][bS].push(a.name);
  a.heroIdx = bH; a.zoneSlot = bS;
  ps.supportZones[aH][aS].push(b.name);
  b.heroIdx = aH; b.zoneSlot = aS;
  engine.sync();

  await engine.runHooks('onCardEnterZone', {
    enteringCard: a, toZone: 'support', toHeroIdx: bH,
    _skipReactionCheck: true, _isMove: true,
  });
  await engine.runHooks('onCardEnterZone', {
    enteringCard: b, toZone: 'support', toHeroIdx: aH,
    _skipReactionCheck: true, _isMove: true,
  });
  return true;
}

/**
 * Interactive Guard Change mode. Returns the number of distinct
 * Creatures repositioned (0 ⇒ caller cancels the Spell for min-1).
 */
async function runGuardChangeMode(engine, pi) {
  const movedIds = new Set();

  if (engine.isCpuPlayer && engine.isCpuPlayer(pi)) {
    // Lightweight CPU: one reposition so the cast isn't wasted, then
    // stop. Positional value is low; a deeper heuristic isn't worth
    // the MCTS cost here.
    const list = collectMovable(engine, pi, movedIds);
    const moveEntry = list.find(e => e.dests.length > 0);
    if (moveEntry) {
      const d = moveEntry.dests[0];
      if (await moveCreature(engine, pi, moveEntry.inst, d.heroIdx, d.slotIdx)) {
        movedIds.add(moveEntry.inst.id);
      }
    } else {
      const swapEntry = list.find(e => e.swaps.length > 0);
      if (swapEntry) {
        const partner = engine.cardInstances.find(c => c.id === swapEntry.swaps[0]);
        if (partner && await swapCreatures(engine, pi, swapEntry.inst, partner)) {
          movedIds.add(swapEntry.inst.id);
          movedIds.add(partner.id);
        }
      }
    }
    return movedIds.size;
  }

  for (let iter = 0; iter < 64; iter++) {
    const list = collectMovable(engine, pi, movedIds);
    if (list.length === 0) break;

    const result = await engine.promptGeneric(pi, {
      type: 'guardChangeMove',
      title: CARD_NAME,
      description: 'Move Creatures into free Support Zones of your other Heroes, or swap two Creatures between Heroes.',
      creatures: list.map(e => ({
        instId: e.inst.id,
        name: e.inst.name,
        heroIdx: e.inst.heroIdx,
        zoneSlot: e.inst.zoneSlot,
        dests: e.dests.map(d => ({ heroIdx: d.heroIdx, slotIdx: d.slotIdx })),
        swaps: e.swaps,
      })),
      doneLabel: movedIds.size > 0 ? '✓ Done' : '✕ Cancel',
      cancellable: false,
    });
    if (!result || result.done) break;

    const { instId, destHeroIdx, destSlot, swapWithInstId } = result;
    const entry = list.find(e => e.inst.id === instId);
    if (!entry) continue;

    if (swapWithInstId != null) {
      if (!entry.swaps.includes(swapWithInstId)) continue;
      const partner = list.find(e => e.inst.id === swapWithInstId)?.inst;
      if (!partner) continue;
      if (await swapCreatures(engine, pi, entry.inst, partner)) {
        movedIds.add(entry.inst.id);
        movedIds.add(partner.id);
      }
    } else if (destHeroIdx != null && destSlot != null) {
      if (!entry.dests.some(d => d.heroIdx === destHeroIdx && d.slotIdx === destSlot)) continue;
      if (await moveCreature(engine, pi, entry.inst, destHeroIdx, destSlot)) {
        movedIds.add(entry.inst.id);
      }
    }
  }
  return movedIds.size;
}

module.exports = {
  // "Counts as an additional Action" when the caster has Support
  // Magic ≥ 2 — Main-Phase self-provide (mirrors Shapeshift).
  inherentAction: (gs, pi, heroIdx, engine) => {
    if (!engine) return false;
    return supportMagicLevel(engine, pi, heroIdx) >= 2;
  },

  spellPlayCondition: (gs, pi, engine) => {
    // One Guard Change per turn.
    if (gs.hoptUsed?.[`${HOPT_KEY}:${pi}`] === gs.turn) return false;
    if (!engine) return true; // optimistic without engine
    return collectMovable(engine, pi, new Set()).length > 0;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      if (!ps) { gs._spellCancelled = true; return; }

      // Defensive: already used this turn (shouldn't be playable).
      if (gs.hoptUsed?.[`${HOPT_KEY}:${pi}`] === gs.turn) {
        gs._spellCancelled = true;
        return;
      }

      const movedCount = await runGuardChangeMode(engine, pi);

      // "min. 1" — nothing repositioned ⇒ the Spell does nothing;
      // return it to hand (no HOPT spent, no Action burned).
      if (movedCount === 0) {
        gs._spellCancelled = true;
        engine.log('guard_change_fizzle', { player: ps.username, reason: 'no_moves' });
        return;
      }

      // Commit the once-per-turn now that it actually did something.
      engine.claimHOPT(HOPT_KEY, pi);

      // Support Magic ≥ 2 → additional Action (Action-Phase refund;
      // the Main-Phase path is covered by `inherentAction` above).
      if (supportMagicLevel(engine, pi, ctx.cardHeroIdx) >= 2) {
        gs._spellFreeAction = true;
      }

      engine.log('guard_change', { player: ps.username, moved: movedCount });
      engine.sync();
    },
  },
};
