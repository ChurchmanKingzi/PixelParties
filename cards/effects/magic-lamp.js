// ═══════════════════════════════════════════
//  CARD EFFECT: "Magic Lamp"
//  Potion — Choose 3 different cards from your
//  deck and reveal them. Your opponent chooses 1.
//  Add that card to opponent's hand, the other 2
//  to your hand. Deleted after use.
// ═══════════════════════════════════════════

module.exports = {
  isPotion: true,
  deferBroadcast: true, // Broadcast after selections, not before

  canActivate(gs, pi) {
    const ps = gs.players[pi];
    // Need 3+ cards with different names in deck
    const uniqueNames = new Set(ps.mainDeck || []);
    return uniqueNames.size >= 3;
  },

  resolve: async (engine, pi) => {
    const gs = engine.gs;
    const ps = gs.players[pi];
    const oppIdx = pi === 0 ? 1 : 0;
    const oppPs = gs.players[oppIdx];
    if (!ps || !oppPs) return { cancelled: true };

    // Build deduplicated gallery from deck
    const seen = new Set();
    const galleryCards = [];
    for (const cardName of (ps.mainDeck || [])) {
      if (seen.has(cardName)) continue;
      seen.add(cardName);
      galleryCards.push({ name: cardName, source: 'deck' });
    }
    galleryCards.sort((a, b) => a.name.localeCompare(b.name));

    if (galleryCards.length < 3) return { cancelled: true };

    // Step 1: Player picks exactly 3 different cards
    const result = await engine.promptGeneric(pi, {
      type: 'cardGalleryMulti',
      cards: galleryCards,
      selectCount: 3,
      title: 'Magic Lamp',
      description: 'Choose 3 different cards from your deck to reveal. Your opponent will pick 1 to keep.',
      confirmLabel: '✨ Reveal!',
      confirmClass: 'btn-success',
      cancellable: true,
    });

    if (!result || result.cancelled || !result.selectedCards || result.selectedCards.length !== 3) {
      return { cancelled: true };
    }

    const chosenNames = result.selectedCards;

    // Broadcast card to opponent NOW (after player decisions finalized)
    const oppSid = oppPs.socketId;
    if (oppSid && engine.io) {
      engine.io.to(oppSid).emit('card_reveal', { cardName: 'Magic Lamp' });
    }
    await engine._delay(100);

    // Remove chosen cards from deck
    for (const name of chosenNames) {
      const idx = ps.mainDeck.indexOf(name);
      if (idx >= 0) ps.mainDeck.splice(idx, 1);
    }
    engine.sync();

    // Step 2: Opponent picks 1 of the 3
    const oppResult = await engine.promptGeneric(oppIdx, {
      type: 'cardGallery',
      cards: chosenNames.map(name => ({ name, source: 'revealed' })),
      title: 'Magic Lamp',
      description: 'Choose 1 card to add to your hand. The other 2 go to your opponent!',
      cancellable: false, // Opponent MUST choose
    });

    let oppChoice;
    if (oppResult && oppResult.cardName && chosenNames.includes(oppResult.cardName)) {
      oppChoice = oppResult.cardName;
    } else {
      // Safety fallback: opponent gets the first card
      oppChoice = chosenNames[0];
    }

    const playerCards = chosenNames.filter(n => n !== oppChoice);

    // Add opponent's choice to their hand (face-up to both players)
    engine._broadcastEvent('deck_search_add', { cardName: oppChoice, playerIdx: oppIdx });
    oppPs.hand.push(oppChoice);
    engine.log('card_added_to_hand', { card: oppChoice, player: oppPs.username, by: 'Magic Lamp' });
    engine.sync();
    await engine._delay(600);

    // Add remaining 2 to player's hand one at a time (face-up to both players)
    for (const name of playerCards) {
      engine._broadcastEvent('deck_search_add', { cardName: name, playerIdx: pi });
      ps.hand.push(name);
      engine.log('card_added_to_hand', { card: name, player: ps.username, by: 'Magic Lamp' });
      engine.sync();
      await engine._delay(500);
    }
  },
};
