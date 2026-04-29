// ═══════════════════════════════════════════
//  CARD EFFECT: "Cool Cheese"
//  Artifact (Normal) — Cost 4
//
//  Choose an Attack from your deck, reveal it
//  and add it to your hand. Unless you double
//  this Artifact's Cost (i.e. pay 4 MORE Gold
//  on top of the 4 already spent), you cannot
//  use Attacks with that name for the rest of
//  this turn.
//
//  The "can't use this name" tag piggy-backs on
//  the shared `_creationLockedNames` set that
//  Divine Gift of Creation introduced — it's
//  already checked in `validateActionPlay`
//  (_engine.js ~L5282) for Spells, Attacks, and
//  Creatures, and the set is cleared on the
//  owner's turn start. No engine changes.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const EXTRA_COST = 4; // Double of base cost — pay this much more to avoid the lock

module.exports = {
  isTargetingArtifact: true,
  blockedByHandLock: true,

  canActivate(gs, pi) {
    const ps = gs.players[pi];
    if (!ps) return false;
    // Must have at least 1 Attack left in deck
    const cardDB = _getCardDB();
    return (ps.mainDeck || []).some(name => hasCardType(cardDB[name], 'Attack'));
  },

  // No board targets — the Attack pick comes from a deck-gallery prompt
  // during resolve(), same pattern as Magnetic Glove / Cute Cheese.
  getValidTargets: () => [],

  targetingConfig: {
    description: 'Search your deck for an Attack and add it to your hand.',
    confirmLabel: '😎🧀 Search!',
    confirmClass: 'btn-success',
    cancellable: true,
    alwaysConfirmable: true,
  },

  validateSelection: () => true,

  animationType: 'gold_sparkle',

  async resolve(engine, pi) {
    const ps = engine.gs.players[pi];
    if (!ps) return;

    // Step 1: Gallery of all Attacks left in the deck (deduplicated)
    const cardDB = engine._getCardDB();
    const countMap = {};
    for (const cardName of (ps.mainDeck || [])) {
      if (!hasCardType(cardDB[cardName], 'Attack')) continue;
      countMap[cardName] = (countMap[cardName] || 0) + 1;
    }

    const galleryCards = Object.entries(countMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, count]) => ({ name, source: 'deck', count }));

    if (galleryCards.length === 0) return;

    const result = await engine.promptGeneric(pi, {
      type: 'cardGallery',
      cards: galleryCards,
      title: 'Cool Cheese',
      description: 'Choose an Attack to add to your hand.',
      cancellable: false,
    });
    if (!result || !result.cardName) return;

    // Verify the chosen card is still in the deck and is an Attack
    const deckIdx = ps.mainDeck.indexOf(result.cardName);
    if (deckIdx < 0) return;
    if (!hasCardType(cardDB[result.cardName], 'Attack')) return;

    // Step 2: Move the Attack from deck to hand and reveal
    ps.mainDeck.splice(deckIdx, 1);
    ps.hand.push(result.cardName);
    engine._broadcastEvent('deck_search_add', { cardName: result.cardName, playerIdx: pi });
    engine.log('deck_search', { player: ps.username, card: result.cardName, by: 'Cool Cheese' });
    engine.sync();

    await engine._delay(500);
    const oi = pi === 0 ? 1 : 0;
    await engine.promptGeneric(oi, {
      type: 'deckSearchReveal',
      cardName: result.cardName,
      searcherName: ps.username,
      title: 'Cool Cheese',
      cancellable: false,
    });

    // Step 3: Offer the "pay double" option to avoid the lock. Only
    // shown when the player actually has enough Gold to pay extra —
    // otherwise the lock is inevitable.
    let paidExtra = false;
    if ((ps.gold || 0) >= EXTRA_COST) {
      const confirmed = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: 'Cool Cheese',
        message: `Pay ${EXTRA_COST} more Gold to avoid locking "${result.cardName}" for the rest of this turn?`,
        confirmLabel: `💰 Pay ${EXTRA_COST}`,
        cancelLabel: 'Accept the lock',
        cancellable: true,
        gerrymanderEligible: true, // True "you may" — pay extra to skip lock.
      });
      if (confirmed && !confirmed.cancelled) {
        ps.gold = Math.max(0, (ps.gold || 0) - EXTRA_COST);
        paidExtra = true;
        engine.log('cool_cheese_pay', { player: ps.username, card: result.cardName, amount: EXTRA_COST });
      }
    }

    // Step 4: If they didn't pay, lock the Attack name for the turn.
    if (!paidExtra) {
      if (!ps._creationLockedNames) ps._creationLockedNames = new Set();
      ps._creationLockedNames.add(result.cardName);
      engine.log('cool_cheese_lock', { player: ps.username, card: result.cardName });
    }
    engine.sync();
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
