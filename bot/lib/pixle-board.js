'use strict';
// ═══════════════════════════════════════════════════════════════════
//  Pixle — das Hinweis-Brett als Bild: eine Zeile je Tipp, farbige Zellen je Eigenschaft.
//  Schrift: „Pixel Intv“ aus dem Spiel (data/Pixel Intv.otf) — dieselbe Schrift wie auf den Karten, und sie liegt im Repo,
//  der Server braucht also keine Systemschriften.
// ═══════════════════════════════════════════════════════════════════
const path = require('path');
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');

const FONT_FILE = path.resolve(__dirname, '..', '..', 'data', 'Pixel Intv.otf');
const FAMILY = 'PixelIntvPixle';
let fontReady = null;
function ensureFont() {
  if (fontReady === null) {
    try { fontReady = !!GlobalFonts.registerFromPath(FONT_FILE, FAMILY); } catch { fontReady = false; }
    if (!fontReady) console.warn('[pixle] Schrift nicht geladen — das Brett fällt auf eine Systemschrift zurück:', FONT_FILE);
  }
  return fontReady ? FAMILY : 'sans-serif';
}

const COLORS = { match: '#2e9e4f', partial: '#c9a227', miss: '#a63b3b', name: '#2b2a4a', header: '#1a1830', bg: '#12102a', text: '#ffffff', headText: '#9d9ad6', shadow: 'rgba(0,0,0,0.6)' };
// Spaltenbreiten (Bildpunkte): Name, dann die acht Eigenschaften in der Reihenfolge von lib/pixle.js COLUMNS
const NAME_W = 390;
const WIDTHS = { type: 134, subtype: 124, level: 90, hp: 100, atk: 100, cost: 90, school: 160, set: 140 };
const ORDER = ['type', 'subtype', 'level', 'hp', 'atk', 'cost', 'school', 'set'];
const PAD = 10, GAP = 6, ROW_H = 54, HEAD_H = 40;

/** Schrift so verkleinern, dass der Text in `maxW` passt; reicht auch die kleinste Größe nicht, mit „…“ kürzen. */
function fit(g, family, text, maxW, size, minSize = 14) {
  let s = size;
  for (; s >= minSize; s -= 2) { g.font = `${s}px ${family}`; if (g.measureText(text).width <= maxW) return { text, size: s }; }
  g.font = `${minSize}px ${family}`;
  let t = text;
  while (t.length > 1 && g.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return { text: t + '…', size: minSize };
}

function textIn(g, family, text, x, y, w, h, size, align = 'center') {
  const f = fit(g, family, text, w - 14, size);
  g.font = `${f.size}px ${family}`;
  g.textBaseline = 'middle';
  g.textAlign = align;
  const tx = align === 'center' ? x + w / 2 : x + 10;
  g.lineWidth = 4; g.strokeStyle = COLORS.shadow; g.strokeText(f.text, tx, y + h / 2 + 1);
  g.fillStyle = COLORS.text; g.fillText(f.text, tx, y + h / 2 + 1);
}

function arrow(g, dir, cx, cy) {
  g.beginPath();
  if (dir === 'up') { g.moveTo(cx, cy - 9); g.lineTo(cx + 9, cy + 7); g.lineTo(cx - 9, cy + 7); }
  else { g.moveTo(cx, cy + 9); g.lineTo(cx + 9, cy - 7); g.lineTo(cx - 9, cy - 7); }
  g.closePath();
  g.fillStyle = '#fff'; g.fill();
  g.lineWidth = 2; g.strokeStyle = 'rgba(0,0,0,0.65)'; g.stroke();
}

/**
 * @param {{name:string, cells:{key:string,label:string,text:string,status:string,arrow:string|null}[], hideName?:boolean, correct?:boolean}[]} rows
 * @returns {Buffer} PNG
 */
function renderBoard(rows) {
  const family = ensureFont();
  const width = PAD * 2 + NAME_W + ORDER.reduce((s, k) => s + GAP + WIDTHS[k], 0);
  const height = PAD * 2 + HEAD_H + rows.length * (ROW_H + GAP);
  const cv = createCanvas(width, height), g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.fillStyle = COLORS.bg; g.fillRect(0, 0, width, height);

  // Kopfzeile
  const labels = { type: 'Type', subtype: 'Subtype', level: 'Level', hp: 'HP', atk: 'ATK', cost: 'Cost', school: 'School', set: 'Set' };
  let x = PAD;
  g.fillStyle = COLORS.header; g.fillRect(PAD, PAD, width - PAD * 2, HEAD_H);
  g.font = `18px ${family}`; g.textBaseline = 'middle'; g.textAlign = 'center'; g.fillStyle = COLORS.headText;
  g.fillText('Guess', x + NAME_W / 2, PAD + HEAD_H / 2 + 1);
  x += NAME_W;
  for (const k of ORDER) { x += GAP; g.fillText(labels[k], x + WIDTHS[k] / 2, PAD + HEAD_H / 2 + 1); x += WIDTHS[k]; }

  // Zeilen
  rows.forEach((row, i) => {
    const y = PAD + HEAD_H + GAP + i * (ROW_H + GAP);
    let cx = PAD;
    g.fillStyle = row.correct ? COLORS.match : COLORS.name; g.fillRect(cx, y, NAME_W, ROW_H);
    textIn(g, family, row.hideName ? 'SOLVED!' : row.name, cx, y, NAME_W, ROW_H, 24);
    cx += NAME_W;
    const byKey = Object.fromEntries(row.cells.map(c => [c.key, c]));
    for (const k of ORDER) {
      cx += GAP;
      const c = byKey[k];
      g.fillStyle = COLORS[c.status]; g.fillRect(cx, y, WIDTHS[k], ROW_H);
      textIn(g, family, c.text, cx, y, WIDTHS[k] - (c.arrow ? 22 : 0), ROW_H, 24);
      if (c.arrow) arrow(g, c.arrow, cx + WIDTHS[k] - 18, y + ROW_H / 2);
      cx += WIDTHS[k];
    }
  });
  return cv.toBuffer('image/png');      // synchron: siehe lib/card-renderer.js (toPng)
}

module.exports = { renderBoard, ORDER, WIDTHS, NAME_W };
