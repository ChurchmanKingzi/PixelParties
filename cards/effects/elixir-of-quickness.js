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

    // Draw 3 cards one by one
    for (let i = 0; i < 3; i++) {
      if ((ps.mainDeck || []).length === 0) break;
      await engine.actionDrawCards(pi, 1, { _nomuBypass: true });
      engine.sync();
      await engine._delay(300);
    }
  },
};
