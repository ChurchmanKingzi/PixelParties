// ═══════════════════════════════════════════
//  CARD EFFECT: "Infected Squirrel"
//  Creature — 20 HP (level 0)
//
//  • This Creature on the board also counts as a
//    Deepsea Creature. (Handled by the Deepsea
//    shared module's `isDeepseaCreature`
//    predicate — hard-coded exception there.)
//  • You may add this Creature back to your hand
//    for the effect of a "Deepsea" Creature from
//    your hand even THE TURN IT WAS SUMMONED
//    (normally bounce targets must have been on
//    board at least one turn). If you do, you
//    cannot summon or place other Creatures for
//    the rest of the turn afterwards.
//
//  Wiring:
//    • `getBounceableDeepseaCreatures` in
//      `_deepsea-shared.js` lists Squirrel
//      regardless of its `turnPlayed` (special
//      cased by name), so every Deepsea
//      Creature's drag-to-swap flow already
//      shows Squirrel as a valid swap target.
//    • `tryBouncePlace` in the same module
//      detects a Squirrel bounced on the same
//      turn it was summoned and sets
//      `ps.summonLocked = true` — the standard
//      per-turn summon lock cleared at turn
//      start. No creatureEffect / click-to-
//      activate is needed; the mechanic lives
//      entirely on the bounce-place side.
// ═══════════════════════════════════════════

module.exports = {
  activeIn: ['support'],
  // No hooks or active effect — the "bounce me for a Deepsea Creature
  // this turn" mechanic is driven from the Deepsea bounce-place flow.
};
