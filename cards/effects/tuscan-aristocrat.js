// ═══════════════════════════════════════════
//  CARD EFFECT: "Tuscan Aristocrat"
//  Creature (Lv2, 100 HP, Summoning Magic)
//
//  "While you control this Creature, your
//   opponent cannot gain any Gold outside their
//   Resource Phase."
//
//  ── ALS RULING (16.8.): PHASEN-TEST, NICHT EFFEKT-TEST ──
//  Die Engine kennt daneben ein AEHNLICH klingendes, aber ANDERES
//  Vokabular: `_isResourceGain` markiert das automatische Einkommen
//  von 4 Gold und trennt "durch einen Effekt" vom Rundeneinkommen
//  (Monkee-Archetyp, Als Ruling 8.8.). Diese Karte fragt das NICHT —
//  sie fragt nach der PHASE. Der Unterschied ist praktisch relevant:
//
//   • "Wealth" (+4/8/12 je Level) haengt sich per `modifyAmount` an
//     das Rundeneinkommen und laeuft in der Resource Phase.
//   • "Treasure Huntress Semi" (+6) ebenso.
//
//  Beide erhoehen also einen Gewinn INNERHALB der Resource Phase —
//  Aristocrat tut gegen sie ausdruecklich NICHTS (Als Vorgabe). Wer
//  hier auf `_isResourceGain` pruefen wuerde, haette beide faelschlich
//  mitgesperrt, weil ihr Zuschlag als Effekt gilt.
//
//  "SEINE Resource Phase" heisst: Resource Phase UND er ist der
//  Zugspieler. Gold, das der Gegner waehrend MEINER Resource Phase
//  bekaeme, liegt ausserhalb seiner eigenen — und faellt damit unter
//  die Sperre.
//
//  "While you control this Creature" prueft das Skript nicht selbst:
//  `activeIn: ['support']` laesst den Hook nur aus der Zone feuern,
//  und der Hook-Verteiler filtert negierte, genullte, betaeubte,
//  eingefrorene und verdeckte Kreaturen zentral heraus.
// ═══════════════════════════════════════════

const { PHASES } = require('./_hooks');

const CARD_NAME = 'Tuscan Aristocrat';

module.exports = {
  activeIn: ['support'],

  hooks: {
    onResourceGain: (ctx) => {
      const gewinner = ctx.playerIdx;
      if (gewinner == null) return;
      // Nur der GEGNER. `cardOwner` ist bereits auf den effektiven
      // Kontrolleur aufgeloest (Charm / Diebstahl).
      if (gewinner === ctx.cardOwner) return;

      // Erlaubt ist ausschliesslich SEINE eigene Resource Phase.
      const inSeinerResourcePhase = ctx.phaseIndex === PHASES.RESOURCE
        && ctx.activePlayer === gewinner;
      if (inSeinerResourcePhase) return;

      ctx.cancel();
      ctx.log('tuscan_aristocrat_block', {
        card: CARD_NAME,
        blocked: ctx.amount,
        player: ctx.players?.[gewinner]?.username,
      });
    },
  },
};
