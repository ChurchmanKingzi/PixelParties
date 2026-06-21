// ═══════════════════════════════════════════
//  CARD EFFECT: "Ladder to the Sky"
//  Artifact (Normal, Cost 10)
//
//  "Sacrifice a Creature you control that was not summoned this turn to
//   play this card. At the beginning of your next turn, you may search
//   your deck for a Creature whose level is up to 1 higher than that of
//   the sacrificed Creature and place it into a free Support Zone of any
//   Hero you control. That Creature may use its once per turn effect the
//   turn it's summoned."
//
//  ── Eligibility (Garius / Xuanwu pattern) ──
//  Deck candidates are filtered to Creatures summonable under their own
//  `canSummon` conditions for some living Hero (Sparkfly Queen needs
//  Hive's Crown active, per-Hero archetype rules, etc.) via the engine's
//  `isCreatureSummonable` — the same gate Garius / Cardinal Beast Xuanwu
//  use. Tribute-summon Creatures keep their cost: it's paid by their own
//  `beforeSummon` when placed (placement uses `isPlacement: true`), and
//  the deck card is refunded if the player can't / won't pay.
//  A board Creature can only be sacrificed for Ladder if sacrificing it
//  yields ≥1 such deck replacement (level ≤ its level + 1); if NO
//  Creature has an eligible replacement, Ladder can't be activated.
//
//  ── Delayed effect ──
//  The played card is re-zoned to the discard pile but kept TRACKED
//  (`activeIn: ['discard']`) so its `onTurnStart` runs the search at the
//  start of the controller's NEXT turn, with haste on the placed
//  Creature. (TEST_IMMEDIATE below resolves it on play for testing.)
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Ladder to the Sky';

// When true, the deck-search + place resolves IMMEDIATELY on play
// instead of "at the beginning of your next turn" (testing only).
const TEST_IMMEDIATE = false;

/** Is `name` summonable (canSummon conditions met) for some living Hero?
 *  The same gate Garius / Xuanwu use — Sparkfly Queen et al. are excluded
 *  when their condition isn't met; tribute Creatures pass here and pay
 *  their cost via `beforeSummon` at placement. */
function summonableForSomeHero(engine, pi, name) {
  const ps = engine.gs.players[pi];
  for (let hi = 0; hi < (ps?.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name || hero.hp <= 0) continue;
    if (engine.isCreatureSummonable(name, pi, hi)) return true;
  }
  return false;
}

/** Distinct deck Creatures eligible for placement at level ≤ maxLevel. */
function buildLadderGallery(engine, pi, maxLevel) {
  const ps = engine.gs.players[pi];
  const cardDB = engine._getCardDB();
  const seen = new Set();
  const out = [];
  for (const cn of (ps?.mainDeck || [])) {
    if (seen.has(cn)) continue;
    const cd = cardDB[cn];
    if (!cd || !hasCardType(cd, 'Creature')) continue;
    if (hasCardType(cd, 'Token') || cd.subtype === 'Token') continue;
    // `pileSide: 'deck'` so "level in your hand" reducers (Ruin Mourner)
    // don't apply to a deck Creature.
    const effLvl = engine.effectiveCardLevel(cd, pi, { pileSide: 'deck' });
    if (effLvl > maxLevel) continue;
    if (!summonableForSomeHero(engine, pi, cn)) continue;
    seen.add(cn);
    out.push({ name: cn, source: 'deck', level: effLvl });
  }
  out.sort((a, b) => (a.level - b.level) || a.name.localeCompare(b.name));
  return out;
}

/** Sacrifice-cost filter: a board Creature not summoned this turn whose
 *  level yields ≥1 eligible deck replacement. */
function ladderSacrificeFilter(engine, pi) {
  const turn = engine.gs.turn;
  return (c) => {
    if (c.inst.turnPlayed === turn) return false;
    return buildLadderGallery(engine, pi, (c.level || 0) + 1).length > 0;
  };
}

/** Next-turn (or test-immediate) deck search → place a Creature with haste. */
async function doLadderSearch(engine, pi, sacLevel) {
  const gs = engine.gs;
  const ps = gs.players[pi];
  if (!ps) return;
  const maxLevel = (sacLevel || 0) + 1;

  const gallery = buildLadderGallery(engine, pi, maxLevel);
  // Free Support Zone under any living Hero.
  const freeZones = [];
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name || hero.hp <= 0) continue;
    for (let zi = 0; zi < 3; zi++) {
      if (((ps.supportZones?.[hi] || [])[zi] || []).length === 0) freeZones.push({ heroIdx: hi, slotIdx: zi });
    }
  }
  if (gallery.length === 0 || freeZones.length === 0) return;

  // "you MAY search" — optional.
  const pick = await engine.promptGeneric(pi, {
    type: 'cardGallery',
    cards: gallery,
    title: CARD_NAME,
    description: `Search your deck for a Creature (level ${maxLevel} or lower) to place into a free Support Zone.`,
    confirmLabel: '🪜 Summon!',
    cancellable: true,
  });
  if (!pick || pick.cancelled || !pick.cardName) return;
  const chosenName = pick.cardName;
  if ((ps.mainDeck || []).indexOf(chosenName) < 0) return;

  // Zones where this Creature is actually summonable (per-Hero canSummon).
  const placeable = freeZones.filter(z => engine.isCreatureSummonable(chosenName, pi, z.heroIdx));
  if (placeable.length === 0) return;

  let dest = placeable[0];
  if (placeable.length > 1) {
    const zr = await engine.promptGeneric(pi, {
      type: 'zonePick',
      title: CARD_NAME,
      description: `Place ${chosenName} into which Support Zone?`,
      zones: placeable,
      cancellable: true,
    });
    if (!zr || zr.cancelled) return;
    dest = { heroIdx: zr.heroIdx, slotIdx: zr.slotIdx };
  }

  const deckIdx = ps.mainDeck.indexOf(chosenName);
  if (deckIdx < 0) return;
  ps.mainDeck.splice(deckIdx, 1);
  engine.shuffleDeck(pi);

  const res = await engine.summonCreatureWithHooks(
    chosenName, pi, dest.heroIdx, dest.slotIdx,
    { source: CARD_NAME, isPlacement: true },
  );
  if (!res?.inst) {
    ps.mainDeck.push(chosenName);
    engine.shuffleDeck(pi);
    return;
  }
  // Haste — may use its once-per-turn effect the turn it's summoned.
  if (!res.inst.counters) res.inst.counters = {};
  res.inst.counters._hasHaste = true;

  // ── Flashy "Ladder to the Sky" summon — golden holy light rising
  //    skyward + a gold sparkle burst on the placed Creature (on top of
  //    the default summon glow). ──
  engine._broadcastEvent('play_zone_animation', {
    type: 'holy_revival', owner: pi, heroIdx: dest.heroIdx, zoneSlot: dest.slotIdx,
  });
  engine._broadcastEvent('play_zone_animation', {
    type: 'gold_sparkle', owner: pi, heroIdx: dest.heroIdx, zoneSlot: dest.slotIdx,
  });
  await engine._delay(600);

  engine.log('ladder_to_sky_summon', { player: ps.username, summoned: chosenName, maxLevel });
  engine.sync();
}

module.exports = {
  // Tracked in the discard pile so the delayed onTurnStart fires.
  activeIn: ['discard'],

  // Playable only while a Creature not summoned this turn has an eligible
  // deck replacement (Gold is gated by the handler).
  canActivate(gs, pi, engine) {
    const filt = ladderSacrificeFilter(engine, pi);
    return engine.getSacrificableCreatures(pi).some(c => filt(c));
  },

  async resolve(engine, pi /*, selectedIds, validTargets */) {
    const gs = engine.gs;
    const ps = gs.players[pi];
    if (!ps) return { cancelled: true };

    // ── Pay the sacrifice cost; record the tribute's level. Only
    //    Creatures that have an eligible deck replacement are offered. ──
    let sacLevel = 0;
    const shimCtx = { cardOwner: pi, card: { id: null }, cardName: CARD_NAME, cardHeroIdx: -1 };
    const paid = await engine.resolveSacrificeCost(shimCtx, {
      minCount: 1,
      maxCount: 1,
      title: `${CARD_NAME} — Sacrifice`,
      description: 'Sacrifice 1 of your Creatures (not summoned this turn, with an eligible deck replacement) to play Ladder to the Sky.',
      confirmLabel: '🗡️ Sacrifice!',
      confirmClass: 'btn-danger',
      cancellable: true,
      filter: ladderSacrificeFilter(engine, pi),
      onResolved: (_ctx, picked) => { sacLevel = picked?.[0]?._meta?.level ?? 0; },
    });
    // Cancel → card stays in hand, no Gold spent.
    if (!paid) return { cancelled: true };

    engine.log('ladder_to_sky_played', { player: ps.username, sacrificedLevel: sacLevel });

    // ⚠️ TEST: resolve the next-turn effect right now. The card goes to
    // discard normally (no delayed arming / re-zone).
    if (TEST_IMMEDIATE) {
      await doLadderSearch(engine, pi, sacLevel);
      engine.sync();
      return;
    }

    // ── Keep this card tracked in the discard pile to fire its delayed
    //    next-turn effect. The server pushes the name to discard + splices
    //    the hand entry; we only re-zone the instance + arm it. ──
    const inst = engine.findCards({ owner: pi, zone: 'hand', name: CARD_NAME })[0];
    if (inst) {
      inst.zone = 'discard'; inst.heroIdx = -1; inst.zoneSlot = -1;
      inst.counters = inst.counters || {};
      inst.counters._ladderLevel = sacLevel;
      inst.counters._ladderArmedTurn = gs.turn;
    }
    engine.sync();
  },

  hooks: {
    onTurnStart: async (ctx) => {
      if (ctx.cardZone !== 'discard') return;
      const inst = ctx.card;
      const armed = inst.counters?._ladderArmedTurn;
      if (armed == null) return;
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      // Start of the CONTROLLER's NEXT turn (a later turn than armed).
      if (gs.activePlayer !== pi) return;
      if (gs.turn <= armed) return;

      delete inst.counters._ladderArmedTurn; // one-shot
      const sacLevel = inst.counters?._ladderLevel ?? 0;
      await doLadderSearch(engine, pi, sacLevel);
      engine._untrackCard(inst.id); // spent — the name stays in discard
    },
  },
};
