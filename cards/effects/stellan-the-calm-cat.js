// ═══════════════════════════════════════════
//  CARD EFFECT: "Stellan, the Calm Cat"
//  Hero (400 HP, 40 ATK — Leadership + Support Magic)
//
//  Trigger — ONCE PER TURN, when either:
//    (a) Stellan takes any damage (any source, any
//        type — creature damage, spell damage,
//        poison / burn ticks, etc. The card text
//        does NOT require the damage to be from an
//        opponent; self-inflicted status damage
//        counts.)
//    (b) An opponent applies a negative status to
//        Stellan (proxy for "Stellan is affected by
//        an opponent's card or effect"). Positive
//        / self-applied statuses are filtered out
//        because `onStatusApplied` doesn't carry a
//        source-ownership field — negative is the
//        best available heuristic for "opponent
//        did this", matching Fiona's pattern.
//
//  Effect — the controller picks ONE of:
//    • "Up to 3 level-0 Creatures with DIFFERENT
//       names from hand" — each placed into one of
//       Stellan's free Support Zones.
//    • "1 level-0 Creature from deck" — placed
//       into Stellan's first free Support Zone.
//
//  HOPT semantics — the once-per-turn counter is
//  RESERVED on entry (so a second trigger inside
//  the same effect's animation window can't slip
//  through) but REFUNDED if the player cancels at
//  any prompt or picks nothing. Reset on
//  onTurnStart.
//
//  Placements bypass `countAsSummon` — the card
//  text frames them as a passive reaction, not a
//  summon play, so they don't consume the
//  creatures-summoned-this-turn counter.
// ═══════════════════════════════════════════

const { hasCardType, STATUS_EFFECTS } = require('./_hooks');

const CARD_NAME   = 'Stellan, the Calm Cat';
const HOPT_KEY    = 'stellanTriggeredThisTurn';
const MAX_FROM_HAND = 3;

/** The once-per-turn gate lives on Stellan's card-instance counters. */
function alreadyTriggered(card) {
  return !!(card?.counters && card.counters[HOPT_KEY]);
}
function markTriggered(card) {
  if (!card.counters) card.counters = {};
  card.counters[HOPT_KEY] = true;
}
function refundTrigger(card) {
  if (card?.counters) delete card.counters[HOPT_KEY];
}

/** Free Support Zone indices on Stellan's hero slot. */
function freeStellanSlots(ps, heroIdx) {
  const zones = ps.supportZones?.[heroIdx] || [[], [], []];
  const out = [];
  for (let z = 0; z < 3; z++) {
    if ((zones[z] || []).length === 0) out.push(z);
  }
  return out;
}

/**
 * Deduplicated list of Level-0 Creature card names in `source` (hand or
 * mainDeck), where "Level 0" is the EFFECTIVE level after board-wide
 * reductions — not just the raw `level` field on the card. A Lv1 Elven
 * Creature with one Forager on the same side qualifies because Forager's
 * `reduceCardLevel` hook walks through `_applyCardLevelReductions` and
 * drops the effective level to 0. Raw Lv0 creatures obviously still
 * qualify.
 *
 * The ability-based `reduceSpellLevel` path (Mana Mining, etc.) is NOT
 * considered — it only affects Spells, and we're filtering Creatures.
 */
function levelZeroCreatureNames(engine, playerIdx, source) {
  const cardDB = engine._getCardDB();
  const seen = new Set();
  const result = [];
  for (const cn of (source || [])) {
    if (seen.has(cn)) continue;
    const cd = cardDB[cn];
    if (!cd || !hasCardType(cd, 'Creature')) continue;
    const raw = cd.level || 0;
    // Fast path: already Lv0 on the card face, no walk needed.
    if (raw === 0) { seen.add(cn); result.push(cn); continue; }
    const reduced = engine._applyCardLevelReductions(cd, raw, playerIdx);
    if (reduced === 0) { seen.add(cn); result.push(cn); }
  }
  return result;
}

/**
 * Count copies of `cardName` in `arr` — used to populate the cardGallery
 * `count` badges in the deck picker.
 */
function countCopies(arr, cardName) {
  let n = 0;
  for (const c of (arr || [])) if (c === cardName) n++;
  return n;
}

async function runStellanEffect(ctx) {
  const engine  = ctx._engine;
  const gs      = engine.gs;
  const pi      = ctx.cardOwner;
  const heroIdx = ctx.cardHeroIdx;
  const ps      = gs.players[pi];
  if (!ps) return false;

  // Bail paths that mean "no placement possible right now" — these still
  // consume the trigger (refund on cancel only, not on no-legal-target).
  if (ps.summonLocked) return false;
  const freeSlots = freeStellanSlots(ps, heroIdx);
  if (freeSlots.length === 0) return false;

  const handEligible = levelZeroCreatureNames(engine, pi, ps.hand);
  const deckEligible = levelZeroCreatureNames(engine, pi, ps.mainDeck);
  if (handEligible.length === 0 && deckEligible.length === 0) return false;

  // ── Source pick (hand / deck / cancel) ──
  let source;
  if (handEligible.length > 0 && deckEligible.length > 0) {
    const handCap = Math.min(MAX_FROM_HAND, freeSlots.length, handEligible.length);
    const optRes = await engine.promptGeneric(pi, {
      type: 'optionPicker',
      title: CARD_NAME,
      description: 'Place Creatures from where?',
      options: [
        { id: 'hand', label: `✋  Up to ${handCap} from hand` },
        { id: 'deck', label: '📚  1 from deck' },
      ],
      cancellable: true,
      gerrymanderEligible: true, // Batch-from-hand vs targeted-deck-search.
    });
    if (!optRes || optRes.cancelled || !optRes.optionId) return false;
    source = optRes.optionId;
  } else if (handEligible.length > 0) {
    source = 'hand';
  } else {
    source = 'deck';
  }

  if (source === 'hand') {
    const handCap = Math.min(MAX_FROM_HAND, freeSlots.length, handEligible.length);
    const gallery = handEligible.map(cn => ({ name: cn, source: 'hand' }));
    const picked = await engine.promptGeneric(pi, {
      type: 'cardGalleryMulti',
      cards: gallery,
      selectCount: handCap,
      minSelect: 0,
      title: CARD_NAME,
      description: `Choose up to ${handCap} Level 0 Creature${handCap > 1 ? 's' : ''} with different names from your hand to summon onto ${CARD_NAME}.`,
      confirmLabel: '✨ Summon!',
      confirmClass: 'btn-success',
      cancellable: true,
    });
    if (!picked || picked.cancelled) return false;
    const chosen = Array.isArray(picked.selectedCards) ? picked.selectedCards : [];
    if (chosen.length === 0) return false;

    // Re-snapshot the free slot list — nothing has mutated state between the
    // earlier read and here (prompts are pure), but we want the freshest
    // view in case a future hook interleaves something.
    const slots = freeStellanSlots(ps, heroIdx);
    let placed = 0;
    for (let i = 0; i < chosen.length && i < slots.length; i++) {
      const cardName = chosen[i];
      // Re-verify the card is still in hand — a prior placement's onPlay
      // could have moved cards around, which would invalidate our
      // pre-computed list.
      if ((ps.hand || []).indexOf(cardName) < 0) continue;
      const res = await engine.actionPlaceCreature(cardName, pi, heroIdx, slots[i], {
        source: 'hand',
        sourceName: CARD_NAME,
        countAsSummon: false,
        animationType: 'summon',
      });
      if (res?.inst) placed++;
    }
    if (placed === 0) return false;
    engine.log('stellan_trigger_hand', { player: ps.username, placed });
    engine.sync();
    return true;
  }

  // ── Deck path ──
  const gallery = deckEligible
    .map(cn => ({ name: cn, source: 'deck', count: countCopies(ps.mainDeck, cn) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const picked = await engine.promptGeneric(pi, {
    type: 'cardGallery',
    cards: gallery,
    title: CARD_NAME,
    description: `Choose a Level 0 Creature from your deck to summon onto ${CARD_NAME}.`,
    cancellable: true,
  });
  if (!picked || picked.cancelled || !picked.cardName) return false;
  const chosenName = picked.cardName;
  const deckIdx = ps.mainDeck.indexOf(chosenName);
  if (deckIdx < 0) return false;
  ps.mainDeck.splice(deckIdx, 1);

  const slot = freeStellanSlots(ps, heroIdx)[0];
  if (slot == null) {
    // Race: all slots filled between the free-slot check and here. Refund
    // the deck card so we don't silently eat it.
    ps.mainDeck.push(chosenName);
    engine.shuffleDeck(pi, 'main');
    return false;
  }
  const summonRes = await engine.summonCreatureWithHooks(chosenName, pi, heroIdx, slot, {
    source: CARD_NAME,
    countAsSummon: false,
  });
  if (!summonRes) {
    // beforeSummon refused — put card back, shuffle, fizzle.
    ps.mainDeck.push(chosenName);
    engine.shuffleDeck(pi, 'main');
    return false;
  }

  // Shuffle + opponent reveal — standard deck-search etiquette.
  engine.shuffleDeck(pi, 'main');
  engine._broadcastEvent('deck_search_add', { cardName: chosenName, playerIdx: pi });
  const oi = pi === 0 ? 1 : 0;
  await engine.promptGeneric(oi, {
    type: 'deckSearchReveal',
    cardName: chosenName,
    searcherName: ps.username,
    title: CARD_NAME,
    cancellable: false,
  });
  engine.log('stellan_trigger_deck', { player: ps.username, summoned: chosenName });
  engine.sync();
  return true;
}

/**
 * Shared gate for both trigger hooks: reserve the HOPT slot up front so a
 * second trigger fired during this one's prompt chain can't slip through,
 * then refund if the player cancels (or no placement lands). Returns
 * true iff the effect actually placed something.
 */
async function tryFire(ctx) {
  if (alreadyTriggered(ctx.card)) return false;
  const hero = ctx.attachedHero;
  if (!hero?.name || hero.hp <= 0) return false;

  markTriggered(ctx.card);
  let placed = false;
  try {
    placed = await runStellanEffect(ctx);
  } catch (err) {
    console.error('[Stellan] effect threw:', err.message);
  }
  if (!placed) refundTrigger(ctx.card);
  return placed;
}

module.exports = {
  activeIn: ['hero'],

  // Gerrymander redirect — pick `deck` (single search) over `hand`
  // (potentially multiple). Limits opp's volume payoff.
  cpuGerrymanderResponse(/* engine, gerryOwnerPi, promptData */) {
    return { optionId: 'deck' };
  },

  // CPU self-status target score. Only the damaging statuses (Poison,
  // Burn) actually trigger Stellan when self-inflicted — they tick
  // damage on a later turn and hit the `afterDamage` path. The pure-CC
  // statuses (Frozen / Stunned / Negated / Nulled) are filtered out of
  // `onStatusApplied` below when self-applied, and they deal no damage,
  // so self-inflicting them on Stellan wastes the card for nothing.
  cpuStatusSelfValue(statusName) {
    return (statusName === 'poisoned' || statusName === 'burned') ? 50 : 0;
  },

  hooks: {
    onTurnStart: (ctx) => {
      refundTrigger(ctx.card);
    },

    afterDamage: async (ctx) => {
      const target = ctx.target;
      if (!target || target.hp === undefined) return;
      // Match: is the damaged hero THIS Stellan instance? Use
      // cardOriginalOwner for physical-location match (charm doesn't move
      // the hero between sides).
      const gs = ctx._engine.gs;
      const owner = ctx.cardOriginalOwner;
      const heroIdx = ctx.card.heroIdx;
      const expectedHero = gs.players[owner]?.heroes?.[heroIdx];
      if (expectedHero !== target) return;
      // Damage of any source / any type counts — no filter.
      await tryFire(ctx);
    },

    onStatusApplied: async (ctx) => {
      const target = ctx.target;
      if (!target) return;
      // Match: status landed on THIS Stellan instance.
      if (ctx.heroOwner !== ctx.cardOriginalOwner) return;
      if (ctx.heroIdx !== ctx.card.heroIdx) return;
      // Card text is "affected by an OPPONENT's card or effect" —
      // self-inflicted statuses (Sickly Cheese self-poison, Zsos'Ssar
      // Decay-cost self-poison, any Pollution / Biomancy friendly-fire,
      // …) must not consume Stellan's once-per-turn through this path.
      // The damaging self-inflicted statuses (Poison, Burn) still
      // trigger on their later tick via `afterDamage` — which is source-
      // agnostic on purpose.
      //
      // `appliedBy` is set on the status object by `addHeroStatus`. For
      // the rare call site that omits it the engine defaults to -1, so
      // we conservatively treat "unknown source" as opponent and fire.
      const appliedBy = target.statuses?.[ctx.statusName]?.appliedBy;
      if (appliedBy === ctx.cardOriginalOwner) return;
      // Only negative statuses count — self-applied buffs like `shielded`
      // or `immune` shouldn't spend the trigger. (Matches Fiona.)
      const statusDef = STATUS_EFFECTS[ctx.statusName];
      if (!statusDef?.negative) return;
      await tryFire(ctx);
    },
  },
};
