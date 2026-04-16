// ═══════════════════════════════════════════
//  CARD EFFECT: "Pillage"
//  Ability — Free activation once per turn.
//
//  Mill the top N cards of the opponent's deck:
//    Lv1: 1 card
//    Lv2: 3 cards
//    Lv3: 5 cards
//
//  Milling sends cards directly from deck to
//  discard — this is NOT discarding and does
//  NOT fire onDiscard hooks. It fires onMill.
//  Uses engine.actionMillCards (centralised).
// ═══════════════════════════════════════════

const MILL_BY_LEVEL = [1, 3, 5];

module.exports = {
  activeIn: ['ability'],
  freeActivation: true,

  canFreeActivate(ctx, level) {
    const pi     = ctx.cardOwner;
    const oppIdx = pi === 0 ? 1 : 0;
    const oppPs  = ctx.players[oppIdx];
    return (oppPs?.mainDeck || []).length > 0;
  },

  async onFreeActivate(ctx, level) {
    const engine  = ctx._engine;
    const gs      = engine.gs;
    const pi      = ctx.cardOwner;
    const oppIdx  = pi === 0 ? 1 : 0;

    const count = MILL_BY_LEVEL[Math.min(level, 3) - 1] ?? 1;

    // Stream Pillage's card image to both players before the mill,
    // then clear the pending reveal so the server doesn't fire it again after resolution.
    engine._broadcastEvent('card_reveal', { cardName: 'Pillage' });
    delete engine.gs._pendingCardReveal;
    await engine._delay(400);

    await ctx.millCards(oppIdx, count, { source: 'Pillage' });

    engine.log('pillage_activated', {
      player: gs.players[pi]?.username,
      hero:   ctx.heroName(),
      level,
      count,
    });
  },
};
