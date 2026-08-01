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
  // HINWEIS (1.8., Vertrags-Sweep): hier stand `isPassive: true`. Das
  // Flag wurde NIRGENDS gelesen — und es wäre auch redundant gewesen.
  // "Passiv" ist im Projekt kein eigener Vertrag, sondern die ABWESENHEIT
  // von `freeActivation`: der Aktivierungs-Sammler in _engine.js
  // (`getFreeActivatableAbilities`) nimmt ausschließlich Skripte mit
  // `freeActivation: true` auf. Gezählt: 17 Ability-Skripte tragen es
  // (manuell auslösbar), 17 tragen es nicht (passiv — Fighting,
  // Biomancy, Terror …), Widersprüche: 0.
  // Ein zusätzliches `isPassive` wäre also eine ZWEITE Wahrheitsquelle
  // für dieselbe Tatsache — genau das Muster, das in dieser Sitzung
  // viermal zu Bugs geführt hat (neverPlayable, isSacrifice,
  // ability_activated, originalOwner). Wird eine explizite Passiv-Marke
  // gebraucht (UI, CPU), gehört sie ABGELEITET: `!script?.freeActivation`.

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
