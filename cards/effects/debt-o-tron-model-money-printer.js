// ═══════════════════════════════════════════
//  CARD EFFECT: "Debt-O-Tron Model Money Printer"
//  Artifact / Creature — Cost 0, 50 HP. Archetyp: Debt-O-Tron.
//
//  "You can only play this card while you have less than 0 Gold by deleting 1 card from your hand. Up to 3 times per turn, when you have negative Gold after spending Gold, you may draw 1 card for every 10 Gold you spent in excess of your current Gold. You can only summon 1 "Debt-O-Tron Model Money Printer" per turn."
//
//  Gemeinsames Geruest in `_debt-o-tron-shared.modelBase`: spielbar nur
//  bei negativem Gold, Kosten sind 1 geloeschte Handkarte, hart einmal je Zug beschwoerbar.
//
//  ── DER AUSLOESER ─────────────────────────────────────────────
//  „when you have negative Gold after spending Gold" haengt an
//  `afterResourceSpend`. Das traegt erst seit v405/v406: davor feuerten
//  KARTENKOSTEN diesen Hook gar nicht, der Ausloeser haette also
//  ausgerechnet bei „Debt-O-Tron Damage Fees" geschwiegen — der Karte,
//  die den Archetyp ueberhaupt ins Minus bringt.
//  Die Zaehlung „for every 10 Gold you spent in excess of your current
//  Gold" macht `debtTriggerCheck` an EINER Stelle fuer alle drei
//  Modelle, nach Als Formel `Betrag − max(0, GoldVorher)`.
//
//  Als Ruling 16.8.: die Karte traegt zwar `banned`, das bezieht sich
//  aber auf ein noch nicht implementiertes Format — sie wird normal
//  gebaut. „Up to 3 times per turn" ist ein Zaehler auf der INSTANZ,
//  nicht am Spieler: zwei Drucker duerften jeder dreimal.
// ═══════════════════════════════════════════

'use strict';

const { modelBase, debtTriggerCheck, debtChargesLeft } = require('./_debt-o-tron-shared');

const CARD_NAME = 'Debt-O-Tron Model Money Printer';
const MAX_PER_TURN = 3;

const base = modelBase(CARD_NAME);

module.exports = {
  // Ladungsanzeige oben rechts (Als Vorgabe 16.8.): weiss, solange
  // Ladungen uebrig sind, rot bei 0. `remainingCharges` ist der
  // allgemeine Vertrag — jede Permanent-Karte mit „up to X times per
  // turn" kann ihn mit dieser einen Zeile bedienen.
  chargesPerTurn: MAX_PER_TURN,
  remainingCharges: (inst, gs) => debtChargesLeft(inst, gs, MAX_PER_TURN),
  ...base,

  hooks: {
    onPlay: async (ctx) => { await base.payHandCost(ctx); },

    afterResourceSpend: async (ctx) => {
      const treffer = debtTriggerCheck(ctx, MAX_PER_TURN, CARD_NAME);
      if (!treffer) return;
      const engine = ctx._engine;
      const pi = ctx.cardOwner;
      const ps = engine.gs.players[pi];
      if (!ps || (ps.mainDeck || []).length === 0) return;

      // BOOLEAN, kein Objekt — siehe Loan Shredder. Derselbe Fehler
      // hat hier den Zug verschluckt (Als Report: „der Tooltip kam, aber
      // on-confirm wurde nichts gezogen"). Es lag NICHT an Scrap Plow.
      const bestaetigt = await ctx.promptConfirmEffect({
        title: CARD_NAME,
        message: `You overspent by ${treffer.excess} Gold. Draw ${treffer.steps} card${treffer.steps === 1 ? '' : 's'}?`,
      });
      if (!bestaetigt) return;

      // Erst JETZT verbuchen — der Spieler hat zugesagt. Vorher zog
      // die Pruefung die Ladung sofort ab, ein Abbruch kostete sie
      // trotzdem (Als Report 16.8.).
      treffer.verbuche();

      await engine.actionDrawCards(pi, treffer.steps, { source: CARD_NAME });
      engine.log('debt_money_printer', {
        player: ps.username, drew: treffer.steps, excess: treffer.excess,
      });
      engine.sync();
    },
  },
};
