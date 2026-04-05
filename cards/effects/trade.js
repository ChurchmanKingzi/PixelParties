// ═══════════════════════════════════════════
//  CARD EFFECT: "Trade"
//  Ability — Free activation during Main Phase
//  (no action cost). Hard once per turn (by name).
//
//  Send the top 5 cards of your deck to the
//  deleted pile (face-up, one by one), then
//  gain Gold based on level:
//  Lv1: 5 Gold, Lv2: 10 Gold, Lv3: 20 Gold.
//
//  Cannot activate with <5 cards in deck.
// ═══════════════════════════════════════════

const GOLD_BY_LEVEL = [5, 10, 20]; // index 0 = Lv1, etc.

module.exports = {
  activeIn: ['ability'],
  freeActivation: true,

  /**
   * Can activate if the player has at least 5 cards in their deck.
   */
  canFreeActivate(ctx, level) {
    const ps = ctx.players[ctx.cardOwner];
    return (ps.mainDeck || []).length >= 5;
  },

  /**
   * Execute: confirm → send top 5 to deleted one by one → gain gold.
   * Returns true if resolved, false if cancelled (don't claim HOPT).
   */
  async onFreeActivate(ctx, level) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const ps = gs.players[pi];

    if ((ps.mainDeck || []).length < 5) return false;

    const goldGain = GOLD_BY_LEVEL[Math.min(level - 1, GOLD_BY_LEVEL.length - 1)];

    // Confirm
    const confirmed = await ctx.promptConfirmEffect({
      title: 'Trade',
      message: `Trade away the top 5 cards of your deck for ${goldGain} Gold?`,
    });
    if (!confirmed) return false;

    // Collect the top 5 cards
    const cards = ps.mainDeck.splice(0, 5);

    // Broadcast deck-to-deleted animation with card names (face-up)
    engine._broadcastEvent('deck_to_deleted', { owner: pi, cards });

    // Move cards to deleted pile
    for (const cardName of cards) {
      ps.deletedPile.push(cardName);
    }

    engine.log('trade', { player: ps.username, cards, goldGain, level });
    engine.sync();

    // Wait for flying card animations to finish (5 cards × 150ms stagger + 500ms flight)
    await engine._delay(1300);

    // Gain gold (actionGainGold fires hooks + auto-syncs + frontend auto-detects the gain)
    await engine.actionGainGold(pi, goldGain);

    engine.sync();
    return true;
  },
};
