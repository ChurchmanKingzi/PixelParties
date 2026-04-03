// ═══════════════════════════════════════════
//  CARD EFFECT: "Nicolas, the Hidden Alchemist"
//  Hero — Two effects:
//
//  1) DECK-BUILDING: If Nicolas is a Hero in your
//     deck, you may add Potion cards to your main
//     deck (subject to standard Potion limits).
//     Handled by the deck editor in app.jsx.
//
//  2) IN-GAME (passive): After a player plays their
//     2nd Potion in a turn while Nicolas is alive
//     and not negated, that player cannot play any
//     more Potions for the rest of that turn. This
//     lock persists even if Nicolas is defeated
//     after it triggers.
//     Handled generically in server.js potion
//     resolution handlers (use_potion, confirm_potion).
// ═══════════════════════════════════════════

module.exports = {
  activeIn: ['hero'],
  hooks: {
    // Marker hook — Nicolas's actual potion lock logic is in server.js
    // to ensure correct timing after potion resolution.
    onGameStart: () => {},
  },
};
