// ═══════════════════════════════════════════
//  CARD EFFECT: "Terror"
//  Ability — Passive effect counter
//
//  After a player resolves 9/8/7 (Lv1/2/3)
//  unique card names during their turn, that
//  turn immediately ends (moves to End Phase).
//
//  Tracking is handled by the engine:
//  _trackTerrorResolvedEffect / _checkTerrorThreshold
// ═══════════════════════════════════════════

module.exports = {
  activeIn: ['ability'],
  isPassive: true,

  // No active effect — Terror is purely passive.
  // The engine tracks resolved effect names via _trackTerrorResolvedEffect()
  // and checks the threshold via _checkTerrorThreshold().
  // The threshold is 10 - (number of Terror copies on the hero with the most copies).
};
