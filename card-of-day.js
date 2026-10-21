'use strict';
// ═══════════════════════════════════════════════════════════════
//  PIXEL PARTIES — KARTE DES TAGES
//
//  EINE Stelle, die sagt, welche Karte heute die „Card of the Day" ist:
//    • sc-rewards.js  zahlt den Bonus „Card of the Day!" (30 SC) für einen Sieg mit ihr,
//    • bot-api.js     reicht sie an MoniaBot weiter (Veröffentlichung im Discord, `!cotd`).
//
//  Tag = Berliner Kalendertag (wie die Daily Challenge im Discord, 12:00 Berliner Zeit). Die Karte hängt NUR vom Datum ab
//  (FNV-1a-Hash in den Kartenpool) — alle sehen dieselbe, auch nach einem Neustart.
//
//  Kartenpool: alles, womit man ein normales Spiel bestreiten kann. Nicht dabei: Tokens, gebannte Karten (nicht spielbar) und
//  Ascended Heroes (gibt es nur über eine Ascension, nicht als Startkarte).
// ═══════════════════════════════════════════════════════════════

const BERLIN_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' });

/** Berliner Kalendertag als `YYYY-MM-DD`. */
function berlinDate(d = new Date()) {
  return BERLIN_DATE.format(d);
}

/** Karten, die Karte des Tages werden können — nach Namen sortiert, damit die Reihenfolge stabil ist. */
function cardOfDayPool(cards) {
  return (cards || [])
    .filter(c => c && c.name
      && !/token/i.test(String(c.cardType || ''))
      && c.cardType !== 'Ascended Hero'
      && !c.banned)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * @param {string} dateStr  `YYYY-MM-DD` (Berlin)
 * @param {object[]} cards  Karten aus cards.json
 * @returns {object|null}   die Karte (Eintrag aus cards.json)
 */
function cardOfDay(dateStr, cards) {
  const pool = cardOfDayPool(cards);
  if (!pool.length) return null;
  let h = 2166136261;
  for (const ch of String(dateStr)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return pool[(h >>> 0) % pool.length];
}

module.exports = { berlinDate, cardOfDay, cardOfDayPool };
