// Pixelart-Portierungen (Canvas), Batch 6: siehe app-fx-0.jsx. Jede Portierung: `ppFxUeberschreiben('typ', Komponente)`.
//
// Enthaelt: necromancy_summon, negate_shatter, niu_powerup, nuke_blast, paralyzing_bolts, pink_glass_shatter (und damit glass_shatter, das die Registry-Komponente mit `palette` aufruft),
// poisoned_well, pollution_evaporate, pressed_skill_rain, promotion_burst, rain_of_death, rain_of_spores_rain, root_evil_mist.
// Jeder Effekt ist EINE Leinwand (`ppR1Leinwand`, app-board.jsx): ein Rasterpixel = 3 Bildschirmpixel, feste Palette, Bayer-Dither statt Alpha, 30 Bilder/s, Bewegung in ganzen Rasterpixeln.
// Zeitablauf und Anker wie die DOM-Fassung (Mitte der Zone: x/y, Zonenmass w/h); wo die alte Fassung ueber die Standard-Lebensdauer des Aufrufers (1000 ms) hinausragte und hart abgeschnitten
// wurde (Rain of Death, Root-Nebel, Necromancy, Niu), laeuft der Ablauf hier gestaucht und endet von selbst.
// Alle Namen tragen das Praefix `ppFx6`/`PP_FX6` (alle app-*.jsx teilen EINEN globalen Gueltigkeitsbereich).

/** Stuetzstellen [[u, [werte…]], …] → Werte bei u (linear; `leicht`: ease-out je Abschnitt, wie CSS-Keyframes mit `ease-out`). */
function ppFx6Kf(u, stops, leicht) {
  if (u <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    if (u <= stops[i][0]) {
      let f = (u - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]);
      if (leicht) f = 1 - (1 - f) * (1 - f);
      return stops[i - 1][1].map((v, k) => v + (stops[i][1][k] - v) * f);
    }
  }
  return stops[stops.length - 1][1];
}
/** Deckung 0..1 → ganz oder gedithert: ab `fest` voll deckend (dünne Linien/kleine Sprites sollen nicht verschwinden). */
const ppFx6Voll = (op, fest) => Math.min(1, op / (fest || 1));
/** Farbverlauf als Dither: `f` 0..1 über `farben` (aufsteigend), Zelle (x, y) entscheidet nach Bayer-Schwelle (versetzt, damit sie nicht mit der Deckungs-Schwelle des Pinsels zusammenfällt). */
function ppFx6Stufe(f, farben, x, y) {
  const n = farben.length;
  if (n === 1) return farben[0];
  const v = ppR1Klemme(f) * (n - 1), k = Math.min(n - 2, Math.floor(v));
  return (v - k) > ppBayer(x + 2, y + 1) ? farben[k + 1] : farben[k];
}
/** Quadratischer Punkt der Kantenlaenge n (ganze Rasterpixel), Mitte (x, y). */
function ppFx6Punkt(g, x, y, n, c, a) { n = Math.max(1, Math.round(n)); g.block(Math.round(x - n / 2), Math.round(y - n / 2), n, n, c, a); }
/** Pixelbild mit optionaler 1-Pixel-Kontur (`rand`: Farbe). */
function ppFx6Bild(g, zeilen, pal, cx, cy, a, rand) {
  const h = zeilen.length, w = zeilen[0].length, x0 = Math.round(cx - w / 2), y0 = Math.round(cy - h / 2);
  if (rand) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      if (zeilen[j][i] === '.') continue;
      g.put(x0 + i - 1, y0 + j, rand, a); g.put(x0 + i + 1, y0 + j, rand, a); g.put(x0 + i, y0 + j - 1, rand, a); g.put(x0 + i, y0 + j + 1, rand, a);
    }
  }
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const c = pal[zeilen[j][i]]; if (c) g.put(x0 + i, y0 + j, c, a); }
}
/** Senkrechte Saeule (Lichtschacht/Stiel): Unterkante `yU`, Hoehe `H`, Halbbreite `hwF(f)`, Farbe `farbe(f, x, y)`, Deckung `alphaF(f)`; weiche Raender als Dither (`kante` Rasterpixel). f = 0 unten … 1 oben. */
function ppFx6Saeule(g, cx, yU, H, hwF, farbe, alphaF, a, kante) {
  cx = Math.round(cx); yU = Math.round(yU);
  const n = Math.max(1, Math.round(H));
  for (let j = 0; j < n; j++) {
    const f = j / n, hw = hwF(f);
    if (hw <= 0) continue;
    const al = alphaF(f) * a;
    if (al <= 0) continue;
    const R = Math.ceil(hw + kante);
    for (let i = -R; i <= R; i++) {
      const e = kante > 0 ? ppR1Klemme((hw - Math.abs(i)) / kante + 0.5) : (Math.abs(i) <= hw ? 1 : 0);
      if (e > 0) g.put(cx + i, yU - j, farbe(f, cx + i, yU - j), al * e);
    }
  }
}
/** Gefuelltes Dreieck (Glasscherbe): Eckpunkte relativ zur Mitte, `ang` dreht (Bogenmass), `r` Groesse; Farbe nach Lage entlang der Diagonale (hell → Farbe → dunkel). */
function ppFx6Dreieck(g, cx, cy, pts, r, ang, farben, a) {
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const P = pts.map(([px, py]) => [(px - 0.5) * r, (py - 0.5) * r]).map(([px, py]) => [cx + px * ca - py * sa, cy + px * sa + py * ca]);
  const xs = P.map(p => p[0]), ys = P.map(p => p[1]);
  const x0 = Math.floor(Math.min(...xs)), x1 = Math.ceil(Math.max(...xs)), y0 = Math.floor(Math.min(...ys)), y1 = Math.ceil(Math.max(...ys));
  const kreuz = (a1, b1, c1) => (b1[0] - a1[0]) * (c1[1] - a1[1]) - (b1[1] - a1[1]) * (c1[0] - a1[0]);
  const lo = Math.min(...P.map(p => p[0] * ca + p[1] * sa)), hi = Math.max(...P.map(p => p[0] * ca + p[1] * sa));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const q = [x + 0.5, y + 0.5], d1 = kreuz(P[0], P[1], q), d2 = kreuz(P[1], P[2], q), d3 = kreuz(P[2], P[0], q);
    if (!((d1 >= 0 && d2 >= 0 && d3 >= 0) || (d1 <= 0 && d2 <= 0 && d3 <= 0))) continue;
    const f = hi > lo ? ((x * ca + y * sa) - lo) / (hi - lo) : 0.5;
    g.put(x, y, ppFx6Stufe(f, farben, x, y), a);
  }
}
/** Segment mit Ende-Farben (Funke/Scherbe als dünner Strich): Mitte (cx, cy), Laenge `len`, Winkel `ang`; vordere Haelfte `c0`, hintere `c1`. */
function ppFx6Strich(g, cx, cy, len, ang, c0, c1, a, dicke) {
  const dx = Math.cos(ang) * len / 2, dy = Math.sin(ang) * len / 2;
  g.line(cx - dx, cy - dy, cx, cy, c0, a, dicke || 1);
  g.line(cx, cy, cx + dx, cy + dy, c1, a, dicke || 1);
}
/** Verlaufsscheibe wie ein CSS-`radial-gradient` auf einem Kreis/einer Ellipse: Halbmesser (rx, ry), `stops` [[d, Farbe, Deckung], …] mit d = Abstand zur Mitte in Anteilen des Halbmessers (aufsteigend; ueber 1 hinaus nur mit
 *  `opt.rechteck`, dann Zeichnung auf dem Rechteck |x| ≤ rx, |y| ≤ ry). Farbe zwischen zwei Stops und Deckung als Bayer-Dither (nie Alpha). */
function ppFx6Radial(g, cx, cy, rx, ry, stops, a, opt) {
  cx = Math.round(cx); cy = Math.round(cy);
  if (!(rx > 0.4) || !(ry > 0.4) || a <= 0) return;
  const dmax = stops[stops.length - 1][0], rect = !!(opt && opt.rechteck), RX = Math.ceil(rx * (rect ? 1 : Math.min(1, dmax))), RY = Math.ceil(ry * (rect ? 1 : Math.min(1, dmax)));
  for (let j = -RY; j <= RY; j++) for (let i = -RX; i <= RX; i++) {
    const d = Math.hypot(i / (rx + 0.35), j / (ry + 0.35));
    if (rect ? (Math.abs(i) > rx || Math.abs(j) > ry) : d > 1) continue;
    let k = 0;
    while (k < stops.length - 2 && d > stops[k + 1][0]) k++;
    const s0 = stops[k], s1 = stops[k + 1], f = ppR1Klemme((d - s0[0]) / Math.max(1e-6, s1[0] - s0[0])), al = (s0[2] + (s1[2] - s0[2]) * f) * a;
    if (al <= 0.03) continue;
    g.put(cx + i, cy + j, f > ppBayer(cx + i + 2, cy + j + 1) ? s1[1] : s0[1], al);
  }
}

// ═════════════════════════════════════════════════════════════════
//  Necromancy (`necromancy_summon`; auch Skeleton Necromancer, Raise the Minions, Undurdle, The Root of all Evil) — PIXELART auf EINER Leinwand.
//  Zwei violette Blitzscheiben (ab 100/250 ms, je 600 ms: wachsen .3 → 1,5 → 2 und dithern aus), zwölf Pixel-Schädel/Geister steigen auf (bis ~970 ms), 28 violette Splitter stieben nach
//  außen, acht Dunstflecken steigen. Die Standard-Lebensdauer ist 1000 ms; die DOM-Fassung ragte bis 1600 ms und wurde abgeschnitten — hier ist der Ablauf in 1000 ms gestaucht.
// ═════════════════════════════════════════════════════════════════
const PP_FX6_LILA = ['#2e0a51', '#47117e', '#6618b4', '#a040ff', '#d6b3f9'].map(ppHex);
const PP_FX6_SCHADEL_PAL = { W: ppHex('#e6e6e6'), S: ppHex('#a8a8a8'), K: ppHex('#2e0a51') };
const PP_FX6_SCHADEL = {
  klein: ['.WWWWW.', 'WWWWWWW', 'WKKWKKW', 'WKKWKKW', 'WWWKWWW', '.WWWWW.', '.WSWSW.', '..WSW..'],
  gross: ['..WWWWW..', '.WWWWWWW.', 'WWWWWWWWW', 'WKKKWKKKW', 'WKKKWKKKW', 'WWWWKWWWW', '.WWWKWWW.', '..WWWWW..', '..WSWSW..', '..WSWSW..'],
  geist: ['..WWW..', '.WWWWW.', 'WWKWKWW', 'WWKWKWW', 'WWWKWWW', 'WWWWWWW', 'WWWWWWW', 'W.WW.WW'],
};
const ppFx6Nekro = ppR1Leinwand((g, t, sz, tl) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, L = PP_FX6_LILA;
  // Blitzscheiben (Kreise 120 bzw. 80 px; Verlauf wie `radial-gradient(circle, …)`)
  [[250, 60, [[0, L[2], 0.7], [0.57, L[1], 0.4], [1, L[1], 0]]], [100, 40, [[0, L[3], 0.5], [0.71, ppHex('#6e00cc'), 0.2], [1, ppHex('#6e00cc'), 0]]]].forEach(([dl, r0, st]) => {
    const u = (t - dl) / 600;
    if (u < 0 || u > 1) return;
    const [sk, op] = ppFx6Kf(u, [[0, [0.3, 1]], [0.5, [1.5, 0.7]], [1, [2, 0]]], true), r = r0 * sk / S;
    ppFx6Radial(g, cx, cy, r, r, st, op);
  });
  // Dunstflecken (steigen 100 px, wachsen kurz, werden klein)
  tl.dunst.forEach((w) => {
    const u = (t - w.delay) / w.dur;
    if (u < 0 || u > 1) return;
    const [dy, sk, op] = ppFx6Kf(u, [[0, [0, 0.3, 0]], [0.2, [10, 1, 1]], [1, [100, 0.2, 0]]], true);
    const r = Math.max(1.2, w.size / 2 * sk / S * 1.2);
    ppFx6Radial(g, cx + w.xOff / S, cy + (w.startY - dy) / S, r, r, [[0, L[3], 0.6], [1, ppHex('#50008c'), 0.35]], op);
  });
  // Splitter
  tl.teilchen.forEach((p) => {
    const u = (t - p.delay) / p.dur;
    if (u < 0 || u > 1) return;
    const e = 1 - (1 - u) * (1 - u), n = p.size * 1.2 * (1 - e) / S;
    if (n < 0.6) return;
    const op = ppFx6Kf(u, [[0, [1]], [0.2, [1]], [1, [0]]], true)[0];
    ppFx6Punkt(g, cx + p.dx * e / S, cy + p.dy * e / S, n, p.farbe, ppFx6Voll(op, 0.7));
  });
  // Schaedel und Geister steigen auf
  tl.schaedel.forEach((s) => {
    const u = (t - s.delay) / s.dur;
    if (u < 0 || u > 1) return;
    const [px, py, op] = ppFx6Kf(u, [[0, [0, 0, 0]], [0.15, [0.15, 0.1, 0.85]], [0.5, [0.5, 0.5, 0.85]], [1, [1, 1, 0]]], true);
    const x = cx + (s.startX + s.endX * px) / S, y = cy + (s.startY + s.endY * py) / S;
    ppFx6Bild(g, PP_FX6_SCHADEL[s.bild], PP_FX6_SCHADEL_PAL, x, y, ppFx6Voll(op, 0.85), L[2]);
  });
}, 1000, { breite: 240, hoehe: 280, ankerY: 180 }, {
  z: 10100,
  vorbereiten: () => ({
    schaedel: Array.from({ length: ppFxN(12) }, () => {
      const angle = Math.random() * Math.PI * 2, dist = 30 + Math.random() * 50, size = 16 + Math.random() * 16, i = Math.floor(Math.random() * 6);
      return { startX: Math.cos(angle) * dist * 0.3, startY: Math.random() * 15, endX: Math.cos(angle) * dist, endY: -30 - Math.random() * 90,
        delay: Math.random() * 330, dur: 520 + Math.random() * 120, bild: i === 5 ? 'geist' : size > 25 ? 'gross' : 'klein' };
    }),
    teilchen: Array.from({ length: ppFxN(28) }, () => {
      const angle = Math.random() * Math.PI * 2, speed = 20 + Math.random() * 50;
      return { dx: Math.cos(angle) * speed, dy: Math.sin(angle) * speed - 20, size: 4 + Math.random() * 8,
        farbe: ppHex(['#751ff9', '#6618b4', '#9544d5', '#50008c', '#58238c', '#a952ff', '#1a0a3a'][Math.floor(Math.random() * 7)]), delay: Math.random() * 300, dur: 350 + Math.random() * 300 };
    }),
    dunst: Array.from({ length: ppFxN(8) }, () => ({ xOff: -30 + Math.random() * 60, startY: 20 + Math.random() * 20, delay: 100 + Math.random() * 250, dur: 520 + Math.random() * 250, size: 10 + Math.random() * 15 })),
  }),
});

// ═════════════════════════════════════════════════════════════════
//  Negate Shatter (`negate_shatter`; MOE Shield: der abgewehrte Zauber zerschellt am Herz) — PIXELART. Weißer Blitz (500 ms), expandierender weißer Ring mit rosa Saum (700 ms) und
//  14 Scherben (dünne Striche mit hellem Kopf), die nach außen fliegen und sich dabei drehen (800 ms, bis 135 ms versetzt). R = größeres Zonenmaß. Lebensdauer 900 ms.
// ═════════════════════════════════════════════════════════════════
const PP_FX6_ROSA = ['#f174ab', '#f8b4df', '#fae5eb', '#ffffff', '#fc69c6'].map(ppHex);
const ppFx6NegateShatter = ppR1Leinwand((g, t, sz, tl) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, R = tl.R, P = PP_FX6_ROSA;
  { // Blitz: Scheibe (Durchmesser 1,2 R), Sichtradius ~.43 R · Maßstab
    const u = t / 500;
    if (u <= 1) {
      const sk = 0.5 + 0.65 * (1 - (1 - u) * (1 - u)), op = ppFx6Kf(u, [[0, [0]], [0.2, [1]], [1, [0]]], true)[0];
      ppFx6Radial(g, cx, cy, R * 0.6 * sk / S, R * 0.6 * sk / S, [[0, P[3], 0.9], [0.57, P[1], 0.5], [1, P[4], 0]], op);
    }
  }
  { // Ring (Durchmesser .9 R, Maßstab .4 → 1,5)
    const u = t / 700;
    if (u <= 1) {
      const sk = 0.4 + 1.1 * (1 - (1 - u) * (1 - u)), op = ppFx6Kf(u, [[0, [0]], [0.15, [1]], [1, [0]]], true)[0], r = R * 0.45 * sk / S, a = ppFx6Voll(op, 0.7);
      g.ring(cx, cy, r, r + 2.4, P[0], a * 0.55);
      g.ring(cx, cy, Math.max(0, r - 1.4), r, P[3], a);
    }
  }
  tl.scherben.forEach((s) => {
    const u = (t - s.verzug) / 800;
    if (u < 0 || u > 1) return;
    const e = 1 - Math.pow(1 - u, 2.2), op = ppFx6Kf(u, [[0, [0]], [0.12, [1]], [1, [0]]], true)[0];
    const x = cx + s.dx * R * 0.7 * e / S, y = cy + s.dy * R * 0.7 * e / S, ang = Math.PI / 2 + s.dreh * u;
    ppFx6Strich(g, x, y, Math.max(3, s.l / S), ang, P[3], u < 0.5 ? P[1] : P[0], ppFx6Voll(op, 0.6), 2);
  });
}, 900, (p) => { const R = Math.max(p.w || 90, p.h || 120), e = Math.ceil(R * 0.9 + 30); return { breite: e * 2, hoehe: e * 2 }; }, {
  z: 10094,
  vorbereiten: (sz) => ({
    R: Math.max(sz.props.w || 90, sz.props.h || 120),
    scherben: Array.from({ length: ppFxN(14) }, (_, i) => {
      const w = (i / 14) * Math.PI * 2 + (i % 3) * 0.2;
      return { dx: Math.cos(w), dy: Math.sin(w), l: 10 + (i % 5) * 7, b: 2 + (i % 3), dreh: (i % 2 ? 1 : -1) * (90 + i * 20) * Math.PI / 180, verzug: (i % 4) * 45 };
    }),
  }),
});

// ═════════════════════════════════════════════════════════════════
//  Niu Power-Up (`niu_powerup`; Guardian Beast Niu) — PIXELART. Goldener Stärkungsschub: gedithertes Lichtband steigt hinter dem Helden (750 ms), gelber Blitz wächst .25 → 2,2 (650 ms),
//  goldener Heiligenring weitet sich (ab 50 ms, 800 ms), acht Pixel-Sterne gleiten nach außen, 18 Funken stieben. Alles in ≤ 950 ms (Standard-Lebensdauer 1000 ms).
// ═════════════════════════════════════════════════════════════════
const PP_FX6_GOLD = ['#f9ac20', '#fad54a', '#fff196', '#fffbd2', '#ffffff'].map(ppHex);
const PP_FX6_STERN = {
  klein: ['..Y..', '.YWY.', 'YWWWY', '.YWY.', '..Y..'],
  gross: ['...Y...', '...Y...', '..YWY..', 'YYWWWYY', '..YWY..', '...Y...', '...Y...'],
  kreuz: ['.Y.', 'YWY', '.Y.'],
};
const ppFx6Niu = ppR1Leinwand((g, t, sz, tl) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, G = PP_FX6_GOLD;
  { // Lichtband: unten am Helden (+70 px), 180 px hoch, wächst von unten
    const u = t / 750;
    if (u <= 1) {
      const sy = ppFx6Kf(u, [[0, [0.2]], [0.2, [1]], [0.6, [1.05]], [1, [1.15]]], true)[0], op = ppFx6Kf(u, [[0, [0]], [0.2, [1]], [0.6, [0.8]], [1, [0]]], true)[0];
      ppFx6Saeule(g, cx, cy + 70 / S, 180 * sy / S, () => 28 / S,
        (f, x, y) => ppFx6Stufe(f, [G[1], G[2], G[4], G[2]], x, y),
        (f) => ppFx6Kf(f, [[0, [0]], [0.25, [0.55]], [0.55, [0.85]], [0.75, [0.95]], [0.95, [0.4]], [1, [0]]])[0], op, 3);
    }
  }
  { // Blitz
    const u = t / 650;
    if (u <= 1) {
      const [sk, op] = ppFx6Kf(u, [[0, [0.25, 1]], [0.35, [1.5, 0.9]], [0.7, [1.9, 0.55]], [1, [2.2, 0]]], true), r = 65 * sk / S;
      ppFx6Radial(g, cx, cy, r, r, [[0, G[2], 1], [0.5, G[1], 0.7], [0.85, G[0], 0.3], [1, G[0], 0.12]], op);
      ppFx6Radial(g, cx, cy, r + 8, r + 8, [[0, G[0], 0], [0.8, G[0], 0], [0.86, G[0], 0.32], [1, G[0], 0]], op);
    }
  }
  { // Ring
    const u = (t - 50) / 800;
    if (u >= 0 && u <= 1) {
      const [sk, op] = ppFx6Kf(u, [[0, [0.35, 0]], [0.25, [1.05, 1]], [0.7, [1.4, 0.55]], [1, [1.7, 0]]], true), r = 70 * sk / S, a = ppFx6Voll(op, 0.7);
      g.ring(cx, cy, r, r + 2, G[0], a * 0.45);
      g.ring(cx, cy, r - 1.4, r, G[1], a);
      g.ring(cx, cy, r - 2.6, r - 1.4, G[4], a * 0.6);
    }
  }
  tl.sterne.forEach((s) => {
    const u = (t - s.delay) / s.dur;
    if (u < 0 || u > 1) return;
    const [k, sk, op] = ppFx6Kf(u, [[0, [0, 0.3, 0]], [0.2, [0.3, 1.2, 1]], [0.7, [1, 1.05, 1]], [1, [1.25, 0.5, 0]]], true);
    const x = cx + s.x * k / S, y = cy + (s.y * k - (u > 0.7 ? 12 * (u - 0.7) / 0.3 : 0)) / S;
    ppFx6Bild(g, s.size * sk > 17 ? PP_FX6_STERN.gross : s.size * sk > 9 ? PP_FX6_STERN.klein : PP_FX6_STERN.kreuz, { Y: G[2], W: G[4] }, x, y, ppFx6Voll(op, 0.8), G[0]);
  });
  tl.funken.forEach((p) => {
    const u = (t - p.delay) / p.dur;
    if (u < 0 || u > 1) return;
    const e = 1 - (1 - u) * (1 - u), n = p.size * 1.2 * (1 - e) / S;
    if (n < 0.6) return;
    const op = ppFx6Kf(u, [[0, [1]], [0.2, [1]], [1, [0]]], true)[0];
    ppFx6Punkt(g, cx + p.dx * e / S, cy + p.dy * e / S, n, p.farbe, ppFx6Voll(op, 0.7));
  });
}, 950, { breite: 240, hoehe: 260, ankerY: 145 }, {
  z: 10100,
  vorbereiten: () => ({
    funken: Array.from({ length: ppFxN(18) }, () => {
      const angle = Math.random() * Math.PI * 2, speed = 22 + Math.random() * 38;
      return { dx: Math.cos(angle) * speed, dy: Math.sin(angle) * speed - 8, size: 4 + Math.random() * 6,
        farbe: ppHex(['#fad54a', '#fff196', '#fad54a', '#ffffff', '#f9ac20'][Math.floor(Math.random() * 5)]), delay: Math.random() * 200, dur: 400 + Math.random() * 300 };
    }),
    sterne: Array.from({ length: ppFxN(8) }, (_, i) => {
      const angle = (i / 8) * Math.PI * 2 + Math.random() * 0.4, dist = 40 + Math.random() * 25;
      return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist - 10, size: 14 + Math.random() * 8, delay: 60 + Math.random() * 200, dur: 450 + Math.random() * 200 };
    }),
  }),
});

// ═════════════════════════════════════════════════════════════════
//  Nuke Blast (`nuke_blast`; Future Tech Doomsday Bomb, Brett-Animation `zoneType: 'board'`, x/y = Mitte des Bretts, w/h = Brettmaß) — PIXELART. Geometrie aus `nukeLayout` (Zündpunkt unter der
//  Mitte): Weißblitz (900 ms), zwei flache Druckwellen-Ringe (1100 ms, die zweite ab 220 ms), Feuerball (1200 ms), Stiel (1500 ms) und Pilzkappe (1700 ms) wachsen nach oben,
//  26 Glutfunken fliegen aufwärts und fallen aus (bis ~1660 ms). Die Leinwand wird auf das Fenster zugeschnitten (Welt-Effekte: volle Größe).
// ═════════════════════════════════════════════════════════════════
const PP_FX6_NUKE = { weiss: ppHex('#ffffff'), creme: ppHex('#fff8e8'), hell: ppHex('#f9ecb3'), gelb: ppHex('#ffd966'), orange: ppHex('#ff8b1a'), orange2: ppHex('#ff9a1a'), rot: ppHex('#ff491a'),
  glut: ppHex('#cf5f00'), braun: ppHex('#7d3911'), rost: ppHex('#b62600') };
function ppFx6NukeMass(p) {
  const L = nukeLayout(p.w, p.h), M = Math.max(L.breite, L.hoehe), hx = Math.ceil(Math.max(L.welle * 0.95, L.blitz * 0.62, L.breite * 0.6));
  let links = hx, rechts = hx, oben = Math.ceil(Math.max(L.zuendung - L.kappeOben + L.kappeH * 0.5, M * 0.6 - L.zuendung)), unten = Math.ceil(L.zuendung + M * 0.6);
  if (!p.welt) {            // ausserhalb des Fensters sieht man nichts: Leinwand auf das Fenster zuschneiden
    links = Math.min(links, Math.ceil(p.x) + 6); rechts = Math.min(rechts, Math.ceil(window.innerWidth - p.x) + 6);
    oben = Math.min(oben, Math.ceil(p.y) + 6); unten = Math.min(unten, Math.ceil(window.innerHeight - p.y) + 6);
  }
  return { breite: links + rechts, hoehe: oben + unten, ankerX: links, ankerY: oben };
}
const ppFx6Nuke = ppR1Leinwand((g, t, sz, tl) => {
  const S = sz.S, N = PP_FX6_NUKE, L = tl.L, zy = sz.cy + L.zuendung / S, cx = sz.cx;
  { // Weißblitz am Zündpunkt (Durchmesser L.blitz, sichtbar bis ~.9 R)
    const u = t / 900;
    if (u <= 1) {
      const sk = ppFx6Kf(u, [[0, [0.15]], [0.08, [0.55]], [0.3, [1]], [1, [1.25]]], true)[0], op = ppFx6Kf(u, [[0, [0]], [0.08, [1]], [0.3, [0.85]], [1, [0]]], true)[0];
      const r = L.blitz / 2 * sk / S;
      ppFx6Radial(g, cx, zy, r, r, [[0, N.weiss, 0.98], [0.4, N.hell, 0.75], [0.735, N.orange2, 0.35], [1, N.rot, 0.1]], op);
    }
  }
  [[0, 1], [220, 0.6]].forEach(([dl, am]) => { // Druckwellen: flacher Ring (Breite L.welle, Höhe .34 davon)
    const u = (t - dl) / 1100;
    if (u < 0 || u > 1) return;
    const e = 1 - Math.pow(1 - u, 3), sk = 0.05 + 1.85 * e, op = ppFx6Kf(u, [[0, [0]], [0.12, [1]], [1, [0]]], true)[0] * am, a = ppFx6Voll(op, 0.7);
    const rx = L.welle / 2 * sk / S, ry = L.welle * 0.17 * sk / S;
    g.ellRing(cx, zy, rx + 2.5, ry + 1.4, 2.6, N.orange2, a * 0.5);
    g.ellRing(cx, zy, rx, ry, 1.7, ppHex('#fff196'), a);
    g.ellRing(cx, zy, rx - 1.7, ry - 1.7, 1.2, N.weiss, a * 0.6);
  });
  { // Stiel: steht auf dem Zündpunkt, wächst nach oben (Halbbreite = stielB/2, oben abgerundet)
    const u = t / 1500;
    if (u <= 1) {
      const [sy, sx] = ppFx6Kf(u, [[0, [0.05, 0.5]], [0.55, [1, 1]], [1, [1.12, 1.15]]], true), op = ppFx6Kf(u, [[0, [0]], [0.18, [1]], [1, [0]]], true)[0];
      const hw = L.stielB / 2 * sx / S;
      ppFx6Saeule(g, cx, zy, L.stielH * sy / S,
        (f) => f > 0.82 ? hw * Math.sqrt(Math.max(0, 1 - Math.pow((f - 0.82) / 0.18, 2))) : f < 0.1 ? hw * (0.75 + 2.5 * f) : hw,
        (f, x, y) => ppFx6Stufe(f, [N.orange, N.orange2, N.gelb, ppHex('#fbe181')], x, y),
        (f) => ppFx6Kf(f, [[0, [0.35]], [0.3, [0.7]], [1, [0.95]]])[0], op, 2.5);
    }
  }
  { // Feuerball
    const u = t / 1200;
    if (u <= 1) {
      const [sk, op] = ppFx6Kf(u, [[0, [0.1, 0]], [0.1, [0.9, 1]], [0.55, [1.15, 0.8]], [1, [1.35, 0]]], true), r = L.kern / 2 * sk / S;
      if (r >= 1) ppFx6Radial(g, cx, zy, r, r, [[0, N.creme, 1], [0.37, N.gelb, 1], [0.735, N.orange, 1], [1, N.rost, 0.64]], op);
    }
  }
  { // Pilzkappe (Ellipse kappe × kappeH, Ursprung 50 % / 90 %)
    const u = t / 1700;
    if (u <= 1) {
      const [sk, ty] = ppFx6Kf(u, [[0, [0.08, 0.3]], [0.22, [0.55, 0.06]], [0.6, [1, -0.06]], [1, [1.22, -0.16]]], true);
      const op = ppFx6Kf(u, [[0, [0]], [0.22, [1]], [1, [0]]], true)[0], oy = sz.cy + (L.kappeOben + L.kappeH * 0.9) / S;
      const ccy = oy + sk * ((L.kappeOben + L.kappeH / 2) / S - (L.kappeOben + L.kappeH * 0.9) / S + ty * L.kappeH / S);
      const rx = L.kappe / 2 * sk / S, ry = L.kappeH / 2 * sk / S;
      if (rx >= 1.5) {
        // Schein ausserhalb (box-shadow 60 px): zwei gedithert Ringe
        g.ellRing(cx, ccy, rx + 5, ry + 5, 2.5, N.orange2, op * 0.22);
        g.ellRing(cx, ccy, rx + 2.5, ry + 2.5, 2.5, N.orange2, op * 0.4);
        const kn = [N.creme, N.gelb, N.orange, N.glut, N.braun], gren = [0.2, 0.42, 0.62, 0.82, 1];
        const X0 = Math.floor(cx - rx - 1), X1 = Math.ceil(cx + rx + 1), Y0 = Math.floor(ccy - ry - 1), Y1 = Math.ceil(ccy + ry + 1), gy = ccy + ry * 0.36;
        for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) {
          const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - ccy) / ry, dd = nx * nx + ny * ny;
          if (dd > 1) continue;
          const d = Math.hypot((x + 0.5 - cx) / (1.41 * rx), (y + 0.5 - gy) / (1.92 * ry)) / 0.9;
          let k = 0;
          while (k < 4 && d > gren[k]) k++;
          if (k > 0 && d - gren[k - 1] < 0.08 && ppBayer(x, y) > (d - gren[k - 1]) / 0.08) k--;
          g.put(x, y, dd > 0.84 ? (k < 2 ? N.orange : kn[Math.min(4, k + 1)]) : kn[k], op * ppFx6Kf(d, [[0, [0.95]], [0.32, [0.9]], [0.62, [0.82]], [0.88, [0.7]], [1, [0.5]]])[0]);
        }
      }
    }
  }
  tl.glut.forEach((f) => { // Glut: fliegt nach außen/oben und fällt aus
    const u = (t - f.verzug) / f.dauer;
    if (u < 0 || u > 1) return;
    const [px, py] = ppFx6Kf(u, [[0, [0, 0]], [0.12, [0.22, 0.3]], [1, [1, 1]]], true), [sk, op] = ppFx6Kf(u, [[0, [0.3, 0]], [0.12, [1, 1]], [1, [0.25, 0]]], true);
    const n = f.groesse * sk / S;
    if (n < 0.6) return;
    ppFx6Punkt(g, cx + f.dx * px / S, zy + (f.dy * py + 34 * (u > 0.12 ? (u - 0.12) / 0.88 : 0)) / S, n, f.farbe, ppFx6Voll(op, 0.7));
  });
}, 1700, ppFx6NukeMass, {
  z: 10200,
  vorbereiten: (sz) => {
    const L = nukeLayout(sz.props.w, sz.props.h);
    return { L, glut: Array.from({ length: ppFxN(26) }, () => {
      const winkel = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.5, weite = 0.35 + Math.random() * 0.75;
      return { dx: Math.cos(winkel) * L.breite * 0.5 * weite, dy: Math.sin(winkel) * L.hoehe * 0.45 * weite, groesse: 5 + Math.random() * 13,
        farbe: ppHex(['#fffbd2', '#fad54a', '#ff8b1a', '#ff491a', '#ffffff'][Math.floor(Math.random() * 5)]), verzug: Math.random() * 260, dauer: 700 + Math.random() * 700 };
    }) };
  },
});

// ═════════════════════════════════════════════════════════════════
//  Paralyzing Bolts (`paralyzing_bolts`; Wire Hatchling) — PIXELART. 14 Blitze schlagen aus einem Ring rundum ein (jeder eine Kette aus Rauten, hell am Rand, zur Mitte hin dünn),
//  flackern zweimal in 2 Stufen (je 130–220 ms ab bis 620 ms); darüber ein elektrischer Käfig (Rahmen, schrumpft von 1,25 und blinkt, 1200 ms) und 12 knisternde Funken. Lebensdauer 1200 ms.
// ═════════════════════════════════════════════════════════════════
const PP_FX6_BLITZ = ['#e5f5fa', '#b3d8f9', '#66b6ff', '#ffffff', '#7fdfff', '#68c6fd'].map(ppHex);
const PP_FX6_BLITZ_FORM = [[0, 0.05], [0.18, 0.35], [0.3, 0.02], [0.48, 0.42], [0.6, 0], [0.78, 0.3], [1, 0.04]];   // Halbbreite je Strecke (Anteil der Blitzhöhe), wie das Zickzack-Polygon
const ppFx6Paralyse = ppR1Leinwand((g, t, sz, tl) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, B = PP_FX6_BLITZ, ww = tl.ww, hh = tl.hh;
  { // Käfig
    const u = t / 1200;
    if (u <= 1) {
      const [op, sk] = ppFx6Kf(u, [[0, [0, 1.25]], [0.18, [1, 1]], [0.34, [0.35, 1]], [0.48, [1, 1]], [0.78, [0.75, 1.02]], [1, [0, 1]]], true);
      const hx = ww * 0.46 * sk / S, hy = hh * 0.46 * sk / S, a = ppFx6Voll(op, 0.7), x0 = Math.round(cx - hx), y0 = Math.round(cy - hy), w = Math.round(hx * 2), h = Math.round(hy * 2);
      const rahmen = (dx, dy, c, aa) => { g.block(x0 - dx, y0 - dy, w + dx * 2 + 1, 1, c, aa); g.block(x0 - dx, y0 + h + dy, w + dx * 2 + 1, 1, c, aa); g.block(x0 - dx, y0 - dy, 1, h + dy * 2 + 1, c, aa); g.block(x0 + w + dx, y0 - dy, 1, h + dy * 2 + 1, c, aa); };
      rahmen(-1, -1, B[4], a * 0.5);
      rahmen(1, 1, B[2], a * 0.45);
      rahmen(0, 0, B[1], a);
    }
  }
  tl.blitze.forEach((b) => {
    const lt = t - b.delay;
    if (lt < 0 || lt >= b.dur * 2) return;
    const u = (lt % b.dur) / b.dur, op = ppFx6Kf(u, [[0, [0]], [0.25, [1]], [0.55, [0.35]], [0.75, [1]], [1, [0]]])[0];
    const a = op > 0.7 ? 1 : op > 0.2 ? 0.5 : 0;
    if (a <= 0) return;
    const x0 = cx + b.x / S, y0 = cy + b.y / S, x1 = x0 + Math.cos(b.ang) * b.laenge / S, y1 = y0 + Math.sin(b.ang) * b.laenge / S, hh3 = b.dicke * 3 / S;
    ppR1Band(g, x0, y0, x1, y1, (f) => {
      const hw = ppFx6Kf(f, PP_FX6_BLITZ_FORM.map(([k, v]) => [k, [v]]))[0] * hh3;
      return { w: Math.max(1, hw * 2), c: f < 0.15 ? b.farbe : f < 0.55 ? B[4] : B[2], a: f < 0.55 ? 1 : 1 - (f - 0.55) / 0.45 * 0.8 };
    }, a);
  });
  tl.funken.forEach((f) => {
    const lt = t - f.delay;
    if (lt < 0 || lt >= f.dur * 2) return;
    const u = (lt % f.dur) / f.dur, [op, sk] = ppFx6Kf(u, [[0, [0, 0.4]], [0.4, [1, 1.2]], [1, [0, 0.5]]]);
    if (op < 0.3) return;
    const n = Math.max(1, Math.round(f.groesse * sk / S)), x = cx + f.links / S, y = cy + f.oben / S;
    if (n >= 2) { g.put(x - n, y, B[5], 0.55); g.put(x + n, y, B[5], 0.55); g.put(x, y - n, B[5], 0.55); g.put(x, y + n, B[5], 0.55); }
    ppFx6Punkt(g, x, y, n, B[0], 1);
  });
}, 1200, (p) => {
  const ww = Math.max(p.w || 90, 90), hh = Math.max(p.h || 110, 110), r = Math.ceil(Math.max(ww, hh) * 0.95 * 1.25 + 14);
  return { breite: r * 2, hoehe: r * 2 };
}, {
  z: 10160,
  vorbereiten: (sz) => {
    const ww = Math.max(sz.props.w || 90, 90), hh = Math.max(sz.props.h || 110, 110), radius = Math.max(ww, hh) * 0.95;
    return { ww, hh,
      blitze: Array.from({ length: ppFxN(14) }, (_, i) => {
        const w = (i / 14) * Math.PI * 2 + (Math.random() - 0.5) * 0.35, laenge = radius * (0.75 + Math.random() * 0.45);
        return { x: Math.cos(w) * laenge, y: Math.sin(w) * laenge * 0.8, laenge, dicke: 3 + Math.random() * 4, ang: w + Math.PI, delay: Math.random() * 620, dur: 130 + Math.random() * 90,
          farbe: PP_FX6_BLITZ[[0, 1, 2, 3][Math.floor(Math.random() * 4)]] };
      }),
      funken: Array.from({ length: ppFxN(12) }, () => ({ links: (Math.random() - 0.5) * ww * 0.9, oben: (Math.random() - 0.5) * hh * 0.9, groesse: 2 + Math.random() * 4, delay: 120 + Math.random() * 700, dur: 260 + Math.random() * 260 })),
    };
  },
});

// ═════════════════════════════════════════════════════════════════
//  Pink Glass Shatter (`pink_glass_shatter`; Shattered Trident, und über die Registry-Komponente `glass_shatter` mit `palette` — Glass Sword in Türkis) — PIXELART.
//  Eine Glasscheibe (132×96 px, schräg gedithert hell → Farbe) blitzt auf, bekommt vier Risse (in drei Stufen, ab 100 ms) und zerspringt nach ~220 ms: ein heller Aufprallring weitet sich
//  (ab 220 ms), 22 Dreiecks-Scherben fliegen und drehen sich (ab 220 ms), 16 Staubpunkte stieben. `palette` wie vorher ({ shards, dust, vars: { '--gp-…': 'rgba(r,g,b,a)' } }); die Risse
//  bleiben hier nicht stehen, sondern vergehen mit den Scherben (~600 ms). Lebensdauer < 1000 ms.
// ═════════════════════════════════════════════════════════════════
const PP_FX6_GLAS_TRI = [[[0, 0], [1, 0], [0.3, 1]], [[0, 0], [1, 0.4], [0, 1]], [[0.2, 0], [1, 0], [1, 1]], [[0, 0.3], [1, 0], [0.6, 1]], [[0, 0], [1, 0.6], [0.2, 1]], [[0.4, 0], [1, 1], [0, 0.8]]];
function ppFx6RgbaHex(s, vorgabe) {   // 'rgba(248,180,223,.45)' → [r, g, b] (die Skriptfarben sind bereits Palettenfarben)
  const m = typeof s === 'string' && s.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  return m ? [+m[1], +m[2], +m[3]] : ppHex(vorgabe);
}
const ppFx6GlasScherben = ppR1Leinwand((g, t, sz, tl) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, F = tl.f;
  { // Aufprallring (ab 220 ms, 600 ms): Ellipse 200 × 120, Maßstab .3×.4 → 1,4×1,1 → 2,1×1,6
    const u = (t - 220) / 600;
    if (u >= 0 && u <= 1) {
      const [sx, sy, op] = ppFx6Kf(u, [[0, [0.3, 0.4, 1]], [0.4, [1.4, 1.1, 0.8]], [1, [2.1, 1.6, 0]]], true), rx = 100 * sx / S, ry = 60 * sy / S, a = ppFx6Voll(op, 0.8);
      g.ellRing(cx, cy, rx, ry, 3.2, F.ringC, a * 0.55);
      g.ellRing(cx, cy, rx - 1.5, ry - 1.5, 2, F.ringB, a * 0.8);
      g.ellRing(cx, cy, rx - 3, ry - 3, 1.3, F.ringA, a);
    }
  }
  { // Scheibe (340 ms): 132 × 96 px
    const u = t / 340;
    if (u <= 1) {
      const [sk, op] = ppFx6Kf(u, [[0, [0.55, 0]], [0.3, [1.06, 1]], [0.62, [1, 1]], [0.78, [1.02, 1]], [1, [1.1, 0]]], true);
      const hx = 66 * sk / S, hy = 48 * sk / S, x0 = Math.round(cx - hx), y0 = Math.round(cy - hy), w = Math.round(hx * 2), h = Math.round(hy * 2), a = ppFx6Voll(op, 0.7);
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        if ((i < 2 && j < 2 - i) || (i >= w - 2 && j < i - (w - 3)) || (i < 2 && j >= h - 2 + i) || (i >= w - 2 && j >= h - 2 + (w - 1 - i))) continue;      // Ecken rund
        const rand = i === 0 || j === 0 || i === w - 1 || j === h - 1, innen = i === 1 || j === 1 || i === w - 2 || j === h - 2, f = (i / w + j / h) / 2;
        const c = rand ? F.rand : innen ? F.hell : ppFx6Stufe(f, [F.hell, F.paneA, F.paneB, F.paneC], x0 + i, y0 + j);
        g.put(x0 + i, y0 + j, c, rand ? a : a * 0.72);
      }
    }
  }
  { // Risse (ab 100 ms, drei Stufen, 260 ms; vergehen ab 330 ms)
    const lt = t - 100;
    if (lt >= 0 && lt < 560) {
      const st = lt < 260 ? Math.floor(lt / 260 * 3 + 1) / 3 : 1, sk = 0.6 + 0.4 * st, a = lt < 260 ? st : ppR1Aus(lt, 260, 560), hx = 66 * sk / S * 0.97, hy = 48 * sk / S * 0.97;
      [[28, 1], [-63, 1], [82, 0.9], [-18, 0.85]].forEach(([deg, am]) => {
        const w = deg * Math.PI / 180, d = Math.min(hx / Math.max(0.05, Math.abs(Math.cos(w))), hy / Math.max(0.05, Math.abs(Math.sin(w))));
        g.line(cx - Math.cos(w) * d, cy - Math.sin(w) * d, cx + Math.cos(w) * d, cy + Math.sin(w) * d, F.riss, a * am, 1);
      });
      g.disc(cx, cy, 1.2, F.weiss, a);
    }
  }
  tl.scherben.forEach((s) => {
    const u = (t - s.delay) / s.dur;
    if (u < 0 || u > 1) return;
    const e = 1 - Math.pow(1 - u, 2.3), [sk, op] = ppFx6Kf(u, [[0, [1.1, 1]], [0.25, [0.9, 1]], [1, [0.35, 0]]]);
    const x = cx + s.dx * e / S, y = cy + (s.dy * e + 26 * e * e) / S;
    ppFx6Dreieck(g, x, y, s.tri, Math.max(2, s.size * sk / S), s.rot * u, [F.weiss, s.hue, s.hue, F.tief], ppFx6Voll(op, 0.6));
  });
  tl.staub.forEach((p) => {
    const u = (t - p.delay) / p.dur;
    if (u < 0 || u > 1) return;
    const e = 1 - (1 - u) * (1 - u), n = p.size * 1.2 * (1 - e) / S;
    if (n < 0.6) return;
    ppFx6Punkt(g, cx + p.dx * e / S, cy + p.dy * e / S, n, p.color, ppFx6Voll(ppFx6Kf(u, [[0, [1]], [0.2, [1]], [1, [0]]], true)[0], 0.7));
  });
}, 980, { breite: 360, hoehe: 300 }, {
  z: 10100,
  vorbereiten: (sz) => {
    const pal = sz.props.palette || {}, v = pal.vars || {}, SHARDS = (pal.shards || ['#f8b4df', '#f174ab', '#f3bad3', '#f174ab', '#f8b4df']).map(ppHex), DUST = (pal.dust || ['#fae5eb', '#f3bad3', '#f8b4df']).map(ppHex);
    return {
      f: { rand: ppFx6RgbaHex(v['--gp-border'], '#f8b4df'), hell: ppFx6RgbaHex(v['--gp-pane-c'], '#fae5eb'), paneA: ppFx6RgbaHex(v['--gp-pane-a'], '#f8b4df'), paneB: ppFx6RgbaHex(v['--gp-pane-b'], '#f174ab'),
        paneC: ppFx6RgbaHex(v['--gp-pane-c'], '#fae5eb'), riss: ppFx6RgbaHex(v['--gp-crack'], '#fae5eb'), weiss: ppHex('#ffffff'), tief: ppFx6RgbaHex(v['--gp-shard-deep'], '#c80480'),
        ringA: ppFx6RgbaHex(v['--gp-ring-a'], '#f1e5fa'), ringB: ppFx6RgbaHex(v['--gp-ring-b'], '#f174ab'), ringC: ppFx6RgbaHex(v['--gp-ring-c'], '#fc69c6') },
      scherben: Array.from({ length: ppFxN(22) }, () => {
        const w = Math.random() * Math.PI * 2, sp = 34 + Math.random() * 78;
        return { dx: Math.cos(w) * sp, dy: Math.sin(w) * sp + 14, size: 8 + Math.random() * 14, rot: (Math.random() - 0.5) * 540 * Math.PI / 180, tri: PP_FX6_GLAS_TRI[Math.floor(Math.random() * 6)],
          hue: SHARDS[Math.floor(Math.random() * SHARDS.length)], delay: 220 + Math.random() * 60, dur: 420 + Math.random() * 260 };
      }),
      staub: Array.from({ length: ppFxN(16) }, () => {
        const w = Math.random() * Math.PI * 2, sp = 20 + Math.random() * 50;
        return { dx: Math.cos(w) * sp, dy: Math.sin(w) * sp, size: 2 + Math.random() * 4, color: DUST[Math.floor(Math.random() * DUST.length)], delay: 230 + Math.random() * 60, dur: 300 + Math.random() * 200 };
      }),
    };
  },
});

// ═════════════════════════════════════════════════════════════════
//  Poisoned Well (`poisoned_well`) — PIXELART. Violette Blasen (14: Pixelkugeln mit Glanz, 8–24 px) steigen aus der Mitte der Zone auf (ab i·50 ms, 600–1100 ms), dazu zehn Dampfwolken
//  (gedithertes Violett, 20–50 px, ab 200 ms, steigen 70 px und wachsen). Standard-Lebensdauer 1000 ms: Verzögerungen/Dauern so gestaucht, dass alles bis ~980 ms endet.
// ═════════════════════════════════════════════════════════════════
const PP_FX6_GIFT = { rand: ppHex('#7a2bd0'), t: ['#d6b3f9', '#a040ff', '#7a2bd0', '#47117e'].map(ppHex) };
const ppFx6Brunnen = ppR1Leinwand((g, t, sz, tl) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, V = PP_FX6_GIFT;
  tl.dampf.forEach((d) => {
    const u = (t - d.delay) / d.dur;
    if (u < 0 || u > 1) return;
    const [dy, sk, op] = ppFx6Kf(u, [[0, [0, 0.6, 0]], [0.2, [14, 0.8, 0.6]], [0.6, [40, 1.2, 0.4]], [1, [70, 1.6, 0]]], true), r = Math.max(1.5, d.size / 2 * sk / S);
    ppFx6Radial(g, cx + d.dx / S, cy - 10 / S - dy / S - r * 0.4, r, r, [[0, ppHex('#b278ed'), 0.5], [0.7, ppHex('#7e41ba'), 0.2], [1, ppHex('#7e41ba'), 0.12]], op * 1.4);
  });
  tl.blasen.forEach((b) => {
    const u = (t - b.delay) / b.dur;
    if (u < 0 || u > 1) return;
    const [dx, dy, sk, op] = ppFx6Kf(u, [[0, [0, 0, 0.5, 0]], [0.15, [0.3, 10, 0.75, 0.8]], [0.5, [1, 30, 1, 0.7]], [1, [1, 50, 0.4, 0]]], true), r = Math.max(1.2, b.size / 2 * sk / S);
    ppW76Kugel(g, cx + b.dx * dx / S, cy - r - dy / S, r, V, ppFx6Voll(op, 0.7));
  });
}, 980, { breite: 200, hoehe: 200, ankerY: 120 }, {
  z: 10100,
  vorbereiten: () => ({
    blasen: Array.from({ length: ppFxN(14) }, (_, i) => ({ dx: -25 + Math.random() * 50, size: 8 + Math.random() * 16, delay: i * 38 + Math.random() * 60, dur: 450 + Math.random() * 300 })),
    dampf: Array.from({ length: ppFxN(10) }, (_, i) => ({ dx: -20 + Math.random() * 40, size: 20 + Math.random() * 30, delay: 160 + i * 40 + Math.random() * 60, dur: 500 + Math.random() * 280 })),
  }),
});

// ═════════════════════════════════════════════════════════════════
//  Pollution verdunstet (`pollution_evaporate`; Pollution Token, Mana Beacon, Victorica) — PIXELART. Die dunkle Aura (Zonenmaß, 850 ms) zieht sich dithernd zusammen (Maßstab 1 → .4),
//  acht Dunstflecken (18–36 px, violett/lavendel) steigen auf und wachsen (700–1000 ms, ab bis 250 ms), zehn helle Lavendelfunken steigen im Fächer (ab 100 ms, 600–900 ms). 1000 ms.
// ═════════════════════════════════════════════════════════════════
const ppFx6Verdunstung = ppR1Leinwand((g, t, sz, tl) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, V = PP_FX6_LILA, cw = tl.cw, ch = tl.ch;
  { // Aura: dunkles Violett über der Zone, schrumpft
    const u = t / 850;
    if (u <= 1) {
      const [sk, op] = ppFx6Kf(u, [[0, [1, 0.9]], [0.4, [0.85, 0.6]], [1, [0.4, 0]]], true), rx = cw / 2 * sk / S, ry = ch / 2 * sk / S;
      ppFx6Radial(g, cx, cy, rx, ry, [[0, ppHex('#401a66'), 0.85], [0.78, ppHex('#1a0a3a'), 0.55], [1.414, ppHex('#1a0a3a'), 0]], op, { rechteck: true });
    }
  }
  tl.dunst.forEach((w) => {
    const u = (t - w.delay) / w.dur;
    if (u < 0 || u > 1) return;
    const [px, py, sk, op] = ppFx6Kf(u, [[0, [0, 0, 0.6, 0]], [0.25, [0.25, 0.25, 0.9, 0.9]], [1, [1, 1, 1.4, 0]]], true), r = Math.max(1.5, w.size / 2 * sk / S);
    ppFx6Radial(g, cx + (w.startX + (w.dx - w.startX) * px) / S, cy + w.dy * py / S, r, r, [[0, ppHex('#b278ed'), 0.75], [0.9, ppHex('#702db3'), 0.55], [1, V[1], 0.45]], op);
  });
  tl.funken.forEach((s) => {
    const u = (t - s.delay) / s.dur;
    if (u < 0 || u > 1) return;
    const [sk, op] = ppFx6Kf(u, [[0, [0.5, 0]], [0.3, [0.9, 1]], [1, [0.2, 0]]], true), e = 1 - (1 - u) * (1 - u), n = s.size * sk / S * 1.4;
    ppFx6Punkt(g, cx + s.dx * e / S, cy + s.dy * e / S, Math.max(1, n), s.color, ppFx6Voll(op, 0.7));
  });
}, 1000, (p) => { const w = (p.w || 100) + 60, h = (p.h || 140) + 150; return { breite: w, hoehe: h, ankerY: (p.h || 140) / 2 + 100 }; }, {
  z: 10100,
  vorbereiten: (sz) => ({
    cw: sz.props.w || 100, ch: sz.props.h || 140,
    dunst: Array.from({ length: ppFxN(8) }, () => { const o = (Math.random() - 0.5) * 40; return { startX: o, dx: o + (Math.random() - 0.5) * 30, dy: -40 - Math.random() * 50, size: 18 + Math.random() * 18, delay: Math.random() * 250, dur: 700 + Math.random() * 250 }; }),
    funken: Array.from({ length: ppFxN(10) }, () => {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.3, d = 22 + Math.random() * 42;
      return { dx: Math.cos(a) * d, dy: Math.sin(a) * d, size: 2 + Math.random() * 3, delay: 100 + Math.random() * 400, dur: 500 + Math.random() * 400, color: ppHex(['#d6b3f9', '#d9c0ec', '#ac87de', '#f1e5fa'][Math.floor(Math.random() * 4)]) };
    }),
  }),
});

// ═════════════════════════════════════════════════════════════════
//  Pressed Skill (`pressed_skill_rain`) — PIXELART. Goldener, glitzernder Regen fällt auf den Helden: 30 dünne Goldstriche (ein Rasterpixel breit, heller Kopf, Schweif), zwölf vierzackige
//  Glanzpunkte (Pixelsterne, 2 Größen, Blinken) und ein warmer Goldschimmer (gedithert) über dem Helden (1500 ms). Der Aufrufer gibt 1700 ms Lebensdauer.
// ═════════════════════════════════════════════════════════════════
const PP_FX6_REGEN = ['#fffbd2', '#ffd066', '#f9ac20', '#fff196', '#ffffff', '#ffd966'].map(ppHex);
const ppFx6Goldregen = ppR1Leinwand((g, t, sz, tl) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, C = PP_FX6_REGEN, W = tl.W, H = tl.H;
  { // Schimmer, der sich auf dem Helden sammelt (Ellipse 1,1 W × .5 H, Mitte auf .35 H)
    const u = t / 1500;
    if (u <= 1) {
      const [sk, op] = ppFx6Kf(u, [[0, [0.6, 0]], [0.35, [1.05, 1]], [0.7, [1.12, 0.8]], [1, [1.2, 0]]], true);
      ppFx6Radial(g, cx, cy + H * 0.35 / S, W * 0.55 * sk / S, H * 0.25 * sk / S, [[0, C[3], 0.55], [0.64, C[1], 0.3], [1, C[1], 0.06]], op);
    }
  }
  tl.striche.forEach((d) => {
    const u = (t - d.delay) / d.dur;
    if (u < 0 || u > 1) return;
    const op = ppFx6Kf(u, [[0, [0]], [0.14, [1]], [0.8, [0.95]], [1, [0]]])[0];
    const x = cx + (d.lx + d.sway * u) / S, y = cy + (d.startY + d.fall * u) / S, l = Math.max(2, Math.round(d.len / S));
    for (let k = 0; k < l; k++) g.put(x, y - k, k === l - 1 ? C[0] : k > l * 0.45 ? C[1] : k > 0 ? C[1] : C[2], ppFx6Voll(op, 0.7) * (k < l * 0.35 ? 1 : 1 - (k - l * 0.35) / (l * 0.65) * 0.7));
    g.put(x, y, C[0], ppFx6Voll(op, 0.7));
  });
  tl.glanz.forEach((s) => {
    const u = (t - s.delay) / s.dur;
    if (u < 0 || u > 1) return;
    const [dy, sk, op] = ppFx6Kf(u, [[0, [0, 0.5, 0]], [0.2, [0.25, 1.15, 1]], [0.45, [0.45, 1, 0.35]], [0.65, [0.65, 0.9, 1]], [1, [1, 0.4, 0]]]);
    const x = cx + (s.lx + s.sway * dy) / S, y = cy + (s.startY + s.fall * dy) / S;
    ppFx6Bild(g, s.size * sk >= 6 ? PP_FX6_STERN.klein : PP_FX6_STERN.kreuz, { Y: C[5], W: C[4] }, x, y, ppFx6Voll(op, 0.7));
  });
}, 1650, (p) => { const W = p.w || 72, H = p.h || 100, r = Math.ceil(W * 0.75 + 24), o = Math.ceil(H / 2 + 80), un = Math.ceil(H + 130); return { breite: r * 2, hoehe: o + un, ankerY: o }; }, {
  z: 10100,
  vorbereiten: (sz) => {
    const W = sz.props.w || 72, H = sz.props.h || 100;
    return { W, H,
      striche: Array.from({ length: ppFxN(30) }, () => ({ lx: (Math.random() - 0.5) * W * 1.1, startY: -(H / 2) - 26 - Math.random() * 40, fall: H + 70 + Math.random() * 36, len: 7 + Math.random() * 9,
        delay: Math.random() * 560, dur: 620 + Math.random() * 280, sway: (Math.random() - 0.5) * 14 })),
      glanz: Array.from({ length: ppFxN(12) }, () => ({ lx: (Math.random() - 0.5) * W * 1.05, startY: -(H / 2) - 14 - Math.random() * 36, fall: H + 50 + Math.random() * 30, size: 5 + Math.random() * 4,
        delay: Math.random() * 620, dur: 680 + Math.random() * 260, sway: (Math.random() - 0.5) * 12 })),
    };
  },
});

// ═════════════════════════════════════════════════════════════════
//  Promotion Burst (`promotion_burst`; Garius, the Great Reformer — Beförderung auf der Tausch-Zone) — PIXELART. Von unten nach oben: Lichtsockel (Ellipse unter der Zone, 1100 ms), Säulenschacht
//  (nach oben verjüngt, wächst, 1100 ms), drei Aufstiegsringe (ab 120/310/500 ms, je 620 ms, steigen 1,05 Zonenhöhen), 26 Funken im Schacht, ein goldener Kranz schließt sich (ab 620 ms, 640 ms).
//  Der Aufrufer gibt 1400 ms; die Funken sind auf ≤ 1380 ms gestaucht.
// ═════════════════════════════════════════════════════════════════
const PP_FX6_BEFOERDERUNG = ['#f9ac20', '#fad54a', '#ffd966', '#f9ecb3', '#fffbd2', '#ffffff'].map(ppHex);
const ppFx6Befoerderung = ppR1Leinwand((g, t, sz, tl) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, C = PP_FX6_BEFOERDERUNG, ww = tl.ww, hh = tl.hh;
  { // Lichtsockel: Ellipse (ww·1,04 × ww·.34), Mitte auf .2 hh + .17 ww
    const u = t / 1100;
    if (u <= 1) {
      const [sk, op] = ppFx6Kf(u, [[0, [0.3, 0]], [0.2, [1, 1]], [0.7, [1.06, 0.9]], [1, [1.1, 0]]], true);
      ppFx6Radial(g, cx, cy + (hh * 0.2 + ww * 0.17) / S, ww * 0.52 * sk / S, ww * 0.17 * sk / S, [[0, ppHex('#fff196'), 0.9], [0.64, ppHex('#ffc61c'), 0.45], [1, ppHex('#ffc61c'), 0.1]], op);
    }
  }
  { // Säulenschacht: unten bei .35 hh, 1,25 hh hoch, Trapez (unten 72 % der Breite, oben 32 %)
    const u = t / 1100;
    if (u <= 1) {
      const [sy, op] = ppFx6Kf(u, [[0, [0.15, 0]], [0.25, [1, 1]], [0.75, [1, 0.85]], [1, [1.05, 0]]], true);
      ppFx6Saeule(g, cx, cy + hh * 0.35 / S, hh * 1.25 * sy / S, (f) => ww * 0.34 * (0.72 - 0.4 * f) / 0.68 / S * 1.0,
        (f, x, y) => ppFx6Stufe(f, [C[2], C[3], C[4]], x, y), (f) => 0.55 * (1 - f) + 0.08, op, 1.5);
    }
  }
  [120, 310, 500].forEach((dl) => { // Aufstiegsringe
    const u = (t - dl) / 620;
    if (u < 0 || u > 1) return;
    const [dy, sk, op] = ppFx6Kf(u, [[0, [0, 0.7, 0]], [0.2, [0.2, 1, 1]], [1, [1, 1.25, 0]]], true), a = ppFx6Voll(op, 0.7), ry = ww * 0.15 * sk / S, rx = ww * 0.44 * sk / S;
    const y = cy + (hh * 0.16 + ww * 0.15 - hh * 1.05 * dy) / S;
    g.ellRing(cx, y, rx + 2, ry + 1.4, 2, C[0], a * 0.5);
    g.ellRing(cx, y, rx, ry, 1.6, C[3], a);
  });
  tl.funken.forEach((f) => {
    const u = (t - f.delay) / f.dur;
    if (u < 0 || u > 1) return;
    const [k, sk, op] = ppFx6Kf(u, [[0, [0, 0.5, 0]], [0.18, [0.2, 1, 1]], [1, [1, 0.4, 0]]], true), n = f.groesse * sk / S;
    if (n < 0.6) return;
    ppFx6Punkt(g, cx + f.links / S, cy + (f.start - f.hoch * k) / S, Math.max(1, n), f.farbe, ppFx6Voll(op, 0.7));
  });
  { // Kranz: Kreis ww·.84, Mitte auf .30 hh + .42 ww … dreht sich (Ring bleibt rund — nur Größe/Deckung)
    const u = (t - 620) / 640;
    if (u >= 0 && u <= 1) {
      const [sk, op] = ppFx6Kf(u, [[0, [1.5, 0]], [0.45, [1, 1]], [1, [1.08, 0]]], true), r = ww * 0.42 * sk / S, a = ppFx6Voll(op, 0.7), y = cy + (hh * 0.3 + ww * 0.0) / S;
      const ky = cy + (-hh * 0.12 + ww * 0.42) / S;
      g.ring(cx, ky, r + 1.4, r + 3.4, C[0], a * 0.45);
      g.ring(cx, ky, r - 0.4, r + 1.4, C[3], a);
      g.ring(cx, ky, r - 1.8, r - 0.4, C[4], a * 0.55);
    }
  }
}, 1400, (p) => {
  const ww = Math.max(p.w || 80, 80), hh = Math.max(p.h || 110, 110), r = Math.ceil(ww * 0.9 + 20), o = Math.ceil(hh * 1.1 + ww * 0.15 + 40), un = Math.ceil(hh * 0.2 + ww * 0.4 + 40);
  return { breite: r * 2, hoehe: o + un, ankerY: o };
}, {
  z: 10150,
  vorbereiten: (sz) => {
    const ww = Math.max(sz.props.w || 80, 80), hh = Math.max(sz.props.h || 110, 110);
    return { ww, hh, funken: Array.from({ length: ppFxN(26) }, () => ({ links: (Math.random() - 0.5) * ww * 0.95, start: hh * (0.1 + Math.random() * 0.35), groesse: 3 + Math.random() * 5, hoch: hh * (0.9 + Math.random() * 0.9),
      dur: 560 + Math.random() * 440, delay: Math.random() * 380, farbe: ppHex(['#fffbd2', '#fad54a', '#ffffff', '#f9ecb3'][Math.floor(Math.random() * 4)]) })) };
  },
});

// ═════════════════════════════════════════════════════════════════
//  Rain of Death (`rain_of_death`) — PIXELART. Dunkelroter Regen auf dem Ziel: Pixel-Schädel, Blutstropfen und Punkte fallen (22, ab bis ~340 ms), blutrote Spritzer am Boden der Zone (18),
//  ein niedriger dunkelroter Nebel pulsiert (gedithert). Die DOM-Fassung (1,4 s) wurde bei der Standard-Lebensdauer 1000 ms hart abgeschnitten — hier ist der Ablauf auf ~960 ms gestaucht.
// ═════════════════════════════════════════════════════════════════
const PP_FX6_TOD = { W: ppHex('#e6e6e6'), S: ppHex('#a8a8a8'), K: ppHex('#3a0000'), R: ppHex('#be0e0e'), D: ppHex('#780000'), H: ppHex('#ff6666') };
const PP_FX6_TOD_BILD = { schaedel: ['.WWW.', 'WWWWW', 'WKWKW', 'WWWWW', '.WSW.', '.W.W.'], tropfen: ['.D.', '.R.', 'RRR', 'RHR', '.R.'], punkt: ['R'] };
const ppFx6Todesregen = ppR1Leinwand((g, t, sz, tl) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, T = PP_FX6_TOD;
  { // Nebel (Kreis 140 px, ab 100 ms)
    const u = (t - 100) / 860;
    if (u >= 0 && u <= 1) {
      const [sk, op] = ppFx6Kf(u, [[0, [0.5, 0]], [0.3, [1.1, 1]], [0.7, [1.3, 0.85]], [1, [1.5, 0]]], true), r = 70 * sk / S;
      ppFx6Radial(g, cx, cy, r, r, [[0, ppHex('#780000'), 0.55], [0.64, ppHex('#520a0c'), 0.35], [1, ppHex('#520a0c'), 0.09]], op * 1.3);
    }
  }
  tl.tropfen.forEach((d) => {
    const u = (t - d.delay) / d.dur;
    if (u < 0 || u > 1) return;
    const op = ppFx6Kf(u, [[0, [0]], [0.15, [1]], [0.8, [1]], [1, [0]]], true)[0], e = u * u, x = cx + d.xOff / S, y = cy + (d.startY + 220 * e) / S;
    ppFx6Bild(g, PP_FX6_TOD_BILD[d.bild], T, x, y, ppFx6Voll(op, 0.7), d.bild === 'schaedel' ? T.D : null);
  });
  tl.spritzer.forEach((p) => {
    const u = (t - p.delay) / p.dur;
    if (u < 0 || u > 1) return;
    const [dy, sk, op] = ppFx6Kf(u, [[0, [0, 0.4, 0]], [0.25, [p.dy, 1.2, 1]], [1, [8, 0.6, 0]]], true);
    ppFx6Punkt(g, cx + p.xOff / S, cy + dy / S, Math.max(1, p.size * sk / S * 1.3), p.farbe, ppFx6Voll(op, 0.7));
  });
}, 980, (p) => { const cw = p.w || 100, r = Math.ceil(Math.max(cw * 0.75, 90) + 20); return { breite: r * 2, hoehe: 340, ankerY: 280 }; }, {
  z: 10100,
  vorbereiten: (sz) => {
    const cw = sz.props.w || 100;
    return {
      tropfen: Array.from({ length: ppFxN(22) }, () => ({ xOff: -cw * 0.7 + Math.random() * cw * 1.4, startY: -160 - Math.random() * 120, delay: Math.random() * 340, dur: 380 + Math.random() * 280,
        bild: Math.random() < 0.3 ? 'schaedel' : (Math.random() < 0.5 ? 'tropfen' : 'punkt') })),
      spritzer: Array.from({ length: ppFxN(18) }, () => ({ xOff: -cw * 0.5 + Math.random() * cw, dy: -5 - Math.random() * 12, size: 3 + Math.random() * 5, delay: 140 + Math.random() * 500, dur: 260 + Math.random() * 200,
        farbe: ppHex(['#b5171c', '#6a1c14', '#8b0d0d', '#3a0000', '#c0141c'][Math.floor(Math.random() * 5)]) })),
    };
  },
});

// ═════════════════════════════════════════════════════════════════
//  Rain of Spores (`rain_of_spores_rain`; Rain of Spores — Fenster-Effekt über das ganze Fenster) — PIXELART. 200 gelbe Sporen (1–3 Rasterpixel, Palette Gold/Gelb) fallen von oben nach
//  unten, leicht schlängelnd (Zickzack-Versatz), ab 0–1000 ms, je 1100–1500 ms; die Leinwand ist so groß wie das Fenster (mindestens 480 × 320). Der Aufrufer gibt 2400 ms.
//  Entfallen: der kaum sichtbare goldene Schleier über dem Spielfeld (Alpha 4–10 %).
// ═════════════════════════════════════════════════════════════════
const PP_FX6_SPORE = ['#ffe469', '#fad54a', '#fbe181', '#ffb91a', '#f7f7ad'].map(ppHex);
const ppFx6Sporen = ppR1Leinwand((g, t, sz, tl) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, W = tl.W, H = tl.H;
  for (const s of tl.sporen) {
    const u = (t - s.delay) / s.dur;
    if (u < 0 || u > 1) continue;
    const dx = u < 0.5 ? s.xEnd * 0.5 * (u / 0.5) + s.wobble * (u / 0.5) : s.xEnd * (0.5 + 0.5 * (u - 0.5) / 0.5) + s.wobble * (1 - (u - 0.5) / 0.5);
    const op = ppFx6Kf(u, [[0, [0]], [0.1, [s.opacity]], [0.9, [s.opacity]], [1, [0]]])[0];
    const x = cx + (s.xStart + dx) / S, y = cy + (s.yStart + s.yEnd * u * 1.0) / S;
    if (y < 0 || y > sz.gh + 2) continue;
    if (s.n >= 2) {
      g.block(Math.round(x), Math.round(y), 2, 2, s.farbe, ppFx6Voll(op, 0.8));
      if (s.n >= 3) { g.put(x - 1, y, s.farbe, op * 0.6); g.put(x + 2, y + 1, s.farbe, op * 0.6); g.put(x, y - 1, s.farbe, op * 0.6); g.put(x + 1, y + 2, s.farbe, op * 0.6); }
    } else g.put(x, y, s.farbe, ppFx6Voll(op, 0.8));
  }
}, 2400, (p) => { const W = Math.max(p.w || window.innerWidth, 480), H = Math.max(p.h || window.innerHeight, 320); return { breite: W, hoehe: H }; }, {
  z: 10090,
  vorbereiten: (sz) => {
    const W = Math.max(sz.props.w || window.innerWidth, 480), H = Math.max(sz.props.h || window.innerHeight, 320);
    return { W, H, sporen: Array.from({ length: ppFxN(200) }, () => {
      const size = 3 + Math.random() * 6;
      return { xStart: Math.random() * W - W / 2, yStart: -H / 2 - 40, xEnd: -50 + Math.random() * 100, yEnd: H + 80, wobble: -25 + Math.random() * 50,
        delay: Math.random() * 1000, dur: 1100 + Math.random() * 400, n: size < 5 ? 1 : size < 7.5 ? 2 : 3, opacity: 0.6 + Math.random() * 0.35, farbe: PP_FX6_SPORE[Math.floor(Math.random() * PP_FX6_SPORE.length)] };
    }) };
  },
});

// ═════════════════════════════════════════════════════════════════
//  Root-Nebel (`root_evil_mist`; The Root of all Evil — Creature wird gelöscht) — PIXELART. Schwarzer, unheilvoller Nebel legt sich über die Karte (Rechteck Zone + 10 px, dunkelrot gesäumt,
//  Dither-Verlauf), 16 Schwaden (54–106 px, gedithert, mit dunkelrotem Saum) wachsen und driften nach oben, zehn dunkelrote Aschefunken steigen 70 px. Die DOM-Fassung (1,7–2,5 s) wurde bei
//  der Standard-Lebensdauer 1000 ms abgeschnitten — hier ist der Ablauf auf ~970 ms gestaucht (Faktor ~.55).
// ═════════════════════════════════════════════════════════════════
const PP_FX6_NEBEL = ['#08060c', '#12101f', '#1a1a2e', '#4b1021', '#8c0014', '#c0141c'].map(ppHex);
const ppFx6Wurzelnebel = ppR1Leinwand((g, t, sz, tl) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, N = PP_FX6_NEBEL, cw = tl.cw, ch = tl.ch;
  { // Schatten über der Karte (Rechteck, Rand weich gedithert)
    const u = t / 940;
    if (u <= 1) {
      const op = ppFx6Kf(u, [[0, [0]], [0.3, [1]], [0.75, [0.9]], [1, [0]]], true)[0], hx = (cw + 20) / 2 / S, hy = (ch + 20) / 2 / S;
      ppFx6Radial(g, cx, cy, hx, hy, [[0, N[0], 0.95], [0.78, N[1], 0.75], [1.414, N[3], 0]], op, { rechteck: true });
    }
  }
  tl.schwaden.forEach((n) => {
    const u = (t - n.delay) / n.dur;
    if (u < 0 || u > 1) return;
    const [dx, dy, sk, op] = ppFx6Kf(u, [[0, [0, 0, 0.4, 0]], [0.3, [0.3, 0.3, 0.8, 1]], [1, [1, 1, 1.6, 0]]], true), r = Math.max(2, n.size / 2 * sk / S * 0.85);
    ppFx6Radial(g, cx + (n.sx + n.dx * dx) / S, cy + (n.sy + n.dy * dy) / S, r, r, [[0, N[0], 0.97], [0.68, N[1], 0.8], [1, N[3], 0.1]], op);
  });
  tl.funken.forEach((f) => {
    const u = (t - f.delay) / f.dur;
    if (u < 0 || u > 1) return;
    const op = ppFx6Kf(u, [[0, [0]], [0.2, [1]], [1, [0]]], true)[0], e = 1 - (1 - u) * (1 - u);
    ppFx6Punkt(g, cx + f.x / S, cy + (ch * 0.2 - 70 * e) / S, f.size / S * 1.2, N[4], ppFx6Voll(op, 0.7));
    if (f.size >= 3 && op > 0.5) g.put(cx + f.x / S + 1, cy + (ch * 0.2 - 70 * e) / S - 1, N[5], 1);
  });
}, 970, (p) => { const cw = p.w || 100, ch = p.h || 140; return { breite: Math.ceil(cw + 220), hoehe: Math.ceil(ch + 240) }; }, {
  z: 10100,
  vorbereiten: (sz) => {
    const cw = sz.props.w || 100, ch = sz.props.h || 140, K = 0.55;
    return { cw, ch,
      schwaden: Array.from({ length: ppFxN(16) }, () => {
        const a = Math.random() * Math.PI * 2, r = Math.random();
        return { sx: Math.cos(a) * cw * 0.45 * r, sy: Math.sin(a) * ch * 0.45 * r + ch * 0.1, dx: (Math.random() - 0.5) * 50, dy: -30 - Math.random() * 60, size: 54 + Math.random() * 52,
          delay: Math.round(Math.random() * 400 * K), dur: Math.round((1100 + Math.random() * 700) * K) };
      }),
      funken: Array.from({ length: ppFxN(10) }, () => ({ x: (Math.random() - 0.5) * cw, delay: Math.round((300 + Math.random() * 700) * K), dur: Math.round((700 + Math.random() * 500) * K), size: 2 + Math.round(Math.random() * 2) })),
    };
  },
});

ppFxUeberschreiben('necromancy_summon', ppFx6Nekro);
ppFxUeberschreiben('negate_shatter', ppFx6NegateShatter);
ppFxUeberschreiben('niu_powerup', ppFx6Niu);
ppFxUeberschreiben('nuke_blast', ppFx6Nuke);
ppFxUeberschreiben('paralyzing_bolts', ppFx6Paralyse);
ppFxUeberschreiben('pink_glass_shatter', ppFx6GlasScherben);
ppFxUeberschreiben('poisoned_well', ppFx6Brunnen);
ppFxUeberschreiben('pollution_evaporate', ppFx6Verdunstung);
ppFxUeberschreiben('pressed_skill_rain', ppFx6Goldregen);
ppFxUeberschreiben('promotion_burst', ppFx6Befoerderung);
ppFxUeberschreiben('rain_of_death', ppFx6Todesregen);
ppFxUeberschreiben('rain_of_spores_rain', ppFx6Sporen);
ppFxUeberschreiben('root_evil_mist', ppFx6Wurzelnebel);
