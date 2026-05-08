// ═══════════════════════════════════════════
//  Shared Sparkfly archetype helpers.
//
//  Used by:
//    • sparkfly-architect.js
//    • sparkfly-attendant.js
//    • sparkfly-worker.js
//    • sparkfly-queen.js
//    • hives-crown.js
// ═══════════════════════════════════════════

const SPARKFLY_NAMES = [
  'Sparkfly Architect',
  'Sparkfly Attendant',
  'Sparkfly Worker',
  'Sparkfly Queen',
];
const QUEEN_NAME       = 'Sparkfly Queen';
const HIVE_CROWN_NAME  = "Hive's Crown";
const SAC_CANDIDATES   = ['Sparkfly Architect', 'Sparkfly Attendant', 'Sparkfly Worker'];

/** Card-name predicates. */
function isSparkflyCreature(name) {
  return SPARKFLY_NAMES.includes(name);
}
function isNonQueenSparkfly(name) {
  return SAC_CANDIDATES.includes(name);
}

/**
 * Walk a player's support zones and return the first live Sparkfly Queen
 * instance they own/control (or null).
 */
function findControlledQueen(engine, playerIdx) {
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support') continue;
    if (inst.name !== QUEEN_NAME) continue;
    if ((inst.controller ?? inst.owner) !== playerIdx) continue;
    return inst;
  }
  return null;
}

/**
 * Return every non-Queen Sparkfly Creature instance the player controls,
 * eligible to be sacrificed by Hive's Crown. Sleeping/sick creatures are
 * fine — the "wasn't summoned this turn" branch is the bonus path; the
 * sacrifice itself works on either.
 */
function findSacrificeCandidates(engine, playerIdx) {
  const out = [];
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support') continue;
    if (!isNonQueenSparkfly(inst.name)) continue;
    if ((inst.controller ?? inst.owner) !== playerIdx) continue;
    out.push(inst);
  }
  return out;
}

/**
 * Reminder text for each sacrifice gift — surfaced to the client tooltip
 * via `_inheritedEffects` so a hovered Queen lists them under its base
 * effect. Kept here (server-side) so any future card that reads "what
 * gifts does this Queen carry?" has a single source of truth.
 */
const GIFT_REMINDERS = {
  architect: {
    label: "Architect's Gift",
    text: 'You may once per turn draw cards until you have the same number of cards in your hand as your opponent.',
    buffKey: 'sparkfly_gift_architect',
  },
  attendant: {
    label: "Attendant's Gift",
    text: "This Creature is unaffected by your opponent's cards and effects, except damage.",
    buffKey: 'sparkfly_gift_attendant',
  },
  worker: {
    label: "Worker's Gift",
    text: 'You may once per turn make your opponent choose any card on their side of the board that is not a Hero and add it to your hand.',
    buffKey: 'sparkfly_gift_worker',
  },
};

/**
 * Stamp the gift granted by sacrificing `sourceName` onto a freshly-placed
 * Sparkfly Queen instance. The Queen's own script reads these flags during
 * its creatureEffect path and during opponent-immunity checks.
 *
 * Marks recorded on the Queen's counters:
 *   _sparkflyGifts.architect — Queen may once/turn draw to opp's hand size
 *   _sparkflyGifts.attendant — Queen is unaffected by opp's effects (except damage)
 *   _sparkflyGifts.worker    — Queen may once/turn make opp pick a non-Hero board card → your hand
 *
 * Also populates UI-facing markers so the client renders the gifts:
 *   counters.buffs.sparkfly_gift_*  — picked up by the BuffColumn icon strip
 *   counters._inheritedEffects[]   — read by CardTooltipContent and listed
 *                                    under the Queen's own rules text on hover
 *
 * The Attendant gift sets the engine's `_oppEffectImmune` flag — a
 * source-AWARE sibling of `_cardinalImmune` that's checked at every
 * non-damage immunity site (destroy, negate, status application,
 * etc.) and only fires when the source is the OPPONENT. Damage is
 * NOT covered, matching the gift text's "except damage" clause —
 * opp damage lands normally on a Queen carrying only the gift.
 *
 * The live aura (handled by `refreshAttendantAura`) sets BOTH
 * `_oppEffectImmune` AND `_oppDamageImmune` so damage AND non-damage
 * opp effects fizzle while at least one Attendant remains on board.
 *
 * `_sparkflyAttendantGift` marker is informational; the gift's
 * counters live independently from the aura's, so the strip path
 * doesn't need to consult it.
 */
function grantInheritedAbility(queenInst, sourceName) {
  if (!queenInst) return;
  if (!queenInst.counters) queenInst.counters = {};
  if (!queenInst.counters._sparkflyGifts) queenInst.counters._sparkflyGifts = {};
  if (!queenInst.counters.buffs) queenInst.counters.buffs = {};
  if (!Array.isArray(queenInst.counters._inheritedEffects)) {
    queenInst.counters._inheritedEffects = [];
  }
  const gifts = queenInst.counters._sparkflyGifts;
  const buffs = queenInst.counters.buffs;
  const list  = queenInst.counters._inheritedEffects;

  let giftKey = null;
  if (sourceName === 'Sparkfly Architect')      { gifts.architect = true; giftKey = 'architect'; }
  else if (sourceName === 'Sparkfly Worker')    { gifts.worker    = true; giftKey = 'worker'; }
  else if (sourceName === 'Sparkfly Attendant') {
    gifts.attendant = true;
    queenInst.counters._oppEffectImmune = 1;
    queenInst.counters._sparkflyAttendantGift = 1;
    giftKey = 'attendant';
  }
  if (!giftKey) return;

  const reminder = GIFT_REMINDERS[giftKey];
  buffs[reminder.buffKey] = true;
  // Avoid duplicating the entry if the same sacrifice path somehow runs
  // twice for the same gift on the same Queen — shouldn't happen via
  // Hive's Crown today, but defensive against future tutor paths.
  if (!list.some(e => e.label === reminder.label)) {
    list.push({ label: reminder.label, text: reminder.text });
  }
}

/**
 * Refresh the live Attendant aura over a player's Queens. Called whenever
 * an Attendant or Queen enters/leaves a Support Zone on `playerIdx`'s side.
 *
 * Rule: while the player controls ≥1 Sparkfly Attendant, all their
 * Sparkfly Queens are unaffected by the opponent's cards/effects.
 * Aura wording carries no "except damage" clause — opp damage is
 * blocked too. Friendly cards/effects PASS THROUGH (own-side healing
 * and buffs still reach the Queen).
 *
 * Implementation: stamp `_oppEffectImmune` (source-aware non-damage
 * gate) AND `_oppDamageImmune` (source-aware damage gate) on each
 * controlled Queen, plus a marker `_sparkflyAttendantAura = 1`. When
 * the last Attendant leaves, strip both opp-only flags AND the marker.
 * The inherited Attendant gift (if present) keeps its own
 * `_oppEffectImmune` via `_sparkflyAttendantGift`, so we re-stamp it
 * after the aura strip to make sure the gift doesn't accidentally
 * lose its non-damage immunity.
 */
function refreshAttendantAura(engine, playerIdx) {
  const hasAttendant = engine.cardInstances.some(inst =>
    inst.zone === 'support'
    && inst.name === 'Sparkfly Attendant'
    && (inst.controller ?? inst.owner) === playerIdx,
  );

  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support') continue;
    if (inst.name !== QUEEN_NAME) continue;
    if ((inst.controller ?? inst.owner) !== playerIdx) continue;
    if (!inst.counters) inst.counters = {};

    if (hasAttendant) {
      inst.counters._oppEffectImmune = 1;
      inst.counters._oppDamageImmune = 1;
      inst.counters._sparkflyAttendantAura = 1;
    } else if (inst.counters._sparkflyAttendantAura) {
      delete inst.counters._sparkflyAttendantAura;
      delete inst.counters._oppDamageImmune;
      // Strip non-damage opp immunity ONLY if the gift isn't keeping
      // it on. The gift sets both `_oppEffectImmune` and the
      // `_sparkflyAttendantGift` marker; if the marker is present,
      // the flag stays.
      if (!inst.counters._sparkflyAttendantGift) {
        delete inst.counters._oppEffectImmune;
      }
    }
  }
}

/**
 * Collect every non-Hero card on the board (both sides) for Worker's
 * steal effect. Mirrors The Yeeting / Smug Mastermind Antonia: walks
 * support / ability / permanent / area / surprise zones, filters
 * top-of-stack for ability/area, skips immovable.
 *
 * Returns target objects shaped for `promptEffectTarget`.
 */
function collectNonHeroBoardTargets(gs, engine) {
  const targets = [];
  const seen = new Set();

  for (const inst of engine.cardInstances) {
    if (
      inst.zone === 'hand' || inst.zone === 'discard' ||
      inst.zone === 'deleted' || inst.zone === 'hero' || inst.zone === 'deck'
    ) continue;
    if (inst.counters?.immovable) continue;
    if (seen.has(inst.id)) continue;
    seen.add(inst.id);

    if (inst.zone === 'support') {
      targets.push({
        id: `equip-${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`,
        type: 'equip', owner: inst.owner, heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot,
        cardName: inst.name, _cardInstance: inst,
      });
    } else if (inst.zone === 'ability') {
      const slot = gs.players[inst.owner]?.abilityZones?.[inst.heroIdx]?.[inst.zoneSlot] || [];
      if (slot.length > 0 && slot[slot.length - 1] !== inst.name) continue;
      targets.push({
        id: `ability-${inst.owner}-${inst.heroIdx}-${inst.zoneSlot}`,
        type: 'ability', owner: inst.owner, heroIdx: inst.heroIdx, slotIdx: inst.zoneSlot,
        cardName: inst.name, _cardInstance: inst,
      });
    } else if (inst.zone === 'permanent') {
      targets.push({
        id: `perm-${inst.owner}-${inst.counters?.permId || inst.id}`,
        type: 'perm', owner: inst.owner, heroIdx: -1,
        cardName: inst.name, _cardInstance: inst,
      });
    } else if (inst.zone === 'area') {
      const areaArr = gs.areaZones?.[inst.owner] || [];
      if (areaArr.length > 0 && areaArr[areaArr.length - 1] !== inst.name) continue;
      targets.push({
        id: `area-${inst.owner}`,
        type: 'area', owner: inst.owner, heroIdx: -1,
        cardName: inst.name, _cardInstance: inst,
      });
    } else if (inst.zone === 'surprise') {
      targets.push({
        id: `equip-${inst.owner}-${inst.heroIdx}-surprise`,
        type: 'equip', owner: inst.owner, heroIdx: inst.heroIdx,
        cardName: inst.name, _cardInstance: inst,
      });
    }
  }

  return targets;
}

/**
 * Pull a card instance off the board (any non-Hero zone) and into
 * `pi`'s hand, tagged with `originalOwner = inst.owner` so subsequent
 * leave-hand events route the card back to its original side's pile.
 *
 * Used by Sparkfly Worker (live + Queen-gift) and Sparkfly Queen's
 * declared-type tutor (when stealing from opp's deck the same routing
 * applies — see queen file for the deck variant).
 *
 * Returns true on success.
 */
async function stealBoardCardToHand(engine, pi, targetInst, sourceName) {
  if (!targetInst) return false;
  const gs = engine.gs;
  const ps = gs.players[pi];
  if (!ps) return false;

  const owner    = targetInst.owner;
  const heroIdx  = targetInst.heroIdx;
  const zoneSlot = targetInst.zoneSlot;
  const zone     = targetInst.zone;
  const cardName = targetInst.name;

  const ownerPs = gs.players[owner];
  if (!ownerPs) return false;

  // Remove from its source zone.
  if (zone === 'support') {
    if (ownerPs.supportZones?.[heroIdx]) {
      ownerPs.supportZones[heroIdx][zoneSlot] = [];
    }
  } else if (zone === 'ability') {
    const slot = ownerPs.abilityZones?.[heroIdx]?.[zoneSlot];
    if (Array.isArray(slot)) {
      const idx = slot.lastIndexOf(cardName);
      if (idx >= 0) slot.splice(idx, 1);
    }
  } else if (zone === 'permanent') {
    if (Array.isArray(ownerPs.permanents)) {
      const idx = ownerPs.permanents.indexOf(cardName);
      if (idx >= 0) ownerPs.permanents.splice(idx, 1);
    }
  } else if (zone === 'area') {
    const arr = gs.areaZones?.[owner];
    if (Array.isArray(arr)) {
      const idx = arr.lastIndexOf(cardName);
      if (idx >= 0) arr.splice(idx, 1);
    }
  } else if (zone === 'surprise') {
    const sz = ownerPs.surpriseZones?.[heroIdx];
    if (Array.isArray(sz)) {
      const idx = sz.indexOf(cardName);
      if (idx >= 0) sz.splice(idx, 1);
    }
  } else {
    return false;
  }

  // Fire onCardLeaveZone for the moved card so any departing-listeners
  // (Pollution Piranha leave-hand-discard etc.) react before we stamp
  // it as hand-resident.
  await engine.runHooks('onCardLeaveZone', {
    card: targetInst,
    fromZone: zone,
    fromOwner: owner,
    fromHeroIdx: heroIdx,
    fromZoneSlot: zoneSlot,
    _skipReactionCheck: true,
  });

  // Untrack the original board instance, then re-track in hand under pi
  // with originalOwner pinned to the source side.
  engine._untrackCard(targetInst.id);
  ps.hand.push(cardName);
  const newInst = engine._trackCard(cardName, pi, 'hand');
  newInst.originalOwner = owner;

  // Authoritative flight animation — start at the EXACT board slot the
  // card was sitting in (not the receiver's deck/hand). The
  // `play_pile_transfer` handler suppresses the auto hand-grew detector
  // for this arrival, so this is the sole visual for the move.
  // `fromOwner` (board side) and `toOwner` (receiver) are different —
  // the cross-player path the handler supports.
  const newHandIdx = ps.hand.length - 1;
  const fromPile = (zone === 'support' || zone === 'ability' || zone === 'surprise')
    ? zone
    : (zone === 'permanent' ? 'permanent' : 'area');
  engine._broadcastEvent('play_pile_transfer', {
    fromOwner: owner,
    toOwner: pi,
    cardName,
    from: fromPile,
    to: 'hand',
    fromHeroIdx: heroIdx,
    fromSlotIdx: zoneSlot,
    // `play_pile_transfer`'s permanent-zone selector keys on `permId`
    // (Mass Multiplication / Deepsea swaps both pass it). Read it off
    // the original instance's counter — falls back gracefully to the
    // instance's id, which the handler accepts as a permId match.
    fromPermId: targetInst.counters?.permId || targetInst.id,
    toHandIdx: newHandIdx,
  });
  engine.log('sparkfly_steal', {
    by: sourceName,
    player: ps.username,
    card: cardName,
    fromZone: zone,
    fromOwner: gs.players[owner]?.username,
  });

  await engine.runHooks('onCardAddedToHand', {
    playerIdx: pi, card: newInst, cardName,
    source: sourceName, _skipReactionCheck: true,
  });

  engine.sync();
  return true;
}

module.exports = {
  SPARKFLY_NAMES,
  QUEEN_NAME,
  HIVE_CROWN_NAME,
  SAC_CANDIDATES,
  GIFT_REMINDERS,
  isSparkflyCreature,
  isNonQueenSparkfly,
  findControlledQueen,
  findSacrificeCandidates,
  grantInheritedAbility,
  refreshAttendantAura,
  collectNonHeroBoardTargets,
  stealBoardCardToHand,
};
