'use strict';
// Spiel-Palette (256 Farben) fuer den Server: Spielerfarben und alle serverseitig gespeicherten Farben rasten auf die naechste Palettenfarbe ein.
// Gleiche Rechnung wie public/palette.js (CIE-Lab-Abstand). Quelle: data/palette.json (scripts/palette/build_palette.py).
const fs = require('fs');
const path = require('path');
const PALETTE = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'palette.json'), 'utf8')).farben.map(f => f.hex);

const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
function lab(r, g, b) {
  r = lin(r); g = lin(g); b = lin(b);
  let x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, y = 0.2126 * r + 0.7152 * g + 0.0722 * b, z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t) => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  x = f(x); y = f(y); z = f(z);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
const rgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const PAL = PALETTE.map(h => ({ hex: h, lab: lab(...rgb(h)) }));

/** `#rrggbb` (oder `rrggbb`) → naechste Palettenfarbe als `#rrggbb`; alles andere unveraendert zurueck. */
function snapHex(hex) {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(String(hex == null ? '' : hex).trim());
  if (!m) return hex;
  const c = '#' + m[1].toLowerCase();
  if (PALETTE.includes(c)) return c;
  const l = lab(...rgb(c));
  let best = PAL[0], bd = Infinity;
  for (const p of PAL) { const d = (l[0] - p.lab[0]) ** 2 + (l[1] - p.lab[1]) ** 2 + (l[2] - p.lab[2]) ** 2; if (d < bd) { bd = d; best = p; } }
  return best.hex;
}
module.exports = { PALETTE, snapHex };
