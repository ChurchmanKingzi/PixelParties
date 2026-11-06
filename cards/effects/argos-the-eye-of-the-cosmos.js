// ═══════════════════════════════════════════
//  CARD EFFECT: "Argos, the Eye of the Cosmos"
//  Hero (400 HP, 80 ATK)
//  Cosmic Depths archetype.
//  Argos counts as a "Cosmic" summoner via the
//  archetype-membership check in `isCosmicCard`
//  (he's in `COSMIC_DEPTHS_ANY`), so his hero
//  effect CAN place "Invader from the Cosmic
//  Depths" — Invader's "summoned by Cosmic" gate
//  passes for archetype family members regardless
//  of the literal "Cosmic" substring.
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
//
//  "Place" here means "summon a Creature
//  regardless of its level" — the placed Creature
//  fires its normal on-play / entering-zone
//  hooks, and a deck-source placement triggers
//  Cosmic Manipulation just like any other
//  direct-from-deck summon does.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const {
  COSMIC_DEPTHS_CREATURES,
  getChangeCounters, addChangeCounters, removeChangeCounters,
  canSummonInvaderViaSource, invaderLimitAllows,
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
      // Belt-and-suspenders: with the archetype-based `isCosmicCard`,
      // this returns true for Invader-via-Argos. Kept so a future
      // tightening of the rule (e.g. restricting Invader placement
      // to specific Cosmic sources) lands here cleanly without
      // touching every CD card's picker.
      if (!canSummonInvaderViaSource(cn, CARD_NAME)) continue;
      // 1-Invader-Limit schon bei der Auswahl, sonst geht die Karte beim Platzieren verloren.
      if (!invaderLimitAllows(engine, pi, cn)) continue;
      seen.add(cn);
      out.push({ name: cn, source });
    }
  };
  scan(ps?.hand, 'hand');
  scan(ps?.mainDeck, 'deck');
  return out;
}

/** Gallery entries of the placeable CD Creatures at an exact level: one per name AND source (hand first, then deck), each with its origin label. */
function cdEintraegeAtLevel(engine, pi, lvl) {
  const ps = engine.gs.players[pi];
  const out = [];
  for (const quelle of ['hand', 'deck']) {
    const liste = quelle === 'hand' ? ps?.hand : ps?.mainDeck;
    const names = new Set();
    for (const c of cdCreaturesAtLevelInHandOrDeck(engine, pi, lvl)) names.add(c.name);
    const gezaehlt = {};
    for (const n of (liste || [])) if (names.has(n)) gezaehlt[n] = (gezaehlt[n] || 0) + 1;
    for (const [name, count] of Object.entries(gezaehlt).sort(([x], [y]) => x.localeCompare(y))) out.push({ name, source: quelle, ...(quelle === 'deck' ? { count } : {}) });
  }
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

  // Argos opens two prompts in sequence: the level picker and ONE creature gallery for hand AND deck (each entry carries its HAND / DECK label). The CPU's default heuristics
  // handle the level picker acceptably except that the optionPicker default takes the FIRST option — the CPU only ever placed Lv1 even with full counters. Argos' counters
  // expire at his own turn start (Passive 2), "use it or lose it": take the highest available level. The gallery's creature choice is the default (`pickBestGalleryCard`);
  // for the SAME creature in both sources the prompt's `cpuSourceOrder` decides: deck first with Cosmic Manipulation in hand (its reaction fires on direct-from-deck
  // summons and yields draws + counters), otherwise hand first (preserves deck thickness, no search signal).
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic') return undefined;
    if (promptData?.type !== 'optionPicker') return undefined;
    const optIds = (promptData.options || []).map(o => o?.id);
    const numeric = optIds.filter(id => /^\d+$/.test(id || ''));
    if (numeric.length === optIds.length && numeric.length > 0) {
      const best = numeric.map(Number).sort((a, b) => b - a)[0];
      return { optionId: String(best) };
    }
    return undefined;
  },

  hooks: {
    // ── Passive 1: Opp turn-start → +counters = opp.hand.length ────
    onTurnStart: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      // Kontrolle statt Seite (Styx 28.9.): physische Seite des Helden
      const feld = ctx.cardHeroOwner ?? pi;
      const hero = gs.players[feld]?.heroes?.[ctx.cardHeroIdx];
      if (!hero?.name || hero.hp <= 0) return;

      const oppIdx = engine.opponentOf(pi);
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
    // Kontrolle statt Seite (Styx 28.9.): physische Seite des Helden
    const feld = ctx.cardHeroOwner ?? pi;
    const hero = gs.players[feld]?.heroes?.[ctx.cardHeroIdx];
    if (!hero?.name || hero.hp <= 0) return false;

    // Need ≥1 counter to remove, ≥1 free zone on Argos, and ≥1 CD
    // Creature available at any qualifying level. Level cap = current
    // counter count (you can't remove more than you have).
    const have = getChangeCounters(hero);
    if (have < 1) return false;
    if (findArgosFreeSlot(gs.players[feld], ctx.cardHeroIdx) < 0) return false;

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
    // Kontrolle statt Seite (Styx 28.9.): physische Seite des Helden
    const feld = ctx.cardHeroOwner ?? pi;
    const hero = gs.players[feld]?.heroes?.[heroIdx];
    if (!hero?.name || hero.hp <= 0) return false;

    const have = getChangeCounters(hero);
    if (have < 1) return false;

    const slot = findArgosFreeSlot(gs.players[feld], heroIdx);
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

    // Step 2: which creature — and from where? EIN Picker für Hand UND Deck (CARD_API „Mehrere Quellen = ein Picker"): jede wählbare Kreatur je Quelle ein Eintrag mit
    // Herkunfts-Label (HAND / DECK); gleichnamige Karten in beiden Quellen sind zwei Einträge. Es gibt keine Vorfrage „Hand oder Deck?" mehr.
    const eintraege = cdEintraegeAtLevel(engine, pi, chosenLvl);
    if (eintraege.length === 0) return false;
    // Reihenfolge der Quellen für die CPU: Cosmic Manipulation auf der Hand → erst Deck (die Reaktion feuert bei Deck-Beschwörungen), sonst Hand schonen (kein Such-Signal).
    const cmInHand = (ps.hand || []).includes('Cosmic Manipulation');
    const pickCard = await engine.promptGeneric(pi, {
      type: 'cardGallery',
      cards: eintraege,
      title: CARD_NAME,
      description: `Place which Lv${chosenLvl} "Cosmic Depths" Creature into ${hero.name}'s free Support Zone — from your hand or your deck?`,
      cancellable: false,
      cpuSourceOrder: cmInHand ? ['deck', 'hand'] : ['hand', 'deck'],
    });
    if (!pickCard?.cardName) return false;
    const chosenName = pickCard.cardName;
    // Herkunft: die Antwort nennt sie; fehlt sie (Automat), gilt die erste passende Karte (Hand vor Deck).
    const treffer = eintraege.find(e => e.name === chosenName && (!pickCard.source || e.source === pickCard.source));
    if (!treffer) return false;
    const source = treffer.source;

    // Pay the counter cost AFTER the source is locked in (so a UI
    // dismiss before this point doesn't cost counters).
    removeChangeCounters(engine, hero, chosenLvl);

    // Splice from source.
    if (source === 'hand') {
      const idx = (ps.hand || []).indexOf(chosenName);
      if (idx < 0) return false;
      engine.takeFromPileSync(ps, 'hand', idx);
      engine.notePlayedFromHand(pi);
    } else {
      const _taken_idx = await engine.deckEntnahme(ps,  chosenName, { source: CARD_NAME });   // v820: Stapel-Schicht
      if (!_taken_idx) return false;
      // Reveal to opp on a deck-search.
      engine._broadcastEvent('deck_search_add', { cardName: chosenName, playerIdx: pi });
    }

    engine._broadcastEvent('play_zone_animation', {
      type: 'cosmic_summon',
      owner: feld, heroIdx, zoneSlot: slot,
    });
    await engine._delay(550);

    // REAL SUMMON for the placed creature — "place" in Argos's text
    // means "summon a Creature regardless of its level"; the on-play
    // and entering-zone hooks fire normally so the summoned Creature
    // gets its on-summon effects. `_summonedFromDeck` is set when the
    // source was the deck, which is what Cosmic Manipulation's post-
    // summon hand-reaction window keys off of.
    // Kontrolle statt Seite (Styx 28.9.): physische Seite des Helden
    const placeRes = await engine.summonCreatureWithHooks(chosenName, feld, heroIdx, slot, {
      source: CARD_NAME,
      isPlacement: true,
      ...(feld !== pi ? { controller: pi } : {}),
      hookExtras: {
        _summonedBy: CARD_NAME,
        ...(source === 'deck' ? engine.deckHookExtras() : {}),   // v1393
      },
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
