// ═══════════════════════════════════════════
//  SHARED — Mischief Militia archetype
//
//  Frozen-themed Decay / Summoning Magic family.
//  Helpers centralise the recurring questions:
//    • how many targets on the board are Frozen?
//    • is a card a Mischief Militia Creature?
//    • can a given creature instance be Frozen?
//    • Bear Rider's dynamic in-hand level offset.
//  Per-card scripts stay thin and consume these.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const ARCHETYPE = 'Mischief Militia';
const BEAR_RIDER_NAME = 'Mischief Militia - Bear Rider';

/**
 * Is this card an MM Creature? `cd.subtype === 'Creature'` matters for
 * tokens (e.g. Creature/Token) — we use `hasCardType` so subtype-creatures
 * pass too.
 */
function isMischiefMilitiaCreature(cd) {
  if (!cd) return false;
  if (cd.archetype !== ARCHETYPE) return false;
  return hasCardType(cd, 'Creature');
}

/**
 * Count of Frozen targets on the board (heroes + creatures, both sides).
 * Heroes wear `hero.statuses.frozen`; creatures wear `inst.counters.frozen`.
 * Face-down surprise creatures cannot carry the status — they're skipped
 * via `inst.faceDown`.
 *
 * Pass `opts.side = pi` to restrict to one player's side.
 */
function countFrozenTargets(engine, opts = {}) {
  if (!engine) return 0;
  let n = 0;
  const sides = opts.side != null ? [opts.side] : [0, 1];
  for (const pi of sides) {
    const ps = engine.gs.players[pi];
    if (!ps) continue;
    for (const hero of (ps.heroes || [])) {
      if (!hero?.name) continue;
      if (hero.hp <= 0) continue;
      if (hero.statuses?.frozen) n++;
    }
  }
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support') continue;
    if (inst.faceDown) continue;
    if (opts.side != null) {
      const ctrl = inst.controller ?? inst.owner;
      if (ctrl !== opts.side) continue;
    }
    if (inst.counters?.frozen) n++;
  }
  return n;
}

/**
 * Enumerate every Frozen target as a picker-ready object. Mirrors the
 * shape `promptDamageTarget` builds so callers can hand the list to a
 * generic effect picker without rebuilding.
 *
 *   opts.side    — restrict to one player's side (controller match).
 *   opts.heroes  — include heroes (default true).
 *   opts.creatures — include creatures (default true).
 */
function enumerateFrozenTargets(engine, opts = {}) {
  if (!engine) return [];
  const wantHeroes = opts.heroes !== false;
  const wantCreatures = opts.creatures !== false;
  const out = [];
  const sides = opts.side != null ? [opts.side] : [0, 1];

  if (wantHeroes) {
    for (const pi of sides) {
      const ps = engine.gs.players[pi];
      if (!ps) continue;
      for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
        const hero = ps.heroes[hi];
        if (!hero?.name || hero.hp <= 0) continue;
        if (!hero.statuses?.frozen) continue;
        out.push({
          id: `hero-${pi}-${hi}`,
          type: 'hero',
          owner: pi,
          heroIdx: hi,
          cardName: hero.name,
        });
      }
    }
  }

  if (wantCreatures) {
    for (const inst of engine.cardInstances) {
      if (inst.zone !== 'support') continue;
      if (inst.faceDown) continue;
      if (!inst.counters?.frozen) continue;
      if (opts.side != null) {
        const ctrl = inst.controller ?? inst.owner;
        if (ctrl !== opts.side) continue;
      }
      out.push({
        id: `equip-${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`,
        type: 'equip',
        owner: inst.owner,
        heroIdx: inst.heroIdx,
        slotIdx: inst.zoneSlot,
        cardName: inst.name,
        cardInstance: inst,
      });
    }
  }
  return out;
}

/**
 * Enumerate every target that is currently NOT Frozen but could be
 * targeted by a Freeze. Heroes pass when not already Frozen / not
 * freeze_immune / not negative-status-immune. Creatures pass the
 * TARGETING-side gate (`canTargetForStatus`) — omni-immune creatures
 * (Cardinal Beasts etc.) stay in the pool so they're selectable, the
 * animation plays, and the actual Freeze application fizzles
 * silently. Used by Mischief Invasion / The White Army.
 */
function enumerateFreezableNonFrozenTargets(engine, opts = {}) {
  if (!engine) return [];
  const wantHeroes = opts.heroes !== false;
  const wantCreatures = opts.creatures !== false;
  const out = [];
  const sides = opts.side != null ? [opts.side] : [0, 1];

  if (wantHeroes) {
    for (const pi of sides) {
      const ps = engine.gs.players[pi];
      if (!ps) continue;
      for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
        const hero = ps.heroes[hi];
        if (!hero?.name || hero.hp <= 0) continue;
        if (hero.statuses?.frozen) continue;
        if (hero.statuses?.freeze_immune) continue;
        // Smug / negative-status-immune buff blocks Freeze entirely.
        if (hero.buffs?.negative_status_immune) continue;
        out.push({
          id: `hero-${pi}-${hi}`,
          type: 'hero',
          owner: pi,
          heroIdx: hi,
          cardName: hero.name,
        });
      }
    }
  }

  if (wantCreatures) {
    for (const inst of engine.cardInstances) {
      if (inst.zone !== 'support') continue;
      if (inst.faceDown) continue;
      if (inst.counters?.frozen) continue;
      if (opts.side != null) {
        const ctrl = inst.controller ?? inst.owner;
        if (ctrl !== opts.side) continue;
      }
      if (!engine.canTargetForStatus(inst, 'frozen')) continue;
      out.push({
        id: `equip-${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`,
        type: 'equip',
        owner: inst.owner,
        heroIdx: inst.heroIdx,
        slotIdx: inst.zoneSlot,
        cardName: inst.name,
        cardInstance: inst,
      });
    }
  }
  return out;
}

/**
 * Apply Freeze to a single target descriptor. Centralises the
 * hero-vs-creature split + animation broadcast so MM cards never
 * re-implement it.
 *
 *   engine — engine instance
 *   target — picker entry: { type:'hero'|'equip', owner, heroIdx, slotIdx?, cardInstance? }
 *   duration — hero freeze duration (turns). Creatures store a boolean
 *              `counters.frozen` plus optional `counters.frozenDuration`.
 *   appliedBy — player index of the freezer (for "frozen by opp" gates).
 */
async function applyFreezeToTarget(engine, target, duration, appliedBy) {
  if (!engine || !target) return false;
  if (target.type === 'hero') {
    const hero = engine.gs.players[target.owner]?.heroes?.[target.heroIdx];
    if (!hero || hero.hp <= 0) return false;
    await engine.addHeroStatus(target.owner, target.heroIdx, 'frozen', {
      appliedBy,
      duration,
      animationType: 'freeze',
    });
    return true;
  }
  const inst = target.cardInstance || engine.cardInstances.find(c =>
    c.owner === target.owner && c.zone === 'support'
    && c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx
  );
  if (!inst) return false;
  // applyCreatureStatus handles immunity + onStatusApplied hook fire.
  return await engine.applyCreatureStatus(inst, 'frozen', {
    duration,
    sourceOwner: appliedBy,
    source: 'MM',
    animationType: 'ice_encase',
  });
}

/**
 * Heal-from-Freeze on a creature: clear `counters.frozen` (and the
 * paired duration counter) and emit a status-removal broadcast. Used
 * by Thaw Blader.
 */
function cleanseFreezeFromCreature(engine, inst, sourceName) {
  if (!engine || !inst) return false;
  if (!inst.counters?.frozen) return false;
  engine.cleanseCreatureStatuses(inst, ['frozen'], sourceName || 'Thaw');
  return true;
}

/**
 * Count Creatures (any subtype) the player controls on the board.
 * Subtype-Creatures (Pollution Spewer etc.) are counted via `hasCardType`.
 */
function countOwnCreatures(engine, pi) {
  if (!engine) return 0;
  const cardDB = engine._getCardDB();
  let n = 0;
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support') continue;
    if (inst.faceDown) continue;
    const ctrl = inst.controller ?? inst.owner;
    if (ctrl !== pi) continue;
    const cd = inst.counters?._cardDataOverride || cardDB[inst.name]; // token-override-aware (Biomancy Token — Als AoE-Report)
    if (!cd) continue;
    if (!hasCardType(cd, 'Creature')) continue;
    n++;
  }
  return n;
}

/**
 * Count own-side Lv0 Creatures. Numeric-level only — subtype-Creatures
 * with `level: null` are excluded (mirrors The White Army's "level 0
 * Creatures" reading).
 */
function countOwnLv0Creatures(engine, pi) {
  if (!engine) return 0;
  const cardDB = engine._getCardDB();
  let n = 0;
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support') continue;
    if (inst.faceDown) continue;
    const ctrl = inst.controller ?? inst.owner;
    if (ctrl !== pi) continue;
    const cd = inst.counters?._cardDataOverride || cardDB[inst.name]; // token-override-aware (Biomancy Token — Als AoE-Report)
    if (!cd) continue;
    if (!hasCardType(cd, 'Creature')) continue;
    if ((cd.level ?? -1) !== 0) continue;
    n++;
  }
  return n;
}

// ═══════════════════════════════════════════
//  BEAR RIDER — dynamic in-hand level offset
//
//  Bear Rider's card text reads: "This card's level in your hand is
//  reduced by 1 for every Frozen target on the board." We honour that
//  by writing into the registered `_handLevelOffsetsTransient` map,
//  which the engine's level-req gate AND the frontend hand-card display
//  read in lockstep. Transient (drops on splice / summon) is correct
//  because the reduction only applies WHILE the card is in hand.
//
//  Recompute strategy:
//    • Listen on `onStatusApplied` / `onStatusRemoved` / `onCreatureDeath`
//      / `onHeroKO` / `onCardEnterZone` from Bear Rider's hooks block
//      (with `activeIn: ['hand', 'support']` so the listener fires from
//      hand-tracked instances).
//    • Each fire calls `recomputeBearRiderHandLevel(engine, pi)` for
//      both players, which re-scans the hand and rewrites offsets.
//    • Offsets clamp at -baseLevel so Bear Rider never goes negative
//      and the engine's `Math.max(0, …)` floor never reads weird math.
//    • Sparkfly Queen interaction: we last-writer-wins on the same hand
//      index. SQ rebates a flat -3; we rewrite. Edge case is acceptable.
// ═══════════════════════════════════════════

/**
 * Rewrite Bear Rider's transient hand-level offsets for `pi` to match
 * the current Frozen-target count. Idempotent.
 */
function recomputeBearRiderHandLevel(engine, pi) {
  if (!engine) return;
  const ps = engine.gs.players[pi];
  if (!ps?.hand) return;
  const frozenCount = countFrozenTargets(engine);
  const cardDB = engine._getCardDB();
  const baseLevel = cardDB[BEAR_RIDER_NAME]?.level ?? 2;
  const desired = -Math.min(frozenCount, baseLevel);
  if (!ps._handLevelOffsetsTransient) ps._handLevelOffsetsTransient = {};

  // Pass 1: every Bear Rider index gets `desired` (or no entry if 0).
  for (let i = 0; i < ps.hand.length; i++) {
    if (ps.hand[i] !== BEAR_RIDER_NAME) continue;
    if (desired === 0) {
      delete ps._handLevelOffsetsTransient[i];
    } else {
      ps._handLevelOffsetsTransient[i] = desired;
    }
  }
}

/** Recompute Bear Rider offsets for BOTH players. Most hooks need this
 *  (Frozen count is global). */
function recomputeBearRiderHandLevelAllPlayers(engine) {
  if (!engine) return;
  recomputeBearRiderHandLevel(engine, 0);
  recomputeBearRiderHandLevel(engine, 1);
}

module.exports = {
  ARCHETYPE,
  BEAR_RIDER_NAME,
  isMischiefMilitiaCreature,
  countFrozenTargets,
  enumerateFrozenTargets,
  enumerateFreezableNonFrozenTargets,
  applyFreezeToTarget,
  cleanseFreezeFromCreature,
  countOwnCreatures,
  countOwnLv0Creatures,
  recomputeBearRiderHandLevel,
  recomputeBearRiderHandLevelAllPlayers,
};
