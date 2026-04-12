// ═══════════════════════════════════════════
//  CARD EFFECT: "Madaga, the Forsaken Seafarer"
//  Hero — Active effect (once per turn, Main Phase).
//
//  Reveal a card from your hand that has a copy
//  in your deck. Search your deck for that copy,
//  reveal it and add it to your hand.
//  Afterwards: "Forsaken" debuff — all cards that
//  would go to your discard pile for the rest of
//  the turn are deleted instead.
//
//  Uses the generic enableDiscardToDelete engine
//  method for the Forsaken redirect.
// ═══════════════════════════════════════════

/**
 * Get card names in hand that also exist in deck.
 */
function getEligibleCardNames(ps) {
  const deckSet = new Set(ps.mainDeck || []);
  const eligible = new Set();
  for (const cn of (ps.hand || [])) {
    if (deckSet.has(cn)) eligible.add(cn);
  }
  return eligible;
}

module.exports = {
  activeIn: ['hero'],
  heroEffect: true,

  canActivateHeroEffect(ctx) {
    const ps = ctx.players[ctx.cardOwner];
    if (!ps) return false;
    if (ps.handLocked) return false;
    return getEligibleCardNames(ps).size > 0;
  },

  async onHeroEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const ps = gs.players[pi];

    const eligibleNames = getEligibleCardNames(ps);
    if (eligibleNames.size === 0) return false;

    // ── Step 1: Player picks a card from hand to reveal ──

    const eligibleIndices = [];
    for (let i = 0; i < ps.hand.length; i++) {
      if (eligibleNames.has(ps.hand[i])) eligibleIndices.push(i);
    }

    const pickResult = await engine.promptGeneric(pi, {
      type: 'handPick',
      title: 'Madaga, the Forsaken Seafarer',
      description: 'Choose a card to reveal. A copy will be searched from your deck.',
      eligibleIndices,
      maxSelect: 1,
      minSelect: 1,
      confirmLabel: '🏴‍☠️ Reveal & Search!',
      cancellable: true,
    });

    if (!pickResult || pickResult.cancelled || !pickResult.selectedCards || pickResult.selectedCards.length === 0) {
      return false;
    }

    const chosenCard = pickResult.selectedCards[0].cardName;

    // Verify the card is still in hand and has a deck copy
    if (!ps.hand.includes(chosenCard)) return false;
    const deckIdx = ps.mainDeck.indexOf(chosenCard);
    if (deckIdx < 0) return false;

    // ── Step 2: Reveal the chosen card to the opponent ──

    // Temporarily make the card visible in opponent's view of our hand
    ps._revealedCardCounts = { [chosenCard]: 1 };
    ps._revealedCardExpiry = Date.now() + 2000;
    engine.sync();
    await engine._delay(1200);

    // ── Step 3: Search deck for copy, add to hand ──

    ps.mainDeck.splice(deckIdx, 1);
    ps.hand.push(chosenCard);

    // Face-up draw animation for the searched card
    engine._broadcastEvent('deck_search_add', { cardName: chosenCard, playerIdx: pi });
    engine.log('deck_search', { player: ps.username, card: chosenCard, by: 'Madaga, the Forsaken Seafarer' });
    engine.sync();

    // Show reveal prompt to opponent
    await engine._delay(500);
    const oi = pi === 0 ? 1 : 0;
    await engine.promptGeneric(oi, {
      type: 'deckSearchReveal',
      cardName: chosenCard,
      searcherName: ps.username,
      title: 'Madaga, the Forsaken Seafarer',
      cancellable: false,
    });

    // Clear the hand reveal
    delete ps._revealedCardCounts;
    delete ps._revealedCardExpiry;

    // ── Step 4: Apply Forsaken debuff ──

    engine.enableDiscardToDelete(pi);

    engine.log('madaga_forsaken', { player: ps.username });
    engine.sync();
    return true;
  },
};
