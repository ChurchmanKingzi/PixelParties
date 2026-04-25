// ═══════════════════════════════════════════
//  CARD EFFECT: "Loyal Rottweiler"
//  Creature (Summoning Magic Lv1) — 50 HP
//  Archetype: Loyals
//
//  You may once per turn sacrifice this Creature
//  to place a "Loyal" Creature from your deck
//  into the same Support Zone it occupied.
//
//  Wiring: standard `creatureEffect` so the
//  engine handles the once-per-turn HOPT. When
//  activated:
//    1. Pick a Loyal from deck via cardGallery.
//    2. Sacrifice Rottweiler — fires
//       ON_CREATURE_SACRIFICED + ON_CREATURE_DEATH
//       per the standard sacrifice pipeline so
//       Hell Fox / Loyal Shepherd / etc. all see
//       the death.
//    3. Place the chosen Loyal into Rottweiler's
//       vacated slot. "Place" (not "summon") —
//       skip summoning sickness so the placed
//       Loyal can act THIS turn. Entry hooks
//       (onPlay, onCardEnterZone) still fire so
//       Hountriever / Pinpom-style triggers chain
//       off the placement.
//    4. Reveal the deck-tutored card to the
//       opponent + shuffle.
// ═══════════════════════════════════════════

const {
  isLoyalCreature,
  getLoyalsInDeck,
} = require('./_loyal-shared');

const CARD_NAME = 'Loyal Rottweiler';

module.exports = {
  activeIn: ['support'],
  creatureEffect: true,

  canActivateCreatureEffect(ctx) {
    const engine = ctx._engine;
    const ps     = engine.gs.players[ctx.cardOriginalOwner];
    if (!ps) return false;
    // No deck Loyals → can't tutor anything → bail before paying the cost.
    return getLoyalsInDeck(ps, engine).length > 0;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const gs     = engine.gs;
    const pi     = ctx.cardOriginalOwner;
    const ps     = gs.players[pi];
    if (!ps) return false;

    const ownHeroIdx  = ctx.cardHeroIdx;
    const ownZoneSlot = ctx.card.zoneSlot;

    // ── Step 1: enumerate deck Loyals ──
    const deckLoyals = getLoyalsInDeck(ps, engine);
    if (deckLoyals.length === 0) return false;

    const gallery = deckLoyals.map(l => ({
      name: l.name, source: 'deck', count: l.count,
    }));

    const picked = await engine.promptGeneric(pi, {
      type: 'cardGallery',
      cards: gallery,
      title: CARD_NAME,
      description: 'Sacrifice Rottweiler to place a Loyal Creature from your deck into its slot.',
      cancellable: true,
    });
    if (!picked || picked.cancelled || !picked.cardName) return false;
    const loyalName = picked.cardName;
    if (!isLoyalCreature(loyalName, engine)) return false;

    // Verify the deck still has it (defensive — nothing should've
    // touched the deck mid-prompt, but cheap to check).
    const deckIdx = ps.mainDeck.indexOf(loyalName);
    if (deckIdx < 0) return false;

    // ── Step 2: sacrifice Rottweiler ──
    // Fire the dedicated sacrifice hook before the death so
    // ON_CREATURE_SACRIFICED listeners can react with the live
    // instance, mirroring resolveSacrificeCost's contract.
    const sacrificed = ctx.card;
    await engine.runHooks('onCreatureSacrificed', {
      creature: sacrificed,
      cardName: sacrificed.name,
      owner: sacrificed.owner,
      heroIdx: sacrificed.heroIdx,
      zoneSlot: sacrificed.zoneSlot,
      source: { name: CARD_NAME, owner: pi, heroIdx: ownHeroIdx },
      _skipReactionCheck: true,
    });

    // Knife-plunge animation on Rottweiler's slot, same FX shared
    // with Sacrifice to Divinity.
    engine._broadcastEvent('play_zone_animation', {
      type: 'knife_sacrifice',
      owner: pi, heroIdx: ownHeroIdx, zoneSlot: ownZoneSlot,
    });
    await engine._delay(550);

    // Route through actionDestroyCard so ON_CREATURE_DEATH fires AND
    // discard-pile routing (originalOwner-aware) is correct. The
    // Cardinal-Beast guard inside actionDestroyCard doesn't bother us
    // — Rottweiler isn't a Cardinal Beast.
    await engine.actionDestroyCard(
      { name: CARD_NAME, owner: pi, heroIdx: ownHeroIdx },
      sacrificed,
    );

    // ── Step 3: pull the Loyal from deck and place into the
    // vacated slot ──
    const stillDeckIdx = ps.mainDeck.indexOf(loyalName);
    if (stillDeckIdx < 0) {
      // Pulled out from under us by some other effect — fizzle.
      engine.sync();
      return true;
    }
    ps.mainDeck.splice(stillDeckIdx, 1);

    if (!ps.supportZones[ownHeroIdx]) ps.supportZones[ownHeroIdx] = [[], [], []];
    // The slot SHOULD be empty now (sacrifice cleared it) — if some
    // other effect snuck a creature in there mid-await, fall back to
    // the first free slot of the same hero. safePlaceInSupport's
    // built-in relocator handles this.
    const placeResult = engine.safePlaceInSupport(loyalName, pi, ownHeroIdx, ownZoneSlot);
    if (!placeResult) {
      // No free zone left at all — return the card to deck top so it
      // isn't silently lost.
      ps.mainDeck.splice(stillDeckIdx, 0, loyalName);
      engine.sync();
      return true;
    }
    const { inst: placedInst, actualSlot } = placeResult;

    // "Place" semantics: no summoning sickness. Setting turnPlayed to
    // a previous turn lets the placed Loyal use its creatureEffect
    // and react to triggers immediately.
    placedInst.turnPlayed = (gs.turn || 1) - 1;

    // Reveal + shuffle, standard tutor etiquette.
    engine.shuffleDeck(pi, 'main');
    engine._broadcastEvent('deck_search_add', { cardName: loyalName, playerIdx: pi });

    // Entry hooks — fire onPlay + onCardEnterZone so Hountriever et al.
    // pick up the placement. _skipReactionCheck mirrors the post-summon
    // hook ctx other tutors use (Treasure Hunter's Backpack, Elven
    // Rider) — placement is not a chain trigger.
    await engine.runHooks('onPlay', {
      _onlyCard: placedInst, playedCard: placedInst, cardName: loyalName,
      zone: 'support', heroIdx: ownHeroIdx, zoneSlot: actualSlot,
      _skipReactionCheck: true,
    });
    await engine.runHooks('onCardEnterZone', {
      enteringCard: placedInst, toZone: 'support', toHeroIdx: ownHeroIdx,
      _skipReactionCheck: true,
    });

    // Reveal modal to opponent (standard deck-search etiquette).
    await engine._delay(300);
    const oi = pi === 0 ? 1 : 0;
    await engine.promptGeneric(oi, {
      type: 'deckSearchReveal',
      cardName: loyalName,
      searcherName: ps.username,
      title: CARD_NAME,
      cancellable: false,
    });

    engine.log('loyal_rottweiler_swap', {
      player: ps.username, placed: loyalName,
      heroIdx: ownHeroIdx, zoneSlot: actualSlot,
    });
    engine.sync();
    return true;
  },
};
