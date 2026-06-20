// ═══════════════════════════════════════════
//  CARD EFFECT: "Hydrogen Demon"
//  Cycling Demons archetype — see
//  _cycling-demons-shared.js for the full
//  cycle / on-summon / on-defeat / 1-per-turn
//  rules. Placed by Serpentous Demon's defeat
//  → Freeze an opponent Hero 1 turn; on defeat
//  → place Herbithorn Demon from the deck.
// ═══════════════════════════════════════════

const { buildDemonHooks } = require('./_cycling-demons-shared');

module.exports = buildDemonHooks('Hydrogen Demon');
