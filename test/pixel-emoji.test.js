'use strict';
// Jedes im Spiel als Text angezeigte Emoji/Symbol muss in der Pixel-Schrift stehen (Grafik-Regel, siehe CLAUDE.md und scripts/pixel-emoji/README.md).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { scan } = require('../scripts/pixel-emoji/scan');

test('alle Emojis/Symbole im Quelltext haben ein Pixel-Glyph', () => {
  const glyphen = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'scripts', 'pixel-emoji', 'glyphen.json'), 'utf8'));
  const fehlt = scan().filter(z => !glyphen[z.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')]);
  assert.deepStrictEqual(fehlt, [], 'Fehlende Pixel-Glyphen: ' + fehlt.join(' ') + ' — node scripts/pixel-emoji/scan.js && node scripts/pixel-emoji/extract.js && python3 scripts/pixel-emoji/build_font.py');
});

test('die Schrift und ihr CSS-Block sind vorhanden', () => {
  assert.ok(fs.statSync(path.join(__dirname, '..', 'public', 'fonts', 'pp-pixel-emoji.woff2')).size > 10000);
  const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'style.css'), 'utf8');
  assert.match(css, /PIXEL-EMOJI:BEGIN[\s\S]*font-family: 'Pixel Intv'; src: url\('\/fonts\/pp-pixel-emoji\.woff2'\)[\s\S]*PIXEL-EMOJI:END/);
});
