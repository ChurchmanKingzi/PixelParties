'use strict';
// Spiel-Palette (256 Farben): Groesse, Zentralfarben der Karten-Elemente, Oberflaeche ohne fremde Farben, Spielerfarbe rastet ein.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const palette = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'palette.json'), 'utf8'));
const { snapHex } = require('../palette');

test('die Palette hat höchstens 256 Farben, eindeutig und mit Zentralfarben der Karten-Elemente', () => {
  const hex = palette.farben.map(f => f.hex);
  assert.ok(hex.length <= 256, 'zu viele Farben: ' + hex.length);
  assert.strictEqual(new Set(hex).size, hex.length, 'doppelte Farben');
  assert.ok(palette.farben.filter(f => f.kern).length >= 40, 'zu wenige Zentralfarben aus den Karten-Elementen');
  assert.ok(hex.includes('#ffffff') && hex.includes('#000000'));
});

test('jede Farbe der Oberfläche (CSS/JSX) steht in der Palette', () => {
  try { execFileSync('node', [path.join(__dirname, '..', 'scripts', 'palette', 'anwenden.js'), '--pruefen'], { encoding: 'utf8', stdio: 'pipe' }); }
  catch (e) { assert.fail(String(e.stderr || e.stdout || e.message)); }
});

test('Spielerfarben rasten auf die nächste Palettenfarbe ein (idempotent)', () => {
  const hex = new Set(palette.farben.map(f => f.hex));
  for (const c of ['#12ab34', '#00f0ff', '#ff5060', '#777777', '#abcdef']) {
    const s = snapHex(c);
    assert.ok(hex.has(s), c + ' → ' + s + ' steht nicht in der Palette');
    assert.strictEqual(snapHex(s), s);
  }
  assert.strictEqual(snapHex('kein hex'), 'kein hex');
});
