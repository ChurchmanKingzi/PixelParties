// ═══════════════════════════════════════════
//  CARD EFFECT: "Skeleton King Skullmael"  *(BANNED)*
//  Creature (Summoning Magic Lv1, Skeletons) — 50 HP
//
//  You can only control 1 "Skeleton King Skullmael". While you control
//  this Creature, "Skeleton" Creatures that are summoned from the
//  discard pile may use their active effects the turn they are
//  summoned and don't have their effects negated by the effect of
//  Necromancy.
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
      if (entering.id === ctx.card.id) return; // self-arrival, skip
      if (ctx.toZone !== 'support') return;
      // Only react to discard-pile summons. Tutors / Necromancy /
      // Raise the Minions! / Skeleton Necromancer all stamp this flag.
      if (!ctx._summonedFromDiscard) return;

      // Same-side check: Skullmael's controller equals the entering
      // creature's controller.
      const enterController = entering.controller ?? entering.owner;
      const myController = ctx.cardController ?? ctx.cardOwner;
      if (enterController !== myController) return;

      const engine = ctx._engine;
      if (!isSkeletonCreature(entering.name, engine)) return;

      // Lift summoning sickness so the Skeleton can fire its active
      // creature effect this turn. Same trick Vacarn uses through
      // necromancy.js — rewind turnPlayed by one so the engine's
      // HOPT gate stops reading the creature as fresh.
      if (entering.turnPlayed === (engine.gs.turn || 0)) {
        entering.turnPlayed = (engine.gs.turn || 0) - 1;
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
