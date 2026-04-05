// ═══════════════════════════════════════════
//  CARD EFFECT: "Magnetic Potion"
//  Potion — Search your deck for any card,
//  reveal it and add it to your hand.
//  Hard once per turn. Deleted after use.
//  Identical to Magnetic Glove but as a Potion.
// ═══════════════════════════════════════════

module.exports = {
  isPotion: true,

  canActivate(gs, pi) {
    // Hand lock — cannot add cards to hand
    if (gs.players[pi]?.handLocked) return false;
    // HOPT check
    const hoptKey = `magnetic-potion:${pi}`;
    if (gs.hoptUsed?.[hoptKey] === gs.turn) return false;
    // Must have cards in deck
    return (gs.players[pi]?.mainDeck || []).length > 0;
  },

  resolve: async (engine, pi) => {
    const ps = engine.gs.players[pi];
    if (!ps) return;
    if (ps.handLocked) return;

    // Claim HOPT
    if (!engine.claimHOPT('magnetic-potion', pi)) return;

    // Build deduplicated gallery from deck
    const countMap = {};
    for (const cardName of (ps.mainDeck || [])) {
      countMap[cardName] = (countMap[cardName] || 0) + 1;
    }

    const galleryCards = Object.entries(countMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, count]) => ({ name, source: 'deck', count }));

    if (galleryCards.length === 0) return;

    // Show gallery prompt
    const result = await engine.promptGeneric(pi, {
      type: 'cardGallery',
      cards: galleryCards,
      title: 'Magnetic Potion',
      description: 'Choose a card to add to your hand.',
      cancellable: false,
    });

    if (!result || !result.cardName) return;

    // Verify the card is actually in the deck
    const deckIdx = ps.mainDeck.indexOf(result.cardName);
    if (deckIdx < 0) return;

    // Remove from deck, add to hand
    ps.mainDeck.splice(deckIdx, 1);
    ps.hand.push(result.cardName);

    // Broadcast deck search event
    engine._broadcastEvent('deck_search_add', { cardName: result.cardName, playerIdx: pi });
    engine.log('deck_search', { player: ps.username, card: result.cardName, by: 'Magnetic Potion' });
    engine.sync();

    // Show reveal prompt to opponent
    await engine._delay(500);
    const oi = pi === 0 ? 1 : 0;
    await engine.promptGeneric(oi, {
      type: 'deckSearchReveal',
      cardName: result.cardName,
      searcherName: ps.username,
      title: 'Magnetic Potion',
      cancellable: false,
    });
  },
};
