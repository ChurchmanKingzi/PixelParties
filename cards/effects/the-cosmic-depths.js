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
 * Can this hero NORMALLY summon this Creature into a free Support
 * Zone? "Normally" here means: alive, not frozen / stunned / bound,
 * and meets the level + spell-school requirement (heroMeetsLevelReq
 * already accounts for negation, ascension bypasses, Wisdom, etc.).
 * The Cosmic Depths is NOT a placement — it summons through the host
 * Hero's normal-summon gate, then negates the resulting Creature.
 */
function canHeroSummon(engine, pi, heroIdx, cd) {
  const ps = engine.gs.players[pi];
  const hero = ps?.heroes?.[heroIdx];
  if (!hero?.name) return false;
  if (hero.hp <= 0) return false;
  if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.bound) return false;
  return engine.heroMeetsLevelReq(pi, heroIdx, cd);
}

/**
 * Heroes (with a free Support slot) that could host a normal summon
 * of `cd`. Returns one {heroIdx, slotIdx} per eligible hero — the
 * leftmost free zone, matching the prompt's "Slot N" labelling.
 */
function getEligibleHeroesForCreature(engine, pi, cd) {
  const ps = engine.gs.players[pi];
  if (!ps) return [];
  const out = [];
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    if (!canHeroSummon(engine, pi, hi, cd)) continue;
    const zones = ps.supportZones?.[hi] || [[], [], []];
    let freeSlot = -1;
    for (let zi = 0; zi < 3; zi++) {
      if ((zones[zi] || []).length === 0) { freeSlot = zi; break; }
    }
    if (freeSlot < 0) continue;
    out.push({ heroIdx: hi, slotIdx: freeSlot });
  }
  return out;
}

/**
 * Deck Creatures whose level is NOT in `ownedLevels` AND that at
 * least one of `pi`'s Heroes can normally summon. Optional
 * `excludeName` excludes the card just shuffled back ("the card
 * it shuffled back" cannot be the search payoff). Name-based
 * exclusion: with multiple copies, none of them are searchable
 * this activation.
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
    // Must be summonable by at least one of the activator's living,
    // unfrozen / unstunned / unbound Heroes with the level + spell
    // school requirement satisfied. Without this gate the search
    // could pull a Creature no Hero can host, then the placement
    // would fizzle silently after the shuffle cost was paid.
    if (getEligibleHeroesForCreature(engine, pi, cd).length === 0) continue;
    eligible.push(cn);
  }
  return eligible;
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
    // No need to pre-check "any free slot" separately — the eligible-
    // creatures helper now requires at least one capable hero with a
    // free slot, which subsumes the bare slot check.
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
    // Filtered to Heroes that meet the chosen Creature's level / school
    // requirement AND aren't dead / frozen / stunned / bound. The
    // creature gallery already prunes unsummonable creatures; this is
    // the matched per-hero filter — only show eligible host slots.
    const cardDB = engine._getCardDB();
    const chosenCd = cardDB[chosenName];
    const slots = chosenCd ? getEligibleHeroesForCreature(engine, activator, chosenCd) : [];
    if (slots.length === 0) {
      // State drift between gallery pick and zone-pick (host hero died
      // / got frozen) — fizzle without summoning. Cost stays paid.
      engine.log('cosmic_depths_no_host', { player: ps.username, summoned: chosenName });
      return true;
    }

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
    //
    // `_summonedFromDeck: true` lets Cosmic Manipulation's post-summon
    // reaction trigger fire (it gates on direct-from-deck summons).
    // `_summonedByCosmic: true` + `_summonedBy` keep the summoning-
    // source identity available for Life-Searcher / Invader gates,
    // even though those creatures' on-summon triggers are silenced
    // here by the negation. Defensive — future cards may listen on
    // this flag without needing the summoned creature's hooks to fire.
    await engine.runHooks('onCardEnterZone', {
      enteringCard: inst, toZone: 'support', toHeroIdx: heroPick.heroIdx,
      _skipReactionCheck: true,
      _summonedFromDeck: true,
      _summonedByCosmic: true,
      _summonedBy: CARD_NAME,
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
