// ═══════════════════════════════════════════
//  CARD EFFECT: "Treasure Chest"
//  Artifact (Normal, 0 Gold) — Gain 10 Gold.
//  Coin particle animation on caster's Gold
//  counter.
// ═══════════════════════════════════════════

module.exports = {
  hooks: {},

  resolve: async (engine, pi) => {
    // Coin shower animation on the gold counter
    engine._broadcastEvent('play_gold_coins', { owner: pi });
    await engine._delay(300);

    // Gain 10 gold (triggers +10 floating text + sparkle automatically)
    await engine.actionGainGold(pi, 10);

    engine.log('treasure_chest', { player: engine.gs.players[pi].username, goldGained: 10 });
    return true;
  },
};
