// ═══════════════════════════════════════════
//  CREATURE: "Bonded Companion Humby"
//
//  Sechs der sieben Saetze teilt sie mit den anderen drei Companions —
//  die stehen in `_bonded-companions-shared.js`. Eigener Satz:
//
//    „Once per turn, when you gain Gold through an effect, you may gain
//     15 additional Gold."
//
//  „durch einen Effekt" schliesst das automatische Rundeneinkommen aus:
//  das traegt `_isResourceGain` (Regelwerk, Resource Phase = 4 Gold).
// ═══════════════════════════════════════════

const { companion, companionGlow } = require('./_bonded-companions-shared');
const { usesLeft, spendUse } = require('./_charges');

const CARD_NAME = 'Bonded Companion Humby';
const USE_KEY   = 'humbyBonus';
const MAX_USES  = 1;
const BONUS     = 15;

module.exports = companion({
  name: CARD_NAME,
  eigeneHooks: {
    // ★ ZWEI GETRENNTE GEWINNE (Als Vorgabe 12.9.) ──────────────────
    // Frueher haing der Effekt an `onResourceGain` und meldete den
    // Zuschlag ueber `ctx.modifyAmount(15)` an. Das ist Punkt vor
    // Strich — richtig fuer VERSTAERKER, aber hier falsch: der Spieler
    // sah einen einzigen Gewinn von X+15. Der Kartentext sagt
    // „gain 15 ADDITIONAL Gold", also ein zweiter Gewinn hinterher.
    //
    // Deshalb `afterResourceGain`: da ist das urspruengliche Gold schon
    // gelandet, und `actionGainGold` setzt einen eigenen, sichtbaren
    // Gewinn obendrauf.
    //
    // Keine Endlosschleife: der eigene Zuschlag feuert den Hook erneut,
    // aber die Ladung des Zuges ist dann schon verbraucht und der
    // zweite Durchlauf steigt bei `usesLeft` aus.
    afterResourceGain: async (ctx) => {
      if (ctx.playerIdx !== ctx.cardOwner) return;
      if (ctx._isResourceGain) return;              // Rundeneinkommen zaehlt nicht
      if ((ctx.amount || 0) <= 0) return;

      const inst = ctx.card;
      const gs = ctx._engine?.gs;
      if (usesLeft(inst, gs, { key: USE_KEY, max: MAX_USES }) <= 0) return;

      const ja = await ctx.promptConfirmEffect({
        title: CARD_NAME,
        message: `Gain ${BONUS} additional Gold on top of the ${ctx.amount} you just gained?`,
      });
      if (!ja) return;

      spendUse(inst, gs, { key: USE_KEY, max: MAX_USES });
      // Auftritt erst NACH dem Ja — ein abgelehnter Trigger zeigt nichts
      // (CARD_API, Regel vom 1.9.).
      await ctx._engine.showTriggeredEffect(CARD_NAME);
      companionGlow(ctx._engine, inst);

      await ctx._engine.actionGainGold(ctx.cardOwner, BONUS, { source: CARD_NAME });
      ctx._engine.log('humby_gold_bonus', {
        player: gs.players?.[ctx.cardOwner]?.username, bonus: BONUS, after: ctx.amount,
      });
      ctx._engine.sync();
    },
  },
});
