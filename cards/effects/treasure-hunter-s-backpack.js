// ═══════════════════════════════════════════
//  CARD EFFECT: "Treasure Hunter's Backpack"
//  Artifact (Normal, Cost 10)
//
//  Search the controller's deck for an Equipment
//  Artifact with Cost ≤ 50, place it directly into
//  the chosen Hero's Support Zone (free of charge),
//  then mark that Hero "cannot perform an Action
//  this turn" via the engine's per-hero action
//  lock (`hero._actionLockedTurn = gs.turn`,
//  cleared automatically at turn end).
//
//  The deck-search reveals to the opponent and
//  shuffles afterwards (standard tutor etiquette).
// ═══════════════════════════════════════════

const CARD_NAME = "Treasure Hunter's Backpack";
const MAX_EQUIP_COST = 50;

/** Lookup helper: card data for a given name (cached at module level). */
let _cardDBCache = null;
function _getCardDB() {
  if (_cardDBCache) return _cardDBCache;
  try {
    const allCards = JSON.parse(
      require('fs').readFileSync(require('path').join(__dirname, '../../data/cards.json'), 'utf-8')
    );
    _cardDBCache = {};
    allCards.forEach(c => { _cardDBCache[c.name] = c; });
    return _cardDBCache;
  } catch { return {}; }
}

function isEquipByData(cardName) {
  const cd = _getCardDB()[cardName];
  if (!cd) return false;
  return cd.cardType === 'Artifact' && (cd.subtype || '').toLowerCase() === 'equipment';
}

function countCopies(arr, cardName) {
  let n = 0;
  for (const x of arr) if (x === cardName) n++;
  return n;
}

/** Build a deduplicated gallery of eligible equips in the player's deck. */
function buildEligibleGallery(gs, pi) {
  const ps = gs.players[pi];
  if (!ps) return [];
  const seen = new Set();
  const out = [];
  for (const cardName of (ps.mainDeck || [])) {
    if (seen.has(cardName)) continue;
    if (!isEquipByData(cardName)) continue;
    const cd = _getCardDB()[cardName];
    const cost = cd.cost || 0;
    if (cost > MAX_EQUIP_COST) continue;
    seen.add(cardName);
    out.push({
      name: cardName, source: 'deck', cost,
      count: countCopies(ps.mainDeck, cardName),
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** True if this player has at least one alive hero with a free Support Zone. */
function hasHeroWithFreeZone(ps) {
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name || hero.hp <= 0) continue;
    for (let si = 0; si < 3; si++) {
      if (((ps.supportZones[hi] || [])[si] || []).length === 0) return true;
    }
  }
  return false;
}

module.exports = {
  isTargetingArtifact: true,
  activeIn: ['hand'],

  canActivate(gs, pi) {
    const ps = gs.players[pi];
    if (!ps) return false;
    if (!hasHeroWithFreeZone(ps)) return false;
    return buildEligibleGallery(gs, pi).length > 0;
  },

  // Self-targeting — gallery picker handles selection
  getValidTargets: () => [],

  targetingConfig: {
    description: 'Search your deck for an equippable Artifact (Cost ≤ 50).',
    confirmLabel: '🎒 Unpack!',
    confirmClass: 'btn-info',
    cancellable: true,
    alwaysConfirmable: true,
  },

  validateSelection: () => true,

  animationType: 'none',

  resolve: async (engine, pi /*, selectedIds, validTargets */) => {
    const gs = engine.gs;
    const ps = gs.players[pi];
    if (!ps) return { aborted: true };

    // ── Step 1: pick equip from deck ──
    const gallery = buildEligibleGallery(gs, pi);
    if (gallery.length === 0) return { aborted: true };

    const picked = await engine.promptGeneric(pi, {
      type: 'cardGallery',
      cards: gallery,
      title: CARD_NAME,
      description: `Choose an equippable Artifact (Cost ≤ ${MAX_EQUIP_COST}) from your deck.`,
      cancellable: true,
    });
    if (!picked || picked.cancelled || !picked.cardName) return { aborted: true };

    const equipName = picked.cardName;
    if (!isEquipByData(equipName)) return { aborted: true };
    const deckIdx = ps.mainDeck.indexOf(equipName);
    if (deckIdx < 0) return { aborted: true };

    // ── Step 2: pick destination Hero / Support Zone ──
    const destTargets = [];
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      const hero = ps.heroes[hi];
      if (!hero?.name || hero.hp <= 0) continue;
      if (hero.statuses?.frozen) continue;
      let hasFree = false;
      for (let si = 0; si < 3; si++) {
        if (((ps.supportZones[hi] || [])[si] || []).length === 0) {
          hasFree = true;
          destTargets.push({
            id: `equip-${pi}-${hi}-${si}`,
            type: 'equip', owner: pi, heroIdx: hi, slotIdx: si, cardName: '',
          });
        }
      }
      if (hasFree) {
        destTargets.push({
          id: `hero-${pi}-${hi}`, type: 'hero',
          owner: pi, heroIdx: hi, cardName: hero.name,
        });
      }
    }
    if (destTargets.length === 0) return { aborted: true };

    const destIds = await engine.promptEffectTarget(pi, destTargets, {
      title: `${CARD_NAME} — Equip ${equipName}`,
      description: `Select a Support Zone to equip ${equipName} to. The chosen Hero cannot perform an Action this turn.`,
      confirmLabel: '🎒 Equip!',
      confirmClass: 'btn-info',
      cancellable: true,
      greenSelect: true,
      exclusiveTypes: false,
      maxPerType: { hero: 1, equip: 1 },
    });
    if (!destIds || destIds.length === 0) return { aborted: true };

    const dest = destTargets.find(t => t.id === destIds[0]);
    if (!dest) return { aborted: true };

    let destHeroIdx, destSlot;
    if (dest.type === 'equip') {
      destHeroIdx = dest.heroIdx;
      destSlot    = dest.slotIdx;
    } else {
      destHeroIdx = dest.heroIdx;
      // Auto-pick first free base zone for hero clicks
      for (let si = 0; si < 3; si++) {
        if (((ps.supportZones[destHeroIdx] || [])[si] || []).length === 0) {
          destSlot = si;
          break;
        }
      }
      if (destSlot === undefined) return { aborted: true };
    }

    // Final validation: slot still free + deck still contains the equip
    if (((ps.supportZones[destHeroIdx] || [])[destSlot] || []).length > 0) return { aborted: true };
    const stillIdx = ps.mainDeck.indexOf(equipName);
    if (stillIdx < 0) return { aborted: true };

    // ── Step 3: pull from deck, place in support zone ──
    ps.mainDeck.splice(stillIdx, 1);
    if (!ps.supportZones[destHeroIdx]) ps.supportZones[destHeroIdx] = [[], [], []];
    if (!ps.supportZones[destHeroIdx][destSlot]) ps.supportZones[destHeroIdx][destSlot] = [];
    ps.supportZones[destHeroIdx][destSlot].push(equipName);

    const inst = engine._trackCard(equipName, pi, 'support', destHeroIdx, destSlot);

    engine.sync();

    // ── Step 4: explosion-y animation on the equipped slot ──
    const animSlots = [
      { delay: 0,   type: 'explosion' },
      { delay: 220, type: 'gold_sparkle' },
      { delay: 480, type: 'explosion' },
    ];
    for (const a of animSlots) {
      setTimeout(() => {
        engine._broadcastEvent('play_zone_animation', {
          type: a.type, owner: pi,
          heroIdx: destHeroIdx, zoneSlot: destSlot,
        });
      }, a.delay);
    }
    await engine._delay(900);

    // ── Step 5: fire entry hooks for the just-equipped card ──
    await engine.runHooks('onPlay', {
      _onlyCard: inst, playedCard: inst, cardName: equipName,
      zone: 'support', heroIdx: destHeroIdx, zoneSlot: destSlot,
    });
    await engine.runHooks('onCardEnterZone', {
      enteringCard: inst, toZone: 'support', toHeroIdx: destHeroIdx,
    });

    // ── Step 6: lock the chosen Hero out of acting THIS turn ──
    // The engine clears `_actionLockedTurn` automatically when the turn
    // ends (actually, it's just a stamp matched against gs.turn — when
    // the turn number changes, the stamp becomes stale and the gate no
    // longer fires).
    const destHero = ps.heroes[destHeroIdx];
    if (destHero) {
      destHero._actionLockedTurn = gs.turn;
    }

    // ── Step 7: shuffle deck + reveal to opponent ──
    engine.shuffleDeck(pi, 'main');
    engine._broadcastEvent('deck_search_add', { cardName: equipName, playerIdx: pi });
    const oi = pi === 0 ? 1 : 0;
    await engine.promptGeneric(oi, {
      type: 'deckSearchReveal',
      cardName: equipName,
      searcherName: ps.username,
      title: CARD_NAME,
      cancellable: false,
    });

    engine.log('treasure_hunters_backpack', {
      player: ps.username,
      equip: equipName,
      hero: destHero?.name || '?',
      slot: destSlot,
      lockedTurn: gs.turn,
    });

    engine.sync();
    return true;
  },
};
