// ═══════════════════════════════════════════
//  CARD EFFECT: "Mana Mining"
//  Ability — level-manipulation (silent reduction).
//
//  Lv1/2/3: reduce the level of Spells that place
//  Pollution Tokens, used by this Hero, by 1/2/3.
//
//  Plugs into the engine's generic level-manipulation
//  mechanism via `reduceSpellLevel`. The engine walks
//  each ability zone and sums reductions before
//  performing the school-level check — no card-name
//  references anywhere in engine code.
//
//  Eligibility detection reuses the existing
//  `placesPollutionTokens: true` flag that
//  Pyroblast / Cold Coffin / Goldify / Eraser Beam
//  already export (and Mana Beacon already reads).
//  No cards.json tagging required.
// ═══════════════════════════════════════════

const { loadCardEffect } = require('./_loader');

module.exports = {
  activeIn: ['ability'],

  /**
   * Silent level reduction applied before the school-level check.
   * Returns how many levels to subtract from the spell's effective level.
   *
   * @param {object} cardData - The Spell being played
   * @param {number} abilityLevel - Mana Mining's slot size on this hero (1-3)
   * @returns {number} levels to subtract (0 if not applicable)
   */
  reduceSpellLevel(cardData, abilityLevel) {
    if (!cardData || cardData.cardType !== 'Spell') return 0;
    const script = loadCardEffect(cardData.name);
    if (!script?.placesPollutionTokens) return 0;
    return abilityLevel;
  },
};
