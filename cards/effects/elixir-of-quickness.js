// ═══════════════════════════════════════════
//  CARD EFFECT: "Elixir of Quickness"
//  Potion — Draw 3 cards. Deleted after use.
//  No restrictions, no discard requirement.
// ═══════════════════════════════════════════

module.exports = {
  isPotion: true,

  resolve: async (engine, pi) => {
    const ps = engine.gs.players[pi];
    if (!ps) return;

    // Draw 3 cards
    await engine.actionDrawCards(pi, 3);
  },
};
