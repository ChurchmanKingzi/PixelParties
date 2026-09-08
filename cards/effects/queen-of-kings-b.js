'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Queen of Kings [B]"  (v818)
//  Creature — Summoning Magic Lv3, 1 HP
//
//  "While this Creature is on the board, its name is also treated as
//   "Knight of Kings", "Bishop of Kings" and "Rook of Kings". While you
//   control this Creature, the effects of other Creatures you control
//   cannot be negated by negative status effects or your opponent's
//   effects."
//
//  • Namensauflösung: `instCountsAsName` (_of-kings-shared) — gelesen
//    von Bishop [B], Knight [B], Rook [B] und Rook [W]s „different name".
//  • Negations-Schutz: Engine-Vertrag `protectsCreatureEffects` (v818),
//    gelesen vom EINEN Stummschalt-Praedikat `isCreatureEffectSuppressed`
//    — die Statuseffekte liegen weiter auf der Kreatur, ihre Effekte
//    feuern trotzdem; und `actionNegateCreature` legt `negated`/`nulled`
//    durch den Gegner gar nicht erst an (Als Ruling 6.9., Frage 18).
//  • CPU: `cpuMeta.boardAliasNames` — fuer den Synergie-Kanal zaehlt die
//    Queen als alle drei Namen (Al 7.9.).
//  • „You can only summon 1 Queen of Kings per turn" steht auf [W],
//    gilt aber der Familie — beide Farben teilen `canSummon` + Stempel.
// ═══════════════════════════════════════════
const { QUEEN, KNIGHT, BISHOP, ROOK, boardOfKingsOnBoard, ofKingsCpuAnswer } = require('./_of-kings-shared');

const CARD_NAME = 'Queen of Kings [B]';
const summonedKey = (pi) => `ofkings-summoned:${QUEEN}:${pi}`;

module.exports = {
  cpuResponse(engine, kind, payload) { return ofKingsCpuAnswer(engine, kind, payload); },
  activeIn: ['support'],

  canSummon(ctx) {
    const gs = ctx._engine.gs;
    return gs.hoptUsed?.[summonedKey(ctx.cardOwner)] !== gs.turn;
  },

  protectsCreatureEffects(engine, inst, guard) {
    return guard.zone === 'support' && inst.id !== guard.id
      && (inst.controller ?? inst.owner) === (guard.controller ?? guard.owner);
  },

  cpuMeta: {
    boardAliasNames(engine, inst) {
      void boardOfKingsOnBoard;
      return inst?.zone === 'support' ? [KNIGHT, BISHOP, ROOK] : [];
    },
  },

  hooks: {
    onPlay: async (ctx) => {
      if (ctx.playedCard?.id !== ctx.card.id || ctx.card.zone !== 'support') return;
      if (ctx.card.counters?.isPlacement) return;
      const gs = ctx._engine.gs;
      if (!gs.hoptUsed) gs.hoptUsed = {};
      gs.hoptUsed[summonedKey(ctx.cardOwner)] = gs.turn;
    },
  },
};
