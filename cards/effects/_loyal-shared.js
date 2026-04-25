// ═══════════════════════════════════════════
//  SHARED HELPER: Loyal archetype
//
//  Single source of truth for "is this card a
//  Loyal Creature?" and the supporting counts /
//  enumerations Loyal cards build off of (Beagle's
//  gold scaling, Labradoodle's reduction stack,
//  Hountriever's draw trigger, Pinpom + Orthos'
//  chain-summon filter, Shepherd / Rottweiler
//  tutoring, Bone Dog's defeat-protection scope,
//  Terrier's death watch).
//
//  Bone Dog is a Loyal by archetype — no hard-
//  code needed here. The "treated as a Skeleton"
//  half of its rules text lives in the parallel
//  `_skeleton-shared.js` predicate so any current
//  or future Skeleton-tribal card sees Bone Dog
//  as a Skeleton automatically.
// ═══════════════════════════════════════════

const LOYAL_ARCHETYPE = 'Loyals';

/**
 * Is this card a Loyal Creature?
 *
 * Pure archetype check against the cards.json `archetype` field.
 * Loyals are all standard Creatures with `archetype: "Loyals"` —
 * no per-card overrides currently. The `inst` arg is accepted for
 * symmetry with the Deepsea predicate; Loyal has no on-board
 * archetype overrides today.
 */
function isLoyalCreature(cardName, engine /*, inst = null */) {
  if (!cardName || !engine) return false;
  const cd = engine._getCardDB()[cardName];
  if (!cd) return false;
  if (cd.cardType !== 'Creature') return false;
  return cd.archetype === LOYAL_ARCHETYPE;
}

/**
 * Count Loyal Creatures `playerIdx` controls in their support zones.
 * Excludes face-down (Bakhm-staged) creatures since they don't yet
 * count as on-board for tribal-count purposes — same convention the
 * Deepsea-share helper uses.
 */
function countLoyalCreatures(engine, playerIdx) {
  let n = 0;
  for (const inst of engine.cardInstances) {
    if (inst.owner !== playerIdx) continue;
    if (inst.zone !== 'support') continue;
    if (inst.faceDown) continue;
    if (!isLoyalCreature(inst.name, engine, inst)) continue;
    n++;
  }
  return n;
}

/**
 * List unique Loyal Creature card names in `playerIdx`'s hand,
 * with per-name copy counts. Used by Pinpom / Orthos to populate
 * the "summon another Loyal from hand" gallery.
 *
 * Returns an array of { name, count } sorted alphabetically.
 *
 * @param {object} ps  Player state (gs.players[i]).
 * @param {object} engine  Required for archetype lookup.
 * @param {object} [opts]
 * @param {string} [opts.exclude]  Card name to omit (e.g. exclude
 *   the source so Pinpom doesn't tutor itself when there's a 2nd
 *   copy in hand — leaves intact card-text decisions to caller).
 */
function getLoyalsInHand(ps, engine, opts = {}) {
  const counts = {};
  for (const cn of (ps?.hand || [])) {
    if (opts.exclude && cn === opts.exclude) continue;
    if (!isLoyalCreature(cn, engine)) continue;
    counts[cn] = (counts[cn] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Same as getLoyalsInHand but for the main deck. Used by Shepherd
 * (different-name tutor) and Rottweiler (any Loyal from deck).
 */
function getLoyalsInDeck(ps, engine, opts = {}) {
  const counts = {};
  for (const cn of (ps?.mainDeck || [])) {
    if (opts.exclude && cn === opts.exclude) continue;
    if (!isLoyalCreature(cn, engine)) continue;
    counts[cn] = (counts[cn] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

module.exports = {
  LOYAL_ARCHETYPE,
  isLoyalCreature,
  countLoyalCreatures,
  getLoyalsInHand,
  getLoyalsInDeck,
};
