// ═══════════════════════════════════════════
//  Shared helper for Bottled Flame / Lightning
//  Alternating discard chain. Opponent goes first.
//  Returns the player index who "took it".
// ═══════════════════════════════════════════

/**
 * Run an alternating discard chain between two players.
 * Opponent discards first. Players take turns discarding 1 card.
 * A player may choose "Take it!" to stop. If a player has 0 cards, they auto-take.
 * @returns {number} playerIdx of the player who "took it"
 */
async function runDiscardChain(engine, potionOwner, potionName) {
  const gs = engine.gs;
  const oppIdx = potionOwner === 0 ? 1 : 0;

  // Opponent goes first
  let currentPlayer = oppIdx;

  while (true) {
    const ps = gs.players[currentPlayer];
    const hand = ps?.hand || [];

    // Auto-take if no cards left
    if (hand.length === 0) return currentPlayer;

    const result = await engine.promptGeneric(currentPlayer, {
      type: 'forceDiscardCancellable',
      title: potionName,
      description: `Discard a card or take the ${potionName} effect!`,
      instruction: 'Click a card to discard it, or press "Take it!" to accept the effect.',
      cancelLabel: '🔥 Take it!',
      cancellable: true,
      showOpponentWaiting: true,
      opponentTitle: `🍾 ${potionName} — Opponent is deciding...`,
    });

    if (!result || result.cancelled) {
      // This player chose to "take it"
      return currentPlayer;
    }

    // Discard the chosen card
    const { cardName, handIndex } = result;
    if (handIndex >= 0 && handIndex < hand.length && hand[handIndex] === cardName) {
      hand.splice(handIndex, 1);
      ps.discardPile.push(cardName);
      engine.log('bottled_discard', { player: ps.username, card: cardName, by: potionName });
      engine.sync();
      await engine._delay(300);
    }

    // Switch to other player
    currentPlayer = currentPlayer === 0 ? 1 : 0;
  }
}

module.exports = { runDiscardChain };
