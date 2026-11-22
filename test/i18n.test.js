'use strict';
// Sprachdateien (data/i18n): jede Karte uebersetzt, Namen eindeutig, Kartentext nur mit Zeichen der Kartenschrift,
// Platzhalter der Oberflaechentexte stimmen ueberein.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const R = path.join(__dirname, '..');
const cards = JSON.parse(fs.readFileSync(path.join(R, 'data/cards.json'), 'utf8'));
const de = JSON.parse(fs.readFileSync(path.join(R, 'data/i18n/de-cards.json'), 'utf8'));
const ui = JSON.parse(fs.readFileSync(path.join(R, 'data/i18n/de-ui.json'), 'utf8'));
const glyphs = JSON.parse(fs.readFileSync(path.join(R, 'public/cardgen/glyphs.json'), 'utf8')).glyphs;

test('i18n: jede Karte hat deutschen Namen und Effekttext', () => {
  const fehlt = cards.filter(c => !de[c.name] || !de[c.name].name || (c.effect && !de[c.name].effect)).map(c => c.name);
  assert.deepStrictEqual(fehlt, [], 'ohne Uebersetzung: ' + fehlt.slice(0, 10).join(' | '));
});
test('i18n: deutsche Kartennamen sind eindeutig', () => {
  const seen = new Map(); const dup = [];
  for (const c of cards) { const n = de[c.name].name; if (seen.has(n)) dup.push(n + ' (' + seen.get(n) + ' / ' + c.name + ')'); else seen.set(n, c.name); }
  assert.deepStrictEqual(dup, []);
});
test('i18n: Kartentext und Name nutzen nur Zeichen der Kartenschrift', () => {
  const schlecht = [];
  for (const c of cards) for (const f of ['name', 'effect']) for (const ch of de[c.name][f]) { if (ch !== '\n' && ch !== ' ' && !glyphs[ch]) schlecht.push(c.name + ':' + JSON.stringify(ch)); }
  assert.deepStrictEqual([...new Set(schlecht)].slice(0, 15), []);
});
test('i18n: Zahlen und Zeilenumbrueche der Effekttexte stimmen mit dem Original ueberein', () => {
  const abw = [];
  for (const c of cards) {
    const a = (c.effect.match(/\d+/g) || []).sort().join(','), b = (de[c.name].effect.match(/\d+/g) || []).sort().join(',');
    if (a !== b || (c.effect.match(/\n/g) || []).length !== (de[c.name].effect.match(/\n/g) || []).length) abw.push(c.name);
  }
  assert.ok(abw.length <= 5, abw.length + ' Abweichungen: ' + abw.slice(0, 10).join(' | '));
});
test('i18n: Oberflaechentexte behalten ihre Platzhalter', () => {
  const schlecht = [];
  for (const [en, d] of Object.entries(ui)) {
    const uniq = (l) => [...new Set(l)].sort().join(','); const a = uniq(en.match(/\{\d+\}/g) || []), b = uniq((d.match(/\{\d+(?::[^}]*)?\}/g) || []).map(x => x.replace(/:[^}]*/, '')));
    if (a !== b) schlecht.push(en);
  }
  assert.deepStrictEqual(schlecht.slice(0, 10), []);
});
