// ═══════════════════════════════════════════
//  CARD EFFECT: "Angry Cheese"
//  Artifact (Normal) — Cost 4
//
//  Choose a Hero you control and deal 100
//  damage to it. Then search your deck for a
//  Destruction Magic Spell, reveal it, and add
//  it to your hand.
//
//  Sibling of Sickly Cheese (Decay Magic /
//  Poison cost) and Cute Cheese (Creature,
//  no cost). The self-damage is 'other' type so
//  it's straightforward — shields on your own
//  hero can still absorb it, same as Diamond's
//  self-damage.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

module.exports = {
  isTargetingArtifact: true,
  blockedByHandLock: true,

  canActivate(gs, pi) {
    const ps = gs.players[pi];
    if (!ps) return false;
    // Need at least 1 living hero to take the damage cost
    const hasHero = (ps.heroes || []).some(h => h?.name && h.hp > 0);
    if (!hasHero) return false;
    // Must have at least 1 Destruction Magic Spell left in deck
    const cardDB = _getCardDB();
    return (ps.mainDeck || []).some(name => {
      const cd = cardDB[name];
      return cd && hasCardType(cd, 'Spell')
        && (cd.spellSchool1 === 'Destruction Magic' || cd.spellSchool2 === 'Destruction Magic');
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
        type: 'hero', owner: pi, heroIdx: hi,
        cardName: hero.name,
      });
    }
    return targets;
  },

  targetingConfig: {
    description: 'Choose a Hero you control to take 100 damage, then search your deck for a Destruction Magic Spell.',
    confirmLabel: '💥🧀 Damage & Search!',
    confirmClass: 'btn-danger',
    cancellable: true,
    exclusiveTypes: true,
    maxPerType: { hero: 1 },
  },

  validateSelection(selectedIds /*, validTargets*/) {
    return selectedIds && selectedIds.length === 1;
  },

  animationType: 'explosion',

  async resolve(engine, pi, selectedIds, validTargets) {
    if (!selectedIds || selectedIds.length === 0) return;
    const target = validTargets.find(t => t.id === selectedIds[0]);
    if (!target || target.type !== 'hero') return;

    const ps = engine.gs.players[pi];
    const hero = ps?.heroes?.[target.heroIdx];
    if (!hero?.name || hero.hp <= 0) return;

    // Step 1: Deal 100 damage to the chosen own Hero (cost)
    await engine.actionDealDamage({ name: 'Angry Cheese' }, hero, 100, 'other');
    engine.sync();
    await engine._delay(400);

    // Step 2: Deck search for a Destruction Magic Spell
    const cardDB = engine._getCardDB();
    const countMap = {};
    for (const cardName of (ps.mainDeck || [])) {
      const cd = cardDB[cardName];
      if (!cd || !hasCardType(cd, 'Spell')) continue;
      if (cd.spellSchool1 !== 'Destruction Magic' && cd.spellSchool2 !== 'Destruction Magic') continue;
      countMap[cardName] = (countMap[cardName] || 0) + 1;
    }

    const galleryCards = Object.entries(countMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, count]) => ({ name, source: 'deck', count }));

    if (galleryCards.length === 0) return;

    const result = await engine.promptGeneric(pi, {
      type: 'cardGallery',
      cards: galleryCards,
      title: 'Angry Cheese',
      description: 'Choose a Destruction Magic Spell to add to your hand.',
      cancellable: false,
    });
    if (!result || !result.cardName) return;

    // Verify the chosen card is still in the deck and qualifies
    const deckIdx = ps.mainDeck.indexOf(result.cardName);
    if (deckIdx < 0) return;
    const cd = cardDB[result.cardName];
    if (!cd || !hasCardType(cd, 'Spell')) return;
    if (cd.spellSchool1 !== 'Destruction Magic' && cd.spellSchool2 !== 'Destruction Magic') return;

    // Move from deck to hand + opponent reveal
    ps.mainDeck.splice(deckIdx, 1);
    ps.hand.push(result.cardName);
    engine._broadcastEvent('deck_search_add', { cardName: result.cardName, playerIdx: pi });
    engine.log('deck_search', { player: ps.username, card: result.cardName, by: 'Angry Cheese' });
    engine.sync();

    await engine._delay(500);
    const oi = pi === 0 ? 1 : 0;
    await engine.promptGeneric(oi, {
      type: 'deckSearchReveal',
      cardName: result.cardName,
      searcherName: ps.username,
      title: 'Angry Cheese',
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
