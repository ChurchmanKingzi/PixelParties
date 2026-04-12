// ═══════════════════════════════════════════
//  CARD EFFECT: "Wisdom"
//  Ability — passive level-boosting effect.
//
//  This Hero can use Spells [Wisdom level]
//  higher than it normally could. If a Spell
//  is played that wouldn't be usable without
//  Wisdom, the player must discard cards equal
//  to the level gap (enforced in play_spell).
//
//  The discard cost is always paid — even if
//  the Spell is negated, interrupted, or fails.
//
//  Implementation:
//  - heroMeetsLevelReq checks for Wisdom
//    ability in the hero's zones and allows
//    Spells up to [Wisdom level] above normal.
//  - getWisdomDiscardCost computes the gap.
//  - getHeroPlayableCards enforces hand-size
//    eligibility (must have enough cards to
//    pay the discard cost).
//  - server.js play_spell enforces the actual
//    discard after resolution (or negation).
// ═══════════════════════════════════════════

module.exports = {
  activeIn: ['ability'],
};
