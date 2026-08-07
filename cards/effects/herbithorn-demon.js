// ═══════════════════════════════════════════
//  CARD EFFECT: "Herbithorn Demon"
//  Cycling Demons archetype — see
//  _cycling-demons-shared.js. Placed by
//  Hydrogen Demon's defeat → take a card from
//  any discard pile to hand; on defeat → place
//  Bouldor Demon from the deck.
// ═══════════════════════════════════════════

const { buildDemonHooks } = require('./_cycling-demons-shared');

const _herbithorn = buildDemonHooks('Herbithorn Demon');
// BORIS-EINSCHRAENKUNG (Klausel 1, Als Praezisierung 5.8.): nimmt aus der Ablage EINES BELIEBIGEN
// Spielers auf die eigene Hand, also auch aus der des Gegners.
// Nachtraeglich gesetzt, weil der Export aus einer Fabrik kommt.
_herbithorn.stealsFromEitherSide = true;
module.exports = _herbithorn;
