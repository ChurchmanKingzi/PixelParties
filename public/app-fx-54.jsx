// app-fx-54: ERGEBNIS-ZEREMONIE — Sieg / Niederlage / Rätsel-Ergebnis als Pixelart-Inszenierung (Kulisse, Banner, Funken, Belohnungsliste)
//
// ═════════════════════════════════════════════════════════════════
//  Vorlage: Prototyp „Sieg/Niederlage v2“ (Zeichenroutinen dort `WinFx`). Ersetzt die Optik von `ResultCeremony` (früher app-board.jsx, Titel in Press Start 2P, CSS-Streifen, Münzregen aus DOM-Knoten).
//  SCHICHTEN (zwei Leinwände im Raster-Takt + DOM):
//    · KULISSE (deckend): Strahlenkranz + Tunnel-Ringe (Sieg: Gold-Rampe der festen Gold-Farben, `data/palette-fest.json`; Niederlage: kaltes Blau, Hoffnungsstreifen), Bayer-Dither über die Rampe.
//      Lookup-Tabellen (Winkel, Log-Radius, Falloff) einmal je Größe, scheibenweise im Takt aufgebaut; danach je Bild nur Nachschlagen. Nach dem Intro (Sieg 6,5 s, Niederlage 4,2 s) wird die Kulisse EINGEFROREN
//      (kein Neumalen im Leerlauf).
//    · VORDERGRUND (transparent): Sterne, Feuerwerk-Salven, Konfetti-Kanonen + Dauer-Konfetti, Münzregen, Regen/Asche, Helden (nur wenn seitlich Platz ist), Banner (Stempel-Buchstaben mit Schockringen, Kamera-Stoß,
//      Glanzfahrt; Niederlage: Buchstaben krachen herein, brechen an den Rändern ab, Risse, Splitter). Ab 5 s im ruhigen Takt (≈ 12 Hz), nur sichtbar (IntersectionObserver).
//    · DOM: Untertitel/Grund, „Nth victory“-Block, Belohnungsliste (1 Spalte bis 3 Einträge, sonst 2; Handy: Beschreibung weg, in der Spalte scrollbar), Summe (zählt hoch, immer sichtbar), Freischaltungen, Elo,
//      Deck-Auswahl, Knöpfe. Alle Texte Pixel Intv in ganzzahligen Stufen (10,24 / 20,48 / 30,72 px), keine Glättung, kein Schatten (style.css, `.pp-cer`).
//  SCHRIFT: Pixel Intv rastert bei font-size = 10,24 px × n genau n Bildschirmpixel je Schrift-Einheit (Kappenhöhe 7). Die Glyphen werden einmal mit 10,24 px in eine kleine Leinwand gerastert (Schwelle 50 %)
//  und als Zellenmaske gehalten; Banner-Buchstaben (mit Abschrägung/Kontur) sind daraus gebacken — dieselben Formen wie der DOM-Text.
//  ZEIT: Banner-Einschläge Sieg: Buchstabe j bei 0,30 + 0,085·j s (Stempel in 4 Bildern), Niederlage ab 0,55 s (Fallzeit 0,2 s). Belohnungszeilen gestaffelt, Knöpfe spätestens bei 1,4 s (Sieg 1,1–1,2 s), klickbar sofort.
//  TON: je Buchstabe `heavy_impact`, `reveal` (Sieg) / `jumpscare` + `hero_death` (Niederlage), je Zeile `gold_gain`, `ping` bei den Knöpfen — alles mit `volume` gedeckelt. Die Fanfare (`victory`/`defeat` bzw. BGM) startet wie bisher in
//  app-board.jsx und wird hier weder gestoppt noch doppelt gespielt.
//  VORBACKEN: `ppFx54Vorbacken()` (aus dem Brett, im Leerlauf ~3 s nach Spielstart): Glyphen rastern + Banner-Sprites für „VICTORY“/„DEFEAT“ in der Größe des Fensters (scheibenweise, `requestIdleCallback`).
//  RÜCKFALL (`ppFx54Statisch()`: Retro, `__ppFxAlt`, „Play Animations aus“, reduzierte Bewegung): ein stehendes Bild (Kulisse einfach, Banner fertig, keine Teilchen) — MIT Liste, Summe und Knöpfen.
//  Handy (`battle-lite`): Raster ≥ 2 CSS-px je Zelle (Grid ≤ 640×360), Banner s=4, weniger Teilchen, eine Feuerwerksalve, kein Tunnel-Dauerlauf, keine Beschreibungen.
//  Test: `window.__ppFx54Zeiten = []` vor dem Einhängen → je Bild { t, ms, bg, banner, fg } (ms); `window.__ppFx54Aus = true` → die statische Fassung.
// ═════════════════════════════════════════════════════════════════
(function (root) {
  const TAKT = 30;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rd = Math.round, fl = Math.floor;
  const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
  function H(a, b) {
    let h = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x7f4a7c15, 0xc2b2ae35);
    h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }
  const P = {
    T0_SIEG: 0.30, GAP_SIEG: 0.085, T0_NIEDER: 0.55, GAP_NIEDER: 0.09, STAMP: 4,   // Abstand je Buchstabe in s (Sieg / Niederlage)
    ALPHA_GAMMA: 1.3,                                                              // Dither-Dichte halbtransparenter Pixel: (a/255)^1,3 (lichtere Wolken) bei Sheets mit festem Körper; Geister (fast nur Halbtransparenz) ohne Gamma; die Kontur bleibt unberührt
    HELD_FRAME: 1.25,                                                              // Idle-Frame-Dauer der Helden = Sheet-Wert (90 ms, wie HeroIdleSprite im Brett) × 1,25

    IDLE_AB: 5.0, IDLE_HZ: 12, SPRUNG_HZ: 20, FREEZE_SIEG: 6.5, FREEZE_NIEDER: 4.2,
    SPIN0: 190, SPIN_TAU: 1.1, RING0: 210, RING_TAU: 1.5,
    STERNE: 90, KONFETTI: 46, MUENZEN: 12, SALVE: 46, FW_INTERVALL: 3.4, FW_AB: 3.0, SHINE: 4.2,
  };

  // ── Palette (Laufzeit-Einrastung, window.ppSnapRgb aus palette.js); feste Gold-Farben liegen exakt in der Palette ──
  const hex2 = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const snap = (hex) => { const c = hex2(hex); return window.ppSnapRgb ? window.ppSnapRgb(c[0], c[1], c[2]).slice(0, 3) : c; };
  let C = null, RAMP_SIEG = null, RAMP_NIEDER = null;
  function farben() {
    if (C) return C;
    const CN = { glanz: '#f7f7ad', g1: '#fad54a', g2: '#f29a3e', g3: '#ee6428', gK: '#b62600', weiss: '#ffffff', tinte: '#12101f', nacht: '#08060c', schwarz: '#000000',
      rot: '#fe5154', rotD: '#c0141c', dunkelrot: '#8b0d0d', rosa: '#fe6794', cyan: '#66d9ff', lila: '#ba74ff', gruen: '#4ceb70', blau: '#3866f0', grau: '#9aa3b6', mittel: '#686868', rauch: '#3e3e51',
      k3: '#1a1a2e', k4: '#223962', k5: '#405f8c', k6: '#1788bd', k7: '#b4cff8', k8: '#e5edfa' };
    C = {}; for (const k in CN) C[k] = snap(CN[k]);
    RAMP_SIEG = ['#08060c', '#1f0f04', '#311402', '#6a1c14', '#7d3911', '#b62600', '#ee6428', '#f29a3e', '#fad54a', '#f7f7ad', '#ffffff'].map(snap);
    RAMP_NIEDER = ['#08060c', '#08060c', '#12101f', '#1a1a2e', '#223962', '#405f8c', '#1788bd', '#b4cff8', '#e5edfa'].map(snap);
    return C;
  }
  const BAY = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];

  // ── Rastermaler (RGBA-Puffer, Schmutzrechteck) ──
  function maler(buf, gw, gh) {
    const d = { x0: gw, y0: gh, x1: 0, y1: 0 };
    const mark = (x0, y0, x1, y1) => { if (x0 < d.x0) d.x0 = x0; if (y0 < d.y0) d.y0 = y0; if (x1 > d.x1) d.x1 = x1; if (y1 > d.y1) d.y1 = y1; };
    const px = (x, y, c) => { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= gw || y >= gh) return; mark(x, y, x + 1, y + 1); const i = (y * gw + x) * 4; buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = 255; };
    const rect = (x, y, w, h, c) => {
      let x0 = x | 0, y0 = y | 0, x1 = x0 + (w | 0), y1 = y0 + (h | 0);
      if (x0 < 0) x0 = 0; if (y0 < 0) y0 = 0; if (x1 > gw) x1 = gw; if (y1 > gh) y1 = gh; if (x0 >= x1 || y0 >= y1) return;
      mark(x0, y0, x1, y1); const r = c[0], g = c[1], b = c[2];
      for (let j = y0; j < y1; j++) { let i = (j * gw + x0) * 4; for (let q = x0; q < x1; q++, i += 4) { buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = 255; } }
    };
    const disc = (X, Y, r, c) => { for (let yy = -r; yy <= r; yy++) { const xr = rd(Math.sqrt(Math.max(0, r * r + r * 0.6 - yy * yy))); rect(X - xr, Y + yy, 2 * xr + 1, 1, c); } };
    const ell = (cx, cy, rx, ry, th, c, dither) => {
      const n = Math.max(16, rd(Math.max(rx, ry) * 5)); let lx = 1e9, ly = 1e9;
      for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2, x = rd(cx + Math.cos(a) * rx), y = rd(cy + Math.sin(a) * ry); if (x === lx && y === ly) continue; lx = x; ly = y;
        if (dither === 1 && ((x + y) & 1)) continue; if (dither === 2 && ((x & 1) || (y & 1))) continue; rect(x, y, th, th, c); }
    };
    const dith = (cx, cy, rx, ry, level, c) => {
      const x0 = fl(cx - rx), x1 = Math.ceil(cx + rx), y0 = fl(cy - ry), y1 = Math.ceil(cy + ry);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const a = (x - cx) / rx, b = (y - cy) / ry; if (a * a + b * b > 1) continue; if (BAY[y & 3][x & 3] < level) px(x, y, c); }
    };
    const blit = (s, X, Y, fn) => {
      const w = s.w, h = s.h, sd = s.d; X |= 0; Y |= 0;
      for (let j = 0; j < h; j++) { const yy = Y + j; if (yy < 0 || yy >= gh) continue;
        for (let i = 0; i < w; i++) { const xx = X + i; if (xx < 0 || xx >= gw) continue; const k = (j * w + i) * 4, al = sd[k + 3]; if (al === 0 || (al < 255 && (BAY[yy & 3][xx & 3] + 0.5) * 15.9375 >= al)) continue;   // halbtransparente Pixel: Bayer-Dither am Bildschirmraster (deckend oder gar nicht)
          const o = (yy * gw + xx) * 4; const c = fn ? fn(i, j, k) : undefined; if (c === null) continue; if (c) { buf[o] = c[0]; buf[o + 1] = c[1]; buf[o + 2] = c[2]; } else { buf[o] = sd[k]; buf[o + 1] = sd[k + 1]; buf[o + 2] = sd[k + 2]; }
          buf[o + 3] = 255; } }
      mark(Math.max(0, X), Math.max(0, Y), Math.min(gw, X + w), Math.min(gh, Y + h));
    };
    const clear = () => { if (d.x1 <= d.x0) return; for (let j = d.y0; j < d.y1; j++) buf.fill(0, (j * gw + d.x0) * 4, (j * gw + d.x1) * 4); d.x0 = gw; d.y0 = gh; d.x1 = 0; d.y1 = 0; };
    return { px, rect, disc, ell, dith, blit, clear, d };
  }

  // ── Schrift „Pixel Intv“: Glyphen einmal mit 10,24 px rastern (1 Schrift-Einheit = 1 Pixel) ──
  const UNIT_PX = 10.24;
  let GLM = null, glmPromise = null;
  function schriftBereit() {
    if (GLM) return Promise.resolve(GLM);
    if (glmPromise) return glmPromise;
    glmPromise = (async () => {
      try { await document.fonts.load(`${UNIT_PX}px "Pixel Intv"`); } catch (e) { /* Rückfall: was da ist */ }
      const cv = document.createElement('canvas'); cv.width = 40; cv.height = 30; const g = cv.getContext('2d', { willReadFrequently: true });
      g.font = `${UNIT_PX}px "Pixel Intv"`; g.textBaseline = 'alphabetic'; g.textAlign = 'left';
      const map = {};
      for (let c = 32; c < 127; c++) {
        const ch = String.fromCharCode(c); g.clearRect(0, 0, 40, 30); g.fillStyle = '#fff'; g.fillText(ch, 8, 18);
        const d = g.getImageData(0, 0, 40, 30).data; let x0 = 99, x1 = -1, y0 = 99, y1 = -1; const on = (x, y) => d[(y * 40 + x) * 4 + 3] >= 128;
        for (let y = 0; y < 30; y++) for (let x = 0; x < 40; x++) if (on(x, y)) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        const adv = Math.round(g.measureText(ch).width) || 7;
        if (x1 < 0) { map[ch] = { w: 0, rows: [], l: 0, y0: 0, adv: adv || 4 }; continue; }
        const rows = []; for (let y = y0; y <= y1; y++) { let r = ''; for (let x = x0; x <= x1; x++) r += on(x, y) ? '#' : '.'; rows.push(r); }
        map[ch] = { w: x1 - x0 + 1, rows, l: x0 - 8, y0: y0 - 11, adv };
      }
      GLM = map; return map;
    })();
    return glmPromise;
  }
  const glyph = (ch) => (GLM && (GLM[ch] || GLM['?'])) || { w: 0, rows: [], l: 0, y0: 0, adv: 4 };

  // ── Banner: Buchstaben-Sprites mit Abschrägung, Kontur, Schatten ──
  const THEMA = {
    sieg: () => ({ hi: C.glanz, l: C.g1, mi: C.g2, da: C.g3, lo: C.gK, kontur: C.gK, aussen: C.tinte, schatten: C.nacht, hiL: C.weiss }),
    nieder: () => ({ hi: snap('#f8b4c8'), l: C.rosa, mi: snap('#ec2d62'), da: snap('#ae264c'), lo: C.dunkelrot, kontur: snap('#55011a'), aussen: C.nacht, schatten: C.schwarz, hiL: snap('#fae5eb') }),
    weiss: () => ({ hi: C.weiss, l: C.weiss, mi: C.weiss, da: C.weiss, lo: C.weiss, kontur: C.weiss, aussen: C.weiss, schatten: C.weiss, hiL: C.weiss }),
  };
  const bakeCache = new Map();
  function maske(ch, s) {
    const gl = glyph(ch), w = Math.max(1, gl.w) * s, h = Math.max(1, gl.rows.length) * s, m = new Uint8Array(w * h);
    gl.rows.forEach((row, y) => { for (let x = 0; x < gl.w; x++) if (row[x] === '#') for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) m[(y * s + j) * w + x * s + i] = 1; });
    return { m, w, h };
  }
  function backe(ch, s, thName) {
    const k = ch + '|' + s + '|' + thName; let r = bakeCache.get(k); if (r) return r;
    const th = THEMA[thName](), { m, w, h } = maske(ch, s), Pd = 5, W = w + 2 * Pd + 4, Hh = h + 2 * Pd + 5;
    const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : m[y * w + x];
    const dat = new Uint8ClampedArray(W * Hh * 4), kind = new Uint8Array(W * Hh);
    const set = (x, y, c, kd) => { const i = (y * W + x) * 4; dat[i] = c[0]; dat[i + 1] = c[1]; dat[i + 2] = c[2]; dat[i + 3] = 255; kind[y * W + x] = kd; };
    const e = Math.max(1, rd(s / 4)), e2 = Math.max(1, rd(s / 6));
    const dil = (x, y, rr) => { for (let j = -rr; j <= rr; j++) for (let i = -rr; i <= rr; i++) if (at(x + i, y + j)) return 1; return 0; };
    for (let y = -Pd; y < h + Pd; y++) for (let x = -Pd; x < w + Pd; x++) {
      const X = x + Pd, Y = y + Pd; if (X < 0 || Y < 0 || X >= W || Y >= Hh) continue; if (at(x, y)) continue;
      if (dil(x, y, 1)) set(X, Y, th.kontur, 2); else if (dil(x, y, 2)) set(X, Y, th.aussen, 3); else if (dil(x - 3, y - 3, 2) || dil(x - 2, y - 3, 2)) set(X, Y, th.schatten, 4);
    }
    const up = new Int16Array(w * h), lf = new Int16Array(w * h), dn = new Int16Array(w * h), rt = new Int16Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (at(x, y)) { up[y * w + x] = at(x, y - 1) ? up[(y - 1) * w + x] + 1 : 0; lf[y * w + x] = at(x - 1, y) ? lf[y * w + x - 1] + 1 : 0; }
    for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) if (at(x, y)) { dn[y * w + x] = at(x, y + 1) ? dn[(y + 1) * w + x] + 1 : 0; rt[y * w + x] = at(x + 1, y) ? rt[y * w + x + 1] + 1 : 0; }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (at(x, y)) {
      const i = y * w + x; let c; const fy = y / h;
      if (up[i] < e) c = (lf[i] < e2 || rt[i] < 1) ? th.hiL : th.hi; else if (lf[i] < e2) c = th.hi; else if (dn[i] < e) c = th.lo; else if (rt[i] < e2) c = th.da;
      else { const q = fy + (BAY[y & 3][x & 3] / 16 - 0.5) * 0.07; c = q < 0.34 ? th.l : q < 0.64 ? th.mi : th.da; }
      set(x + Pd, y + Pd, c, 1);
    }
    r = { w: W, h: Hh, d: dat, kind, P: Pd, cw: w, ch: h }; bakeCache.set(k, r); return r;
  }
  const zerbrochen = new Map();
  function zerbrich(spr, seed, buchst) {
    const key = buchst + '|' + seed + '|' + spr.w + '|' + spr.h; if (zerbrochen.has(key)) return zerbrochen.get(key);
    const { w, h, kind, P: Pd, cw, ch } = spr, d = new Uint8ClampedArray(spr.d), k2 = kind.slice(), debris = [];
    const dark = C.nacht, wid = Math.max(1, rd(cw / 24)); let x = Pd + fl(cw * (0.3 + 0.4 * H(seed, 1))), y = Pd;
    while (y < Pd + ch) { for (let q = 0; q < wid; q++) { const xx = x + q; if (xx >= 0 && xx < w && k2[y * w + xx] === 1) { const i = (y * w + xx) * 4; d[i] = dark[0]; d[i + 1] = dark[1]; d[i + 2] = dark[2]; k2[y * w + xx] = 5; } }
      y++; const r = H(seed * 31 + y, 5); x += r < 0.3 ? -1 : r > 0.7 ? 1 : 0; if (H(seed + y, 9) < 0.08) x += (H(seed, y) < 0.5 ? -2 : 2); }
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) { const i = yy * w + xx, kd = k2[i]; if (!kd) continue; const r = H(seed * 977 + xx * 7 + 3, yy);
      if (kd === 2 || kd === 3) { if (r < 0.3) { d[i * 4 + 3] = 0; k2[i] = 0; } }
      else if (kd === 1) { const e = (xx > 0 && k2[i - 1] !== 1 && k2[i - 1] !== 5) || (xx < w - 1 && k2[i + 1] !== 1 && k2[i + 1] !== 5) || (yy > 0 && k2[i - w] !== 1 && k2[i - w] !== 5) || (yy < h - 1 && k2[i + w] !== 1 && k2[i + w] !== 5);
        if (e && r < 0.13) { if (debris.length < 16 && r < 0.07) debris.push({ x: xx, y: yy, c: [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]], vx: (H(seed, xx * 3 + yy) - 0.5) * 30, v0: -10 + H(seed + 1, xx + yy) * 14 }); d[i * 4 + 3] = 0; k2[i] = 0; } } }
    const o = { w, h, d, kind: k2, P: Pd, cw, ch, debris }; zerbrochen.set(key, o); return o;
  }
  function bannerPlan(text, s) {
    const L = []; let pen = 0, minX = 1e9, maxX = -1e9;
    for (const ch of text) { const gl = glyph(ch), sp = gl.w === 0; const x = (pen + gl.l) * s, w = gl.w * s; L.push({ ch, x, w, sp }); if (!sp) { minX = Math.min(minX, x); maxX = Math.max(maxX, x + w); } pen += gl.adv; }
    const total = Math.max(1, maxX - minX), mid = (minX + maxX) / 2; for (const l of L) l.x -= mid;
    return { L, total, s, h: 7 * s };
  }
  const SZ = (s) => [rd(2.5 * s), rd(2.5 * s), rd(1.6 * s), rd(1.25 * s)];

  // ── Teilchen ──
  function schock(m, cx, cy, tau, o) {
    const dur = o.dur || 0.45, R = o.R || 70; if (tau < 0 || tau > dur) return;
    const u = tau / dur, r = 5 + R * easeOut(u), th = u < 0.25 ? 3 : u < 0.6 ? 2 : 1, flat = o.flat || 0.62;
    m.ell(cx, cy, r, r * flat, th, u < 0.2 ? (o.c0 || C.weiss) : u < 0.55 ? (o.c1 || C.glanz) : (o.c2 || C.g2), u < 0.3 ? 0 : (u < 0.65 ? 1 : 2));
    if (u < 0.5 && o.double) m.ell(cx, cy, r * 0.62, r * 0.62 * flat, 1, o.c1 || C.glanz, 1);
  }
  function funken(m, cx, cy, tau, o) {
    const N = o.n || 16, life = o.life || 0.8; if (tau < 0 || tau > life) return;
    const sp = o.speed || 80, k = o.drag || 2.4, g = o.g == null ? 70 : o.g, cols = o.cols || [C.weiss, C.glanz, C.g1, C.g2, C.g3], up = o.up || 0, sd = o.seed || 1, size = o.size || 2;
    for (let i = 0; i < N; i++) {
      const a = (o.ring ? i / N : H(sd, i)) * Math.PI * 2 + (o.ring ? H(sd, 99) * 0.4 : 0), v = sp * (o.ring ? 1 : 0.35 + 0.65 * H(sd + 7, i));
      const q = (1 - Math.exp(-k * tau)) / k, lf = life * (0.7 + 0.3 * H(sd + 3, i)); if (tau > lf) continue;
      const age = tau / lf, ci = Math.min(cols.length - 1, fl(age * cols.length));
      const x = cx + Math.cos(a) * v * q, y = cy + Math.sin(a) * v * q * (o.flat || 1) + g * tau * tau * 0.5 - up * tau;
      if (age > 0.55 && ((fl(tau * TAKT) + i) & 1)) continue;
      const sz = age < 0.6 ? size : Math.max(1, size - 1); m.rect(rd(x), rd(y), sz, sz, cols[ci]);
      if (o.trail && age < 0.7) for (let t2 = 1; t2 <= o.trail; t2++) { const tt = Math.max(0, tau - t2 * 0.035), qq = (1 - Math.exp(-k * tt)) / k;
        if ((t2 + i) & 1) m.rect(rd(cx + Math.cos(a) * v * qq), rd(cy + Math.sin(a) * v * qq * (o.flat || 1) + g * tt * tt * 0.5 - up * tt), 1, 1, cols[Math.min(cols.length - 1, ci + t2)]); }
    }
  }
  const fwCols = (i) => [[C.weiss, C.glanz, C.g1, C.g2, C.g3], [C.weiss, snap('#f9b3b3'), C.rot, C.rotD, C.dunkelrot], [C.weiss, snap('#b6eff7'), C.cyan, C.blau, snap('#02398c')],
    [C.weiss, snap('#d6bbf1'), C.lila, snap('#702db3'), snap('#401a66')], [C.weiss, snap('#b3f9cf'), C.gruen, snap('#20ac37'), snap('#167927')], [C.weiss, C.rosa, snap('#ec2d62'), snap('#ae264c'), snap('#4b1021')]][((i % 6) + 6) % 6];
  function feuerwerk(m, tau, o) {
    if (tau < 0) return; const rise = 0.55, cols = fwCols(o.set || 0), sd = o.seed || 1;
    if (tau < rise) {
      const u = easeOut(tau / rise), x = lerp(o.x0, o.x, u) + Math.sin(tau * 18 + sd) * 1.2, y = lerp(o.y0, o.y, u); m.rect(rd(x), rd(y), 2, 3, C.weiss);
      for (let k = 1; k < 9; k++) { const uu = easeOut(Math.max(0, tau - k * 0.022) / rise); if ((k + fl(tau * TAKT)) & 1) m.rect(rd(lerp(o.x0, o.x, uu) + Math.sin((tau - k * 0.022) * 18 + sd) * 1.2), rd(lerp(o.y0, o.y, uu)), 1, 1, k < 4 ? C.g1 : C.g3); }
      return;
    }
    const b = tau - rise, n = o.n || 30, sz = o.size || 2;
    if (b < 0.07) { const r = 3 + b * 80; m.rect(rd(o.x - r), rd(o.y - 1), rd(2 * r), 2, C.weiss); m.rect(rd(o.x - 1), rd(o.y - r), 2, rd(2 * r), C.weiss); m.disc(rd(o.x), rd(o.y), 3, C.weiss); }
    if (o.art === 'weide') funken(m, o.x, o.y, b, { n, life: 1.7, speed: 78, drag: 1.7, g: 34, cols: [C.weiss, cols[1], cols[2], cols[2], cols[3], cols[4]], seed: sd, trail: 3, size: sz });
    else if (o.art === 'ring') { funken(m, o.x, o.y, b, { n, life: 1.15, speed: 92, drag: 2.3, g: 40, cols, seed: sd, ring: true, flat: 0.8, trail: 2, size: sz }); funken(m, o.x, o.y, b, { n: fl(n / 2), life: 0.95, speed: 46, drag: 2.3, g: 40, cols: [cols[0], cols[2], cols[3]], seed: sd + 5, ring: true, flat: 0.8, size: Math.max(1, sz - 1) }); }
    else funken(m, o.x, o.y, b, { n, life: 1.25, speed: 100, drag: 2.5, g: 52, cols, seed: sd, trail: 2, size: sz });
  }
  const konfFarben = () => [C.rot, C.g1, C.cyan, C.lila, C.gruen, C.weiss, C.rosa, C.g3];
  function konfettiSchleife(m, t, gw, gh, n) {
    const cols = konfFarben(), span = gh + 24;
    for (let i = 0; i < n; i++) {
      const v = lerp(26, 44, H(i, 3)), y = ((H(i, 4) * span + t * v) % span) - 10, x = H(i, 5) * gw + Math.sin(t * (0.7 + H(i, 7) * 1.5) + H(i, 8) * 6.28) * (4 + H(i, 6) * 9);
      const f4 = (fl(t * (5 + H(i, 9) * 5)) + i) & 3, c = cols[fl(H(i, 10) * cols.length)], w = (f4 === 0 ? 3 : f4 === 2 ? 1 : 2) + 1, h = (f4 === 0 ? 1 : f4 === 2 ? 3 : 2) + 1;
      m.rect(rd(x) + 1, rd(y) + 1, w, h, C.nacht); m.rect(rd(x), rd(y), w, h, c); if (f4 === 1 || f4 === 3) m.px(rd(x) + 1, rd(y) + 1, C.weiss);
    }
  }
  function konfettiSalve(m, tau, o) {
    if (tau < 0 || tau > 3.2) return; const cols = konfFarben();
    for (let i = 0; i < o.n; i++) {
      const a = o.a + (H(o.seed, i) - 0.5) * o.spread, v = o.v * (0.45 + 0.55 * H(o.seed + 1, i)), k = 1.8, q = (1 - Math.exp(-k * tau)) / k;
      const x = o.x + Math.cos(a) * v * q + Math.sin(tau * 3 + i) * 3 * easeOut(tau / 1.5), y = o.y + Math.sin(a) * v * q + 22 * tau * tau * 0.5 + 14 * tau;
      const f4 = fl(tau * 9 + H(o.seed, i + 40) * 4) & 3, w = (f4 === 0 ? 3 : f4 === 2 ? 1 : 2) + 1, h = (f4 === 0 ? 1 : f4 === 2 ? 3 : 2) + 1;
      if (tau > 2.4 && ((i + fl(tau * TAKT)) & 1)) continue; m.rect(rd(x) + 1, rd(y) + 1, w, h, C.nacht); m.rect(rd(x), rd(y), w, h, cols[fl(H(o.seed + 2, i) * cols.length)]);
    }
  }
  function sterne(m, t, gw, gh, n, o) {
    const cols = o.cols || [C.weiss, C.glanz, C.g1, C.weiss];
    for (let i = 0; i < n; i++) {
      const x = fl(H(i, 21) * gw), y = fl(H(i, 22) * gh * o.maxY), per = 1.6 + H(i, 23) * 2.6, ph = ((t / per + H(i, 24)) % 1), st = ph < 0.55 ? 0 : ph < 0.65 ? 1 : ph < 0.8 ? 2 : ph < 0.9 ? 1 : 0;
      if (st === 0) { if (H(i, 25) < 0.55) m.px(x, y, o.dim || C.rauch); continue; }
      const c = cols[i & 3]; if (st === 1) m.px(x, y, c); else { m.px(x, y, C.weiss); m.px(x - 1, y, c); m.px(x + 1, y, c); m.px(x, y - 1, c); m.px(x, y + 1, c); }
    }
  }
  function regen(m, t, gw, gh, n, na) {
    const span = gh + 30;
    for (let i = 0; i < n; i++) {
      const v = lerp(70, 110, H(i, 31)), y = ((H(i, 32) * span + t * v) % span) - 12, x = ((H(i, 33) * (gw + 60)) - t * 14 * (0.5 + H(i, 34)) + gw * 4) % (gw + 60) - 20, l = 2 + fl(H(i, 36) * 3);
      m.rect(rd(x), rd(y), 1, l, H(i, 35) < 0.5 ? C.k6 : C.k5); if (H(i, 37) < 0.4) m.px(rd(x), rd(y) + l, C.k6);
    }
    for (let i = 0; i < na; i++) { const v = lerp(7, 16, H(i, 41)), y = ((H(i, 42) * span + t * v) % span) - 10, x = H(i, 43) * gw + Math.sin(t * (0.6 + H(i, 44)) + H(i, 45) * 6.28) * (4 + H(i, 46) * 7); const c = H(i, 47) < 0.5 ? C.mittel : C.rauch; m.px(rd(x), rd(y), c); if (H(i, 48) < 0.3) m.px(rd(x) + 1, rd(y), c); }
  }
  // Münze: der Sprite des Spiels (`/data/sc.png`, wie Shop/Profil/Brett). Fürs Münzregen-Raster wird er einmal auf 14×14 Zellen gemittelt, auf Palettenfarben gerastet (Alpha-Schwelle, kein Alpha-Mischen) und in
  // Breitenstufen „gedreht“; im DOM (Zeilen, Summe) ist es dasselbe Bild als <img>.
  let scImg = null, scLaedt = false, coinFr = null;
  function scLaden() { if (scImg || scLaedt) return; scLaedt = true; const i = new Image(); i.onload = () => { scImg = i; coinFr = null; }; i.src = '/data/sc.png'; }
  function muenzFrames() {
    if (coinFr) return coinFr; if (!scImg) return null; const H0 = 14, out = [];
    for (const w of [14, 10, 6, 3, 2, 3, 6, 10]) {
      const c = document.createElement('canvas'); c.width = w; c.height = H0; const g = c.getContext('2d', { willReadFrequently: true }); g.imageSmoothingEnabled = true; g.drawImage(scImg, 0, 0, scImg.width, scImg.height, 0, 0, w, H0);
      const sd = g.getImageData(0, 0, w, H0).data, d = new Uint8ClampedArray(w * H0 * 4);
      for (let i = 0; i < w * H0; i++) { if (sd[i * 4 + 3] < 140) continue; const q = window.ppSnapRgb ? window.ppSnapRgb(sd[i * 4], sd[i * 4 + 1], sd[i * 4 + 2]) : [sd[i * 4], sd[i * 4 + 1], sd[i * 4 + 2]]; d[i * 4] = q[0]; d[i * 4 + 1] = q[1]; d[i * 4 + 2] = q[2]; d[i * 4 + 3] = 255; }
      out.push({ w, h: H0, d });
    }
    coinFr = out; return out;
  }
  function muenzRegen(m, t, gw, gh, n) {
    const fr = muenzFrames(); if (!fr) return; const span = gh + 40;
    for (let i = 0; i < n; i++) { const v = lerp(34, 58, H(i, 51)), y = ((H(i, 52) * span + t * v) % span) - 20, x = H(i, 53) * gw + Math.sin(t * 1.1 + i) * 6, f = fr[(fl(t * 12) + i) & 7]; m.blit(f, rd(x - f.w / 2), rd(y - 7));
      if (((fl(t * 6) + i) % 9) === 0) { const X = rd(x) + 6, Y = rd(y) - 6; m.px(X, Y, C.weiss); m.px(X - 1, Y, C.glanz); m.px(X + 1, Y, C.glanz); m.px(X, Y - 1, C.glanz); m.px(X, Y + 1, C.glanz); } }
  }
  root.ppFx54MuenzeUrl = () => { scLaden(); return '/data/sc.png'; };

  // ── Helden (Sprite-Sheets des Bretts, `HeroIdleAnims`), ganzzahlig vergrößert, Kontur ──
  function heldDaten(e) {
    try {
      const { img, meta } = e; const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
      // Alpha: Das Brett skaliert die halbtransparenten Pixel (Gas, Rauch, Geister: bei Medea 85 % aller Pixel) nur in der Deckkraft; hier werden sie per Bayer-Dither gezeichnet (keine Schwelle, die sie verwirft).
      // Sichtbar ab a ≥ 8 (Zuschnitt, unterste Zeile). GRÖSSE und Platz richten sich nur nach dem KÖRPER = Pixel mit a ≥ 160 (hat ein Sheet kaum solche Pixel, z. B. Geister: ab a ≥ 64); Aura/Gas darf überstehen
      // (wird beim Zeichnen auf die freie Fläche beschnitten). Die Kontur entsteht nur um Pixel mit a ≥ 160.
      const sd = g.getImageData(0, 0, c.width, c.height).data, fw = meta.frameWidth, fh = meta.frameHeight; let y1 = 0, n160 = 0, nsicht = 0;
      for (let y = 0; y < fh; y++) for (let x = 0; x < c.width; x++) { const al = sd[(y * c.width + x) * 4 + 3]; if (al >= 8) { nsicht++; if (y + 1 > y1) y1 = y + 1; if (al >= 160) n160++; } }
      const TH = n160 >= nsicht * 0.04 ? 160 : 64; let y0 = fh, x0 = fw, x1 = 0; const kol = new Float64Array(fw), spalten = new Float64Array(fw);
      for (let y = 0; y < fh; y++) for (let x = 0; x < c.width; x++) { const al = sd[(y * c.width + x) * 4 + 3], fx = x % fw; spalten[fx] += al / 255; if (al >= TH) { if (y < y0) y0 = y; if (fx < x0) x0 = fx; if (fx + 1 > x1) x1 = fx + 1; kol[fx]++; } }
      if (y0 >= fh) y0 = 0; if (x0 >= x1) { x0 = 0; x1 = fw; }
      const mitte = (arr) => { let ges = 0; for (let i = 0; i < fw; i++) ges += arr[i]; let ak = 0, k5 = 0, k95 = fw - 1; for (let i = 0; i < fw; i++) { ak += arr[i]; if (ak < ges * 0.05) k5 = i + 1; if (ak <= ges * 0.95) k95 = i; } return Math.max(1, k95 - k5 + 1); };
      const ckw = mitte(spalten), kb = mitte(kol);      // ckw: Breite von 90 % der Deckkraft (Schatten); kb: Körperbreite (90 % der Körperpixel)
      // Standlinie wie im Brett (app-board.jsx, `fussY`): `meta.footY`, sonst das unterste deckende Pixel. Was darunter hängt (Medeas Schlangen, Flammen, Schweife), wird gezeichnet, verankert aber nicht den Fuß.
      const fuss = (typeof meta.footY === 'number' && Number.isFinite(meta.footY)) ? meta.footY : y1;
      return { meta, sd, sw: c.width, fw, fh, y0, y1, fuss, cx0: x0, cx1: x1, cw: Math.max(1, x1 - x0), ck: ckw, kb, gamma: TH === 160 ? P.ALPHA_GAMMA : 1, chh: Math.max(1, fuss - y0), n: meta.frames || 1, cache: new Map() };
    } catch (err) { return null; }
  }
  function heldZelle(hd, f, S, tint) {
    const key = f + '|' + S + '|' + tint; let r = hd.cache.get(key); if (r) return r;
    const fw = hd.fw, fh = Math.min(hd.fh, hd.y1 + 1), Pd = 2, W = fw * S + 2 * Pd, Hh = fh * S + 2 * Pd, d = new Uint8ClampedArray(W * Hh * 4), mk = new Uint8Array(W * Hh);
    for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) { const si = (y * hd.sw + f * fw + x) * 4, al = hd.sd[si + 3]; if (al < 8) continue; const ag = al >= 160 ? 255 : Math.max(1, rd(255 * Math.pow(al / 255, hd.gamma))); let c = [hd.sd[si], hd.sd[si + 1], hd.sd[si + 2]];
      if (tint === 'kalt') { const l = (0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]) / 255, rp = RAMP_NIEDER, q = clamp(l * 0.95 + 0.04) * (rp.length - 1), lo = fl(q); c = ((q - lo) > 0.5 && lo + 1 < rp.length) ? rp[lo + 1] : rp[lo]; }
      for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { const o = (y * S + j + Pd) * W + x * S + i + Pd; d[o * 4] = c[0]; d[o * 4 + 1] = c[1]; d[o * 4 + 2] = c[2]; d[o * 4 + 3] = al >= 160 ? 255 : ag; mk[o] = al >= 160 ? 1 : 2; } }
    const ink = C.tinte;
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) if (!mk[y * W + x]) { let n = 0; for (let j = -1; j <= 1 && !n; j++) for (let i = -1; i <= 1; i++) { const xx = x + i, yy = y + j; if (xx >= 0 && yy >= 0 && xx < W && yy < Hh && mk[yy * W + xx] === 1) { n = 1; break; } }
      if (n) { const o = (y * W + x) * 4; d[o] = ink[0]; d[o + 1] = ink[1]; d[o + 2] = ink[2]; d[o + 3] = 255; } }
    r = { w: W, h: Hh, d, Pd, footY: hd.fuss * S + Pd, faceX: rd((hd.meta.faceX || hd.fw / 2) * S) + Pd }; hd.cache.set(key, r); return r;
  }
  // Squash & Stretch in ganzen Zellen: das fertig vergrößerte Bild (Kontur inklusive) wird per Nächster-Nachbar auf (w·sx, h·sy) neu abgetastet — Zeilen/Spalten werden verdoppelt oder ausgelassen, nichts wird
  // gemischt oder gedreht; die Füße (Unterkante der Figur) bleiben am Boden verankert.
  function heldSkal(hd, f, S, tint, sx, sy) {
    const z = heldZelle(hd, f, S, tint); if (sx === 1 && sy === 1) return z;
    const key = f + '|' + S + '|' + tint + '|' + sx + '|' + sy; let r = hd.cache.get(key); if (r) return r;
    // Die Verformung ist auf wenige Sprite-Pixel begrenzt (≤ 5 px in der Breite, ≤ 7 px in der Höhe): breite Sprites (Medeas Schlangen, Flügel, Schweife) werden sonst auseinandergezogen
    const dw = Math.max(-5 * S, Math.min(5 * S, (sx - 1) * z.w)), dh = Math.max(-7 * S, Math.min(7 * S, (sy - 1) * z.h));
    const w2 = Math.max(1, rd(z.w + dw)), h2 = Math.max(1, rd(z.h + dh)), d = new Uint8ClampedArray(w2 * h2 * 4);
    for (let y = 0; y < h2; y++) { const qy = Math.min(z.h - 1, fl((y + 0.5) * z.h / h2)); for (let x = 0; x < w2; x++) { const qx = Math.min(z.w - 1, fl((x + 0.5) * z.w / w2)), a = (qy * z.w + qx) * 4, b = (y * w2 + x) * 4; d[b] = z.d[a]; d[b + 1] = z.d[a + 1]; d[b + 2] = z.d[a + 2]; d[b + 3] = z.d[a + 3]; } }
    r = { w: w2, h: h2, d, footY: rd(z.footY * h2 / z.h), faceX: rd(z.faceX * w2 / z.w) }; hd.cache.set(key, r); return r;
  }
  // Dauer-Hüpfen in unregelmäßigem Rhythmus (deterministisch aus Held-Kennung und Sprungnummer, kein Zufall im Takt): Ein Sprung dauert 0,55 s (Anlauf-Squash 0,07 s → Luft 0,38 s mit Streckung →
  // Landungs-Squash 0,10 s); davor steht der Held 0,15–1,2 s, mit 22 % Wahrscheinlichkeit folgt gleich ein Doppelsprung (keine Pause); Höhe 8–12 Zellen (bei Skalierung 3).
  const SPRUNG_DAUER = 0.55;
  function huepfPose(c, S, hh) {
    if (c < 0.07) return { act: true, hop: 0, sx: 1.16, sy: 0.84 };
    if (c < 0.45) { const u = (c - 0.07) / 0.38, hop = rd(hh * (S / 3) * 4 * u * (1 - u)); return u < 0.5 ? { act: true, hop, sx: 0.88, sy: 1.14 } : u < 0.85 ? { act: true, hop, sx: 0.94, sy: 1.07 } : { act: true, hop, sx: 1, sy: 1 }; }
    const l = c - 0.45; if (l < 0.067) return { act: true, hop: 0, sx: 1.26, sy: 0.76 }; if (l < 0.10) return { act: true, hop: 0, sx: 1.1, sy: 0.91 };
    return { act: true, hop: 0, sx: 1, sy: 1 };
  }
  const STAND = { act: false, hop: 0, sx: 1, sy: 1 };
  /** t = Sekunden seit dem ersten Sprung des Helden; h.seed = Ganzzahl je Held */
  function huepfPlan(h, t) {
    if (t < 0) return STAND;
    const pl = h.plan || (h.plan = [0]);
    while (pl[pl.length - 1] <= t) { const k = pl.length - 1, dbl = H(h.seed, k * 3 + 1) < 0.22; pl.push(pl[k] + SPRUNG_DAUER + (dbl ? 0 : 0.15 + H(h.seed, k * 3 + 2) * 1.05)); }
    let k = pl.length - 2; while (k > 0 && pl[k] > t) k--;
    const c = t - pl[k]; if (c >= SPRUNG_DAUER) return STAND;
    return huepfPose(c, h.S, 8 + fl(H(h.seed, k * 3) * 5));
  }
  function heldZeichne(m, hd, t, x, y, S, o) {
    const f = fl(t * 1000 / ((hd.meta.frameMs || 90) * P.HELD_FRAME)) % hd.n, z = heldSkal(hd, f, S, o.tint || null, o.sx || 1, o.sy || 1), X = rd(x - z.faceX), Y = rd(y - z.footY - (o.hop || 0));
    const cl = o.clip;   // freie Fläche in Zellen: ab der Banner-Unterkante (ya) neben dem Inhalt [xa, xb), darüber neben dem Banner [xaB, xbB); Aura/Gas wird dort abgeschnitten, nicht der Held verkleinert
    m.blit(z, X, Y, cl ? (i, j, k) => { const xx = X + i, yy = Y + j; if (yy < cl.ya ? (xx < cl.xaB || xx >= cl.xbB) : (xx < cl.xa || xx >= cl.xb)) return null; return o.fn ? o.fn(i, j, k) : undefined; } : (o.fn || null));
  }

  // ── Kulisse: Lookup-Tabellen (scheibenweise gebaut), Nachschlagen je Phase ──
  function kulisseNeu(sieg, gw, gh, vx, vy, opt) {
    const n = gw * gh, ang = new Uint16Array(n), lr = new Uint16Array(n), base = new Float32Array(n), fall = new Float32Array(n), vig = new Float32Array(n);
    const R = (opt.R || 0.66) * gw, nr = opt.rays || 20, RAMP = sieg ? RAMP_SIEG : RAMP_NIEDER, K = RAMP.length;
    const rayLUT = new Float32Array(1024), ringLUT = new Float32Array(1024);
    for (let a = 0; a < 1024; a++) { const f = (a / 1024 * nr) % 1, idx = fl(a / 1024 * nr); rayLUT[a] = clamp(1 - Math.abs(f - 0.5) * 2 / 0.6) * (idx & 1 ? 0.62 : 1); }
    for (let a = 0; a < 1024; a++) { const f = (a % 128) / 128; ringLUT[a] = f < 0.2 ? 1 - f / 0.2 : (f > 0.5 && f < 0.58 ? 0.45 : 0); }
    const RAMP32 = new Uint32Array(K); for (let q = 0; q < K; q++) RAMP32[q] = ((255 << 24) | (RAMP[q][2] << 16) | (RAMP[q][1] << 8) | RAMP[q][0]) >>> 0;
    const bay = new Float32Array(16); for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) bay[j * 4 + i] = BAY[j][i] / 16;
    let zeile = 0, out = null;
    const sa = opt.saeule;
    const o = {
      bereit: false,
      /** baut Zeilen, bis das Zeitbudget (ms) aufgebraucht ist */
      bauen(budget) {
        const t0 = performance.now();
        while (zeile < gh && (performance.now() - t0) < budget) {
          const y = zeile++;
          for (let x = 0; x < gw; x++) {
            const i = y * gw + x, dx = x - vx, dy = (y - vy) * 1.12, r = Math.sqrt(dx * dx + dy * dy) + 0.5, a = Math.atan2(dy, dx);
            ang[i] = (((a / (Math.PI * 2)) + 1) % 1) * 1024; lr[i] = clamp(Math.log(r / 4) * 64 + 40, 0, 1023);
            const bb = clamp(1 - r / R); base[i] = bb * bb * Math.pow(bb, 0.1);
            const below = clamp(dy / (gh * 0.55)); fall[i] = clamp(1.15 - r / (gw * 0.55)) * (1 - 0.72 * below) + 0.18;
            const ex = (x - gw / 2) / (gw / 2), ey = (y - gh / 2) / (gh / 2); let v = clamp(1.12 - (ex * ex * 0.55 + ey * ey * 0.7));
            if (sa) v *= 1 - sa.st * clamp((sa.halb + 22 - Math.abs(x - vx)) / 22) * clamp((y - sa.y0) / 10);
            vig[i] = v;
          }
        }
        if (zeile >= gh) o.bereit = true; return o.bereit;
      },
      paint(buf, ph) {
        if (!out) out = new Uint32Array(buf.buffer, buf.byteOffset, n);
        const rp = ph.ray | 0, gp = ph.ring | 0, ra = ph.rayAmp, ga = ph.ringAmp * 0.8, ba = ph.baseAmp, dim = ph.dim == null ? 1 : ph.dim, fla = ph.flash || 0, st = ph.streak, Km1 = K - 1;
        for (let y = 0; y < gh; y++) {
          const by4 = (y & 3) << 2; let i = y * gw, sx = 0, sw = 0, sk = 0; if (st) { sx = st.x + y * 0.05; sw = st.w + y * 0.012; sk = st.amp * (1 - y / gh * 0.55); }
          for (let x = 0; x < gw; x++, i++) {
            const f = fall[i]; let v = base[i] * ba + f * (ra * rayLUT[(ang[i] + rp) & 1023] + ga * ringLUT[(lr[i] + gp) & 1023]);
            if (st) { const dd = x > sx ? x - sx : sx - x; if (dd < sw) v += (1 - dd / sw) * sk; }
            v = v * vig[i] * dim + fla; if (v < 0) v = 0; else if (v > 1) v = 1;
            const pos = v * Km1, lo = pos | 0;
            out[i] = ((pos - lo) > bay[by4 | (x & 3)] && lo < Km1) ? RAMP32[lo + 1] : RAMP32[lo];
          }
        }
      },
    };
    return o;
  }

  // ── Szene: reine Funktion der Zeit ──
  /** o: { sieg, lite, gw, gh, vx, by (Banner-Mitte in Zellen), s, bp, statisch, seiteL, seiteR (freie Breite links/rechts in Zellen), fy (Fußlinie der Helden) } */
  function szeneNeu(o) {
    farben();
    const { sieg, lite, gw, gh, vx, by, s, bp, statisch } = o, k = gw / 640, th = sieg ? 'sieg' : 'nieder';
    const bgImg = new ImageData(gw, gh), fgImg = new ImageData(gw, gh), m = maler(fgImg.data, gw, gh);
    const kul = kulisseNeu(sieg, gw, gh, vx, by, { rays: lite ? 16 : 20, R: sieg ? 0.7 : 0.62, saeule: o.saeule || null });
    const lets = []; let j = 0; const T0 = sieg ? P.T0_SIEG : P.T0_NIEDER, GAP = sieg ? P.GAP_SIEG : P.GAP_NIEDER;
    for (const l of bp.L) { if (l.sp) continue; l.j = j++; l.t0 = T0 + l.j * GAP; l.land = l.t0 + (sieg ? P.STAMP / TAKT : 0.2); lets.push(l); }
    const tL = lets.length ? lets[lets.length - 1].land : T0;
    const shakeEv = lets.map((l, i) => ({ t: l.land, a: (i === lets.length - 1 ? 6 : 3 + (i === 0 ? 1 : 0)) })); if (!sieg) shakeEv.push({ t: tL + 0.05, a: 4 });
    let helden = [];
    const shells = [];
    { const A = (t0, x, y, set, art, n) => shells.push({ t0, x: x * k, y: y * (gh / 360), x0: x * k + (H(set, 3) - 0.5) * 30 * k, y0: gh + 4, set, art, n: lite ? rd(n * 0.55) : n, seed: set * 13 + rd(t0 * 10), size: lite ? 1 : 2 });
      A(tL, 100, 96, 0, 'peony', 30); A(tL + 0.16, 540, 84, 1, 'ring', 30);
      if (!lite) { A(tL + 0.42, 320, 36, 3, 'weide', 26); A(tL + 1.15, 60, 60, 2, 'peony', 28); A(tL + 1.3, 590, 70, 4, 'weide', 26); A(tL + 1.5, 320, 24, 5, 'ring', 30); } else A(tL + 1.2, gw * 0.5 / k, 30, 3, 'weide', 20);
      for (let q = 0; q < 6; q++) A(P.FW_AB + q * P.FW_INTERVALL + H(q, 77) * 0.6, 40 + H(q, 78) * 140 + (q & 1 ? 380 : 0), 40 + H(q, 79) * 70, q + 6, ['peony', 'ring', 'weide'][q % 3], 24); }
    // Klang (Zeit rel. zum Beginn; Lautstärken gedeckelt)
    const klang = [];
    if (sieg) { lets.forEach((l, i) => klang.push([l.land, 'heavy_impact', i === lets.length - 1 ? 0.7 : 0.35])); klang.push([tL, 'reveal', 0.25]); for (const sh of shells) if (sh.t0 + 0.55 < P.FW_AB) klang.push([sh.t0 + 0.55, 'pull_sparkle', 0.2]); }
    else { lets.forEach((l, i) => klang.push([l.land, 'heavy_impact', i === lets.length - 1 ? 0.7 : 0.4])); klang.push([tL + 0.05, 'jumpscare', 0.22]); klang.push([2.45, 'reveal', 0.16]); }
    klang.sort((a, b) => a[0] - b[0]);
    let bgKey = '', letzterT = -1, shine = -1;
    const S = {
      kul, tL, klang, lets, bgImg, fgImg,
      setzeHelden(l) { helden = l; if (!sieg && helden.length && !klang.some((e) => e[1] === 'hero_death')) { klang.push([tL + 0.45, 'hero_death', 0.25]); klang.sort((a, b) => a[0] - b[0]); } },
      shakeAt(t) { let shx = 0, shy = 0; for (const e of shakeEv) { const a = t - e.t; if (a >= 0 && a < 0.45) { const amp = e.a * Math.exp(-a / 0.13), n = fl(a * TAKT); shx += rd(((n & 1) ? 1 : -1) * amp * (H(n, 4) * 0.6 + 0.5)); shy += rd(((n & 2) ? 1 : -1) * amp * 0.7 * (H(n, 5) * 0.6 + 0.4)); } } return [shx, shy]; },
      /** t in Sekunden; ctxBg/ctxFg: 2D-Kontexte (Rasterleinwand); gibt true zurück, wenn der Vordergrund neu gemalt wurde */
      zeichne(t, ctxBg, ctxFg, perf) {
        if (t > P.IDLE_AB) {   // ruhiger Takt; solange ein Sieges-Held springt, 20 Hz (SPRUNG_HZ; vom Nutzer gewählt statt 30 Hz: halber Idle-Verbrauch)
          const t30 = fl(t * P.SPRUNG_HZ) / P.SPRUNG_HZ; let springt = false;
          if (sieg && !statisch) for (const h of helden) if (huepfPlan(h, t30 - (tL + 0.62) - h.ph * 0.6).act) { springt = true; break; }
          t = springt ? fl(t * P.SPRUNG_HZ) / P.SPRUNG_HZ : fl(t * P.IDLE_HZ) / P.IDLE_HZ;
        }
        if (t === letzterT) return false; letzterT = t;
        const tf = Math.min(t, sieg ? P.FREEZE_SIEG : P.FREEZE_NIEDER); let ph;
        if (sieg) {
          const sp = P.SPIN0 * P.SPIN_TAU * (1 - Math.exp(-tf / P.SPIN_TAU)), rg = P.RING0 * P.RING_TAU * (1 - Math.exp(-tf / P.RING_TAU)), lead = clamp(t / 0.25);
          ph = { ray: fl(sp / 2) * 2, ring: fl(rg / 2) * 2, rayAmp: lite ? 0.5 : 0.62, ringAmp: lite ? 0.2 : 0.30, baseAmp: 0.95, dim: 0.35 + 0.65 * easeOut(lead * 1.2), flash: t < 0.06 ? 0.4 : (t >= tL - 0.02 && t < tL + 0.07 ? 0.26 : (t < 0.2 ? 0.1 : 0)) };
        } else {
          const sp = 22 * (1 - Math.exp(-tf / 3)), rg = 90 * (1 - Math.exp(-tf / 2.5)), st = clamp((tf - 2.2) / 1.4), crash = t >= tL && t < tL + 0.08;
          ph = { ray: fl(sp / 2) * 2, ring: fl(rg / 2) * 2, rayAmp: 0.14, ringAmp: 0.07, baseAmp: 0.7, dim: t < 0.45 ? 0.3 : (1 - 0.45 * clamp((t - tL) / 1.3)), flash: crash ? 0.26 : (t < 0.05 ? 0.12 : 0), streak: st > 0 ? { x: vx + 0.2 * gw, amp: 1.15 * easeOut(st), w: 3 + 5 * st, k: fl(st * 8) } : null };
        }
        if (statisch) { ph.flash = 0; ph.dim = 1; }
        const key = [ph.ray, ph.ring, ph.dim.toFixed(2), ph.flash, ph.streak ? ph.streak.k + '|' + fl(ph.streak.amp * 20) : 0].join(',');
        let t0 = performance.now();
        if (kul.bereit && key !== bgKey) { kul.paint(bgImg.data, ph); ctxBg.putImageData(bgImg, 0, 0); bgKey = key; if (perf) perf.bg = performance.now() - t0; }
        t0 = performance.now(); m.clear();
        if (!statisch) {
          if (sieg) sterne(m, t, gw, gh, lite ? 36 : P.STERNE, { maxY: 0.85 }); else sterne(m, t, gw, gh, lite ? 18 : 45, { maxY: 0.7, cols: [C.k7, C.k6, C.k8, C.k6], dim: C.k3 });
          if (sieg) {
            for (const sh of shells) { const tau = t - sh.t0; if (tau > 0 && tau < 3.4) feuerwerk(m, tau, sh); }
            const nk = rd((lite ? 18 : P.KONFETTI) * clamp((t - 0.9) / 1.5)); if (nk > 0) konfettiSchleife(m, t, gw, gh, nk);
            const nm = rd((lite ? 5 : P.MUENZEN) * clamp((t - 1.4) / 1.5)); if (nm > 0) muenzRegen(m, t, gw, gh, nm);
          } else regen(m, t, gw, gh, rd((lite ? 20 : 54) * clamp((t - 0.2) / 1.0)), lite ? 10 : 26);
          for (const h of helden) {
            let y = h.y, hop = 0, fn = null, dx = 0, sx = 1, sy = 1;
            if (sieg) {
              const ts = tL + 0.12, u = clamp((t - ts) / 0.4); if (t < ts) continue; y = h.y + (1 - easeOut(u)) * 150;
              const po = huepfPlan(h, t - ts - 0.5 - h.ph * 0.6); hop = po.hop; sx = po.sx; sy = po.sy;
              m.dith(rd(h.x), rd(h.y + 1), h.rx, 6, 9, C.nacht);
            } else {
              // Niederlage: die Helden bleiben stehen, vollständig sichtbar, kalt umgefärbt; sie erscheinen im Bayer-Dither (kein Alpha) und atmen schwach (1 Pixel, alle 0,8 s) mit seltenem Zittern (1 Pixel) — kein Absinken
              const ts = tL + 0.2; if (t < ts) continue;
              const lvl = clamp((t - ts) / 0.5) * 16; if (lvl < 16) { const X0 = rd(h.x), Y0 = rd(y); fn = (i, j) => (BAY[(Y0 + j) & 3][(X0 + i) & 3] < lvl ? undefined : null); }
              hop = (fl((t - ts) / 0.8 + h.ph) & 1) ? -1 : 0; if (fl(t * 6 + h.ph * 7) % 9 === 0) dx = (fl(t * 6) & 1) ? 1 : -1;
              m.dith(rd(h.x), rd(h.y + 1), h.rx, 6, 6, C.schwarz);
            }
            heldZeichne(m, h.hd, t, h.x + dx, y, h.S, { hop, fn, sx, sy, clip: h.clip, tint: sieg ? null : 'kalt' });
          }
        }
        // Banner
        const tb = performance.now();
        shine = sieg && !statisch ? ((t - (tL + 0.6)) % P.SHINE) / 0.55 : -1; if (sieg && t < tL + 0.6) shine = -1;
        for (const l of lets) {
          const tau = statisch ? 9 : t - l.t0, ccx = vx + l.x + l.w / 2, kk = fl(tau * TAKT + 1e-4); if (kk < 0) continue;
          let sz = s, dy = 0, flash = false, spr;
          if (sieg) { if (kk < P.STAMP) { sz = SZ(s)[kk]; dy = [-26, -26, -18, -9][kk] * (s / 9); } else { dy = [4, 2, -1, 0][Math.min(3, kk - P.STAMP)] * (s / 9); flash = kk < P.STAMP + 2; } spr = backe(l.ch, sz, flash ? 'weiss' : 'sieg'); }
          else { const u = clamp(tau / 0.2); if (u < 1) dy = -((gh * 0.7) * (1 - u * u)); else { const aa = t - l.land; dy = aa < 0.12 ? [3, 2, 1, 0][Math.min(3, fl(aa * TAKT))] * (s / 8) : 0; }
            const kaputt = statisch || t > tL + 0.07, wf = !statisch && t >= tL && t <= tL + 0.07, fl2 = u >= 1 && t - l.land < 2 / TAKT;
            spr = kaputt ? zerbrich(backe(l.ch, sz, 'nieder'), l.j + 5, l.ch) : backe(l.ch, sz, (fl2 || wf) ? 'weiss' : 'nieder'); }
          const X = rd(ccx - spr.w / 2), Y = rd(by - spr.h / 2 + dy + 1); let fn;
          if (sieg && shine >= 0 && shine < 1) { const bx0 = vx - bp.total / 2, pos = bx0 - 24 + shine * (bp.total + 70), kind = spr.kind;
            fn = (i, j2) => { if (kind[j2 * spr.w + i] !== 1) return undefined; const q = (X + i) - pos + (j2 * 0.55); if (q > -3 && q < 2) return C.weiss; if (q >= 2 && q < 6 && ((i + j2) & 1) === 0) return C.glanz; return undefined; }; }
          m.blit(spr, X, Y, fn);
          if (!sieg && spr.debris && !statisch && t > tL + 0.07) { const a = t - (tL + 0.07); for (const db of spr.debris) { const yy = Y + db.y + db.v0 * a + 110 * a * a, xx = X + db.x + db.vx * a; if (yy < gh + 4 && !(a > 0.9 && ((fl(a * TAKT) + db.x) & 1))) m.rect(rd(xx), rd(yy), 2, 2, db.c); } }
        }
        if (perf) perf.banner = performance.now() - tb;
        if (!statisch) {
          for (const l of lets) {
            const a = t - l.land; if (a < 0) continue; const cxl = vx + l.x + l.w / 2, cyl = by, last = l === lets[lets.length - 1];
            if (sieg) { schock(m, cxl, cyl + s * 3.5, a, { R: last ? 150 : 34 + s * 2, dur: last ? 0.7 : 0.4, double: last }); funken(m, cxl, cyl + s * 3, a, { n: lite ? 6 : (last ? 26 : 12), life: 0.7, speed: last ? 120 : 74, drag: 2.6, g: 90, up: 20, seed: l.j * 7 + 1, trail: 1 }); }
            else { schock(m, cxl, cyl + s * 3.5, a, { R: last ? 120 : 30 + s * 2, dur: last ? 0.7 : 0.4, c0: C.k8, c1: C.k7, c2: C.k5, flat: 0.5 }); funken(m, cxl, cyl + s * 3.5, a, { n: lite ? 5 : 10, life: 0.8, speed: 55, drag: 2.4, g: 80, cols: [C.k8, C.k7, C.k6, C.k5, C.k4], seed: l.j * 7 + 2 }); }
          }
          if (sieg) { konfettiSalve(m, t - tL, { x: 6 * k, y: gh - 4, a: -1.12, spread: 0.7, v: 230 * (gh / 360), seed: 3, n: lite ? 16 : P.SALVE }); konfettiSalve(m, t - tL, { x: gw - 6 * k, y: gh - 4, a: -2.02, spread: 0.7, v: 230 * (gh / 360), seed: 4, n: lite ? 16 : P.SALVE }); }
        }
        ctxFg.putImageData(fgImg, 0, 0);
        if (perf) perf.fg = performance.now() - t0;
        return true;
      },
    };
    return S;
  }

  // ── Layout/Größe: Raster-Zelle in Bildschirmpixeln: ≥ 2 CSS-px, höchstens 640 Zellen Breite ──
  function handy() { try { return !!(window.matchMedia && window.matchMedia('(pointer: coarse) and (max-height: 600px)').matches) || !!(window.ppIsPhone && window.ppIsPhone()); } catch (e) { return false; } }
  function statisch() {
    try { if (window.PP_RETRO || window._playAnimations === false || window.__ppFxAlt || window.__ppFx54Aus) return true; return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
  }
  root.ppFx54Statisch = statisch;
  function raster(wCss, hCss) {
    const d = window.devicePixelRatio || 1, bw = Math.max(1, rd(wCss * d)), bh = Math.max(1, rd(hCss * d)), cell = Math.max(rd(2 * d), Math.ceil(bw / 640));
    return { d, cell, cellCss: cell / d, gw: Math.ceil(bw / cell), gh: Math.ceil(bh / cell) };
  }
  function bannerGroesse(titel, gw, lite) {
    let s = lite ? 4 : 8, bp = bannerPlan(titel, s); while (bp.total > gw * 0.86 && s > 2) { s--; bp = bannerPlan(titel, s); }
    return { s, bp };
  }
  const titelNorm = (t) => String(t || '').toUpperCase();

  // ── Vorbacken (im Leerlauf): Glyphen + Banner-Sprites für „VICTORY“ / „DEFEAT“ in der Größe des Fensters ──
  let vorLaeuft = false;
  root.ppFx54Vorbacken = function (titel) {
    if (vorLaeuft || statisch()) return; vorLaeuft = true;
    const idle = (f) => (window.requestIdleCallback ? window.requestIdleCallback(f, { timeout: 2000 }) : setTimeout(() => f({ timeRemaining: () => 8 }), 50));
    const aufgaben = [];
    scLaden(); schriftBereit().then(() => {
      farben(); const lite = handy(), r = raster(window.innerWidth, window.innerHeight);
      for (const [t, th] of [['VICTORY', 'sieg'], ['DEFEAT', 'nieder']].concat(titel ? [[titelNorm(titel), /DEFEAT|FAIL|PLACE/.test(titelNorm(titel)) ? 'nieder' : 'sieg']] : [])) {
        const { s, bp } = bannerGroesse(t, r.gw, lite);
        for (const l of bp.L) { if (l.sp) continue; for (const sz of (th === 'sieg' ? [...SZ(s), s] : [s])) { aufgaben.push(() => { backe(l.ch, sz, th); if (th === 'sieg') backe(l.ch, sz, 'weiss'); else { backe(l.ch, sz, 'weiss'); } }); } if (th === 'nieder') aufgaben.push(() => zerbrich(backe(l.ch, s, 'nieder'), bp.L.filter((q) => !q.sp).indexOf(l) + 5, l.ch)); }
      }
      const lauf = (dl) => { const a0 = performance.now(); while (aufgaben.length && dl.timeRemaining() > 4) aufgaben.shift()(); root.__ppFx54Vor = (root.__ppFx54Vor || 0) + (performance.now() - a0); if (aufgaben.length) idle(lauf); else vorLaeuft = false; };
      idle(lauf);
    });
  };

  // ═════════ React: Bühne (Leinwände) ═════════
  function Buehne({ wurzel, platz, inhalt, sieg, titel, helden, statisch: stat }) {
    const bgRef = React.useRef(null), fgRef = React.useRef(null), camRef = React.useRef(null);
    React.useLayoutEffect(() => {
      // Die Refs der Eltern (Wurzel, Platzhalter) hängen erst nach den Layout-Effekten der Kinder: darum erst in `los()` (Mikroaufgabe, noch vor dem ersten Zeichnen) lesen.
      let rootEl = null, pl = null; const bgc = bgRef.current, fgc = fgRef.current, cam = camRef.current;
      if (!bgc) return undefined;
      const raf = window.ppTaktRaf || window.requestAnimationFrame, lite = handy(), titelT = titelNorm(titel);
      const namen = []; let szene = null, gestoppt = false, sichtbar = true, id = 0, t0 = -1, tNow = 0, tsNow = 0, keepT = null, letzte = '', ro = null, io = null, bgx = null, fgx = null, klangIx = 0, geladen = [], rafBau = 0;
      const zeiten = window.__ppFx54Zeiten;
      function aufbau() {
        if (gestoppt || !GLM) return;
        const w = rootEl.clientWidth, h = rootEl.clientHeight; if (!(w > 0 && h > 0)) return;
        const r = raster(w, h); farben();
        const { s, bp } = bannerGroesse(titelT, r.gw, lite);
        pl.style.height = ((7 * s + (lite ? 14 : 18)) * r.cellCss) + 'px'; pl.style.width = (bp.total * r.cellCss) + 'px';
        for (const cv of [bgc, fgc]) { if (cv.width !== r.gw || cv.height !== r.gh) { cv.width = r.gw; cv.height = r.gh; } }   // gleiche Größe: altes Bild bleibt stehen, bis die neue Kulisse bereit ist
        bgx = bgc.getContext('2d'); fgx = fgc.getContext('2d');
        const rr = rootEl.getBoundingClientRect(), pr = pl.getBoundingClientRect(), by = (pr.top - rr.top + pr.height / 2) / r.cellCss - 1;
        // Breite des Inhalts (für die Bühne dahinter und die Seitenflächen der Helden)
        let cw = 0; const ih = inhalt.current; if (ih) for (const c of ih.children) { const b = c.getBoundingClientRect(); if (b.width > cw) cw = b.width; }
        const inhaltBreite = Math.max(cw, 200) / r.cellCss;
        cw = Math.max(Math.max(cw, 200) / r.cellCss, bp.total + 12);   // Helden nie neben/über Banner oder Text: Seitenfläche = Fenster minus das Breitere von Inhalt und Banner
        szene = szeneNeu({ sieg, lite, gw: r.gw, gh: r.gh, vx: r.gw / 2, by, s, bp, statisch: stat, saeule: { halb: cw / 2 + 6, y0: by + 4 * s + 4, st: sieg ? 0.78 : 0.4 } });
        szene.sideL = (r.gw - cw) / 2 - 6; szene.sideR = szene.sideL; szene.r = r;
        szene.inhaltHalb = inhaltBreite / 2; szene.bannerHalb = bp.total / 2; szene.clipY0 = rd(by + 3.5 * s + 8);   // Aura/Gas wird nicht über Banner und Inhalt gezeichnet
        platziereHelden(); letzte = '';
        if (keepT != null) { t0 = tsNow - keepT * 1000; klangIx = szene.klang.filter((e) => e[0] <= keepT).length; keepT = null; } else { klangIx = 0; t0 = -1; }   // Neuaufbau (z. B. späte Belohnungen): Zeitlinie behalten
        if (!stat) { if (!id) id = raf(tick); } else rafBau = requestAnimationFrame(statischZeichnen);
      }
      function platziereHelden() {
        if (!szene || !geladen.length) return;
        const r = szene.r, gh = r.gh, fy = gh * (lite ? 0.62 : 0.74), S0 = lite ? 2 : 3, out = [];
        // Skalierung je Held: ein Sprite-Pixel = S Zellen, bei breiten/hohen Sprites (Medea, Flügel, Waffen) verkleinert, bis Kern und Seitenfläche passen; sonst entfällt der Held (nie über Text/Liste)
        const passt = (hd, S, seite) => hd.kb * S <= seite * 0.95 && (hd.cx1 - hd.cx0) * S <= seite * 1.6 && hd.chh * S <= fy - 20;   // nur der Körper entscheidet (Kernbreite; Höhe: Kopf bleibt im Bild, 14 Zellen Sprungluft); Aura darf überstehen und wird beschnitten
        const nimm = (i, seite, x0, ph, links) => { const hd = geladen[i] || geladen[0]; if (!hd) return; let S = S0; while (S > 1 && !passt(hd, S, seite)) S--; if (!passt(hd, S, seite)) return;
          const frei = szene.inhaltHalb != null ? szene.inhaltHalb : 0, bannerHalb = szene.bannerHalb != null ? szene.bannerHalb : frei, mitteX = r.gw / 2, clip = links ? { xa: 0, xb: mitteX - frei - 3, ya: szene.clipY0, xaB: 0, xbB: mitteX - bannerHalb - 3 } : { xa: mitteX + frei + 3, xb: r.gw, ya: szene.clipY0, xaB: mitteX + bannerHalb + 3, xbB: r.gw };
          out.push({ hd, x: x0, y: fy, S, ph, clip, rx: rd(Math.min(hd.ck, 28) * S * 0.55), seed: ((namen[geladen[i] ? i : 0] || 1) + i * 7919) & 0x7fffffff }); };
        { const hw = 18 * S0; if (szene.sideL > hw * 0.9) nimm(0, szene.sideL, Math.max(hw / 2 + 4, szene.sideL / 2), 0, true); if (szene.sideR > hw * 0.9) nimm(1, szene.sideR, r.gw - Math.max(hw / 2 + 4, szene.sideR / 2), 0.25, false); }
        szene.setzeHelden(out);
      }
      function statischZeichnen() { rafBau = 0; if (!szene) return; if (!szene.kul.bereit) szene.kul.bauen(1e4); szene.zeichne(7.0, bgx, fgx); }
      let baut = false;
      function tick(ts) {
        id = 0; if (gestoppt || !sichtbar || !szene) return;
        ts = performance.now();      // Zeitbasis = performance.now() (wie die Zeitgeber der DOM-Zeremonie); der rAF-Stempel liefe in Aufnahmen mit virtueller Zeit vor
        if (t0 < 0) t0 = ts;
        const t = (ts - t0) / 1000; tNow = t; tsNow = ts;
        if (!szene.kul.bereit) { if (!baut) baut = true; szene.kul.bauen(5); }          // Tabellen scheibenweise bauen (≤ 5 ms je Bild)
        const a = performance.now(), p = zeiten ? {} : null;
        const neu = szene.zeichne(t, bgx, fgx, p);
        if (neu) {
          const [sx, sy] = szene.shakeAt(t > P.IDLE_AB ? P.IDLE_AB : t), key = sx + ',' + sy;
          if (key !== letzte) { letzte = key; cam.style.transform = (sx || sy) ? `translate(${sx * szene.r.cellCss}px, ${sy * szene.r.cellCss}px)` : 'none'; }
          while (klangIx < szene.klang.length) { const e = szene.klang[klangIx]; if (e[0] > t) break; klangIx++; if (window.playSFX && t - e[0] < 0.4) window.playSFX(e[1], { volume: e[2], dedupe: 30 }); }
          if (zeiten) zeiten.push({ t, ms: performance.now() - a, bg: p.bg || 0, banner: p.banner || 0, fg: p.fg || 0 });
        }
        id = raf(tick);
      }
      // Helden laden (im Leerlauf, falls nicht schon da)
      const HA = window.HeroIdleAnims;
      if (HA && !stat && Array.isArray(helden)) {
        helden.slice(0, 2).forEach((name, i) => {
          const slug = HA.slug(name), fertig = HA.schonDa && HA.schonDa(slug);
          namen[i] = [...String(name)].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) | 0, 7) & 0x7fffffff;
          const nimm = (e) => { if (gestoppt || !e || !e.img) return; const hd = heldDaten(e); if (hd) { geladen[i] = hd; platziereHelden(); } };
          if (fertig) nimm(fertig); else if (HA.hole) HA.hole(slug).then(nimm).catch(() => {});
        });
      }
      let lw = 0, lh = 0;
      const los = () => {
        rootEl = wurzel.current; pl = platz.current; if (!rootEl || !pl || gestoppt) return;
        try { const a0 = performance.now(); aufbau(); if (zeiten) (window.__ppFx54Aufbau = window.__ppFx54Aufbau || []).push(+(performance.now() - a0).toFixed(1)); } catch (e) { console.error('[fx54] Aufbau fehlgeschlagen', e); }
        try { ro = new ResizeObserver(() => { const w = rootEl.clientWidth, h = rootEl.clientHeight, ih = inhalt.current ? inhalt.current.offsetHeight : 0; if (!lw) { lw = w; lh = h + ih * 1e4; return; } if (w === lw && h + ih * 1e4 === lh) return; lw = w; lh = h + ih * 1e4; if (szene) { keepT = tNow; szene = null; if (id) { cancelAnimationFrame(id); id = 0; } aufbau(); } }); ro.observe(rootEl); if (inhalt.current) ro.observe(inhalt.current); } catch (e) { /* ohne */ }
        try { io = new IntersectionObserver((es) => { sichtbar = es[es.length - 1].isIntersecting; if (sichtbar && !id && szene && !stat) { t0 = -1; id = raf(tick); } }); io.observe(rootEl); } catch (e) { /* ohne */ }
      };
      schriftBereit().then(los).catch((e) => console.error('[fx54] Schrift', e));
      return () => { gestoppt = true; if (id) { try { cancelAnimationFrame(id); } catch (e) { /* weg */ } } if (rafBau) cancelAnimationFrame(rafBau); if (ro) ro.disconnect(); if (io) io.disconnect(); };
    }, []);
    return (
      <React.Fragment>
        <canvas ref={bgRef} className="pp-cer-bg" aria-hidden="true" />
        <div ref={camRef} className="pp-cer-cam" aria-hidden="true"><canvas ref={fgRef} className="pp-cer-fg" /></div>
      </React.Fragment>
    );
  }

  // ═════════ React: die Zeremonie (DOM, Zeitplan, Inhalt wie bisher) ═════════
  // Zeitplan der Zeilen: geometrische Mitte aus dem früheren Takt (erste Zeile 1,4 s, Abstand 0,72 s) und dem ersten Stand dieser Fassung (Sieg 0,55 s / 0,09 s, Niederlage 1,0 s / 0,11 s):
  // Sieg 0,88 s / 0,255 s, Niederlage 1,18 s / 0,28 s; bei vielen Einträgen rückt die letzte Zeile spätestens auf 3,0 s. Knöpfe 0,15 s nach der letzten Zeile (Skip-Klick überspringt alles).
  function zeitplan(sieg, n) {
    const r0 = sieg ? 0.88 : 1.18, ab0 = sieg ? 0.255 : 0.28, ab = n > 1 ? Math.min(ab0, (3.0 - r0) / (n - 1)) : 0;
    const rw = Array.from({ length: n }, (_, i) => r0 + i * ab);
    return { u1: sieg ? 0.45 : 0.95, rw, summe: sieg ? 0.6 : 1.0, btn: Math.max(sieg ? 1.1 : 1.4, (n ? rw[n - 1] : 0) + 0.15) };
  }
  // Reihenfolge der Belohnungen nach Kategorie: einmalig, einmalig je Gegner, täglich (auch Tageskarte), täglich je Gegner, unbegrenzt; innerhalb einer Kategorie bleibt die Reihenfolge des Servers (stabil).
  const LIMIT_RANG = { once: 0, once_per_opponent: 1, daily: 2, daily_key: 2, daily_per_opponent: 3, unlimited: 4 };
  const sortiereBelohnungen = (liste) => liste.map((r, i) => [r, i]).sort((x, y) => ((LIMIT_RANG[x[0] && x[0].limit] ?? 4) - (LIMIT_RANG[y[0] && y[0].limit] ?? 4)) || (x[1] - y[1])).map((e) => e[0]);
  const bandArt = (r) => /^daily/.test((r && r.limit) || '') ? 'daily' : /^once/.test((r && r.limit) || '') ? 'once' : null;

  function Zeremonie({ won, spectator, title, subtitle, rewards: rewardsRoh, total, eloChanges, myName, oppName, extra, cpuProgress, helden, klasse, vorn, eigenerCluster, children }) {
    const rewards = React.useMemo(() => sortiereBelohnungen(rewardsRoh || []), [rewardsRoh]);
    const n = rewards.length, stat = React.useMemo(() => statisch(), []);
    // Die Belohnungen kommen vom Server oft erst NACH dem Ergebnis (sc_earned): Zeilen werden deshalb nach der Anzahl `n` (neu) eingeplant; die Knöpfe erscheinen erst, wenn alle Zeilen da sind.
    const [reihen, setReihen] = React.useState(stat ? n : 0), [btnBereit, setBtnBereit] = React.useState(stat), [u1, setU1] = React.useState(stat), [summeDa, setSummeDa] = React.useState(stat);
    const fertig = stat || (btnBereit && reihen >= n);
    const [zaehler, setZaehler] = React.useState(stat ? total : 0);
    const wurzel = React.useRef(null), platz = React.useRef(null), inhalt = React.useRef(null), klonRef = React.useRef(null), zt = React.useRef([]), rt = React.useRef([]), reihenRef = React.useRef(stat ? n : 0), start = React.useRef(performance.now());
    const muenze = React.useMemo(() => root.ppFx54MuenzeUrl(), []);
    const Z0 = React.useMemo(() => zeitplan(won, n), []);
    // Zeitplan (Startzeit = Einhängen); jedes Ereignis genau einmal
    React.useEffect(() => {
      if (stat) return undefined;
      const T = zt.current, plan = (sek, f) => T.push(setTimeout(f, sek * 1000));
      plan(Z0.u1, () => setU1(true)); plan(Z0.summe, () => setSummeDa(true));
      plan(Z0.btn, () => { setBtnBereit(true); if (window.playSFX) window.playSFX('ping', { dedupe: 300, volume: 0.3 }); });
      return () => { T.forEach(clearTimeout); T.length = 0; };
    }, []);
    React.useEffect(() => {
      if (stat) { reihenRef.current = n; setReihen(n); return undefined; }
      const T = rt.current, el = performance.now() - start.current, Z = zeitplan(won, n), von = reihenRef.current;
      for (let i = von; i < n; i++) {
        const d = Math.max(Z.rw[i] * 1000 - el, (i - von) * 90);
        T.push(setTimeout(() => { reihenRef.current = i + 1; setReihen(i + 1); setSummeDa(true); if (window.playSFX) window.playSFX('gold_gain', { dedupe: 40, volume: i < 4 ? 0.5 : 0.35 }); }, d));
      }
      return () => { T.forEach(clearTimeout); T.length = 0; };
    }, [n]);
    // Zähler: zeitbasiert (30 Hz) auf die Summe der sichtbaren Zeilen; Dauer je Zeile = 150 ms · √Betrag (früher 45 ms je SC, in der ersten Fassung ~0,5 s je Zeile): 5 SC ≈ 0,34 s, 30 SC ≈ 0,82 s
    const zz = React.useRef({ von: 0, nach: 0, t0: 0, dauer: 1 });
    React.useEffect(() => {
      if (stat || fertig) { setZaehler(total); return undefined; }
      const ziel = rewards.slice(0, reihen).reduce((a, r) => a + (r.amount || 0), 0), Z = zz.current, jetzt = performance.now();
      const akt = Z.dauer > 0 ? Z.von + (Z.nach - Z.von) * clamp((jetzt - Z.t0) / Z.dauer) : Z.nach;
      Z.von = akt; Z.nach = ziel; Z.t0 = jetzt; Z.dauer = Math.max(200, 150 * Math.sqrt(Math.abs(ziel - akt)));
      const iv = setInterval(() => { const q = clamp((performance.now() - Z.t0) / Z.dauer); setZaehler(rd(Z.von + (Z.nach - Z.von) * q)); if (q >= 1) clearInterval(iv); }, 33);
      return () => clearInterval(iv);
    }, [reihen, fertig, total]);
    const ueberspringen = () => { if (fertig) return; zt.current.forEach(clearTimeout); zt.current.length = 0; rt.current.forEach(clearTimeout); rt.current.length = 0; reihenRef.current = n; setU1(true); setSummeDa(true); setReihen(n); setBtnBereit(true); };
    const anzahlFrei = (cpuProgress && cpuProgress.unlocks) ? cpuProgress.unlocks.length : 0;
    React.useEffect(() => { if (fertig && anzahlFrei > 0 && window.playSFX) window.playSFX('ascension', { dedupe: 300, volume: 0.6 }); }, [fertig, anzahlFrei]);
    // Avatar-/Namen-Cluster der Handleisten klonen und über die Kulisse legen (wie bisher)
    React.useEffect(() => {
      const wirt = klonRef.current; if (!wirt) return;
      wirt.innerHTML = '';
      // Nur der Gegner-Cluster (Avatar/Name) liegt über der Kulisse — seine End-Sprechblase ankert daran. Der eigene Cluster entfällt, außer eine eigene End-Sprechblase ankert an ihm (`eigenerCluster`).
      for (const sel of eigenerCluster ? ['.game-hand-opp .game-hand-info', '.game-hand-me .game-hand-info'] : ['.game-hand-opp .game-hand-info']) {
        const el = document.querySelector(sel); if (!el) continue;
        const r = el.getBoundingClientRect(), klon = el.cloneNode(true); klon.removeAttribute('id');
        klon.style.cssText = `position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;transform:none;margin:0;pointer-events:none;display:flex;align-items:center;`;
        wirt.appendChild(klon);
      }
    }, []);
    React.useEffect(() => { try { window.ppFx54Vorbacken && window.ppFx54Vorbacken(title); } catch (e) { /* Vorbacken ist nur Komfort */ } }, []);
    const bandText = (r) => bandArt(r) === 'daily' ? (r.limit === 'daily' || r.limit === 'daily_key' ? 'Daily!' : (oppName ? `Daily vs ${oppName}!` : 'Daily per Foe!')) : 'Once!';
    const vis = (an) => (an ? '' : ' pp-cer-aus');
    return (
      <div ref={wurzel} className={'pp-cer' + (won ? ' pp-cer-win' : ' pp-cer-lose') + (klasse ? ' ' + klasse : '')} data-pp-px="aus" onClick={ueberspringen}>
        <Buehne wurzel={wurzel} platz={platz} inhalt={inhalt} sieg={won} titel={title} helden={spectator ? [] : (helden || [])} statisch={stat} />
        <div className="pp-cer-klone" ref={klonRef} aria-hidden="true" />
        {vorn}
        <div className="pp-cer-spalte">
          <div className="pp-cer-platz" ref={platz}><span className="pp-cer-titel" role="heading" aria-level="1">{title}</span></div>
          <div className="pp-cer-inhalt" ref={inhalt} onClick={(e) => e.stopPropagation()}>
            {subtitle && <div className={'pp-cer-unter' + (/^(💀|☠️)/.test(subtitle) ? ' pp-cer-unter-grund' : '') + vis(u1)}>{subtitle}</div>}
            {cpuProgress && cpuProgress.wins > 0 && (
              <div className={'pp-cer-sieg' + vis(u1)}>
                <div className="pp-cer-sieg-zahl">🏆 {ppOrdinal(cpuProgress.wins)} victory{oppName ? ' against ' + oppName : ''}!</div>
                {cpuProgress.sleeve && <div className="pp-cer-sieg-theme">🃏 {cpuProgress.sleeve.name}: {cpuProgress.sleeve.wins} / {cpuProgress.sleeve.need} wins to unlock</div>}
                {cpuProgress.theme && <div className="pp-cer-sieg-theme">🎵 {cpuProgress.theme.hero ? heroDisplayName(cpuProgress.theme.hero) + "'s Theme" : cpuProgress.theme.name}: {cpuProgress.theme.wins} / {cpuProgress.theme.need} wins to unlock</div>}
              </div>
            )}
            {n > 0 && (
              <div className={'pp-cer-liste' + (n <= 3 ? ' pp-cer-liste-1' : '')}>
                {rewards.map((r, i) => (
                  <div key={r.id || i} className={'pp-cer-zeile' + (bandArt(r) ? ' pp-cer-zeile-' + bandArt(r) : '') + (reihen > i ? ' pp-cer-zeile-da' : '')}>
                    <div className="pp-cer-zeile-text">
                      <div className="pp-cer-zeile-titel">{r.title}{bandArt(r) && <span className="pp-cer-band">{bandText(r)}</span>}</div>
                      <div className="pp-cer-zeile-beschr">{r.description || ''}</div>
                    </div>
                    <div className="pp-cer-zeile-betrag">+{r.amount}<img src={muenze} alt="SC" /></div>
                  </div>
                ))}
              </div>
            )}
            {n > 0 && (
              <div className={'pp-cer-summe' + vis(summeDa)}>
                <span className="pp-cer-summe-zahl">{zaehler}</span><img src={muenze} alt="SC" /><span className="pp-cer-summe-text">earned</span>
              </div>
            )}
            {extra}
            {cpuProgress && cpuProgress.unlocks && cpuProgress.unlocks.length > 0 && (
              <div className={'pp-cer-freischaltungen' + (fertig ? ' pp-cer-pop' : ' pp-cer-aus')}>
                {cpuProgress.unlocks.map((u, i) => (
                  <div key={(u.kind || '') + (u.id || u.name) + i} className={'pp-cer-freischaltung pp-cer-frei-' + (u.kind || 'unlock')}>
                    {u.image ? <img className="pp-cer-frei-bild" src={u.image} alt="" /> : <span className="pp-cer-frei-icon">{PP_UNLOCK_ICON[u.kind] || '🎁'}</span>}
                    <div>
                      <div className="pp-cer-frei-titel">{PP_UNLOCK_TEXT[u.kind] || 'Unlocked!'}</div>
                      <div className="pp-cer-frei-name">{(u.kind === 'music' && u.hero) ? heroDisplayName(u.hero) + "'s Theme" : u.name}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {eloChanges && (
              <div className={'pp-cer-elo' + (fertig ? ' pp-cer-pop' : ' pp-cer-aus')}>
                {eloChanges.map((ec) => (
                  <div key={ec.username} style={{ color: ec.username === myName ? 'var(--text)' : 'var(--text2)' }}>
                    {ec.username}: {ec.oldElo} → <span style={{ color: ec.newElo > ec.oldElo ? 'var(--success)' : 'var(--danger)' }}>{ec.newElo}</span>{' '}({ec.newElo > ec.oldElo ? '+' : ''}{ec.newElo - ec.oldElo})
                  </div>
                ))}
              </div>
            )}
            <div className={fertig ? 'pp-cer-pop' : 'pp-cer-aus'}>{children}</div>
            <div className={'pp-cer-hinweis' + (fertig ? ' pp-cer-aus' : '')}>click to skip</div>
          </div>
        </div>
      </div>
    );
  }
  root.PpFx54Zeremonie = Zeremonie;
})(window);
