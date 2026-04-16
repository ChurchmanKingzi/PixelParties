// ═══════════════════════════════════════════
//  Shared helpers for the "Steam Dwarfs" archetype.
//
//  Five of the six members share the SAME passive
//  trigger: "Once per turn, when you discard 1+
//  cards, this Creature's current & max HP are
//  increased by 50." — the so-called "steam engine".
//
//  This file exposes:
//    - STEAM_ENGINE_GAIN : the +HP constant
//    - attachSteamEngine(mod) : mixin that merges the
//        onDiscard hook into a card script
//    - decreaseCreatureMaxHp(engine, inst, amount) :
//        creature-side counterpart to engine.decreaseMaxHp
//        (used by Steam Dwarf Diver)
//    - isSteamDwarf(cardName, engine) : archetype check
//
//  The loader ignores any file starting with "_",
//  so this module is private infrastructure and
//  never registered as a card.
// ═══════════════════════════════════════════

const STEAM_ENGINE_GAIN = 50;
const ARCHETYPE = 'Steam Dwarfs';

/**
 * Fire the shared "+50 current & max HP on discard" passive for the
 * creature whose onDiscard hook is executing.
 *
 * Fires only when:
 *   - the discard belongs to this creature's controller, AND
 *   - the creature is alive in a support zone, AND
 *   - the creature is not negated, AND
 *   - the creature hasn't already triggered this turn (HOPT per instance).
 *
 * The "1 or more" batch semantics are preserved by the HOPT guard:
 * if five cards are discarded by a single effect the hook fires five
 * times, but only the first pass mutates HP. Subsequent passes see
 * the turn-stamp and exit.
 */
async function fireSteamEngine(ctx) {
  const engine = ctx._engine;
  const gs = engine.gs;
  const inst = ctx.card;

  if (!inst || inst.zone !== 'support') return;
  if (ctx.playerIdx !== ctx.cardOwner) return;        // only my discards
  if (inst.counters?.negated) return;                 // respect negation
  const hero = ctx.attachedHero;
  if (!hero?.name || hero.hp <= 0) return;            // dead hero column → skip

  // Hard once-per-turn per creature instance
  if (!inst.counters) inst.counters = {};
  const turn = gs.turn || 0;
  if (inst.counters._steamEngineTurn === turn) return;
  inst.counters._steamEngineTurn = turn;

  // Apply the engine — engine.increaseMaxHp handles the creature path
  // (bumps both counters.maxHp and counters.currentHp by the amount).
  engine.increaseMaxHp(inst, STEAM_ENGINE_GAIN);

  // Steam puff animation on the creature's zone
  engine._broadcastEvent('play_zone_animation', {
    type: 'steam_puff',
    owner: inst.owner,
    heroIdx: inst.heroIdx,
    zoneSlot: inst.zoneSlot,
  });

  engine.log('steam_engine_fired', {
    card: inst.name,
    player: gs.players[inst.owner]?.username,
    gain: STEAM_ENGINE_GAIN,
    newMax: inst.counters.maxHp,
  });

  engine.sync();
  await engine._delay(150);
}

/**
 * Mixin helper: merges the shared steam-engine onDiscard trigger into
 * a card module's hooks object. Preserves any existing onDiscard the
 * card may already define (calls the card's handler FIRST, then ours).
 *
 * Usage at the bottom of a card file:
 *   const mod = module.exports = { ...card definition... };
 *   attachSteamEngine(mod);
 */
function attachSteamEngine(mod) {
  if (!mod.hooks) mod.hooks = {};
  // Force the shared-engine cards to have activeIn 'support' so the
  // hook doesn't fire while the creature is in hand/discard/etc.
  if (!mod.activeIn) mod.activeIn = ['support'];
  const existing = mod.hooks.onDiscard;
  mod.hooks.onDiscard = async (ctx) => {
    if (existing) {
      try { await existing(ctx); } catch (err) {
        console.error('[SteamEngine] existing onDiscard threw:', err.message);
      }
    }
    try { await fireSteamEngine(ctx); } catch (err) {
      console.error('[SteamEngine] fireSteamEngine threw:', err.message);
    }
  };
  return mod;
}

/**
 * Creature-side max HP reduction. Mirrors engine.decreaseMaxHp's hero
 * path but for CardInstance creatures. Floors maxHp at 1. Clamps the
 * creature's currentHp to the new max so we never end up with HP
 * above the new ceiling.
 *
 * Returns the amount the max HP was actually reduced by.
 */
function decreaseCreatureMaxHp(engine, inst, amount) {
  if (!inst || amount <= 0) return 0;
  const cd = engine._getCardDB()[inst.name];
  if (!inst.counters) inst.counters = {};
  const baseMax = inst.counters.maxHp ?? cd?.hp ?? 0;
  if (baseMax <= 0) return 0;

  const effective = Math.min(amount, baseMax - 1); // never below 1
  if (effective <= 0) return 0;

  const newMax = baseMax - effective;
  inst.counters.maxHp = newMax;

  const curHp = inst.counters.currentHp ?? baseMax;
  if (curHp > newMax) inst.counters.currentHp = newMax;

  engine.log('creature_max_hp_decrease', {
    card: inst.name,
    amount: effective,
    newMax,
  });
  return effective;
}

/**
 * Set a creature's current & max HP to a specific absolute value.
 * Used by Steam Dwarf Brewer to duplicate its own max HP onto another.
 *
 * Delta-based implementation so we reuse the standard engine paths
 * and keep hook semantics consistent (log events, etc.).
 */
function setCreatureHp(engine, inst, newHp) {
  if (!inst || newHp <= 0) return 0;
  const cd = engine._getCardDB()[inst.name];
  if (!inst.counters) inst.counters = {};
  const curMax = inst.counters.maxHp ?? cd?.hp ?? 0;
  const delta = newHp - curMax;
  if (delta > 0) {
    engine.increaseMaxHp(inst, delta);
  } else if (delta < 0) {
    decreaseCreatureMaxHp(engine, inst, -delta);
    // Brewer sets *current* HP equal to target's new max too:
    inst.counters.currentHp = newHp;
  } else {
    // Same max — at least top off current HP to match.
    inst.counters.currentHp = newHp;
  }
  return delta;
}

/**
 * Is this card a member of the Steam Dwarfs archetype?
 * Looks up the card DB; doesn't rely on card name pattern.
 */
function isSteamDwarf(cardName, engine) {
  if (!cardName || !engine) return false;
  const cd = engine._getCardDB()[cardName];
  return cd?.archetype === ARCHETYPE;
}

/**
 * Find all alive, non-negated creatures on `playerIdx`'s side that are
 * eligible as sacrifices right now: in a support zone, not summoned
 * this turn. Used by Dragon Pilot.
 */
function getSacrificableCreatures(engine, playerIdx) {
  const gs = engine.gs;
  const turn = gs.turn || 0;
  const cardDB = engine._getCardDB();
  const results = [];
  for (const inst of engine.cardInstances) {
    if (inst.owner !== playerIdx) continue;
    if (inst.zone !== 'support') continue;
    if (inst.faceDown) continue;
    if (inst.turnPlayed === turn) continue;
    const cd = cardDB[inst.name];
    if (!cd) continue;
    // Accept Creatures and Tokens with Creature subtype
    const isCreature = cd.cardType === 'Creature'
      || (cd.cardType || '').split('/').includes('Creature')
      || (cd.subtype || '').split('/').includes('Creature');
    if (!isCreature) continue;
    const maxHp = inst.counters?.maxHp ?? cd.hp ?? 0;
    const level = cd.level || 0;
    results.push({ inst, maxHp, level, cardName: inst.name });
  }
  return results;
}

module.exports = {
  STEAM_ENGINE_GAIN,
  ARCHETYPE,
  attachSteamEngine,
  fireSteamEngine,
  decreaseCreatureMaxHp,
  setCreatureHp,
  isSteamDwarf,
  getSacrificableCreatures,
};
