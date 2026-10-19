'use strict';
// ═══════════════════════════════════════════════════════════════════
//  Mystery-Spiel — reine Regeln (ohne Discord), damit sie einzeln testbar sind.
// ═══════════════════════════════════════════════════════════════════
const { searchCards, closeAlternatives, norm } = require('./card-search');

const MIN_GUESS_LEN = 3;
const GOOD_SCORE = 0.88, OKAY_SCORE = 0.7, CLEAR_GAP = 0.15;

/**
 * Beurteilt einen Tipp.
 *  - unknown   : keine Karte, die so heißt/ähnlich klingt  → zählt nicht
 *  - ambiguous : passt gleich gut auf mehrere Karten, darunter die gesuchte („Alice“) → zählt nicht, bitte genauer
 *  - correct   : die ähnlichste Karte IST die gesuchte (Tippfehler, fehlende Leerzeichen, nur der Hero-Vorname sind okay)
 *  - wrong     : eine andere Karte  → zählt
 * `best` ist die Karte, für die der Tipp gehalten wurde (für die Antwort des Bots).
 * @returns {{kind:'unknown'|'ambiguous'|'correct'|'wrong', best?:object}}
 */
function judgeGuess(cards, target, guess) {
  if (norm(guess).replace(/ /g, '').length < MIN_GUESS_LEN) return { kind: 'unknown' };
  const results = searchCards(cards, guess, { limit: 6 });
  if (!results.length) return { kind: 'unknown' };
  const best = results[0];
  const tied = closeAlternatives(results);                       // andere Karten fast gleichauf
  const targetInTie = tied.some(r => r.card.name === target.name);
  if (best.card.name === target.name) {
    const gap = best.score - (results[1] ? results[1].score : 0);
    const clear = best.score >= GOOD_SCORE || (best.score >= OKAY_SCORE && gap >= CLEAR_GAP);   // „alice puppeteer“: nur ein Teil des Namens, aber eindeutig
    if (clear) return { kind: tied.length ? 'ambiguous' : 'correct', best: best.card };
    return { kind: 'wrong', best: best.card };
  }
  if (targetInTie) return { kind: 'ambiguous', best: best.card };
  return { kind: 'wrong', best: best.card };
}

/** SC für den Gewinner: Grundbetrag minus Abzug je falschem Tipp, den ER für diese Karte schon abgegeben hat; nie unter 0. */
function reward(base, penalty, wrongBefore) {
  return Math.max(0, base - penalty * Math.max(0, wrongBefore));
}

/** Berliner Kalendertag (YYYY-MM-DD) — Tagesgrenze für das Rätsel-Kontingent. */
function berlinDay(ms = Date.now()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
}

/** Unix-Sekunden des nächsten Berliner Mitternachts (für <t:…:R>). */
function nextBerlinMidnightSec(ms = Date.now()) {
  const today = berlinDay(ms);
  // Sommer-/Winterzeit: der Mitternachtszeitpunkt liegt 22 oder 23 Stunden UTC vor dem nächsten Tag — beide Kandidaten prüfen.
  const [y, m, d] = today.split('-').map(Number);
  const nextUtcMidnight = Date.UTC(y, m - 1, d + 1, 0, 0, 0);
  for (const offsetH of [2, 1]) {
    const cand = nextUtcMidnight - offsetH * 3600000;
    if (berlinDay(cand) !== today && berlinDay(cand - 1000) === today) return Math.floor(cand / 1000);
  }
  return Math.floor((nextUtcMidnight - 3600000) / 1000);
}

/** Kontingent des Tages fortschreiben: { date, count } → am neuen Tag wieder 0. */
function dayState(saved, ms = Date.now()) {
  const today = berlinDay(ms);
  return saved && saved.date === today ? { date: today, count: saved.count } : { date: today, count: 0 };
}

/** Karten, aus denen Rätsel entstehen: mit Kunst, keine Marker-Token, nicht die zuletzt gespielten. */
function eligibleCards(cards, hasArt, recentNames = []) {
  const recent = new Set(recentNames);
  const pool = cards.filter(c => hasArt(c.name) && !/token/i.test(c.cardType || ''));
  const fresh = pool.filter(c => !recent.has(c.name));
  return fresh.length ? fresh : pool;
}

module.exports = { judgeGuess, reward, berlinDay, nextBerlinMidnightSec, dayState, eligibleCards, MIN_GUESS_LEN };
