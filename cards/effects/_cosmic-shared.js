// ═══════════════════════════════════════════
//  Shared helpers for the Cosmic Depths
//  archetype.
//
//  CHANGE COUNTERS
//  ───────────────
//  A generic numeric counter used by Analyzer,
//  Gatherer, and Argos as accumulators, and read
//  by Cosmic Manipulation, Cosmic Malfunction,
//  and Invader Token. Stored as:
//    • `inst.counters.changeCounter` on Creatures
//    • `hero._changeCounters` on Heroes
//  Both surfaces use the same `getChangeCounters`
//  / `setChangeCounters` helpers so callers don't
//  have to branch on hero vs creature.
//
//  COSMIC CARD GATE
//  ────────────────
//  Some cards (Invader, Life-Searcher) only fire
//  their on-summon trigger when summoned BY a
//  "Cosmic" card. The literal-substring check
//  excludes Argos ("Cosmos"). Effects that summon
//  CD Creatures should pass `_summonedByCosmic:
//  true` and `_summonedBy: <sourceCardName>` in
//  their summon helper's hookExtras so the target
//  can detect it.
//
//  Invader's hand-summon block is enforced by
//  `canSummonInvaderViaSource` — every CD card
//  that places/summons checks this BEFORE
//  including Invader in its picker.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

// ─── ARCHETYPE NAMES ────────────────────────

// Living card names in the archetype. Used by Argos's "place a CD
// Creature" picker, Arrival's eligibility scan, Life-Searcher's tutor,
// etc.
const COSMIC_DEPTHS_CREATURES = new Set([
  'Analyzer from the Cosmic Depths',
  'Gatherer from the Cosmic Depths',
  'Life-Searcher from the Cosmic Depths',
  'Invader from the Cosmic Depths',
]);

// All non-token Cosmic Depths cards (used by Life-Searcher's "search
// any CD card" tutor).
const COSMIC_DEPTHS_ANY = new Set([
  ...COSMIC_DEPTHS_CREATURES,
  'Argos, the Eye of the Cosmos',
  'Arrival from the Cosmic Depths',
  'Cosmic Manipulation',
  'Cosmic Malfunction',
  'The Cosmic Depths',
  // 'Invader Token' is a Token spawned by effects — never in deck.
]);

const INVADER_NAME = 'Invader from the Cosmic Depths';
const INVADER_TOKEN_NAME = 'Invader Token';

// Cards that can place Change Counters onto themselves via their own
// passive trigger (opp draws/adds → +1). Cosmic Manipulation's payoff
// "place a Change Counter on a card you control that can place Change
// Counters onto itself" routes to this set.
const SELF_COUNTERING_CARDS = new Set([
  'Analyzer from the Cosmic Depths',
  'Gatherer from the Cosmic Depths',
  'Argos, the Eye of the Cosmos',
]);

// ─── PREDICATES ─────────────────────────────

/**
 * Strict literal-substring test for the "Cosmic" card gate. "Cosmos"
 * (Argos) does NOT qualify — only names containing "Cosmic" exactly.
 */
function isCosmicCard(name) {
  if (!name) return false;
  return name.includes('Cosmic');
}

/**
 * Whether a CD Creature can be summoned/placed via this source. Right
 * now only Invader is restricted (must be summoned by a Cosmic card),
 * but the helper centralizes the rule so future restrictions slot in
 * cleanly. `sourceCardName` is the name of the card whose effect is
 * doing the placing/summoning.
 */
function canSummonInvaderViaSource(targetName, sourceCardName) {
  if (targetName !== INVADER_NAME) return true;
  return isCosmicCard(sourceCardName);
}

/**
 * Live, non-face-down Cosmic Depths Creature instances controlled by pi.
 */
function ownCosmicCreatures(engine, pi) {
  const out = [];
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support') continue;
    if (inst.faceDown) continue;
    const owner = inst.controller ?? inst.owner;
    if (owner !== pi) continue;
    if (!COSMIC_DEPTHS_CREATURES.has(inst.name)) continue;
    out.push(inst);
  }
  return out;
}

// ─── CHANGE COUNTER HELPERS ─────────────────

/**
 * Get the current Change Counter total on a target. Target may be a
 * Hero object (uses `_changeCounters`) or a CardInstance (uses
 * `counters.changeCounter`).
 */
function getChangeCounters(target) {
  if (!target) return 0;
  // Heroes have a `name` and a `hp` field but no `counters` bag at the
  // root. Use the presence of `hp` as the discriminator.
  if (target.hp !== undefined && !target.counters) {
    return target._changeCounters || 0;
  }
  if (target.counters) {
    return target.counters.changeCounter || 0;
  }
  return 0;
}

function setChangeCounters(target, n) {
  if (!target) return;
  const safe = Math.max(0, n | 0);
  if (target.hp !== undefined && !target.counters) {
    if (safe === 0) delete target._changeCounters;
    else target._changeCounters = safe;
    return;
  }
  if (target.counters) {
    if (safe === 0) delete target.counters.changeCounter;
    else target.counters.changeCounter = safe;
  }
}

/**
 * Add `n` Change Counters to a target. Plays the "+counter" zone
 * animation on the target's slot. Targets that aren't a Hero or
 * Creature inst are silently ignored (defensive).
 */
function addChangeCounters(engine, target, n, opts = {}) {
  if (!target || n <= 0) return;
  const cur = getChangeCounters(target);
  setChangeCounters(target, cur + n);

  // Animate on the target's zone. Hero targets paint at the hero zone
  // (zoneSlot=-1); creature targets paint at the support slot.
  const owner = targetOwner(engine, target);
  if (owner == null) return;
  if (target.hp !== undefined && !target.counters) {
    // Hero
    const heroIdx = engine.gs.players[owner].heroes.indexOf(target);
    if (heroIdx < 0) return;
    engine._broadcastEvent('play_zone_animation', {
      type: 'cosmic_counter_add',
      owner, heroIdx, zoneSlot: -1,
    });
  } else {
    // Creature inst
    engine._broadcastEvent('play_zone_animation', {
      type: 'cosmic_counter_add',
      owner: target.owner,
      heroIdx: target.heroIdx,
      zoneSlot: target.zoneSlot,
    });
  }
  if (!opts.skipLog) {
    engine.log('cosmic_counter_add', {
      target: target.name, amount: n, total: cur + n,
    });
  }
}

/**
 * Remove `n` Change Counters from a target. Clamps to current count.
 * Returns the actual number removed.
 */
function removeChangeCounters(engine, target, n, opts = {}) {
  if (!target || n <= 0) return 0;
  const cur = getChangeCounters(target);
  const removed = Math.min(cur, n);
  if (removed <= 0) return 0;
  setChangeCounters(target, cur - removed);

  const owner = targetOwner(engine, target);
  if (owner != null) {
    if (target.hp !== undefined && !target.counters) {
      const heroIdx = engine.gs.players[owner].heroes.indexOf(target);
      if (heroIdx >= 0) {
        engine._broadcastEvent('play_zone_animation', {
          type: 'cosmic_counter_remove',
          owner, heroIdx, zoneSlot: -1,
        });
      }
    } else {
      engine._broadcastEvent('play_zone_animation', {
        type: 'cosmic_counter_remove',
        owner: target.owner, heroIdx: target.heroIdx, zoneSlot: target.zoneSlot,
      });
    }
  }
  if (!opts.skipLog) {
    engine.log('cosmic_counter_remove', {
      target: target.name, amount: removed, remaining: cur - removed,
    });
  }
  return removed;
}

/**
 * Move up to `n` Change Counters from one target to another. Clamps to
 * the source's current count. Returns the number moved.
 */
function moveChangeCounters(engine, fromTarget, toTarget, n) {
  if (!fromTarget || !toTarget || n <= 0) return 0;
  const removed = removeChangeCounters(engine, fromTarget, n, { skipLog: true });
  if (removed <= 0) return 0;
  addChangeCounters(engine, toTarget, removed, { skipLog: true });
  engine.log('cosmic_counter_move', {
    from: fromTarget.name, to: toTarget.name, amount: removed,
  });
  return removed;
}

/** Player index that owns the target (hero-side for heroes, raw owner for insts). */
function targetOwner(engine, target) {
  if (!target) return null;
  if (target.hp !== undefined && !target.counters) {
    for (let pi = 0; pi < 2; pi++) {
      const ps = engine.gs.players[pi];
      if ((ps?.heroes || []).includes(target)) return pi;
    }
    return null;
  }
  return target.owner ?? null;
}

/**
 * All board targets that currently hold any Change Counters. Used by
 * Invader Token's end-of-turn check (specifically: filtered to a side)
 * and as a generic "where can counters be moved from?" picker source.
 */
function allChangeCounterTargets(engine) {
  const out = [];
  // Heroes
  for (let pi = 0; pi < 2; pi++) {
    const ps = engine.gs.players[pi];
    if (!ps) continue;
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const h = ps.heroes[hi];
      if (!h?.name || h.hp <= 0) continue;
      if ((h._changeCounters || 0) > 0) {
        out.push({ kind: 'hero', owner: pi, heroIdx: hi, ref: h, count: h._changeCounters });
      }
    }
  }
  // Creatures
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support') continue;
    if (inst.faceDown) continue;
    const c = inst.counters?.changeCounter || 0;
    if (c > 0) {
      out.push({
        kind: 'creature', owner: inst.owner, heroIdx: inst.heroIdx,
        slotIdx: inst.zoneSlot, ref: inst, count: c,
      });
    }
  }
  return out;
}

/** All cards on `pi`'s side that currently hold any Change Counters. */
function changeCounterCardsOnSide(engine, pi) {
  return allChangeCounterTargets(engine).filter(t => t.owner === pi);
}

/**
 * Every BOARD CARD eligible as a counter-move target — regardless of
 * whether it currently holds counters. Both sides included. Used by
 * Analyzer's "move to another card on the board" picker.
 */
function allBoardTargets(engine) {
  const out = [];
  for (let pi = 0; pi < 2; pi++) {
    const ps = engine.gs.players[pi];
    if (!ps) continue;
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const h = ps.heroes[hi];
      if (!h?.name || h.hp <= 0) continue;
      out.push({ kind: 'hero', owner: pi, heroIdx: hi, ref: h });
    }
  }
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support') continue;
    if (inst.faceDown) continue;
    out.push({
      kind: 'creature', owner: inst.owner, heroIdx: inst.heroIdx,
      slotIdx: inst.zoneSlot, ref: inst,
    });
  }
  return out;
}

/** Find a target's display name for prompts/logs. */
function targetDisplayName(engine, t) {
  if (!t) return '?';
  if (t.kind === 'hero') return t.ref?.name || `Hero ${t.heroIdx + 1}`;
  return t.ref?.name || 'Creature';
}

/** Convert a counter target descriptor into a `promptEffectTarget` entry. */
function targetToPromptEntry(t) {
  if (t.kind === 'hero') {
    return { id: `hero-${t.owner}-${t.heroIdx}`, type: 'hero', owner: t.owner, heroIdx: t.heroIdx, cardName: t.ref?.name };
  }
  return {
    id: `equip-${t.owner}-${t.heroIdx}-${t.slotIdx}`, type: 'equip',
    owner: t.owner, heroIdx: t.heroIdx, slotIdx: t.slotIdx,
    cardName: t.ref?.name, cardInstance: t.ref,
  };
}

module.exports = {
  COSMIC_DEPTHS_CREATURES,
  COSMIC_DEPTHS_ANY,
  SELF_COUNTERING_CARDS,
  INVADER_NAME,
  INVADER_TOKEN_NAME,
  isCosmicCard,
  canSummonInvaderViaSource,
  ownCosmicCreatures,
  getChangeCounters,
  setChangeCounters,
  addChangeCounters,
  removeChangeCounters,
  moveChangeCounters,
  allChangeCounterTargets,
  changeCounterCardsOnSide,
  allBoardTargets,
  targetDisplayName,
  targetToPromptEntry,
};
