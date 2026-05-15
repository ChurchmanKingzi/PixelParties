// ═══════════════════════════════════════════
//  SHARED: "Lunatic" archetype helpers
//
//  The 5 "Lunatic Cycle" cards are Equipment
//  Artifacts that sit in a Hero's Support Zone.
//  Lunatic Golem / Lunatic Hawk gain tiered
//  effects based on the number of DIFFERENT
//  Lunatic Cycle cards on the board — counting
//  BOTH players' sides (designer-confirmed).
// ═══════════════════════════════════════════

const LUNATIC_CYCLE_NAMES = [
  'Lunatic Cycle - New Moon',
  'Lunatic Cycle - Crescent Moon',
  'Lunatic Cycle - Half Moon',
  'Lunatic Cycle - Gibbous Moon',
  'Lunatic Cycle - Full Moon',
];
const LUNATIC_CYCLE_SET = new Set(LUNATIC_CYCLE_NAMES);

/** Is `name` one of the 5 Lunatic Cycle equips? */
function isLunaticCycle(name) {
  return LUNATIC_CYCLE_SET.has(name);
}

/** Is this card data a "Lunatic" Creature (archetype Lunatic + Creature)? */
function isLunaticCreature(cd) {
  if (!cd) return false;
  if (cd.cardType !== 'Creature') return false;
  return (cd.archetype || '').trim().toLowerCase() === 'lunatic';
}

/**
 * Number of DIFFERENT Lunatic Cycle cards currently on the board,
 * counting BOTH sides (0–5). "On the board" = a Lunatic Cycle equip
 * instance sitting in a Support Zone.
 */
function countDistinctLunaticCycle(engine) {
  const seen = new Set();
  for (const inst of (engine.cardInstances || [])) {
    if (!inst || inst.zone !== 'support' || inst.faceDown) continue;
    if (LUNATIC_CYCLE_SET.has(inst.name)) seen.add(inst.name);
    if (seen.size === LUNATIC_CYCLE_NAMES.length) break;
  }
  return seen.size;
}

/**
 * How many copies of a specific Lunatic Cycle card are on the board
 * (either side). Used by the moon chain's play-conditions
 * ("only while there is at least 1 <previous moon> on the board").
 */
function lunaticCycleCountByName(engine, name) {
  let n = 0;
  for (const inst of (engine.cardInstances || [])) {
    if (inst && inst.zone === 'support' && !inst.faceDown && inst.name === name) n++;
  }
  return n;
}

/**
 * The host Hero of a Creature instance: the Hero whose Support Zones
 * the Creature occupies, on its physical (owner) side. Returns
 * { pi, hi, hero } or null.
 */
function hostHeroOf(engine, inst) {
  if (!inst || inst.heroIdx == null || inst.heroIdx < 0) return null;
  const pi = inst.owner;
  const hero = engine.gs?.players?.[pi]?.heroes?.[inst.heroIdx];
  if (!hero) return null;
  return { pi, hi: inst.heroIdx, hero };
}

module.exports = {
  LUNATIC_CYCLE_NAMES,
  isLunaticCycle,
  isLunaticCreature,
  countDistinctLunaticCycle,
  lunaticCycleCountByName,
  hostHeroOf,
};
