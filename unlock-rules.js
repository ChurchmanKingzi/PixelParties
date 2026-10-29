// ═══════════════════════════════════════════════════════════════════
//  CPU-GEGNER: FREISCHALT-REGEL
//
//  Die reine Entscheidung „wie viele zufaellige Gegner schaltet dieser
//  Sieg frei?" — bewusst ohne Datenbank, Sockets oder Spielzustand,
//  damit sie einzeln pruefbar ist. `server.js` liest hier nach und
//  kuemmert sich um alles Uebrige (Zaehlerstand lesen, Zeilen schreiben,
//  Ereignis senden).
//
//  ── Regel (registrierte Konten und Gaeste gleich) ──
//  JEDER erste Sieg gegen eine CPU schaltet eine zufaellige neue frei —
//  gleich ob Start- oder Structure-Deck-Gegner und auch gegen Gegner,
//  die selbst erst freigeschaltet wurden. Weitere Siege gegen denselben
//  Gegner schalten nichts mehr frei: BREITE wird belohnt, nicht die
//  Wiederholung desselben Duells. Sind keine Gegner mehr frei zu
//  schalten, bleibt die Freischaltung einfach aus (`unlockRandomOpponent`
//  liefert dann null).
//
//  Gaeste (Als Vorgabe 8.8.): das Gastkonto und seine Freischaltungen
//  gelten nur fuer die laufende Sitzung und werden beim Abmelden bzw.
//  beim Serverstart mit `purgeGuest` weggeraeumt.
// ═══════════════════════════════════════════════════════════════════

/**
 * @param {object}  o
 * @param {number}  o.preWins    Siege gegen DIESEN Gegner VOR diesem Spiel.
 * @returns {number} Anzahl zufaelliger Freischaltungen (0 oder 1).
 */
function cpuUnlockCount({ preWins = 0 } = {}) {
  const vorher = Number.isFinite(preWins) ? preWins : 0;
  return vorher === 0 ? 1 : 0;
}

module.exports = { cpuUnlockCount };
