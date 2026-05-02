// ═══════════════════════════════════════════
//  CARD EFFECT: "Cuteness Sensor"
//  Artifact (Normal) — Search your deck for a
//  "Cute" card (name contains the word "Cute"
//  not preceded by a letter), reveal it and
//  add it to hand.
//  Follows the standard deck-search pattern
//  (see Magnetic Glove) with a name filter.
// ═══════════════════════════════════════════

/**
 * Check if a card name contains "Cute" as a standalone word start.
 * "Cute Cheese" ✓, "Army of the Cute" ✓, "Acute Warning" ✗
 */
function isCuteCard(name) {
  return /(?<![a-zA-Z])Cute/.test(name);
}

module.exports = {
  blockedByHandLock: true,
  isTargetingArtifact: true,

  canActivate(gs, pi) {
    // Must have at least one "Cute" card in deck
    return (gs.players[pi]?.mainDeck || []).some(name => isCuteCard(name));
  },

  // No board targets — self-targeting effect
  getValidTargets: () => [],

  targetingConfig: {
    description: 'Search your deck for a "Cute" card and add it to your hand.',
    confirmLabel: '💖 Detect!',
    confirmClass: 'btn-success',
    cancellable: true,
    alwaysConfirmable: true,
  },

  validateSelection: () => true,

  animationType: 'gold_sparkle',

  resolve: async (engine, pi) => {
    const ps = engine.gs.players[pi];
    if (!ps) return;

    // Build deduplicated gallery from deck — "Cute" cards only
    const countMap = {};
    for (const cardName of (ps.mainDeck || [])) {
      if (!isCuteCard(cardName)) continue;
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
      title: 'Cuteness Sensor',
      description: 'Choose a "Cute" card to add to your hand.',
      cancellable: false,
    });

    if (!result || !result.cardName) return;

    // Verify the card is actually in the deck and matches the filter
    if (ps.mainDeck.indexOf(result.cardName) < 0) return;
    if (!isCuteCard(result.cardName)) return;

    // Route through the canonical helper so ON_CARD_ADDED_TO_HAND fires
    // (Cosmic Depths Analyzer / Gatherer key off this hook for any
    // opponent search). Helper handles splice + push + tracking +
    // deck-search animation + log + hook + opp reveal.
    await engine.actionAddCardFromDeckToHand(pi, result.cardName, {
      source: 'Cuteness Sensor',
      reveal: true,
    });
  },
};
