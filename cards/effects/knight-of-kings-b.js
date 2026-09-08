'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Knight of Kings [B]"  (v818)
//  Creature — Summoning Magic Lv1, 1 HP
//
//  "While you control at least 1 "Rook of Kings" and "Board of Kings"
//   is on the board, your opponent cannot move cards from their deck or
//   discard pile to anywhere else (but they can still draw)."
//
//  Engine-Vertrag `blocksOpponentPileOut` (v818) — gelesen von
//  `pileOutAllowed`, das in den Stapel-Primitiven haengt (Tutor zur
//  Hand, Mill inkl. Self-Mill, Bewegungen aus Deck/Ablage, Sofortguss
//  aus dem Deck, Platzierung aus der Ablage). Nur Bewegungen des
//  Gegners selbst; Draws laufen nie durch das Gate (Als Ruling 6.9.,
//  Frage 11). Queen [B] zaehlt als Rook (`controlsNamed`).
//  Beide Farben stempeln die „Knight summoned this turn"-Marke.
// ═══════════════════════════════════════════
const { KNIGHT, ROOK, controlsNamed, boardOfKingsOnBoard, ofKingsCpuAnswer } = require('./_of-kings-shared');

const CARD_NAME = 'Knight of Kings [B]';
const summonedKey = (pi) => `ofkings-summoned:${KNIGHT}:${pi}`;

module.exports = {
  cpuResponse(engine, kind, payload) { return ofKingsCpuAnswer(engine, kind, payload); },
  activeIn: ['support'],

  blocksOpponentPileOut(engine, pileOwner, pile, inst) {
    const pi = inst.controller ?? inst.owner;
    if (pileOwner === pi) return false;
    if (!boardOfKingsOnBoard(engine)) return false;
    return controlsNamed(engine, pi, ROOK);
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
