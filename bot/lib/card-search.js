'use strict';
// ═══════════════════════════════════════════════════════════════════
//  Kartensuche für !show / !card / [[…]]
//
//  Ziel: die Karte, deren Name dem Suchtext am nächsten kommt. Bei nicht exakten Treffern
//  und ähnlicher Nähe gewinnen Heroes („Teocuilatl“ → der Hero „Teocuilatl, the Embodiment
//  of Gods“, nicht „Assault for Teocuilatl“).
//
//  Stufen (höher = besser), jeweils auf 0…1 normiert:
//    1.00  exakter Name (0.99: nur Leerzeichen anders, „fire ball“)
//    0.97  Name vor dem Komma („Alice“ → „Alice, the Puppeteer Girl“)
//    0.90  Name beginnt mit dem Suchtext
//    0.75  Suchtext steht als ganzes Wort/Wortfolge im Namen
//    ≤0.70 alle Suchwörter treffen (auch mit Tippfehlern) Wörter des Namens
//    ≤0.80 Gesamtähnlichkeit des Textes (Tippfehler: „teocuilat“, „fireballl“)
//  Heroes bekommen +HERO_BONUS. Der Bonus ist kleiner als der Abstand zwischen exaktem Namen und
//  Wortfolge, aber größer als der zwischen „beginnt mit“ und „enthält“: ein exakter Treffer
//  gewinnt immer, bei bloßer Ähnlichkeit der Hero.
// ═══════════════════════════════════════════════════════════════════

const HERO_BONUS = 0.08;
const MIN_SCORE = 0.5;
// Obergrenze für Hero-Bonus: unter den (nahezu) exakten Treffern, damit ein genauer Name nie überholt wird.
const EXACT = 0.99, HERO_CAP = 0.985;
const HERO_TYPES = new Set(['Hero', 'Ascended Hero']);

/** klein, ohne Akzente/Satzzeichen, einfache Leerzeichen. */
function norm(s) {
  return String(s || '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\[(?:b|w)\]$/i, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}
function similarity(a, b) {
  const m = Math.max(a.length, b.length);
  return m ? 1 - levenshtein(a, b) / m : 1;
}

/** Wie gut passt ein Suchwort auf ein Namenswort? (Präfix zählt voll, sonst Ähnlichkeit ab 0.75) */
function wordMatch(qw, nw) {
  if (nw === qw) return 1;
  if (nw.startsWith(qw)) return 0.95;
  const s = similarity(qw, nw);
  if (s >= 0.75) return s * 0.9;
  if (qw.length >= 4 && nw.length >= qw.length) {   // Tippfehler im Präfix
    const p = similarity(qw, nw.slice(0, qw.length));
    if (p >= 0.8) return p * 0.85;
  }
  return 0;
}

function baseScore(q, qWords, n, nWords, head) {
  if (n === q) return 1;
  if (head === q) return 0.97;
  const qc = q.replace(/ /g, '');
  if (n.replace(/ /g, '') === qc) return 0.99;      // „fire ball“ → Fireball
  if (head.replace(/ /g, '') === qc) return 0.96;
  if (n.startsWith(q + ' ') || n.startsWith(q)) return 0.9;
  if ((' ' + n + ' ').includes(' ' + q + ' ')) return 0.75;
  let best = 0;
  // alle Suchwörter treffen irgendein Wort des Namens
  let sum = 0, all = true;
  for (const qw of qWords) {
    let m = 0;
    for (const nw of nWords) m = Math.max(m, wordMatch(qw, nw));
    if (!m) { all = false; break; }
    sum += m;
  }
  if (all) {
    const coverage = Math.min(1, qWords.length / Math.max(1, nWords.length) + 0.3);
    best = Math.max(best, 0.55 + 0.15 * (sum / qWords.length) * coverage);
  }
  // Gesamtähnlichkeit (Tippfehler im ganzen Namen oder im Namen vor dem Komma)
  best = Math.max(best, similarity(q, n) * 0.8, similarity(q, head) * 0.8);
  return best;
}

/**
 * @param {object[]} cards  Karten aus cards.json
 * @param {string} query
 * @param {{limit?:number}} [o]
 * @returns {{card:object, score:number}[]} beste zuerst; leer, wenn nichts ≥ MIN_SCORE
 */
function searchCards(cards, query, o = {}) {
  const q = norm(query);
  if (!q) return [];
  const qWords = q.split(' ');
  const out = [];
  for (const card of cards) {
    const n = norm(card.name);
    if (!n) continue;
    const head = norm(String(card.name).split(',')[0]);
    let score = baseScore(q, qWords, n, n.split(' '), head);
    if (score < MIN_SCORE) continue;
    if (score < EXACT && HERO_TYPES.has(card.cardType)) score = Math.min(score + HERO_BONUS, HERO_CAP);
    // Bei Gleichstand die kürzere (näher am Suchtext liegende) Karte
    score -= Math.abs(n.length - q.length) * 0.0001;
    out.push({ card, score });
  }
  out.sort((a, b) => b.score - a.score || a.card.name.localeCompare(b.card.name));
  return out.slice(0, o.limit || 5);
}

/** Karten, die so nah an der besten liegen, dass der Nutzer sie vermutlich auch meinen könnte. */
function closeAlternatives(results, delta = 0.03) {
  if (!results.length) return [];
  return results.slice(1).filter(r => results[0].score - r.score <= delta && r.card.name !== results[0].card.name);
}

module.exports = { norm, searchCards, closeAlternatives, similarity, HERO_BONUS, MIN_SCORE };
