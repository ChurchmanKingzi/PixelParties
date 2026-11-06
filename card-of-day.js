'use strict';
// ═══════════════════════════════════════════════════════════════
//  PIXEL PARTIES — KARTE DES TAGES
//
//  EINE Stelle, die sagt, welche Karte heute die „Card of the Day" ist:
//    • sc-rewards.js  zahlt den Bonus „Card of the Day!" (30 SC) für einen Sieg mit ihr,
//    • bot-api.js     reicht sie an MoniaBot weiter (Veröffentlichung im Discord, `!cotd`).
//
//  Tag = Berliner Kalendertag (wie die Daily Challenge im Discord, 12:00 Berliner Zeit). Die Karte hängt nur vom Datum (und vom Kartenpool) ab
//  (FNV-1a-Hash in den Kartenpool) — alle sehen dieselbe, auch nach einem Neustart.
//
//  Kartenpool: jede Karte, die man im Spiel benutzen kann — gebannte Karten und Ascended Heroes eingeschlossen. Nicht dabei: Tokens sowie
//  Karten ohne Implementierung (kein Effekt-Skript) oder ohne Bild (der Discord-Post soll die Karte zeigen). Beides reicht der Server als
//  Prüffunktionen herein (`isImplemented`, `hasImage`); fehlen sie, wird nicht danach gefiltert.
//
//  Weil sich der Pool mit neuen Skripten/Bildern ändert (Deploys mitten am Tag), hält der Server die Wahl des Tages in der Datenbank fest
//  (Tabelle `card_of_day`) — sonst könnte sich die Karte nach einem Deploy ändern.
// ═══════════════════════════════════════════════════════════════

const BERLIN_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' });

/** Berliner Kalendertag als `YYYY-MM-DD`. */
function berlinDate(d = new Date()) {
  return BERLIN_DATE.format(d);
}

/**
 * Karten, die Karte des Tages werden können — nach Namen sortiert, damit die Reihenfolge stabil ist.
 * @param {object[]} cards
 * @param {{isImplemented?:(name:string)=>boolean, hasImage?:(name:string)=>boolean}} [o]
 */
function cardOfDayPool(cards, { isImplemented, hasImage } = {}) {
  return (cards || [])
    .filter(c => c && c.name
      && !/token/i.test(String(c.cardType || ''))
      && (!isImplemented || isImplemented(c.name))
      && (!hasImage || hasImage(c.name)))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * @param {string} dateStr  `YYYY-MM-DD` (Berlin)
 * @param {object[]} cards  Karten aus cards.json
 * @param {object} [o]      Prüffunktionen für den Pool, siehe cardOfDayPool
 * @returns {object|null}   die Karte (Eintrag aus cards.json)
 */
function cardOfDay(dateStr, cards, o) {
  const pool = cardOfDayPool(cards, o);
  if (!pool.length) return null;
  let h = 2166136261;
  for (const ch of String(dateStr)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return pool[(h >>> 0) % pool.length];
}

module.exports = { berlinDate, cardOfDay, cardOfDayPool };
