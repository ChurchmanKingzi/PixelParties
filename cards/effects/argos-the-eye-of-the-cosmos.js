// ═══════════════════════════════════════════
//  CARD EFFECT: "Argos, the Eye of the Cosmos"
//  Hero (400 HP, 80 ATK)
//  Cosmic Depths archetype.
//  NOTE: Argos is NOT a "Cosmic" card by name
//  ("Cosmos" ≠ "Cosmic"), so Argos cannot
//  summon/place "Invader from the Cosmic Depths"
//  — Invader's "summoned by Cosmic" gate
//  rejects, and Argos's place picker filters
//  Invader out at gallery-build time.
//
//  PASSIVE 1 (opp turn-start): put as many Change
//  Counters onto Argos as opp.hand.length.
//
//  PASSIVE 2 (own turn-start): remove as many
//  Change Counters from Argos as opp.hand.length.
//  Clamps at current count.
//
//  HERO EFFECT (HOPT, Main Phase): remove ANY
//  number of Change Counters from Argos to PLACE
//  a "Cosmic Depths" Creature from your hand or
//  deck whose level == counters removed into
//  Argos's free Support Zone.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const {
  COSMIC_DEPTHS_CREATURES,
  getChangeCounters, addChangeCounters, removeChangeCounters,
  canSummonInvaderViaSource,
} = require('./_cosmic-shared');

const CARD_NAME = 'Argos, the Eye of the Cosmos';

function findArgosFreeSlot(ps, heroIdx) {
  const zones = ps.supportZones?.[heroIdx] || [[], [], []];
  for (let zi = 0; zi < 3; zi++) {
    if ((zones[zi] || []).length === 0) return zi;
  }
  return -1;
}

/** CD Creatures of an exact level present in hand or deck (deduped names). */
function cdCreaturesAtLevelInHandOrDeck(engine, pi, lvl) {
  const cardDB = engine._getCardDB();
  const ps = engine.gs.players[pi];
  const seen = new Set();
  const out = [];
  const scan = (list, source) => {
    for (const cn of (list || [])) {
      if (seen.has(cn)) continue;
      if (!COSMIC_DEPTHS_CREATURES.has(cn)) continue;
      const cd = cardDB[cn];
      if (!cd || (cd.level ?? 0) !== lvl) continue;
      // Argos isn't a Cosmic card, so Invader can't be placed via Argos.
      if (!canSummonInvaderViaSource(cn, CARD_NAME)) continue;
      seen.add(cn);
      out.push({ name: cn, source });
    }
  };
  scan(ps?.hand, 'hand');
  scan(ps?.mainDeck, 'deck');
  return out;
}

module.exports = {
  activeIn: ['hero'],
  heroEffect: true,

  // CPU eval declaration — Argos converts Change Counters into board
  // (place a CD Creature of level N from hand/deck). With at least
  // one alive Argos, Change Counters on this side score at the
  // higher "consumer" rate in evaluateState.
  cpuMeta: {
    counterConsumer: true,
  },

  // Argos opens three prompts in sequence: level picker, creature
  // gallery, source picker. The CPU's default heuristics handle the
  // first two acceptably (the level picker's "last option" matches the
  // highest level — the strongest pick when affordable, and the
  // gallery uses `pickBestGalleryCard`). The SOURCE picker (hand vs
  // deck) needs a smarter default: picking `deck` triggers Cosmic
  // Manipulation's reaction if CM is in hand (huge tempo bonus), but
  // wastes deck count otherwise. Picking `hand` preserves the deck
  // and avoids signalling our search.
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic') return undefined;
    if (promptData?.type !== 'optionPicker') return undefined;
    const optIds = (promptData.options || []).map(o => o?.id);
    // Source picker has exactly { hand, deck } option ids.
    const isSourcePicker = optIds.length === 2
      && optIds.includes('hand') && optIds.includes('deck');
    if (!isSourcePicker) return undefined;

    const cpuIdx = engine._cpuPlayerIdx;
    const ps = engine.gs.players[cpuIdx];
    if (!ps) return undefined;

    // If Cosmic Manipulation is in hand, prefer deck — the CM reaction
    // fires on direct-from-deck summons and yields draws + counters.
    if ((ps.hand || []).includes('Cosmic Manipulation')) {
      return { optionId: 'deck' };
    }
    // Otherwise prefer hand to preserve deck thickness and avoid
    // burning a search this turn.
    return { optionId: 'hand' };
  },

  hooks: {
    // ── Passive 1: Opp turn-start → +counters = opp.hand.length ────
    onTurnStart: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const hero = gs.players[pi]?.heroes?.[ctx.cardHeroIdx];
      if (!hero?.name || hero.hp <= 0) return;

      const oppIdx = pi === 0 ? 1 : 0;
      const oppHandSize = (gs.players[oppIdx]?.hand || []).length;

      if (ctx.isMyTurn) {
        // OWN turn-start — remove counters = opp.hand.length (clamped).
        if (oppHandSize <= 0) return;
        const cur = getChangeCounters(hero);
        if (cur <= 0) return;
        const removed = Math.min(cur, oppHandSize);
        removeChangeCounters(engine, hero, removed);
        engine.log('argos_drain', {
          player: gs.players[pi]?.username, removed, remaining: cur - removed,
        });
      } else {
        // OPP turn-start — add counters = opp.hand.length.
        if (oppHandSize <= 0) return;
        addChangeCounters(engine, hero, oppHandSize);
        engine.log('argos_charge', {
          player: gs.players[pi]?.username, added: oppHandSize,
        });
      }
    },
  },

  canActivateHeroEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const hero = gs.players[pi]?.heroes?.[ctx.cardHeroIdx];
    if (!hero?.name || hero.hp <= 0) return false;

    // Need ≥1 counter to remove, ≥1 free zone on Argos, and ≥1 CD
    // Creature available at any qualifying level. Level cap = current
    // counter count (you can't remove more than you have).
    const have = getChangeCounters(hero);
    if (have < 1) return false;
    const ps = gs.players[pi];
    if (findArgosFreeSlot(ps, ctx.cardHeroIdx) < 0) return false;

    for (let lvl = 1; lvl <= have; lvl++) {
      if (cdCreaturesAtLevelInHandOrDeck(engine, pi, lvl).length > 0) return true;
    }
    return false;
  },

  async onHeroEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const ps = gs.players[pi];
    const hero = ps?.heroes?.[heroIdx];
    if (!hero?.name || hero.hp <= 0) return false;

    const have = getChangeCounters(hero);
    if (have < 1) return false;

    const slot = findArgosFreeSlot(ps, heroIdx);
    if (slot < 0) return false;

    // Step 1: which level? Show only levels with ≥1 candidate.
    const levelOptions = [];
    for (let lvl = 1; lvl <= have; lvl++) {
      const candidates = cdCreaturesAtLevelInHandOrDeck(engine, pi, lvl);
      if (candidates.length === 0) continue;
      levelOptions.push({
        id: String(lvl),
        label: `Lv${lvl} — remove ${lvl} counter${lvl === 1 ? '' : 's'} (${candidates.length} option${candidates.length === 1 ? '' : 's'})`,
      });
    }
    if (levelOptions.length === 0) return false;

    const lvlPick = await engine.promptGeneric(pi, {
      type: 'optionPicker',
      title: CARD_NAME,
      description: `Remove how many Change Counters? (You have ${have}. The creature you place must be of matching level.)`,
      options: levelOptions,
      cancellable: true,
    });
    if (!lvlPick || lvlPick.cancelled) return false;
    const chosenLvl = parseInt(lvlPick.optionId, 10);
    if (!Number.isInteger(chosenLvl) || chosenLvl < 1 || chosenLvl > have) return false;

    // Step 2: which creature? Build gallery of (hand + deck) candidates.
    const candidates = cdCreaturesAtLevelInHandOrDeck(engine, pi, chosenLvl);
    if (candidates.length === 0) return false;

    // Count copies per name (across hand + deck combined for the
    // gallery display; the source is committed at the splice step).
    const tally = {};
    for (const c of candidates) {
      const key = c.name;
      if (!tally[key]) tally[key] = { hand: 0, deck: 0 };
      const ps2 = gs.players[pi];
      const handCount = (ps2?.hand || []).filter(n => n === c.name).length;
      const deckCount = (ps2?.mainDeck || []).filter(n => n === c.name).length;
      tally[key].hand = handCount;
      tally[key].deck = deckCount;
    }
    const gallery = Object.entries(tally)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, t]) => ({
        name, source: 'mixed', count: t.hand + t.deck,
      }));

    const pickCard = await engine.promptGeneric(pi, {
      type: 'cardGallery',
      cards: gallery,
      title: CARD_NAME,
      description: `Place which Lv${chosenLvl} "Cosmic Depths" Creature into ${hero.name}'s free Support Zone?`,
      cancellable: false,
    });
    if (!pickCard?.cardName) return false;
    const chosenName = pickCard.cardName;
    if (!candidates.some(c => c.name === chosenName)) return false;

    // Step 3: source — prefer hand if available; else deck. (Player
    // can't have "neither" because the candidate was built from
    // hand+deck and at least one source contains it.)
    const handIdx = (ps.hand || []).indexOf(chosenName);
    const deckIdx = (ps.mainDeck || []).indexOf(chosenName);
    let source;
    if (handIdx >= 0 && deckIdx >= 0) {
      // Both — let the player pick.
      const opts = [
        { id: 'hand', label: 'From your hand' },
        { id: 'deck', label: 'From your deck' },
      ];
      const srcPick = await engine.promptGeneric(pi, {
        type: 'optionPicker',
        title: CARD_NAME,
        description: `Where should ${chosenName} come from?`,
        options: opts, cancellable: false,
      });
      source = srcPick?.optionId || 'hand';
    } else if (handIdx >= 0) source = 'hand';
    else source = 'deck';

    // Pay the counter cost AFTER the source is locked in (so a UI
    // dismiss before this point doesn't cost counters).
    removeChangeCounters(engine, hero, chosenLvl);

    // Splice from source.
    if (source === 'hand') {
      const idx = (ps.hand || []).indexOf(chosenName);
      if (idx < 0) return false;
      ps.hand.splice(idx, 1);
      if (gs._scTracking && pi >= 0 && pi < 2) gs._scTracking[pi].cardsPlayedFromHand++;
    } else {
      const idx = (ps.mainDeck || []).indexOf(chosenName);
      if (idx < 0) return false;
      ps.mainDeck.splice(idx, 1);
      // Reveal to opp on a deck-search.
      engine._broadcastEvent('deck_search_add', { cardName: chosenName, playerIdx: pi });
    }

    engine._broadcastEvent('play_zone_animation', {
      type: 'cosmic_summon',
      owner: pi, heroIdx, zoneSlot: slot,
    });
    await engine._delay(550);

    // SILENT PLACEMENT — Argos's text says "place," not "summon." Skip
    // hooks. Cosmic Manipulation's "summon directly from deck" trigger
    // is NOT fired (Argos isn't a "summon" event in card-text terms).
    const placeRes = engine.summonCreature(chosenName, pi, heroIdx, slot, {
      source: CARD_NAME,
    });
    if (!placeRes) return false;

    engine.log('argos_place', {
      player: ps.username,
      lvl: chosenLvl, creature: chosenName, source,
    });
    engine.sync();
    return true;
  },
};
