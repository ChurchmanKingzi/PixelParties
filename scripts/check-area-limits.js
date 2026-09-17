#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════
//  WÄCHTER: AREA-LIMIT-REGISTER
//
//  Anlass (v1051): „Spatial Crevice" hebt das Area-Limit über den
//  Engine-Vertrag `areaLimit` am Kartenskript. Der PUZZLE-EDITOR
//  arbeitet aber offline — er hat weder Engine noch Kartenskripte und
//  hält deshalb eine eigene Kopie in `window.CARD_AREA_LIMITS`
//  (public/app-shared.jsx), gleiche Bauform wie das vorhandene
//  `CARD_HAND_LIMIT_MODIFIERS`.
//
//  Zwei Kopien derselben Regel laufen irgendwann auseinander, und der
//  Schaden wäre still: der Editor ließe entweder zu wenig zu (die Karte
//  wirkt kaputt) oder zu viel (das gebaute Puzzle ist im Spiel
//  ungültig). Dieses Skript vergleicht beide Seiten bei jedem Lauf.
//
//  Aufruf:  node scripts/check-area-limits.js
//  Rückgabe 0 = deckungsgleich, 1 = Abweichung.
// ════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

const WURZEL = path.join(__dirname, '..');
const EFFEKTE = path.join(WURZEL, 'cards', 'effects');
const SHARED = path.join(WURZEL, 'public', 'app-shared.jsx');
const KARTEN = path.join(WURZEL, 'data', 'cards.json');

/** Die Einträge aus `window.CARD_AREA_LIMITS` in app-shared.jsx. */
function registerAusClient() {
  const src = fs.readFileSync(SHARED, 'utf8');
  const start = src.indexOf('window.CARD_AREA_LIMITS');
  if (start < 0) return null;
  const block = src.slice(start, src.indexOf('\n};', start));
  const out = new Map();
  const re = /^\s*(['"])(.+?)\1\s*:\s*(\d+)\s*,?\s*$/gm;
  let m;
  while ((m = re.exec(block)) !== null) out.set(m[2], Number(m[3]));
  return out;
}

/** Kartenname → `areaLimit` aus dem geladenen Skript. */
function registerAusSkripten() {
  const { loadCardEffect } = require(path.join(EFFEKTE, '_loader.js'));
  const karten = JSON.parse(fs.readFileSync(KARTEN, 'utf8'));
  const out = new Map();
  for (const c of karten) {
    let mod = null;
    try { mod = loadCardEffect(c.name); } catch { continue; }
    const l = mod?.areaLimit;
    if (typeof l === 'number') out.set(c.name, l);
  }
  return out;
}

const client = registerAusClient();
if (!client) {
  console.error('[check-area-limits] FEHLER — `window.CARD_AREA_LIMITS` nicht in app-shared.jsx gefunden.');
  process.exit(1);
}
const skripte = registerAusSkripten();

const fehler = [];
for (const [name, wert] of skripte) {
  if (!client.has(name)) {
    fehler.push(`  ✗ ${name}\n      · Skript exportiert areaLimit ${wert}, fehlt aber in CARD_AREA_LIMITS (app-shared.jsx)\n      · Folge: der Puzzle-Editor lässt die zusätzlichen Areas nicht zu`);
  } else if (client.get(name) !== wert) {
    fehler.push(`  ✗ ${name}\n      · Skript sagt ${wert}, Client-Register sagt ${client.get(name)}`);
  }
}
for (const [name, wert] of client) {
  if (!skripte.has(name)) {
    fehler.push(`  ✗ ${name}\n      · steht mit ${wert} im Client-Register, das Kartenskript exportiert aber kein areaLimit\n      · Folge: der Editor baut Bretter, die das Spiel ablehnt`);
  }
}

if (fehler.length === 0) {
  console.log(`[check-area-limits] OK — ${skripte.size} Karte(n) mit areaLimit, Register deckungsgleich.`);
  process.exit(0);
}
console.log(`[check-area-limits] ${fehler.length} Abweichung(en):\n`);
console.log(fehler.join('\n\n'));
console.log('');
process.exit(1);
