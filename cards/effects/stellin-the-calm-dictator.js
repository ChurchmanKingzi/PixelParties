// ═══════════════════════════════════════════
//  CARD EFFECT: "Stellin, the Calm Dictator"
//  Creature (Summoning Magic Lv 0, 50 HP)
//
//  Active effect (free, once per turn — standard
//  creatureEffect HOPT keyed on instance id):
//
//    Place a "Stellan, the Calm Cat" from your
//    hand or deck underneath this Creature.
//
//  While Stellan is attached:
//    • +200 HP (current and max).
//    • Once per turn, when THIS Creature takes
//      damage, you may summon up to 3 Lv-0
//      Creatures with different names from your
//      hand OR 1 Lv-0 Creature from your deck
//      as additional Actions, onto ANY of your
//      Heroes' Support Zones (eligibility checked
//      per Hero — must be alive, not Frozen /
//      Stunned / Negated / Bound, must satisfy the
//      level / spell-school requirement, and must
//      have a free Support Zone slot).
//
//  Difference vs. Stellan: Stellan-the-Hero only
//  summons onto its own Support Zones; Stellin-
//  the-Creature summons onto ANY Hero on its side
//  that's currently capable of hosting the picked
//  card. Each placement re-evaluates eligibility
//  because earlier placements consume slots.
//
//  Slot pick uses the engine's `zonePick` prompt:
//  every eligible free Support Zone lights up and
//  the player clicks one directly. Auto-picks
//  silently when only one zone qualifies (clicking
//  the lone highlight would be theatre — feels
//  wrong inside the chained 3-card hand path).
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME    = 'Stellin, the Calm Dictator';
const ATTACHABLE   = 'Stellan, the Calm Cat';
const HOPT_KEY     = '_stellinTriggeredThisTurn';
const MAX_FROM_HAND = 3;

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

/** First free Support Zone index on `heroIdx`, or -1 if all full. */
function firstFreeSlot(ps, heroIdx) {
  const zones = ps.supportZones?.[heroIdx] || [[], [], []];
  for (let z = 0; z < 3; z++) {
    if ((zones[z] || []).length === 0) return z;
  }
  return -1;
}

/** Total free Support Zone slots across all of `pi`'s LIVING heroes. */
function totalFreeSlotsOnSide(ps) {
  let n = 0;
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name || hero.hp <= 0) continue;
    const zones = ps.supportZones?.[hi] || [];
    for (let z = 0; z < 3; z++) {
      if ((zones[z] || []).length === 0) n++;
    }
  }
  return n;
}

/**
 * Per-(hero, card) eligibility check. A hero qualifies as a placement
 * host iff:
 *   • alive (hp > 0)
 *   • not Frozen / Stunned / Negated / Bound (the four "incapacitated"
 *     statuses spec'd by the user)
 *   • has at least one free Support Zone slot
 *   • meets the spell-school / level requirement for the candidate card
 *     — `heroMeetsLevelReq` already collapses Lv-0 creatures with no
 *     spellSchool to "always yes" and applies all board-wide level
 *     reductions, so future Forager-style helpers Just Work.
 */
function isHostable(engine, pi, heroIdx, cardData) {
  const ps = engine.gs.players[pi];
  const hero = ps?.heroes?.[heroIdx];
  if (!hero?.name) return false;
  if (hero.hp <= 0) return false;
  const s = hero.statuses || {};
  if (s.frozen || s.stunned || s.negated || s.bound) return false;
  if (firstFreeSlot(ps, heroIdx) < 0) return false;
  if (!engine.heroMeetsLevelReq(pi, heroIdx, cardData)) return false;
  return true;
}

/** Effective-Lv-0 Creature names in `source` (hand / mainDeck), deduped. */
function levelZeroCreatureNames(engine, playerIdx, source) {
  const cardDB = engine._getCardDB();
  const seen = new Set();
  const result = [];
  for (const cn of (source || [])) {
    if (seen.has(cn)) continue;
    const cd = cardDB[cn];
    if (!cd || !hasCardType(cd, 'Creature')) continue;
    const raw = cd.level || 0;
    if (raw === 0) { seen.add(cn); result.push(cn); continue; }
    const reduced = engine._applyCardLevelReductions(cd, raw, playerIdx);
    if (reduced === 0) { seen.add(cn); result.push(cn); }
  }
  return result;
}

function countCopies(arr, cardName) {
  let n = 0;
  for (const c of (arr || [])) if (c === cardName) n++;
  return n;
}

/**
 * Prompt the player to pick which Hero+Slot on their side will host
 * `cardName`. Uses the engine's `zonePick` prompt so every eligible
 * free Support Zone lights up on the board and the player clicks
 * directly — no clunky text menu of Hero names. Re-evaluated freshly
 * each call so previous placements' slot consumption is reflected.
 *
 * Returns `{ heroIdx, slotIdx }` on success, `null` on cancel or
 * if no eligible zone exists (the latter case never prompts).
 *
 * Single-zone shortcut: if only ONE free slot total qualifies, auto-
 * pick it — clicking the only highlighted zone would be theatre and
 * adds friction to the chained 3-card hand path.
 */
async function pickHostSlot(engine, pi, cardName, cardData) {
  const ps = engine.gs.players[pi];
  const zones = [];
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    if (!isHostable(engine, pi, hi, cardData)) continue;
    const supZones = ps.supportZones?.[hi] || [];
    for (let z = 0; z < 3; z++) {
      if ((supZones[z] || []).length === 0) {
        zones.push({ heroIdx: hi, slotIdx: z });
      }
    }
  }
  if (zones.length === 0) return null;
  if (zones.length === 1) {
    return { heroIdx: zones[0].heroIdx, slotIdx: zones[0].slotIdx };
  }
  const res = await engine.promptGeneric(pi, {
    type: 'zonePick',
    zones,
    title: CARD_NAME,
    description: `Click a Support Zone to place ${cardName}.`,
    // Small card preview shown inside the prompt panel so the player
    // can see what they're about to drop without consulting the hand.
    previewCardName: cardName,
    cancellable: true,
  });
  if (!res || res.cancelled) return null;
  if (res.heroIdx == null || res.slotIdx == null) return null;
  return { heroIdx: res.heroIdx, slotIdx: res.slotIdx };
}

/**
 * Hand-or-deck summon flow. Picks creatures, prompts host hero per
 * placement, places them. Returns true iff at least one creature was
 * actually placed (so the trigger consumes; otherwise it refunds).
 */
async function runStellinEffect(ctx) {
  const engine  = ctx._engine;
  const gs      = engine.gs;
  const pi      = ctx.cardOwner;
  const ps      = gs.players[pi];
  if (!ps) return false;
  if (ps.summonLocked) return false;

  const cardDB = engine._getCardDB();

  const handEligible = levelZeroCreatureNames(engine, pi, ps.hand);
  const deckEligible = levelZeroCreatureNames(engine, pi, ps.mainDeck);
  if (handEligible.length === 0 && deckEligible.length === 0) return false;

  // Pre-flight: at least one hero on this side must be hostable for at
  // least one eligible card. If the entire side is incapacitated /
  // slot-full, fizzle without consuming the trigger.
  const anyHostable = (names) => names.some(cn => {
    const cd = cardDB[cn];
    if (!cd) return false;
    for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
      if (isHostable(engine, pi, hi, cd)) return true;
    }
    return false;
  });
  if (!anyHostable(handEligible) && !anyHostable(deckEligible)) return false;

  // ── Source pick (hand / deck / cancel) ──
  let source;
  if (handEligible.length > 0 && deckEligible.length > 0
      && anyHostable(handEligible) && anyHostable(deckEligible)) {
    const freeSlotsTotal = totalFreeSlotsOnSide(ps);
    const handCap = Math.min(MAX_FROM_HAND, handEligible.length, freeSlotsTotal);
    const optRes = await engine.promptGeneric(pi, {
      type: 'optionPicker',
      title: CARD_NAME,
      description: 'Place Creatures from where?',
      options: [
        { id: 'hand', label: `✋  Up to ${handCap} from hand` },
        { id: 'deck', label: '📚  1 from deck' },
      ],
      cancellable: true,
    });
    if (!optRes || optRes.cancelled || !optRes.optionId) return false;
    source = optRes.optionId;
  } else if (handEligible.length > 0 && anyHostable(handEligible)) {
    source = 'hand';
  } else {
    source = 'deck';
  }

  if (source === 'hand') {
    const freeSlotsTotal = totalFreeSlotsOnSide(ps);
    const handCap = Math.min(MAX_FROM_HAND, handEligible.length, freeSlotsTotal);
    const gallery = handEligible.map(cn => ({ name: cn, source: 'hand' }));
    const picked = await engine.promptGeneric(pi, {
      type: 'cardGalleryMulti',
      cards: gallery,
      selectCount: handCap,
      minSelect: 0,
      title: CARD_NAME,
      description: `Choose up to ${handCap} Level 0 Creature${handCap > 1 ? 's' : ''} with different names from your hand to summon. You'll pick a Hero for each.`,
      confirmLabel: '✨ Summon!',
      confirmClass: 'btn-success',
      cancellable: true,
    });
    if (!picked || picked.cancelled) return false;
    const chosen = Array.isArray(picked.selectedCards) ? picked.selectedCards : [];
    if (chosen.length === 0) return false;

    let placed = 0;
    let userCancelled = false;
    for (const cardName of chosen) {
      if (userCancelled) break;
      // Re-verify hand presence — previous placements' onPlay hooks
      // could have moved cards around.
      if ((ps.hand || []).indexOf(cardName) < 0) continue;
      const cd = cardDB[cardName];
      if (!cd) continue;
      // Pre-check eligibility so we can tell "no host available for THIS
      // card, skip" apart from "user cancelled the host prompt, stop".
      let anyHost = false;
      for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
        if (isHostable(engine, pi, hi, cd)) { anyHost = true; break; }
      }
      if (!anyHost) continue;
      const dest = await pickHostSlot(engine, pi, cardName, cd);
      if (!dest) { userCancelled = true; break; }
      const { heroIdx, slotIdx: slot } = dest;
      // Race: the picked slot could have been filled between prompt
      // close and action — re-verify before committing.
      const supZones = ps.supportZones?.[heroIdx] || [];
      if ((supZones[slot] || []).length !== 0) continue;
      const res = await engine.actionPlaceCreature(cardName, pi, heroIdx, slot, {
        source: 'hand',
        sourceName: CARD_NAME,
        countAsSummon: false,
        animationType: 'summon',
      });
      if (res?.inst) placed++;
    }
    if (placed === 0) return false;
    engine.log('stellin_trigger_hand', { player: ps.username, placed });
    engine.sync();
    return true;
  }

  // ── Deck path ──
  const gallery = deckEligible
    .filter(cn => {
      const cd = cardDB[cn];
      if (!cd) return false;
      for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
        if (isHostable(engine, pi, hi, cd)) return true;
      }
      return false;
    })
    .map(cn => ({ name: cn, source: 'deck', count: countCopies(ps.mainDeck, cn) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  if (gallery.length === 0) return false;
  const picked = await engine.promptGeneric(pi, {
    type: 'cardGallery',
    cards: gallery,
    title: CARD_NAME,
    description: `Choose a Level 0 Creature from your deck to summon.`,
    cancellable: true,
  });
  if (!picked || picked.cancelled || !picked.cardName) return false;
  const chosenName = picked.cardName;
  const cd = cardDB[chosenName];
  if (!cd) return false;

  const dest = await pickHostSlot(engine, pi, chosenName, cd);
  if (!dest) return false;
  const { heroIdx, slotIdx: slot } = dest;

  const deckIdx = ps.mainDeck.indexOf(chosenName);
  if (deckIdx < 0) return false;
  ps.mainDeck.splice(deckIdx, 1);

  // Race: slot could have been filled between prompt and now (engine
  // has been doing other work during the prompt's network round-trip).
  const supZones = ps.supportZones?.[heroIdx] || [];
  if ((supZones[slot] || []).length !== 0) {
    ps.mainDeck.push(chosenName);
    engine.shuffleDeck(pi, 'main');
    return false;
  }
  const summonRes = await engine.summonCreatureWithHooks(chosenName, pi, heroIdx, slot, {
    source: CARD_NAME,
    countAsSummon: false,
  });
  if (!summonRes) {
    ps.mainDeck.push(chosenName);
    engine.shuffleDeck(pi, 'main');
    return false;
  }

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
  engine.log('stellin_trigger_deck', { player: ps.username, summoned: chosenName });
  engine.sync();
  return true;
}

module.exports = {
  activeIn: ['support'],

  attachableHeroes: [ATTACHABLE],

  creatureEffect: true,

  canActivateCreatureEffect(ctx) {
    if (ctx.card.counters?.attachedHero) return false;
    const ps = ctx._engine.gs.players[ctx.cardOwner];
    if (!ps) return false;
    const hasStellan = (ps.hand || []).includes(ATTACHABLE)
      || (ps.mainDeck || []).includes(ATTACHABLE);
    return hasStellan;
  },

  async onCreatureEffect(ctx) {
    return await ctx._engine.actionAttachHeroToCreature(
      ctx.cardOwner, ATTACHABLE, ctx.card,
      { source: CARD_NAME },
    );
  },

  onAttachHero(engine, ctx) {
    engine.increaseMaxHp(ctx.card, 200);
  },

  cpuMeta: { alwaysCommit: true },

  hooks: {
    onTurnStart: (ctx) => {
      refundTrigger(ctx.card);
    },

    /**
     * Trigger: THIS Stellin took damage in the just-resolved batch and
     * survived. Stellin dying is naturally suppressed because runHooks
     * filters listeners from `cardInstances` and the death loop has
     * already untracked dead instances by the time this fires.
     */
    afterCreatureDamageBatch: async (ctx) => {
      if (!ctx.card.counters?.attachedHero) return;
      if (alreadyTriggered(ctx.card)) return;
      if ((ctx.card.counters?.currentHp || 0) <= 0) return;

      const entries = ctx.entries || [];
      const myInstId = ctx.card.id;
      const wasHit = entries.some(e =>
        e?.inst &&
        !e.cancelled &&
        e.inst.id === myInstId &&
        (e.amount || 0) > 0
      );
      if (!wasHit) return;

      // Reserve up front so a re-entrant batch can't slip a second
      // trigger through this one's prompt window. Refund on cancel.
      markTriggered(ctx.card);
      let placed = false;
      try {
        placed = await runStellinEffect(ctx);
      } catch (err) {
        console.error('[Stellin] effect threw:', err.message);
      }
      if (!placed) refundTrigger(ctx.card);
    },
  },
};
