// ═══════════════════════════════════════════
//  SHARED: "Chaorcs" archetype
//
//  The Chaorcs are a SACRIFICE engine. Every member either feeds on
//  you sacrificing your own Creatures (the engine fires
//  `onCreatureSacrificed` once per tribute inside
//  `resolveSacrificeCost`, BEFORE the destroy) or makes sacrificing
//  cheaper / generate extra Actions.
//
//  This module centralises the three things every Chaorc shares:
//
//   1. `chaorcSacrificeFilter` — the canonical "a Creature you control
//      that was NOT summoned this turn" cost predicate, WITH the
//      Chaorc Cannon Fodder exception baked in (Cannon Fodder may be
//      sacrificed the turn it is summoned for any Chaorc cost). Pass
//      it as `spec.filter` to `engine.resolveSacrificeCost`, and use
//      `chaorcFreshSacCandidates` for the matching canActivate gate so
//      the two never drift apart.
//
//   2. `treatAsSacrificed` — synthesise a sacrifice event for a
//      Creature that LEFT the board some other way (Rider Warg: a
//      Creature killed by the opponent, or Rider Warg itself on
//      removal). Fires `onCreatureSacrificed` (so every on-sacrifice
//      payoff triggers) and bumps the per-turn tally, WITHOUT
//      re-firing `onCreatureDeath` (the Creature already died).
//
//   3. `isChaorcCreature` / slot helpers used across the tribe.
//
//  The per-turn sacrifice tally itself (`ps._creaturesSacrificedThisTurn`)
//  and the per-tribute `inst.counters._sacrificedTurn` stamp live in
//  the engine (`resolveSacrificeCost` / turn-start reset), symmetric to
//  `_creaturesSummonedThisTurn`.
// ═══════════════════════════════════════════

const CHAORC_ARCHETYPE = 'Chaorcs';
const CANNON_FODDER = 'Chaorc Cannon Fodder';

/** True iff `name` is a Chaorc Creature (by static card DB). */
function isChaorcCreature(name, engine) {
  if (!name) return false;
  const cd = engine?._getCardDB?.()[name];
  if (!cd) return false;
  const types = `${cd.cardType || ''}/${cd.subtype || ''}`;
  return cd.archetype === CHAORC_ARCHETYPE && types.split('/').includes('Creature');
}

/**
 * The canonical Chaorc sacrifice-cost predicate. A Creature qualifies
 * iff it was NOT summoned this turn — EXCEPT Chaorc Cannon Fodder,
 * which its own rules text lets you sacrifice the very turn it is
 * summoned for any "Chaorc" card's effect.
 *
 * Shape matches `engine.resolveSacrificeCost` candidates: `{ inst,
 * cardName, maxHp, level }`. Pass the returned fn straight through as
 * `spec.filter`.
 */
function chaorcSacrificeFilter(engine) {
  const turn = engine.gs.turn;
  return (c) => c.inst.turnPlayed !== turn || c.cardName === CANNON_FODDER;
}

/**
 * The sacrificable Creatures (engine helper already drops Cardinal
 * Beasts / immovables / face-downs) that satisfy `chaorcSacrificeFilter`.
 * `selfId` excludes the activating Creature itself (so a Creature's own
 * active effect can't sacrifice itself to pay its own cost). Pure read.
 */
function chaorcFreshSacCandidates(engine, pi, selfId) {
  const keep = chaorcSacrificeFilter(engine);
  let cs = engine.getSacrificableCreatures(pi);
  if (selfId != null) cs = cs.filter(c => c.inst.id !== selfId);
  return cs.filter(keep);
}

/** First empty Support-Zone slot (0–2) on `heroIdx`, or -1 if full. */
function firstFreeSupportSlot(engine, pi, heroIdx) {
  const zones = engine.gs.players[pi]?.supportZones?.[heroIdx] || [];
  for (let z = 0; z < 3; z++) {
    if ((zones[z] || []).length === 0) return z;
  }
  return -1;
}

/**
 * Treat `inst` as having been sacrificed by player `ownerPi`. Used for
 * "is treated as having been sacrificed" riders where the Creature was
 * removed by something OTHER than a sacrifice cost. Fires the
 * `onCreatureSacrificed` payoff window and bumps the per-turn tally /
 * stamp, but does NOT re-fire `onCreatureDeath` — the Creature already
 * left the board through its own removal.
 *
 * `inst` may be a live CardInstance or a lightweight {name, owner,
 * heroIdx, zoneSlot, id} death-info object.
 */
async function treatAsSacrificed(engine, inst, ownerPi, sourceName) {
  if (!inst) return;
  // The per-turn tally + `_sacrificedTurn` stamp are applied centrally in
  // `runHooks(onCreatureSacrificed)` below — don't increment here (would
  // double-count).
  await engine.runHooks('onCreatureSacrificed', {
    creature: inst,
    cardName: inst.name,
    owner: inst.owner ?? ownerPi,
    heroIdx: inst.heroIdx,
    zoneSlot: inst.zoneSlot,
    source: { name: sourceName, owner: ownerPi, heroIdx: inst.heroIdx ?? -1 },
    _skipReactionCheck: true,
    _treatedAsSacrifice: true,
  });
}

/**
 * Standard gate for "whenever you sacrifice a Creature you control"
 * payoff listeners on an `onCreatureSacrificed` ctx. `pi` is the
 * listening card's controller. True iff:
 *   • the sacrifice was initiated by `pi` and the tribute was `pi`'s
 *     own Creature, AND
 *   • the tribute is NOT the listening instance itself.
 *
 * General rule: a board card whose effect is "whenever a Creature is
 * sacrificed, do X" does NOT fire on ITS OWN sacrifice — it's leaving
 * the board in that very event, so it never gets to react. A SEPARATE
 * copy of the same card still triggers (different instance id), so the
 * exclusion is by instance, not by name. `onCreatureSacrificed` fires
 * while the tribute is still in its Support Zone, so the self-instance
 * is reliably identifiable here.
 */
function isOwnSacrifice(ctx, pi) {
  const sac = ctx.creature;
  if (!sac) return false;
  if (ctx.card?.id != null && sac.id === ctx.card.id) return false;
  if ((sac.controller ?? sac.owner) !== pi) return false;
  const srcOwner = ctx.source?.owner ?? ctx.source?.controller;
  return srcOwner == null || srcOwner === pi;
}

module.exports = {
  CHAORC_ARCHETYPE,
  CANNON_FODDER,
  isChaorcCreature,
  chaorcSacrificeFilter,
  chaorcFreshSacCandidates,
  firstFreeSupportSlot,
  treatAsSacrificed,
  isOwnSacrifice,
};
