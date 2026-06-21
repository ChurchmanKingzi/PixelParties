// ═══════════════════════════════════════════
//  CARD EFFECT: "Chaorc Cannon Fodder"
//  Creature (Summoning Magic Lv1, 50 HP)   (Banned)
//
//  "You may sacrifice this Creature for the effect of a 'Chaorc' card
//   the turn it is summoned, even if that effect can normally only
//   sacrifice Creatures not summoned the same turn."
//
//  Cannon Fodder has NO active behaviour of its own. Its entire rules
//  text is a single exception to every other Chaorc's sacrifice cost,
//  and that exception is enforced in exactly one place —
//  `chaorcSacrificeFilter` in `_chaorcs-shared.js`, which whitelists
//  this card by name regardless of `turnPlayed`. Every Chaorc cost
//  (Calamitusk, Friendly Fireballer, Pyre Grill Master, Interception,
//  …) routes its sacrifice through that filter, so the exception
//  applies uniformly without this file needing any logic.
//
//  The file exists only to (a) register the `cpuMeta` marker so the
//  CPU values Cannon Fodder as a cheap, throw-away tribute, and (b)
//  document the above. `canSummon` returning true is the loader's
//  sanctioned "passive script" registration path (no real summon
//  restriction is imposed).
// ═══════════════════════════════════════════

module.exports = {
  // Registers the script (passive-gate path) without imposing any
  // actual summon restriction.
  canSummon: () => true,

  cpuMeta: {
    // A 50-HP vanilla body whose purpose is to die for the engine.
    // Positive on-death benefit → the CPU treats own copies as
    // attractive sacrifice fuel and opponent copies as poor Attack
    // targets (killing them just feeds their plan).
    onDeathBenefit: 10,
  },
};
