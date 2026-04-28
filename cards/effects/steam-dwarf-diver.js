// ═══════════════════════════════════════════
//  CARD EFFECT: "Steam Dwarf Diver"
//  Creature (Summoning Magic Lv1, archetype
//  "Steam Dwarfs") — 50 HP.
//
//  ① STEAM ENGINE passive (shared): once per
//    turn, when you discard 1+ cards, gain +50
//    current & max HP.
//  ② Once per turn: reduce this Creature's
//    current & max HP by 100, then search your
//    deck for any card, reveal it, and add it
//    to your hand. (Requires maxHp >= 200: max
//    can never drop below 1, but the cost is
//    100 so we require a healthy buffer.)
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

    // Must be able to pay the HP cost without dying (max must stay
    // above 0 after paying; we also want some current HP buffer).
    const cd = engine._getCardDB()[inst.name];
    const maxHp = inst.counters?.maxHp ?? cd?.hp ?? 0;
    if (maxHp <= HP_COST) return false;

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
      cards: galleryCards,
      title: CARD_NAME,
      description: `Pay ${HP_COST} current & max HP and search your deck for any card. Revealed to your opponent.`,
      confirmClass: 'btn-info',
      cancellable: true,
    });

    if (!result || result.cancelled || !result.cardName) return false;

    // Verify the card is actually in the deck
    const deckIdx = ps.mainDeck.indexOf(result.cardName);
    if (deckIdx < 0) return false;

    // Pay the HP cost now — we've committed
    decreaseCreatureMaxHp(engine, inst, HP_COST);

    // Remove from deck, add to hand
    ps.mainDeck.splice(deckIdx, 1);
    ps.hand.push(result.cardName);

    // Broadcast reveal + search event
    engine._broadcastEvent('deck_search_add', {
      cardName: result.cardName, playerIdx: pi,
    });
    engine.log('steam_diver_search', {
      player: ps.username,
      card: result.cardName,
      hpPaid: HP_COST,
    });
    engine.sync();
    return true;
  },
});
