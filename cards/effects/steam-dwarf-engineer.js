// ═══════════════════════════════════════════
//  CARD EFFECT: "Steam Dwarf Engineer"
//  Creature (Summoning Magic Lv1, archetype
//  "Steam Dwarfs") — 50 HP.
//
//  ① STEAM ENGINE passive (shared): once per
//    turn, when you discard 1+ cards, gain +50
//    current & max HP.
//  ② Once per turn, if this Creature was NOT
//    summoned this turn: sacrifice it to summon
//    any Creature from your deck whose max HP is
//    ≤ this Creature's current HP, into its slot.
//    If that Creature would require additional
//    sacrifices (e.g. Dragon Pilot), those are
//    negated — the Engineer is a complete
//    substitute for any sacrifice cost.
// ═══════════════════════════════════════════

const { attachSteamEngine } = require('./_steam-dwarf-shared');
const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Steam Dwarf Engineer';

module.exports = attachSteamEngine({
  creatureEffect: true,

  /**
   * Activation gates:
   *   - alive in support zone
   *   - NOT negated
   *   - NOT summoned this turn (self-sacrifice needs a not-fresh Creature)
   *   - deck contains at least one Creature with maxHp ≤ self.currentHp
   */
  canActivateCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const inst = ctx.card;
    if (!inst || inst.zone !== 'support') return false;
    if (inst.counters?.negated || inst.counters?.nulled) return false;
    if (inst.turnPlayed === (gs.turn || 0)) return false;

    const cd = engine._getCardDB()[inst.name];
    const curHp = inst.counters?.currentHp ?? cd?.hp ?? 0;
    if (curHp <= 0) return false;

    const ps = gs.players[ctx.cardOwner];
    if (!ps?.mainDeck?.length) return false;

    const cardDB = engine._getCardDB();
    for (const deckCard of ps.mainDeck) {
      const dcd = cardDB[deckCard];
      if (!dcd) continue;
      if (!hasCardType(dcd, 'Creature')) continue;
      const dMax = dcd.hp || 0;
      if (dMax > 0 && dMax <= curHp) return true;
    }
    return false;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const inst = ctx.card;
    const pi = ctx.cardOwner;
    const heroIdx = ctx.cardHeroIdx;
    const zoneSlot = inst.zoneSlot;
    const ps = gs.players[pi];
    if (!ps) return false;

    const cd = engine._getCardDB()[inst.name];
    const curHp = inst.counters?.currentHp ?? cd?.hp ?? 0;

    // Build gallery of eligible creatures from deck
    const cardDB = engine._getCardDB();
    const countMap = {};
    for (const deckCard of (ps.mainDeck || [])) {
      const dcd = cardDB[deckCard];
      if (!dcd) continue;
      if (!hasCardType(dcd, 'Creature')) continue;
      const dMax = dcd.hp || 0;
      if (dMax <= 0 || dMax > curHp) continue;
      countMap[deckCard] = (countMap[deckCard] || 0) + 1;
    }
    const galleryCards = Object.entries(countMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, count]) => ({ name, source: 'deck', count }));
    if (galleryCards.length === 0) return false;

    // Preview puff
    engine._broadcastEvent('play_zone_animation', {
      type: 'steam_puff',
      owner: inst.owner, heroIdx, zoneSlot,
    });
    await engine._delay(200);

    const result = await engine.promptGeneric(pi, {
      type: 'cardGallery',
      cards: galleryCards,
      title: CARD_NAME,
      description: `Sacrifice this Creature to summon any Creature from your deck with max HP ≤ ${curHp} (this Creature's current HP). Additional sacrifice costs are negated.`,
      confirmClass: 'btn-info',
      cancellable: true,
    });
    if (!result || result.cancelled || !result.cardName) return false;

    // Verify still in deck (the player's own prompt may have shown
    // stale data in edge cases — mill, other effects).
    const deckIdx = ps.mainDeck.indexOf(result.cardName);
    if (deckIdx < 0) return false;

    const summonedName = result.cardName;

    // Remove chosen card from deck first — prevents any recursive
    // summon path from double-using it.
    ps.mainDeck.splice(deckIdx, 1);

    // Sacrifice the Engineer — actionDestroyCard fires the proper
    // onCreatureDeath hooks and clears the zone.
    await engine.actionDestroyCard({ name: CARD_NAME, owner: pi, heroIdx }, inst);
    await engine._delay(200);

    // Summon the chosen Creature into the freed slot. `skipBeforeSummon`
    // bypasses any sacrifice cost the Creature would normally require —
    // Engineer's own life IS the cost, so Dragon Pilot (and any future
    // sacrifice-requiring Creature) shouldn't also demand its own tribute
    // when arriving via this path. The `_steamEngineerSummon` hookExtra
    // is kept as an ambient flag for any card script that wants to
    // inspect "was I summoned by Engineer?" during onPlay.
    const placeResult = await engine.summonCreatureWithHooks(
      summonedName, pi, heroIdx, zoneSlot,
      {
        source: CARD_NAME,
        skipBeforeSummon: true,
        hookExtras: { _steamEngineerSummon: true },
      },
    );

    if (!placeResult) {
      engine.log('steam_engineer_fizzle', {
        player: ps.username,
        card: summonedName,
        reason: 'no_free_slot',
      });
      return true; // still consumed our effect & our life
    }

    // Broadcast the deck search so the opponent sees what was pulled
    engine._broadcastEvent('deck_search_add', {
      cardName: summonedName, playerIdx: pi,
    });

    // Summon-effect highlight (same visual the normal play flow uses)
    engine._broadcastEvent('summon_effect', {
      owner: pi, heroIdx, zoneSlot: placeResult.actualSlot,
      cardName: summonedName,
    });

    engine.log('steam_engineer_summon', {
      player: ps.username,
      sacrificed: CARD_NAME,
      summoned: summonedName,
      hp: curHp,
    });
    engine.sync();
    return true;
  },
});
