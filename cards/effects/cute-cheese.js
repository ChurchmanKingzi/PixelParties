// ═══════════════════════════════════════════
//  CARD EFFECT: "Cute Cheese"
//  Artifact (Normal) — Search your deck for a
//  Creature card, reveal it and add it to hand.
//  Hard once per turn.
//  Follows the standard deck-search pattern
//  (see Magnetic Glove) with a type filter.
// ═══════════════════════════════════════════

module.exports = {
  isTargetingArtifact: true,

  canActivate(gs, pi) {
    // Hand lock — cannot add cards to hand
    if (gs.players[pi]?.handLocked) return false;
    // HOPT check
    const hoptKey = `cute-cheese:${pi}`;
    if (gs.hoptUsed?.[hoptKey] === gs.turn) return false;
    // Must have at least one Creature in deck
    const cardDB = _getCardDB();
    return (gs.players[pi]?.mainDeck || []).some(name => cardDB[name]?.cardType === 'Creature');
  },

  // No board targets — self-targeting effect
  getValidTargets: () => [],

  targetingConfig: {
    description: 'Search your deck for a Creature and add it to your hand.',
    confirmLabel: '🧀 Search!',
    confirmClass: 'btn-success',
    cancellable: true,
    alwaysConfirmable: true,
  },

  validateSelection: () => true,

  animationType: 'gold_sparkle',

  resolve: async (engine, pi) => {
    const ps = engine.gs.players[pi];
    if (!ps) return;
    if (ps.handLocked) return;

    // Claim HOPT
    if (!engine.claimHOPT('cute-cheese', pi)) return;

    // Build deduplicated gallery from deck — Creatures only
    const cardDB = engine._getCardDB();
    const countMap = {};
    for (const cardName of (ps.mainDeck || [])) {
      if (cardDB[cardName]?.cardType !== 'Creature') continue;
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
      title: 'Cute Cheese',
      description: 'Choose a Creature to add to your hand.',
      cancellable: false,
    });

    if (!result || !result.cardName) return;

    // Verify the card is actually in the deck and is a Creature
    const deckIdx = ps.mainDeck.indexOf(result.cardName);
    if (deckIdx < 0) return;
    if (cardDB[result.cardName]?.cardType !== 'Creature') return;

    // Remove from deck, add to hand
    ps.mainDeck.splice(deckIdx, 1);
    ps.hand.push(result.cardName);

    // Broadcast deck search event (face-up draw animation for opponent)
    engine._broadcastEvent('deck_search_add', { cardName: result.cardName, playerIdx: pi });
    engine.log('deck_search', { player: ps.username, card: result.cardName, by: 'Cute Cheese' });
    engine.sync();

    // Show reveal prompt to opponent — halts game until they click OK
    await engine._delay(500);
    const oi = pi === 0 ? 1 : 0;
    await engine.promptGeneric(oi, {
      type: 'deckSearchReveal',
      cardName: result.cardName,
      searcherName: ps.username,
      title: 'Cute Cheese',
      cancellable: false,
    });
  },
};

// Module-level card DB loader (cached) for canActivate (no engine context)
let _cardDBCache = null;
function _getCardDB() {
  if (_cardDBCache) return _cardDBCache;
  try {
    const allCards = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '../../data/cards.json'), 'utf-8'));
    _cardDBCache = {};
    allCards.forEach(c => { _cardDBCache[c.name] = c; });
    return _cardDBCache;
  } catch { return {}; }
}
