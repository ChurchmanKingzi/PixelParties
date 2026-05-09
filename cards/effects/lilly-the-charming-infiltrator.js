// ═══════════════════════════════════════════
//  HERO EFFECT: "Lilly, the Charming Infiltrator"
//  Whenever you add a card from your opponent's
//  deck or hand to your hand, draw 1 card.
//
//  Triggers PER CARD — a multi-card steal fires
//  the hook once per card and Lilly draws once
//  per fire (matches the user-spec "if a single
//  effect steals 2+ cards, she also draws that
//  many"). Hook source: `onCardTakenFromOpponent`,
//  emitted by Infiltration / Charme Lv2 / any
//  future steal effect.
// ═══════════════════════════════════════════

module.exports = {
  activeIn: ['hero'],

  // CPU eval bump for Lilly being alive. Her draw-on-steal passive
  // pays off latently — every Infiltration / Charme Lv2 / future
  // steal effect the controller fires nets a +1 hand card on top
  // of the original effect. Across the lifetime of the game that's
  // worth several extra hand cards, but the hand-value term only
  // sees the cards she's already drawn. The flat passive bonus
  // surfaces the FUTURE value to the eval so MCTS protects her
  // HP (and hunts her on the opposing side) proportionally — on
  // top of the standard ±500 KO swing every hero already carries.
  // Magnitude calibration: ~2-3 future steal-draws of value (each
  // worth ~25 in hand-value terms), so 60 lands in the right band.
  cpuMeta: { heroPassiveValue: 60 },

  hooks: {
    /**
     * Engine fires the hook with `{ takerPi, fromZone, cardName }`.
     * Lilly only triggers when SHE'S the controlling Hero of the
     * taker — symmetric across both players. Dead Lilly skips
     * (passive can't fire from a corpse).
     */
    onCardTakenFromOpponent: async (ctx) => {
      if (ctx.cardZone !== 'hero') return;
      if (ctx.takerPi !== ctx.cardOwner) return;
      const hero = ctx.attachedHero;
      if (!hero?.name || hero.hp <= 0) return;
      // One draw per stolen card. The hook is emitted once per card
      // by the source effect, so this single draw IS the per-card
      // multiplier the user described.
      await ctx.drawCards(ctx.cardOwner, 1);
      ctx.log('lilly_draw_on_steal', {
        hero: hero.name,
        from: ctx.fromZone,
        stolenCard: ctx.cardName,
      });
    },
  },
};
