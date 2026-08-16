// ═══════════════════════════════════════════
//  CARD EFFECT: "Kent, the Indebted Apprentice"
//  Hero — 400 HP / 40 ATK. Starting abilities: Inventing, Trade.
//  Archetyp: Debt-O-Tron.
//
//  "If you spend Gold on a card or effect while you have 0 or more
//   Gold, you may spend up to 20 Gold more than you own, going into
//   negative Gold. If you do, you cannot perform an Action for the
//   rest of the turn afterwards. While your Gold is negative, you
//   cannot perform Actions."
//
//  Kent ist der EINE Grund, warum negatives Gold ueberhaupt
//  entstehen kann (der zweite ist „Debt-O-Tron Damage Fees", die
//  aber nur sich selbst finanziert). Ohne ihn ist der Kreditrahmen
//  im ganzen Spiel 0 und alles verhaelt sich wie vor v407.
//
//  ── DREI TEILE ────────────────────────────────────────────────
//   1. KREDITRAHMEN — Vertrag `goldOverdraft(engine, pi)`. Die Engine
//      fragt ihn in `goldOverdraftLimit()`, und zwar bei JEDER
//      Bezahlbarkeitspruefung und jeder Buchung. 20 Gold JE
//      BEZAHL-INSTANZ, unabhaengig vom Kontostand — auch aus dem Minus
//      heraus (Als Korrektur 16.8.). Der Rahmen begrenzt die NEUE
//      Schuld einer einzelnen Zahlung, er ist kein Zustandsgatter.
//
//   2. KEIN PROMPT — Entscheidung, die Al abnicken oder umdrehen kann.
//      „You may spend up to 20 Gold more than you own" waere als
//      Abfrage bei JEDER Goldzahlung unertraeglich (auch bei denen,
//      die man locker bezahlen kann). Das „may" ist stattdessen
//      dadurch erfuellt, dass eine unbezahlbare Karte ueberhaupt
//      anklickbar wird: der Client graut sie mit Kent nicht mehr aus,
//      und wer sie trotzdem spielt, hat sich fuer die Schulden
//      entschieden. Soll es doch eine Rueckfrage geben, ist
//      `_payCardCost` die eine Stelle dafuer.
//
//   3. AKTIONSSPERRE — Vertrag `blocksActions(engine, pi)`. Zwei
//      Ausloeser, beide spielerweit:
//        · Gold ist negativ  → „While your Gold is negative, you
//          cannot perform Actions."
//        · in dieser Runde wurde ueberzogen → „you cannot perform an
//          Action for the rest of the turn afterwards". Der zweite
//          Ausloeser ist NICHT ueberfluessig: „Debt-O-Tron Model Loan
//          Shredder" setzt das Gold auf 0 zurueck, die Sperre muss
//          die Runde trotzdem ueberdauern.
//      GELTUNGSBEREICH (Als Ruling 16.8.): normale UND Zusatz-
//      Aktionen; Helden-Effekte und Abilities nur, wenn sie
//      ausdruecklich eine Aktion kosten. Das erledigt die Engine —
//      der Vertrag wird genau dort gefragt, wo auch der bestehende
//      `_actionLockedTurn`-Riegel sitzt.
// ═══════════════════════════════════════════

'use strict';

const { KENT_OVERDRAFT } = require('./_debt-o-tron-shared');

const CARD_NAME = 'Kent, the Indebted Apprentice';
/** Rundenstempel „in dieser Runde wurde ueberzogen". */
const OVERDREW = '_kentOverdrewTurn';

/** Steht ein lebender Kent auf dieser Seite? */
function kentAlive(engine, pi) {
  return (engine?.gs?.players?.[pi]?.heroes || [])
    .some(h => h?.name === CARD_NAME && h.hp > 0);
}

module.exports = {
  activeIn: ['hero'],

  /**
   * Kreditrahmen: 20 je BEZAHL-INSTANZ — unabhaengig vom Kontostand.
   *
   * Als Korrektur 16.8.: „Kent sollte PRO BEZAHL-INSTANZ bis zu 20 Gold
   * Schulden erlauben, auch während man schon in den Miesen ist, NICHT
   * NUR bei >= 0." Meine erste Fassung hatte die Klausel „while you
   * have 0 or more Gold" als Sperre gelesen und den Rahmen im Minus auf
   * 0 gesetzt — falsch. Der Rahmen ist ein Betrag an NEUER Schuld je
   * Zahlung, kein Zustandsgatter.
   *
   * Praktisch: bei −10 darf eine Zahlung bis zu 20 Gold aufnehmen (also
   * hoechstens 20 kosten) und landet bei −30. Genau das Mass, das auch
   * die Modell-Karten als „spent in excess of your current Gold"
   * auswerten.
   *
   * Ein toter Kent gibt keinen Kredit (die Engine filtert lebende
   * Helden bereits, das hier ist die Zweitsicherung fuer direkte
   * Aufrufe).
   */
  goldOverdraft(engine, playerIdx) {
    return kentAlive(engine, playerIdx) ? KENT_OVERDRAFT : 0;
  },

  /** Spielerweite Aktionssperre — siehe Kopfkommentar (3). */
  blocksActions(engine, playerIdx) {
    const ps = engine?.gs?.players?.[playerIdx];
    if (!ps) return false;
    if (!kentAlive(engine, playerIdx)) return false;
    // „While your Gold is negative" ist eine LAUFENDE Faehigkeit und
    // haengt deshalb an einem lebenden Kent (der Heldenlauf der Engine
    // filtert das bereits). Die NACHWIRKENDE Sperre steht dagegen im
    // generischen `ps._playerActionLockedTurn` und wird von der Engine
    // vor dem Heldenlauf geprueft — sie ueberlebt Einfrieren und Tod.
    return (ps.gold || 0) < 0;
  },

  /**
   * Zustandsvertrag (derselbe, an dem Logans Pleite-Regel haengt):
   * die Engine ruft ihn nach JEDER Goldaenderung. Kent nutzt ihn, um
   * den Ueberziehungs-Stempel zu setzen, sobald das Gold ins Minus
   * gerutscht ist — unabhaengig davon, welcher Zahlungspfad es getan
   * hat. Synchron, wie der Vertrag es verlangt.
   */
  goldStateRule(engine, playerIdx) {
    const ps = engine?.gs?.players?.[playerIdx];
    if (!ps || !kentAlive(engine, playerIdx)) return;
    if ((ps.gold || 0) >= 0) return;
    const turn = engine.gs?.turn || 0;
    if (ps[OVERDREW] === turn) return;
    ps[OVERDREW] = turn;
    // Der generische Spieler-Riegel. Bewusst NICHT nur `OVERDREW`:
    // dieser hier wird von `areActionsBlocked` VOR dem Heldenlauf
    // gelesen und wirkt deshalb weiter, wenn Kent anschliessend
    // eingefroren oder besiegt wird (Als Vorgabe 16.8.).
    ps._playerActionLockedTurn = turn;
    engine.log('kent_overdraft', {
      player: ps.username, hero: CARD_NAME, gold: ps.gold,
    });
    // Rote Muenzen fallen — dieselbe Bildsprache wie Logans Verfall,
    // hier fuer „du hast dich verschuldet".
    const heroIdx = (ps.heroes || []).findIndex(h => h?.name === CARD_NAME && h.hp > 0);
    if (heroIdx >= 0) {
      engine._broadcastEvent('play_zone_animation', {
        type: 'debt_incurred',
        owner: playerIdx, heroIdx, zoneSlot: -1,
        count: Math.min(12, Math.max(3, Math.ceil(-(ps.gold || 0) / 2))),
      });
    }
  },

  hooks: {
    /**
     * Der Stempel ist ein Rundenstempel und raeumt sich ueber den
     * Vergleich mit `gs.turn` selbst auf. Hier wird er zusaetzlich
     * aktiv geloescht, damit der Zustand klein bleibt — und weil ein
     * stehengebliebener Stempel bei einem Rundenzaehler-Rollback
     * (Snapshot/Restore im MCTS) sonst faelschlich sperren koennte.
     */
    onTurnStart: async (ctx) => {
      const ps = ctx._engine?.gs?.players?.[ctx.cardOwner];
      if (!ps) return;
      const turn = ctx._engine.gs.turn;
      if (ps[OVERDREW] != null && ps[OVERDREW] !== turn) delete ps[OVERDREW];
      if (ps._playerActionLockedTurn != null && ps._playerActionLockedTurn !== turn) {
        delete ps._playerActionLockedTurn;
      }
    },
  },
};
