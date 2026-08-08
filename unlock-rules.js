// ═══════════════════════════════════════════════════════════════════
//  CPU-GEGNER: FREISCHALT-REGEL
//
//  Die reine Entscheidung „wie viele zufaellige Gegner schaltet dieser
//  Sieg frei?" — bewusst ohne Datenbank, Sockets oder Spielzustand,
//  damit sie einzeln pruefbar ist. `server.js` liest hier nach und
//  kuemmert sich um alles Uebrige (Zaehlerstand lesen, Zeilen schreiben,
//  Ereignis senden).
//
//  ── Registrierte Konten ──
//  Starten mit den Starter-Deck-Gegnern und schalten frei bei:
//   • dem ERSTEN Sieg gegen einen dieser STARTGEGNER,
//   • dem Erreichen der Drei-Siege-Schwelle gegen denselben Gegner.
//  Beide koennen im selben Spiel greifen — dann gibt es zwei.
//
//  ── Gaeste (Als Vorgabe 8.8.) ──
//  JEDER erste Sieg gegen eine CPU schaltet eine zufaellige neue frei,
//  auch gegen Gegner, die selbst erst freigeschaltet wurden. So erlebt
//  auch eine Gast-Sitzung die ganze Bandbreite. Die Startgegner-
//  Unterscheidung entfaellt dabei, die Drei-Siege-Schwelle ebenfalls —
//  ein Gast soll durch BREITE belohnt werden, nicht durch Wiederholung
//  desselben Duells.
//
//  Gilt nur fuer die laufende Sitzung: das Gastkonto und seine
//  Freischaltungen werden beim Abmelden bzw. beim Serverstart mit
//  `purgeGuest` weggeraeumt.
// ═══════════════════════════════════════════════════════════════════

/** Siege gegen denselben Gegner, ab denen es eine Zusatzfreischaltung gibt. */
const THREE_WIN_MILESTONE = 3;

/**
 * @param {object}  o
 * @param {boolean} o.isGuest    Gastkonto?
 * @param {boolean} o.isInitial  Gehoert der Gegner zum Startaufgebot?
 * @param {number}  o.preWins    Siege gegen DIESEN Gegner VOR diesem Spiel.
 * @returns {number} Anzahl zufaelliger Freischaltungen (0, 1 oder 2).
 */
function cpuUnlockCount({ isGuest = false, isInitial = false, preWins = 0 } = {}) {
  const vorher = Number.isFinite(preWins) ? preWins : 0;

  if (isGuest) {
    // Erster Sieg gegen genau diesen Gegner.
    return vorher === 0 ? 1 : 0;
  }

  let count = 0;
  if (isInitial && vorher === 0) count++;
  if (vorher === THREE_WIN_MILESTONE - 1) count++;
  return count;
}

module.exports = { THREE_WIN_MILESTONE, cpuUnlockCount };
