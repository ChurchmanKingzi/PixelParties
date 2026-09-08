'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Bishop of Kings [B]"  (v818)
//  Creature — Summoning Magic Lv2, 1 HP
//
//  "While you control at least 1 "Knight of Kings" and "Board of Kings"
//   is on the board, the effects of all Heroes your opponent controls
//   are negated. This counts as a negative status effect."
//
//  Umsetzung (Als Ruling 6.9., Frage 19): der Helden-Status `negated`
//  (⚡), dauerhaft gehalten wie das Paraseed-Gift — `sourceBound`
//  (ueberlebt das Zugende), `noAbsorb` (Resistance verbrennt nichts),
//  `_bishopOfKings`-Stempel zum Wiedereinsammeln. Faellt weg, sobald
//  Knight oder Board fehlen oder der Bishop stummgeschaltet ist.
//  Abgleich nach jedem Zonenwechsel, Zugbeginn/-ende und Kreaturentod.
//  Passive Heldeneffekte sind mit negiert (Tempeste-Ruling 1.9.).
// ═══════════════════════════════════════════
const { KNIGHT, controlsNamed, boardOfKingsOnBoard, ofKingsCpuAnswer } = require('./_of-kings-shared');

const CARD_NAME = 'Bishop of Kings [B]';

function conditionHolds(engine, inst) {
  if (!inst || inst.zone !== 'support') return false;
  if (engine.isCreatureEffectSuppressed(inst)) return false;
  const pi = inst.controller ?? inst.owner;
  return boardOfKingsOnBoard(engine) && controlsNamed(engine, pi, KNIGHT);
}

/** Abgleich fuer alle Bishops [B] auf dem Brett — je Gegnerseite. */
async function syncBishopNegation(engine, ignoreInstId) {
  const gs = engine.gs;
  for (let pi = 0; pi < (gs.players || []).length; pi++) {
    const bishops = engine.cardInstances.filter(i =>
      i.name === CARD_NAME && i.zone === 'support' && i.id !== ignoreInstId
      && (i.controller ?? i.owner) === pi);
    const active = bishops.some(b => conditionHolds(engine, b));
    const opp = 1 - pi;
    for (const { physOwner, heroIdx, hero } of engine.heroesControlledBy(opp)) {
      if (!hero?.name || hero.hp <= 0) continue;
      const st = hero.statuses?.negated;
      if (active) {
        if (st?._bishopOfKings) continue;
        if (st) { st._bishopOfKings = true; st.sourceBound = true; st.noAbsorb = true; engine.sync(); continue; }
        await engine.addHeroStatus(physOwner, heroIdx, 'negated', {
          _bishopOfKings: true, sourceBound: true, noAbsorb: true, permanent: true,
          appliedBy: pi, source: { name: CARD_NAME, owner: pi }, _skipReactionCheck: true,
        });
      } else if (st?._bishopOfKings) {
        await engine.removeHeroStatus(physOwner, heroIdx, 'negated', { bypassUnhealable: true });
      }
    }
  }
}

module.exports = {
  cpuResponse(engine, kind, payload) { return ofKingsCpuAnswer(engine, kind, payload); },
  activeIn: ['support'],

  hooks: {
    onCardEnterZone: async (ctx) => { await syncBishopNegation(ctx._engine); },
    onCardLeaveZone: async (ctx) => {
      const self = ctx.leavingCard?.id === ctx.card.id;
      await syncBishopNegation(ctx._engine, self ? ctx.card.id : undefined);
    },
    onTurnStart: async (ctx) => { await syncBishopNegation(ctx._engine); },
    onTurnEnd: async (ctx) => { await syncBishopNegation(ctx._engine); },
    onCreatureDeath: async (ctx) => { await syncBishopNegation(ctx._engine); },
    onCreatureSacrificed: async (ctx) => { await syncBishopNegation(ctx._engine); },
  },
};
module.exports.syncBishopNegation = syncBishopNegation;
