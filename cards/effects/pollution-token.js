// ═══════════════════════════════════════════
//  CARD EFFECT: "Pollution Token"
//  Token — Placed into Support Zones by various
//  Destruction Magic spells (Pyroblast, etc.).
//
//  Each Pollution Token reduces the owner's max
//  hand size by 1 (minimum 1). If the owner ever
//  has more cards than their max hand size, they
//  must immediately delete cards from hand.
//
//  The hand limit reduction is tracked via the
//  generic handLimitReduction counter, which the
//  engine's _checkReactiveHandLimits() reads.
// ═══════════════════════════════════════════

module.exports = {
  activeIn: ['support'],

  hooks: {
    /**
     * When placed on the board, set the handLimitReduction counter.
     * This is read by the engine's generic hand limit system.
     */
    onPlay: async (ctx) => {
      ctx.card.counters.handLimitReduction = 1;
    },
  },
};
