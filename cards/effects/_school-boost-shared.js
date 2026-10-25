'use strict';
// ═══════════════════════════════════════════
//  SHARED: Rosie, the School Idol / Kai, the Rowdy (W74a)
//
//  „You may summon this Creature as an additional Action with a Hero that has at least <School> 2. For every level of <School> the corresponding Hero has, it may use Spells
//   1 level higher than it otherwise could. You can only control 1 "<Name>"."
//
//  ① ZUSATZAKTION: `inherentAction(gs, pi, heroIdx, engine)` — der beschwörende Held hat <School> ≥ 2 (`heroSchoolLevel`, harte Negation → 0).
//  ② „MAY USE SPELLS N LEVELS HIGHER": dieselbe Levellücken-Deckung wie Divinity / Wisdom / Summoning Instructions (`coverLevelGap`, Engine `_findLevelGapCoverage`) — KOSTENLOS und
//     nur für SPELLS. Die Stärke N = <School>-Stufe des ENTSPRECHENDEN Helden (der Held, in dessen Support Zone die Kreatur steht), live gerechnet (`levelGapCapacity`);
//     sie ruht bei Frost/Betäubung/Negation der Kreatur. Skalierende Spells lesen die echte Schulstufe des Helden (Deckung ≠ Stufe, wie bei Divinity) — Phoenix Tackle & Co. ignorieren sie.
//  ③ NUR EINE: `beforeSummon` + `canSummon` (Name inkl. Zusatzname eines Shroomasaur, `kontrolliert`).
// ═══════════════════════════════════════════
const { kontrolliert } = require('./_double-shared');

function baue({ name, school }) {
  const schulStufe = (engine, seite, heroIdx) => engine.heroSchoolLevel(school, seite, heroIdx);
  return {
    activeIn: ['support'],
    // Kreatur „zählt als zusätzliche Aktion", wenn der Held <School> ≥ 2 hat.
    inherentAction: (gs, pi, heroIdx, engine) => {
      const seite = engine.heldSeiteFuer ? engine.heldSeiteFuer(pi, heroIdx) : pi;
      return schulStufe(engine, seite, heroIdx) >= 2;
    },
    // „You can only control 1": gilt für jede Beschwörung (auch Effekte).
    async beforeSummon(ctx) { return !kontrolliert(ctx._engine, ctx.cardOwner, name); },
    canSummon(ctx) {
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      return !(engine.cardInstances || []).some(c => c.id !== ctx.card.id && c.zone === 'support' && !c.faceDown
        && (c.controller ?? c.owner) === pi && engine.instHatName(c, name));
    },
    /** Engine-Vertrag der Levellücken-Deckung: nur Spells, kostenlos, bis zur Stärke. */
    coverLevelGap(cardData, staerke, engine, gap) {
      if (cardData?.cardType !== 'Spell') return { coverable: false, discardCost: 0 };
      if (gap <= 0) return { coverable: true, discardCost: 0 };
      return { coverable: staerke >= gap, discardCost: 0 };
    },
    /** Stärke = <School>-Stufe des entsprechenden Helden (dessen Support Zone die Kreatur belegt). */
    levelGapCapacity(engine, inst) {
      return schulStufe(engine, engine.physicalSide(inst), inst.heroIdx);
    },
  };
}

module.exports = { baue };
