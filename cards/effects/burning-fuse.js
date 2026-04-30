// ═══════════════════════════════════════════
//  CARD EFFECT: "Burning Fuse"
//  Spell (Summoning Magic Lv1, Reaction-subtype)
//
//  You may activate this card when your opponent
//  enters their Action Phase. Activate the
//  effects of all "Bomblebee" Creatures you
//  control that have not yet used their effect
//  this turn (and were not summoned this turn,
//  and aren't Frozen / Stunned / negated /
//  nulled) as if a target your opponent controls
//  was defeated. Defeat all affected "Bomblebee"
//  Creatures afterwards. You can only activate
//  this card while you control at least 1 such
//  eligible "Bomblebee" Creature.
//
//  Activation paths
//  ────────────────
//  1. PROACTIVE — own turn, Main Phase OR Action
//     Phase. Costs no Action (`inherentAction:
//     true`), so it plays as a free additional
//     action without burning the player's per-
//     phase slot. Gated by `spellPlayCondition`.
//  2. REACTIVE — fires when the OPPONENT enters
//     their Action Phase, via the engine's
//     dedicated `_checkOppActionPhaseHandReactions`
//     helper. Standard chain reaction window does
//     NOT open on phase changes (`onPhaseStart`
//     is in REACTION_SKIP_HOOKS), AND we
//     deliberately omit `isReaction: true` so
//     Burning Fuse never appears in the generic
//     chain reaction window for unrelated events.
//     The opp-Action-Phase trigger is the ONLY
//     reactive activation path.
//
//  Both paths funnel into the same `runEffect`
//  body, which re-fires every eligible Bomblebee
//  via `triggerBomblebeeAsIfDeath` (HOPT-respecting)
//  and then defeats each one.
// ═══════════════════════════════════════════

const { findOwnBomblebees, triggerBomblebeeAsIfDeath } = require('./_bomblebee-shared');

const CARD_NAME = 'Burning Fuse';
const ANIM_TYPE = 'bomblebee_fuse';

// Eligible = controlled, alive, in support, NOT frozen/stunned/negated/
// nulled. Burning Fuse explicitly IGNORES the once-per-turn clause of
// each Bomblebee's natural trigger, so already-fired Bomblebees are
// still re-fired by Fuse. We pass `bypassHopt: true` through to the
// per-Bomblebee payload below to honor that.
//
// Time Bomblebee is EXCLUDED here. Unlike the other three Bomblebees,
// its trigger has no immediate payoff (it just stacks a Bomb Counter
// that detonates at the start of the opponent's turn) — re-firing it
// through Fuse, then immediately destroying it as part of Fuse's
// "defeat all affected" clause, would erase the counter and produce
// zero effect. Fuse only makes sense for Bomblebees with an immediate
// damage payload. If Time is the player's only (or only living)
// Bomblebee, Fuse is grayed out by `spellPlayCondition` returning
// false from this same set.
function eligibleBomblebees(engine, pi) {
  const all = findOwnBomblebees(engine, pi);
  return all.filter(inst => inst.name !== 'Time Bomblebee');
}

async function runEffect(engine, pi) {
  const gs = engine.gs;
  const ps = gs.players[pi];
  if (!ps) return;

  // Snapshot eligibility BEFORE any re-fire so concurrent state changes
  // (a Bomblebee dying mid-resolve, etc.) can't shift the target set.
  const targets = eligibleBomblebees(engine, pi);
  if (targets.length === 0) {
    engine.log('burning_fuse_fizzle', { player: ps.username, reason: 'no_eligible_bomblebees' });
    return;
  }

  // Fuse animation on each eligible Bomblebee.
  for (const inst of targets) {
    engine._broadcastEvent('play_zone_animation', {
      type: ANIM_TYPE,
      owner: inst.owner,
      heroIdx: inst.heroIdx,
      zoneSlot: inst.zoneSlot,
    });
  }
  await engine._delay(450);

  // Re-fire each Bomblebee's payload as if an opp target had died.
  // HOPT is BYPASSED — Burning Fuse's text overrides the once-per-
  // turn clause, so a Bomblebee that already fired this turn fires
  // again here. Sequential so prompts don't collide.
  for (const inst of targets) {
    if (inst.zone !== 'support') continue; // Could've left mid-resolve
    await triggerBomblebeeAsIfDeath(engine, inst, { bypassHopt: true });
  }

  // "Defeat all affected 'Bomblebee' Creatures afterwards." Time
  // Bomblebee with active Bomb Counters carries _damageDestroyImmune,
  // which would normally block actionDestroyCard. The card text says
  // ALL affected Bomblebees die, so we clear the flag immediately
  // before destruction. Counters die with the inst — leftover
  // bombCounters don't matter post-destroy.
  const source = { name: CARD_NAME, owner: pi };
  for (const inst of targets) {
    if (inst.zone !== 'support') continue;
    if (inst.counters?._damageDestroyImmune) {
      delete inst.counters._damageDestroyImmune;
    }
    await engine.actionDestroyCard(source, inst, { fireCreatureDeath: true });
  }

  engine.log('burning_fuse_resolve', {
    player: ps.username, count: targets.length,
  });
  engine.sync();
}

module.exports = {
  // Deliberately NO `isReaction: true` — that would put Burning Fuse in
  // the generic chain reaction window for every event the engine fires.
  // The card's only reactive activation point is the opp-Action-Phase
  // trigger, handled via the dedicated flag below.
  proactivePlay: true,            // Allows proactive play despite the
                                  // Reaction subtype gate at engine.js
                                  // and server.js.
  inherentAction: true,           // Proactive play costs no Action.
  isOppActionPhaseReaction: true, // Opp-Action-Phase trigger handler.

  // Proactive gate: at least one ELIGIBLE Bomblebee (per the strict
  // "available for re-fire" definition above). The text's eligibility
  // and the activation eligibility are the same — if no Bomblebee can
  // benefit, you can't play it.
  spellPlayCondition(gs, pi, engine) {
    if (!engine) return true; // Optimistic when called without engine ctx
    return eligibleBomblebees(engine, pi).length > 0;
  },

  // Same gate for the dedicated opp-Action-Phase window.
  oppActionPhaseReactionCondition(gs, pi, engine) {
    return eligibleBomblebees(engine, pi).length > 0;
  },

  // Proactive resolve (Main / Action Phase, own turn).
  hooks: {
    onPlay: async (ctx) => {
      await runEffect(ctx._engine, ctx.cardOwner);
    },
  },

  // Reactive resolve (opp Action Phase trigger).
  oppActionPhaseReactionResolve: runEffect,
};
