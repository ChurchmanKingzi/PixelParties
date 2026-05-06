// ═══════════════════════════════════════════
//  CARD EFFECT: "Magic Emerald"
//  Artifact (Normal, Cost 6)
//
//  Send the top 3 cards of your opponent's deck
//  to their discard pile.
//  You may discard a card from your hand to keep
//  this card in your hand. Once per turn.
// ═══════════════════════════════════════════

const { canPlayMagicGem, maybeKeepGemInHand } = require('./_magic-gem-shared');

const CARD_NAME = 'Magic Emerald';
const MILL_AMOUNT = 3;

module.exports = {
  activeIn: ['hand'],

  canActivate(gs, pi) {
    return canPlayMagicGem(gs, pi, CARD_NAME);
  },

  resolve: async (engine, pi) => {
    const oi = pi === 0 ? 1 : 0;

    // Top-N → discard. actionMillCards already handles deck-out
    // gracefully (mills at most ps.mainDeck.length) AND honors
    // first-turn protection on the opponent.
    await engine.actionMillCards(oi, MILL_AMOUNT, { source: CARD_NAME });

    return await maybeKeepGemInHand(engine, pi, CARD_NAME);
  },
};
