// ═══════════════════════════════════════════
//  CARD EFFECT: "Elana, the Rocky Rebel"
//  Hero — Active effect (once per turn, Main Phase).
//  Shuffle your entire hand back into the deck,
//  then draw the same number of cards +1.
//  Requires at least 1 card in hand.
//  Animation: big burst of music notes over Elana.
// ═══════════════════════════════════════════

module.exports = {
  activeIn: ['hero'],
  heroEffect: true,

  /**
   * Can activate if the player has at least 1 card in hand.
   */
  canActivateHeroEffect(ctx) {
    const pi = ctx.cardOwner;
    const ps = ctx.players[pi];
    return (ps.hand || []).length >= 1;
  },

  /**
   * Execute: confirm → play music note animation → return hand to deck
   * one by one → shuffle → draw (handSize + 1) one by one.
   * Returns true if resolved, false if cancelled.
   */
  async onHeroEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const ps = ctx.players[pi];

    const handSize = (ps.hand || []).length;
    if (handSize < 1) return false;

    const drawCount = handSize + 1;

    // Confirm
    const confirmed = await ctx.promptConfirmEffect({
      title: 'Elana, the Rocky Rebel',
      message: `Shuffle ${handSize} card${handSize !== 1 ? 's' : ''} back into your deck to draw ${drawCount}?`,
    });
    if (!confirmed) return false;

    // Play music notes animation on Elana
    engine._broadcastEvent('play_zone_animation', {
      type: 'music_notes', owner: pi, heroIdx, zoneSlot: -1,
    });
    await engine._delay(400);

    // Return all hand cards to deck one by one (reverse draw animation)
    const cardsToReturn = handSize;
    engine.gs.handReturnToDeck = true; // Signal frontend to animate cards flying to deck
    for (let i = 0; i < cardsToReturn; i++) {
      if ((ps.hand || []).length === 0) break;
      const cardName = ps.hand.shift();
      ps.mainDeck.push(cardName);

      // Untrack the hand card instance
      const handInst = engine.cardInstances.find(c =>
        c.owner === pi && c.zone === 'hand' && c.name === cardName
      );
      if (handInst) engine._untrackCard(handInst.id);

      engine.sync();
      await engine._delay(150);
    }
    engine.gs.handReturnToDeck = false;

    await engine._delay(400);

    // Shuffle the deck (Fisher-Yates)
    const deck = ps.mainDeck;
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    engine.log('elana_shuffle', { player: ps.username, returned: cardsToReturn, drawing: drawCount });

    await engine._delay(300);

    // Draw drawCount cards one by one (uses engine primitive for proper hooks)
    for (let i = 0; i < drawCount; i++) {
      if ((ps.mainDeck || []).length === 0) break;
      await engine.actionDrawCards(pi, 1);
      engine.sync();
      await engine._delay(200);
    }

    engine.sync();
    return true;
  },
};
