// ═══════════════════════════════════════════
//  CARD EFFECT: "Royal Corgi"
//  Creature (Summoning Magic Lv0, 50 HP)
//  Pollution archetype.
//
//  Passive: while alive and not Frozen, Stunned,
//  or Negated, the controller's max hand size
//  is increased by 3.
//
//  Implementation note:
//    Royal Corgi sets a negative handLimitReduction
//    counter (-3). The engine's hand-limit summation
//    loops are gated by isCardEffectActive(inst),
//    which returns false when the instance is
//    frozen/stunned/negated or attached to a dead
//    hero. So suppression is handled automatically —
//    this card has zero logic for gating itself.
//
//    This mirrors the same rule already applied to
//    Pollution Tokens (a Frozen Pollution Token no
//    longer reduces hand size either, which is a
//    latent correctness fix bundled with this card).
// ═══════════════════════════════════════════

const HAND_SIZE_BONUS = 3;

module.exports = {
  activeIn: ['support'],

  hooks: {
    onPlay: async (ctx) => {
      // Store as negative reduction so the engine's existing aggregator
      // picks it up without needing a parallel "bonus" counter.
      ctx.card.counters.handLimitReduction = -HAND_SIZE_BONUS;
    },

    // Idempotent restore on game-state rehydration. Mirrors Vampiric Sword's
    // onGameStart pattern — if the counter has somehow been cleared (mid-game
    // reload, serialization round-trip, etc.) re-apply it.
    onGameStart: async (ctx) => {
      if (ctx.card.counters.handLimitReduction === -HAND_SIZE_BONUS) return;
      ctx.card.counters.handLimitReduction = -HAND_SIZE_BONUS;
    },
  },
};
