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
//  Prismatic (Glasstreifen aus Prisma-Kacheln) · Super Rare (Lichtlauf, Schraffur) · Diamond (Rautengitter) · Spectral (Echo, Glitches) ·
//  Umbra (Schattenrauch um das Motiv, schwarze glaenzende Schrift) · Stained Rare (Buntglas-Hintergrund, Aura, goldener Text).
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
//
//  Rechenaufwand (Stand Performance-Umbau): Die Ausgabe ist Pixel fuer Pixel dieselbe wie vorher; es wird nur weniger gerechnet.
//   * Je Karte einmal vorberechnet (core.st.pre bzw. je Ansicht): alles, was von der Zeit nicht abhaengt (Torwerte, Bayer-Stellen, Lauf-Koordinaten, Grundfarben,
//     Bleiruten, Schriftpixel), dazu Farbtabellen, die erst beim ersten Bedarf gefuellt werden. Je Bild laufen nur die bewegten Anteile (Lichtlaeufe ueber
//     Eimer nach Lauf-Koordinate, Rauschsaum der Umbra, geaenderte Kacheln der Prismatic, Glaszellen mit gleichen Stufen aus der Tabelle).
//   * Die Effekte schreiben in ein Uint32-Raster (ein Schreibzugriff je Pixel, keine Zwischenfelder), Text in Uint32-Sichten der Ebenen.
//   * Stained quantisiert im Raster statt die Leinwand zurueckzulesen (kein getImageData im Takt).
//   * Prismatic: Kachelraster, Zellen je Kachel und Glasfarben je Farbstufe sind je Karte einmal vorberechnet; je Bild laufen nur die Kacheln unter dem Streifen (in der Pause nichts). Text-Ebenen entfallen ganz. Umbra-Schrift: Grundpuffer je Ebene
//     einmal fertig (Buchstaben, Kantenlicht, ggf. Kontursaum), je Bild nur Kopie plus Glanzlauf.
//   * Schwere Erstberechnung (Glasscheiben, Bleiruten, Quantisierungs- und Glastabellen) laeuft in Zeitscheiben (`prepG`, `runSliced`), nicht als ein Block.
//   Gegenprobe bei jeder Aenderung: Leinwand-Hashes je Rarity x Kartentyp x Groesse x Zeitpunkt gegen den Stand davor (muessen alle gleich sein).
// ═══════════════════════════════════════════════════════════════════
(function (root) {
  if (root.PpRarityFx) return;

  const GW = 150, GH = 210, NPX = GW * GH;
  const ORDER = ['common', 'uncommon', 'rare', 'prismatic', 'super', 'diamond', 'spectral', 'stained', 'umbra'];
  const LABEL = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', prismatic: 'Prismatic', super: 'Super Rare', diamond: 'Diamond', spectral: 'Spectral', umbra: 'Umbra', stained: 'Stained Rare' };
  // Je Stufe: Basiskarte (nur Information; die URL-Variante steht in CardRender.rarityBase), Effekt, Stempel, Takt, Standbild-Zeit
  const SPEC = {
    uncommon: { fx: 'unc', stamp: 'silver', fps: 20, still: 1.5 },
    rare: { fx: 'rare', stamp: 'rainbow', fps: 20, still: 1.2 },   // Standbild: Strahl mitten im Bild (Lauf 4,6 s, 72 %)
    prismatic: { fx: 'pris', stamp: 'prismatic', fps: 20, still: 1.7 },
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
  /** wie sn(), nur fuer Werte, die sicher in 0..255 liegen (Mischungen zweier Farbwerte): ohne Begrenzung */
  function snIn(r, g, b) { const v = SNAP[(((r | 0) >> 2) << 12) | (((g | 0) >> 2) << 6) | ((b | 0) >> 2)]; return v || sn(r, g, b); }
  /** Palettenfarbe als CSS-Text (fillStyle) */
  function rgbStr(c) { const v = sn(c[0], c[1], c[2]); return 'rgb(' + (v & 255) + ',' + ((v >> 8) & 255) + ',' + ((v >> 16) & 255) + ')'; }
  function put(o, p, c) { o[p] = sn(c[0], c[1], c[2]); }   // o: Uint32Array (RGBA little-endian, wie sn() es liefert)

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
    if (metric !== 'l1' && n >= 24) {
      // Naechster Standort je Pixel, ohne alle Standorte zu pruefen: Standorte nach x sortiert, vom Pixel aus nach links/rechts, solange dx^2 den bisher besten
      // Abstand nicht uebersteigt; Startwert = Gewinner des linken Nachbarpixels. Gleiche Abstandsformel und Gleichstandsregel (kleinster Index) wie die volle Suche.
      const ord = Int32Array.from({ length: n }, (_, i) => i).sort((a, b) => sx[a] - sx[b] || a - b), sxs = new Float64Array(n);
      for (let j = 0; j < n; j++) sxs[j] = sx[ord[j]];
      let rowStart = 0;
      for (let y = 0; y < GH; y++) {
        let ix = 0, bi = rowStart;
        for (let x = 0; x < GW; x++) {
          let dx = x - sx[bi], dy = y - sy[bi], best = dx * dx + dy * dy;
          while (ix < n && sxs[ix] < x) ix++;
          for (let j = ix; j < n; j++) { const s = ord[j]; dx = x - sx[s]; const dx2 = dx * dx; if (dx2 > best) break; dy = y - sy[s]; const d = dx2 + dy * dy; if (d < best || (d === best && s < bi)) { best = d; bi = s; } }
          for (let j = ix - 1; j >= 0; j--) { const s = ord[j]; dx = x - sx[s]; const dx2 = dx * dx; if (dx2 > best) break; dy = y - sy[s]; const d = dx2 + dy * dy; if (d < best || (d === best && s < bi)) { best = d; bi = s; } }
          const p = y * GW + x; id[p] = bi; dist[p] = Math.sqrt(best);
          if (x === 0) rowStart = bi;
        }
      }
      return { id, dist };
    }
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
  // lay.dark: helle Textfelder (Artefakte) bekommen dunkle Tinte desselben Farbtons.
  // Die Ebenen werden als Uint32-Sicht (lay.d32) beschrieben; alles, was je Tintenpixel gleich bleibt (Koordinaten, Grundfarbe), ist je Ebene einmal vorberechnet
  // (layPre / layBase), der Lichtlauf sucht seine Pixel über Eimer nach Lauf-Koordinate statt jedes Tintenpixel zu prüfen.
  const BODY_C = [232, 204, 134];
  function lput(lay, lx, ly, c) { if (lx < 0 || ly < 0 || lx >= lay.w || ly >= lay.h) return; lay.d32[ly * lay.w + lx] = lay.dark ? sn(c[0] * .4, c[1] * .4, c[2] * .4) : sn(c[0], c[1], c[2]); }
  const packC = (lay, r, g, b) => (lay.dark ? sn(r * .4, g * .4, b * .4) : sn(r, g, b));
  function lblock(lay, gx, gy, c) { const U = lay.U, x0 = gx * U - lay.x0, y0 = gy * U - lay.y0; for (let dy = 0; dy < U; dy++) for (let dx = 0; dx < U; dx++) lput(lay, x0 + dx, y0 + dy, c); }
  function lstar(lay, gx, gy, size, arm, core) { lblock(lay, gx, gy, core); for (let k = 1; k <= size; k++) { lblock(lay, gx + k, gy, arm); lblock(lay, gx - k, gy, arm); lblock(lay, gx, gy + k, arm); lblock(lay, gx, gy - k, arm); } }
  const SILVER = ry => (ry < .22 ? [252, 253, 255] : ry < .48 ? [214, 222, 236] : ry < .74 ? [168, 180, 200] : [120, 132, 154]);
  const GOLDNAME = ry => (ry < .22 ? [255, 246, 190] : ry < .5 ? [250, 213, 74] : ry < .75 ? [226, 170, 30] : [176, 118, 8]);
  /** Je Ebene einmal: Index im Puffer, Rasterkoordinaten (gx, gy), Zeilenanteil ry, Lichtlauf-Koordinaten (ud, ub) je Tintenpixel */
  function layPre(lay) {
    if (lay.pre) return lay.pre;
    const L = lay.list, n = L.length >> 1, U = lay.U, w = lay.w;
    const pidx = new Int32Array(n), gx = new Float64Array(n), gy = new Float64Array(n), ry = new Float64Array(n), ud = new Float64Array(n), ub = new Float64Array(n), fgy = new Int32Array(n);
    for (let k = 0; k < n; k++) {
      const lx = L[k * 2], ly = L[k * 2 + 1];
      pidx[k] = ly * w + lx; gx[k] = (lx + lay.x0) / U; gy[k] = (ly + lay.y0) / U; ry[k] = Math.floor((ly - lay.gy0) / U) * U / lay.gh;
      ud[k] = UD(gx[k], gy[k]); ub[k] = (2 * gx[k] + gy[k]) / 2.236; fgy[k] = Math.floor(gy[k]);
    }
    return (lay.pre = { n, pidx, gx, gy, ry, ud, ub, fgy, bases: new Map(), buckets: {} });
  }
  /** Eintraege in Eimern (Breite 1) nach Wert: bk.ord[bk.start[b] .. bk.start[b+1]) */
  function bucketsOf(vals, n) {
    let mn = Infinity, mx = -Infinity;
    for (let k = 0; k < n; k++) { if (vals[k] < mn) mn = vals[k]; if (vals[k] > mx) mx = vals[k]; }
    if (!n) { mn = 0; mx = 0; }
    const mn0 = Math.floor(mn), nb = Math.floor(mx - mn0) + 2, start = new Int32Array(nb + 1), ord = new Int32Array(n);
    for (let k = 0; k < n; k++) start[Math.floor(vals[k] - mn0) + 1]++;
    for (let b = 0; b < nb; b++) start[b + 1] += start[b];
    const fill = start.slice(0, nb);
    for (let k = 0; k < n; k++) ord[fill[Math.floor(vals[k] - mn0)]++] = k;
    return { ord, start, mn0, nb };
  }
  function layBuckets(lay, kind) {
    const pre = layPre(lay); let bk = pre.buckets[kind]; if (bk) return bk;
    return (pre.buckets[kind] = bucketsOf(pre[kind], pre.n));
  }
  /** Eimer-Bereich [from, to) (Indizes in bk.ord) aller Pixel mit Koordinate in [lo, hi] (Obermenge) */
  function bucketSpan(bk, lo, hi) {
    let b0 = Math.floor(lo - bk.mn0), b1 = Math.floor(hi - bk.mn0);
    if (b1 < 0 || b0 >= bk.nb) return null;
    if (b0 < 0) b0 = 0; if (b1 >= bk.nb) b1 = bk.nb - 1;
    return [bk.start[b0], bk.start[b1 + 1]];
  }
  /** Grundfarbe jeder Tintenpixels einer Ebene für einen Farbverlauf `ramp` (Name/Werte nach Zeilenanteil, Regeltext in einem Ton), fertig gepackt */
  function layBase(lay, ramp) {
    const pre = layPre(lay); let b = pre.bases.get(ramp); if (b) return b;
    b = new Uint32Array(lay.w * lay.h); const body = lay.kind === 'body';
    for (let k = 0; k < pre.n; k++) { const c = body ? BODY_C : ramp(pre.ry[k]); b[pre.pidx[k]] = packC(lay, c[0], c[1], c[2]); }
    pre.bases.set(ramp, b); return b;
  }
  function paintName(E, t, ramp, per, run, sparkCol, wide) {
    const pos = glintU(t, per || 3.2, run || .5), p0 = pos.length ? pos[0] : 0;
    for (const lay of E.layers) {
      const pre = layPre(lay), d32 = lay.d32, L = lay.list;
      d32.set(layBase(lay, ramp));
      if (!pos.length) continue;
      const body = lay.kind === 'body', m = body ? 2.4 : 1, thr = wide ? Math.max(3.2 * m, wide) : 3.2 * m;
      const span = bucketSpan(layBuckets(lay, 'ud'), p0 - thr - 1e-6, p0 + thr + 1e-6); if (!span) continue;
      const ord = layBuckets(lay, 'ud').ord;
      for (let q = span[0]; q < span[1]; q++) {
        const k = ord[q], a = Math.abs(pre.ud[k] - p0);
        if (a < 1.5 * m) { d32[pre.pidx[k]] = packC(lay, 255, 255, 255); continue; }
        if (!(a < 3.2 * m) && !(wide && a < wide)) continue;
        const c = body ? BODY_C : ramp(pre.ry[k]);
        if (a < 3.2 * m) { d32[pre.pidx[k]] = packC(lay, c[0] + (255 - c[0]) * .6, c[1] + (255 - c[1]) * .6, c[2] + (255 - c[2]) * .6); continue; }
        const kk = 1 - a / wide, X = L[k * 2] + lay.x0, Y = L[k * 2 + 1] + lay.y0;
        if ((((X >> 1) & 1) * 2 + ((Y >> 1) & 1) + 0.5) / 4 < kk * 1.6) { const f = kk > .66 ? .88 : kk > .33 ? .66 : .4; d32[pre.pidx[k]] = packC(lay, c[0] + (255 - c[0]) * f, c[1] + (250 - c[1]) * f, c[2] + (228 - c[2]) * f); }
      }
    }
    const nl = E.layers[0]; if (!nl || nl.kind !== 'name' || !nl.list.length) return;
    const L = nl.list, n = L.length / 2, arm = sparkCol || [190, 214, 255], U = nl.U;
    for (let s2 = 0; s2 < 3; s2++) {
      const tt = t + s2 * .5, per2 = 1.5, k = Math.floor(tt / per2), ph = (tt % per2) / per2; if (ph > .6) continue;
      const f = Math.floor(ph / .6 * SPARK_SIZE.length), q = Math.floor(hash(k, s2, 3) * n);
      lstar(nl, Math.round((L[q * 2] + nl.x0) / U), Math.round((L[q * 2 + 1] + nl.y0) / U), Math.min(2, SPARK_SIZE[f]), arm, WHITE3);
    }
  }
  const WHITE3 = [255, 255, 255];
  function textBand(E, pos, w, hi, mid) {
    if (!pos.length) return;
    for (const lay of E.layers) {
      const pre = layPre(lay), d32 = lay.d32, bk = layBuckets(lay, 'ub'), ord = bk.ord;
      const hiP = packC(lay, hi[0], hi[1], hi[2]), midP = mid ? packC(lay, mid[0], mid[1], mid[2]) : 0;
      for (let pi = 0; pi < pos.length; pi++) {
        const span = bucketSpan(bk, pos[pi] - w - 1e-6, pos[pi] + w + 1e-6); if (!span) continue;
        for (let q = span[0]; q < span[1]; q++) {
          const k = ord[q], kk = glintK(pre.ub[k], pos, w);
          if (kk > .62) d32[pre.pidx[k]] = hiP; else if (kk > .25 && mid) d32[pre.pidx[k]] = midP;
        }
      }
    }
  }
  const rimLists = new WeakMap();
  /** Randpixel (3 Zellen) mit ihrer Lauf-Koordinate (ud = x + 0.9 y wie UD, sonst ub = (2x + y) / 2.236): je Karte einmal */
  function rimList(E, useUD) {
    let m = rimLists.get(E.B); if (!m) rimLists.set(E.B, m = {});
    const key = useUD ? 'ud' : 'ub'; if (m[key]) return m[key];
    const P = [], D = [];
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) { if (!(x < 3 || x >= GW - 3 || y < 3 || y >= GH - 3)) continue; P.push(y * GW + x); D.push(useUD ? UD(x, y) : (2 * x + y) / 2.236); }
    return (m[key] = { p: Int32Array.from(P), d: Float64Array.from(D) });
  }
  function rimBand(E, o, pos, w, col, dfn) {
    if (!pos.length) return;
    const B = E.B, rl = rimList(E, dfn === UD), RP = rl.p, RD = rl.d;
    for (let j = 0; j < RP.length; j++) {
      const k = glintK(RD[j], pos, w); if (k <= .2) continue;
      const p = RP[j], i = p * 4, f = k > .62 ? .85 : k > .4 ? .55 : .3, r0 = B[i], g0 = B[i + 1], b0 = B[i + 2];
      o[p] = sn(r0 + (col[0] - r0) * f, g0 + (col[1] - g0) * f, b0 + (col[2] - b0) * f);
    }
  }
  /** Geist-Schrift (Spectral): jedes Tintenpixel jedes Bild neu — Farbe nur nach Spalte und Zeilenband, daher je Bild zwei kleine Tabellen */
  function ghostName(E, t) {
    const F = Math.floor(t * 5);
    for (const lay of E.layers) {
      const pre = layPre(lay), d32 = lay.d32, U = lay.U, W = lay.w;
      if (!pre.colGx) { pre.colGx = new Float64Array(W); for (let x = 0; x < W; x++) pre.colGx[x] = (x + lay.x0) / U; pre.tab0 = new Uint32Array(W); pre.tab1 = new Uint32Array(W); }
      const { colGx, tab0, tab1 } = pre;
      for (let x = 0; x < W; x++) {
        const w = 0.5 + 0.5 * Math.sin(t * 2.4 + colGx[x] * 0.45);
        const m = w * .7, r = 238 + (188 - 238) * m, g = 255 + (160 - 255) * m, b = 248 + (255 - 248) * m;
        tab0[x] = packC(lay, r, g, b); tab1[x] = packC(lay, r + (120 - r) * .45, g + (200 - g) * .45, b + (230 - b) * .45);
      }
      const { pidx, fgy } = pre, L = lay.list;
      for (let k = 0; k < pre.n; k++) { const x = L[k * 2]; d32[pidx[k]] = (fgy[k] + F) % 4 === 0 ? tab1[x] : tab0[x]; }
    }
  }
  /** Umbra-Schrift: Name und Werte schwarz und glaenzend. Je Ebene (und Ansicht) einmal vorberechnet (`umbraLayerPre`): fertiger Grundpuffer mit schwarzen Buchstaben,
   *  Kantenlicht (dunkles Violett oben/links an dicken Strichen) und, wo der Untergrund dunkel ist, einem harten hellen Kontursaum von einer Zelle.
   *  Je Bild: Grundpuffer kopieren, dann nur der wandernde Glanzlauf (harte Stufen, Bayer-Raster) und einzelne Funkelkreuze. */
  const UM_NEED = .215;   // relative Helligkeit des Untergrunds, darunter bekommt die Ebene einen hellen Saum (gemessen an den Karten: Namen auf Rot/Grau/Gelb darueber, Helden-Violett, Blau, Dunkelrot darunter)
  const UM_OUT = [236, 224, 255], UM_L3 = [220, 204, 255], UM_L2 = [126, 84, 206], UM_L1 = [58, 30, 104], UM_TOP = [58, 34, 100], UM_LEFT = [24, 10, 44], UM_ARM = [198, 178, 255];
  /** Maske um rx waagerecht und ry senkrecht aufweiten (Rechteck) in einem w x h grossen Puffer */
  function dilateWH(m, w, h, rx, ry) {
    const hz = new Uint8Array(w * h), z = new Uint8Array(w * h);
    if (rx) for (let y = 0; y < h; y++) {
      let last = -1e9; for (let x = 0, p = y * w; x < w; x++, p++) { if (m[p]) last = x; if (x - last <= rx) hz[p] = 1; }
      last = 1e9; for (let x = w - 1, p = y * w + w - 1; x >= 0; x--, p--) { if (m[p]) last = x; if (last - x <= rx) hz[p] = 1; }
    } else hz.set(m);
    if (!ry) return hz;
    for (let x = 0; x < w; x++) {
      let last = -1e9; for (let y = 0, p = x; y < h; y++, p += w) { if (hz[p]) last = y; if (y - last <= ry) z[p] = 1; }
      last = 1e9; for (let y = h - 1, p = (h - 1) * w + x; y >= 0; y--, p -= w) { if (hz[p]) last = y; if (last - y <= ry) z[p] = 1; }
    }
    return z;
  }
  function umbraLayerPre(lay, img, K) {
    const w = lay.w, h = lay.h, L = lay.list, n = L.length >> 1, W = w * h, ink = new Uint8Array(W), pre = layPre(lay);
    for (let k = 0; k < n; k++) ink[L[k * 2 + 1] * w + L[k * 2]] = 1;
    // Untergrund: das Basisbild unter der Ebene
    const f = img.naturalWidth / (GW * K), [c, g] = cv2d(w, h, true); g.imageSmoothingEnabled = true; g.drawImage(img, lay.x0 * f, lay.y0 * f, w * f, h * f, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h).data, near = dilateWH(ink, w, h, K, K), far = dilateWH(ink, w, h, 2 * K, 2 * K), yl = new Float32Array(W);
    for (let p = 0; p < W; p++) yl[p] = (.299 * d[p * 4] + .587 * d[p * 4 + 1] + .114 * d[p * 4 + 2]) / 255;
    const rel = m => Math.pow((m + .055) / 1.055, 2.4), hist = new Int32Array(64);
    // Untergrund der Ebene: Median der Helligkeit im Streifen 1..2 Zellen neben der Schrift (der Schlagschatten des Basistextes und ferne Plakettenraender zaehlen nicht mit)
    let nb = 0; for (let p = 0; p < W; p++) if (far[p] && !near[p]) { hist[Math.min(63, (yl[p] * 64) | 0)]++; nb++; }
    let med = .5; if (nb >= 8) { let acc = 0; for (let i = 0; i < 64; i++) { acc += hist[i]; if (acc * 2 >= nb) { med = (i + .5) / 64; break; } } }
    // dunkler Untergrund -> heller Saum um alle Buchstaben der Ebene (je Ebene eine Entscheidung, nicht je Buchstabe: sonst springt der Saum innerhalb eines Wortes)
    const outlined = rel(med) < UM_NEED;
    const base = new Uint32Array(W), BK = sn(0, 0, 0), TOP = packC(lay, UM_TOP[0], UM_TOP[1], UM_TOP[2]), LEFT = packC(lay, UM_LEFT[0], UM_LEFT[1], UM_LEFT[2]), OUT = sn(UM_OUT[0], UM_OUT[1], UM_OUT[2]);
    if (outlined) {
      const hz = dilateWH(ink, w, h, K, 0), vt = dilateWH(ink, w, h, 0, K);
      for (let p = 0; p < W; p++) if (!ink[p] && (hz[p] || vt[p])) base[p] = OUT;
    }
    for (let k = 0; k < n; k++) {
      const x = L[k * 2], y = L[k * 2 + 1], p = y * w + x;
      const up = y - K >= 0 && ink[p - K * w], dn = y + K < h && ink[p + K * w], lf = x - K >= 0 && ink[p - K], rt = x + K < w && ink[p + K];
      base[p] = !up && dn ? TOP : !lf && rt ? LEFT : BK;
    }
    const bv = new Float32Array(n); for (let k = 0; k < n; k++) bv[k] = bay(Math.floor(pre.gx[k]), Math.floor(pre.gy[k]));
    lay.um = { base, bv, outlined, c3: packC(lay, UM_L3[0], UM_L3[1], UM_L3[2]), c2: packC(lay, UM_L2[0], UM_L2[1], UM_L2[2]), c1: packC(lay, UM_L1[0], UM_L1[1], UM_L1[2]) };
  }
  function umbraText(E, t) {
    const pos = glintU(t, 3.4, .5), p0 = pos.length ? pos[0] : 0;
    let li = 0;
    for (const lay of E.layers) {
      const pre = layPre(lay), um = lay.um, d32 = lay.d32, n = pre.n; li++;
      d32.set(um.base);
      if (!n) continue;
      if (pos.length) {   // Glanzlauf: heller Kern, Violett, Dunkelviolett — Pixel nur teilweise (Bayer), die Buchstaben bleiben als Form lesbar
        const bk = layBuckets(lay, 'ud'), span = bucketSpan(bk, p0 - 4.4, p0 + 4.4);
        if (span) for (let q = span[0]; q < span[1]; q++) {
          const k = bk.ord[q], a = Math.abs(pre.ud[k] - p0), bv = um.bv[k];
          const c = a < 1.2 ? (bv < .6 ? um.c3 : um.c2) : a < 2.8 ? (bv < .75 ? um.c2 : um.c1) : a < 4.4 && bv < .45 ? um.c1 : 0;
          if (c) d32[pre.pidx[k]] = c;
        }
      }
      // vereinzelte Funkelkreuze auf den Buchstaben (Name zwei, jede Werte-Ebene eines)
      const slots = lay.kind === 'name' ? 2 : 1, per = 1.7, L = lay.list, U = lay.U;
      for (let s = 0; s < slots; s++) {
        const tt = t + s * .85 + li * .41, k = Math.floor(tt / per), ph = (tt % per) / per; if (ph > .55) continue;
        const f = Math.floor(ph / .55 * SPARK_SIZE.length), q = Math.floor(hash(k, s + li * 7, 3) * n);
        lstar(lay, Math.round((L[q * 2] + lay.x0) / U), Math.round((L[q * 2 + 1] + lay.y0) / U), Math.min(1, SPARK_SIZE[f]), UM_ARM, WHITE3);
      }
    }
  }

  // ═══════════ Der Effekt-Katalog ═══════════
  const FX = {};
  const PASTEL = [[229, 128, 146], [224, 192, 133], [255, 241, 150], [146, 211, 169], [119, 200, 238], [179, 142, 215]];
  const ICE = [[178, 238, 238], [124, 233, 220], [102, 217, 255], [229, 245, 250], [78, 130, 203], [255, 255, 255]];

  // Uncommon: silberner Name und Werte, Lichtlauf über Name, Werte und Icon
  FX.unc = { textFull: true, gridless: true, glint: t => glintU(t, 3.6, .6), frame(E, st, t, o) { paintName(E, t, SILVER, 3.6, .6); } };

  // Rare: Prisma-Strahl über dem Bild, silberner Rahmen, Name/Werte im selben Lauf
  const RARE_W = 34, TMP3 = new Float64Array(3);
  function rareFill(pre, q, h) {
    const p = pre.c0[q], i = p * 4, B = pre.B; hsvOut(h / 14, .8, clamp(.38 + .95 * pre.L[p]), TMP3, 0);
    return (pre.tab[q * 14 + h] = sn(B[i] + (TMP3[0] - B[i]) * .8, B[i + 1] + (TMP3[1] - B[i + 1]) * .8, B[i + 2] + (TMP3[2] - B[i + 2]) * .8));
  }
  /** Rare: je Bildpixel einmal Torwert, Bayer-Stelle und Lauf-Koordinate; ausserhalb des Strahls bleiben nur die Rasterpunkte (Bayer < 0,14 * Tor) in 14 Farbstufen */
  function rarePre(E) {
    const { B, L, A } = E, c0 = [], c0Q = [], cp = [], cu = [], cg = [], cb = [];
    for (let y = AY0; y < AY0 + AH; y++) for (let x = AX0; x < AX0 + AW; x++) {
      const p = y * GW + x; if (!A[p]) continue;
      const gate = sstep(.08, .4, L[p]), bv = bay(x, y);
      if (gate > 0) { cp.push(p); cu.push(UD(x, y)); cg.push(gate); cb.push(bv); }
      if (bv < (0.14 + 0 * 0.95) * gate) c0.push(p);
    }
    const c0P = Int32Array.from(c0), tab = new Uint32Array(c0P.length * 14), uc = new Float64Array(c0P.length);   // tab: Farbstufen werden beim ersten Bedarf gefuellt
    for (let q = 0; q < c0P.length; q++) { const p = c0P[q]; uc[q] = UD(p % GW, (p / GW) | 0); }
    const cuA = Float64Array.from(cu);
    return { B, L, c0: c0P, uc, tab, cp: Int32Array.from(cp), cu: cuA, cg: Float64Array.from(cg), cb: Float64Array.from(cb), bk: bucketsOf(cuA, cuA.length), WHITE: sn(255, 255, 255) };
  }
  FX.rare = {
    textFull: true,
    prep: () => ({}),
    glint: t => glintU(t, 4.6, .72),
    frame(E, st, t, o) {
      const { B, L } = E, pos = glintU(t, 4.6, .72), W = RARE_W, pre = st.pre || (st.pre = rarePre(E)), p0 = pos.length ? pos[0] : 0;
      // Rasterpunkte (Strahl-frei); der Farbton laeuft mit der Lauf-Koordinate
      { const { c0, uc, tab } = pre;
        for (let q = 0; q < c0.length; q++) { const u = pos.length ? uc[q] - p0 : 999, hq = Math.floor(fract(u * 0.026 + .02) * 14); o[c0[q]] = Math.abs(u) < 2.2 ? pre.WHITE : (tab[q * 14 + hq] || rareFill(pre, q, hq)); } }
      // im Strahl: alle Bildpixel mit |u| < W
      if (pos.length) {
        const { cp, cu, cg, cb, bk } = pre, span = bucketSpan(bk, p0 - W - 1e-6, p0 + W + 1e-6);
        if (span) for (let j = span[0]; j < span[1]; j++) {
          const q = bk.ord[j], u = cu[q] - p0, a = Math.abs(u), beam = Math.max(0, 1 - a / W), cov = (0.14 + beam * 0.95) * cg[q];
          if (cb[q] >= cov) continue;
          const p = cp[q], i = p * 4;
          if (a < 2.2) { o[p] = pre.WHITE; continue; }
          hsvOut(Math.floor(fract(u * 0.026 + .02) * 14) / 14, beam > .1 ? .95 : .8, clamp(.38 + .95 * L[p]), TMP3, 0);
          o[p] = sn(B[i] + (TMP3[0] - B[i]) * .8, B[i + 1] + (TMP3[1] - B[i + 1]) * .8, B[i + 2] + (TMP3[2] - B[i + 2]) * .8);
        }
      }
      rimBand(E, o, pos, 5, [236, 242, 255], UD);
      // Silberfunken im Bild: auch in der Ruhephase zwischen den Läufen ist mehr zu sehen als das feine Punktraster
      sparkles(o, t, 5, 1.6, .55, (k, s) => [AX0 + 5 + Math.floor(hash(k, s, 61) * (AW - 10)), AY0 + 5 + Math.floor(hash(k, s, 62) * (AH - 10))], [200, 214, 238], [255, 255, 255], 1);
      paintName(E, t, SILVER, 4.6, .72);
    },
  };

  // Prismatic: das Bildfeld ist lueckenlos in grosse Prisma-Kacheln (Dreiecke und Rauten, je Karte stabil aus dem Kartennamen, rund 8 bis 14 im Standardbildfeld) zerlegt,
  // sichtbar sind aber nur die Kacheln unter einem breiten diagonalen Glasstreifen, der wie der Lichtlauf der Super Rare durchs Bild laeuft (danach Pause); ganze Kacheln gehen an und aus (Rand: Viertelstufen im Bayer-Raster). Eine Kachel ist
  // helles Glas: das Motiv um k * 30 Grad im Farbton gedreht und mit einem hellen Spektralton aufgehellt (Bildschirm-Mischung, die Helligkeit des Motivs bleibt, es bleibt erkennbar),
  // der Farbton jeder Kachel laeuft mit eigenem Versatz in 12 Stufen im Kreis (Stufenuebergaenge per Bayer-Raster). Kachelkanten sind 1-Zellen-Linien in hellem Weiss-Violett;
  // die Kachel in der Streifenmitte blitzt kurz auf (Weiss-Violett, Bayer-Stufen). Ausserhalb des Streifens bleibt die Karte unveraendert. Name, Werte, Regeltext und Symbole
  // (Textzone) werden nie beruehrt; keine Text-Ebenen noetig. Je Karte einmal: Kachelraster, Zellen je Kachel zusammenhaengend (je Bild nur die sichtbaren Kacheln), Glasfarben je Farbstufe (traege).
  const PRIS_TILE_W = 32, PRIS_TILE_H = 40, PRIS_MERGE = .45, PRIS_JIT = .25;          // Kachelgroesse (Zellen), Anteil Rauten, Versatz der Gitterpunkte
  const PRIS_HALF = 11, PRIS_EDGE = 9, PRIS_RUN = 3.4, PRIS_PAUSE = 3.8, PRIS_HUE = 14;   // Streifen: Kacheln mit Mittelpunkt bis HALF Lauf-Einheiten von der Streifenmitte sind ganz da, bis HALF + EDGE in Stufen, Lauf- und Pausensekunden, Sekunden je Farbkreis
  const PRIS_LIFT = .32, PRIS_WV = [236, 226, 255], PRIS_FLASH = [.28, .5, .28];
  /** wie hsv(), schreibt r, g, b (0..255, Rohwerte) nach out[j..j+2] — ohne Zwischenfelder */
  function hsvOut(h, s, v, out, j) {
    h = fract(h); const i6 = Math.floor(h * 6), f = h * 6 - i6, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
    let r, g, b;
    switch (i6 % 6) { case 0: r = v; g = t; b = p; break; case 1: r = q; g = v; b = p; break; case 2: r = p; g = v; b = t; break; case 3: r = p; g = q; b = v; break; case 4: r = t; g = p; b = v; break; default: r = v; g = p; b = q; }
    out[j] = r * 255; out[j + 1] = g * 255; out[j + 2] = b * 255;
  }
  /** Zellen im Abstand (2, 1) von jeder Schrift (Name, Werte, Regeltext, Symbole): dort wirkt kein Effekt */
  function textZone(core) {
    const [c, g] = cv2d(GW, GH, true); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(core.masks.name, 0, 0, GW, GH); g.drawImage(core.masks.body, 0, 0, GW, GH);
    const d = g.getImageData(0, 0, GW, GH).data, ink = new Uint8Array(NPX);
    for (let p = 0; p < NPX; p++) ink[p] = d[p * 4 + 3] > 24 ? 1 : 0;
    return dilateWH(ink, GW, GH, 2, 1);
  }
  /** Matrix der Farbton-Drehung um `deg` Grad, helligkeitserhaltend (wie CSS hue-rotate) */
  function hueMatrix(deg) {
    const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    return Float64Array.of(.213 + c * .787 - s * .213, .715 - c * .715 - s * .715, .072 - c * .072 + s * .928,
      .213 - c * .213 + s * .143, .715 + c * .285 + s * .140, .072 - c * .072 - s * .283,
      .213 - c * .213 - s * .787, .715 - c * .715 + s * .715, .072 + c * .928 + s * .072);
  }
  const PRIS_HM = Array.from({ length: 12 }, (_, i) => hueMatrix(i * 30));
  /** Glas-Ton einer Zelle (Index i in B) bei Farbstufe k: Motiv um k * 30 Grad gedreht, mit hellem Spektralton aufgehellt (Bildschirm-Mischung) -> Palettenfarbe */
  function prisGlass(B, i, k) {
    const r = B[i], g = B[i + 1], b = B[i + 2], m = PRIS_HM[k];
    hsvOut(k / 12, .7, 1, TMP3, 0);
    return sn(scr(m[0] * r + m[1] * g + m[2] * b, TMP3[0] * PRIS_LIFT), scr(m[3] * r + m[4] * g + m[5] * b, TMP3[1] * PRIS_LIFT), scr(m[6] * r + m[7] * g + m[8] * b, TMP3[2] * PRIS_LIFT));
  }
  /** Je Karte einmal: Kachelraster (lueckenlos im Bildfeld), Zellen ausserhalb der Textzone mit Lauf-Koordinate, Kachel, Bayer-Stellen und Kantenmarke, in Eimern nach Lauf-Koordinate */
  function prisPre(E) {
    const { A, B } = E, zone = textZone(E), name = (E.card && E.card.name) || 'x'; let hs = 7; for (const ch of name) hs = (Math.imul(hs, 31) + ch.charCodeAt(0)) | 0;
    const r = rng(hs >>> 0), cols = Math.max(3, Math.round(AW / PRIS_TILE_W)), rows = Math.max(2, Math.round(AH / PRIS_TILE_H)), pts = [];
    for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) pts.push([AX0 + AW * i / cols + (i > 0 && i < cols ? (r() - .5) * 2 * PRIS_JIT * AW / cols : 0), AY0 + AH * j / rows + (j > 0 && j < rows ? (r() - .5) * 2 * PRIS_JIT * AH / rows : 0)]);
    const tris = [];   // je Quad zwei Dreiecke (Diagonale wechselt); mate = Nachbardreieck im selben Quad
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const a = pts[j * (cols + 1) + i], b = pts[j * (cols + 1) + i + 1], c = pts[(j + 1) * (cols + 1) + i], d = pts[(j + 1) * (cols + 1) + i + 1];
      if ((i + j) & 1) tris.push([a, b, c], [b, d, c]); else tris.push([a, b, d], [a, d, c]);
    }
    const tile = new Int16Array(tris.length).fill(-1), polys = []; let nt = 0;
    for (let ti = 0; ti < tris.length; ti++) {
      if (tile[ti] >= 0) continue; tile[ti] = nt; const mate = ti ^ 1, rh = (ti & 1) === 0 && r() < PRIS_MERGE; if (rh) tile[mate] = nt;
      polys.push(rh ? [tris[ti], tris[mate]] : [tris[ti]]); nt++;
    }
    const inTri = (x, y, v) => { const d1 = (x - v[1][0]) * (v[0][1] - v[1][1]) - (v[0][0] - v[1][0]) * (y - v[1][1]), d2 = (x - v[2][0]) * (v[1][1] - v[2][1]) - (v[1][0] - v[2][0]) * (y - v[2][1]), d3 = (x - v[0][0]) * (v[2][1] - v[0][1]) - (v[2][0] - v[0][0]) * (y - v[0][1]); return (d1 >= 0 && d2 >= 0 && d3 >= 0) || (d1 <= 0 && d2 <= 0 && d3 <= 0); };
    const tid = new Int16Array(NPX).fill(-1);
    for (let y = AY0; y < AY0 + AH; y++) for (let x = AX0; x < AX0 + AW; x++) {
      const p = y * GW + x; if (!A[p] || zone[p]) continue;
      for (let ti = 0; ti < tris.length; ti++) if (inTri(x + .5, y + .5, tris[ti])) { tid[p] = tile[ti]; break; }
    }
    const cp = [], ct = [], cb = [], cb2 = [], ce = [], sx = new Float64Array(nt), sy = new Float64Array(nt), sn_ = new Int32Array(nt);
    for (let y = AY0; y < AY0 + AH; y++) for (let x = AX0; x < AX0 + AW; x++) {
      const p = y * GW + x, f = tid[p]; if (f < 0) continue;
      const u = (2 * x + y) / 2.236;
      cp.push(p); ct.push(f); cb.push(bay(x, y)); cb2.push(bay(x + 1, y + 2));
      ce.push((x + 1 < GW && tid[p + 1] >= 0 && tid[p + 1] !== f) || (y + 1 < GH && tid[p + GW] >= 0 && tid[p + GW] !== f) ? 1 : 0);   // nur rechts/unten: Linien bleiben 1 Zelle breit
      sx[f] += u; sn_[f]++;
    }
    const n = cp.length, start = new Int32Array(nt + 1), ord = new Int32Array(n), cg = new Float64Array(nt), off = new Float64Array(nt);
    for (let q = 0; q < n; q++) start[ct[q] + 1]++;
    for (let f = 0; f < nt; f++) start[f + 1] += start[f];
    const fill = start.slice(0, nt); for (let q = 0; q < n; q++) ord[fill[ct[q]]++] = q;   // Zellen je Kachel zusammenhaengend
    const pick = (src, T) => { const o = new T(n); for (let j = 0; j < n; j++) o[j] = src[ord[j]]; return o; };
    for (let f = 0; f < nt; f++) { cg[f] = sn_[f] ? sx[f] / sn_[f] : 1e9; off[f] = r(); }
    let lo = 1e9, hi = -1e9; for (let f = 0; f < nt; f++) if (sn_[f]) { if (cg[f] < lo) lo = cg[f]; if (cg[f] > hi) hi = cg[f]; }
    return { B, nt, start, cp: pick(cp, Int32Array), cb: pick(cb, Float32Array), cb2: pick(cb2, Float32Array), ce: pick(ce, Uint8Array), cg, off,
      lo: lo - PRIS_HALF - PRIS_EDGE, hi: hi + PRIS_HALF + PRIS_EDGE, tab: new Array(12).fill(null), k0: new Int32Array(nt), fr: new Float32Array(nt), cov: new Float32Array(nt), WV: sn(PRIS_WV[0], PRIS_WV[1], PRIS_WV[2]) };
  }
  /** Glasfarben aller Kachelzellen bei Farbstufe k (beim ersten Bedarf) */
  function prisTab(pre, k) {
    const t = new Uint32Array(pre.cp.length), { cp, B } = pre;
    for (let q = 0; q < cp.length; q++) t[q] = prisGlass(B, cp[q] * 4, k);
    return (pre.tab[k] = t);
  }
  /** Lage des Streifens (Lauf-Koordinate) oder null in der Pause */
  const prisPos = (pre, t) => { const s = t % (PRIS_RUN + PRIS_PAUSE); return s >= PRIS_RUN ? null : pre.lo + (pre.hi - pre.lo) * (s / PRIS_RUN); };
  FX.pris = {
    noText: true,
    prep: () => ({}),
    warm(E, st) { st.pre = prisPre(E); },
    frame(E, st, t, o) {
      const pre = st.pre || (st.pre = prisPre(E)), pos = prisPos(pre, t); if (pos === null) return;
      const { start, cp, cb, cb2, ce, nt, cg, off, k0, fr, cov, WV } = pre;
      for (let f = 0; f < nt; f++) {
        const dd = Math.abs(cg[f] - pos), c = Math.floor(clamp((PRIS_HALF + PRIS_EDGE - dd) / PRIS_EDGE) * 4) / 4; cov[f] = c; if (!c) continue;
        const kf = fract(t / PRIS_HUE + off[f]) * 12; k0[f] = Math.floor(kf) % 12; fr[f] = kf - Math.floor(kf);   // Farbstufe mit Uebergang
        const ka = k0[f], kb = (ka + 1) % 12, tabA = pre.tab[ka] || prisTab(pre, ka), tabB = pre.tab[kb] || prisTab(pre, kb);
        const fl = dd < 5 ? PRIS_FLASH[1] : dd < 10 ? PRIS_FLASH[0] : 0, fk = fr[f];   // Blitz: die Kachel nahe der Streifenmitte
        for (let q = start[f], e = start[f + 1]; q < e; q++) {
          if (cb[q] >= c) continue;
          if (ce[q]) { o[cp[q]] = WV; continue; }
          let v = cb2[q] < fk ? tabB[q] : tabA[q];
          if (fl && cb[q] < fl) { const x = v & 255, y = (v >> 8) & 255, z = (v >> 16) & 255; v = sn(x + (PRIS_WV[0] - x) * .6, y + (PRIS_WV[1] - y) * .6, z + (PRIS_WV[2] - z) * .6); }
          o[cp[q]] = v;
        }
      }
    },
  };

  // Super Rare: Einfach-Schraffur und ein Lichtlauf über Rahmen, Bild, Name, Werte und Stern
  /** je Bildpixel einmal: Schraffurlinie (nur Linienpixel mit Tor >= 0,05) in sechs Pastellfarben fertig gemischt, Lichtlauf-Farbe, Lauf-Koordinate */
  function srPre(E) {
    const { B, L, A } = E, lp = [], lic = [], ltab = [], gp = [], gd = [], gcol = [];
    for (let y = AY0; y < AY0 + AH; y++) for (let x = AX0; x < AX0 + AW; x++) {
      const p = y * GW + x; if (!A[p]) continue;
      const gate = sstep(.14, .5, L[p]); if (gate < .05) continue;
      const i = p * 4, r0 = B[i], g0 = B[i + 1], b0 = B[i + 2];
      if (((2 * x + y) % 6 + 6) % 6 < 2) { lp.push(p); lic.push(x * 0.35 + y * 0.12); ltab.push(0.72 * gate); }
      if (gate > .3) { gp.push(p); gd.push((2 * x + y) / 2.236); }
    }
    const gdA = Float64Array.from(gd);   // Farben (Linie in sechs Pastelltoenen, Lichtlauf) werden beim ersten Bedarf gefuellt
    return { B, lp: Int32Array.from(lp), lic: Float64Array.from(lic), lf: Float64Array.from(ltab), ltab: new Uint32Array(lp.length * 6), gp: Int32Array.from(gp), gd: gdA, gcol: new Uint32Array(gp.length), bk: bucketsOf(gdA, gdA.length) };
  }
  function srFill(pre, q, k) {
    const p = pre.lp[q], i = p * 4, B = pre.B, r0 = B[i], g0 = B[i + 1], b0 = B[i + 2], c = PASTEL[k], f = pre.lf[q];
    return (pre.ltab[q * 6 + k] = sn(r0 + (c[0] - r0) * f, g0 + (c[1] - g0) * f, b0 + (c[2] - b0) * f));
  }
  function srGlow(pre, q) {
    const p = pre.gp[q], i = p * 4, B = pre.B, r0 = B[i], g0 = B[i + 1], b0 = B[i + 2];
    return (pre.gcol[q] = sn(r0 + (255 - r0) * .55, g0 + (255 - g0) * .55, b0 + (255 - b0) * .55));
  }
  FX.sr = {
    prep: () => ({}),
    glint: t => glintAt(t, 3.4, .55, 1),
    frame(E, st, t, o) {
      const pos = glintAt(t, 3.4, .55, 1), pre = st.pre || (st.pre = srPre(E)), { lp, lic, ltab } = pre, tt = t * 9;
      for (let q = 0; q < lp.length; q++) { const k = Math.floor(fract((lic[q] - tt) / 60) * 6); o[lp[q]] = ltab[q * 6 + k] || srFill(pre, q, k); }
      for (let pi = 0; pi < pos.length; pi++) {
        const span = bucketSpan(pre.bk, pos[pi] - 3.4 - 1e-6, pos[pi] + 3.4 + 1e-6); if (!span) continue;
        for (let j = span[0]; j < span[1]; j++) { const q = pre.bk.ord[j]; if (glintK(pre.gd[q], pos, 3.4) > .02) o[pre.gp[q]] = pre.gcol[q] || srGlow(pre, q); }
      }
      rimBand(E, o, pos, 5, [255, 246, 190]);
      textBand(E, pos, 4, [255, 252, 225], [255, 232, 140]);
      sparkles(o, t, 5, 1.7, .55, (k, s) => [AX0 + 4 + Math.floor(hash(k, s, 9) * (AW - 8)), AY0 + 4 + Math.floor(hash(k, s, 10) * (AH - 8))], [255, 232, 130], [255, 255, 255], 1);
    },
  };

  // Diamond: Rautengitter in Eisfarben, Knoten funkeln, zwei Lichtläufe
  /** Gitterpixel einmal: Raster ausserhalb der Linien und Knoten ohne Lauf sind in jedem Bild gleich (base); Linienpixel in fuenf Eisfarben fertig gemischt */
  function diaPre(E) {
    const { B, L, A } = E, base = new Uint32Array(NPX), lp = [], lic = [], ltab = [], cp = [], cu = [], cic = [], cg = [], cn = [];
    for (let y = AY0; y < AY0 + AH; y++) for (let x = AX0; x < AX0 + AW; x++) {
      const p = y * GW + x; if (!A[p]) continue;
      const i = p * 4, r0 = B[i], g0 = B[i + 1], b0 = B[i + 2], gate = .4 + .6 * sstep(.12, .45, L[p]);
      const l1 = ((2 * x + y) % 6 + 6) % 6 < 2, l2 = ((2 * x - y) % 6 + 6) % 6 < 2;
      if (!l1 && !l2) { if (gate > .3 && bay(x, y) < .2) base[p] = sn(r0 + (40 - r0) * .32, g0 + (120 - g0) * .32, b0 + (200 - b0) * .32); continue; }
      const node = l1 && l2, ic = (x * 0.3 + y * 0.2) / 44;
      cp.push(p); cu.push((2 * x + y) / 2.236); cic.push(ic); cg.push(gate); cn.push(node ? 1 : 0);
      if (node) { const k = Math.min(1, .85 + 0); base[p] = sn(r0 + (255 - r0) * k, g0 + (255 - g0) * k, b0 + (255 - b0) * k); }
      else { lp.push(p); lic.push(ic); ltab.push((.72 + 0 * .28) * gate); }
    }
    const cuA = Float64Array.from(cu);   // Linienfarben in fuenf Eistoenen werden beim ersten Bedarf gefuellt
    return { B, base, lp: Int32Array.from(lp), lic: Float64Array.from(lic), lk: Float64Array.from(ltab), ltab: new Uint32Array(lp.length * 5), cp: Int32Array.from(cp), cu: cuA, cic: Float64Array.from(cic), cg: Float64Array.from(cg), cn: Uint8Array.from(cn), bk: bucketsOf(cuA, cuA.length) };
  }
  function diaFill(pre, q, h) {
    const p = pre.lp[q], i = p * 4, B = pre.B, r0 = B[i], g0 = B[i + 1], b0 = B[i + 2], c = ICE[h], k = pre.lk[q];
    return (pre.ltab[q * 5 + h] = sn(r0 + (c[0] - r0) * k, g0 + (c[1] - g0) * k, b0 + (c[2] - b0) * k));
  }
  FX.dia = {
    prep: () => ({}),
    glint: t => glintAt(t, 1.9, .78, 2),
    frame(E, st, t, o) {
      const { B } = E, pos = glintAt(t, 1.9, .78, 2), pre = st.pre || (st.pre = diaPre(E)), { lp, lic, ltab } = pre, tt = t * 0.18;
      o.set(pre.base);
      for (let q = 0; q < lp.length; q++) { const h = Math.floor(fract(lic[q] - tt) * 5); o[lp[q]] = ltab[q * 5 + h] || diaFill(pre, q, h); }
      for (let pi = 0; pi < pos.length; pi++) {
        const span = bucketSpan(pre.bk, pos[pi] - 12 - 1e-6, pos[pi] + 12 + 1e-6); if (!span) continue;
        for (let j = span[0]; j < span[1]; j++) {
          const q = pre.bk.ord[j], wave = glintK(pre.cu[q], pos, 12); if (wave <= 0) continue;
          const p = pre.cp[q], i = p * 4, r0 = B[i], g0 = B[i + 1], b0 = B[i + 2];
          let c, k;
          if (pre.cn[q]) { c = WHITE3; k = Math.min(1, .85 + wave); } else { c = ICE[Math.floor(fract(pre.cic[q] - tt) * 5)]; k = (.72 + wave * .28) * pre.cg[q]; }
          o[p] = sn(r0 + (c[0] - r0) * k, g0 + (c[1] - g0) * k, b0 + (c[2] - b0) * k);
        }
      }
      rimBand(E, o, pos, 6, [225, 252, 255]);
      textBand(E, pos, 4.5, [235, 255, 255], [140, 238, 232]);
      sparkles(o, t, 9, 1.3, .55, (k, s) => [AX0 + 4 + Math.floor(hash(k, s, 19) * (AW - 8)), AY0 + 4 + Math.floor(hash(k, s, 20) * (AH - 8))], [124, 233, 220], [255, 255, 255], 1.2);
    },
  };

  // Spectral: Echo-Abbild mit gedrosselten Glitches, Seelenfunken, schwarze Funken
  const BLACK_ARM = [14, 6, 30], BLACK_CORE = [0, 0, 0];
  const BAYV = Float64Array.from(BAY, v => (v + 0.5) / 16);
  function spectralSums(B) { const a = new Uint16Array(NPX); for (let p = 0; p < NPX; p++) a[p] = B[p * 4] + B[p * 4 + 1] + B[p * 4 + 2]; return a; }
  FX.spec = {
    textFull: true,
    prep(E) { const r = rng(31), w = []; for (let k = 0; k < 11; k++) w.push({ x: AX0 + 6 + r() * (AW - 12), sp: .07 + r() * .08, ph: r(), amp: 2 + r() * 3 }); return { w }; },
    frame(E, st, t, o) {
      const { B, A } = E, ev = specEvent(t), gi = ev.fr, on = ev.on, big = ev.big;
      const dx = Math.round(4 * Math.sin(t * .8)), dy = Math.round(1.4 * Math.cos(t * 1.1));
      const AX1 = AX0 + AW - 1, AY1 = AY0 + AH - 1, cl = (v, a, b) => (v < a ? a : v > b ? b : v);
      const rects = [];
      if (on) for (let k = 0; k < (big ? 4 : 2); k++) rects.push({ x: AX0 + Math.floor(hash(ev.slot, k, 21) * (AW - 30)), y: AY0 + Math.floor(hash(ev.slot, k, 22) * (AH - 10)), w: 10 + Math.floor(hash(ev.slot, k, 23) * 22), h: 3 + Math.floor(hash(ev.slot, k, 24) * 6), sx: Math.round((hash(ev.slot, k, 25) - .5) * 26), mode: hash(ev.slot, k, 26) });
      const nr = rects.length, bh = 3 + Math.floor(hash(ev.slot, 4, 5) * 4), bsum = st.bsum || (st.bsum = spectralSums(B)), BV = BAYV;
      const xe = st.xe || (st.xe = new Int32Array(GW)), xe2 = st.xe2 || (st.xe2 = new Int32Array(GW));
      for (let x = AX0; x <= AX1; x++) { xe[x] = cl(x - dx, AX0, AX1); xe2[x] = cl(x + dx * 2, AX0, AX1); }
      for (let y = AY0; y <= AY1; y++) {
        let sxr = 0, splitr = 0;
        if (on) { const band = Math.floor((y + gi * 3) / bh); if (hash(band, gi >> 1, 5) < (big ? .45 : .3)) { sxr = Math.round((hash(band, gi >> 1, 6) - .5) * (big ? 34 : 18)); splitr = big ? 3 : 2; } }
        else if (hash(y, gi >> 1, 17) < .006) sxr = hash(y, gi, 18) < .5 ? -2 : 2;
        const rowE = cl(y - dy, AY0, AY1) * GW, rowE2 = cl(y + dy * 2, AY0, AY1) * GW, dark = on && big && (y + gi) % 4 === 0, yb = (y & 3) * 4, rowY = y * GW;
        for (let x = AX0; x <= AX1; x++) {
          const p = rowY + x; if (!A[p]) continue;
          let sx = sxr, split = splitr, inRect = false;
          for (let q = 0; q < nr; q++) { const rc = rects[q]; if (x >= rc.x && x < rc.x + rc.w && y >= rc.y && y < rc.y + rc.h) { sx += rc.sx; if (rc.mode < .4) split = 2; } }
          let r, g, b;
          if (sx === 0 && split === 0) { const i = p * 4; r = 255 - B[i]; g = 255 - B[i + 1]; b = 255 - B[i + 2]; }
          else { r = 255 - B[(rowY + cl(x + sx + split, AX0, AX1)) * 4]; g = 255 - B[(rowY + cl(x + sx, AX0, AX1)) * 4 + 1]; b = 255 - B[(rowY + cl(x + sx - split, AX0, AX1)) * 4 + 2]; }
          const el = (765 - bsum[rowE + xe[x]]) / 765, bx = yb + (x & 3);
          if (BV[bx] < .42 && el > .18) { r = scr(r, el * 120 + 20); g = scr(g, el * 255); b = scr(b, el * 220); }
          if (BV[yb + ((x + 1) & 3)] < .2) { const e2 = (255 - B[(rowE2 + xe2[x]) * 4]) / 255; if (e2 > .3) { r = scr(r, 160 * e2); b = scr(b, 255 * e2); } }
          for (let q = 0; q < nr; q++) { const rc = rects[q]; if (rc.mode > .75 && x >= rc.x && x < rc.x + rc.w && y >= rc.y && y < rc.y + rc.h) { r = 255 - r; g = 255 - g; b = 255 - b; } }
          if (dark) { r *= .8; g *= .8; b *= .9; }
          o[p] = sn(r, g, b);
        }
      }
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
  const UMBRA_LV = [[150, 92, 200], [86, 38, 124], [44, 18, 70], [24, 8, 40]];
  /** Umbra: Pixel ausserhalb des Rauchsaums (dens = 0) sind in jedem Bild gleich und fertig vorberechnet; nur der Saum (Abstand < 17 zur Silhouette) rechnet das Rauschen */
  function umbraPre(E, st) {
    const { B, A } = E, d = st.d, base = new Uint32Array(NPX), lvP = UMBRA_LV.map(c => sn(c[0], c[1], c[2])), dp = [], dxi = [], dyi = [], dens = [], bt = [], bsn = [];
    const level = (s, own) => (s > .62 ? lvP[0] : s > .44 ? lvP[1] : s > .26 ? lvP[2] : s > .12 ? lvP[3] : own);
    for (let y = AY0; y < AY0 + AH; y++) for (let x = AX0; x < AX0 + AW; x++) {
      const p = y * GW + x; if (!A[p]) continue;
      const i = p * 4, own = sn(B[i] * .26 + 6, B[i + 1] * .22 + 4, B[i + 2] * .36 + 16), dist = d[p], dn = dist < 255 ? clamp(1 - dist / 17) : 0, b = (bay(x, y) - .5) * .35;
      if (dn > 0) { dp.push(p); dxi.push(x); dyi.push(y); dens.push(dn); bt.push(b); bsn.push(own); base[p] = own; }
      else base[p] = level(clamp(dn * (0 * 1.9 - .25) + b), own);
    }
    return { base, lvP, dp: Int32Array.from(dp), dxi: Uint8Array.from(dxi), dyi: Uint8Array.from(dyi), dens: Float64Array.from(dens), bt: Float64Array.from(bt), bsn: Uint32Array.from(bsn),
      cx: new Int32Array(3 * GW), cx1: new Int32Array(3 * GW), cu: new Float64Array(3 * GW), ry: new Int32Array(3 * GH), ry1: new Int32Array(3 * GH), cv: new Float64Array(3 * GH) };
  }
  FX.umbra = {
    textFull: true,
    prep(E) { return { d: distToS(E, 18) }; },
    frame(E, st, t, o) {
      const pre = st.pre || (st.pre = umbraPre(E, st)), { dp, dxi, dyi, dens, bt, bsn, lvP, cx, cx1, cu, ry, ry1, cv } = pre;
      o.set(pre.base);
      // Rauschkoordinaten: je Spalte und Zeile einmal (drei Oktaven)
      for (let x = AX0; x < AX0 + AW; x++) {
        const X = x * .085 + t * .25;
        for (let j = 0; j < 3; j++) {
          const a = j === 0 ? X : j === 1 ? X * 2.1 + 7 : X * 4.3 + 11, xi = Math.floor(a), xf = a - xi;
          cx[j * GW + x] = xi & 63; cx1[j * GW + x] = (xi + 1) & 63; cu[j * GW + x] = xf * xf * (3 - 2 * xf);
        }
      }
      for (let y = AY0; y < AY0 + AH; y++) {
        const Y = y * .085 - t * .85;
        for (let j = 0; j < 3; j++) {
          const a = j === 0 ? Y : j === 1 ? Y * 2.1 + 3 : Y * 4.3 + 5, yi = Math.floor(a), yf = a - yi;
          ry[j * GH + y] = (yi & 63) << 6; ry1[j * GH + y] = ((yi + 1) & 63) << 6; cv[j * GH + y] = yf * yf * (3 - 2 * yf);
        }
      }
      const l0 = lvP[0], l1 = lvP[1], l2 = lvP[2], l3 = lvP[3], GH1 = GH, GH2 = 2 * GH;
      for (let q = 0; q < dp.length; q++) {
        const x = dxi[q], y = dyi[q];
        let r0 = ry[y], r1 = ry1[y], c0 = cx[x], c1 = cx1[x], u = cu[x], v = cv[y];
        let g00 = NZ[r0 | c0], g10 = NZ[r0 | c1], g01 = NZ[r1 | c0], g11 = NZ[r1 | c1], ab0 = g00 + (g10 - g00) * u, ab1 = g01 + (g11 - g01) * u;
        let nz = 0 + (ab0 + (ab1 - ab0) * v) * .55;
        r0 = ry[GH1 + y]; r1 = ry1[GH1 + y]; c0 = cx[GW + x]; c1 = cx1[GW + x]; u = cu[GW + x]; v = cv[GH1 + y];
        g00 = NZ[r0 | c0]; g10 = NZ[r0 | c1]; g01 = NZ[r1 | c0]; g11 = NZ[r1 | c1]; ab0 = g00 + (g10 - g00) * u; ab1 = g01 + (g11 - g01) * u;
        nz += (ab0 + (ab1 - ab0) * v) * .3;
        r0 = ry[GH2 + y]; r1 = ry1[GH2 + y]; c0 = cx[2 * GW + x]; c1 = cx1[2 * GW + x]; u = cu[2 * GW + x]; v = cv[GH2 + y];
        g00 = NZ[r0 | c0]; g10 = NZ[r0 | c1]; g01 = NZ[r1 | c0]; g11 = NZ[r1 | c1]; ab0 = g00 + (g10 - g00) * u; ab1 = g01 + (g11 - g01) * u;
        nz += (ab0 + (ab1 - ab0) * v) * .15;
        const s = clamp(dens[q] * (nz * 1.9 - .25) + bt[q]);
        o[dp[q]] = s > .62 ? l0 : s > .44 ? l1 : s > .26 ? l2 : s > .12 ? l3 : bsn[q];
      }
      umbraText(E, t);
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
  /** Rechenarbeit in Zeitscheiben: Generator, der zwischen den Teilschritten `yield`et (der Aufrufer gibt dem Hauptfaden zwischendurch Luft) */
  function* stainedBuildG(E) {
    const opt = STAIN, { B, L, A, S } = E, r = rng(opt.seed), pal = paletteRgb();
    const g = new Float32Array(NPX);
    yield;
    for (let y = 1; y < GH - 1; y++) for (let x = 1; x < GW - 1; x++) { const p = y * GW + x; g[p] = Math.abs(L[p + 1] - L[p - 1]) + Math.abs(L[p + GW] - L[p - GW]); }
    const gs = new Float32Array(NPX);
    for (let y = 3; y < GH - 3; y++) for (let x = 3; x < GW - 3; x++) { let s = 0; for (let dy = -3; dy <= 3; dy += 3) for (let dx = -3; dx <= 3; dx += 3) s += g[(y + dy) * GW + x + dx]; gs[y * GW + x] = s / 9; }
    const rad = (x, y) => (inArt(x, y) ? lerp(opt.rArt, opt.rArtMin, clamp(gs[y * GW + x] * 7)) : opt.rFrame);
    const sites = [];
    const tries = Math.round(14000 * (FULLART ? 3.2 : 1));
    // Dart-Throwing mit variablem Radius; Standortliste in einem Gitter, damit der Abstandstest nicht jede Probe gegen alle Standorte laufen lässt
    const CELL = 12, gw = Math.ceil(GW / CELL), gh = Math.ceil(GH / CELL), grid = Array.from({ length: gw * gh }, () => []);
    for (let k = 0; k < tries; k++) {
      if ((k & 4095) === 4095) yield;
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
    yield;
    let v = voronoi(sites, 'l2');
    for (let pass = 0; pass < 3; pass++) {
      yield;
      const area = new Int32Array(sites.length);
      for (let p = 0; p < NPX; p++) if (A[p] && !S[p]) area[v.id[p]]++;
      const keep = sites.filter((q, k) => area[k] >= opt.minArea);
      if (keep.length === sites.length) break;
      sites.length = 0; for (const q of keep) sites.push(q); v = voronoi(sites, 'l2');
    }
    yield;
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
  function* uiLeadBuildG(E, st) {
    const opt = STAIN, r = rng(opt.seed + 40), sites = st.sites.map(q => ({ x: q.x, y: q.y, r: q.r || opt.rArt })), rr = opt.rArt, B = E.B, A = E.A;
    const U = new Uint8Array(NPX);
    for (let y = 2; y < GH - 2; y++) for (let x = 2; x < GW - 2; x++) { const p = y * GW + x; if (!A[p]) U[p] = 1; }
    const dA = new Uint8Array(NPX).fill(255), qa = []; for (let p = 0; p < NPX; p++) if (A[p]) { dA[p] = 0; qa.push(p); }
    for (let h = 0; h < qa.length; h++) { const p = qa[h]; if (dA[p] >= 36) continue; for (const np of [p - 1, p + 1, p - GW, p + GW]) if (np >= 0 && np < NPX && dA[np] > dA[p] + 1) { dA[np] = dA[p] + 1; qa.push(np); } }
    const dArt = st.v.dist;
    // Bildzellen-Einfang: ein Punkt gehoert zum Bildfeld, wenn ein Bildpixel q naeher als (Zellabstand + 0,5) liegt. Blockweise (8 x 8) mit dem groessten Radius je Block vorgeprueft.
    const BS = 8, nbx = Math.ceil(GW / BS), nby = Math.ceil(GH / BS), bmax = new Float64Array(nbx * nby), rq = new Float64Array(NPX);
    for (let q = 0; q < NPX; q++) if (A[q]) { const r = dArt[q] + 0.5; rq[q] = r * r; const b = ((q / GW | 0) >> 3) * nbx + ((q % GW) >> 3); if (r > bmax[b]) bmax[b] = r; }
    const captures = (x, y) => { const R = 22, x0 = Math.max(0, Math.floor(x - R)), x1 = Math.min(GW - 1, Math.ceil(x + R)), y0 = Math.max(0, Math.floor(y - R)), y1 = Math.min(GH - 1, Math.ceil(y + R));
      for (let by = y0 >> 3; by <= y1 >> 3; by++) for (let bx = x0 >> 3; bx <= x1 >> 3; bx++) {
        const m = bmax[by * nbx + bx]; if (m === 0) continue;
        const ddx = x < bx * BS ? bx * BS - x : x > bx * BS + BS - 1 ? x - (bx * BS + BS - 1) : 0, ddy = y < by * BS ? by * BS - y : y > by * BS + BS - 1 ? y - (by * BS + BS - 1) : 0;
        if (ddx * ddx + ddy * ddy >= m * m) continue;
        for (let yy = Math.max(y0, by * BS); yy <= Math.min(y1, by * BS + BS - 1); yy++) for (let xx = Math.max(x0, bx * BS); xx <= Math.min(x1, bx * BS + BS - 1); xx++) { const q = yy * GW + xx; if (!A[q]) continue; const dx = xx - x, dy = yy - y; if (dx * dx + dy * dy < rq[q]) return true; }
      }
      return false; };
    const CELL = 12, gw = Math.ceil(GW / CELL), gh = Math.ceil(GH / CELL), grid = Array.from({ length: gw * gh }, () => []);
    for (const q of sites) grid[Math.min(gh - 1, Math.floor(q.y / CELL)) * gw + Math.min(gw - 1, Math.floor(q.x / CELL))].push(q);
    yield;
    for (let k = 0; k < 60000; k++) {
      if ((k & 8191) === 8191) yield;
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
    yield;
    const v2 = voronoi(sites, 'l2'), e = edges(v2.id, 1);
    yield;
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
    const A = E.A, ok = (x, y) => x >= 0 && y >= 0 && x < GW && y < GH && A[y * GW + x];
    if (ok(cx, cy)) putXY(o, cx, cy, core);
    for (let k = 1; k <= size; k++) {
      if (ok(cx + k, cy)) putXY(o, cx + k, cy, arm); if (ok(cx - k, cy)) putXY(o, cx - k, cy, arm);
      if (ok(cx, cy + k)) putXY(o, cx, cy + k, arm); if (ok(cx, cy - k)) putXY(o, cx, cy - k, arm);
    }
  }
  FX.stain = {
    textFull: true,
    prep(E) { return runSync(FX.stain.prepG(E)); },
    warm(E, st) { st.pre = stainPre(E, st); },
    *prepG(E) {
      const t0 = performance.now(), st = yield* stainedBuildG(E), t1 = performance.now();
      st.d = distToS(E, 24); st.edge = [];
      const S = E.S; for (let p = GW; p < NPX - GW; p++) if (isEdgeS(S, p)) st.edge.push(p);
      const t2 = performance.now();
      yield;
      st.ui = yield* uiLeadBuildG(E, st);
      stats.prep = [Math.round(t1 - t0), Math.round(t2 - t1), Math.round(performance.now() - t2)];
      return st;
    },
    frame(E, st, t, o) {
      const opt = STAIN, T = opt.T, ph = (t % T) / T, TAU = 6.283185, { n, cellRGB, ph: cph, cx, cy, d } = st, { A, S } = E;
      const pre = st.pre || (st.pre = stainPre(E, st)), kf = pre.kf;
      // Glasscheiben: wandernder Lichtstreif + Flackern, Helligkeit in Stufen, gehämmertes Glas per Bayer-Raster
      const beamPos = (t % T) / T * (GW + GH + 90) - 40;
      for (let c = 0; c < n; c++) {
        const wave = Math.max(0, 1 - Math.abs((cx[c] + cy[c] * 0.9) - beamPos) / 34);
        const flick = Math.pow(Math.max(0, Math.sin(t * TAU / T + cph[c] * TAU)), 4);
        kf[c] = 0.78 + 0.16 * flick + 0.62 * wave;
      }
      // Bleiruten (Bildfeld und Interface-Elemente in der Randfarbe des jeweiligen Elements): unveraendert, fertig vorberechnet
      o.set(pre.base);
      const { fp, fc, fb, fy, tab } = pre;
      for (let q = 0; q < fp.length; q++) {
        const c = fc[q], L = Math.round(kf[c] * fb[q] * 7), key = (c * 16 + L) * 16 + fy[q];
        let vv = L >= 0 && L < 16 ? tab[key] : 0;
        if (!vv) vv = stainPx(pre, cellRGB[c], L, fy[q], key);
        o[fp[q]] = vv;
      }
      const mixPx = (p, col, w) => { const v = o[p], r0 = v & 255, g0 = (v >> 8) & 255, b0 = (v >> 16) & 255; o[p] = sn(r0 + (col[0] - r0) * w, g0 + (col[1] - g0) * w, b0 + (col[2] - b0) * w); };
      const R = 7 + 4 * (.5 + .5 * Math.sin(TAU * ph)), gl = glintU(t, T, .5), sweep = gl.length ? gl[0] : -999;
      // Aura um das Motiv: nur Pixel bis R + 5 Zellen Abstand (nach Abstand sortiert)
      { const { ap, ab, aStart } = pre, lim = R + 5;
        for (let dist = 0; dist <= 24 && dist <= lim; dist++) {
          const q0 = aStart[dist], q1 = aStart[dist + 1]; if (q0 === q1) continue;
          const h = clamp(1 - dist / lim), th = h * h * .95 + (dist < 3 ? .25 : 0), mw = dist < 3 ? .62 : .46;
          for (let q = q0; q < q1; q++) if (ab[q] < th) mixPx(ap[q], EP_WARM, mw);
        } }
      // Lichtstreif ueber das Bild
      { const bk = pre.beam, span = bucketSpan(bk, sweep - 12 - 1e-6, sweep + 12 + 1e-6);
        if (span) for (let j = span[0]; j < span[1]; j++) {
          const q = bk.ord[j], dd = Math.abs(pre.cu[q] - sweep);
          if (dd < 12) { const kk = 1 - dd / 12; if (dd < 2.2) mixPx(pre.cp[q], EP_WHITE, .5); else if (pre.cb[q] < kk * .85) mixPx(pre.cp[q], EP_WARM, .38); }
        } }
      const per = T / 2, slots = 18;
      for (let s = 0; s < slots; s++) {
        const tt = (t + s * per / slots * 1.37) % T, kk = Math.floor(tt / per), ph2 = (tt % per) / per; if (ph2 > .62) continue;
        const sz = SPARK_SIZE[Math.floor(ph2 / .62 * SPARK_SIZE.length)], sk = (kk * slots + s);
        let pp = pre.spk[sk];
        if (pp === undefined) {
          pp = -1;
          for (let tr = 0; tr < 40 && pp < 0; tr++) { const x = AX0 + Math.floor(hash(kk, s, tr) * AW), y = AY0 + Math.floor(hash(kk, s, tr + 77) * AH), p = y * GW + x; if (A[p] && !S[p] && !st.lead[p] && d[p] > 3 && y < 120) pp = p; }
          pre.spk[sk] = pp;
        }
        if (pp >= 0) starA(o, E, pp % GW, (pp / GW) | 0, sz, SPK_GOLD, WHITE3);
      }
      const Ed = st.edge;
      if (Ed.length) for (let s = 0; s < 8; s++) {
        const tt = (t + s * per / 8 * 1.13) % T, kk = Math.floor(tt / per), ph2 = (tt % per) / per; if (ph2 > .5) continue;
        const sz = SPARK_SIZE[Math.floor(ph2 / .5 * SPARK_SIZE.length)], q = Ed[Math.floor(hash(kk, s, 211) * Ed.length)], x = q % GW, y = (q / GW) | 0;
        starA(o, E, x, y, Math.min(2, sz), SPK_ICE, WHITE3);
      }
      // goldener Name und Werte, Regeltext in Goldton, der breite Lichtstreif der Glasscheiben nimmt den Text mit
      paintName(E, t, GOLDNAME, T, .5, SPK_NAME);
      for (const lay of E.layers) {
        const lp = layPre(lay), d32 = lay.d32, bk = layBuckets(lay, 'ud'), L = lay.list, span = bucketSpan(bk, beamPos - 34 - 1e-6, beamPos + 34 + 1e-6); if (!span) continue;
        for (let q = span[0]; q < span[1]; q++) {
          const k = bk.ord[q], w = Math.max(0, 1 - Math.abs(lp.ud[k] - beamPos) / 34); if (w <= 0) continue;
          const X = L[k * 2] + lay.x0, Y = L[k * 2 + 1] + lay.y0;
          if ((((X >> 1) & 1) * 2 + ((Y >> 1) & 1) + 0.5) / 4 >= w * 1.5) continue;
          const pi = lp.pidx[k], cv = d32[pi], r0 = cv & 255, g0 = (cv >> 8) & 255, b0 = (cv >> 16) & 255, f = w > .75 ? .8 : w > .5 ? .6 : w > .25 ? .42 : .26;
          d32[pi] = packC(lay, r0 + (255 - r0) * f, g0 + (250 - g0) * f, b0 + (228 - b0) * f);
        }
      }
    },
  };
  const SPK_GOLD = [255, 226, 120], SPK_ICE = [196, 232, 255], SPK_NAME = [255, 226, 140];
  /** Unveraenderliches des Glasbildes: Bleiruten (fertig im Raster), Glasflaechen (Zelle, Abstandsanteil, Bayer-Stelle), Aura- und Lichtstreif-Kandidaten */
  function stainPre(E, st) {
    const { v, lead, d, cellRGB, dmax, n, ui } = st, { A, S } = E, LC = STAIN.leadCol, snLC = sn(LC[0], LC[1], LC[2]);
    const base = new Uint32Array(NPX), fp = [], fc = [], fb = [], fy = [], ap = [], ad = [], ab = [], cp = [], cu = [], cb = [];
    for (let q = 0; q < ui.idx.length; q++) base[ui.idx[q]] = ui.col[q];
    for (let y = AY0; y < AY0 + AH; y++) for (let x = AX0; x < AX0 + AW; x++) {
      const p = y * GW + x; if (!A[p]) continue;
      if (lead[p]) { base[p] = snLC; continue; }
      const c = v.id[p], rel = dmax[c] ? v.dist[p] / dmax[c] : 0, bi = (y & 3) * 4 + (x & 3);
      fp.push(p); fc.push(c); fb.push(1.12 - 0.34 * rel * rel); fy.push(bi);
      if (!S[p]) { ap.push(p); ad.push(d[p]); ab.push(bay(x, y)); cp.push(p); cu.push(x + y * .9); cb.push(bay(x, y)); }
    }
    // Aura-Kandidaten nach Abstand sortieren (nur Abstand < 255)
    const aStart = new Int32Array(27), cnt = new Int32Array(26);
    for (let k = 0; k < ap.length; k++) if (ad[k] < 255 && ad[k] <= 24) cnt[ad[k]]++;
    for (let k = 0; k < 25; k++) aStart[k + 1] = aStart[k] + cnt[k];
    aStart[26] = aStart[25];
    const apS = new Int32Array(aStart[25]), abS = new Float64Array(aStart[25]), fill = aStart.slice(0, 25);
    for (let k = 0; k < ap.length; k++) if (ad[k] < 255 && ad[k] <= 24) { const j = fill[ad[k]]++; apS[j] = ap[k]; abS[j] = ab[k]; }
    const cuA = Float64Array.from(cu);
    return { base, fp: Int32Array.from(fp), fc: Int16Array.from(fc), fb: Float64Array.from(fb), fy: Uint8Array.from(fy), kf: new Float32Array(n), tab: new Uint32Array(n * 256),
      ap: apS, ab: abS, aStart, cp: Int32Array.from(cp), cu: cuA, cb: Float64Array.from(cb), beam: bucketsOf(cuA, cuA.length), spk: {} };
  }
  /** Farbe einer Glasflaeche: Zelle `col`, Helligkeitsstufe L (Siebtel), Bayer-Stelle bi */
  function stainPx(pre, col, L, bi, key) {
    let m = L / 7; m += ((BAY[bi] + 0.5) / 16 - .5) * .09;
    let r = col[0] * m, g = col[1] * m, b = col[2] * m;
    if (m > 1.04) { const w = Math.min(1, (m - 1.04) * 2.2); r = lerp(r, 255, w * .6); g = lerp(g, 246, w * .6); b = lerp(b, 214, w * .55); }
    const vv = sn(r, g, b); if (L >= 0 && L < 16) pre.tab[key] = vv; return vv;
  }
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
  function inkLayers(maskCv, K, kindOf, gap, clearRects, minusCv, pad) {
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
      const pd = pad | 0, w = x1 - x0 + 1 + 2 * pd, h = b - a + 1 + 2 * pd;   // pad: Rand in Pixeln um die Tinte (Umbra: Platz fuer den Kontursaum)
      for (let y = a; y <= b; y++) for (let x = x0; x <= x1; x++) if (d[(y * W + x) * 4 + 3] > 100) list.push(x - x0 + pd, y - a + pd);
      const [cv, cx] = cv2d(w, h);
      out.push({ kind: kindOf(gi, a), x0: x0 - pd, y0: a - pd, w, h, U: K, list: Int16Array.from(list), gy0: 0, gh: h, cv, cx, im: cx.createImageData(w, h), data: null });
      out[out.length - 1].data = out[out.length - 1].im.data; out[out.length - 1].d32 = new Uint32Array(out[out.length - 1].data.buffer);
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
    const noText = !!FX[sp.fx].noText;   // Effekt ohne eigene Text-Ebenen (Prismatic): Name/Werte/Regeltext bleiben das Basisbild
    const nameL = noText ? [] : inkLayers(core.masks.name, K, (gi, y) => (gi === 0 && y < 150 * K / 5 ? 'name' : 'stats'), 14, stampRects(K), null, sp.fx === 'umbra' ? K : 0);
    const bodyL = sp.body ? inkLayers(core.masks.body, K, () => 'body', 40, null, core.masks.name) : [];
    const layers = nameL.concat(bodyL);
    markLightPlates(layers, img, K);
    if (sp.fx === 'umbra') for (const lay of layers) umbraLayerPre(lay, img, K);
    const view = { K, W, H, layers, layers0: layers, cut: null, rim: null };
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
        let rx0 = W, ry0 = H, rx1 = 0, ry1 = 0;
        view.rim = [0, 1].map(pu => {
          const [rc, rg] = cv2d(W, H), cA = rgbStr(pu ? [190, 130, 250] : [150, 100, 235]), cB = rgbStr(pu ? [104, 56, 176] : [86, 38, 124]), cw = aw / e.w, ch = ah / e.h, mn = e.mn;
          for (let yy = 0; yy < e.h; yy++) for (let xx = 0; xx < e.w; xx++) {
            if (mn[yy * e.w + xx]) continue; let nb = false;
            if (xx > 0 && mn[yy * e.w + xx - 1]) nb = true; if (xx < e.w - 1 && mn[yy * e.w + xx + 1]) nb = true; if (yy > 0 && mn[(yy - 1) * e.w + xx]) nb = true; if (yy < e.h - 1 && mn[(yy + 1) * e.w + xx]) nb = true;
            if (!nb) continue;
            if (core.full) { const gx = Math.min(GW - 1, Math.floor((xx + .5) / e.w * GW)), gy = Math.min(GH - 1, Math.floor((yy + .5) / e.h * GH)); if (!core.A[gy * GW + gx]) continue; }
            const fx = ax + Math.round(xx * cw), fy = ay + Math.round(yy * ch), fw = Math.ceil(cw), fh = Math.ceil(ch);
            rg.fillStyle = ((xx + yy + pu) & 1) ? cA : cB; rg.fillRect(fx, fy, fw, fh);
            if (fx < rx0) rx0 = fx; if (fy < ry0) ry0 = fy; if (fx + fw > rx1) rx1 = fx + fw; if (fy + fh > ry1) ry1 = fy + fh;
          }
          return rc;
        });
        view.rimBox = [Math.max(0, rx0), Math.max(0, ry0), Math.min(W, rx1) - Math.max(0, rx0), Math.min(H, ry1) - Math.max(0, ry0)];
      }
    }
    return view;
  }
  /** Glas im Pixelraster der Kunst: je Kunstpixel eine Farbe (dunkle Pixel = Bleirute), auf der Leinwand der Karte (nur Stained).
   *  Die Leinwand enthaelt hier nur das mit ganzzahligem K hart vergroesserte Raster (Pixel (x, y) = Rasterzelle (x / K, y / K)); darum wird in den Rasterzellen
   *  gerechnet (je Kunstpixel-Zelle gewichtete Summen ueber die ueberdeckten Rasterzellen, Gewichte = Zahl der Leinwandpixel) und das Ergebnis als Bild
   *  des Bildfelds geschrieben — ohne die Leinwand zurueckzulesen. Ergebnis pixelgleich zum Auslesen und Zellenweise-Fuellen. */
  const CLAMP8 = new Uint8ClampedArray(1);
  function quantPre(core, view) {
    const e = core.e, K = view.K, full = core.full, ox = full ? 0 : 14 * K, oy = full ? 0 : 34 * K, bw = full ? view.W : 122 * K, bh = full ? view.H : 80 * K;
    const sx = bw / e.w, sy = bh / e.h, A = core.A, qc = [];
    for (let yy = 0; yy < e.h; yy++) for (let xx = 0; xx < e.w; xx++) {
      const x0 = Math.round(xx * sx), x1 = Math.min(bw, Math.round((xx + 1) * sx)), y0 = Math.round(yy * sy), y1 = Math.min(bh, Math.round((yy + 1) * sy)); if (x1 <= x0 || y1 <= y0) continue;
      if (full) { const gx = Math.min(GW - 1, Math.floor((x0 + x1) / 2 / K)), gy = Math.min(GH - 1, Math.floor((y0 + y1) / 2 / K)); if (!A[gy * GW + gx]) continue; }
      qc.push(x0, x1, y0, y1);
    }
    const nc = qc.length >> 2, gx0 = ox / K, gy0 = oy / K;
    const colGx = new Int32Array(bw), rowG = new Int32Array(bh);
    for (let x = 0; x < bw; x++) colGx[x] = gx0 + Math.floor(x / K);
    for (let y = 0; y < bh; y++) rowG[y] = (gy0 + Math.floor(y / K)) * GW;
    const cOff = new Int32Array(nc + 1), cp = [], cw = [], covered = full ? new Uint8Array(bw * bh) : null;   // ohne Vollbild bilden die Zellen das Bildfeld lueckenlos (Raender aus Rundung)
    for (let q = 0; q < nc; q++) {
      const x0 = qc[q * 4], x1 = qc[q * 4 + 1], y0 = qc[q * 4 + 2], y1 = qc[q * 4 + 3];
      for (let gy = Math.floor(y0 / K); gy <= Math.floor((y1 - 1) / K); gy++) {
        const wy = Math.min(y1, (gy + 1) * K) - Math.max(y0, gy * K);
        for (let gx = Math.floor(x0 / K); gx <= Math.floor((x1 - 1) / K); gx++) { const wx = Math.min(x1, (gx + 1) * K) - Math.max(x0, gx * K); cp.push((gy0 + gy) * GW + gx0 + gx); cw.push(wx * wy); }
      }
      cOff[q + 1] = cp.length;
      if (covered) for (let y = y0; y < y1; y++) covered.fill(1, y * bw + x0, y * bw + x1);
    }
    const unc = [], uncG = [];
    if (covered) for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) if (!covered[y * bw + x]) { unc.push(y * bw + x); uncG.push(rowG[y] + colGx[x]); }
    const id = new ImageData(bw, bh);
    return { K, ox, oy, bw, bh, qc: Int32Array.from(qc), nc, colGx, rowG, cOff, cp: Int32Array.from(cp), cw: Int32Array.from(cw), unc: Int32Array.from(unc), uncG: Int32Array.from(uncG), id, q32: new Uint32Array(id.data.buffer) };
  }
  function quantize(core, view, g, o) {
    const Q = view.qd || (view.qd = quantPre(core, view)), { bw, qc, nc, colGx, rowG, cOff, cp, cw, q32 } = Q;
    if (!Q.solid) {   // welche Kunstpixel-Zellen liegen ganz auf gezeichneten Rasterzellen? (die Deckung des Rasters aendert sich von Bild zu Bild nicht)
      Q.solid = new Uint8Array(nc);
      for (let q = 0; q < nc; q++) { let all = 1; for (let j = cOff[q]; j < cOff[q + 1]; j++) if (!o[cp[j]]) { all = 0; break; } Q.solid[q] = all; }
    }
    for (let q = 0; q < nc; q++) {
      const x0 = qc[q * 4], x1 = qc[q * 4 + 1], y0 = qc[q * 4 + 2], y1 = qc[q * 4 + 3];
      let nn = 0, nl = 0, lr = 0, lg = 0, lb = 0;
      for (let j = cOff[q]; j < cOff[q + 1]; j++) {
        const v = o[cp[j]]; if (!v) continue;
        const w = cw[j], r = v & 255, gg = (v >> 8) & 255, b = (v >> 16) & 255; nn += w;
        if (r + gg + b < 165) { nl += w; lr += w * r; lg += w * gg; lb += w * b; }
      }
      let col = 0;
      if (nn) {
        let r, gc, b;
        if (nl / nn >= 0.32) { r = lr / nl; gc = lg / nl; b = lb / nl; }
        else {
          const cx = (x0 + x1) >> 1, cy = (y0 + y1) >> 1; let best = -1, bv = 0;
          for (let dy = -2; dy <= 2 && best < 0; dy++) for (let dx = -2; dx <= 2; dx++) {
            const xx2 = Math.min(x1 - 1, Math.max(x0, cx + dx)), yy2 = Math.min(y1 - 1, Math.max(y0, cy + dy)), gi = rowG[yy2] + colGx[xx2], v = o[gi];
            if (v && (v & 255) + ((v >> 8) & 255) + ((v >> 16) & 255) >= 165) { best = gi; bv = v; break; }
          }
          if (best < 0) bv = o[rowG[(y0 + y1) >> 1] + colGx[(x0 + x1) >> 1]];
          r = bv & 255; gc = (bv >> 8) & 255; b = (bv >> 16) & 255;
        }
        CLAMP8[0] = r; const r8 = CLAMP8[0]; CLAMP8[0] = gc; const g8 = CLAMP8[0]; CLAMP8[0] = b; const b8 = CLAMP8[0];
        col = (0xFF000000 | (b8 << 16) | (g8 << 8) | r8) >>> 0;
      }
      if (Q.solid[q]) { for (let y = y0; y < y1; y++) for (let x = y * bw + x0, xe = y * bw + x1; x < xe; x++) q32[x] = col; }
      else for (let y = y0; y < y1; y++) { const rb = y * bw, gb = rowG[y]; for (let x = x0; x < x1; x++) q32[rb + x] = o[gb + colGx[x]] ? col : 0; }
    }
    const { unc, uncG } = Q; for (let k = 0; k < unc.length; k++) q32[unc[k]] = o[uncG[k]];
    g.putImageData(Q.id, Q.ox, Q.oy);
  }

  // ═══════════ Ein Bild zeichnen ═══════════
  const gridCv = { c: null, g: null, im: null, o32: null };
  function gridBuf() {
    if (!gridCv.c) { const [c, g] = cv2d(GW, GH); gridCv.c = c; gridCv.g = g; gridCv.im = g.createImageData(GW, GH); gridCv.o32 = new Uint32Array(gridCv.im.data.buffer); }
    return gridCv;
  }
  const stampCv = { c: null, g: null, im: null };
  const FILL_CSS = Object.create(null);
  function makeE(core, view) { const E = Object.create(core); E.layers = view.layers; E.layers0 = view.layers; return E; }
  function render(core, view, g, t) {
    const sp = core.sp, K = view.K, W = view.W, H = view.H, E = view.E || (view.E = makeE(core, view));
    setGeo(core.full);
    if (!core.st && FX[sp.fx].prep) { core.st = FX[sp.fx].prep(E); }
    const st = core.st;
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, W, H);
    // 1) Raster-Effekt
    const gb = gridBuf(), o = gb.o32; o.fill(0);
    if (!FX[sp.fx].textFull) for (const l of view.layers) l.d32.fill(0);
    FX[sp.fx].frame(E, st, t, o);
    g.imageSmoothingEnabled = false;
    if (!FX[sp.fx].gridless) { gb.g.putImageData(gb.im, 0, 0); g.drawImage(gb.c, 0, 0, GW, GH, 0, 0, W, H); }   // gridless: der Effekt schreibt nichts ins Raster (nur Text und Stempel)
    if (sp.quant) quantize(core, view, g, o);
    if (view.rim) { const bx = view.rimBox; if (bx[2] > 0 && bx[3] > 0) g.drawImage(view.rim[Math.floor(t * 4) % 6 < 3 ? 1 : 0], bx[0], bx[1], bx[2], bx[3], bx[0], bx[1], bx[2], bx[3]); }
    if (view.cut) g.drawImage(view.cut.cv, view.cut.x, view.cut.y);
    // 2) Text-Ebenen (neu gefärbte Tinte)
    for (const l of view.layers) { l.cx.putImageData(l.im, 0, 0); g.drawImage(l.cv, l.x0, l.y0); }
    // 3) Stempel / Icon unten rechts (5x5 Zellen zu 9 Kartenpixeln)
    const gp = FX[sp.fx].glint ? FX[sp.fx].glint(t) : [], k5 = K / 5;
    let lastV = -1;   // fillStyle nur setzen, wenn sich die Farbe aendert (jedes Setzen laeuft durch den Palettenfilter)
    const cell = (i, j, c) => { const x0 = Math.round((689 + 9 * i) * k5), x1 = Math.round((689 + 9 * (i + 1)) * k5), y0 = Math.round((989 + 9 * j) * k5), y1 = Math.round((989 + 9 * (j + 1)) * k5); const v = sn(c[0], c[1], c[2]); if (v !== lastV) { lastV = v; g.fillStyle = FILL_CSS[v] || (FILL_CSS[v] = 'rgb(' + (v & 255) + ',' + ((v >> 8) & 255) + ',' + ((v >> 16) & 255) + ')'); } g.fillRect(x0, y0, x1 - x0, y1 - y0); };
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
  const runSync = gen => { let r; do { r = gen.next(); } while (!r.done); return r.value; };
  const yieldMain = (() => { try { const ch = new MessageChannel(); let q = []; ch.port1.onmessage = () => { const f = q; q = []; for (const r of f) r(); }; return () => new Promise(r => { q.push(r); ch.port2.postMessage(0); }); } catch (e) { return () => new Promise(r => setTimeout(r, 0)); } })();
  /** Generator in Zeitscheiben laufen lassen (zwischen den Scheiben bekommt der Hauptfaden Luft); `alive()` falsch: abbrechen (undefined) */
  async function runSliced(gen, core, alive) {
    for (;;) {
      setGeo(core.full);
      const r = gen.next(); if (r.done) return r.value;
      await yieldMain(); if (!alive()) return undefined;
    }
  }
  /** Schwere Erstberechnung des Effekts (Stained: Glasscheiben, Bleiruten) in Zeitscheiben, bevor das erste Bild gezeichnet wird */
  async function ensureSt(core, view, alive) {
    const fx = FX[core.sp.fx]; if (core.st || !fx.prepG) return true;
    const st = await runSliced(fx.prepG(view.E || (view.E = makeE(core, view))), core, alive);
    if (st === undefined) return false;
    if (!core.st) core.st = st;
    return true;
  }
  /** Danach die einmaligen Tabellen des ersten Bildes (Glas, Quantisierung) in eigenen Scheiben, nicht im ersten Zeichnen */
  async function warmView(core, view, alive) {
    const fx = FX[core.sp.fx];
    if (fx.warm && core.st && !core.st.pre) { setGeo(core.full); fx.warm(view.E || (view.E = makeE(core, view)), core.st); await yieldMain(); if (!alive()) return false; }
    if (core.sp.quant && !view.qd) { view.qd = quantPre(core, view); await yieldMain(); if (!alive()) return false; }
    return true;
  }
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
          await yieldMain(); if (my !== this.token || this.dead) return;   // Erstberechnung in Scheiben: dem Hauptfaden zwischen den Schritten Luft lassen
        }
        // Zielgröße der sichtbaren Leinwand: in Kleinansichten (Anzeige deutlich schmaler als die K-Leinwand) wird glatt auf Gerätepixel
        // heruntergerechnet — wie der Browser es beim Basisbild tut. Die Nearest-Skalierung des Browsers würde Zeilen/Spalten des Textes
        // und der Raster verschlucken (Text unleserlich, Dithering als grobes Punktraster) und deckt sich dann nicht mit der Basiskarte.
        const devW = Math.round(css * dprNow()), W = GW * K, H = GH * K;
        const tw = devW < W * 0.8 ? Math.max(48, devW) : W, th = tw === W ? H : Math.round(tw * GH / GW);
        const sk = ck + '|' + K + '|' + tw;
        this.core = core; this.tw = tw; this.th = th; this.W = W; this.H = H;
        if (!this.canvas) this.mkCanvas();
        if (this.canvas.width !== tw || this.canvas.height !== th) { this.canvas.width = tw; this.canvas.height = th; this.g.imageSmoothingEnabled = false; }   // beide prüfen: eine frische Canvas ist 300 x 150, bei K = 2 stimmt die Breite schon
        this.K = K;
        if (!this.animated) {
          let still = lruGet(stillCache, sk);
          if (!still) {
            const view = buildView(core, img, K), [c, g] = cv2d(W, H);
            await yieldMain(); if (my !== this.token || this.dead) return;
            if (!(await ensureSt(core, view, () => !this.dead && my === this.token)) || !(await warmView(core, view, () => !this.dead && my === this.token))) return;
            render(core, view, g, SPEC[rarity].still); still = tw === W ? c : downscale(c, tw, th); stats.stills++;
            lruSet(stillCache, sk, still, STILL_MAX);
          }
          this.g.clearRect(0, 0, tw, th); this.g.drawImage(still, 0, 0); this.view = null; this.drawn = true;
        } else {
          const view = buildView(core, img, K);
          await yieldMain(); if (my !== this.token || this.dead) return;
          if (!(await ensureSt(core, view, () => !this.dead && my === this.token)) || !(await warmView(core, view, () => !this.dead && my === this.token))) return;
          this.view = view; this.phase = (hash(card.name.length, card.name.charCodeAt(0) || 1, 3) * 6) | 0; this.lastF = -1;
          if (tw !== W) { const [oc, og] = cv2d(W, H); og.imageSmoothingEnabled = false; this.off = oc; this.og = og; } else { this.off = null; this.og = null; }
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
        this.host.appendChild(c); this.canvas = c; this.g = c.getContext('2d'); this.g.imageSmoothingEnabled = false;
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
