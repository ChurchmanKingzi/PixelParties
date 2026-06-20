// ═══════════════════════════════════════════
//  CARD EFFECT: "Serpentous Demon"
//  Cycling Demons archetype — see
//  _cycling-demons-shared.js. Placed by
//  Infernous Demon's defeat → draw 2 cards; on
//  defeat → place Hydrogen Demon from the deck
//  (closing the cycle).
// ═══════════════════════════════════════════

const { buildDemonHooks } = require('./_cycling-demons-shared');

module.exports = buildDemonHooks('Serpentous Demon');
