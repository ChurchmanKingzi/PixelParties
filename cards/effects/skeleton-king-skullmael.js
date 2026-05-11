// ═══════════════════════════════════════════
//  CARD EFFECT: "Skeleton King Skullmael"  *(BANNED)*
//  Creature (Summoning Magic Lv1, Skeletons) — 50 HP
//
//  You can only control 1 "Skeleton King Skullmael". While you control
//  this Creature that was summoned from the discard pile, "Skeleton"
//  Creatures that are summoned from the discard pile may use their
//  active effects the turn they are summoned and don't have their
//  effects negated by the effect of Necromancy.
//
//  Implementation:
//    1. `canSummon` enforces the 1-controlled cap.
//    2. `onCardEnterZone` listens for Skeleton creatures arriving with
//       `_summonedFromDiscard: true` on Skullmael's own side. Lifts
//       summoning sickness for ALL discard-summon paths (Necromancy,
//       Raise the Minions!, Skeleton Necromancer, future tutors); if
//       the summon was specifically by Necromancy
//       (`_summonedByNecromancy: true`), ALSO strips the standard
//       Necromancy negation that necromancy.js stamped just before
//       firing the entry hooks.
//    3. The aura is gated by an instance-level flag
//       `_skullmaelFromDiscard` stamped on Skullmael's OWN
//       onCardEnterZone — true iff Skullmael himself arrived via a
//       discard-pile summon. A hand-played Skullmael lacks the flag
//       and grants no buff. The flag lives on the inst, so it
//       naturally dies with this Skullmael — a re-revived next copy
//       of Skullmael starts fresh.
// ═══════════════════════════════════════════

const { isSkeletonCreature } = require('./_skeleton-shared');

const CARD_NAME = 'Skeleton King Skullmael';

/** Already controlling a Skullmael? */
function ownerHasSkullmael(engine, pi) {
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support') continue;
    if (inst.name !== CARD_NAME) continue;
    if ((inst.controller ?? inst.owner) !== pi) continue;
    return true;
  }
  return false;
}

module.exports = {
  activeIn: ['support'],

  /** Hard one-per-controller cap. */
  canSummon(ctx) {
    return !ownerHasSkullmael(ctx._engine, ctx.cardOwner);
  },

  hooks: {
    onCardEnterZone: (ctx) => {
      // Skullmael is the LISTENER — `ctx.card` is Skullmael, the
      // newly-arriving card is `ctx.enteringCard`.
      const entering = ctx.enteringCard;
      if (!entering) return;
      if (ctx.toZone !== 'support') return;

      // ── Self-arrival: stamp the discard-summon origin onto this
      //    Skullmael instance. The aura gate below reads this flag —
      //    a Skullmael who entered the board via a normal hand summon
      //    grants nothing; only one revived from the discard pile
      //    enables the buff for other Skeletons.
      if (entering.id === ctx.card.id) {
        if (ctx._summonedFromDiscard) {
          ctx.card.counters._skullmaelFromDiscard = true;
        }
        return;
      }

      // Only react to discard-pile summons. Tutors / Necromancy /
      // Raise the Minions! / Skeleton Necromancer all stamp this flag.
      if (!ctx._summonedFromDiscard) return;

      // Aura gate: this Skullmael himself must have been revived from
      // the discard pile for the buff to fire. Hand-summoned
      // Skullmaels are silent.
      if (!ctx.card.counters?._skullmaelFromDiscard) return;

      // Same-side check: Skullmael's controller equals the entering
      // creature's controller.
      const enterController = entering.controller ?? entering.owner;
      const myController = ctx.cardController ?? ctx.cardOwner;
      if (enterController !== myController) return;

      const engine = ctx._engine;
      if (!isSkeletonCreature(entering.name, engine)) return;

      // Lift summoning sickness so the Skeleton can fire its active
      // creature effect this turn. Mark with the Haste flag rather
      // than rewinding `turnPlayed` — engine-side summoning-sickness
      // gates respect `counters._hasHaste`, while `turnPlayed` stays
      // at the real summon turn so genuine "was summoned this turn"
      // reads (Alice the Puppeteer Girl, Hive's Crown, Singing's
      // exclude-fresh filter, …) still see the creature as a fresh
      // summon.
      if (entering.turnPlayed === (engine.gs.turn || 0)) {
        if (!entering.counters) entering.counters = {};
        entering.counters._hasHaste = true;
      }

      // Strip Necromancy's standard negation if it was just applied.
      // (Vacarn bypasses negation upfront — his Skeletons never carry
      // it. Other revivers via Necromancy DO have the negation buff
      // by the time this hook runs; Skullmael cleans it.)
      if (ctx._summonedByNecromancy) {
        if (entering.counters?.negated) delete entering.counters.negated;
        if (entering.counters?.buffs?.necromancy_negated) {
          delete entering.counters.buffs.necromancy_negated;
        }
      }

      engine.log('skullmael_aura', {
        player: engine.gs.players[myController]?.username,
        creature: entering.name,
        unsickened: true,
        unNegated: !!ctx._summonedByNecromancy,
      });
      engine.sync();
    },
  },
};
