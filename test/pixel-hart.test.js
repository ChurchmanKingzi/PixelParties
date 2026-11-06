'use strict';
// W86u1: harte Kanten statt Weichzeichner (public/pixel-hart.js, reine Funktionen).
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../public/pixel-hart.js');
const { hatUnschaerfe } = require('../scripts/check-pixel-anim');

test('box-shadow: Schein wird 1-2 harte Ringe, nie Unschaerfe', () => {
  const v = H.box('0 0 16px rgba(249,172,32,.8), 0 0 30px rgba(255,139,26,.4), inset 0 0 8px rgba(249,172,32,.3)');
  assert.equal(hatUnschaerfe(v), false);
  assert.match(v, /^0 0 0 4px #[0-9a-f]{6}, 0 0 0 6px #[0-9a-f]{6}, inset 0 0 0 2px #[0-9a-f]{6}$/);
});

test('box-shadow: Fall-Schatten wird harter Versatz, dunkler Dunst faellt weg, harte Ringe bleiben', () => {
  assert.equal(H.box('0 8px 24px rgba(0,0,0,.7)'), '0px 8px 0 0px #000000');
  assert.equal(H.box('0 0 30px rgba(0,0,0,.6)'), 'none');
  assert.equal(H.box('0 0 0 2px #fff, 0 0 0 6px #ef2929'), '0 0 0 2px #fff, 0 0 0 6px #ef2929');
  assert.equal(H.box('0 0 0 3px var(--accent), 0 0 16px rgba(127,223,255,.8)').split(',')[0], '0 0 0 3px var(--accent)');
});

test('box-shadow: berechnete Schreibweise (Farbe zuerst) und var()-Farben', () => {
  assert.equal(H.box('rgba(249, 172, 32, 0.8) 0px 0px 16px 0px'), '0 0 0 4px #f9ac20');
  assert.match(H.box('0 0 12px var(--glow)'), /^0 0 0 2px var\(--glow\)$/);
});

test('text-shadow: Schein = harte Kontur in 8 Richtungen, Schlagschatten hart, ohne Spread-Wert', () => {
  const k = H.text('0 0 3px #000');
  assert.equal(k.split(',').length, 8);
  assert.equal(hatUnschaerfe(k), false);
  assert.equal(H.text('0 2px 6px rgba(0,0,0,.9)'), '0px 2px 0 #000000');
  assert.equal(H.text('1px 1px 0 #000'), '1px 1px 0 #000');
  for (const t of k.split(',')) assert.equal(t.trim().split(/\s+/).length, 4);       // x y blur farbe — text-shadow kennt keinen Spread
});

test('filter: blur() faellt weg, drop-shadow wird hart, Farbfilter bleiben', () => {
  assert.equal(H.filter('blur(2px)'), 'none');
  assert.equal(H.filter('brightness(1.2) blur(3px)'), 'brightness(1.2)');
  assert.match(H.filter('drop-shadow(0 4px 18px rgba(120,0,20,0.5))'), /^drop-shadow\(0px 4px 0 #[0-9a-f]{6}\)$/);
  assert.match(H.filter('drop-shadow(0 0 5px rgba(119,200,238,.7))'), /^(drop-shadow\(-?[12]px 0 0 #[0-9a-f]{6}\) ?){2}drop-shadow\(0 -?[12]px 0 #[0-9a-f]{6}\) drop-shadow\(0 -?[12]px 0 #[0-9a-f]{6}\)$/);
  assert.equal(H.filter('drop-shadow(2px 2px 0 #000)'), 'drop-shadow(2px 2px 0 #000)');
});

test('Eigenschaften: backdrop-filter und Mischmodus, eigene --*-shadow-Werte, cssText', () => {
  assert.equal(H.eigenschaft('backdropFilter', 'blur(3px)'), 'none');
  assert.equal(H.eigenschaft('mix-blend-mode', 'screen'), 'normal');
  assert.equal(H.eigenschaft('mixBlendMode', 'normal'), 'normal');
  assert.match(H.eigenschaft('--card-shadow', '0 0 10px #f9ac20'), /^0 0 0 (2|4)px #/);
  assert.equal(H.eigenschaft('color', '#fff'), '#fff');
  const c = H.cssText('position:absolute;box-shadow:0 0 14px #ff7d00;left:3px');
  assert.match(c, /^position:absolute; box-shadow: 0 0 0 4px #[0-9a-f]{6}; left:3px;$/);
  assert.equal(H.cssText('left:3px;top:2px'), 'left:3px;top:2px');
});

test('Unbekannte Schreibweisen bleiben unveraendert', () => {
  assert.equal(H.box('0 0 foo bar'), '0 0 foo bar');
  assert.equal(H.box('0 0 calc(2px + 4px) #ff0000'), '0 0 0 2px #ff0000');           // dynamische Unschaerfe zaehlt als Schein
  assert.equal(H.box('none'), 'none');
});
