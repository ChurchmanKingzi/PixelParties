// ═══════════════════════════════════════════
//  CARD EFFECT: "Magic Lamp"
//  Potion — Choose 3 different cards from your
//  deck and reveal them. Your opponent chooses 1.
//  Add that card to opponent's hand, the other 2
//  to your hand. Deleted after use.
// ═══════════════════════════════════════════

module.exports = {
  blockedByHandLock: true,
  isPotion: true,
  deferBroadcast: true, // Broadcast after selections, not before

  canActivate(gs, pi) {
    // Not usable on the very first turn of the game
    if ((gs.turn || 1) <= 1) return false;
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

    if (!result || result.cancelled || !Array.isArray(result.selectedCards) || result.selectedCards.length !== 3) {
      return { cancelled: true };
    }

    // Defensive: ensure every selectedCard is actually a name from the
    // gallery, dedupe, and bail if the player's response somehow ended
    // up with fewer than 3 distinct names. The gallery is always
    // dedup'd up front, so duplicates / stranger names here would
    // indicate a desync between the client's pick and the server's
    // gallery — drop the activation rather than splice nonsense out
    // of mainDeck or offer the opponent a card the player didn't
    // actually pick.
    const galleryNames = new Set(galleryCards.map(c => c.name));
    const chosenNames = [];
    const chosenSet = new Set();
    for (const name of result.selectedCards) {
      if (typeof name !== 'string') continue;
      if (!galleryNames.has(name)) continue;
      if (chosenSet.has(name)) continue;
      chosenSet.add(name);
      chosenNames.push(name);
    }
    if (chosenNames.length !== 3) {
      engine.log('magic_lamp_invalid_pick', {
        player: ps.username,
        sent: result.selectedCards,
        accepted: chosenNames,
      });
      return { cancelled: true };
    }

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
    if (oppResult && typeof oppResult.cardName === 'string'
        && chosenNames.includes(oppResult.cardName)) {
      oppChoice = oppResult.cardName;
    } else {
      // Safety fallback: opponent gets the first card. Log so a
      // recurring "CPU picked off-list" report has a paper trail —
      // the user's recent Magic Lamp report (CPU choosing a card
      // outside the offered 3) shouldn't be reachable from the
      // server side, but a logged hit here proves it.
      if (oppResult && oppResult.cardName) {
        engine.log('magic_lamp_off_list_pick', {
          player: oppPs.username,
          picked: oppResult.cardName,
          offered: chosenNames,
        });
      }
      oppChoice = chosenNames[0];
    }

    // Splice ONE matching name out of chosenNames so duplicates (which
    // shouldn't exist after the dedupe above, but defensive in case
    // future code paths skip it) don't drop multiple copies. The
    // remaining 2 are always exactly the cards the player picked
    // minus what the opponent kept.
    const playerCards = (() => {
      const out = chosenNames.slice();
      const idx = out.indexOf(oppChoice);
      if (idx >= 0) out.splice(idx, 1);
      return out;
    })();

    // Add opponent's choice to their hand. Broadcast a defensive
    // `card_reveal` to BOTH sides as well as the standard
    // `deck_search_add` flight animation. The reveal popup is
    // independent of the deck-search-add queue, so even if a stale
    // animation entry from an earlier effect somehow corrupts the
    // flight visual, the reveal popup will always show the correct
    // card the opponent ended up with.
    engine._broadcastEvent('card_reveal', { cardName: oppChoice });
    engine._broadcastEvent('deck_search_add', { cardName: oppChoice, playerIdx: oppIdx });
    oppPs.hand.push(oppChoice);
    // Track the gifted card with a foreign-origin tag so when the
    // opponent plays it, the discard / deleted pile routes back to
    // the Magic Lamp activator (the card came out of THEIR deck).
    // The play handlers consume this tag via `_consumeHandCardOrigin`.
    const oppInst = engine._trackCard(oppChoice, oppIdx, 'hand');
    oppInst.originalOwner = pi;
    engine.log('card_added_to_hand', { card: oppChoice, player: oppPs.username, by: 'Magic Lamp' });
    engine.sync();
    await engine._delay(600);

    // Add remaining 2 to player's hand one at a time (face-up to both players)
    for (const name of playerCards) {
      engine._broadcastEvent('deck_search_add', { cardName: name, playerIdx: pi });
      ps.hand.push(name);
      // Self-routed cards: track for parity. originalOwner defaults to
      // pi (the holder), so no override needed.
      engine._trackCard(name, pi, 'hand');
      engine.log('card_added_to_hand', { card: name, player: ps.username, by: 'Magic Lamp' });
      engine.sync();
      await engine._delay(500);
    }
  },
};
