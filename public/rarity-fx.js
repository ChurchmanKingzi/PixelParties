'use strict';
// ═══════════════════════════════════════════════════════════════════
//  RARITY-EFFEKTE — Canvas-Renderer der Seltenheiten (ersetzt den alten Foil-Code)
//
//  Alle Effekte laufen auf dem 150 x 210-Raster der Karte (1 Rasterzelle = 5 Kartenpixel) und werden in ganzzahligen Zellen auf EINE Leinwand
//  je Karte gezeichnet, die über dem Kartenbild liegt (das Bild selbst zeigt schon die Basiskarte der Stufe: Stempel, Rahmen, Namensfarbe,
//  siehe `CardRender.rarityBase`). Pixelart: feste Palette (jede Farbe rastet auf data/palette.json ein), Dithering (4x4-Bayer) statt Alpha,
//  gestufte Helligkeit, Bewegung im 20-Bilder-Takt (Umbra/Stained 15), Funken als Pixelkreuze.
//
//  Stufen (Entwürfe: abgenommene Mockups):  Common (kein Effekt) · Uncommon (silberner Name/Werte/Icon) · Rare (Prisma-Strahl, Silberrahmen) ·
//  Prismatic (Regenbogenkacheln) · Super Rare (Lichtlauf, Schraffur) · Diamond (Rautengitter) · Spectral (Echo, Glitches) ·
//  Umbra (Schattenrauch um das Motiv, Regen) · Stained Rare (Buntglas-Hintergrund, Aura, goldener Text).
//
//  API (window.PpRarityFx):
//    available(rarity)                     Gibt es für diese Stufe einen Effekt? (false bei Common/unbekannt)
//    hasMask(cardName)                     Hat die Karte eine Motiv-Maske (nur dann Umbra/Stained)? Wahr erst, wenn `loadMasks()` fertig ist.
//    loadMasks()                           Promise: lädt public/cardgen/masks.bin einmal (gecacht)
//    attach(hostEl, { card, rarity, animated, size, img, variant }) -> { update(opts), destroy() }
//         legt EINE <canvas> in `hostEl` (absolut, füllt ihn) über das Kartenbild. `animated:false` zeichnet nur ein Standbild (kein Takt, kein
//         Dauerlauf), `animated:true` läuft im Takt, nur solange sichtbar. `img`: das Kartenbild (Standard: erstes <img> in hostEl / seinem
//         Elternelement). `variant`: { hp, noHp, noAtk, lv, kost } (Standard: aus der Bild-URL gelesen). `size`: Breite der Karte in CSS-px (Standard: gemessen).
//         Common oder fehlende Voraussetzungen (Maske, Kunst): keine Leinwand (kein Absturz).
//    imageRarity(rarity)                   Wert für `?rar=` der Karten-URL (Basiskarte der Stufe); '' bei Common
//    testRarity(cardName)                  Test-Schalter: ?rarity=<id|mix> in der Adresse oder window.__ppTestRarity
//    ORDER, LABEL
//  Messung / Test:  PpRarityFx.stats()
// ═══════════════════════════════════════════════════════════════════
(function (root) {
  if (root.PpRarityFx) return;

  const GW = 150, GH = 210, NPX = GW * GH;
  const ORDER = ['common', 'uncommon', 'rare', 'prismatic', 'super', 'diamond', 'spectral', 'umbra', 'stained'];
  const LABEL = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', prismatic: 'Prismatic', super: 'Super Rare', diamond: 'Diamond', spectral: 'Spectral', umbra: 'Umbra', stained: 'Stained Rare' };
  // Je Stufe: Basiskarte (nur Information; die URL-Variante steht in CardRender.rarityBase), Effekt, Stempel, Takt, Standbild-Zeit
  const SPEC = {
    uncommon: { fx: 'unc', stamp: 'silver', fps: 20, still: 1.5 },
    rare: { fx: 'rare', stamp: 'rainbow', fps: 20, still: 1.2 },   // Standbild: Strahl mitten im Bild (Lauf 4,6 s, 72 %)
    prismatic: { fx: 'pris', stamp: 'prismatic', fps: 20, still: 2.2, textTop: true },
    super: { fx: 'sr', stamp: 'srstar', fps: 20, still: 1.4 },
    diamond: { fx: 'dia', stamp: 'diamond', fps: 20, still: 1.0 },
    spectral: { fx: 'spec', stamp: 'spectral', fps: 20, still: 1.3 },
    umbra: { fx: 'umbra', stamp: 'umbra', fps: 20, still: 1.2, cut: true, mask: true },
    stained: { fx: 'stain', stamp: 'stained', fps: 15, still: 1.0, cut: true, mask: true, quant: true, body: true },
  };
  const IMG_RAR = { uncommon: 'uncommon', rare: 'rare', prismatic: 'prismatic', super: 'super', diamond: 'diamond', spectral: 'spectral', umbra: 'umbra', stained: 'stained' };
  const available = r => !!SPEC[r];
  const imageRarity = r => (SPEC[r] ? IMG_RAR[r] : '');

  // ─── Grundfunktionen ───
  const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const fract = v => { const f = v - Math.floor(v); return f >= 1 ? 0 : f; };
  const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  function hash(x, y, s) { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul((s || 0) | 0, 1442695041)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function hsv(h, s, v) {
    h = fract(h); const i = Math.floor(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
    const m = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i % 6];
    return [m[0] * 255, m[1] * 255, m[2] * 255];
  }
  function rgb2hsv(r, g, b) {
    r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0;
    if (d) { if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h /= 6; if (h < 0) h += 1; }
    return [h, mx ? d / mx : 0, mx];
  }
  const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const bay = (x, y) => (BAY[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
  const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const scr = (b, f) => 255 - (255 - b) * (255 - f) / 255;

  // ─── Palette: jede gezeichnete Farbe rastet auf die 256 Spielfarben ein (6 Bit je Kanal, träge gefüllt) ───
  const SNAP = new Uint32Array(262144);
  function sn(r, g, b) {
    r = r < 0 ? 0 : r > 255 ? 255 : r | 0; g = g < 0 ? 0 : g > 255 ? 255 : g | 0; b = b < 0 ? 0 : b > 255 ? 255 : b | 0;
    const k = ((r >> 2) << 12) | ((g >> 2) << 6) | (b >> 2);
    let v = SNAP[k];
    if (v) return v;
    const q = root.ppSnapRgb ? root.ppSnapRgb((r & 252) | 2, (g & 252) | 2, (b & 252) | 2) : [r, g, b];
    v = (0xFF000000 | (q[2] << 16) | (q[1] << 8) | q[0]) >>> 0;
    SNAP[k] = v;
    return v;
  }
  /** Palettenfarbe als CSS-Text (fillStyle) */
  function rgbStr(c) { const v = sn(c[0], c[1], c[2]); return 'rgb(' + (v & 255) + ',' + ((v >> 8) & 255) + ',' + ((v >> 16) & 255) + ')'; }
  function put(o, p, c) { const v = sn(c[0], c[1], c[2]), i = p * 4; o[i] = v & 255; o[i + 1] = (v >> 8) & 255; o[i + 2] = (v >> 16) & 255; o[i + 3] = 255; }

  // ─── Geometrie (Bildfeld im Raster; bei Vollbild-Karten die ganze Karte) ───
  let AX0 = 14, AY0 = 34, AW = 122, AH = 80, FULLART = false;
  function setGeo(full) { FULLART = !!full; if (full) { AX0 = 0; AY0 = 0; AW = GW; AH = GH; } else { AX0 = 14; AY0 = 34; AW = 122; AH = 80; } }
  const inArt = (x, y) => x >= AX0 && x < AX0 + AW && y >= AY0 && y < AY0 + AH;
  function putXY(o, x, y, c) { if (x >= 0 && y >= 0 && x < GW && y < GH) put(o, y * GW + x, c); }
  function artLoop(E, fn) { const A = E.A; for (let y = AY0; y < AY0 + AH; y++) for (let x = AX0; x < AX0 + AW; x++) { const p = y * GW + x; if (A[p]) fn(x, y, p, p * 4); } }

  const NZ = (() => { const r = rng(7), a = new Float32Array(64 * 64); for (let i = 0; i < a.length; i++) a[i] = r(); return a; })();
  function noise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const g = (a, b) => NZ[((b & 63) << 6) | (a & 63)];
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return lerp(lerp(g(xi, yi), g(xi + 1, yi), u), lerp(g(xi, yi + 1), g(xi + 1, yi + 1), u), v);
  }
  const fbm = (x, y) => noise(x, y) * .55 + noise(x * 2.1 + 7, y * 2.1 + 3) * .3 + noise(x * 4.3 + 11, y * 4.3 + 5) * .15;

  // ─── Funken ───
  function star(o, cx, cy, size, arm, core) {
    putXY(o, cx, cy, core);
    for (let k = 1; k <= size; k++) { putXY(o, cx + k, cy, arm); putXY(o, cx - k, cy, arm); putXY(o, cx, cy + k, arm); putXY(o, cx, cy - k, arm); }
  }
  const SPARK_SIZE = [0, 1, 2, 3, 2, 1, 0];
  function sparkles(o, t, slots, per, show, pick, arm, core, sizeMul) {
    for (let s = 0; s < slots; s++) {
      const tt = t + s * per / slots * 1.37, k = Math.floor(tt / per), ph = (tt % per) / per;
      if (ph > show) continue;
      const f = Math.floor(ph / show * SPARK_SIZE.length), sz = Math.round(SPARK_SIZE[f] * (sizeMul || 1));
      const pos = pick(k, s); if (!pos) continue;
      star(o, pos[0], pos[1], sz, arm, core);
    }
  }
  function sweepPos(t, per, run, from, to) { const ph = (t % per) / per; return ph > run ? null : from + (to - from) * (ph / run); }

  function voronoi(sites, metric) {
    const id = new Int16Array(NPX), dist = new Float32Array(NPX), n = sites.length;
    const sx = new Float32Array(n), sy = new Float32Array(n);
    for (let i = 0; i < n; i++) { sx[i] = sites[i].x; sy[i] = sites[i].y; }
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      let best = 1e9, bi = 0;
      for (let i = 0; i < n; i++) {
        const dx = x - sx[i], dy = y - sy[i];
        const d = metric === 'l1' ? Math.abs(dx) + Math.abs(dy) : dx * dx + dy * dy;
        if (d < best) { best = d; bi = i; }
      }
      const p = y * GW + x; id[p] = bi; dist[p] = metric === 'l1' ? best : Math.sqrt(best);
    }
    return { id, dist };
  }
  function edges(id, thick) {
    const e = new Uint8Array(NPX);
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      const p = y * GW + x, c = id[p];
      const r = x + 1 < GW && id[p + 1] !== c, d = y + 1 < GH && id[p + GW] !== c;
      const l = x > 0 && id[p - 1] !== c, u = y > 0 && id[p - GW] !== c;
      if (r || d || (thick > 1 && (l || u))) e[p] = 1;
    }
    return e;
  }

  // ═══════════ Icons (5x5 Zellen à 9 Kartenpixel = 45 px wie die Stempel) ═══════════
  const ICON_ROWS = {
    prismatic: ['.##..', '####.', '#####', '.####', '..##.'],
    spectral: ['.###.', '#o#o#', '#####', '#####', '#.#.#'],
    stained: ['..LL.', '.aabL', 'LaabL', 'LcbbL', '.LLL.'],
    umbra: ['..#..', '.#o#.', '#ooo#', '.#o#.', '..#..'],
  };
  function specEvent(t) {
    const slot = Math.floor(t * 2), sp = (t * 2) % 1;
    const on = hash(slot, 1, 5) < .6 && sp < .18 + .3 * hash(slot, 2, 5);
    return { slot, on, big: on && hash(slot, 3, 5) < .3, fr: Math.floor(t * 20) };
  }
  function spectralGlitch(t) {
    const rows = ICON_ROWS.spectral, out = [], ev = specEvent(t), fr = ev.fr, g = ev.on;
    const cell = (i, j, ch) => (ch === 'o' ? [28, 10, 52] : j >= 3 ? [186, 214, 236] : [230, 250, 242]);
    const ink = [];
    for (let j = 0; j < 5; j++) {
      let off = 0; if (g && hash(j, fr, 7) < (ev.big ? .7 : .5)) off = hash(j, fr, 8) < .5 ? -1 : 1;
      for (let i = 0; i < 5; i++) { const ch = rows[j][i]; if (ch === '.') continue; if (g && hash(i + 9, j * 7 + fr, 3) < .12) continue; ink.push([i + off, j, ch, i, j]); }
    }
    if (g) for (const q of ink) { const x = q[0], y = q[1]; if (x - 1 >= 0 && hash(x, y, fr) < .8) out.push([x - 1, y, [255, 40, 150]]); if (x + 1 < 5 && hash(x, y, fr + 5) < .8) out.push([x + 1, y, [40, 230, 255]]); }
    for (const [x, y, ch, i, j] of ink) if (x >= 0 && x < 5) out.push([x, y, g && hash(x, y, fr + 11) < .1 ? [255, 255, 255] : cell(i, j, ch)]);
    return out;
  }
  function iconPixels(kind, t) {
    if (kind === 'spectral') return spectralGlitch(t);
    const rows = ICON_ROWS[kind], out = [];
    for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) {
      const ch = rows[j][i]; if (ch === '.') continue; let c;
      if (kind === 'prismatic') {
        const facet = (i + j) % 3 === 0 ? 1.0 : (i * 2 + j) % 3 === 0 ? 0.72 : 0.88;
        c = hsv(Math.floor(fract((i * 0.11 + j * 0.07) + t * 0.35) * 12) / 12, 0.78, facet);
        if (Math.floor(t * 8 + i * 2 + j) % 19 === 0) c = [255, 255, 255];
      } else if (kind === 'umbra') {
        const blink = (t % 2.4) > 2.25;
        if (ch === 'o') c = blink ? [40, 18, 70] : (i === 2 && j === 2) ? [255, 255, 255] : [150, 90, 230];
        else c = [64, 30, 104];
        if (Math.floor(t * 5 + i + j) % 11 === 0) c = [140, 100, 220];
      } else if (kind === 'stained') {
        if (ch === 'L') { c = [128, 90, 40]; if (((Math.floor(t * 8) + i * 2 + j * 3) % 13) === 0) c = [255, 232, 150]; else if (j === 0 || (i === 0 && j < 4)) c = [176, 128, 60]; }
        else {
          const pal = { a: [250, 188, 36], b: [46, 118, 230], c: [226, 48, 64] }[ch];
          const g = Math.max(0, Math.sin(t * 2.6 - (i + j) * 1.1 + (ch === 'b' ? 1.6 : ch === 'c' ? 3.2 : 0)));
          c = mixc(pal, [255, 255, 238], g > 0.85 ? 0.62 : g > 0.55 ? 0.3 : 0);
        }
      }
      out.push([i, j, c]);
    }
    return out;
  }
  const UD = (x, y) => x + y * 0.9;                          // gemeinsame Lichtlauf-Koordinate (oben links nach unten rechts)
  function glintU(t, per, run) { const p = sweepPos(t, per, run, -12, 356); return p == null ? [] : [p]; }
  function glintAt(t, per, run, n) { const a = []; for (let k = 0; k < n; k++) { const p = sweepPos(t + k * per / n, per, run, -8, 236); if (p != null) a.push(p); } return a; }
  function glintK(d, pos, w) { let k = 0; for (const p of pos) { const v = 1 - Math.abs(d - p) / w; if (v > k) k = v; } return k; }
  // Stempel der Basiskarte (5x5 Zellen) mit Lichtlauf: Uncommon silbern, Rare Regenbogen, Super Rare Stern
  function silverStampPixels(mask, t, pos) {
    const out = [];
    for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) {
      if (!mask[j * 5 + i]) continue;
      const d = pos && pos.length ? (UD((689 + 9 * i + 4.5) / 5, (989 + 9 * j + 4.5) / 5) - pos[0]) / 1.8 : 9; let c = j < 2 ? [88, 96, 118] : j < 4 ? [52, 58, 76] : [34, 38, 52];
      if (Math.abs(d) < 0.9) c = [236, 244, 255]; else if (Math.abs(d) < 1.9) c = [150, 164, 190];
      out.push([i, j, c]);
    }
    return out;
  }
  function rainbowStampPixels(mask, t, pos) {
    const out = [];
    for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) {
      if (!mask[j * 5 + i]) continue;
      const band = pos && pos.length ? (UD((689 + 9 * i + 4.5) / 5, (989 + 9 * j + 4.5) / 5) - pos[0]) / 1.8 : 9, inten = Math.max(0, 1 - Math.abs(band) / 2.8);
      const hue = hsv(Math.floor(fract((i + j) * .13 - t * .5) * 12) / 12, .85, 1);
      let c = mixc(j < 2 ? [66, 58, 96] : [40, 34, 62], hue, .3 + .7 * inten);
      if (Math.abs(band) < .75) c = mixc(c, [255, 255, 255], .55);
      out.push([i, j, c]);
    }
    return out;
  }
  function starStampPixels(sk, t, pos) {
    const out = [], ph = (t % 1.1) / 1.1;
    for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) {
      const q = j * 5 + i; if (!sk.mask[q]) continue;
      const f = glintK((2 * (689 + 9 * i + 4.5) / 5 + (989 + 9 * j + 4.5) / 5) / 2.236, pos || [], 5);
      let w = f > .66 ? .9 : f > .33 ? .55 : f > 0 ? .25 : 0;
      if (ph < .12 && ((i * 3 + j * 5) % 7 === Math.floor(t / 1.1) % 7)) w = 1;
      out.push([i, j, mixc(sk.col[q], [255, 255, 255], w)]);
    }
    return out;
  }
  function diamondStampImage(dm, t, outData, pos) {
    outData.fill(0);
    for (let y = 0; y < 45; y++) for (let x = 0; x < 45; x++) {
      const p = y * 45 + x, q = p * 4; if (!dm.mask[p]) continue;
      const f = glintK((2 * (689 + x) / 5 + (989 + y) / 5) / 2.236, pos || [], 3.4);
      let r = dm.rgb[q], g = dm.rgb[q + 1], b = dm.rgb[q + 2];
      const w = f > .66 ? 1 : f > .33 ? .6 : f > 0 ? .28 : 0;
      r += (255 - r) * w; g += (255 - g) * w; b += (255 - b) * w;
      const v = sn(r, g, b); outData[q] = v & 255; outData[q + 1] = (v >> 8) & 255; outData[q + 2] = (v >> 16) & 255; outData[q + 3] = 255;
    }
    const ph = (t % 1.5) / 1.5; if (ph < .4) { const sz = ph < .1 ? 1 : ph < .2 ? 3 : ph < .3 ? 2 : 1, cx = 20, cy = 18; for (let a = -sz; a <= sz; a++) for (const [px, py] of [[cx + a, cy], [cx, cy + a]]) { const q = (py * 45 + px) * 4; if (dm.mask[py * 45 + px]) { outData[q] = outData[q + 1] = outData[q + 2] = 255; outData[q + 3] = 255; } } }
  }

  // ═══════════ Text-Ebenen: Name/Werte und Regeltext als Pixellisten in der Leinwand-Auflösung (K Pixel je Rasterzelle) ═══════════
  // lay.dark: helle Textfelder (Artefakte) bekommen dunkle Tinte desselben Farbtons
  function lput(lay, lx, ly, c) { if (lx < 0 || ly < 0 || lx >= lay.w || ly >= lay.h) return; const i = (ly * lay.w + lx) * 4, d = lay.data, v = lay.dark ? sn(c[0] * .4, c[1] * .4, c[2] * .4) : sn(c[0], c[1], c[2]); d[i] = v & 255; d[i + 1] = (v >> 8) & 255; d[i + 2] = (v >> 16) & 255; d[i + 3] = 255; }
  function lblock(lay, gx, gy, c) { const U = lay.U, x0 = gx * U - lay.x0, y0 = gy * U - lay.y0; for (let dy = 0; dy < U; dy++) for (let dx = 0; dx < U; dx++) lput(lay, x0 + dx, y0 + dy, c); }
  function lstar(lay, gx, gy, size, arm, core) { lblock(lay, gx, gy, core); for (let k = 1; k <= size; k++) { lblock(lay, gx + k, gy, arm); lblock(lay, gx - k, gy, arm); lblock(lay, gx, gy + k, arm); lblock(lay, gx, gy - k, arm); } }
  const SILVER = ry => (ry < .22 ? [252, 253, 255] : ry < .48 ? [214, 222, 236] : ry < .74 ? [168, 180, 200] : [120, 132, 154]);
  const GOLDNAME = ry => (ry < .22 ? [255, 246, 190] : ry < .5 ? [250, 213, 74] : ry < .75 ? [226, 170, 30] : [176, 118, 8]);
  function eachText(E, which, fn) {
    for (const lay of E.layers) {
      if (which !== 'all' && lay.kind !== which) continue;
      const L = lay.list, U = lay.U;
      for (let k = 0; k < L.length; k += 2) { const lx = L[k], ly = L[k + 1]; fn(lay, lx, ly, Math.floor((ly - lay.gy0) / U) * U / lay.gh, (lx + lay.x0) / U, (ly + lay.y0) / U); }
    }
  }
  function paintName(E, t, ramp, per, run, sparkCol, wide) {
    const pos = glintU(t, per || 3.2, run || .5);
    eachText(E, 'all', (lay, lx, ly, ry, gx, gy) => {
      const body = lay.kind === 'body'; let c = body ? [232, 204, 134] : ramp(ry);
      if (pos.length) {
        const a = Math.abs(UD(gx, gy) - pos[0]), m = body ? 2.4 : 1;
        if (a < 1.5 * m) c = [255, 255, 255]; else if (a < 3.2 * m) c = mixc(c, [255, 255, 255], .6);
        else if (wide && a < wide) {
          const k = 1 - a / wide, X = lx + lay.x0, Y = ly + lay.y0;
          if ((((X >> 1) & 1) * 2 + ((Y >> 1) & 1) + 0.5) / 4 < k * 1.6) c = mixc(c, [255, 250, 228], k > .66 ? .88 : k > .33 ? .66 : .4);
        }
      }
      lput(lay, lx, ly, c);
    });
    const nl = E.layers[0]; if (!nl || nl.kind !== 'name' || !nl.list.length) return;
    const L = nl.list, n = L.length / 2, arm = sparkCol || [190, 214, 255], U = nl.U;
    for (let s2 = 0; s2 < 3; s2++) {
      const tt = t + s2 * .5, per2 = 1.5, k = Math.floor(tt / per2), ph = (tt % per2) / per2; if (ph > .6) continue;
      const f = Math.floor(ph / .6 * SPARK_SIZE.length), q = Math.floor(hash(k, s2, 3) * n);
      lstar(nl, Math.round((L[q * 2] + nl.x0) / U), Math.round((L[q * 2 + 1] + nl.y0) / U), Math.min(2, SPARK_SIZE[f]), arm, [255, 255, 255]);
    }
  }
  function textBand(E, pos, w, hi, mid) {
    if (!pos.length) return;
    eachText(E, 'all', (lay, lx, ly, ry, gx, gy) => { const k = glintK((2 * gx + gy) / 2.236, pos, w); if (k > .62) lput(lay, lx, ly, hi); else if (k > .25 && mid) lput(lay, lx, ly, mid); });
  }
  function rimBand(E, o, pos, w, col, dfn) {
    dfn = dfn || ((x, y) => (2 * x + y) / 2.236);
    if (!pos.length) return;
    const B = E.B;
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      if (!(x < 3 || x >= GW - 3 || y < 3 || y >= GH - 3)) continue;
      const k = glintK(dfn(x, y), pos, w); if (k <= .2) continue;
      const p = y * GW + x, i = p * 4, f = k > .62 ? .85 : k > .4 ? .55 : .3;
      put(o, p, mixc([B[i], B[i + 1], B[i + 2]], col, f));
    }
  }
  function ghostName(E, t) {
    eachText(E, 'all', (lay, lx, ly, ry, gx, gy) => {
      const w = 0.5 + 0.5 * Math.sin(t * 2.4 + gx * 0.45);
      let c = mixc([238, 255, 248], [188, 160, 255], w * .7);
      if ((Math.floor(gy) + Math.floor(t * 5)) % 4 === 0) c = mixc(c, [120, 200, 230], .45);
      lput(lay, lx, ly, c);
    });
  }

  // ═══════════ Der Effekt-Katalog ═══════════
  const FX = {};
  const PASTEL = [[229, 128, 146], [224, 192, 133], [255, 241, 150], [146, 211, 169], [119, 200, 238], [179, 142, 215]];
  const ICE = [[178, 238, 238], [124, 233, 220], [102, 217, 255], [229, 245, 250], [78, 130, 203], [255, 255, 255]];

  // Uncommon: silberner Name und Werte, Lichtlauf über Name, Werte und Icon
  FX.unc = { glint: t => glintU(t, 3.6, .6), frame(E, st, t, o) { paintName(E, t, SILVER, 3.6, .6); } };

  // Rare: Prisma-Strahl über dem Bild, silberner Rahmen, Name/Werte im selben Lauf
  FX.rare = {
    glint: t => glintU(t, 4.6, .72),
    frame(E, st, t, o) {
      const { B, L } = E, pos = glintU(t, 4.6, .72), W = 34;
      artLoop(E, (x, y, p, i) => {
        const u = pos.length ? UD(x, y) - pos[0] : 999, a = Math.abs(u);
        const beam = Math.max(0, 1 - a / W), gate = sstep(.08, .4, L[p]);
        const cov = (0.14 + beam * 0.95) * gate;
        if (bay(x, y) >= cov) return;
        const hq = Math.floor(fract(u * 0.026 + .02) * 14) / 14;
        let c = hsv(hq, beam > .1 ? .95 : .8, clamp(.38 + .95 * L[p]));
        c = mixc([B[i], B[i + 1], B[i + 2]], c, .8);
        if (a < 2.2) c = [255, 255, 255];
        put(o, p, c);
      });
      rimBand(E, o, pos, 5, [236, 242, 255], UD);
      // Silberfunken im Bild: auch in der Ruhephase zwischen den Läufen ist mehr zu sehen als das feine Punktraster
      sparkles(o, t, 5, 1.6, .55, (k, s) => [AX0 + 5 + Math.floor(hash(k, s, 61) * (AW - 10)), AY0 + 5 + Math.floor(hash(k, s, 62) * (AH - 10))], [200, 214, 238], [255, 255, 255], 1);
      paintName(E, t, SILVER, 4.6, .72);
    },
  };

  // Prismatic: Regenbogenkacheln über die ganze Karte (Cracked Ice, „Kräftig“), Text liegt scharf obenauf
  const LV = 12;
  function prismaticPrep(E) {
    const r = rng(11), sites = [], S = 12.5;
    for (let gy = -1; gy * S < GH + S; gy++) for (let gx = -1; gx * S < GW + S; gx++) {
      sites.push({ x: gx * S + (gy & 1) * S * .5 + (r() - .5) * S * .9, y: gy * S + (r() - .5) * S * .9 });
    }
    const v = voronoi(sites, 'l2'), e = edges(v.id, 1), n = sites.length, ph = new Float32Array(n), tilt = new Float32Array(n), lite = new Float32Array(n);
    for (let i = 0; i < n; i++) { ph[i] = r(); tilt[i] = r() * 6.283; lite[i] = r(); }
    const cx = new Float32Array(n), cy = new Float32Array(n), cnt = new Int32Array(n);
    for (let p = 0; p < NPX; p++) { const c = v.id[p]; cx[c] += p % GW; cy[c] += (p / GW) | 0; cnt[c]++; }
    for (let i = 0; i < n; i++) if (cnt[i]) { cx[i] /= cnt[i]; cy[i] /= cnt[i]; }
    return { v, e, n, ph, tilt, lite, cx, cy };
  }
  function prismaticFrame(E, st, t, o, str, share) {
    const { B, L } = E, { v, e, ph, tilt, lite, cx, cy, n } = st;
    if (!st.pre) {
      const outl = new Float32Array(NPX), art = new Uint8Array(NPX);
      for (let p = 0; p < NPX; p++) { outl[p] = .45 + .55 * sstep(.04, .3, L[p]); art[p] = inArt(p % GW, (p / GW) | 0) ? 1 : 0; }
      st.pre = { outl, art, lut: new Uint8Array(n * LV * 3), cellK: new Float32Array(n) };
    }
    const { outl, art, lut, cellK } = st.pre, LVN = LV - 1;
    const sweep = ((t * 0.17) % 1) * (GW + GH + 60) - 30;
    for (let c = 0; c < n; c++) {
      const wave = Math.max(0, 1 - Math.abs((cx[c] + cy[c] * 0.8) - sweep) / 46);
      const sh = Math.max(0, Math.sin(t * 1.4 + ph[c] * 6.283 + tilt[c])), glow = 0.5 * wave + 0.5 * sh * sh * sh;
      const steps = 14, hue = Math.floor(fract(ph[c] + t * 0.045 + (cx[c] - cy[c]) * 0.002) * steps) / steps;
      const sat = 0.86 - glow * .3, act = lite[c] < share ? 1 : .22;
      const k = (0.12 + act * 0.42 + glow * 0.3 * (.4 + act * .6)) * str;
      cellK[c] = k; const gu = clamp((k / str - .5) * 1.2);
      for (let q = 0; q < LV; q++) { const col = hsv(hue, sat, clamp(q / LVN + gu * .3)); const j = (c * LV + q) * 3; lut[j] = col[0]; lut[j + 1] = col[1]; lut[j + 2] = col[2]; }
    }
    for (let p = 0; p < NPX; p++) {
      const i = p * 4, c = v.id[p], x = p % GW, y = (p / GW) | 0;
      let k = cellK[c]; if (!art[p]) k *= .72; k *= outl[p];
      const kq = Math.round(k * 10) / 10, bl = L[p];
      let r = B[i], g = B[i + 1], b = B[i + 2];
      if (kq > 0.04) {
        const q = Math.round(clamp(.2 + .9 * bl, 0, art[p] ? 1 : .86) * LVN), j = (c * LV + q) * 3;
        const m = Math.min(.9, kq); r += (lut[j] - r) * m; g += (lut[j + 1] - g) * m; b += (lut[j + 2] - b) * m;
      }
      if (e[p]) {
        const s = 0.62 * (y >= 118 && y < 197 ? .4 : 1) * (.25 + .75 * str);
        if (y < 118 && str > .6 && hash(x, y, 2) < .35) { r = g = b = 255; } else { r += (255 - r) * s; g += (255 - g) * s; b += (255 - b) * s; }
      }
      const vv = sn(r, g, b); o[i] = vv & 255; o[i + 1] = (vv >> 8) & 255; o[i + 2] = (vv >> 16) & 255; o[i + 3] = 255;
    }
    sparkles(o, t, 7, 1.5, .55, (k, s) => { const c = Math.floor(hash(k, s, 41) * n); return [Math.round(cx[c]), Math.round(cy[c])]; }, [255, 255, 255], [255, 255, 255], 1);
  }
  FX.pris = { prep: E => prismaticPrep(E), frame: (E, st, t, o) => prismaticFrame(E, st, t, o, .5, 1) };

  // Super Rare: Einfach-Schraffur und ein Lichtlauf über Rahmen, Bild, Name, Werte und Stern
  FX.sr = {
    glint: t => glintAt(t, 3.4, .55, 1),
    frame(E, st, t, o) {
      const { B, L } = E, pos = glintAt(t, 3.4, .55, 1);
      artLoop(E, (x, y, p, i) => {
        const gate = sstep(.14, .5, L[p]); if (gate < .05) return;
        const line = ((2 * x + y) % 6 + 6) % 6 < 2;
        const c = PASTEL[Math.floor(fract((x * 0.35 + y * 0.12 - t * 9) / 60) * 6)];
        if (line) put(o, p, mixc([B[i], B[i + 1], B[i + 2]], c, 0.72 * gate));
        if (pos.length && gate > .3 && glintK((2 * x + y) / 2.236, pos, 3.4) > .02) put(o, p, mixc([B[i], B[i + 1], B[i + 2]], [255, 255, 255], .55));
      });
      rimBand(E, o, pos, 5, [255, 246, 190]);
      textBand(E, pos, 4, [255, 252, 225], [255, 232, 140]);
      sparkles(o, t, 5, 1.7, .55, (k, s) => [AX0 + 4 + Math.floor(hash(k, s, 9) * (AW - 8)), AY0 + 4 + Math.floor(hash(k, s, 10) * (AH - 8))], [255, 232, 130], [255, 255, 255], 1);
    },
  };

  // Diamond: Rautengitter in Eisfarben, Knoten funkeln, zwei Lichtläufe
  FX.dia = {
    glint: t => glintAt(t, 1.9, .78, 2),
    frame(E, st, t, o) {
      const { B, L } = E, pos = glintAt(t, 1.9, .78, 2);
      artLoop(E, (x, y, p, i) => {
        const gate = .4 + .6 * sstep(.12, .45, L[p]);   // Untergrenze: auch auf dunkler Kunst bleibt das Rautengitter sichtbar (sonst nur Knotenpunkte = Punktraster)
        const l1 = ((2 * x + y) % 6 + 6) % 6 < 2, l2 = ((2 * x - y) % 6 + 6) % 6 < 2;
        if (!l1 && !l2) { if (gate > .3 && bay(x, y) < .2) put(o, p, mixc([B[i], B[i + 1], B[i + 2]], [40, 120, 200], .32)); return; }
        const node = l1 && l2;
        const wave = glintK((2 * x + y) / 2.236, pos, 12);
        let c = ICE[Math.floor(fract((x * 0.3 + y * 0.2) / 44 - t * 0.18) * 5)];
        let k = (.72 + wave * .28) * gate;
        if (node) { c = [255, 255, 255]; k = Math.min(1, .85 + wave); }
        put(o, p, mixc([B[i], B[i + 1], B[i + 2]], c, k));
      });
      rimBand(E, o, pos, 6, [225, 252, 255]);
      textBand(E, pos, 4.5, [235, 255, 255], [140, 238, 232]);
      sparkles(o, t, 9, 1.3, .55, (k, s) => [AX0 + 4 + Math.floor(hash(k, s, 19) * (AW - 8)), AY0 + 4 + Math.floor(hash(k, s, 20) * (AH - 8))], [124, 233, 220], [255, 255, 255], 1.2);
    },
  };

  // Spectral: Echo-Abbild mit gedrosselten Glitches, Seelenfunken, schwarze Funken
  const BLACK_ARM = [14, 6, 30], BLACK_CORE = [0, 0, 0];
  FX.spec = {
    prep(E) { const r = rng(31), w = []; for (let k = 0; k < 11; k++) w.push({ x: AX0 + 6 + r() * (AW - 12), sp: .07 + r() * .08, ph: r(), amp: 2 + r() * 3 }); return { w }; },
    frame(E, st, t, o) {
      const { B } = E, ev = specEvent(t), gi = ev.fr, on = ev.on, big = ev.big;
      const dx = Math.round(4 * Math.sin(t * .8)), dy = Math.round(1.4 * Math.cos(t * 1.1));
      const inv = (x, y, ch) => { x = clamp(x, AX0, AX0 + AW - 1); y = clamp(y, AY0, AY0 + AH - 1); return 255 - B[(y * GW + x) * 4 + ch]; };
      const rects = [];
      if (on) for (let k = 0; k < (big ? 4 : 2); k++) rects.push({ x: AX0 + Math.floor(hash(ev.slot, k, 21) * (AW - 30)), y: AY0 + Math.floor(hash(ev.slot, k, 22) * (AH - 10)), w: 10 + Math.floor(hash(ev.slot, k, 23) * 22), h: 3 + Math.floor(hash(ev.slot, k, 24) * 6), sx: Math.round((hash(ev.slot, k, 25) - .5) * 26), mode: hash(ev.slot, k, 26) });
      const bh = 3 + Math.floor(hash(ev.slot, 4, 5) * 4);
      artLoop(E, (x, y, p, i) => {
        let sx = 0, split = 0;
        if (on) { const band = Math.floor((y + gi * 3) / bh); if (hash(band, gi >> 1, 5) < (big ? .45 : .3)) { sx = Math.round((hash(band, gi >> 1, 6) - .5) * (big ? 34 : 18)); split = big ? 3 : 2; } }
        else if (hash(y, gi >> 1, 17) < .006) sx = hash(y, gi, 18) < .5 ? -2 : 2;
        for (const rc of rects) if (x >= rc.x && x < rc.x + rc.w && y >= rc.y && y < rc.y + rc.h) { sx += rc.sx; if (rc.mode < .4) split = 2; }
        let r = inv(x + sx + split, y, 0), g = inv(x + sx, y, 1), b = inv(x + sx - split, y, 2);
        const er = inv(x - dx, y - dy, 0), eg = inv(x - dx, y - dy, 1), eb = inv(x - dx, y - dy, 2), el = (er + eg + eb) / 765;
        if (bay(x, y) < .42 && el > .18) { r = scr(r, el * 120 + 20); g = scr(g, el * 255); b = scr(b, el * 220); }
        const e2 = inv(x + dx * 2, y + dy * 2, 0) / 255; if (bay(x + 1, y) < .2 && e2 > .3) { r = scr(r, 160 * e2); b = scr(b, 255 * e2); }
        for (const rc of rects) if (rc.mode > .75 && x >= rc.x && x < rc.x + rc.w && y >= rc.y && y < rc.y + rc.h) { r = 255 - r; g = 255 - g; b = 255 - b; }
        if (on && big && (y + gi) % 4 === 0) { r *= .8; g *= .8; b *= .9; }
        put(o, p, [r, g, b]);
      });
      for (const w of st.w) {
        const life = fract(t * w.sp + w.ph), y = Math.round(AY0 + AH - 2 - life * (AH + 6)), x = Math.round(w.x + w.amp * Math.sin(life * 9 + w.ph * 6));
        if (bay(x, y) < 1 - Math.abs(life - .5) * 1.6) { for (let k = 0; k < 3; k++) putXY(o, x, y + k, k === 0 ? [255, 255, 255] : [206, 232, 255]); putXY(o, x + 1, y + 1, [190, 170, 255]); }
      }
      const pc = on && gi % 2 ? [255, 60, 160] : Math.floor(t * 4) % 6 < 3 ? [120, 90, 220] : [70, 60, 160];
      for (let x = AX0; x < AX0 + AW; x++) { if (E.A[AY0 * GW + x]) putXY(o, x, AY0, pc); if (E.A[(AY0 + AH - 1) * GW + x]) putXY(o, x, AY0 + AH - 1, pc); }
      sparkles(o, t, 7, 1.9, .5, (k, s) => [AX0 + 5 + Math.floor(hash(k, s, 71) * (AW - 10)), AY0 + 5 + Math.floor(hash(k, s, 72) * (AH - 10))], BLACK_ARM, BLACK_CORE, 1.9);
      ghostName(E, t);
    },
  };

  // Umbra: Hintergrund verdunkelt, Schattenrauch steigt von der Silhouette auf, violettes Randlicht (im Pixelraster der Kunst: View.rim)
  function distToS(E, maxd) {
    const S = E.S, d = new Uint8Array(NPX).fill(255), q = [];
    for (let p = 0; p < NPX; p++) if (S[p]) { d[p] = 0; q.push(p); }
    for (let h = 0; h < q.length; h++) { const p = q[h]; if (d[p] >= maxd) continue; for (const np of [p - 1, p + 1, p - GW, p + GW]) if (np >= 0 && np < NPX && d[np] > d[p] + 1) { d[np] = d[p] + 1; q.push(np); } }
    return d;
  }
  const isEdgeS = (S, p) => S[p] && (!S[p - 1] || !S[p + 1] || !S[p - GW] || !S[p + GW]);
  FX.umbra = {
    prep(E) { return { d: distToS(E, 18) }; },
    frame(E, st, t, o) {
      const { B } = E, d = st.d;
      artLoop(E, (x, y, p, i) => {
        let c = [B[i] * .26 + 6, B[i + 1] * .22 + 4, B[i + 2] * .36 + 16];
        const dist = d[p], dens = dist < 255 ? clamp(1 - dist / 17) : 0;
        const n = fbm(x * .085 + t * .25, y * .085 - t * .85), s = clamp(dens * (n * 1.9 - .25) + (bay(x, y) - .5) * .35);
        const lv = s > .62 ? [150, 92, 200] : s > .44 ? [86, 38, 124] : s > .26 ? [44, 18, 70] : s > .12 ? [24, 8, 40] : null;
        if (lv) c = lv;
        put(o, p, c);
      });
      eachText(E, 'all', (lay, lx, ly, ry, gx, gy) => { const w = .5 + .5 * Math.sin(t * 2 + gx * .3); lput(lay, lx, ly, mixc(ry < .5 ? [252, 246, 255] : [226, 212, 252], [176, 128, 240], w * .22)); });
    },
  };

  // ─── Stained Rare ───
  function snapPalette(pal, r, g, b) {
    let best = 1e9, bi = 0; for (let k = 0; k < pal.length; k++) { const q = pal[k], dr = r - q[0], dg = g - q[1], db = b - q[2]; const d = 0.3 * dr * dr + 0.59 * dg * dg + 0.11 * db * db; if (d < best) { best = d; bi = k; } }
    return pal[bi];
  }
  const JEWELS = [[200, 28, 52], [32, 78, 206], [24, 150, 84], [244, 176, 36], [128, 52, 176], [22, 152, 164], [226, 98, 26]];
  const STAIN = { seed: 5, rArt: 9, rArtMin: 5, rFrame: 8.5, rText: 17, minArea: 30, leadCol: [30, 18, 10], leadDark: [20, 12, 8], T: 3 };
  function paletteRgb() {
    if (paletteRgb.v) return paletteRgb.v;
    const P = root.PP_PALETTE || [];
    return (paletteRgb.v = P.map(h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]));
  }
  function stainedBuild(E) {
    const opt = STAIN, { B, L, A, S } = E, r = rng(opt.seed), pal = paletteRgb();
    const g = new Float32Array(NPX);
    for (let y = 1; y < GH - 1; y++) for (let x = 1; x < GW - 1; x++) { const p = y * GW + x; g[p] = Math.abs(L[p + 1] - L[p - 1]) + Math.abs(L[p + GW] - L[p - GW]); }
    const gs = new Float32Array(NPX);
    for (let y = 3; y < GH - 3; y++) for (let x = 3; x < GW - 3; x++) { let s = 0; for (let dy = -3; dy <= 3; dy += 3) for (let dx = -3; dx <= 3; dx += 3) s += g[(y + dy) * GW + x + dx]; gs[y * GW + x] = s / 9; }
    const rad = (x, y) => (inArt(x, y) ? lerp(opt.rArt, opt.rArtMin, clamp(gs[y * GW + x] * 7)) : opt.rFrame);
    const sites = [];
    const tries = Math.round(14000 * (FULLART ? 3.2 : 1));
    // Dart-Throwing mit variablem Radius; Standortliste in einem Gitter, damit der Abstandstest nicht jede Probe gegen alle Standorte laufen lässt
    const CELL = 12, gw = Math.ceil(GW / CELL), gh = Math.ceil(GH / CELL), grid = Array.from({ length: gw * gh }, () => []);
    for (let k = 0; k < tries; k++) {
      const x = r() * GW, y = r() * GH, px = Math.floor(x), py = Math.floor(y), rr = rad(px, py);
      if (!A[py * GW + px] || S[py * GW + px]) continue;
      let ok = true;
      const gx0 = Math.max(0, Math.floor((x - 14) / CELL)), gx1 = Math.min(gw - 1, Math.floor((x + 14) / CELL)), gy0 = Math.max(0, Math.floor((y - 14) / CELL)), gy1 = Math.min(gh - 1, Math.floor((y + 14) / CELL));
      for (let cy = gy0; cy <= gy1 && ok; cy++) for (let cx = gx0; cx <= gx1; cx++) {
        const cl = grid[cy * gw + cx];
        for (let i = 0; i < cl.length; i++) { const q = cl[i], dx = q.x - x, dy = q.y - y, m = Math.min(rr, q.r); if (dx * dx + dy * dy < m * m) { ok = false; break; } }
        if (!ok) break;
      }
      if (ok) { const q = { x, y, r: rr }; sites.push(q); grid[Math.floor(y / CELL) * gw + Math.floor(x / CELL)].push(q); }
    }
    let v = voronoi(sites, 'l2');
    for (let pass = 0; pass < 3; pass++) {
      const area = new Int32Array(sites.length);
      for (let p = 0; p < NPX; p++) if (A[p] && !S[p]) area[v.id[p]]++;
      const keep = sites.filter((q, k) => area[k] >= opt.minArea);
      if (keep.length === sites.length) break;
      sites.length = 0; for (const q of keep) sites.push(q); v = voronoi(sites, 'l2');
    }
    const n = sites.length;
    const sum = new Float64Array(n * 3), cnt = new Int32Array(n), dmax = new Float32Array(n), cx = new Float32Array(n), cy = new Float32Array(n), cn = new Int32Array(n);
    for (let p = 0; p < NPX; p++) { const c = v.id[p], i = p * 4; if (!S[p] && A[p] && A[p - 2] && A[p + 2] && A[p - 2 * GW] && A[p + 2 * GW]) { sum[c * 3] += B[i]; sum[c * 3 + 1] += B[i + 1]; sum[c * 3 + 2] += B[i + 2]; cnt[c]++; } cn[c]++; if (v.dist[p] > dmax[c]) dmax[c] = v.dist[p]; cx[c] += p % GW; cy[c] += (p / GW) | 0; }
    const cellRGB = new Array(n), ph = new Float32Array(n);
    let ar = 0, ag = 0, ab = 0, an = 0;
    for (let p = 0; p < NPX; p++) if (A[p] && !S[p] && L[p] > .12) { ar += B[p * 4]; ag += B[p * 4 + 1]; ab += B[p * 4 + 2]; an++; }
    const baseHue = an ? rgb2hsv(ar / an, ag / an, ab / an)[0] : 0;
    for (let c = 0; c < n; c++) {
      cx[c] /= Math.max(1, cn[c]); cy[c] /= Math.max(1, cn[c]); ph[c] = r();
      let col = cnt[c] ? [sum[c * 3] / cnt[c], sum[c * 3 + 1] / cnt[c], sum[c * 3 + 2] / cnt[c]] : [40, 20, 20];
      const h = rgb2hsv(col[0], col[1], col[2]); col = h[2] < .3 ? hsv(baseHue, .72, clamp(h[2] * 1.3 + .1, .2, .5)) : hsv(h[0], clamp(h[1] * 1.55 + .05), clamp(h[2] * 1.38 + .1, .36, 1));
      const hv = rgb2hsv(col[0], col[1], col[2]), u = hash(c, 21, opt.seed), u2 = hash(c, 23, opt.seed);
      const vTop = hv[2] > .78 ? 1.0 : 1.3, fv = Math.round(lerp(.58, vTop, u) * 8) / 8;
      col = hsv(fract(hv[0] + (u2 - .5) * .05 + 1), clamp(hv[1] * lerp(.9, 1.15, u2)), clamp(hv[2] * fv, .08, 1));
      if (inArt(Math.round(cx[c]), Math.round(cy[c]))) col = [Math.min(255, col[0] * 1.16), Math.min(255, col[1] * 1.16), Math.min(255, col[2] * 1.16)];
      let sn0 = pal.length ? snapPalette(pal, col[0], col[1], col[2]) : col;
      { const h0 = rgb2hsv(col[0], col[1], col[2]), h1 = rgb2hsv(sn0[0], sn0[1], sn0[2]); let dh = Math.abs(h0[0] - h1[0]); dh = Math.min(dh, 1 - dh); if (h0[1] > .2 && (dh > .06 || h1[1] < .15)) sn0 = col.map(q => Math.round(q)); }
      cellRGB[c] = sn0;
    }
    const lead = edges(v.id, 1);
    for (let y = AY0 - 1; y <= AY0 + AH; y++) for (let x = AX0 - 1; x <= AX0 + AW; x++) { const p = y * GW + x; if (p >= 1 && p < NPX - GW && A[p] && (!A[p - 1] || !A[p + 1] || !A[p - GW] || !A[p + GW])) lead[p] = 1; }
    return { v, n, cellRGB, ph, cx, cy, dmax, lead, sites };
  }
  /** Bleiruten für die Interface-Elemente (Namensplatte, Fähigkeitsfelder, Textfeld, Werteleiste); gehen aus demselben Standortnetz hervor wie die Bildzellen */
  function uiLeadBuild(E, st) {
    const opt = STAIN, r = rng(opt.seed + 40), sites = st.sites.map(q => ({ x: q.x, y: q.y, r: q.r || opt.rArt })), rr = opt.rArt, B = E.B, A = E.A;
    const U = new Uint8Array(NPX);
    for (let y = 2; y < GH - 2; y++) for (let x = 2; x < GW - 2; x++) { const p = y * GW + x; if (!A[p]) U[p] = 1; }
    const dA = new Uint8Array(NPX).fill(255), qa = []; for (let p = 0; p < NPX; p++) if (A[p]) { dA[p] = 0; qa.push(p); }
    for (let h = 0; h < qa.length; h++) { const p = qa[h]; if (dA[p] >= 36) continue; for (const np of [p - 1, p + 1, p - GW, p + GW]) if (np >= 0 && np < NPX && dA[np] > dA[p] + 1) { dA[np] = dA[p] + 1; qa.push(np); } }
    const dArt = st.v.dist;
    const captures = (x, y) => { const R = 22, x0 = Math.max(0, Math.floor(x - R)), x1 = Math.min(GW - 1, Math.ceil(x + R)), y0 = Math.max(0, Math.floor(y - R)), y1 = Math.min(GH - 1, Math.ceil(y + R));
      for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) { const q = yy * GW + xx; if (!A[q]) continue; const dx = xx - x, dy = yy - y; if (dx * dx + dy * dy < (dArt[q] + 0.5) * (dArt[q] + 0.5)) return true; }
      return false; };
    const CELL = 12, gw = Math.ceil(GW / CELL), gh = Math.ceil(GH / CELL), grid = Array.from({ length: gw * gh }, () => []);
    for (const q of sites) grid[Math.min(gh - 1, Math.floor(q.y / CELL)) * gw + Math.min(gw - 1, Math.floor(q.x / CELL))].push(q);
    for (let k = 0; k < 60000; k++) {
      const x = r() * GW, y = r() * GH, p = Math.floor(y) * GW + Math.floor(x); if (!U[p] || dA[p] < 2 || (dA[p] <= 34 && captures(x, y))) continue;   // weiter als 34 Zellen vom Bildfeld kann keine Bildzelle den Punkt einfangen (Radius 22 + größte Zelle)
      let ok = true;
      const gx0 = Math.max(0, Math.floor((x - 14) / CELL)), gx1 = Math.min(gw - 1, Math.floor((x + 14) / CELL)), gy0 = Math.max(0, Math.floor((y - 14) / CELL)), gy1 = Math.min(gh - 1, Math.floor((y + 14) / CELL));
      for (let cy = gy0; cy <= gy1 && ok; cy++) for (let cx = gx0; cx <= gx1; cx++) {
        const cl = grid[cy * gw + cx];
        for (let i = 0; i < cl.length; i++) { const q = cl[i], dx = q.x - x, dy = q.y - y, m = Math.min(rr, q.r); if (dx * dx + dy * dy < m * m) { ok = false; break; } }
        if (!ok) break;
      }
      if (ok) { const q = { x, y, r: rr }; sites.push(q); grid[Math.floor(y / CELL) * gw + Math.floor(x / CELL)].push(q); }
    }
    const v2 = voronoi(sites, 'l2'), e = edges(v2.id, 1);
    // Zellen mit Text bekommen keine Linie (die Buchstaben liegen obenauf), ebenso Zellen mit Symbolen (Herz, Schwert, Seltenheits-Icon)
    const txt = new Uint8Array(NPX);
    for (const lay of E.layers0) { const L = lay.list, UN = lay.U; for (let k = 0; k < L.length; k += 2) { const gx = Math.floor((L[k] + lay.x0) / UN), gy = Math.floor((L[k + 1] + lay.y0) / UN); if (gx >= 0 && gy >= 0 && gx < GW && gy < GH) txt[gy * GW + gx] = 1; } }
    // zusammenhängende Elemente (Fläche ohne Bildfeld) und ihre Randfarbe (dunkelstes Viertel der Randpixel)
    const comp = new Int32Array(NPX).fill(-1), cols = [], means = [];
    for (let p0 = 0; p0 < NPX; p0++) {
      if (!U[p0] || comp[p0] >= 0) continue;
      const id = cols.length, q = [p0]; comp[p0] = id; const per = []; let mr = 0, mg = 0, mb = 0, mn = 0;
      for (let h = 0; h < q.length; h++) {
        const p = q[h]; let edge = false;
        for (const np of [p - 1, p + 1, p - GW, p + GW]) { if (np < 0 || np >= NPX || !U[np]) edge = true; else if (comp[np] < 0) { comp[np] = id; q.push(np); } }
        if (edge) per.push(p);
        if (!txt[p]) { mr += B[p * 4]; mg += B[p * 4 + 1]; mb += B[p * 4 + 2]; mn++; }
      }
      means.push(mn ? [mr / mn, mg / mn, mb / mn] : [0, 0, 0]);
      const lum = p => B[p * 4] * .3 + B[p * 4 + 1] * .59 + B[p * 4 + 2] * .11, pp = per.length ? per : q;
      pp.sort((a, b) => lum(a) - lum(b)); const n = Math.max(1, Math.floor(pp.length * .25)); let rs = 0, gs = 0, bs = 0;
      for (let k = 0; k < n; k++) { const p = pp[k]; rs += B[p * 4]; gs += B[p * 4 + 1]; bs += B[p * 4 + 2]; }
      cols.push([rs / n, gs / n, bs / n]);
    }
    // Symbole (Herz, Schwert, Seltenheits-Icon, Schulen): Farbe weicht deutlich von der Fläche des Elements ab; sie bekommen keine Linie
    const symb = new Uint8Array(NPX);
    for (let p = 0; p < NPX; p++) { if (!U[p] || txt[p]) continue; const m = means[comp[p]], dd = Math.abs(B[p * 4] - m[0]) + Math.abs(B[p * 4 + 1] - m[1]) + Math.abs(B[p * 4 + 2] - m[2]); if (dd > 130) symb[p] = 1; }
    const symbD = new Uint8Array(NPX); for (let p = 0; p < NPX; p++) if (symb[p]) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const q = p + dy * GW + dx; if (q >= 0 && q < NPX) symbD[q] = 1; }
    const idx = [], col = [];
    for (let p = 0; p < NPX; p++) if (U[p] && e[p] && !symbD[p]) { idx.push(p); const c = cols[comp[p]]; col.push(sn(c[0], c[1], c[2])); }
    return { idx: Int32Array.from(idx), col: Uint32Array.from(col) };
  }
  const EP_WARM = [255, 238, 176], EP_WHITE = [255, 255, 245];
  function starA(o, E, cx, cy, size, arm, core) {
    const ok = (x, y) => x >= 0 && y >= 0 && x < GW && y < GH && E.A[y * GW + x];
    if (ok(cx, cy)) putXY(o, cx, cy, core);
    for (let k = 1; k <= size; k++) for (const [dx, dy] of [[k, 0], [-k, 0], [0, k], [0, -k]]) if (ok(cx + dx, cy + dy)) putXY(o, cx + dx, cy + dy, arm);
  }
  FX.stain = {
    prep(E) {
      const t0 = performance.now(), st = stainedBuild(E), t1 = performance.now();
      st.d = distToS(E, 24); st.edge = [];
      const S = E.S; for (let p = GW; p < NPX - GW; p++) if (isEdgeS(S, p)) st.edge.push(p);
      const t2 = performance.now();
      st.ui = uiLeadBuild(E, st);
      stats.prep = [Math.round(t1 - t0), Math.round(t2 - t1), Math.round(performance.now() - t2)];
      return st;
    },
    frame(E, st, t, o) {
      const opt = STAIN, T = opt.T, ph = (t % T) / T, TAU = 6.283185, { v, n, cellRGB, ph: cph, cx, cy, dmax, lead, d } = st, { A, S } = E;
      // Glasscheiben: wandernder Lichtstreif + Flackern, Helligkeit in Stufen, gehämmertes Glas per Bayer-Raster
      const beamPos = (t % T) / T * (GW + GH + 90) - 40;
      const k = new Float32Array(n);
      for (let c = 0; c < n; c++) {
        const wave = Math.max(0, 1 - Math.abs((cx[c] + cy[c] * 0.9) - beamPos) / 34);
        const flick = Math.pow(Math.max(0, Math.sin(t * TAU / T + cph[c] * TAU)), 4);
        k[c] = 0.78 + 0.16 * flick + 0.62 * wave;
      }
      const LC = opt.leadCol;
      for (let y = AY0; y < AY0 + AH; y++) for (let x = AX0; x < AX0 + AW; x++) {
        const p = y * GW + x; if (!A[p]) continue;
        if (lead[p]) { put(o, p, LC); continue; }
        const c = v.id[p], col = cellRGB[c], rel = dmax[c] ? v.dist[p] / dmax[c] : 0;
        let m = k[c] * (1.12 - 0.34 * rel * rel);
        m = Math.round(m * 7) / 7;
        m += (bay(x, y) - .5) * .09;
        let r = col[0] * m, g = col[1] * m, b = col[2] * m;
        if (m > 1.04) { const w = Math.min(1, (m - 1.04) * 2.2); r = lerp(r, 255, w * .6); g = lerp(g, 246, w * .6); b = lerp(b, 214, w * .55); }
        put(o, p, [r, g, b]);
      }
      // Bleiruten der Interface-Elemente in der Randfarbe des jeweiligen Elements
      const ui = st.ui; for (let q = 0; q < ui.idx.length; q++) { const p = ui.idx[q], i = p * 4, vv = ui.col[q]; o[i] = vv & 255; o[i + 1] = (vv >> 8) & 255; o[i + 2] = (vv >> 16) & 255; o[i + 3] = 255; }
      const mixPx = (p, col, w) => { const i = p * 4; put(o, p, [o[i] + (col[0] - o[i]) * w, o[i + 1] + (col[1] - o[i + 1]) * w, o[i + 2] + (col[2] - o[i + 2]) * w]); };
      const R = 7 + 4 * (.5 + .5 * Math.sin(TAU * ph)), gl = glintU(t, T, .5), sweep = gl.length ? gl[0] : -999;
      for (let y = AY0; y < AY0 + AH; y++) for (let x = AX0; x < AX0 + AW; x++) {
        const p = y * GW + x; if (!A[p] || S[p] || lead[p]) continue;
        const dist = d[p];
        if (dist < 255 && dist <= R + 5) { const h = clamp(1 - dist / (R + 5)); if (bay(x, y) < h * h * .95 + (dist < 3 ? .25 : 0)) mixPx(p, EP_WARM, dist < 3 ? .62 : .46); }
        const dd = Math.abs((x + y * .9) - sweep);
        if (dd < 12) { const kk = 1 - dd / 12; if (dd < 2.2) mixPx(p, EP_WHITE, .5); else if (bay(x, y) < kk * .85) mixPx(p, EP_WARM, .38); }
      }
      const per = T / 2, slots = 18;
      for (let s = 0; s < slots; s++) {
        const tt = (t + s * per / slots * 1.37) % T, kk = Math.floor(tt / per), ph2 = (tt % per) / per; if (ph2 > .62) continue;
        const sz = SPARK_SIZE[Math.floor(ph2 / .62 * SPARK_SIZE.length)];
        let pos = null; for (let tr = 0; tr < 40 && !pos; tr++) { const x = AX0 + Math.floor(hash(kk, s, tr) * AW), y = AY0 + Math.floor(hash(kk, s, tr + 77) * AH), p = y * GW + x; if (A[p] && !S[p] && !lead[p] && d[p] > 3 && y < 120) pos = [x, y]; }
        if (pos) starA(o, E, pos[0], pos[1], sz, [255, 226, 120], [255, 255, 255]);
      }
      const Ed = st.edge;
      if (Ed.length) for (let s = 0; s < 8; s++) {
        const tt = (t + s * per / 8 * 1.13) % T, kk = Math.floor(tt / per), ph2 = (tt % per) / per; if (ph2 > .5) continue;
        const sz = SPARK_SIZE[Math.floor(ph2 / .5 * SPARK_SIZE.length)], q = Ed[Math.floor(hash(kk, s, 211) * Ed.length)], x = q % GW, y = (q / GW) | 0;
        starA(o, E, x, y, Math.min(2, sz), [196, 232, 255], [255, 255, 255]);
      }
      // goldener Name und Werte, Regeltext in Goldton, der breite Lichtstreif der Glasscheiben nimmt den Text mit
      paintName(E, t, GOLDNAME, T, .5, [255, 226, 140]);
      eachText(E, 'all', (lay, lx, ly, ry, gx, gy) => {
        const w = Math.max(0, 1 - Math.abs(UD(gx, gy) - beamPos) / 34); if (w <= 0) return;
        const X = lx + lay.x0, Y = ly + lay.y0;
        if ((((X >> 1) & 1) * 2 + ((Y >> 1) & 1) + 0.5) / 4 >= w * 1.5) return;
        const i = (ly * lay.w + lx) * 4, dd = lay.data, cur = [dd[i], dd[i + 1], dd[i + 2]];
        lput(lay, lx, ly, mixc(cur, [255, 250, 228], w > .75 ? .8 : w > .5 ? .6 : w > .25 ? .42 : .26));
      });
    },
  };

  // ═══════════ Motiv-Masken (public/cardgen/masks.bin, gebaut von scripts/build-masks.js) ═══════════
  let maskIndex = null, maskBuf = null, maskPromise = null;
  function loadMasks() {
    if (maskPromise) return maskPromise;
    maskPromise = fetch('/cardgen/masks.bin').then(r => { if (!r.ok) throw new Error('masks.bin ' + r.status); return r.arrayBuffer(); }).then(ab => {
      const u = new Uint8Array(ab); let p = 4;
      if (u[0] !== 0x50 || u[1] !== 0x50 || u[2] !== 0x4d || u[3] !== 0x31) throw new Error('masks.bin: falsches Format');
      const vi = () => { let v = 0, s = 1, b; do { b = u[p++]; v += (b & 127) * s; s *= 128; } while (b & 128); return v; };
      const skipRuns = () => { const n = vi(); for (let i = 0; i < n; i++) vi(); };
      const idx = new Map(), dec = new TextDecoder(), n = vi();
      for (let i = 0; i < n; i++) { const nl = vi(), name = dec.decode(u.subarray(p, p + nl)); p += nl; idx.set(name, p); vi(); vi(); skipRuns(); skipRuns(); }
      maskBuf = u; maskIndex = idx; return true;
    }).catch(err => { console.warn('[rarity-fx] Masken nicht ladbar:', err && err.message); maskPromise = null; return false; });
    return maskPromise;
  }
  const maskCache = new Map();
  /** Maske einer Karte: { w, h, mn: Uint8Array(w*h) (1 = Motiv), lift: Uint8Array | null } oder null */
  function maskOf(name) {
    if (!maskIndex || !maskIndex.has(name)) return null;
    if (maskCache.has(name)) return maskCache.get(name);
    const u = maskBuf; let p = maskIndex.get(name);
    const vi = () => { let v = 0, s = 1, b; do { b = u[p++]; v += (b & 127) * s; s *= 128; } while (b & 128); return v; };
    const w = vi(), h = vi(), expand = () => { const n = vi(), m = new Uint8Array(w * h); let pos = 0, v = 0; for (let i = 0; i < n; i++) { const l = vi(); if (v) m.fill(1, pos, Math.min(w * h, pos + l)); pos += l; v ^= 1; } return n ? m : null; };
    const mn = expand(), lift = expand();
    const out = { w, h, mn: mn || new Uint8Array(w * h), lift };
    maskCache.set(name, out);
    return out;
  }
  const hasMask = name => !!(maskIndex && maskIndex.has(name));

  // ═══════════ Umgebung je Karte (K-unabhängig) und Ansicht (K Pixel je Rasterzelle) ═══════════
  const cv2d = (w, h, rf) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d', rf ? { willReadFrequently: true } : undefined)]; };
  function readGrid(img) {
    const [c, g] = cv2d(GW, GH, true); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, 0, GW, GH);
    return g.getImageData(0, 0, GW, GH).data;
  }
  function imgReady(img) { return !!img && img.complete && img.naturalWidth >= 500 && !/^data:/.test(img.currentSrc || ''); }
  /** Variante der Karte aus der Bild-URL lesen (?ohne=hp,atk&lv=2&kost=3, Skin) — wie sie der Karten-Shim bekommen hat */
  function variantOfImg(img) {
    const shim = root.CardImageShim, m = shim && shim.parse && shim.parse(img.src);
    if (!m) return {};
    const v = {};
    if (m.ohne) { if (m.ohne.includes('hp')) v.noHp = true; if (m.ohne.includes('atk')) v.noAtk = true; }
    if (m.lv != null) v.lv = m.lv;
    if (m.kost != null) v.kost = m.kost;
    if (m.kind === 'skin') v.skin = (root.__cardShimSkinBase && m.stem && Object.keys(root.__cardShimSkinBase).find(k => k.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim() === m.stem.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim())) || m.stem;
    return v;
  }
  const variantKey = v => (v.noHp ? 'oh' : '') + (v.noAtk ? 'oa' : '') + (v.lv != null ? 'l' + v.lv : '') + (v.kost != null ? 'k' + v.kost : '') + (v.hp != null ? 'h' + v.hp : '') + (v.skin ? 's' + v.skin : '');

  const coreCache = new Map();     // Schlüssel -> core (LRU)
  function stampInfo(img) {
    const [c, g] = cv2d(45, 45, true); g.imageSmoothingEnabled = false; g.drawImage(img, 689 * img.naturalWidth / 750, 989 * img.naturalWidth / 750, 45 * img.naturalWidth / 750, 45 * img.naturalWidth / 750, 0, 0, 45, 45);
    const d = g.getImageData(0, 0, 45, 45).data, mask = [], star = { mask: [], col: [] }, dm = { mask: new Uint8Array(45 * 45), rgb: d };
    for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) {
      const q = ((j * 9 + 4) * 45 + i * 9 + 4) * 4, r = d[q], gg = d[q + 1], b = d[q + 2];
      mask.push(r + gg + b < 90 ? 1 : 0);
      const gold = r > 200 && gg > 150 && b < 170 && r - b > 90; star.mask.push(gold ? 1 : 0); star.col.push([r, gg, b]);
    }
    for (let q = 0; q < 45 * 45; q++) { const r = d[q * 4], gg = d[q * 4 + 1], b = d[q * 4 + 2]; dm.mask[q] = (gg > 150 && b > 150 && r < 215 && Math.abs(gg - b) < 45) ? 1 : 0; }
    return { mask, star, dm };
  }
  function cleanSubject(S, A) {
    const fill = (isT, minSize, setTo) => {
      const seen = new Uint8Array(NPX);
      for (let p0 = 0; p0 < NPX; p0++) {
        if (seen[p0] || !isT(p0)) continue;
        const q = [p0]; seen[p0] = 1;
        for (let h = 0; h < q.length; h++) { const p = q[h], x = p % GW, y = (p / GW) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue; const np = ny * GW + nx; if (!seen[np] && isT(np)) { seen[np] = 1; q.push(np); } } }
        if (q.length < minSize) for (const p of q) S[p] = setTo;
      }
    };
    fill(p => S[p] === 1, 30, 0);
    fill(p => A[p] === 1 && S[p] === 0, 40, 1);
  }
  /** Maske als Raster-Canvas (weiss auf durchsichtig, w x h Kunstpixel) */
  function maskCanvas(e) {
    const [c, g] = cv2d(e.w, e.h); const im = g.createImageData(e.w, e.h);
    for (let p = 0; p < e.w * e.h; p++) { im.data[p * 4] = im.data[p * 4 + 1] = im.data[p * 4 + 2] = 255; im.data[p * 4 + 3] = e.mn[p] ? 255 : 0; }
    g.putImageData(im, 0, 0); return c;
  }
  async function buildCore(card, rarity, img, variant) {
    const sp = SPEC[rarity], CR = root.CardRender;
    const geo = CR.geometryOf(card), A = CR.artGrid(geo.type);
    let e = null;
    if (sp.mask) { await loadMasks(); e = maskOf(card.name); if (!e) return null; }
    setGeo(geo.full);
    const B = readGrid(img), L = new Float32Array(NPX);
    for (let p = 0; p < NPX; p++) L[p] = (0.299 * B[p * 4] + 0.587 * B[p * 4 + 1] + 0.114 * B[p * 4 + 2]) / 255;
    const core = { rarity, sp, full: geo.full, type: geo.type, A, B, L, S: null, e, st: null, stamp: stampInfo(img), card, variant };
    // Text-Ebenen (K-unabhängige Masken in Kartengröße)
    core.masks = CR.textMasks(card, variant);
    if (sp.mask) {
      const [mc] = [maskCanvas(e)], [gc, gg] = cv2d(GW, GH, true); gg.imageSmoothingEnabled = false;
      if (geo.full) gg.drawImage(mc, 0, 0, GW, GH); else gg.drawImage(mc, 14, 34, 122, 80);
      const gd = gg.getImageData(0, 0, GW, GH).data, S = new Uint8Array(NPX);
      for (let p = 0; p < NPX; p++) S[p] = gd[p * 4 + 3] > 127 ? 1 : 0;
      cleanSubject(S, A); core.S = S; core.maskCv = mc;
    }
    return core;
  }
  // Text-Ebenen in Leinwand-Auflösung: Tinte (alpha > 100) in Zeilengruppen
  function inkLayers(maskCv, K, kindOf, gap, clearRects, minusCv) {
    const W = GW * K, H = GH * K, [c, g] = cv2d(W, H, true);
    g.imageSmoothingEnabled = K !== 5; g.imageSmoothingQuality = 'high'; g.drawImage(maskCv, 0, 0, W, H);
    if (minusCv) { g.globalCompositeOperation = 'destination-out'; g.drawImage(minusCv, 0, 0, W, H); g.globalCompositeOperation = 'source-over'; }
    for (const r of clearRects || []) g.clearRect(r[0] * K / 5, r[1] * K / 5, r[2] * K / 5, r[3] * K / 5);
    const d = g.getImageData(0, 0, W, H).data, rows = new Array(H);
    for (let y = 0; y < H; y++) { let has = false; for (let x = 0, o = y * W * 4 + 3; x < W; x++, o += 4) if (d[o] > 100) { has = true; break; } rows[y] = has; }
    const groups = []; let y0 = -1, last = -99;
    for (let y = 0; y < H; y++) if (rows[y]) { if (y0 < 0) y0 = y; else if (y - last > gap * K / 5) { groups.push([y0, last]); y0 = y; } last = y; }
    if (y0 >= 0) groups.push([y0, last]);
    const out = [];
    groups.forEach(([a, b], gi) => {
      let x0 = W, x1 = -1; const list = [];
      for (let y = a; y <= b; y++) for (let x = 0, o = (y * W) * 4 + 3; x < W; x++, o += 4) if (d[o] > 100) { if (x < x0) x0 = x; if (x > x1) x1 = x; }
      const w = x1 - x0 + 1, h = b - a + 1;
      for (let y = a; y <= b; y++) for (let x = x0; x <= x1; x++) if (d[(y * W + x) * 4 + 3] > 100) list.push(x - x0, y - a);
      const [cv, cx] = cv2d(w, h);
      out.push({ kind: kindOf(gi, a), x0, y0: a, w, h, U: K, list: Int16Array.from(list), gy0: 0, gh: h, cv, cx, im: cx.createImageData(w, h), data: null });
      out[out.length - 1].data = out[out.length - 1].im.data;
    });
    return out;
  }
  function stampRects(K) { return [[683, 984, 67, 66]]; }
  /** Textebenen auf hellem Grund (gelbe Artefakt-Karten): `dark` — die Effektfarben werden abgedunkelt, sonst wäre heller Text (Silber, Gold, Weiss) auf Pergament unlesbar.
   *  Gemessen wird der Grund des Basisbildes zwischen den Buchstaben (nicht die Tinte selbst). */
  function markLightPlates(layers, img, K) {
    const nw = img.naturalWidth, f = nw / (GW * K);
    for (const lay of layers) {
      const [c, g] = cv2d(lay.w, lay.h, true); g.imageSmoothingEnabled = true;
      g.drawImage(img, lay.x0 * f, lay.y0 * f, lay.w * f, lay.h * f, 0, 0, lay.w, lay.h);
      const d = g.getImageData(0, 0, lay.w, lay.h).data, ink = new Uint8Array(lay.w * lay.h), L = lay.list;
      for (let k = 0; k < L.length; k += 2) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const x = L[k] + dx, y = L[k + 1] + dy; if (x >= 0 && y >= 0 && x < lay.w && y < lay.h) ink[y * lay.w + x] = 1; }
      let s = 0, n = 0; for (let q = 0; q < ink.length; q += 3) if (!ink[q]) { s += .299 * d[q * 4] + .587 * d[q * 4 + 1] + .114 * d[q * 4 + 2]; n++; }
      lay.dark = n > 20 && s / n / 255 > .66;
    }
  }
  /** Ansicht: alles, was von der Pixelgröße der Leinwand abhängt */
  function buildView(core, img, K) {
    const sp = core.sp, W = GW * K, H = GH * K, CR = root.CardRender;
    const nameL = inkLayers(core.masks.name, K, (gi, y) => (gi === 0 && y < 150 * K / 5 ? 'name' : 'stats'), 14, stampRects(K));
    const bodyL = sp.body ? inkLayers(core.masks.body, K, () => 'body', 40, null, core.masks.name) : [];
    const layers = nameL.concat(bodyL);
    markLightPlates(layers, img, K);
    const view = { K, W, H, layers, layers0: layers, holes: null, cut: null, rim: null };
    if (sp.textTop) {   // Text bleibt scharf: Löcher in der Effekt-Ebene genau auf der Tinte (Name, Werte, Regeltext)
      const [hc, hg] = cv2d(W, H); hg.imageSmoothingEnabled = K !== 5; hg.drawImage(core.masks.name, 0, 0, W, H); hg.drawImage(core.masks.body, 0, 0, W, H);
      // Alpha hart schneiden (Pixelkanten): jede Tinte mit alpha > 100 wird ganz durchsichtig
      const id = hg.getImageData(0, 0, W, H), d = id.data; for (let i = 3; i < d.length; i += 4) d[i] = d[i] > 100 ? 255 : 0; hg.putImageData(id, 0, 0);
      view.holes = hc;
    }
    if (sp.cut) {
      const e = core.e, ax = core.full ? 0 : 14 * K, ay = core.full ? 0 : 34 * K, aw = core.full ? W : 122 * K, ah = core.full ? H : 80 * K;
      const sx = core.full ? 0 : 70 * img.naturalWidth / 750, sy = core.full ? 0 : 170 * img.naturalWidth / 750, sw = core.full ? img.naturalWidth : 610 * img.naturalWidth / 750, sh = core.full ? img.naturalHeight : 400 * img.naturalWidth / 750;
      const [cut, cg] = cv2d(aw, ah, true); cg.imageSmoothingEnabled = false;
      cg.drawImage(core.maskCv, 0, 0, aw, ah); cg.globalCompositeOperation = 'source-in'; cg.drawImage(img, sx, sy, sw, sh, 0, 0, aw, ah);
      if (e.lift) {   // Regentropfen heller: die Farbe des Kunstpixels, 70 % zu Eisweiss
        cg.globalCompositeOperation = 'source-over';
        const cw = aw / e.w, ch = ah / e.h, Lc = [205, 248, 255], tt = 0.7, [bc, bx] = cv2d(aw, ah, true); bx.imageSmoothingEnabled = false; bx.drawImage(img, sx, sy, sw, sh, 0, 0, aw, ah);
        const bd = bx.getImageData(0, 0, aw, ah).data;
        for (let q = 0; q < e.lift.length; q++) {
          if (!e.lift[q]) continue; const xx = q % e.w, yy = (q / e.w) | 0, px = Math.round(xx * cw), py = Math.round(yy * ch), pw = Math.ceil(cw), ph = Math.ceil(ch);
          const o = ((py + (ph >> 1)) * aw + px + (pw >> 1)) * 4; if (o < 0 || o >= bd.length) continue;
          const v = sn(bd[o] * (1 - tt) + Lc[0] * tt, bd[o + 1] * (1 - tt) + Lc[1] * tt, bd[o + 2] * (1 - tt) + Lc[2] * tt);
          cg.fillStyle = 'rgb(' + (v & 255) + ',' + ((v >> 8) & 255) + ',' + ((v >> 16) & 255) + ')'; cg.fillRect(px, py, pw, ph);
        }
      }
      view.cut = { cv: cut, x: ax, y: ay };
      if (sp.fx === 'umbra') {   // Randlicht im Pixelraster der Kunst (ein Kunstpixel breit), direkt um das Motiv; zwei Zustände (Puls)
        view.rim = [0, 1].map(pu => {
          const [rc, rg] = cv2d(W, H), cA = rgbStr(pu ? [190, 130, 250] : [150, 100, 235]), cB = rgbStr(pu ? [104, 56, 176] : [86, 38, 124]), cw = aw / e.w, ch = ah / e.h, mn = e.mn;
          for (let yy = 0; yy < e.h; yy++) for (let xx = 0; xx < e.w; xx++) {
            if (mn[yy * e.w + xx]) continue; let nb = false;
            if (xx > 0 && mn[yy * e.w + xx - 1]) nb = true; if (xx < e.w - 1 && mn[yy * e.w + xx + 1]) nb = true; if (yy > 0 && mn[(yy - 1) * e.w + xx]) nb = true; if (yy < e.h - 1 && mn[(yy + 1) * e.w + xx]) nb = true;
            if (!nb) continue;
            if (core.full) { const gx = Math.min(GW - 1, Math.floor((xx + .5) / e.w * GW)), gy = Math.min(GH - 1, Math.floor((yy + .5) / e.h * GH)); if (!core.A[gy * GW + gx]) continue; }
            rg.fillStyle = ((xx + yy + pu) & 1) ? cA : cB; rg.fillRect(ax + Math.round(xx * cw), ay + Math.round(yy * ch), Math.ceil(cw), Math.ceil(ch));
          }
          return rc;
        });
      }
    }
    return view;
  }
  /** Glas im Pixelraster der Kunst: je Kunstpixel eine Farbe (dunkle Pixel = Bleirute), auf der Leinwand der Karte (nur Stained).
   *  Die Zellen sind je Ansicht einmal vorberechnet (view.qc); jede Zelle liest und schreibt nur ihr eigenes Rechteck (daher an Ort und Stelle). */
  function quantize(core, view, g) {
    const e = core.e, K = view.K, full = core.full, ox = full ? 0 : 14 * K, oy = full ? 0 : 34 * K, bw = full ? view.W : 122 * K, bh = full ? view.H : 80 * K;
    if (!view.qc) {
      const sx = bw / e.w, sy = bh / e.h, A = core.A, qc = [];
      for (let yy = 0; yy < e.h; yy++) for (let xx = 0; xx < e.w; xx++) {
        const x0 = Math.round(xx * sx), x1 = Math.min(bw, Math.round((xx + 1) * sx)), y0 = Math.round(yy * sy), y1 = Math.min(bh, Math.round((yy + 1) * sy)); if (x1 <= x0 || y1 <= y0) continue;
        if (full) { const gx = Math.min(GW - 1, Math.floor((x0 + x1) / 2 / K)), gy = Math.min(GH - 1, Math.floor((y0 + y1) / 2 / K)); if (!A[gy * GW + gx]) continue; }
        qc.push(x0, x1, y0, y1);
      }
      view.qc = Int32Array.from(qc);
    }
    const id = g.getImageData(ox, oy, bw, bh), D = id.data, qc = view.qc;
    for (let q = 0; q < qc.length; q += 4) {
      const x0 = qc[q], x1 = qc[q + 1], y0 = qc[q + 2], y1 = qc[q + 3];
      let nl = 0, n = 0, lr = 0, lg = 0, lb = 0;
      for (let y = y0; y < y1; y++) for (let x = x0, i = (y * bw + x0) * 4; x < x1; x++, i += 4) { if (!D[i + 3]) continue; n++; if (D[i] + D[i + 1] + D[i + 2] < 165) { nl++; lr += D[i]; lg += D[i + 1]; lb += D[i + 2]; } }
      if (!n) continue;
      let r, gc, b;
      if (nl / n >= 0.32) { r = lr / nl; gc = lg / nl; b = lb / nl; }
      else {
        const cx = (x0 + x1) >> 1, cy = (y0 + y1) >> 1; let best = null;
        for (let dy = -2; dy <= 2 && !best; dy++) for (let dx = -2; dx <= 2; dx++) { const xx2 = Math.min(x1 - 1, Math.max(x0, cx + dx)), yy2 = Math.min(y1 - 1, Math.max(y0, cy + dy)), i = (yy2 * bw + xx2) * 4; if (D[i + 3] && D[i] + D[i + 1] + D[i + 2] >= 165) { best = i; break; } }
        if (best === null) best = (((y0 + y1) >> 1) * bw + ((x0 + x1) >> 1)) * 4;
        r = D[best]; gc = D[best + 1]; b = D[best + 2];
      }
      for (let y = y0; y < y1; y++) for (let x = x0, i = (y * bw + x0) * 4; x < x1; x++, i += 4) { if (!D[i + 3]) continue; D[i] = r; D[i + 1] = gc; D[i + 2] = b; }
    }
    g.putImageData(id, ox, oy);
  }

  // ═══════════ Ein Bild zeichnen ═══════════
  const gridCv = { c: null, g: null, im: null, o: null };
  function gridBuf() {
    if (!gridCv.c) { const [c, g] = cv2d(GW, GH); gridCv.c = c; gridCv.g = g; gridCv.im = g.createImageData(GW, GH); }
    return gridCv;
  }
  const stampCv = { c: null, g: null, im: null };
  function render(core, view, g, t) {
    const sp = core.sp, K = view.K, W = view.W, H = view.H, E = Object.create(core);
    E.layers = view.layers; E.layers0 = view.layers;
    setGeo(core.full);
    if (!core.st && FX[sp.fx].prep) { core.st = FX[sp.fx].prep(E); }
    const st = core.st;
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, W, H);
    // 1) Raster-Effekt
    const gb = gridBuf(), o = gb.im.data; o.fill(0);
    for (const l of view.layers) l.data.fill(0);
    FX[sp.fx].frame(E, st, t, o);
    gb.g.putImageData(gb.im, 0, 0);
    g.imageSmoothingEnabled = false;
    g.drawImage(gb.c, 0, 0, GW, GH, 0, 0, W, H);
    if (view.holes) { g.globalCompositeOperation = 'destination-out'; g.drawImage(view.holes, 0, 0); g.globalCompositeOperation = 'source-over'; }
    if (sp.quant) quantize(core, view, g);
    if (view.rim) g.drawImage(view.rim[Math.floor(t * 4) % 6 < 3 ? 1 : 0], 0, 0);
    if (view.cut) g.drawImage(view.cut.cv, view.cut.x, view.cut.y);
    // 2) Text-Ebenen (neu gefärbte Tinte)
    for (const l of view.layers) { l.cx.putImageData(l.im, 0, 0); g.drawImage(l.cv, l.x0, l.y0); }
    // 3) Stempel / Icon unten rechts (5x5 Zellen zu 9 Kartenpixeln)
    const gp = FX[sp.fx].glint ? FX[sp.fx].glint(t) : [], k5 = K / 5;
    const cell = (i, j, c) => { const x0 = Math.round((689 + 9 * i) * k5), x1 = Math.round((689 + 9 * (i + 1)) * k5), y0 = Math.round((989 + 9 * j) * k5), y1 = Math.round((989 + 9 * (j + 1)) * k5); const v = sn(c[0], c[1], c[2]); g.fillStyle = 'rgb(' + (v & 255) + ',' + ((v >> 8) & 255) + ',' + ((v >> 16) & 255) + ')'; g.fillRect(x0, y0, x1 - x0, y1 - y0); };
    const s = sp.stamp;
    if (s === 'diamond') {
      if (!stampCv.c) { const [c, gg] = cv2d(45, 45); stampCv.c = c; stampCv.g = gg; stampCv.im = gg.createImageData(45, 45); }
      diamondStampImage(core.stamp.dm, t, stampCv.im.data, gp); stampCv.g.putImageData(stampCv.im, 0, 0);
      const x0 = Math.round(689 * k5), y0 = Math.round(989 * k5); g.drawImage(stampCv.c, 0, 0, 45, 45, x0, y0, Math.round(734 * k5) - x0, Math.round(1034 * k5) - y0);
    } else {
      const px = s === 'silver' ? silverStampPixels(core.stamp.mask, t, gp) : s === 'rainbow' ? rainbowStampPixels(core.stamp.mask, t, gp) : s === 'srstar' ? starStampPixels(core.stamp.star, t, gp) : iconPixels(s, t);
      for (const [i, j, c] of px) cell(i, j, c);
    }
  }

  // ═══════════ Anbindung: attach ═══════════
  const stats = { prep: null, cores: 0, stills: 0, frames: 0, ms: 0, frameMs: 0, buildMs: 0 };
  const instances = new Set();
  const stillCache = new Map();          // Schlüssel -> Canvas (Standbild, K-Auflösung), LRU
  const STILL_MAX = 160;
  const CORE_MAX = 10;
  let queue = Promise.resolve();
  function enqueue(fn) { const p = queue.then(() => new Promise(r => setTimeout(r, 0))).then(fn); queue = p.catch(() => {}); return p; }

  /** Glatt verkleinern (Kleinansichten): Zeichnen mit Filter, danach wieder hart (Pixelraster der Leinwand bleibt). */
  function blitSmooth(g, src, tw, th) { g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(src, 0, 0, src.width, src.height, 0, 0, tw, th); g.imageSmoothingEnabled = false; }
  function downscale(src, tw, th) {
    let cur = src;   // in Halbierungsschritten, damit der Filter keine Pixel überspringt
    while (cur.width > tw * 2) { const [c, g] = cv2d(Math.max(tw, cur.width >> 1), Math.max(th, cur.height >> 1)); blitSmooth(g, cur, c.width, c.height); cur = c; }
    const [c, g] = cv2d(tw, th); blitSmooth(g, cur, tw, th); return c;
  }
  function lruGet(map, k) { const v = map.get(k); if (v !== undefined) { map.delete(k); map.set(k, v); } return v; }
  function lruSet(map, k, v, max) { map.set(k, v); if (map.size > max) map.delete(map.keys().next().value); }

  const dprNow = () => Math.min(2, root.devicePixelRatio || 1);
  const pickK = cssW => { const W = cssW * dprNow(); return W <= 300 ? 2 : W <= 450 ? 3 : W <= 600 ? 4 : 5; };

  const io = typeof IntersectionObserver === 'function' ? new IntersectionObserver(es => { for (const e of es) { const i = e.target.__ppRar; if (i) { i.visible = e.isIntersecting; if (i.visible) i.wake(); } } }, { rootMargin: '120px' }) : null;
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(es => { for (const e of es) { const i = e.target.__ppRar; if (i) i.resized(e.contentRect.width); } }) : null;

  function animatedOk() { return root._playAnimations !== false && !root.PP_RETRO && !document.hidden; }
  let tickId = 0;
  function tick(now) {
    tickId = 0;
    let any = false;
    if (animatedOk()) for (const i of instances) {
      if (!i.animated || !i.visible || !i.view) continue;
      any = true;
      const fps = i.core.sp.fps, f = Math.floor(now / 1000 * fps);
      if (f === i.lastF) continue;
      i.lastF = f; i.draw(f / fps + i.phase);
    }
    if (any) schedule();
  }
  function schedule() { if (!tickId) tickId = (root.ppTaktRaf || root.requestAnimationFrame)(tick); }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) schedule(); });

  function attach(host, opts) {
    opts = opts || {};
    const inst = {
      host, canvas: null, g: null, opts, card: null, rarity: 'common', animated: false, visible: !io, needs: false, core: null, view: null, K: 0, lastF: -1, phase: 0, dead: false, token: 0, imgEl: null, width: 0, key: '',
      wake() { if (this.animated && this.view) schedule(); else if (this.needs) { this.needs = false; this.refresh(); } },
      resized(w) { if (Math.abs(w - this.width) < 1) return; this.width = w; if (this.rarity !== 'common') this.refresh(); },
      refresh() {
        if (this.dead) return;
        if (!this.visible) { this.needs = true; this.token++; return; }   // nur sichtbare Karten werden gerechnet; der Beobachter weckt sie
        const my = ++this.token;
        enqueue(() => (this.dead || my !== this.token ? null : this.build(my))).catch(err => console.warn('[rarity-fx]', err && err.message));
      },
      async build(my) {
        const { card, rarity } = this;
        if (!card || !SPEC[rarity] || !root.CardRender) { this.clear(); return; }
        if (SPEC[rarity].mask) { await loadMasks(); if (my !== this.token || this.dead) return; if (!hasMask(card.name)) { this.clear(); return; } }
        const img = this.findImg();
        if (!imgReady(img)) { this.waitImg(img); return; }
        const t0 = performance.now();
        const variant = this.opts.variant || variantOfImg(img);
        const css = this.opts.size || this.width || (this.host.getBoundingClientRect().width) || 120;
        const K = this.opts.K || pickK(css);
        const src = String(img.src), ck = card.name + '|' + rarity + '|' + src;
        let core = lruGet(coreCache, ck);
        if (!core) {
          core = await buildCore(card, rarity, img, variant); if (my !== this.token || this.dead) return;
          if (!core) { this.clear(); return; }
          stats.cores++;
          lruSet(coreCache, ck, core, CORE_MAX);
        }
        // Zielgröße der sichtbaren Leinwand: in Kleinansichten (Anzeige deutlich schmaler als die K-Leinwand) wird glatt auf Gerätepixel
        // heruntergerechnet — wie der Browser es beim Basisbild tut. Die Nearest-Skalierung des Browsers würde Zeilen/Spalten des Textes
        // und der Raster verschlucken (Text unleserlich, Dithering als grobes Punktraster) und deckt sich dann nicht mit der Basiskarte.
        const devW = Math.round(css * dprNow()), W = GW * K, H = GH * K;
        const tw = devW < W * 0.8 ? Math.max(48, devW) : W, th = tw === W ? H : Math.round(tw * GH / GW);
        const sk = ck + '|' + K + '|' + tw;
        this.core = core; this.tw = tw; this.th = th; this.W = W; this.H = H;
        if (this.canvas && this.canvas.__wrf !== !!SPEC[rarity].quant) this.clear();
        if (!this.canvas) this.mkCanvas();
        if (this.canvas.width !== tw || this.canvas.height !== th) { this.canvas.width = tw; this.canvas.height = th; this.g.imageSmoothingEnabled = false; }   // beide prüfen: eine frische Canvas ist 300 x 150, bei K = 2 stimmt die Breite schon
        this.K = K;
        if (!this.animated) {
          let still = lruGet(stillCache, sk);
          if (!still) {
            const view = buildView(core, img, K), [c, g] = cv2d(W, H, !!SPEC[rarity].quant);
            render(core, view, g, SPEC[rarity].still); still = tw === W ? c : downscale(c, tw, th); stats.stills++;
            lruSet(stillCache, sk, still, STILL_MAX);
          }
          this.g.clearRect(0, 0, tw, th); this.g.drawImage(still, 0, 0); this.view = null; this.drawn = true;
        } else {
          this.view = buildView(core, img, K); this.phase = (hash(card.name.length, card.name.charCodeAt(0) || 1, 3) * 6) | 0; this.lastF = -1;
          if (tw !== W) { const [oc, og] = cv2d(W, H, !!SPEC[rarity].quant); og.imageSmoothingEnabled = false; this.off = oc; this.og = og; } else { this.off = null; this.og = null; }
          this.draw(SPEC[rarity].still + this.phase, true);
          schedule();
        }
        stats.buildMs += performance.now() - t0;
        this.host.classList.add('pp-rarity-on');
      },
      draw(t) {
        const t0 = performance.now();
        if (this.off) { render(this.core, this.view, this.og, t); this.g.clearRect(0, 0, this.tw, this.th); blitSmooth(this.g, this.off, this.tw, this.th); }
        else render(this.core, this.view, this.g, t);
        stats.frames++; stats.frameMs += performance.now() - t0;
      },
      findImg() {
        if (this.opts.img) return typeof this.opts.img === 'function' ? this.opts.img() : this.opts.img;
        const h = this.host;
        return h.querySelector('img') || (h.parentElement && h.parentElement.querySelector('img'));
      },
      waitImg(img) {
        if (!img || this.waiting === img) return; this.waiting = img;
        const on = () => { img.removeEventListener('load', on); if (this.waiting === img) this.waiting = null; this.refresh(); };
        img.addEventListener('load', on);
      },
      mkCanvas() {
        const c = document.createElement('canvas'); c.className = 'pp-rarity-cv'; c.setAttribute('aria-hidden', 'true');
        c.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;image-rendering:pixelated;image-rendering:crisp-edges';
        this.host.appendChild(c); this.canvas = c; this.g = c.getContext('2d', { willReadFrequently: !!(SPEC[this.rarity] && SPEC[this.rarity].quant) }); this.g.imageSmoothingEnabled = false; c.__wrf = !!(SPEC[this.rarity] && SPEC[this.rarity].quant);
      },
      clear() { if (this.canvas) { this.canvas.remove(); this.canvas = null; this.g = null; } this.view = null; this.core = null; this.host.classList.remove('pp-rarity-on'); },
      update(o) {
        o = o || {};
        const was = this.animated;
        if (o.card) this.card = o.card;
        if (o.rarity) this.rarity = o.rarity;
        if (o.animated != null) this.animated = !!o.animated;
        if (o.size != null) this.opts.size = o.size;
        if (o.img) this.opts.img = o.img;
        if (o.variant) this.opts.variant = o.variant;
        if (was !== this.animated) { this.view = null; this.lastF = -1; }
        if (!SPEC[this.rarity]) { this.clear(); return; }
        this.refresh();
      },
      destroy() { this.dead = true; this.token++; instances.delete(this); if (io) io.unobserve(this.host); if (ro) ro.unobserve(this.host); this.host.__ppRar = null; this.clear(); },
    };
    host.__ppRar = inst; instances.add(inst);
    if (io) io.observe(host); if (ro) ro.observe(host);
    inst.update({ card: opts.card, rarity: opts.rarity || 'common', animated: !!opts.animated });
    return inst;
  }

  // ═══════════ Test-Schalter ═══════════
  function testRarity(cardName) {
    let r = root.__ppTestRarity;
    if (r == null) { try { const m = /[?&]rarity=([a-z]+)/.exec(location.search); r = m ? m[1] : null; } catch (e) { r = null; } }
    if (!r) return null;
    if (r === 'mix') {   // deterministisch je Kartenname, alle Stufen (auch Common)
      const n = ORDER.length; let h = 0; for (const ch of String(cardName || '')) h = (h * 31 + ch.charCodeAt(0)) | 0;
      return ORDER[Math.abs(h) % n];
    }
    return ORDER.includes(r) ? r : null;
  }

  root.PpRarityFx = { available, hasMask, loadMasks, attach, imageRarity, testRarity, ORDER, LABEL, SPEC, stats: () => Object.assign({}, stats, { instances: instances.size, stills: stillCache.size, cores: coreCache.size }),
    _internals: { render, buildCore, buildView, FX, sn, maskOf, setGeo, pickK, GW, GH } };
})(typeof window !== 'undefined' ? window : globalThis);
