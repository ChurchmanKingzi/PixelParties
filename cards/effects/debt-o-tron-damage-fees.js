// ═══════════════════════════════════════════
//  CARD EFFECT: "Debt-O-Tron Damage Fees"
//  Artifact (Normal) — Cost 10. Archetyp: Debt-O-Tron.
//
//  "You may play this Artifact while you don't have enough Gold to
//   pay for it (even while your Gold is negative). You can only play
//   1 'Debt-O-Tron Damage Fees' per turn."
//
//  Der zweite Weg ins Minus — und der einzige, der auch AUS dem
//  Minus heraus funktioniert. Kents Kreditrahmen verlangt „while you
//  have 0 or more Gold"; diese Karte kennt keine solche Bedingung und
//  keine Obergrenze. Sie finanziert dabei ausschliesslich SICH SELBST:
//  der Vertrag `selfGoldOverdraft` geht nur in den Kreditrahmen ein,
//  wenn genau diese Karte bezahlt wird.
//
//  ── WAS DIE KARTE SONST TUT: NICHTS ───────────────────────────
//  Der Kartentext hat keinen weiteren Effekt. Sie ist reines
//  Treibstoff-Werkzeug: 10 Gold Schulden auf Knopfdruck, damit die
//  fuenf „Model"-Karten (spielbar nur bei Gold < 0) ueberhaupt
//  anlaufen und die „after spending Gold"-Trigger feuern. Deshalb
//  gibt es hier kein `resolve` — nur das Kosten- und HOPT-Verhalten.
//
//  ── EINMAL PRO ZUG ────────────────────────────────────────────
//  „You can only play 1 … per turn" ist die HARTE Form (Als
//  Wortlaut-Regel v249: „You can only … 1 … per turn" = hart, pro
//  Spieler). Umgesetzt ueber den Engine-HOPT, nicht ueber einen
//  eigenen Zaehler.
// ═══════════════════════════════════════════

'use strict';

const CARD_NAME = 'Debt-O-Tron Damage Fees';
const HOPT_KEY = 'debt-o-tron-damage-fees';

module.exports = {
  /**
   * Kreditrahmen NUR fuer diese Karte. `true` heisst der Engine
   * gegenueber „unbegrenzt" — der Kartentext nennt keine Grenze und
   * schliesst negatives Ausgangsgold ausdruecklich ein.
   *
   * Gelesen wird das in `engine.goldOverdraftLimit(pi, cardName)`, und
   * zwar nur, wenn `cardName` diese Karte ist. Auf fremde Zahlungen
   * faerbt es also nicht ab.
   */
  selfGoldOverdraft: true,

  /**
   * Harte Einmal-pro-Zug-Sperre. `canPlayWithHero` ist die
   * karteneigene Seite des Spielbarkeits-Gates (die Engine fragt sie
   * beim Auflisten der spielbaren Handkarten), damit die Karte nach
   * dem ersten Einsatz sauber ausgraut statt beim Klick abzulehnen.
   */
  canPlayWithHero(gs, playerIdx) {
    return gs.hoptUsed?.[`${HOPT_KEY}:${playerIdx}`] !== gs.turn;
  },

  /**
   * DER AUFLOESER — und der Grund, warum die Karte ueberhaupt etwas tut.
   *
   * 16.8., Als Report: „Damage Fees ist jetzt zwar bei <0 Gold als
   * nutzbar gehighlightet, tut aber NICHTS, wenn ich sie anklicke."
   * Richtig — ein Normal-Artefakt ohne `resolve` faellt in
   * `doUseArtifactEffect` durch `if (!script.resolve) return false;`
   * und passiert einfach nicht. Der Kartentext nennt keinen Effekt,
   * aber Al: „sollte ihre Kosten an Gold verbrauchen und dann zum
   * Discard gehen; Gold zu kosten, solange man schon negativ ist, IST
   * quasi der Effekt."
   *
   * Zahlung und Abwurf erledigt der Server-Pfad drumherum (Kosten ueber
   * `_payCardCost` MIT Kartennamen, damit `selfGoldOverdraft` greift;
   * danach Hand → Abwurfstapel). Hier bleibt nur, was die Karte selbst
   * beisteuert: die harte Einmal-pro-Zug-Sperre und die Buchung.
   */
  resolve: async (engine, pi) => {
    const gs = engine.gs;
    const ps = gs.players[pi];
    if (!ps) return;
    if (!gs.hoptUsed) gs.hoptUsed = {};
    gs.hoptUsed[`${HOPT_KEY}:${pi}`] = gs.turn;
    // Der Goldstand VOR der Zahlung — der Server bucht erst nach dem
    // Aufloesen ab, die Log-Zeile nennt deshalb den erwarteten Stand.
    const kosten = engine._getCardDB()[CARD_NAME]?.cost || 0;
    engine.log('debt_o_tron_fees', {
      player: ps.username, cost: kosten, gold: (ps.gold || 0) - kosten,
    });
  },
};
