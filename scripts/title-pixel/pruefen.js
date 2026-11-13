#!/usr/bin/env node
'use strict';
// Prüft die vorgebackene Titelbild-/Kulissen-Grafik (Backskript: scripts/title-pixel/bake.py, Originale: scripts/title-pixel/originals/).
//   node scripts/title-pixel/pruefen.js    Exit 1 = veraltet/fehlerhaft (dann: python3 scripts/title-pixel/bake.py)
// Wird auch von test/title-pixel.test.js benutzt.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const ROOT = path.join(__dirname, '..', '..');
const HIER = __dirname;
const ORIG = path.join(HIER, 'originals');
const MARKE = path.join(HIER, 'stand.json');

const ORIGINALE = ['title.png', 'layers2/angel.png', 'layers2/background.png', 'layers2/blonde.png', 'layers2/cat_bottom.png', 'layers2/cat_mid.png', 'layers2/cat_top.png',
  'layers2/explosion.png', 'layers2/golem.png', 'layers2/hammer.png', 'layers2/horned.png', 'layers2/ninja.png', 'layers2/rabbit.png'];
/** gebackene Datei → Original (bake.py) */
const GEBACKEN = { 'public/title.png': 'title.png', 'electron/assets/title.png': 'title.png' };
for (const o of ORIGINALE) if (o.startsWith('layers2/')) GEBACKEN['data/animated_screen/' + o] = o;

function eingabeHash() {
  const rels = ['data/palette.json', 'scripts/title-pixel/bake.py', 'scripts/title-pixel/originals/title.png']
    .concat(fs.readdirSync(path.join(ORIG, 'layers2')).filter((f) => f.endsWith('.png')).map((f) => 'scripts/title-pixel/originals/layers2/' + f)).sort();
  const h = crypto.createHash('sha256');
  for (const r of rels) {
    let b = fs.readFileSync(path.join(ROOT, r));
    if (!r.endsWith('.png')) b = Buffer.from(b.toString('latin1').replace(/\r\n/g, '\n'), 'latin1');   // Textdateien: Zeilenenden egal
    h.update(Buffer.concat([Buffer.from(r + '\0'), b]));
  }
  return h.digest('hex').slice(0, 16);
}

/** Minimaler PNG-Leser (8 Bit, nicht verschachtelt; Typ 0/2/3/4/6) → { w, h, rgba: Uint8Array } */
function pngLesen(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('kein PNG');
  let p = 8, w = 0, h = 0, bd = 0, ct = 0, il = 0, plte = null, trns = null; const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), typ = buf.toString('latin1', p + 4, p + 8), d = buf.subarray(p + 8, p + 8 + len);
    if (typ === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); bd = d[8]; ct = d[9]; il = d[12]; }
    else if (typ === 'PLTE') plte = d; else if (typ === 'tRNS') trns = d; else if (typ === 'IDAT') idat.push(d);
    p += 12 + len;
  }
  if (bd !== 8 || il !== 0) throw new Error('nur 8 Bit, nicht verschachtelt');
  const kan = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ct], bpp = kan, zeile = w * kan;
  const roh = zlib.inflateSync(Buffer.concat(idat)), px = Buffer.alloc(h * zeile);
  for (let y = 0; y < h; y++) {
    const f = roh[y * (zeile + 1)], s = y * (zeile + 1) + 1, o = y * zeile;
    for (let x = 0; x < zeile; x++) {
      const a = x >= bpp ? px[o + x - bpp] : 0, b = y ? px[o - zeile + x] : 0, c = x >= bpp && y ? px[o - zeile + x - bpp] : 0;
      let v = roh[s + x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); }
      px[o + x] = v & 255;
    }
  }
  const rgba = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    let r, g, b, a = 255;
    if (ct === 3) { const k = px[i]; r = plte[k * 3]; g = plte[k * 3 + 1]; b = plte[k * 3 + 2]; if (trns && k < trns.length) a = trns[k]; }
    else if (ct === 2) { r = px[i * 3]; g = px[i * 3 + 1]; b = px[i * 3 + 2]; }
    else if (ct === 6) { r = px[i * 4]; g = px[i * 4 + 1]; b = px[i * 4 + 2]; a = px[i * 4 + 3]; }
    else if (ct === 0) { r = g = b = px[i]; } else { r = g = b = px[i * 2]; a = px[i * 2 + 1]; }
    rgba[i * 4] = r; rgba[i * 4 + 1] = g; rgba[i * 4 + 2] = b; rgba[i * 4 + 3] = a;
  }
  return { w, h, rgba };
}

function paletteHex() {
  return new Set(JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'palette.json'), 'utf8')).farben.map((f) => f.hex.toLowerCase()));
}

/** Prüft eine gebackene PNG: nur Palettenfarben, nur Alpha 0 oder 255 → Liste von Fehlern (leer = ok) */
function pruefePng(rel, pal) {
  const fehler = [];
  const bild = pngLesen(fs.readFileSync(path.join(ROOT, rel)));
  const fremd = new Set(); let halb = 0;
  const { rgba } = bild;
  for (let i = 0; i < rgba.length; i += 4) {
    const a = rgba[i + 3];
    if (a === 0) continue;
    if (a !== 255) { halb++; continue; }
    const hx = '#' + ((1 << 24) | (rgba[i] << 16) | (rgba[i + 1] << 8) | rgba[i + 2]).toString(16).slice(1);
    if (!pal.has(hx)) fremd.add(hx);
  }
  if (fremd.size) fehler.push(rel + ': ' + fremd.size + ' Farben außerhalb der Palette (z. B. ' + [...fremd].slice(0, 3).join(' ') + ')');
  if (halb) fehler.push(rel + ': ' + halb + ' halbtransparente Pixel');
  return { fehler, w: bild.w, h: bild.h };
}

/** Alle Probleme als Textliste (leer = in Ordnung). `tief`: auch Pixelinhalt der gebackenen PNGs prüfen. */
function veraltet(tief) {
  const res = [];
  for (const o of ORIGINALE) if (!fs.existsSync(path.join(ORIG, o))) res.push('Original fehlt: scripts/title-pixel/originals/' + o);
  if (res.length) return res;
  let marke = null;
  try { marke = JSON.parse(fs.readFileSync(MARKE, 'utf8')); } catch { return ['scripts/title-pixel/stand.json fehlt → python3 scripts/title-pixel/bake.py']; }
  if (marke.hash !== eingabeHash()) res.push('gebackene Titelbild-Grafik veraltet (Original, data/palette.json oder bake.py geändert) → python3 scripts/title-pixel/bake.py');
  const pal = tief ? paletteHex() : null;
  for (const rel of Object.keys(GEBACKEN)) {
    const f = path.join(ROOT, rel);
    if (!fs.existsSync(f)) { res.push(rel + ': fehlt'); continue; }
    if (crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex') !== (marke.dateien || {})[rel]) res.push(rel + ': nicht die gebackene Fassung (Marker stimmt nicht) → python3 scripts/title-pixel/bake.py');
    else if (tief) res.push(...pruefePng(rel, pal).fehler);
  }
  return res;
}

module.exports = { veraltet, eingabeHash, pngLesen, pruefePng, paletteHex, ORIGINALE, GEBACKEN, ROOT };

if (require.main === module) {
  const v = veraltet(true);
  if (v.length) { console.error(v.join('\n')); process.exit(1); }
  console.log('Titelbild-Grafik ist aktuell.');
}
