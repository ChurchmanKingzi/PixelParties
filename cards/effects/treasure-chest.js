// ═══════════════════════════════════════════
//  CARD EFFECT: "Treasure Chest"
//  Artifact (Normal, 0 Gold) — Gain 10 Gold.
//  Coin particle animation on caster's Gold
//  counter.
// ═══════════════════════════════════════════

module.exports = {
  hooks: {},

  // CPU brain hint — the entire on-play value of this card is the +10 Gold
  // it grants. Without this, `estimateHandCardValueFor` rates Treasure Chest
  // at 25 (generic "0-cost playable card") and the apply-vs-skip MCTS gate
  // sees a net-negative delta, so the CPU never plays it. With it, the
  // hand-value tracks the demand-aware worth of 10 gold — produces a small
  // positive delta at low gold (≤ ~20, plenty of demand-met value) and
  // dwindles to negative at high gold (saturated demand, gold spills as
  // ×0.2 excess). Interference effects (Hammer Throw etc.) get caught by
  // the recon eval naturally — the extra hand-card cost shows up in the
  // delta and the gate skips.
  // `handValueAsGoldGain` keeps the IN-HAND worth honest (so hand-count
  // eval isn't fooled). But on its own it made the apply-vs-skip delta
  // ~0 (in-hand worth ≈ the gold it grants) so the gate never committed
  // — the "CPU won't play Treasure Chest" bug. `evaluateThroughTurnEnd`
  // lets the gate's recon play the rest of the turn, where the realized
  // +10 gold actually gets SPENT (an extra Artifact/effect this turn) —
  // that surfaces as a positive delta exactly when the gold is useful.
  // `activationGateThreshold: 0` → commit on any strictly-positive
  // rollout (a 0-cost pure-gold card is ~never bad; genuine
  // interference still shows as a negative delta and the gate skips).
  cpuMeta: { handValueAsGoldGain: 10, evaluateThroughTurnEnd: true, activationGateThreshold: 0 },

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
