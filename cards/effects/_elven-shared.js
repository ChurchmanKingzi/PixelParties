// ═══════════════════════════════════════════
//  SHARED: "_elven-shared.js"
//  Common helpers for the Elven archetype —
//  archetype detection and on-board Elven
//  counting. Archer's "free-summon-while-Elven-
//  on-board" rule is implemented via the engine's
//  `inherentAction` facility directly on Archer
//  itself, so there's no shared hook bundle —
//  other Elven cards have no archetype-wide
//  behaviour to share.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const ELVEN_ARCHETYPE = 'Elven';

/** True if `cardData` is an Elven Creature (not a Hero/Token/Attack). */
function isElvenCreature(cardData) {
  if (!cardData) return false;
  if (!hasCardType(cardData, 'Creature')) return false;
  return cardData.archetype === ELVEN_ARCHETYPE;
}

/**
 * Count Elven Creatures `ownerIdx` controls in their support zones.
 * Face-down and otherwise non-visible instances are excluded so that
 * e.g. disguised / tokenised creatures don't count if they're hidden.
 *
 * @param {object}  engine       — engine reference
 * @param {number}  ownerIdx     — player whose side we're counting
 * @param {string?} exceptInstId — instance ID to skip (e.g. self-count
 *                                 during a leave-check)
 * @returns {number}
 */
function countElvenOnBoard(engine, ownerIdx, exceptInstId = null) {
  const cardDB = engine._getCardDB();
  let count = 0;
  for (const inst of engine.cardInstances) {
    if (inst.id === exceptInstId) continue;
    if (inst.controller !== ownerIdx) continue;
    if (inst.zone !== 'support') continue;
    if (inst.faceDown) continue;
    const cd = cardDB[inst.name];
    if (isElvenCreature(cd)) count++;
  }
  return count;
}

/** Convenience boolean wrapper around countElvenOnBoard(). */
function hasElvenOnBoard(engine, ownerIdx, exceptInstId = null) {
  return countElvenOnBoard(engine, ownerIdx, exceptInstId) > 0;
}

module.exports = {
  ELVEN_ARCHETYPE,
  isElvenCreature,
  countElvenOnBoard,
  hasElvenOnBoard,
};
