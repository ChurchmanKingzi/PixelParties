// ═══════════════════════════════════════════
//  EXAMPLE CARD: "Mystic Scholar"
//  Support card — draw 1 card at the start
//  of your turn while this is in play.
// ═══════════════════════════════════════════

module.exports = {
  activeIn: ['support'],

  hooks: {
    onTurnStart: async (ctx) => {
      if (ctx.isMyTurn) {
        await ctx.drawCards(ctx.cardOwner, 1);
      }
    },
  },
};
