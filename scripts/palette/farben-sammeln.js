'use strict';
// Sammelt alle Farb-Literale der Oberflaeche (CSS/JSX/HTML) mit Haeufigkeit.   node scripts/palette/farben-sammeln.js --json → { "#rrggbb": n }
const L = require('./farben-lib');
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
// --git <ref>: den Stand VOR dem Einrasten lesen (die Palette wird aus den urspruenglichen Oberflaechenfarben gebaut, sonst dreht sie sich im Kreis)
const gi = process.argv.indexOf('--git'); const ref = gi > 0 ? process.argv[gi + 1] : null;
const zaehl = {};
function add(rgb) { const k = L.rgbZuHex(rgb); zaehl[k] = (zaehl[k] || 0) + 1; }
for (const f of L.oberflaechenDateien()) {
  let t; try { t = ref ? execSync(`git show ${ref}:${f}`, { cwd: L.ROOT, maxBuffer: 1 << 28 }).toString('utf8') : fs.readFileSync(path.join(L.ROOT, f), 'utf8'); } catch (e) { continue; }
  for (const m of t.matchAll(L.RE_HEX)) add(L.hexZuRgb(m[0]).rgb);
  for (const m of t.matchAll(L.RE_RGB)) add([+m[1], +m[2], +m[3]]);
  for (const m of t.matchAll(L.RE_HSL)) add(L.hslZuRgb(+m[1], +m[2], +m[3]));
}
if (process.argv.includes('--json')) process.stdout.write(JSON.stringify(zaehl));
else console.log(Object.keys(zaehl).length + ' verschiedene Farben, ' + Object.values(zaehl).reduce((a, b) => a + b, 0) + ' Literale');
