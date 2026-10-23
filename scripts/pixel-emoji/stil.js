'use strict';
// Handzeichner-Stil fuer automatisch gerasterte Emojis: die FORM bleibt die des System-Emojis, Schattierung, Lichtkante, Glanzpunkt, Dithering und
// getoente Kontur kommen aus einer Beleuchtungsrechnung (Licht von oben links) statt aus der Median-Cut-Palette allein.
//   stilisiere({ z: ['..AA..', …], pal: { A: '#rrggbb', Z: '#180e1a' } }) → { z, pal }   (Z = einheitliche dunkle Kontur der Rasterung)
//
// Ablauf: 1) je Farbflaeche (zusammenhaengende Zellen eines Buchstabens) eine 3-Ton-Rampe (Schatten ↔ Grundton ↔ Licht, Schatten kuehler,
// Licht waermer); 2) Hoehenfeld = Abstand zum Rand der Figur (Kuppel), daraus eine Flaechenneigung und die Helligkeit zum Licht;
// 3) die Helligkeit wird mit einer 4x4-Bayer-Matrix auf drei Toene gerastert (Dithering an den Uebergaengen);
// 4) grosse Flaechen bekommen einen kleinen Glanzpunkt oben links; 5) die Kontur nimmt einen dunklen Ton der angrenzenden Farbe.
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]].map(r => r.map(v => (v + 0.5) / 16));
const hex2 = (h) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const rgb2hex = (c) => '#' + c.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const lum = (c) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
const sat = (c) => (Math.max(...c) - Math.min(...c)) / (Math.max(...c) || 1);

function rampe(c) {
  const s = sat(c);
  const licht = mix(c, [255, 244, 214], 0.36 + 0.12 * Math.min(1, s * 1.5));                    // waermer, nicht grau
  // Schatten: dunkler UND kuehler (Blau-/Violettstich); je bunter der Ton, desto mehr
  const schatten = [c[0] * 0.54, c[1] * 0.50, c[2] * 0.62 + 8 + 14 * s];
  const glanz = mix(c, [255, 255, 255], 0.78);
  return { licht, mitte: c, schatten, glanz };
}

// Die Median-Cut-Palette des Rasters enthaelt mehrere fast gleiche Toene desselben Materials (das System-Emoji bringt seine eigene Schattierung mit).
// Sie werden vorab zu EINEM Grundton je Material zusammengefasst — die Schattierung rechnet dann dieser Stil neu. Gleicher Farbton (±30°), aehnliche
// Saettigung und Helligkeit → ein Material; deutlich hellere/dunklere Toene (Ohren, Rand, Muster) bleiben eigene Flaechen.
function hsl(c) {
  const [r, g, b] = c.map(v => v / 255); const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  let h = 0, s = 0;
  if (d > 1e-6) { s = d / (1 - Math.abs(2 * l - 1)); h = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; }
  return { h, s, l };
}
function gleichesMaterial(a, b) {
  const A = hsl(a), B = hsl(b);
  if (Math.abs(A.l - B.l) > 0.2) return false;
  const grauA = A.s < 0.15, grauB = B.s < 0.15;
  if (grauA && grauB) return true;
  if (grauA !== grauB) return false;
  const dh = Math.min(Math.abs(A.h - B.h), 360 - Math.abs(A.h - B.h));
  return dh < 30 && Math.abs(A.s - B.s) < 0.3;
}
function materialien(g, KONTUR) {
  const zaehl = {};
  for (const r of g.z) for (const c of r) if (c !== '.' && c !== KONTUR) zaehl[c] = (zaehl[c] || 0) + 1;
  const bs = Object.keys(zaehl).sort((a, b) => zaehl[b] - zaehl[a]);
  const eltern = Object.fromEntries(bs.map(b => [b, b]));
  const wurzel = (b) => { while (eltern[b] !== b) b = eltern[b]; return b; };
  for (let i = 0; i < bs.length; i++) for (let j = 0; j < i; j++) if (gleichesMaterial(hex2(g.pal[bs[i]]), hex2(g.pal[bs[j]]))) { eltern[wurzel(bs[i])] = wurzel(bs[j]); break; }
  const gruppen = {};
  for (const b of bs) (gruppen[wurzel(b)] = gruppen[wurzel(b)] || []).push(b);
  const pal = { [KONTUR]: g.pal[KONTUR] || '#180e1a' }, abbild = {};
  for (const [w, mitglieder] of Object.entries(gruppen)) {
    const c = hex2(g.pal[w]);                                    // w = haeufigstes Mitglied der Gruppe: ein echter Ton des Emojis statt eines verwaschenen Mittelwerts
    const grau = lum(c);
    pal[w] = rgb2hex(c.map(v => grau + (v - grau) * 1.14));      // etwas satter — Pixelart lebt von kraeftigen Grundtoenen
    for (const m of mitglieder) abbild[m] = w;
  }
  return { pal, z: g.z.map(r => [...r].map(c => abbild[c] || c).join('')) };
}

function stilisiere(g0, opt = {}) {
  const KONTUR = opt.kontur || 'Z';
  const g = materialien(g0, KONTUR);
  const rows = g.z.map(r => r.split(''));
  const H = rows.length, W = Math.max(...rows.map(r => r.length));
  const at = (x, y) => (x < 0 || y < 0 || y >= H || x >= rows[y].length) ? '.' : rows[y][x];
  const istKoerper = (x, y) => { const c = at(x, y); return c !== '.' && c !== KONTUR; };
  // Hoehenfeld: 8-Nachbar-Abstand zum Rand der Figur, danach leicht geglaettet
  const INF = 1e9;
  let h = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => (istKoerper(x, y) ? INF : 0)));
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (h[y][x]) {
      for (const [dx, dy, w] of [[-1, 0, 1], [0, -1, 1], [-1, -1, 1.4], [1, -1, 1.4]]) { const nx = x + dx, ny = y + dy; const v = (ny < 0 || nx < 0 || nx >= W) ? 0 : h[ny][nx]; if (v + w < h[y][x]) h[y][x] = v + w; }
    }
    for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) if (h[y][x]) {
      for (const [dx, dy, w] of [[1, 0, 1], [0, 1, 1], [1, 1, 1.4], [-1, 1, 1.4]]) { const nx = x + dx, ny = y + dy; const v = (ny >= H || nx < 0 || nx >= W) ? 0 : h[ny][nx]; if (v + w < h[y][x]) h[y][x] = v + w; }
    }
  }
  const hs = h.map((r, y) => r.map((v, x) => {
    if (!v) return 0;
    let s = 0, n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const yy = y + dy, xx = x + dx; const vv = (yy < 0 || yy >= H || xx < 0 || xx >= W) ? 0 : h[yy][xx]; const w = (dx === 0 && dy === 0) ? 2 : 1; s += vv * w; n += w; }
    return Math.min(s / n, 4.2);                                   // Obergrenze; die Flaeche selbst kappt unten auf 2,4 (flach) bzw. 4,2 (gross und rund)
  }));
  const hAt = (x, y) => (y < 0 || y >= H || x < 0 || x >= W) ? 0 : hs[y][x];
  // ungeglaettete Hoehe fuer grosse runde Flaechen (siehe `kuppel` unten)
  const hRoh = (x, y) => (y < 0 || y >= H || x < 0 || x >= W) ? 0 : (h[y][x] >= INF ? 0 : h[y][x]);
  // Licht von oben links
  const L = [-0.62, -0.62, 0.48]; const ln = Math.hypot(...L); L[0] /= ln; L[1] /= ln; L[2] /= ln;
  const flach = L[2];
  // Farbflaechen
  const flaeche = Array.from({ length: H }, () => Array(W).fill(-1)); const areas = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (istKoerper(x, y) && flaeche[y][x] < 0) {
    const id = areas.length, c = at(x, y), st = [[x, y]]; flaeche[y][x] = id; const zellen = [];
    while (st.length) { const [cx, cy] = st.pop(); zellen.push([cx, cy]); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = cx + dx, ny = cy + dy; if (istKoerper(nx, ny) && at(nx, ny) === c && flaeche[ny][nx] < 0) { flaeche[ny][nx] = id; st.push([nx, ny]); } } }
    areas.push({ c, zellen });
  }
  const pal = {}; const buchstaben = 'ABCDEFGHIJKLMNOPQRSTUVWXYabcdefghijklmnopqrstuvwxyz0123456789';
  let nextB = 0; const tonBuchstabe = new Map();
  const ton = (hex) => { if (!tonBuchstabe.has(hex)) { const b = buchstaben[nextB++]; tonBuchstabe.set(hex, b); pal[b] = hex; } return tonBuchstabe.get(hex); };
  const out = rows.map(r => r.slice());
  const randFarbe = new Map();            // Grundbuchstabe → Konturton
  for (const a of areas) {
    const base = hex2(g.pal[a.c]);
    const kontur = hex2(g.pal[KONTUR] || '#180e1a');
    const r = rampe(base);
    const dunkel = lum(base) < 40 || (a.zellen.length < 5);       // ganz dunkle oder winzige Flaechen (Augen, Punkte): unveraendert
    const tHell = ton(rgb2hex(r.licht)), tMitte = ton(rgb2hex(r.mitte)), tDunkel = ton(rgb2hex(r.schatten)), tGlanz = ton(rgb2hex(r.glanz));
    let besterGlanz = null;
    const wert = new Map();                                          // Zelle → Neigung zum Licht
    // Rechteckigkeit: Anteil der Zellen am Umschlagrechteck. Rechtecke (Tasten, Karten) bleiben flach mit Fase; grosse runde Flaechen (Kugeln, Monde) wolben sich.
    const xs = a.zellen.map(c => c[0]), ys = a.zellen.map(c => c[1]);
    const bw = Math.max(...xs) - Math.min(...xs) + 1, bh = Math.max(...ys) - Math.min(...ys) + 1;
    const fuell = a.zellen.length / (bw * bh);
    const kuppel = a.zellen.length >= 60 && fuell < 0.86 ? 4.2 : 2.4;
    const hh = (x, y) => Math.min(hAt(x, y), kuppel);
    const hh2 = kuppel > 2.4 ? ((x, y) => Math.min(hRoh(x, y), kuppel)) : hh;
    for (const [x, y] of a.zellen) {
      const gx = (hh2(x + 1, y) - hh2(x - 1, y)) / 2, gy = (hh2(x, y + 1) - hh2(x, y - 1)) / 2;
      const k = 1.0; const n = [-gx, -gy, k]; const nl = Math.hypot(...n);
      wert.set(x + ',' + y, (n[0] * L[0] + n[1] * L[1] + n[2] * L[2]) / nl - flach);
    }
    const gross = a.zellen.length >= 36;
    const TH = 0.17;
    const tonVon = (w) => (w > TH ? 2 : w < -TH ? 0 : 1);            // 0 Schatten, 1 Mitte, 2 Licht
    const ton3 = [tDunkel, tMitte, tHell];
    const tone = new Map();
    for (const [x, y] of a.zellen) {
      const w = wert.get(x + ',' + y);
      let t = tonVon(w);
      // Dithering NUR an der Grenze zweier Toene (Schachbrett), und nur auf grossen Flaechen
      if (gross && !dunkel && kuppel > 2.4 && hAt(x, y) >= 2.0) {          // nur auf gewoelbten (grossen, runden) Flaechen
        const naeher = Math.min(Math.abs(w - TH), Math.abs(w + TH));
        if (naeher < 0.07 && ((x + y) & 1) === 0) t = Math.max(0, Math.min(2, w > 0 ? (t === 2 ? 1 : (t === 1 ? 2 : 1)) : (t === 0 ? 1 : (t === 1 ? 0 : 1))));
      }
      tone.set(x + ',' + y, dunkel ? 1 : t);
    }
    if (!dunkel) {                                                   // Flecken: eine Zelle, deren vier Nachbarn (dieser Flaeche) mehrheitlich einen anderen Ton haben
      for (let pass = 0; pass < 2; pass++) for (const [x, y] of a.zellen) {
        const mein = tone.get(x + ',' + y); const z = [0, 0, 0]; let n = 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const t = tone.get((x + dx) + ',' + (y + dy)); if (t != null) { z[t]++; n++; } }
        for (let t = 0; t < 3; t++) if (t !== mein && z[t] >= Math.max(3, n - 0) && z[mein] === 0) tone.set(x + ',' + y, t);
      }
    }
    for (const [x, y] of a.zellen) {
      out[y][x] = ton3[tone.get(x + ',' + y)];
      const v = wert.get(x + ',' + y);
      if (!dunkel && a.zellen.length >= 16 && hAt(x, y) >= 1.0 && (besterGlanz == null || v - 0.06 * (x + y) > besterGlanz.s)) besterGlanz = { x, y, s: v - 0.06 * (x + y) };
    }
    if (besterGlanz && !dunkel) {                                   // Glanzpunkt: 1–2 Zellen
      out[besterGlanz.y][besterGlanz.x] = tGlanz;
      if (a.zellen.length >= 30 && flaeche[besterGlanz.y]?.[besterGlanz.x + 1] === flaeche[besterGlanz.y][besterGlanz.x]) out[besterGlanz.y][besterGlanz.x + 1] = tHell;
    }
    randFarbe.set(a.c, rgb2hex(mix(r.schatten, kontur, 0.62)));
  }
  // Kontur: dunkler Ton der angrenzenden Flaeche (die dunkelste Nachbarin gewinnt), sonst die Einheitskontur
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (at(x, y) === KONTUR) {
    let best = null, bl = 1e9;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const c = at(x + dx, y + dy); if (c !== '.' && c !== KONTUR && randFarbe.has(c)) { const l = lum(hex2(randFarbe.get(c))); if (l < bl) { bl = l; best = randFarbe.get(c); } } }
    out[y][x] = ton(best || g.pal[KONTUR] || '#180e1a');
  }
  return { pal, z: out.map(r => r.join('')) };
}
module.exports = { stilisiere };
