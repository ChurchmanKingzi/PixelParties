'use strict';
// ═══════════════════════════════════════════════════════════════════
//  KARTENBILDER — welche Karten haben ein Bild (Kunst im Atlas oder Datei in ./cards)?
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
const ART_JSON = path.join(__dirname, 'public', 'cardgen', 'art.json');

// ── Kunst im Atlas (public/cardgen/art.json) ──────────────────────
// Karten werden zur Laufzeit aus Rahmen + Kunst zusammengesetzt (public/card-render.js). „Hat Bild" heisst
// deshalb: es gibt eine Bilddatei in ./cards ODER Kunst im Atlas. Fuer Karten, die nur im Atlas stehen,
// erfindet dieser Abschnitt den Dateinamen, den die Bilddatei haette (ohne Satzzeichen, Farbvariante „.1").
let _artCache = null;
function artKeys() {
  try {
    const mtime = fs.statSync(ART_JSON).mtimeMs;
    if (_artCache && _artCache.mtime === mtime) return _artCache;
    const art = JSON.parse(fs.readFileSync(ART_JSON, 'utf8'));
    const keys = [...Object.keys(art.a || {}), ...Object.keys(art.b || {})];
    _artCache = {
      mtime,
      cards: keys.filter(k => !k.startsWith('skin/')),
      skins: keys.filter(k => k.startsWith('skin/')).map(k => k.slice(5)),
    };
  } catch { _artCache = { mtime: 0, cards: [], skins: [] }; }
  return _artCache;
}
function artFileFor(cardName) {
  const m = /^(.*?)\s*\[(B|W)\]$/.exec(cardName);
  return strippedKey(m ? m[1] : cardName) + (m && m[2] === 'W' ? '.1' : '') + '.png';
}
function listImageFiles(dir) {
  try { return fs.readdirSync(dir).filter(f => IMAGE_EXTS.has(path.extname(f).toLowerCase())); } catch { return []; }
}
/** Bilddateien der Karten (./cards) plus die Dateinamen der Karten, die nur im Kunst-Atlas stehen. */
function cardFileList(cardsDir = CARDS_DIR) {
  const files = listImageFiles(cardsDir);
  const have = new Set(files.map(f => strippedKey(path.basename(f, path.extname(f)))));
  for (const name of artKeys().cards) {
    const f = artFileFor(name);
    if (!have.has(strippedKey(path.basename(f, '.png')))) { files.push(f); have.add(strippedKey(path.basename(f, '.png'))); }
  }
  return files;
}
/** Bilddateien der Skins (./cards/skins, nur oberste Ebene) plus die Skins, die nur im Kunst-Atlas stehen. */
function skinFileList(skinsDir = path.join(CARDS_DIR, 'skins')) {
  const files = listImageFiles(skinsDir);
  const have = new Set(files.map(f => path.basename(f, path.extname(f))));
  for (const name of artKeys().skins) if (!have.has(name)) { files.push(name + '.png'); have.add(name); }
  return files;
}

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
  const files = cardFileList(cardsDir);
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
    const mtime = fs.statSync(cardsDir).mtimeMs + artKeys().mtime;
    if (_cache && _cache.dir === cardsDir && _cache.mtime === mtime && _cache.n === cardArray.length) return _cache.set;
    const set = new Set(Object.keys(availableImageMap(cardArray, cardsDir)));
    _cache = { dir: cardsDir, mtime, n: cardArray.length, set };
    return set;
  } catch {
    return null;
  }
}

module.exports = { IMAGE_EXTS, strippedKey, availableImageMap, cardNamesWithImage, cardFileList, skinFileList, artKeys };
