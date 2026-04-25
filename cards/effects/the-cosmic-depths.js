// ═══════════════════════════════════════════
//  CARD EFFECT: "The Cosmic Depths"
//  Spell (Summoning Magic, Area)
//
//  Both players may — once per turn — shuffle a
//  card from their hand back into their deck, then
//  search their deck for a Creature whose LEVEL is
//  different from every Creature they currently
//  control. That Creature is summoned (as an
//  additional Action — no action is spent) to one
//  of the activator's Heroes, with its effects
//  NEGATED for the rest of the turn.
//
//  Per-player HOPT: the engine keys the Area gate
//  as `area-effect:The Cosmic Depths:<pi>`, so
//  each player has their own independent once-per-
//  turn allowance.
//
//  Negation: we use the low-level `summonCreature`
//  (no hooks fired) and immediately stamp
//  `actionNegateCreature`. The runHooks filter
//  skips any card with `counters.negated` set, so
//  the summoned Creature's OWN onPlay /
//  onCardEnterZone never runs. Reactive listeners
//  on OTHER board cards still fire via the manual
//  `runHooks('onCardEnterZone', …)` pass — the
//  summon is "seen" by the board, but the summoned
//  body is silent.
//
//  Gate (`canActivateAreaEffect`): activator must
//  have a hand card to shuffle, a free Support
//  Zone among their living Heroes, AND at least
//  one deck Creature whose level isn't already
//  represented on their side.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'The Cosmic Depths';

/** Set of levels of every non-face-down Creature the player currently controls. */
function getOwnedCreatureLevels(engine, pi) {
  const cardDB = engine._getCardDB();
  const levels = new Set();
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support') continue;
    if ((inst.controller ?? inst.owner) !== pi) continue;
    if (inst.faceDown) continue;
    const cd = cardDB[inst.name];
    if (!cd || !hasCardType(cd, 'Creature')) continue;
    levels.add(cd.level ?? 0);
  }
  return levels;
}

/**
 * Deck Creatures whose level is NOT in `ownedLevels`, optionally
 * excluding a specific card name (`excludeName`) — the card just
 * shuffled back into the deck as the activation cost cannot itself
 * be searched up, per the card's wording ("the card it shuffled back").
 * The exclusion is NAME-based (not instance-based) because the engine
 * stores deck cards as plain strings and cannot distinguish which
 * physical copy was shuffled. Practically: if the activator shuffles
 * a copy of X, no X can be summoned this activation, even if additional
 * copies of X were already in the deck.
 */
function getEligibleDeckCreatures(engine, pi, ownedLevels, excludeName) {
  const cardDB = engine._getCardDB();
  const ps = engine.gs.players[pi];
  const eligible = [];
  for (const cn of (ps?.mainDeck || [])) {
    if (excludeName && cn === excludeName) continue;
    const cd = cardDB[cn];
    if (!cd || !hasCardType(cd, 'Creature')) continue;
    if (ownedLevels.has(cd.level ?? 0)) continue;
    eligible.push(cn);
  }
  return eligible;
}

/**
 * First free {heroIdx, slotIdx} pairing per living hero. Returns one slot
 * per hero — the cosmos summon drops into the leftmost free zone of the
 * picked hero.
 */
function getHeroesWithFreeSlot(ps) {
  const out = [];
  for (let hi = 0; hi < (ps?.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name || hero.hp <= 0) continue;
    const zones = ps.supportZones?.[hi] || [[], [], []];
    for (let zi = 0; zi < 3; zi++) {
      if ((zones[zi] || []).length === 0) { out.push({ heroIdx: hi, slotIdx: zi }); break; }
    }
  }
  return out;
}

module.exports = {
  activeIn: ['hand', 'area'],
  areaEffect: true,

  hooks: {
    onPlay: async (ctx) => {
      // Standard Area self-placement — mirrors Slippery Ice. Guard
      // against bubble-through fires so only the cast instance installs
      // the Area.
      if (ctx.cardZone !== 'hand') return;
      if (ctx.playedCard?.id !== ctx.card.id) return;
      await ctx._engine.placeArea(ctx.cardOwner, ctx.card);
    },
  },

  canActivateAreaEffect(ctx) {
    const engine = ctx._engine;
    const activator = ctx._activator ?? engine.gs.activePlayer;
    if (activator == null || activator < 0) return false;
    const ps = engine.gs.players[activator];
    if (!ps) return false;
    if (!(ps.hand || []).length) return false;
    if (getHeroesWithFreeSlot(ps).length === 0) return false;
    const ownedLevels = getOwnedCreatureLevels(engine, activator);
    const eligible = getEligibleDeckCreatures(engine, activator, ownedLevels);
    return eligible.length > 0;
  },

  async onAreaEffect(ctx) {
    const engine = ctx._engine;
    const gs = engine.gs;
    const activator = ctx._activator ?? gs.activePlayer;
    if (activator == null || activator < 0) return false;
    const ps = gs.players[activator];
    if (!ps) return false;

    // ── Step 1: pick the hand card to shuffle back ───────────────────
    const eligibleHandIndices = ps.hand.map((_, i) => i);
    const pick = await engine.promptGeneric(activator, {
      type: 'handPick',
      title: CARD_NAME,
      description: 'Shuffle a card from your hand back into your deck.',
      eligibleIndices: eligibleHandIndices,
      maxSelect: 1,
      minSelect: 1,
      confirmLabel: '🌌 Shuffle & Search',
      cancellable: true,
    });
    if (!pick || pick.cancelled || !pick.selectedCards?.length) return false;
    const shuffledName = pick.selectedCards[0].cardName;
    const handIdx = ps.hand.indexOf(shuffledName);
    if (handIdx < 0) return false;

    // ── Step 2: shuffle it in ────────────────────────────────────────
    ps.hand.splice(handIdx, 1);
    ps.mainDeck.push(shuffledName);
    engine.shuffleDeck(activator, 'main');
    engine.log('cosmic_depths_shuffle', { player: ps.username, card: shuffledName });
    engine.sync();

    // ── Step 3: build the filtered deck-Creature gallery ─────────────
    // Re-read state in case onDiscard-style hooks shifted something.
    // The shuffled card's NAME is excluded: "the card shuffled back"
    // cannot itself be the search payoff. Name-based exclusion is
    // intentional (see helper comment) — with multiple copies of the
    // same Creature, none of them are searchable this activation.
    const ownedLevels = getOwnedCreatureLevels(engine, activator);
    const eligibleNames = getEligibleDeckCreatures(engine, activator, ownedLevels, shuffledName);
    if (eligibleNames.length === 0) {
      // Cost paid, no payoff — HOPT stays claimed (the area's gate had
      // at least one valid creature at click time; state may have
      // shifted mid-prompt, but we still consume the once-per-turn).
      engine.log('cosmic_depths_no_target', { player: ps.username });
      return true;
    }
    const countMap = {};
    for (const cn of eligibleNames) countMap[cn] = (countMap[cn] || 0) + 1;
    const gallery = Object.entries(countMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, count]) => ({ name, source: 'deck', count }));

    const chosen = await engine.promptGeneric(activator, {
      type: 'cardGallery',
      cards: gallery,
      title: CARD_NAME,
      description: 'Choose a Creature with a level different from every Creature you control.',
      cancellable: false, // shuffle already paid — commit.
    });
    if (!chosen || !chosen.cardName) return true;
    const chosenName = chosen.cardName;
    const deckIdx = ps.mainDeck.indexOf(chosenName);
    if (deckIdx < 0) return true;

    // ── Step 4: pick which Hero receives the summon ──────────────────
    const slots = getHeroesWithFreeSlot(ps);
    if (slots.length === 0) return true;

    // Synthetic instance drives the zone-pick prompt through the
    // activating player (Area can be activated from either side, so we
    // can't rely on the Area owner's controller field).
    const pseudoInst = {
      id: 'the-cosmic-depths-pseudo',
      name: CARD_NAME, owner: activator, controller: activator,
      zone: 'area', heroIdx: -1, zoneSlot: -1, counters: {}, faceDown: false,
    };
    const promptCtx = engine._createContext(pseudoInst, {});

    const zones = slots.map(s => {
      const hero = ps.heroes?.[s.heroIdx];
      return {
        heroIdx: s.heroIdx, slotIdx: s.slotIdx,
        label: `${hero?.name || 'Hero'} — Slot ${s.slotIdx + 1}`,
      };
    });
    const heroPick = await promptCtx.promptZonePick(zones, {
      title: CARD_NAME,
      description: `Summon ${chosenName} onto which Hero?`,
      cancellable: false,
    });
    if (!heroPick) return true;

    // ── Step 5: remove from deck, run cosmic summon animation, place,
    //            negate ────────────────────────────────────────────────
    ps.mainDeck.splice(deckIdx, 1);
    engine._broadcastEvent('deck_search_add', { cardName: chosenName, playerIdx: activator });
    engine.sync();
    await engine._delay(250);

    // Black/purple portal flourish on the target zone BEFORE the
    // creature appears. Matches the Area's cosmos backdrop palette.
    engine._broadcastEvent('play_zone_animation', {
      type: 'cosmic_summon',
      owner: activator,
      heroIdx: heroPick.heroIdx,
      zoneSlot: heroPick.slotIdx,
    });
    await engine._delay(600);

    // `summonCreature` places without firing hooks. We then negate the
    // instance BEFORE any hook pass, so the runHooks filter (line 996
    // of _engine.js) short-circuits the summoned creature's own onPlay
    // / onCardEnterZone while still letting OTHER board cards react to
    // the summon.
    const summonRes = engine.summonCreature(chosenName, activator, heroPick.heroIdx, heroPick.slotIdx, {
      source: CARD_NAME,
    });
    if (!summonRes) return true;
    const { inst } = summonRes;

    engine.actionNegateCreature(inst, CARD_NAME, {
      expiresAtTurn: gs.turn + 1,
      expiresForPlayer: activator === 0 ? 1 : 0,
    });

    // Fire onCardEnterZone (without `_onlyCard`) so OTHER cards can
    // react — the negated creature's own hooks are filtered out
    // automatically by the engine's negation guard.
    await engine.runHooks('onCardEnterZone', {
      enteringCard: inst, toZone: 'support', toHeroIdx: heroPick.heroIdx,
      _skipReactionCheck: true,
    });

    engine.log('cosmic_depths_summon', {
      player: ps.username,
      shuffled: shuffledName,
      summoned: chosenName,
      hero: ps.heroes?.[heroPick.heroIdx]?.name,
      heroIdx: heroPick.heroIdx,
    });
    engine.sync();
    return true;
  },
};
