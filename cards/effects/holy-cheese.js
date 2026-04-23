// ═══════════════════════════════════════════
//  CARD EFFECT: "Holy Cheese"
//  Artifact (Normal) — Cost 4
//
//  Search your deck for a Support Magic Spell,
//  reveal it and add it to your hand. Then your
//  opponent may choose a target they control
//  and heal it for 100 HP.
//
//  The opponent's heal is a "may" — they can
//  cancel the selection prompt to skip (useful
//  if every candidate is already at full HP).
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

module.exports = {
  isTargetingArtifact: true,
  blockedByHandLock: true,

  canActivate(gs, pi) {
    const ps = gs.players[pi];
    if (!ps) return false;
    // Must have at least 1 Support Magic Spell left in deck
    const cardDB = _getCardDB();
    return (ps.mainDeck || []).some(name => {
      const cd = cardDB[name];
      return cd && hasCardType(cd, 'Spell')
        && (cd.spellSchool1 === 'Support Magic' || cd.spellSchool2 === 'Support Magic');
    });
  },

  // No board targets — search picks from a deck gallery in resolve().
  getValidTargets: () => [],

  targetingConfig: {
    description: 'Search your deck for a Support Magic Spell. Your opponent will then heal a target they control for 100 HP.',
    confirmLabel: '✨🧀 Search!',
    confirmClass: 'btn-success',
    cancellable: true,
    alwaysConfirmable: true,
  },

  validateSelection: () => true,

  animationType: 'gold_sparkle',

  async resolve(engine, pi) {
    const ps = engine.gs.players[pi];
    if (!ps) return;
    const oi = pi === 0 ? 1 : 0;

    // ── Step 1: Deck search for a Support Magic Spell ──
    const cardDB = engine._getCardDB();
    const countMap = {};
    for (const cardName of (ps.mainDeck || [])) {
      const cd = cardDB[cardName];
      if (!cd || !hasCardType(cd, 'Spell')) continue;
      if (cd.spellSchool1 !== 'Support Magic' && cd.spellSchool2 !== 'Support Magic') continue;
      countMap[cardName] = (countMap[cardName] || 0) + 1;
    }

    const galleryCards = Object.entries(countMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, count]) => ({ name, source: 'deck', count }));

    if (galleryCards.length === 0) return;

    const result = await engine.promptGeneric(pi, {
      type: 'cardGallery',
      cards: galleryCards,
      title: 'Holy Cheese',
      description: 'Choose a Support Magic Spell to add to your hand.',
      cancellable: false,
    });
    if (!result || !result.cardName) return;

    const deckIdx = ps.mainDeck.indexOf(result.cardName);
    if (deckIdx < 0) return;
    const cd = cardDB[result.cardName];
    if (!cd || !hasCardType(cd, 'Spell')) return;
    if (cd.spellSchool1 !== 'Support Magic' && cd.spellSchool2 !== 'Support Magic') return;

    // Move from deck to hand + opponent reveal
    ps.mainDeck.splice(deckIdx, 1);
    ps.hand.push(result.cardName);
    engine._broadcastEvent('deck_search_add', { cardName: result.cardName, playerIdx: pi });
    engine.log('deck_search', { player: ps.username, card: result.cardName, by: 'Holy Cheese' });
    engine.sync();

    await engine._delay(500);
    await engine.promptGeneric(oi, {
      type: 'deckSearchReveal',
      cardName: result.cardName,
      searcherName: ps.username,
      title: 'Holy Cheese',
      cancellable: false,
    });

    // ── Step 2: Opponent picks one of their own targets to heal for 100 ──
    // Targets = living heroes on their side + face-up Creatures in their
    // support zones (including those attached to dead hero columns —
    // creatures persist past their host hero's death).
    const oppHeroes = engine.getHeroTargets(oi);
    const oppCreatures = engine.getCreatureTargets(oi);
    const healTargets = [...oppHeroes, ...oppCreatures];

    if (healTargets.length === 0) return;

    const picked = await engine.promptEffectTarget(oi, healTargets, {
      title: 'Holy Cheese',
      description: 'Choose a target you control to heal for 100 HP — or cancel to skip.',
      confirmLabel: '💚 Heal (100)',
      confirmClass: 'btn-success',
      cancellable: true,
      greenSelect: true,
      exclusiveTypes: true,
      maxPerType: { hero: 1, equip: 1 },
      maxTotal: 1,
    });
    if (!picked || picked.length === 0) {
      engine.log('holy_cheese_skip', { player: engine.gs.players[oi]?.username });
      return;
    }

    const chosen = healTargets.find(t => t.id === picked[0]);
    if (!chosen) return;

    const source = { name: 'Holy Cheese' };
    if (chosen.type === 'hero') {
      const opsHero = engine.gs.players[chosen.owner]?.heroes?.[chosen.heroIdx];
      if (!opsHero || opsHero.hp <= 0) return;
      await engine.actionHealHero(source, opsHero, 100);
    } else if (chosen.type === 'equip') {
      const inst = chosen.cardInstance || engine.cardInstances.find(c =>
        c.owner === chosen.owner && c.zone === 'support' &&
        c.heroIdx === chosen.heroIdx && c.zoneSlot === chosen.slotIdx
      );
      if (!inst) return;
      await engine.actionHealCreature(source, inst, 100);
    }

    engine.log('holy_cheese_heal', {
      opponent: engine.gs.players[oi]?.username,
      target: chosen.cardName,
      amount: 100,
    });
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
