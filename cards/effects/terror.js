// ═══════════════════════════════════════════
//  CARD EFFECT: "Terror"
//  Ability — Passive effect counter
//
//  After a player resolves 7/6/5 (Lv1/2/3)
//  unique card names during their turn, that
//  turn immediately ends (moves to End Phase).
//
//  Tracking is handled by the engine:
//  _trackTerrorResolvedEffect / _checkTerrorThreshold
// ═══════════════════════════════════════════

module.exports = {
  activeIn: ['ability'],
  isPassive: true,

  // Engine-level opt-in: while at least one copy of this Ability is
  // attached to a living, non-negated Hero, the engine counts unique
  // resolved-effect names per controller per turn and force-ends that
  // controller's turn once the count crosses the threshold returned
  // by `getThresholdFromCopies(copies)`. `copies` is the number of
  // this same Ability stacked on the qualifying Hero. The engine
  // takes the LOWEST threshold across all heroes; any Hero whose
  // script opts in via `immuneToTerror: true` blocks the force-end.
  forceEndTurnOnUniqueResolves: {
    // Lv1 = 7 unique resolves, Lv2 = 6, Lv3 = 5.
    getThresholdFromCopies(copies) {
      return 8 - copies;
    },
  },
};
