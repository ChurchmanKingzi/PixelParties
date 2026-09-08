'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Rook of Kings [B]"  (v818)
//  Creature — Summoning Magic Lv3, 1 HP
//
//  "While you control at least 1 "Bishop of Kings" and "Board of Kings"
//   is on the board, targets you control are unaffected by your
//   opponent's cards and effects that would affect more than 1 target
//   you control."
//
//  Brett-Post-Target-Fenster (v818): sobald ein gegnerischer Effekt
//  mindestens ZWEI eigene Ziele (Helden und/oder Kreaturen) traegt,
//  bekommen ALLE eigenen Ziele Effekt-Immunitaet fuer diese Aufloesung
//  (`grantEffectImmunity` fuer Helden, `grantCreatureEffectImmunity`
//  fuer Kreaturen). Reichweite wie Escape Device / Storm Ring (Als
//  Ruling 6.9., Frage 8). Queen [B] zaehlt als Bishop. Passiv — der
//  Auftritt zeigt beiden Spielern, was gewirkt hat.
// ═══════════════════════════════════════════
const { BISHOP, controlsNamed, boardOfKingsOnBoard, ofKingsCpuAnswer } = require('./_of-kings-shared');

const CARD_NAME = 'Rook of Kings [B]';

function active(engine, inst) {
  const pi = inst.controller ?? inst.owner;
  return boardOfKingsOnBoard(engine) && controlsNamed(engine, pi, BISHOP);
}

module.exports = {
  cpuResponse(engine, kind, payload) { return ofKingsCpuAnswer(engine, kind, payload); },
  activeIn: ['support'],
  isPostTargetBoardReaction: true,

  postTargetBoardCondition(gs, pi, engine, targets, source, inst, info) {
    if (info.sourceOwner == null || info.sourceOwner === pi) return false;
    if (!active(engine, inst)) return false;
    const mine = targets.filter(t => t.owner === pi);
    return mine.length >= 2;
  },

  async postTargetBoardResolve(engine, pi, targets, source, inst) {
    const mine = targets.filter(t => t.owner === pi);
    let granted = 0;
    for (const t of mine) {
      if (t.type === 'equip' && t.cardInstance) {
        if (engine.grantCreatureEffectImmunity(t.cardInstance, source)) granted++;
      } else if (t.heroIdx != null && t.heroIdx >= 0 && t.type !== 'equip') {
        if (engine.grantEffectImmunity(t.owner, t.heroIdx, source)) granted++;
      }
    }
    if (granted === 0) return;
    await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi, source });
    engine.log('rook_of_kings_shield', {
      player: engine.gs.players[pi]?.username, source: source?.name || 'effect', targets: granted,
    });
  },

  hooks: {},
};
