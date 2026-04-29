// ═══════════════════════════════════════════
//  CARD EFFECT: "Magnetic Potion"
//  Potion — Search your deck for any card,
//  reveal it and add it to your hand.
//  Hard once per turn. Deleted after use.
//  Identical to Magnetic Glove but as a Potion.
// ═══════════════════════════════════════════

module.exports = {
  blockedByHandLock: true,
  isPotion: true,

  // CPU evaluation hint — same reasoning as Magnetic Glove: simulating
  // rest-of-turn lets the gate's variations see which tutored card
  // actually pays off this turn (a playable Spell vs a filler card),
  // instead of picking the gallery's first random alt by hand-value
  // bump alone.
  cpuMeta: { evaluateThroughTurnEnd: true },

  canActivate(gs, pi) {
    // HOPT check
    const hoptKey = `magnetic-potion:${pi}`;
    if (gs.hoptUsed?.[hoptKey] === gs.turn) return false;
    // Must have cards in deck
    return (gs.players[pi]?.mainDeck || []).length > 0;
  },

  resolve: async (engine, pi) => {
    const ps = engine.gs.players[pi];
    if (!ps) return;

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

    // Route through the canonical "deck-to-hand search" helper so the
    // ON_CARD_ADDED_TO_HAND hook fires for listeners like Analyzer /
    // Gatherer from the Cosmic Depths. The previous manual splice +
    // push silently bypassed every hand-add reaction.
    await engine.actionAddCardFromDeckToHand(pi, result.cardName, {
      source: 'Magnetic Potion',
      reveal: true,
    });
  },
};
