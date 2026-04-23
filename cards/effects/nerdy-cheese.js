// ═══════════════════════════════════════════
//  CARD EFFECT: "Nerdy Cheese"
//  Artifact (Normal) — Cost 4
//
//  Search your deck for a Magic Arts Spell and
//  delete it. Then, add a Spell with the same
//  name from your deck to your hand.
//
//  Net effect: pick a Magic Arts Spell name in
//  your deck; one copy is deleted (irrecoverable),
//  then if another copy of the SAME name still
//  sits in the deck, it's revealed and added to
//  your hand. If only one copy exists, the
//  deletion still resolves but nothing is added.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

module.exports = {
  isTargetingArtifact: true,
  blockedByHandLock: true,

  canActivate(gs, pi) {
    const ps = gs.players[pi];
    if (!ps) return false;
    // Need at least 1 Magic Arts Spell left in deck
    const cardDB = _getCardDB();
    return (ps.mainDeck || []).some(name => {
      const cd = cardDB[name];
      return cd && hasCardType(cd, 'Spell')
        && (cd.spellSchool1 === 'Magic Arts' || cd.spellSchool2 === 'Magic Arts');
    });
  },

  // No board targets — search picks from a deck gallery in resolve().
  getValidTargets: () => [],

  targetingConfig: {
    description: 'Delete a Magic Arts Spell from your deck. If another copy remains, add one to your hand.',
    confirmLabel: '🤓🧀 Delete & Search!',
    confirmClass: 'btn-warning',
    cancellable: true,
    alwaysConfirmable: true,
  },

  validateSelection: () => true,

  animationType: 'gold_sparkle',

  async resolve(engine, pi) {
    const ps = engine.gs.players[pi];
    if (!ps) return;
    const oi = pi === 0 ? 1 : 0;

    // Gallery of all distinct Magic Arts Spell names in the deck with counts
    const cardDB = engine._getCardDB();
    const countMap = {};
    for (const cardName of (ps.mainDeck || [])) {
      const cd = cardDB[cardName];
      if (!cd || !hasCardType(cd, 'Spell')) continue;
      if (cd.spellSchool1 !== 'Magic Arts' && cd.spellSchool2 !== 'Magic Arts') continue;
      countMap[cardName] = (countMap[cardName] || 0) + 1;
    }

    const galleryCards = Object.entries(countMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, count]) => ({ name, source: 'deck', count }));

    if (galleryCards.length === 0) return;

    const result = await engine.promptGeneric(pi, {
      type: 'cardGallery',
      cards: galleryCards,
      title: 'Nerdy Cheese',
      description: 'Choose a Magic Arts Spell — one copy will be deleted, another added to your hand.',
      cancellable: false,
    });
    if (!result || !result.cardName) return;

    // Verify the chosen card is still in the deck and qualifies
    const deleteIdx = ps.mainDeck.indexOf(result.cardName);
    if (deleteIdx < 0) return;
    const cd = cardDB[result.cardName];
    if (!cd || !hasCardType(cd, 'Spell')) return;
    if (cd.spellSchool1 !== 'Magic Arts' && cd.spellSchool2 !== 'Magic Arts') return;

    // ── Step 1: Delete one copy from deck to the deleted pile ──
    ps.mainDeck.splice(deleteIdx, 1);
    ps.deletedPile.push(result.cardName);
    // Visual cue — the client's `deck_to_deleted` handler (app-board.jsx
    // onDeckToDeleted) expects `{ owner, cards: string[] }` and animates
    // each named card flying from the owner's deck to their deleted pile.
    engine._broadcastEvent('deck_to_deleted', {
      owner: pi, cards: [result.cardName],
    });
    engine.log('nerdy_cheese_delete', {
      player: ps.username, card: result.cardName,
    });
    engine.sync();
    await engine._delay(500);

    // ── Step 2: If another copy still sits in the deck, tutor it to hand ──
    const tutorIdx = ps.mainDeck.indexOf(result.cardName);
    if (tutorIdx < 0) {
      // Only one copy existed — deletion resolved, nothing to add.
      engine.log('nerdy_cheese_no_duplicate', {
        player: ps.username, card: result.cardName,
      });
      return;
    }

    ps.mainDeck.splice(tutorIdx, 1);
    ps.hand.push(result.cardName);
    engine._broadcastEvent('deck_search_add', { cardName: result.cardName, playerIdx: pi });
    engine.log('deck_search', {
      player: ps.username, card: result.cardName, by: 'Nerdy Cheese',
    });
    engine.sync();

    // Opponent reveal, same as the other search artifacts
    await engine._delay(500);
    await engine.promptGeneric(oi, {
      type: 'deckSearchReveal',
      cardName: result.cardName,
      searcherName: ps.username,
      title: 'Nerdy Cheese',
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
