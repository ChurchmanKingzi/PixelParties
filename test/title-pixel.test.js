'use strict';
// Vorgebackene Titelbild-/Login-Kulisse (scripts/title-pixel/bake.py): nur Palettenfarben, nie halbtransparent, Originale vorhanden, Stand aktuell.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const T = require('../scripts/title-pixel/pruefen.js');

test('die Original-Grafiken (Quelle des Backens) liegen im Repo, außerhalb von public/ und data/', () => {
  for (const o of T.ORIGINALE) assert.ok(fs.existsSync(path.join(T.ROOT, 'scripts', 'title-pixel', 'originals', o)), 'Original fehlt: ' + o);
  assert.ok(fs.statSync(path.join(T.ROOT, 'scripts', 'title-pixel', 'originals', 'title.png')).size > 100000);
  // Die Originale sind NICHT gebacken (sonst wäre das Backen ein Backen auf Gebackenem): mehr als 256 verschiedene Farben
  const o = T.pngLesen(fs.readFileSync(path.join(T.ROOT, 'scripts', 'title-pixel', 'originals', 'title.png')));
  const farben = new Set(); for (let i = 0; i < o.rgba.length; i += 4) farben.add(o.rgba[i] << 16 | o.rgba[i + 1] << 8 | o.rgba[i + 2]);
  assert.ok(farben.size > 256, 'originals/title.png sieht gebacken aus (nur ' + farben.size + ' Farben)');
});

test('gebackene Titelbild-/Ebenen-PNGs sind aktuell (Original + Palette + Skript unverändert seit dem Backen)', () => {
  assert.deepEqual(T.veraltet(false), [], 'veraltet → python3 scripts/title-pixel/bake.py');
});

test('gebackene Titelbild-/Ebenen-PNGs enthalten nur Palettenfarben und nur volltransparente oder volldeckende Pixel', () => {
  assert.deepEqual(T.veraltet(true), []);
  const pal = T.paletteHex();
  const maße = { 'public/title.png': [1920, 1080], 'electron/assets/title.png': [640, 360], 'data/animated_screen/layers2/background.png': [1998, 1125], 'data/animated_screen/layers2/golem.png': [1920, 1080] };
  for (const [rel, [w, h]] of Object.entries(maße)) {
    const r = T.pruefePng(rel, pal);
    assert.deepEqual(r.fehler, []);
    assert.deepEqual([r.w, r.h], [w, h], rel + ': Größe');
  }
});

test('Zellen sind 3x3 Pixel groß (Raster der Kulisse) — Ebenen-Rahmen in app-screens.jsx liegen auf diesem Raster', () => {
  const b = T.pngLesen(fs.readFileSync(path.join(T.ROOT, 'public', 'title.png')));
  const px = (x, y) => { const i = (y * b.w + x) * 4; return b.rgba[i] << 16 | b.rgba[i + 1] << 8 | b.rgba[i + 2]; };
  for (let y = 0; y < b.h; y += 3 * 7) for (let x = 0; x < b.w; x += 3 * 5) {
    const c = px(x, y);
    for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) assert.equal(px(x + dx, y + dy), c, 'Zelle ' + x + ',' + y + ' nicht einfarbig');
  }
});
