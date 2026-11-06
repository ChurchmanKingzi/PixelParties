'use strict';
// Setzt jede Farbe der Oberflaeche auf die naechste Farbe der Spiel-Palette (data/palette.json), CIE-Lab-Abstand. Alpha bleibt.
//   node scripts/palette/anwenden.js            → schreibt die Dateien um (idempotent)
//   node scripts/palette/anwenden.js --pruefen  → Exit 1, wenn irgendwo ein Farb-Literal NICHT in der Palette steht (npm test)
const fs = require('fs');
const path = require('path');
const L = require('./farben-lib');
const palette = JSON.parse(fs.readFileSync(path.join(L.ROOT, 'data', 'palette.json'), 'utf8')).farben.map(f => f.hex);
const palRgb = palette.map(h => L.hexZuRgb(h).rgb), palLab = palRgb.map(L.rgbZuLab), palSet = new Set(palette);

const cache = new Map();
function naechste(rgb) {
  const key = rgb.map(Math.round).join(',');
  if (cache.has(key)) return cache.get(key);
  const hex = L.rgbZuHex(rgb);
  let res;
  if (palSet.has(hex)) res = palRgb[palette.indexOf(hex)];
  else { const lab = L.rgbZuLab(rgb); let bi = 0, bd = 1e9; for (let i = 0; i < palLab.length; i++) { const d = L.dE(lab, palLab[i]); if (d < bd) { bd = d; bi = i; } } res = palRgb[bi]; }
  cache.set(key, res); return res;
}
const num = (v) => (Math.round(v * 1000) / 1000).toString().replace(/^0\./, '.');

function umsetzen(text, melde) {
  let n = 0;
  const imPal = (rgb) => palSet.has(L.rgbZuHex(rgb));
  const merke = (alt, neu) => { n++; if (melde) melde(alt, neu); return neu; };
  text = text.replace(L.RE_HEX, (m) => {
    const c = L.hexZuRgb(m);
    if (imPal(c.rgb)) return m;                                   // schon eine Palettenfarbe: Schreibweise unveraendert lassen
    let h = L.rgbZuHex(naechste(c.rgb));
    if (c.a !== 1) h += Math.round(c.a * 255).toString(16).padStart(2, '0');
    return merke(m, h);
  });
  text = text.replace(/%23(?:[0-9a-fA-F]{6})(?![0-9a-zA-Z])/g, (m) => { const c = L.hexZuRgb(m.slice(3)).rgb; return imPal(c) ? m : merke(m, '%23' + L.rgbZuHex(naechste(c)).slice(1)); });
  text = text.replace(L.RE_RGB, (m, r, g, b, a) => {
    if (imPal([+r, +g, +b])) return m;
    const p = naechste([+r, +g, +b]);
    return merke(m, (a != null || m.startsWith('rgba') ? 'rgba(' : 'rgb(') + p.join(',') + (a != null ? ',' + a : '') + ')');
  });
  text = text.replace(L.RE_HSL, (m, h, s, l, a) => {
    const rgb = L.hslZuRgb(+h, +s, +l).map(Math.round);
    const p = naechste(rgb);
    return merke(m, a != null ? 'rgba(' + p.join(',') + ',' + a + ')' : L.rgbZuHex(p));
  });
  return { text, n };
}

if (require.main === module) {
  const pruefen = process.argv.includes('--pruefen');
  let gesamt = 0; const schlecht = [];
  for (const f of L.oberflaechenDateien()) {
    const abs = path.join(L.ROOT, f);
    const alt = fs.readFileSync(abs, 'utf8');
    if (pruefen) {
      const { n } = umsetzen(alt, (a, b) => { if (a.toLowerCase().replace(/\s/g, '') !== b.toLowerCase().replace(/\s/g, '') && schlecht.length < 40) schlecht.push(f + ': ' + a + ' → ' + b); });
      gesamt += n;
    } else {
      const { text, n } = umsetzen(alt);
      if (n) { fs.writeFileSync(abs, text, 'utf8'); console.log(f.padEnd(34), n + ' Farben angepasst'); gesamt += n; }
    }
  }
  if (pruefen) { if (gesamt) { console.error(gesamt + ' Farb-Literale stehen nicht in der Palette (z. B.):\n  ' + schlecht.slice(0, 12).join('\n  ') + '\n→ node scripts/palette/anwenden.js'); process.exit(1); } console.log('Alle Farb-Literale der Oberflaeche stehen in der Palette.'); }
  else console.log('Insgesamt ' + gesamt + ' Farben auf die Palette gesetzt.');
}
module.exports = { naechste, umsetzen, palette };
