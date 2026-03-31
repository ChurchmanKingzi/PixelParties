// ═══════════════════════════════════════════
//  EXAMPLE CARD: "Shield Burst"
//  Surprise card — when your hero would take
//  damage, negate it and destroy this card.
//  Speed 2 (can chain).
// ═══════════════════════════════════════════

module.exports = {
  activeIn: ['surprise'],

  effects: {
    trap: {
      speed: 2,
      canActivate: (ctx) => {
        // Can activate in response to damage being dealt to your hero
        return ctx.event === 'beforeDamage'
          && ctx.target
          && ctx.target.owner === ctx.cardOwner;
      },
      resolve: async (ctx) => {
        // Negate the damage
        ctx.cancel();
        // Destroy self (move to discard)
        await ctx.destroyCard(ctx.card);
      },
    },
  },
};
