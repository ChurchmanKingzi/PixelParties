// ═══════════════════════════════════════════
//  CARD EFFECT: "Wisdom"
//  Ability — level-manipulation (paid coverage).
//
//  This Hero can use Spells [Wisdom level] higher
//  than it normally could. For every level of
//  school gap Wisdom covers, the player must
//  discard that many cards from their hand. The
//  discard cost is always paid — even if the
//  Spell is negated, interrupted, or fizzles.
//
//  Wisdom plugs into the engine's generic
//  level-manipulation mechanism via `coverLevelGap`.
//  The engine walks abilities and finds a coverage
//  handler without knowing about Wisdom by name —
//  any future paid-gap ability follows the same API.
//
//  Discard enforcement (the actual hand-splice) lives
//  in server.js play_spell; Wisdom only declares
//  coverability + cost here.
// ═══════════════════════════════════════════

module.exports = {
  activeIn: ['ability'],

  /**
   * Generic level-gap coverage. Called by the engine when a Spell's
   * effective level exceeds the hero's school count by `gap`.
   * Wisdom covers up to `abilityLevel` levels of gap at a cost of
   * one discarded card per covered level.
   *
   * @param {object} cardData - The Spell being played
   * @param {number} abilityLevel - Wisdom's slot size on this hero (1-3)
   * @param {object} engine - Engine reference (unused but passed for consistency)
   * @param {number} gap - Remaining level gap after silent reductions
   * @returns {{ coverable: boolean, discardCost: number }}
   */
  coverLevelGap(cardData, abilityLevel, engine, gap) {
    if (cardData?.cardType !== 'Spell') return { coverable: false, discardCost: 0 };
    if (gap <= 0) return { coverable: true, discardCost: 0 };
    if (abilityLevel >= gap) return { coverable: true, discardCost: gap };
    return { coverable: false, discardCost: 0 };
  },
};
