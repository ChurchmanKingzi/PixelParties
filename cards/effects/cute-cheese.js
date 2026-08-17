// ═══════════════════════════════════════════
//  CARD EFFECT: "Cute Cheese"
//  Artifact (Normal) — Search your deck for a
//  Creature card, reveal it and add it to hand.
//  Hard once per turn.
//  Follows the standard deck-search pattern
//  (see Magnetic Glove) with a type filter.
// ═══════════════════════════════════════════

const { isPileCreature, hasCardType } = require('./_hooks');
const { getCardDB: _getCardDB } = require('./_card-db');

module.exports = {
  blockedByHandLock: true,
  isTargetingArtifact: true,

  canActivate(gs, pi) {
    // HOPT check
    const hoptKey = `cute-cheese:${pi}`;
    if (gs.hoptUsed?.[hoptKey] === gs.turn) return false;
    // Must have at least one Creature in deck
    const cardDB = _getCardDB();
    return (gs.players[pi]?.mainDeck || []).some(name => isPileCreature(cardDB[name]));
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

    // Claim HOPT
    if (!engine.claimHOPT('cute-cheese', pi)) return;

    // Build deduplicated gallery from deck — Creatures only
    const cardDB = engine._getCardDB();
    const countMap = {};
    for (const cardName of (ps.mainDeck || [])) {
      if (!isPileCreature(cardDB[cardName])) continue;
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
    if (ps.mainDeck.indexOf(result.cardName) < 0) return;
    if (!isPileCreature(cardDB[result.cardName])) return;

    // Route through the canonical helper so on-card-added-to-hand
    // fires — Cosmic Depths Analyzer / Gatherer key off this hook
    // to gain Change Counters from any opponent search effect,
    // including Cheese-family tutors. The helper handles deck splice,
    // hand push, instance tracking, deck-search animation, log entry,
    // ON_CARD_ADDED_TO_HAND hook, and opponent reveal prompt.
    await engine.actionAddCardFromDeckToHand(pi, result.cardName, {
      source: 'Cute Cheese',
      reveal: true,
    });
  },
};
