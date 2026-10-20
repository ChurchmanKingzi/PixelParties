'use strict';
// ═══════════════════════════════════════════════════════════════════
//  Pixle — reine Regeln (ohne Discord): Tipp → Karte auflösen, Karten vergleichen, Tageswechsel, Belohnung.
//
//  Jede Person hat ihre EIGENE geheime Karte. Man tippt Kartennamen und sieht, wie Typ, Subtyp, Level, HP, ATK,
//  Kosten, Zauberschule und Set des Tipps zur geheimen Karte stehen:
//    match   (grün)   gleich
//    partial (gelb)   nah dran / teilweise gleich (Zahl ±wenig, eine gemeinsame Schule, Hero ↔ Ascended Hero …)
//    miss    (rot)    anders
//  Bei Zahlen zeigt ein Pfeil, ob die GEHEIME Karte mehr (up) oder weniger (down) hat.
// ═══════════════════════════════════════════════════════════════════
const { searchCards, closeAlternatives } = require('./card-search');
const { plainName } = require('./mystery');

const COLUMNS = ['type', 'subtype', 'level', 'hp', 'atk', 'cost', 'school', 'set'];

const SCHOOL_SHORT = { 'Magic Arts': 'Arts', 'Summoning Magic': 'Summon', Fighting: 'Fighting', 'Decay Magic': 'Decay', 'Support Magic': 'Support', 'Destruction Magic': 'Destruct.' };
const TYPE_SHORT = { 'Ascended Hero': 'Asc. Hero', 'Creature/Token': 'Crea./Token' };
const TYPE_GROUPS = [['Hero', 'Ascended Hero'], ['Creature', 'Creature/Token', 'Token']];   // „fast gleich“

const schoolsOf = c => [c.spellSchool1, c.spellSchool2].filter(Boolean);
const same = (a, b) => (a == null || a === '' ? '' : String(a)) === (b == null || b === '' ? '' : String(b));
const dash = v => (v == null || v === '' ? '–' : String(v));

/** Wie weit darf eine Zahl danebenliegen und noch „nah dran“ (gelb) sein? */
function closeEnough(key, g, s) {
  const d = Math.abs(s - g);
  if (key === 'level' || key === 'cost') return d <= 1;
  return d <= Math.max(20, 0.15 * Math.max(g, s));          // HP/ATK: 15 %, mindestens 20
}

function numericCell(key, label, g, s) {
  const gv = g == null ? null : Number(g), sv = s == null ? null : Number(s);
  if (gv === null && sv === null) return { key, label, text: '–', status: 'match', arrow: null };
  if (gv === null || sv === null) return { key, label, text: dash(gv), status: 'miss', arrow: null };   // eines hat den Wert gar nicht
  if (gv === sv) return { key, label, text: String(gv), status: 'match', arrow: null };
  return { key, label, text: String(gv), status: closeEnough(key, gv, sv) ? 'partial' : 'miss', arrow: sv > gv ? 'up' : 'down' };
}

/**
 * Vergleich eines Tipps mit der geheimen Karte.
 * @returns {{correct:boolean, cells:{key:string,label:string,text:string,status:'match'|'partial'|'miss',arrow:'up'|'down'|null}[]}}
 */
function compareCards(guess, secret) {
  const cells = [];
  const sameGroup = TYPE_GROUPS.some(grp => grp.includes(guess.cardType) && grp.includes(secret.cardType));
  cells.push({ key: 'type', label: 'Type', text: TYPE_SHORT[guess.cardType] || dash(guess.cardType),
    status: guess.cardType === secret.cardType ? 'match' : sameGroup ? 'partial' : 'miss', arrow: null });
  cells.push({ key: 'subtype', label: 'Subtype', text: dash(guess.subtype), status: same(guess.subtype, secret.subtype) ? 'match' : 'miss', arrow: null });
  cells.push(numericCell('level', 'Level', guess.level, secret.level));
  cells.push(numericCell('hp', 'HP', guess.hp, secret.hp));
  cells.push(numericCell('atk', 'ATK', guess.atk, secret.atk));
  cells.push(numericCell('cost', 'Cost', guess.cost, secret.cost));
  const gs = schoolsOf(guess), ss = schoolsOf(secret);
  const common = gs.filter(x => ss.includes(x)).length;
  cells.push({ key: 'school', label: 'School', text: gs.length ? gs.map(x => SCHOOL_SHORT[x] || x).join('+') : '–',
    status: gs.length === ss.length && common === gs.length ? 'match' : common > 0 ? 'partial' : 'miss', arrow: null });
  cells.push({ key: 'set', label: 'Set', text: dash(guess.setID), status: same(guess.setID, secret.setID) ? 'match' : 'miss', arrow: null });
  return { correct: plainName(guess.name) === plainName(secret.name), cells };
}

/**
 * Tipp-Text → Karte. Strenger als beim Mystery-Spiel, weil hier ein Tipp zählt, auch wenn er falsch ist:
 *  unknown   — nichts, was so heißt oder klingt
 *  ambiguous — passt gleich gut auf mehrere Karten („Alice“) → bitte genauer, zählt nicht
 *  ok        — die ähnlichste Karte
 */
function resolveCard(cards, text) {
  const results = searchCards(cards, text, { limit: 6 });
  if (!results.length || results[0].score < 0.65) return { kind: 'unknown' };
  const best = results[0];
  const exact = best.score >= 0.99;
  const tied = exact ? [] : closeAlternatives(results).filter(r => plainName(r.card.name) !== plainName(best.card.name));
  if (tied.length) return { kind: 'ambiguous', card: best.card, alternatives: tied.map(r => plainName(r.card.name)) };
  return { kind: 'ok', card: best.card };
}

/** SC: Grundbetrag minus Abzug je FALSCHEM Tipp vor dem Treffer, nie unter `floor` (wer löst, soll etwas bekommen). */
function reward(base, penalty, wrongBefore, floor = 3) {
  return Math.max(Math.min(floor, base), base - penalty * Math.max(0, wrongBefore));
}

/** Berliner Kalendertag (YYYY-MM-DD) — Tagesgrenze von Pixle. */
function berlinDay(ms = Date.now()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
}

/** Unix-Sekunden des nächsten Berliner Mitternachts (für <t:…:R>); auch über die Zeitumstellung. */
function nextBerlinMidnightSec(ms = Date.now()) {
  const today = berlinDay(ms);
  const [y, m, d] = today.split('-').map(Number);
  const nextUtcMidnight = Date.UTC(y, m - 1, d + 1, 0, 0, 0);
  for (const offsetH of [2, 1]) {
    const cand = nextUtcMidnight - offsetH * 3600000;
    if (berlinDay(cand) !== today && berlinDay(cand - 1000) === today) return Math.floor(cand / 1000);
  }
  return Math.floor((nextUtcMidnight - 3600000) / 1000);
}

/** Geheime Karte wählen: aus `pool`, nicht eine der zuletzt gespielten; zufällig und gespeichert (NICHT aus dem Datum ableitbar — der Code ist öffentlich). */
function pickSecret(pool, recentNames = [], rng = Math.random) {
  const recent = new Set(recentNames);
  const fresh = pool.filter(c => !recent.has(plainName(c.name)));
  const from = fresh.length ? fresh : pool;
  return from[Math.floor(rng() * from.length)] || null;
}

module.exports = { COLUMNS, compareCards, resolveCard, reward, berlinDay, nextBerlinMidnightSec, pickSecret, closeEnough };
