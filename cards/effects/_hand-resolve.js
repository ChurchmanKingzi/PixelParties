'use strict';
/**
 * ── AUFGESCHOBENE HANDENTNAHME ───────────────────────────────────────
 *
 * Eine Karte, die gespielt wird, verlaesst die Hand NICHT sofort. Sie
 * bleibt bis zur Aufloesung liegen — sichtbar, aber ausgegraut — und
 * wird erst in dem Moment entnommen, in dem sie tatsaechlich auf dem
 * Feld landet. Genau so verhaelt sich `doPlayCreature` seit jeher; die
 * Artefakt-Kreaturen (Debt-O-Tron) taten es nicht, und Al hat das als
 * „springt kurz in die Hand zurueck und dann wieder in die Zone"
 * gesehen (Report 16.8.).
 *
 * WARUM AUFGESCHOBEN UND NICHT SOFORT:
 * Zwischen „Karte gespielt" und „Karte liegt" oeffnet sich das
 * Kettenfenster, in dem der Gegner reagieren darf. Wird die Karte
 * vorher aus der Hand genommen, ist sie in diesem Fenster NIRGENDS —
 * weder in der Hand noch in der Zone. Der Client hat dann nichts zu
 * zeichnen und der Spieler sieht ein Zucken. Wird die Kette negiert,
 * muss die Karte ausserdem sauber in die Ablage geroutet werden statt
 * im Nichts zu haengen.
 *
 * WARUM EIN EIGENES MODUL:
 * Die Logik sass als `getResolvingHandIndex` fest in server.js, war
 * also nicht testbar (server.js startet beim Laden einen Server). Hier
 * liegt sie frei und wird von `test-hand-resolve` direkt geprueft.
 *
 * KERNPROBLEM, das `nth` loest: Handindizes verschieben sich waehrend
 * der Aufloesung (der Gegner laesst abwerfen, ein Effekt zieht nach).
 * Ein beim Spielen gemerkter Index zeigt danach womoeglich auf eine
 * FREMDE Karte. Gemerkt wird deshalb „die n-te Kopie von X in der
 * Hand", und der Index wird zum Entnahmezeitpunkt neu bestimmt.
 */

/**
 * Merkt vor, welche Handkarte gerade aufgeloest wird.
 * @param {object} ps  Spielerzustand (mit `hand`)
 * @param {string} cardName
 * @param {number} handIndex  Der Slot, den der Spieler angeklickt hat
 * @returns {{name: string, nth: number}} der gesetzte Merker
 */
function beginHandResolve(ps, cardName, handIndex) {
  const hand = ps?.hand || [];
  // „Die wievielte Kopie von `cardName` ist der geklickte Slot?"
  const nth = hand.slice(0, handIndex + 1).filter(c => c === cardName).length;
  ps._resolvingCard = { name: cardName, nth };
  return ps._resolvingCard;
}

/**
 * Wo liegt die aufzuloesende Karte JETZT? -1, wenn sie waehrend der
 * Aufloesung aus der Hand verschwunden ist (abgeworfen, gestohlen …).
 */
function getResolvingHandIndex(ps) {
  if (!ps?._resolvingCard) return -1;
  const { name, nth } = ps._resolvingCard;
  const hand = ps.hand || [];
  let count = 0;
  let letzte = -1;
  for (let i = 0; i < hand.length; i++) {
    if (hand[i] !== name) continue;
    count++;
    letzte = i;
    if (count === nth) return i;
  }
  // ── RUECKFALL AUF EINE ANDERE KOPIE ────────────────────────────────
  // Faellt eine GLEICHNAMIGE Kopie VOR der aufzuloesenden weg, gibt es
  // die n-te nicht mehr — die Karte selbst liegt aber noch da. Ohne
  // Rueckfall meldete die Suche „verschwunden", die Entnahme unterblieb
  // und die Karte landete auf dem Feld UND blieb in der Hand liegen.
  // (Der Fehler steckt seit jeher auch im Kreatur-Pfad, der dieselbe
  // Zaehlung nutzt; er faellt nur selten auf, weil zwei Kopien
  // derselben Karte plus ein Abwurf mitten in der Kette zusammenkommen
  // muessen. Gefunden beim Absichern der Artefakt-Umstellung, v414.)
  //
  // Der Rueckfall ist unbedenklich, weil die Hand ein reines
  // Namens-Array ist: zwei Kopien derselben Karte sind NICHT
  // unterscheidbar, jede ist genauso richtig. Entscheidend ist nur,
  // dass GENAU EINE Karte DIESES Namens entnommen wird — nie eine
  // fremde. Gewaehlt wird die letzte verbliebene Kopie.
  return letzte;
}

/**
 * Nimmt die aufzuloesende Karte aus der Hand und loescht den Merker.
 *
 * Mehrfachaufruf ist ausdruecklich erlaubt und folgenlos: die Pfade
 * „aufgeloest", „negiert" und „Fehler" laufen teils ineinander, und
 * ein zweiter Aufruf darf keine FREMDE Karte entnehmen. Nach dem
 * ersten Aufruf ist der Merker weg, `getResolvingHandIndex` liefert
 * -1, und es passiert nichts mehr.
 *
 * @returns {number} der entnommene Handindex, oder -1 wenn nichts
 *          zu entnehmen war (Karte war schon weg / kein Merker).
 */
function commitHandResolve(ps, opts = {}) {
  if (!ps?._resolvingCard) return -1;
  const idx = getResolvingHandIndex(ps);
  ps._resolvingCard = null;
  if (idx < 0) return -1;
  ps.hand.splice(idx, 1);
  if (typeof opts.onRemoved === 'function') opts.onRemoved(idx);
  return idx;
}

/** Merker verwerfen, ohne die Karte zu entnehmen (Abbruch/Fehler). */
function abortHandResolve(ps) {
  if (ps) ps._resolvingCard = null;
}

/**
 * Handindizes, die ein Zwangsabwurf anfassen darf — ohne die gerade
 * aufzuloesende Karte.
 *
 * Der Item-Lock-Abwurf laeuft VOR dem Kettenfenster. Ohne diese
 * Ausnahme koennte der Spieler ausgerechnet die Karte loeschen, die er
 * in diesem Moment spielt. Solange sie sofort aus der Hand genommen
 * wurde, konnte das nicht passieren — mit der aufgeschobenen Entnahme
 * schon. Als Funktion uebergeben, weil `actionPromptForceDiscard` die
 * Liste nach JEDEM Zug neu auswertet (die Indizes rutschen).
 */
function eligibleIndicesWithoutResolving(ps) {
  return () => {
    const gesperrt = getResolvingHandIndex(ps);
    const alle = [];
    for (let i = 0; i < (ps?.hand || []).length; i++) {
      if (i !== gesperrt) alle.push(i);
    }
    return alle;
  };
}

module.exports = {
  beginHandResolve,
  getResolvingHandIndex,
  commitHandResolve,
  abortHandResolve,
  eligibleIndicesWithoutResolving,
};
