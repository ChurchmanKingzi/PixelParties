'use strict';
// ═══════════════════════════════════════════
//  GETEILT: „You may discard X to summon this Creature as an additional Action" (Als Vorgabe 10.10.)
//
//  Die Bauform von Potion Juggler / Big Gwen Guard, einmal ausgeschrieben für Karten mit einer ABWURF-Kosten-Beschwörung aus der Hand:
//  Sky Archeologist („discard an Artifact with a Cost of 10 or more") und Slave Trader („discard a level 3 Creature from your hand").
//
//  ── DIE REGEL (Als Vorgabe 10.10.) ──────────────────────────────────────
//  „Die optionalen Additional-Action-Kosten MÜSSEN bezahlt werden, wenn man keine Action zur Verfügung hat. Während der Action Phase /
//   wenn man anderweitig eine Action verfügbar hat, kann man wählen, wie bei anderen konditionalen Additional-Effekten auch."
//    • Main Phase ODER Action Phase ohne freie Aktion → die Zusatzaktion ist der EINZIGE Weg: `inherentAction` ist wahr (sobald die Kosten
//      bezahlbar sind), die Kosten werden verlangt; Abbruch lehnt die Beschwörung ab (nichts verbraucht).
//    • Action Phase mit freier Aktion UND bezahlbaren Kosten → beide Wege: `inherentAction` ist falsch (die Engine zieht die Aktion ein),
//      `beforeSummon` fragt „Special" (Kosten zahlen, Aktion zurück) oder „Normal" (Aktion des Helden, keine Kosten). „Special" stempelt
//      `gs._summonModeUpgradedToInherent` — server.js erstattet die Aktion.
//    • Ohne bezahlbare Kosten gibt es nur den normalen Weg (kostet die Aktion).
//    • Effekt-Beschwörungen (Living Illusion, Wiederbelebung …) zahlen nichts: Kosten gelten nur für den Spieler-Weg (`ctx._isNormalSummon`).
//
//  ── GEBRAUCH ────────────────────────────────────────────────────────────
//    const { makeDiscardCostSummon } = require('./_extra-summon-shared');
//    const kosten = makeDiscardCostSummon({
//      cardName: 'Slave Trader',
//      eligible: (engine, pi, handName, handIdx, cd) => …,   // taugt diese Handkarte als Kosten?
//      description: 'Discard a level 3 Creature …',
//    });
//    module.exports = { …, canSummon: kosten.canSummon, inherentAction: kosten.inherentAction, beforeSummon: kosten.beforeSummon,
//                       cpuResponse: kosten.cpuResponse };
// ═══════════════════════════════════════════

/** Ist die Aktion des Helden noch frei? Nur die Action Phase kennt sie (Bauform Big Gwen Guard / `doPlayCreature`). */
function aktionFrei(gs, pi, heroIdx) {
  if (gs.currentPhase !== 3) return false;
  const ps = gs.players[pi];
  if (!ps) return false;
  if ((ps.heroesActedThisTurn || []).length === 0) return true;
  const bonus = (ps.bonusActions?.heroIdx === heroIdx && (ps.bonusActions.heroOwner ?? pi) === pi && ps.bonusActions.remaining > 0)
    || ((ps._bonusMainActions || 0) > 0);
  return !!bonus;
}

/** Zwang zur Zusatzaktion: Main Phase oder keine freie Aktion in der Action Phase. */
function erzwungen(gs, pi, heroIdx) {
  const main = gs.currentPhase === 2 || gs.currentPhase === 4;
  return main || !aktionFrei(gs, pi, heroIdx);
}

function makeDiscardCostSummon({ cardName, eligible, description }) {
  /** Handplätze, deren Karte als Abwurfkosten taugt. */
  const kostenPlaetze = (engine, pi) => {
    const ps = engine.gs.players[pi];
    if (!ps) return [];
    const db = engine._getCardDB();
    const out = [];
    (ps.hand || []).forEach((name, i) => {
      const cd = db[name];
      if (cd && eligible(engine, pi, name, i, cd)) out.push(i);
    });
    return out;
  };
  const bezahlbar = (engine, pi) => kostenPlaetze(engine, pi).length > 0;

  /** Kosten zahlen: eine taugliche Handkarte anklicken und abwerfen. `false` = abgebrochen / nicht gezahlt. */
  async function zahleKosten(engine, pi) {
    const eligibleIndices = kostenPlaetze(engine, pi);
    if (eligibleIndices.length === 0) return false;
    const result = await engine.promptGeneric(pi, {
      type: 'forceDiscardCancellable',
      costFor: cardName,            // Kosten-Abwurf-Lernkanal der CPU
      title: cardName,
      description,
      instruction: 'Click a highlighted card in your hand to discard it.',
      eligibleIndices,
      cancellable: true,
      cancelLabel: 'Cancel summon',
    });
    if (!result || result.cancelled || result.cardName == null) return false;
    // Nur, was wirklich als Kosten taugt (der Client darf nichts anderes anbieten, aber der Server glaubt ihm nicht).
    if (!eligibleIndices.includes(result.handIndex) || engine.gs.players[pi].hand[result.handIndex] !== result.cardName) return false;
    // Boris darf auch Abwurf-KOSTEN ignorieren — der Effekt läuft dann ohne Abwurf.
    if (await engine.borisVerzicht(pi, 1, { source: cardName })) return true;
    return !!(await engine.actionDiscardHandCard(pi, result.cardName, result.handIndex, { source: cardName, selfInflicted: true }));
  }

  return {
    canSummon: () => true,

    /** Zusatzaktion nur dort, wo sie der EINZIGE Weg ist (Main Phase / keine freie Aktion) und Kosten zu zahlen sind. */
    inherentAction(gs, pi, heroIdx, engine) {
      if (!engine) return false;
      if (!bezahlbar(engine, pi)) return false;
      return erzwungen(gs, pi, heroIdx);
    },

    async beforeSummon(ctx) {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      // Kosten gelten nur für den Spieler-Weg aus der Hand (Effekt-Beschwörungen zahlen nichts).
      if (ctx._isNormalSummon !== true) return true;
      if (!bezahlbar(engine, pi)) return true;                    // ohne Kosten: normaler Weg

      if (erzwungen(gs, pi, heroIdx)) return await zahleKosten(engine, pi);

      // Action Phase mit freier Aktion und bezahlbaren Kosten: beide Wege möglich.
      const wahl = await engine.promptGeneric(pi, {
        type: 'confirm',
        title: cardName,
        message: `Choose how to summon ${cardName}:`,
        showCard: cardName,
        confirmLabel: '⚡ Special (pay the cost, free Action)',
        cancelLabel: '⚔️ Normal (use the Hero\'s Action)',
        cancellable: true,
        equalButtons: true,                                         // zwei gleichwertige Wege: gleich breite Knöpfe (Als Vorgabe 5.10.)
        gerrymanderEligible: false,
      });
      if (!wahl) return true;                                     // normal: die Engine hat die Aktion schon eingezogen
      if (!(await zahleKosten(engine, pi))) return false;
      gs._summonModeUpgradedToInherent = pi;                      // server.js erstattet die Aktion
      return true;
    },

    /** CPU: „Special" statt „Normal"; als Kosten die Handkarte, die sie am wenigsten braucht (die CPU-Abwurfwahl übernimmt `costFor`). */
    cpuResponse(engine, kind, payload) {
      if (kind !== 'generic' || !payload) return undefined;
      if (payload.type === 'confirm' && payload.title === cardName && /Choose how to summon/.test(payload.message || '')) return { confirmed: true };
      return undefined;
    },

    _test: { kostenPlaetze, bezahlbar },
  };
}

module.exports = { makeDiscardCostSummon, aktionFrei, erzwungen };
