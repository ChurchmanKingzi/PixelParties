// ═══════════════════════════════════════════
//  CARD EFFECT: "Steam Dwarf Diver"
//  Creature (Summoning Magic Lv1, archetype
//  "Steam Dwarfs") — 50 HP.
//
//  ① STEAM ENGINE passive (shared): whenever you
//    discard 1+ cards, gain +10 current & max HP
//    per discarded card.
//  ② Once per turn: reduce this Creature's
//    current & max HP by 100, then search your
//    deck for any card, reveal it, and add it
//    to your hand. (W17a, Al: nicht aktivierbar,
//    wenn aktuelle ODER maximale HP <= 100.)
// ═══════════════════════════════════════════

const { attachSteamEngine, decreaseCreatureMaxHp } = require('./_steam-dwarf-shared');

const CARD_NAME = 'Steam Dwarf Diver';
const HP_COST = 100;

module.exports = attachSteamEngine({
  creatureEffect: true,

  canActivateCreatureEffect(ctx) {
    const engine = ctx._engine;
    const inst = ctx.card;
    if (!inst || inst.zone !== 'support') return false;
    if (inst.counters?.negated || inst.counters?.nulled) return false;

    // W17a (A03-06, Al 19.10.2026): „Der Diver sollte bei <=100 HP (current oder max) gar nicht aktivierbar sein!" - der Preis
    // (je 100 aktuelle UND maximale HP) muss voll bezahlbar sein, ohne den Diver zu toeten; ein Boden bei 1 entfaellt.
    const cd = engine._getCardDB()[inst.name];
    const maxHp = inst.counters?.maxHp ?? cd?.hp ?? 0;
    const curHp = inst.counters?.currentHp ?? maxHp;
    if (maxHp <= HP_COST || curHp <= HP_COST) return false;

    // Must have at least one card in main deck to search
    const ps = engine.gs.players[ctx.cardOwner];
    if ((ps?.mainDeck || []).length === 0) return false;
    // Hand-locked controllers can't add cards from deck to hand.
    if (ps?.handLocked) return false;
    return true;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const inst = ctx.card;
    const pi = ctx.cardOwner;
    const ps = gs.players[pi];
    if (!ps) return false;

    // Build deduplicated gallery from deck BEFORE paying cost, so the
    // player can cancel if they see nothing worthwhile.
    const countMap = {};
    for (const cardName of (ps.mainDeck || [])) {
      countMap[cardName] = (countMap[cardName] || 0) + 1;
    }
    const galleryCards = Object.entries(countMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, count]) => ({ name, source: 'deck', count }));
    if (galleryCards.length === 0) return false;

    // Preview dive animation on self
    engine._broadcastEvent('play_zone_animation', {
      type: 'steam_puff',
      owner: inst.owner, heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot,
    });
    await engine._delay(250);

    // Show the gallery — cancellable so the player can back out
    const result = await engine.promptGeneric(pi, {
      type: 'cardGallery',
        searchToHand: true,   // v1119: Suche AUF DIE HAND
      cards: galleryCards,
      title: CARD_NAME,
      description: `Pay ${HP_COST} current & max HP and search your deck for any card. Revealed to your opponent.`,
      confirmClass: 'btn-info',
      cancellable: true,
    });

    if (!result || result.cancelled || !result.cardName) return false;

    // Verify the card is actually in the deck
    if (ps.mainDeck.indexOf(result.cardName) < 0) return false;

    // Pay the HP cost now — we've committed
    // ★ W16b (A03-futuretech-06, Text „reduce this Creature's CURRENT and max HP by 100", Muster Rha'Bi/Gobbo): beide Werte zahlen.
    // `decreaseCreatureMaxHp` stutzt die aktuellen HP nur auf das neue Maximum — erst Max senken, dann die aktuellen HP auf
    // (vorher − Preis) setzen. W17a: `canActivateCreatureEffect` garantiert aktuell > 100 und max > 100 (kein Boden 1 mehr noetig).
    const _maxVorher = inst.counters?.maxHp ?? engine._getCardDB()[inst.name]?.hp ?? 0;
    const _curVorher = inst.counters?.currentHp ?? _maxVorher;
    if (_maxVorher <= HP_COST || _curVorher <= HP_COST) return false;   // W17a: HP haben sich waehrend der Wahl verringert -> Preis nicht mehr zahlbar
    decreaseCreatureMaxHp(engine, inst, HP_COST);
    if (inst.counters && inst.counters.maxHp != null) {
      inst.counters.currentHp = Math.min(_curVorher - HP_COST, inst.counters.maxHp);
    }

    // Route through the canonical helper so ON_CARD_ADDED_TO_HAND fires
    // (Cosmic Depths Analyzer / Gatherer key off this hook for any
    // opponent search effect). Helper handles deck splice, hand push,
    // instance tracking, deck-search animation, log entry, hook firing,
    // and opponent reveal prompt.
    await engine.actionAddCardFromDeckToHand(pi, result.cardName, {
      source: 'Steam Dwarf Diver',
      reveal: true,
    });
    engine.log('steam_diver_search', {
      player: ps.username,
      card: result.cardName,
      hpPaid: HP_COST,
    });
    return true;
  },
});
