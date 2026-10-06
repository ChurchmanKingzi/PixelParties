'use strict';
// ═══════════════════════════════════════════════════════════════════
//  KARTENBILDER — welche Karten haben ein Bild in ./cards?
//
//  Eine einzige Quelle für „Karte hat Bild": der Deckbuilder (über
//  /api/cards/available) und der Skill Test (Kartenpool, Personas)
//  fragen dieselbe Zuordnung. Dateinamen verlieren Satzzeichen
//  („Hello, World" → „Hello World.png"), deshalb wird über den
//  bereinigten Namen zugeordnet; Farbvarianten „[B]"/„[W]" liegen als
//  „Name.png"/„Name.1.png" auf der Platte.
// ═══════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
const CARDS_DIR = path.join(__dirname, 'cards');

function strippedKey(name) {
  return String(name || '')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Kartenname → Bilddatei für alle Karten mit Bild in `cardsDir`.
 * Dateien ohne passende Karte erscheinen unter ihrem Dateistamm (wie bisher im Deckbuilder).
 * @param {Array<{name:string}>} cardArray  alle Karten der Datenbank
 */
function availableImageMap(cardArray, cardsDir = CARDS_DIR) {
  const files = fs.readdirSync(cardsDir).filter(f => IMAGE_EXTS.has(path.extname(f).toLowerCase()));
  const nameByStripped = {};
  for (const c of cardArray) nameByStripped[strippedKey(c.name)] = c.name;
  const available = {};
  const byStem = {};
  for (const f of files) {
    const stem = path.basename(f, path.extname(f));
    available[nameByStripped[strippedKey(stem)] || stem] = f;
    byStem[strippedKey(stem)] = f;
  }
  for (const c of cardArray) {
    const m = /^(.*?)\s*\[(B|W)\]$/.exec(c.name);
    if (!m) continue;
    const f = byStem[strippedKey(m[2] === 'B' ? m[1] : `${m[1]}.1`)];
    if (f) available[c.name] = f;
  }
  return available;
}

// ── Gecachte Namensmenge für den Skill Test ────────────────────────
// Der Ordner ändert sich im Betrieb selten; sein mtime zeigt neue/entfernte Dateien an.
let _cache = null;

/** Menge der Kartennamen mit Bild (gecacht, erneuert sich, wenn sich der Ordner ändert). Bei Lesefehler: null (= kein Filter). */
function cardNamesWithImage(cardArray, cardsDir = CARDS_DIR) {
  try {
    const mtime = fs.statSync(cardsDir).mtimeMs;
    if (_cache && _cache.dir === cardsDir && _cache.mtime === mtime && _cache.n === cardArray.length) return _cache.set;
    const set = new Set(Object.keys(availableImageMap(cardArray, cardsDir)));
    _cache = { dir: cardsDir, mtime, n: cardArray.length, set };
    return set;
  } catch {
    return null;
  }
}

module.exports = { IMAGE_EXTS, strippedKey, availableImageMap, cardNamesWithImage };
