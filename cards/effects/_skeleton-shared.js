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

module.exports = {
  SKELETON_ARCHETYPE,
  TREATED_AS_SKELETON,
  isSkeletonCreature,
};
