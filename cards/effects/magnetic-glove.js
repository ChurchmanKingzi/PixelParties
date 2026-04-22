// ═══════════════════════════════════════════
//  CARD EFFECT: "Magnetic Glove"
//  Artifact (Normal) — Search your deck for
//  any card, reveal it and add it to hand.
//  Hard once per turn.
//  Uses the shared deck-search helper so the
//  full add-to-hand + flight + reveal flow
//  stays in sync with every other search card.
// ═══════════════════════════════════════════

module.exports = {
  blockedByHandLock: true,
  isTargetingArtifact: true,

  canActivate(gs, pi) {
    // HOPT check
    const hoptKey = `magnetic-glove:${pi}`;
    if (gs.hoptUsed?.[hoptKey] === gs.turn) return false;
    // Must have cards in deck
    return (gs.players[pi]?.mainDeck || []).length > 0;
  },

  // No board targets — self-targeting effect
  getValidTargets: () => [],

  targetingConfig: {
    description: 'Search your deck for any card and add it to your hand.',
    confirmLabel: '🧲 Search!',
    confirmClass: 'btn-success',
    cancellable: true,
    alwaysConfirmable: true,
  },

  validateSelection: () => true,

  animationType: 'gold_sparkle',

  resolve: async (engine, pi) => {
    const ps = engine.gs.players[pi];
    if (!ps) return;

    // Claim HOPT
    if (!engine.claimHOPT('magnetic-glove', pi)) return;

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
      title: 'Magnetic Glove',
      description: 'Choose a card to add to your hand.',
      cancellable: false,
    });

    if (!result || !result.cardName) return;

    await engine.actionAddCardFromDeckToHand(pi, result.cardName, {
      source: 'Magnetic Glove',
      reveal: true,
    });
  },
};
