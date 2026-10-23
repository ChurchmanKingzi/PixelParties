'use strict';
// Prueft, dass JEDES im Spiel als Text vorkommende Emoji/Symbol in der Pixel-Schrift steht (glyphen.json).
//   node scripts/pixel-emoji/pruefen.js        → Exit 0 = alles abgedeckt, 1 = es fehlen Zeichen (dann: scan.js, extract.js, build_font.py)
const fs = require('fs');
const path = require('path');
const { scan } = require('./scan');
const glyphen = JSON.parse(fs.readFileSync(path.join(__dirname, 'glyphen.json'), 'utf8'));
const vorhanden = new Set(Object.keys(glyphen));
const nichtDarstellbar = new Set(fs.existsSync(path.join(__dirname, 'ausnahmen.json')) ? JSON.parse(fs.readFileSync(path.join(__dirname, 'ausnahmen.json'), 'utf8')) : []);
const fehlt = scan().filter(z => {
  const cp = z.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
  return !vorhanden.has(cp) && !nichtDarstellbar.has(z);
});
if (fehlt.length) {
  console.error('Fehlende Pixel-Glyphen (' + fehlt.length + '): ' + fehlt.join(' '));
  console.error('→ node scripts/pixel-emoji/scan.js && node scripts/pixel-emoji/extract.js && python3 scripts/pixel-emoji/build_font.py');
  process.exit(1);
}
console.log('Alle ' + vorhanden.size + ' Zeichen sind als Pixelart abgedeckt.');
