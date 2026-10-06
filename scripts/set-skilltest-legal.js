#!/usr/bin/env node
'use strict';
// Ergänzt in data/cards.json das Feld `skilltestLegal` (Kartenpool des
// Modus „Skill Test"). Vorhandene Werte werden NIE überschrieben — so
// bleibt die spätere Handkuratur erhalten. Das Skript arbeitet auf dem
// Rohtext, damit der Diff klein und das Dateiformat unverändert bleibt.
//
//   node scripts/set-skilltest-legal.js           # fehlende Felder ergänzen
//   node scripts/set-skilltest-legal.js --check   # nur prüfen (Exit 1 bei Mangel)
const fs = require('fs');
const path = require('path');
const { HARD_EXCLUDED_TYPES, INITIAL_ILLEGAL_NAMES } = require('../skilltest/config');

const FILE = path.join(__dirname, '..', 'data', 'cards.json');
const check = process.argv.includes('--check');
let raw = fs.readFileSync(FILE, { encoding: 'utf-8' });
const cards = JSON.parse(raw);
const byName = new Map(cards.map(c => [c.name, c]));

const defaultFor = (c) => !(HARD_EXCLUDED_TYPES.has(c.cardType) || INITIAL_ILLEGAL_NAMES.has(c.name));

const missing = cards.filter(c => typeof c.skilltestLegal !== 'boolean');
const badType = cards.filter(c => c.skilltestLegal === true && HARD_EXCLUDED_TYPES.has(c.cardType));
if (check) {
  if (missing.length) console.error(`✗ ${missing.length} Karte(n) ohne skilltestLegal, z. B. ${missing.slice(0, 5).map(c => c.name).join(', ')}`);
  if (badType.length) console.error(`✗ ${badType.length} Karte(n) mit hart ausgeschlossenem Typ stehen auf true: ${badType.slice(0, 5).map(c => c.name).join(', ')}`);
  if (!missing.length && !badType.length) {
    const legal = cards.filter(c => c.skilltestLegal).length;
    console.log(`✓ skilltestLegal gesetzt für alle ${cards.length} Karten (${legal} legal, ${cards.length - legal} nicht).`);
  }
  process.exit(missing.length || badType.length ? 1 : 0);
}
if (!missing.length) { console.log('Nichts zu tun — alle Karten haben skilltestLegal.'); process.exit(0); }

// Sequenziell durch Name-/banned-Zeilen laufen: je Eintrag genau eine von beiden.
let current = null;
let added = 0;
raw = raw.replace(/\n(\s*)"name": ("(?:[^"\\]|\\.)*"),|\n(\s*)"banned": [^\n]*,/g, (m, i1, nameJson, i3) => {
  if (nameJson !== undefined) { current = byName.get(JSON.parse(nameJson)); return m; }
  if (current && typeof current.skilltestLegal !== 'boolean') {
    added++;
    return `${m}\n${i3}"skilltestLegal": ${defaultFor(current)},`;
  }
  return m;
});
if (added !== missing.length) { console.error(`Abbruch: ${added} Einfügungen, erwartet ${missing.length}`); process.exit(1); }
JSON.parse(raw); // Gültigkeitsprüfung
fs.writeFileSync(FILE, raw, { encoding: 'utf-8' });
console.log(`skilltestLegal bei ${added} Karten ergänzt.`);
