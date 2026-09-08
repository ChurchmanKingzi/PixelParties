'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Queen of Kings [W]"  (v818)
//  Creature — Summoning Magic Lv3, 1 HP
//
//  "This card's level in your hand is reduced by the number of "of
//   Kings" Creatures you control. Summoning this Creature counts as an
//   additional Action. You can only summon 1 "Queen of Kings" per turn.
//   While this Creature and "Board of Kings" are on the board, this
//   Creature's name is also treated as "Knight of Kings", "Bishop of
//   Kings" and "Rook of Kings"."
//
//  • Level-Reduktion: `reduceLevelByOfKingsFactory`.
//  • Immer Zusatzaktion: `inherentAction: true`.
//  • Familienlimit „1 Queen per turn": `canSummon` + Stempel, geteilt
//    mit [B] (gleicher Schluessel).
//  • Namensauflösung nur mit Board: `instCountsAsName`; CPU-Aliasse
//    ebenfalls nur mit Board (`cpuMeta.boardAliasNames`).
// ═══════════════════════════════════════════
const { QUEEN, KNIGHT, BISHOP, ROOK, boardOfKingsOnBoard, reduceLevelByOfKingsFactory, ofKingsCpuAnswer } = require('./_of-kings-shared');

const CARD_NAME = 'Queen of Kings [W]';
const summonedKey = (pi) => `ofkings-summoned:${QUEEN}:${pi}`;

module.exports = {
  cpuResponse(engine, kind, payload) { return ofKingsCpuAnswer(engine, kind, payload); },
  activeIn: ['hand', 'support'],
  inherentAction: true,

  reduceCardLevel: reduceLevelByOfKingsFactory(CARD_NAME),

  canSummon(ctx) {
    const gs = ctx._engine.gs;
    return gs.hoptUsed?.[summonedKey(ctx.cardOwner)] !== gs.turn;
  },

  cpuMeta: {
    boardAliasNames(engine, inst) {
      return (inst?.zone === 'support' && boardOfKingsOnBoard(engine)) ? [KNIGHT, BISHOP, ROOK] : [];
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
