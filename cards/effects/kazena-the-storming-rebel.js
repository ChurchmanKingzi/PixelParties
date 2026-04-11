// ═══════════════════════════════════════════
//  CARD EFFECT: "Kazena, the Storming Rebel"
//  Hero — Active effect (once per turn, Main Phase).
//  Draw until you have 7 cards in hand.
//  If you do, you cannot draw or add cards to
//  your hand for the rest of the turn.
//
//  Implementation:
//  - heroEffect activation draws (7 − handSize)
//  - Uses generic handLocked system (like summonLocked)
//    to block all further draws and hand additions
//  - Engine clears handLocked automatically on turn start
// ═══════════════════════════════════════════

module.exports = {
  activeIn: ['hero'],
  heroEffect: true,

  /**
   * Can only activate if hand has fewer than 7 cards
   * and hand isn't already locked.
   */
  canActivateHeroEffect(ctx) {
    const ps = ctx.players[ctx.cardOwner];
    if (ps.handLocked) return false;
    return (ps.hand || []).length < 7;
  },

  /**
   * Draw until 7, then lock all further draws/hand additions this turn.
   */
  async onHeroEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const ps = ctx.players[pi];

    const handSize = (ps.hand || []).length;
    const drawCount = 7 - handSize;
    if (drawCount <= 0) return false;

    // Confirm — player should know about the draw lock
    const confirmed = await ctx.promptConfirmEffect({
      title: 'Kazena, the Storming Rebel',
      message: `Draw ${drawCount} card${drawCount !== 1 ? 's' : ''} (to 7)? You won't be able to draw or add cards to your hand for the rest of the turn.`,
    });
    if (!confirmed) return false;

    // Play storm animation on Kazena
    engine._broadcastEvent('play_zone_animation', {
      type: 'wind_burst', owner: pi, heroIdx, zoneSlot: -1,
    });
    await engine._delay(400);

    // Draw cards one by one for visual feedback
    const drawn = await engine.actionDrawCards(pi, drawCount);
    const totalDrawn = drawn.length;

    // "If you do" — only lock if at least one card was drawn
    if (totalDrawn > 0) {
      ctx.lockHand();
    }

    engine.log('kazena_storm', {
      player: ps.username, drawn: totalDrawn, handSize: (ps.hand || []).length,
    });

    engine.sync();
    return true;
  },
};
