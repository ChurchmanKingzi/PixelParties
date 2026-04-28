// ═══════════════════════════════════════════
//  CARD EFFECT: "Sickly Cheese"
//  Artifact (Normal) — Cost 4
//
//  Choose a Hero you control and inflict 1
//  Stack of Poison to it. Then search your
//  deck for a Decay Magic Spell, reveal it
//  and add it to your hand.
//
//  Cannot be used if no Decay Magic Spells
//  remain in the deck.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

module.exports = {
  isTargetingArtifact: true,
  // Tutors a Decay Magic Spell into hand — blocked while hand-locked.
  blockedByHandLock: true,

  canActivate(gs, pi) {
    // Must have at least 1 living hero under control
    const ps = gs.players[pi];
    const hasHero = (ps.heroes || []).some(h => h?.name && h.hp > 0);
    if (!hasHero) return false;

    // Must have at least 1 Decay Magic Spell in deck
    const cardDB = _getCardDB();
    return (ps.mainDeck || []).some(name => {
      const cd = cardDB[name];
      return cd && hasCardType(cd, 'Spell')
        && (cd.spellSchool1 === 'Decay Magic' || cd.spellSchool2 === 'Decay Magic');
    });
  },

  getValidTargets(gs, pi) {
    const ps = gs.players[pi];
    const targets = [];
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      targets.push({
        id: `hero-${pi}-${hi}`,
        type: 'hero',
        owner: pi,
        heroIdx: hi,
        cardName: hero.name,
      });
    }
    return targets;
  },

  targetingConfig: {
    description: 'Choose a Hero you control to Poison (1 Stack), then search your deck for a Decay Magic Spell.',
    confirmLabel: '☠️🧀 Poison & Search!',
    confirmClass: 'btn-danger',
    cancellable: true,
    greenSelect: false,
    exclusiveTypes: true,
    maxPerType: { hero: 1 },
    // CPU hint: this is a self-poison card. The brain's target picker
    // routes through cpuStatusSelfValue so Fiona / Stellan get hit first
    // (both benefit from a negative status) and Layn gets avoided. If no
    // beneficiary is present the picker still picks something so the
    // deck-search payoff isn't skipped.
    appliesStatus: 'poisoned',
  },

  validateSelection(selectedIds, validTargets) {
    return selectedIds && selectedIds.length === 1;
  },

  animationType: 'poison_vial',

  async resolve(engine, pi, selectedIds, validTargets) {
    if (!selectedIds || selectedIds.length === 0) return;
    const target = validTargets.find(t => t.id === selectedIds[0]);
    if (!target || target.type !== 'hero') return;

    const ps = engine.gs.players[pi];
    const hero = ps.heroes?.[target.heroIdx];
    if (!hero?.name || hero.hp <= 0) return;

    // Step 1: Inflict 1 stack of Poison to the chosen hero
    await engine.addHeroStatus(pi, target.heroIdx, 'poisoned', {
      addStacks: 1, appliedBy: pi,
    });
    engine.log('poison_applied', {
      target: hero.name, stacks: 1, by: 'Sickly Cheese',
    });
    engine.sync();
    await engine._delay(400);

    // Step 2: Deck search for Decay Magic Spells
    const cardDB = engine._getCardDB();
    const countMap = {};
    for (const cardName of (ps.mainDeck || [])) {
      const cd = cardDB[cardName];
      if (!cd || !hasCardType(cd, 'Spell')) continue;
      if (cd.spellSchool1 !== 'Decay Magic' && cd.spellSchool2 !== 'Decay Magic') continue;
      countMap[cardName] = (countMap[cardName] || 0) + 1;
    }

    const galleryCards = Object.entries(countMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, count]) => ({ name, source: 'deck', count }));

    if (galleryCards.length === 0) return;

    const result = await engine.promptGeneric(pi, {
      type: 'cardGallery',
      cards: galleryCards,
      title: 'Sickly Cheese',
      description: 'Choose a Decay Magic Spell to add to your hand.',
      cancellable: false,
    });

    if (!result || !result.cardName) return;

    // Verify the chosen card is actually in the deck and qualifies
    const deckIdx = ps.mainDeck.indexOf(result.cardName);
    if (deckIdx < 0) return;
    const cd = cardDB[result.cardName];
    if (!cd || !hasCardType(cd, 'Spell')) return;
    if (cd.spellSchool1 !== 'Decay Magic' && cd.spellSchool2 !== 'Decay Magic') return;

    // Remove from deck, add to hand
    ps.mainDeck.splice(deckIdx, 1);
    ps.hand.push(result.cardName);

    // Broadcast deck search event (face-up draw animation for opponent)
    engine._broadcastEvent('deck_search_add', { cardName: result.cardName, playerIdx: pi });
    engine.log('deck_search', { player: ps.username, card: result.cardName, by: 'Sickly Cheese' });
    engine.sync();

    // Show reveal prompt to opponent
    await engine._delay(500);
    const oi = pi === 0 ? 1 : 0;
    await engine.promptGeneric(oi, {
      type: 'deckSearchReveal',
      cardName: result.cardName,
      searcherName: ps.username,
      title: 'Sickly Cheese',
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
