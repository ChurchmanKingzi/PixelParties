'use strict';
// W86u2: Pixel-CSS (public/pixel-css.js) — weiche Scheine in Stylesheets werden harte Pixelringe (reine Funktionen, ohne DOM).
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../public/pixel-css.js').rein;

test('Unschaerfe wird erkannt, harte Schatten nicht', () => {
  assert.equal(P.hatUnschaerfe('0 0 12px rgba(250,213,74,.5)'), true);
  assert.equal(P.hatUnschaerfe('rgba(250, 213, 74, 0.5) 0px 0px 8px 0px, rgb(0, 0, 0) 2px 2px 0px 0px'), true);
  assert.equal(P.hatUnschaerfe('0 0 0 2px #fad54a, 6px 7px 0 rgba(0,0,0,.4)'), false);
  assert.equal(P.hatUnschaerfe('inset 0 0 0 1px var(--pp-kontur)'), false);
  assert.equal(P.hatUnschaerfe('none'), false);
  assert.equal(P.hatUnschaerfe('var(--karten-schatten, 0 0 0 transparent)'), false);
});

test('box-shadow: Schein → gestufte harte Ringe, nie Unschaerfe', () => {
  const v = P.boxHart('0 0 12px rgba(250,213,74,.7), 0 0 24px rgba(250,213,74,.4)');
  assert.equal(P.hatUnschaerfe(v), false);
  const ringe = v.split(', ');
  assert.ok(ringe.length >= 2 && ringe.length <= 3, v);
  ringe.forEach((r, i) => assert.match(r, new RegExp('^0 0 0 ' + (2 * (i + 1)) + 'px #[0-9a-f]{6}$')));   // 2, 4, 6 px, deckende Farben
  assert.equal(P.boxHart('0 0 0 2px #fad54a'), '0 0 0 2px #fad54a');                                          // hart bleibt
});

test('box-shadow: Schein mit Laufzeitfarbe nutzt color-mix mit dem Oberflaechengrund (deckend)', () => {
  const v = P.boxHart('0 0 20px var(--rank-glow)');
  assert.equal(P.hatUnschaerfe(v), false);
  assert.match(v, /^0 0 0 2px var\(--rank-glow\), 0 0 0 4px color-mix\(in srgb, var\(--rank-glow\) \d+%, #08060c\)/);
});

test('box-shadow: dunkle Schlagschatten bleiben dunkel, hart und mit Versatz; schwache Scheine fallen weg', () => {
  assert.equal(P.boxHart('0 6px 18px rgba(0,0,0,.45)'), '0 6px 0 2px rgba(0,0,0,.45)');
  assert.equal(P.boxHart('0 0 0 4px #fad54a, 0 6px 22px rgba(0,0,0,.5)'), '0 0 0 4px #fad54a, 0 6px 0 2px rgba(0,0,0,.5)');
  assert.equal(P.boxHart('0 0 14px rgba(250,213,74,.1)'), 'none');
  assert.match(P.boxHart('inset 0 0 12px rgba(250,213,74,.6)'), /^inset 0 0 0 2px #/);
});

test('text-shadow: Schein → 2-px-Kreuz; dunkler Schatten hart', () => {
  const v = P.textHart('0 0 10px #fad54a');
  assert.equal(P.hatUnschaerfe(v), false);
  assert.equal(v.split(', ').length, 4);
  assert.equal(P.textHart('0 2px 6px rgb(0,0,0)'), '0 2px 0 rgb(0,0,0)');
  assert.equal(P.textHart('2px 2px 0 #000'), '2px 2px 0 #000');
});

test('filter: blur() fällt weg, drop-shadow-Schein → vier harte, Rest bleibt', () => {
  assert.equal(P.filterHart('blur(1.5px) brightness(.85) saturate(.95)'), 'brightness(.85) saturate(.95)');
  assert.equal(P.filterHart('blur(3px)'), 'none');
  const v = P.filterHart('drop-shadow(0 0 4px #fad54a) brightness(1.2)');
  assert.equal((v.match(/drop-shadow\(/g) || []).length, 4);
  assert.match(v, /brightness\(1\.2\)$/);
  assert.ok((v.match(/drop-shadow\([^)]*\)/g) || []).every(d => /^drop-shadow\(-?\d+(px)? -?\d+(px)? 0 /.test(d) || /^drop-shadow\(-?\d+px 0 0 /.test(d) || /^drop-shadow\(0 -?\d+px 0 /.test(d)), v);   // dritte Laenge (Unschaerfe) immer 0
  assert.equal(P.filterHart('drop-shadow(0 6px 0 rgba(0,0,0,.45))'), 'drop-shadow(0 6px 0 rgba(0,0,0,.45))');
  assert.equal(P.filterHart('drop-shadow(0 8px 18px rgba(0,0,0,.6))'), 'drop-shadow(0 8px 0 rgba(0,0,0,.6))');
});

test('umschreiben: backdrop-filter blur → none; unbekannte Eigenschaften unverändert', () => {
  assert.equal(P.umschreiben('backdrop-filter', 'blur(6px)'), 'none');
  assert.equal(P.umschreiben('color', 'red'), 'red');
});

test('Farben: Chrome-Schreibweisen (rgb mit Leerzeichen, color(srgb …), hsl) werden gelesen', () => {
  assert.deepEqual(P.farbeLesen('rgba(250, 213, 74, 0.5)'), { rgb: [250, 213, 74], a: 0.5 });
  const c = P.farbeLesen('color(srgb 0.4 0.713726 1 / 0.5)');
  assert.ok(Math.abs(c.rgb[0] - 102) < 1 && Math.abs(c.a - 0.5) < 1e-9);
  assert.equal(P.farbeLesen('color-mix(in srgb, #fad54a 40%, transparent)').a.toFixed(2), '0.40');
  assert.equal(P.farbeLesen('var(--x)').ausdruck, 'var(--x)');
});
