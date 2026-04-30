// ═══════════════════════════════════════════
//  Shared helpers for the Bomblebees archetype.
//
//  All four Bomblebee Creatures share the same
//  trigger pattern — "when an opponent target is
//  defeated, do X." This module factors out:
//
//    • BOMBLEBEE_NAMES — the canonical name set
//      used by Bomblebee Cluster's reaction
//      condition and by Burning Fuse's "fire all
//      Bomblebees as if a death happened" path.
//
//    • isOpponentTargetDeath(ctx, listenerOwner)
//      — folds onCreatureDeath / onHeroKO into
//      one predicate. Returns true iff the dying
//      target was on the opponent's side from the
//      listener's perspective.
//
//    • findOwnBomblebees(engine, pi, opts) —
//      enumerates the listener's living Bomble-
//      bees on the board, optionally excluding
//      ones summoned this turn (Burning Fuse).
//
//    • triggerBomblebeeAsIfDeath(engine, inst,
//      opts) — runs the per-Bomblebee body once
//      WITHOUT the natural HOPT gate. Used by
//      Burning Fuse to re-fire every applicable
//      Bomblebee even if their HOPT is already
//      stamped this turn.
// ═══════════════════════════════════════════

const BOMBLEBEE_NAMES = new Set([
  'Bomblebee',
  'Carpet Bomblebee',
  'Dive Bomblebee',
  'Time Bomblebee',
]);

// Per-Bomblebee HOPT key prefix. Only the three "once per turn" Bomble-
// bees use this; Time Bomblebee deliberately omits HOPT (its effect
// stacks per opp death by design — gain a counter EVERY time, not at
// most once). Burning Fuse's "skip Bomblebees that already used their
// effect" filter checks this map: a Bomblebee whose HOPT key is stamped
// for the current turn is considered USED. Time Bomblebee, having no
// entry, is always considered AVAILABLE — re-firing it just adds
// another Bomb Counter, which is consistent with its base trigger.
const BOMBLEBEE_HOPT_PREFIX = {
  'Bomblebee':         'bomblebee',
  'Carpet Bomblebee':  'carpet-bomblebee',
  'Dive Bomblebee':    'dive-bomblebee',
  // 'Time Bomblebee' intentionally absent — see comment above.
};

/**
 * True iff this Bomblebee's once-per-turn slot has already been claimed
 * this turn. Time Bomblebee always returns false (no HOPT — stackable).
 */
function bomblebeeHoptUsed(gs, inst) {
  const prefix = BOMBLEBEE_HOPT_PREFIX[inst?.name];
  if (!prefix) return false;
  return gs.hoptUsed?.[`${prefix}:${inst.id}`] === gs.turn;
}

/**
 * Both onCreatureDeath and onHeroKO fire when a target is defeated.
 * Their hookCtx shapes differ slightly:
 *   onCreatureDeath → ctx.creature = { name, owner, originalOwner, heroIdx, zoneSlot, instId }
 *   onHeroKO        → ctx.hero     = the dead hero object (no owner field — must look it up)
 * Returns true iff the defeated target was on the listener's opponent's side.
 */
function isOpponentTargetDeath(ctx, listenerOwner) {
  if (ctx.creature) {
    // Use originalOwner when present so a charmed/stolen creature dying
    // is still attributed to its physical side. For "opponent" purposes
    // both fields point to the same physical side anyway.
    const ownerOfDead = ctx.creature.originalOwner ?? ctx.creature.owner;
    return ownerOfDead !== listenerOwner;
  }
  if (ctx.hero) {
    const gs = ctx._engine?.gs;
    if (!gs) return false;
    const ownerOfDead = gs.players.findIndex(ps => (ps.heroes || []).includes(ctx.hero));
    if (ownerOfDead < 0) return false;
    return ownerOfDead !== listenerOwner;
  }
  return false;
}

/**
 * Live Bomblebee Creatures owned by `pi` and currently in a support zone,
 * with optional filters for Burning Fuse's eligibility rules.
 *
 * @param {object} engine
 * @param {number} pi
 * @param {object} [opts]
 * @param {boolean} [opts.excludeSummonedThisTurn=false] - Skip Bomblebees
 *   summoned this turn (text: "that were not summoned this turn").
 * @param {boolean} [opts.excludeHoptUsed=false] - Skip Bomblebees whose
 *   own once-per-turn slot is already claimed this turn (text: "have not
 *   used their effects yet that turn"). Time Bomblebee, having no HOPT,
 *   is always retained.
 */
function findOwnBomblebees(engine, pi, opts = {}) {
  const gs = engine.gs;
  const out = [];
  const currentTurn = gs.turn || 0;
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support') continue;
    if (inst.faceDown) continue;
    const owner = inst.controller ?? inst.owner;
    if (owner !== pi) continue;
    if (!BOMBLEBEE_NAMES.has(inst.name)) continue;
    // Skip negated/nulled/frozen/stunned Bomblebees — same gate the
    // engine's hook filter applies; defensive when called from Burning
    // Fuse which doesn't go through runHooks.
    if (inst.counters?.frozen || inst.counters?.stunned
        || inst.counters?.negated || inst.counters?.nulled) continue;
    if (opts.excludeSummonedThisTurn && inst.turnPlayed === currentTurn) continue;
    if (opts.excludeHoptUsed && bomblebeeHoptUsed(gs, inst)) continue;
    out.push(inst);
  }
  return out;
}

/**
 * Re-fire a single Bomblebee's payload AS IF an opponent target had just
 * been defeated. Used by Burning Fuse to retrigger eligible Bomblebees
 * on demand. Burning Fuse passes `bypassHopt: true` so Bomblebees that
 * already fired their once-per-turn slot this turn fire AGAIN through
 * this path — Fuse's text explicitly overrides the once-per-turn clause.
 * The `opts` object is forwarded directly to the per-Bomblebee payload,
 * which checks `opts.bypassHopt` before consulting / stamping HOPT.
 *
 * The per-Bomblebee body lives on each card's script as a hookless
 * helper (see cards/effects/{bomblebee,carpet-bomblebee,dive-bomblebee,
 * time-bomblebee}.js → exports.runOpponentDeathPayload). This helper
 * looks up the inst's name, dispatches to the script, and awaits.
 *
 * Caller is expected to defeat the inst afterwards (Burning Fuse's text:
 * "Defeat all affected 'Bomblebee' Creatures afterwards"). This module
 * deliberately does NOT destroy here so the caller controls ordering.
 */
async function triggerBomblebeeAsIfDeath(engine, inst, opts = {}) {
  if (!inst || inst.zone !== 'support') return false;
  if (!BOMBLEBEE_NAMES.has(inst.name)) return false;
  const { loadCardEffect } = require('./_loader');
  const script = loadCardEffect(inst.name);
  if (!script?.runOpponentDeathPayload) return false;
  try {
    await script.runOpponentDeathPayload(engine, inst, opts);
    return true;
  } catch (err) {
    console.error(`[Bomblebees] ${inst.name} re-trigger threw:`, err.message);
    return false;
  }
}

module.exports = {
  BOMBLEBEE_NAMES,
  isOpponentTargetDeath,
  findOwnBomblebees,
  triggerBomblebeeAsIfDeath,
};
