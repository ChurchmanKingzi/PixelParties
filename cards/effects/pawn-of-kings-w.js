'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Pawn of Kings [W]"  (v818)
//  Creature — Summoning Magic Lv0, 1 HP, bis zu 8 Kopien (`maxCopies`)
//
//  "Your deck may contain up to 8 copies of this card. If "Board of
//   Kings" is on the board and you have not summoned any Creature yet
//   this turn, summoning this Creature counts as an additional Action."
//
//  Reine Zusatzaktion ohne Wahl: `inherentAction` — Board liegt (beide
//  Seiten) und `ps._creaturesSummonedThisTurn` ist 0. Der Zaehler wird
//  zentral in `summonCreatureWithHooks` / `doPlayCreature` gefuehrt.
// ═══════════════════════════════════════════
const { boardOfKingsOnBoard, ofKingsCpuAnswer } = require('./_of-kings-shared');

module.exports = {
  cpuResponse(engine, kind, payload) { return ofKingsCpuAnswer(engine, kind, payload); },
  activeIn: ['support'],

  inherentAction: (gs, pi, heroIdx, engine) => {
    if (!engine) return false;
    if (!boardOfKingsOnBoard(engine)) return false;
    return (gs.players[pi]?._creaturesSummonedThisTurn || 0) === 0;
  },

  hooks: {},
};
