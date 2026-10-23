'use strict';
// Gemeinsame Helfer fuer die Farbpalette (scripts/palette): Farb-Literale finden, parsen, umrechnen.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

const NAMEN = { white: [255, 255, 255], black: [0, 0, 0], red: [255, 0, 0], lime: [0, 255, 0], blue: [0, 0, 255], yellow: [255, 255, 0], cyan: [0, 255, 255], magenta: [255, 0, 255], gray: [128, 128, 128], grey: [128, 128, 128], orange: [255, 165, 0], purple: [128, 0, 128], gold: [255, 215, 0], silver: [192, 192, 192], pink: [255, 192, 203], green: [0, 128, 0], brown: [165, 42, 42], navy: [0, 0, 128], teal: [0, 128, 128] };

// Ein Farb-Literal: #rgb/#rgba/#rrggbb/#rrggbbaa, rgb()/rgba() (Komma- und Leerzeichen-Syntax), hsl()/hsla(). Namen nur in CSS-Eigenschaften (siehe unten).
const RE_HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![0-9a-zA-Z_-])/g;
const RE_RGB = /rgba?\(\s*(\d{1,3}(?:\.\d+)?)\s*[, ]\s*(\d{1,3}(?:\.\d+)?)\s*[, ]\s*(\d{1,3}(?:\.\d+)?)\s*(?:[,/]\s*(\d*\.?\d+%?)\s*)?\)/g;
const RE_HSL = /hsla?\(\s*(-?\d*\.?\d+)(?:deg)?\s*[, ]\s*(\d*\.?\d+)%\s*[, ]\s*(\d*\.?\d+)%\s*(?:[,/]\s*(\d*\.?\d+%?)\s*)?\)/g;

function hexZuRgb(h) {
  h = h.replace('#', '');
  if (h.length === 3 || h.length === 4) h = [...h].map(c => c + c).join('');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
  return { rgb: [r, g, b], a };
}
const rgbZuHex = (c) => '#' + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
function hslZuRgb(h, s, l) {
  h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}
// sRGB → CIE Lab (D65)
function rgbZuLab(c) {
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const r = lin(c[0]), g = lin(c[1]), b = lin(c[2]);
  let x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, y = 0.2126 * r + 0.7152 * g + 0.0722 * b, z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t) => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  x = f(x); y = f(y); z = f(z);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
const dE = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** Alle Textdateien, in denen Farben der OBERFLAECHE stehen (nicht: Kartenrahmen/-motive, Kartenrenderer, Kampagnen-Szenen). */
function oberflaechenDateien() {
  const out = [];
  const add = (dir, re, rek) => {
    if (!fs.existsSync(path.join(ROOT, dir))) return;
    for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (rek && !['dist', 'node_modules', 'cardgen', 'scenes', 'fonts', 'anim', 'areas', 'avatars', 'campaign'].includes(e.name)) add(p, re, rek); }
      else if (re.test(e.name)) out.push(p);
    }
  };
  add('public', /\.(css|jsx|html)$/, false);
  add('public', /\.js$/, false);
  return out.filter(f => !AUSGENOMMEN.some(re => re.test(f)));
}
// Das Kartenbild gehoert dem Kartengestalter: Renderer, Rahmen, Symbole, Kunst sowie die Spielfeld-Szenen/-Kunst und Hilfsdateien ohne Oberflaechenfarben
const AUSGENOMMEN = [/public\/palette\.js$/, /public\/card-render\.js$/, /public\/card-image-shim\.js$/, /public\/skilltest-art\.js$/, /public\/dist\//, /public\/sw\.js$/, /public\/cardgen\//, /public\/campaign\//];

module.exports = { ROOT, NAMEN, RE_HEX, RE_RGB, RE_HSL, hexZuRgb, rgbZuHex, hslZuRgb, rgbZuLab, dE, oberflaechenDateien, AUSGENOMMEN };
