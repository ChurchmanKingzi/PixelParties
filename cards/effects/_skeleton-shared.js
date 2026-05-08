// ═══════════════════════════════════════════
//  SHARED HELPER: Skeleton archetype
//
//  Single source of truth for "is this card a
//  Skeleton Creature?". Mirrors the Deepsea
//  pattern (cards/effects/_deepsea-shared.js):
//  the canonical predicate any current or future
//  Skeleton-tribal card calls into, with per-card
//  archetype-override hard-codes for cards whose
//  rules text says "this Creature is also treated
//  as a Skeleton".
//
//  Current overrides:
//    • Loyal Bone Dog — its own card text reads
//      "This Creature is also treated as a
//      'Skeleton' Creature." Hard-coded here so
//      any Skeleton-tribal effect (Skeleton King
//      Skullmael's army count, Burning Skeleton's
//      tribe synergy, future "all your Skeletons
//      gain X" effects, etc.) sees Bone Dog
//      without needing its own special case.
// ═══════════════════════════════════════════

const SKELETON_ARCHETYPE = 'Skeletons';

// Names that count as Skeleton even though their
// `archetype` field doesn't say so. Add new
// "treated as Skeleton" cards here as they're
// scripted.
const TREATED_AS_SKELETON = new Set([
  'Loyal Bone Dog',
]);

/**
 * Is this card a Skeleton Creature?
 *
 * @param {string} cardName
 * @param {object} engine  For card DB lookup.
 * @param {object} [_inst] Reserved for future on-board overrides
 *   (parity with isDeepseaCreature's `inst` arg).
 */
function isSkeletonCreature(cardName, engine /*, inst = null */) {
  if (!cardName || !engine) return false;
  const cd = engine._getCardDB()[cardName];
  if (!cd) return false;
  if (cd.cardType !== 'Creature') return false;
  if (cd.archetype === SKELETON_ARCHETYPE) return true;
  if (TREATED_AS_SKELETON.has(cardName)) return true;
  return false;
}

/**
 * Distinct Skeleton creatures in a player's discard pile.
 * Returns [{ name, count }] suitable for a `cardGallery` prompt.
 * Used by Skeleton Necromancer's tutor and Raise the Minions!.
 */
function findSkeletonsInDiscard(ps, engine) {
  if (!ps || !engine) return [];
  const counts = new Map();
  for (const name of (ps.discardPile || [])) {
    if (!isSkeletonCreature(name, engine)) continue;
    counts.set(name, (counts.get(name) || 0) + 1);
  }
  return [...counts.entries()].map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Live Skeleton Creature instances controlled by `playerIdx`. Includes
 * the "treated as Skeleton" overrides (Loyal Bone Dog) automatically
 * via `isSkeletonCreature`.
 */
function getControlledSkeletons(engine, playerIdx) {
  const out = [];
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support') continue;
    if ((inst.controller ?? inst.owner) !== playerIdx) continue;
    if (!isSkeletonCreature(inst.name, engine)) continue;
    out.push(inst);
  }
  return out;
}

/**
 * Free Support Zone descriptors across all of `playerIdx`'s living
 * Heroes — used by tutors like Skeleton Necromancer ("any Hero you
 * control") and Raise the Minions! ("free Support Zones of the user").
 */
function getFreeSupportZonesAcrossHeroes(engine, playerIdx) {
  const ps = engine.gs.players[playerIdx];
  if (!ps) return [];
  const zones = [];
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name || hero.hp <= 0) continue;
    for (let si = 0; si < 3; si++) {
      if (((ps.supportZones?.[hi] || [])[si] || []).length === 0) {
        zones.push({ heroIdx: hi, slotIdx: si, label: `${hero.name} — Slot ${si + 1}` });
      }
    }
  }
  return zones;
}

module.exports = {
  SKELETON_ARCHETYPE,
  TREATED_AS_SKELETON,
  isSkeletonCreature,
  findSkeletonsInDiscard,
  getControlledSkeletons,
  getFreeSupportZonesAcrossHeroes,
};
