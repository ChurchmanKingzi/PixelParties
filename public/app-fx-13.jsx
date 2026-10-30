// Pixelart-Portierungen (Canvas), Batch 13 (zweite Welle, Schwelle 50 ms): siehe app-fx-0.jsx. Jede Portierung: `ppFxUeberschreiben('typ', Komponente)`.
// Effekte: guardian_shield, guillotine_drop, heal_sparkle, healing_hearts, heart_burst, hell_charm, hydra_goo, ice_block_crash, ice_encase, juice_bubbles, knowledge_sparkle, laser_burst.
// Alle laufen auf EINER Leinwand je Effekt (`ppR1Leinwand`, 1 Rasterpixel = 3 Bildschirmpixel, 30 Bilder/s) mit den Ankern, Zeiten und Zahlen der DOM-Fassungen in `ANIM_REGISTRY` (app-board.jsx, Keyframes
// in style.css). Pixelart-Regeln: nur Palettenfarben, Deckung < 1 = Bayer-Dithering, keine Unschärfe / Verläufe (Schein und Verlauf = Dither-Dichte plus Farbstufen), keine Drehung von Bildern (Herzen,
// Schneeflocken, Schild = kleine Sprites bzw. berechnete Geometrie), Bewegung in ganzen Rasterpixeln. Alle Aufrufer laufen mit der Standard-Dauer 1000 ms (`onZoneAnim`); Teilchen, deren DOM-Fassung
// über 1000 ms hinausragte (und dort abgeschnitten wurde), laufen hier verkürzt aus (`ppFx13Lauf`).

// ── Bausteine (Präfix ppFx13 / PP_FX13) ─────────────────────────────────────────────────────────────────────────────────
const ppFx13Zufall = (a, b) => a + Math.random() * (b - a);
const ppFx13Wahl = (l) => l[Math.floor(Math.random() * l.length)];
const ppFx13Hex = (l) => l.map(ppHex);
/** Fortschritt u (0..1) eines Teilchens mit Verzug und Dauer; Dauer wird so gekürzt, dass es spätestens bei `ende` fertig ist (`null` = nicht sichtbar). */
function ppFx13Lauf(t, verzug, dauer, ende) {
  const d = Math.max(60, Math.min(dauer, ende - verzug));
  const u = (t - verzug) / d;
  return (u < 0 || u > 1) ? null : u;
}
/** CSS-`cubic-bezier(x1, y1, x2, y2)` als Funktion x → y (für `ppKf` als `ease`). */
function ppFx13Bez(x1, y1, x2, y2) {
  const kurve = (a, b, s) => 3 * a * s * (1 - s) * (1 - s) + 3 * b * s * s * (1 - s) + s * s * s;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0, hi = 1;
    for (let i = 0; i < 16; i++) { const m = (lo + hi) / 2; if (kurve(x1, x2, m) < x) lo = m; else hi = m; }
    return kurve(y1, y2, (lo + hi) / 2);
  };
}
/**
 * Radialer Schein wie `radial-gradient(… , transparent)`: Dichte fällt von der Mitte (Deckung `a`) nach außen auf 0 (Bayer-Raster), die Farbe wechselt in Stufen (`stufen` von außen nach innen).
 * Schneller als `g.glow` (Math.sqrt statt Math.hypot, Potenz nur bei p ≠ 1).
 */
function ppFx13Glow(g, cx, cy, rx, ry, stufen, a = 1, p = 1) {
  if (rx < 0.6 || ry < 0.6 || a <= 0.01) return;
  cx = Math.round(cx); cy = Math.round(cy);
  const RX = Math.ceil(rx), RY = Math.ceil(ry), n = stufen.length, irx = 1 / rx, iry = 1 / ry;
  for (let j = -RY; j <= RY; j++) {
    const v = j * iry, v2 = v * v;
    if (v2 >= 1) continue;
    for (let i = -RX; i <= RX; i++) {
      const u = i * irx, d2 = u * u + v2;
      if (d2 >= 1) continue;
      const w = 1 - Math.sqrt(d2), dichte = (p === 1 ? w : Math.pow(w, p)) * a;
      if (dichte <= ppBayer(cx + i, cy + j)) continue;
      g.put(cx + i, cy + j, stufen[Math.min(n - 1, Math.floor(w * n))], 1);
    }
  }
}
/** Schein um einen Ring (Radius r): Dichte fällt von dort auf `breite` Rasterpixel nach außen (und nach innen auf die halbe Breite) auf 0. */
function ppFx13Hof(g, cx, cy, r, breite, c, a) {
  if (a <= 0.01 || breite <= 0) return;
  cx = Math.round(cx); cy = Math.round(cy);
  const R = Math.ceil(r + breite), ri = breite * 0.5;
  for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) {
    const d = Math.sqrt(i * i + j * j), ab = d - r;
    if (ab > breite || ab < -ri) continue;
    const dichte = (ab >= 0 ? 1 - ab / breite : 1 + ab / ri) * a;
    if (dichte > ppBayer(cx + i, cy + j)) g.put(cx + i, cy + j, c, 1);
  }
}
/** Farbe aus einer Stufenfolge `stops` = [[Lage 0..1, [r,g,b]], …] bei Lage f; zwischen zwei Stufen per Bayer-Raster gestreut. */
function ppFx13Stufe(stops, f, X, Y) {
  if (f <= stops[0][0]) return stops[0][1];
  for (let k = 1; k < stops.length; k++) {
    if (f <= stops[k][0]) {
      const a = stops[k - 1], b = stops[k], q = (f - a[0]) / ((b[0] - a[0]) || 1);
      return q > ppBayer(X, Y) ? b[1] : a[1];
    }
  }
  return stops[stops.length - 1][1];
}
/**
 * Gefülltes Vieleck (gerade-ungerade-Regel, Rasterkoordinaten): `farbe(X, Y)` → Farbe; `rand` (oder null) = Farbe der Randpixel (Pixel, die an Leere grenzen); Deckung `a` per Bayer.
 */
function ppFx13Flaeche(g, pts, farbe, rand, a = 1) {
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const p of pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  const X0 = Math.floor(x0), Y0 = Math.floor(y0), w = Math.ceil(x1) - X0 + 1, h = Math.ceil(y1) - Y0 + 1;
  if (w <= 0 || h <= 0 || w > 400 || h > 400) return;
  const m = new Uint8Array(w * h);
  for (let Y = Y0; Y < Y0 + h; Y++) {
    const xs = [];
    for (let k = 0; k < pts.length; k++) {
      const p = pts[k], q = pts[(k + 1) % pts.length];
      if ((p[1] <= Y + 0.5 && q[1] > Y + 0.5) || (q[1] <= Y + 0.5 && p[1] > Y + 0.5)) xs.push(p[0] + (Y + 0.5 - p[1]) / (q[1] - p[1]) * (q[0] - p[0]));
    }
    xs.sort((s, u) => s - u);
    for (let k = 0; k + 1 < xs.length; k += 2) for (let X = Math.round(xs[k]); X < Math.round(xs[k + 1]); X++) m[(Y - Y0) * w + (X - X0)] = 1;
  }
  const da = (i, j) => (i < 0 || j < 0 || i >= w || j >= h) ? 0 : m[j * w + i];
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    if (!m[j * w + i]) continue;
    const kante = rand && (!da(i - 1, j) || !da(i + 1, j) || !da(i, j - 1) || !da(i, j + 1));
    g.put(X0 + i, Y0 + j, kante ? rand : farbe(X0 + i, Y0 + j), a);
  }
}
/** Kleine Kugel mit Durchmesser `d` Rasterpixeln: 1 Pixel, 2×2 oder Scheibe (ab 3,5 mit Glanzpunkt). */
function ppFx13Kugel(g, x, y, d, c, hell, a = 1) {
  if (a <= 0.02 || d <= 0.3) return;
  if (d < 1.5) g.put(x, y, c, a);
  else if (d < 2.5) g.block(x - 1, y - 1, 2, 2, c, a);
  else { g.disc(x, y, d / 2 - 0.3, c, a); if (hell && d >= 3.5) g.put(x - d * 0.18, y - d * 0.18, hell, a); }
}
/** Der Standard-Blitz hinter Heil-/Herz-Effekten (`.anim-gold-flash`, 0,5 s: .3 → 1,3 → 1,6 mal, Deckung 1 → .6 → 0): Scheibe mit Halbmesser `r0` Pixeln, sichtbar bis `sicht` (Anteil des Halbmessers). */
function ppFx13Blitz(g, t, cx, cy, S, r0, stufen, a, sicht) {
  const u = t / 500;
  if (u < 0 || u > 1) return;
  const [sc, op] = ppKf(u, [[0, [0.3, 1]], [0.5, [1.3, 0.6]], [1, [1.6, 0]]]);
  const r = r0 * sc * sicht / S;
  ppFx13Glow(g, cx, cy, r, r, stufen, a * op, 1);
}

// Herzen in vier Größen: `P` Fläche, `L` Glanz, `d` Schattenkante (Muster wie `love_burst`, app-fx-5.jsx)
const PP_FX13_HERZ = [
  ['PLP', 'PPP', '.d.'],
  ['PP.PP', 'PLPPP', 'PPPPP', '.PPP.', '..d..'],
  ['.PP.PP.', 'PLLPPPP', 'PLPPPPP', '.PPPPPd', '..dPPd.', '...d...'],
  ['.PPP.PPP.', 'PLLPPPPPP', 'PLPPPPPPP', 'PPPPPPPPd', '.PPPPPPd.', '..PPPPd..', '...ddd...', '....d....'],
];
/** Herz in Bildschirmpixeln Größe `px` (Schriftgröße), Mitte (x, y), Farbsatz `farbe` { P, L, d }. */
function ppFx13Herz(g, x, y, px, farbe, a = 1) {
  if (a <= 0.02 || px < 3) return;
  g.spr(PP_FX13_HERZ[px < 10 ? 0 : px < 17 ? 1 : px < 24 ? 2 : 3], farbe, x, y, a);
}
/** Plus-Zeichen (✚) in Bildschirmpixeln Größe `px`. */
function ppFx13Kreuz(g, x, y, px, c, a = 1) {
  if (a <= 0.02 || px < 3) return;
  const n = Math.max(1, Math.round(px / 6)), dick = px >= 15 ? 2 : 1;
  x = Math.round(x); y = Math.round(y);
  g.block(x - n, y - Math.floor(dick / 2), 2 * n + 1, dick, c, a);
  g.block(x - Math.floor(dick / 2), y - n, dick, 2 * n + 1, c, a);
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Guardian Shield (`guardian_shield`; Divine Gift of the Guardian …) — PIXELART. 1000 ms, wie vorher: ein roter Ring (70 px, 3 px stark) und ein Schild (statt 🛡️) wachsen von .3 auf 1,2 (25 %), sinken
//  auf 1 (60 %, Deckung .8) und weiten sich auf 1,5 beim Ausblenden. Der Schein um den Ring (Weichzeichner) ist ein Dither-Hof, die innere Tönung eine dünne Dither-Fläche; das Schild ist ein Pixelbild
//  aus berechneter Form (Rand, Stahlrahmen, rotes Feld mit Glanz und Mittelsteg), pro Bild neu in der aktuellen Größe gezeichnet (keine Skalierung eines Bildes).
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX13_SCHILD = ppFx13Hex(['#ff1a1a', '#f03232', '#780000', '#8f0000', '#be0e0e', '#ef2929', '#ff6666', '#d2d2db', '#f9b3b3', '#59606e']);
function ppFx13SchildZeichnen(g, cx, cy, W, H, a) {
  const [, , DUNKEL, , TIEF, ROT, HELL, STAHL, STEG, SCHATTEN] = PP_FX13_SCHILD;
  cx = Math.round(cx); cy = Math.round(cy);
  const hw = W / 2, y0 = -H / 2;
  // Breite (Halbmaß) in Zeile j: oben gerade, ab 55 % der Höhe läuft die Form spitz zu
  const halb = (j) => {
    const f = (j - y0) / H;
    if (f < 0 || f > 1) return -1;
    return f < 0.5 ? hw : hw * (1 - Math.pow((f - 0.5) / 0.5, 1.5));
  };
  const innen = (i, j) => Math.abs(i + 0.0) <= halb(j) - 0.01;
  const R = Math.ceil(Math.max(hw, H / 2)) + 1;
  for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) {
    if (!innen(i, j)) continue;
    const kante = !innen(i - 1, j) || !innen(i + 1, j) || !innen(i, j - 1) || !innen(i, j + 1);
    if (kante) { g.put(cx + i, cy + j, DUNKEL, a); continue; }
    const rahmen = !innen(i - 2, j) || !innen(i + 2, j) || !innen(i, j - 2) || !innen(i, j + 2);
    if (rahmen && W >= 7) { g.put(cx + i, cy + j, i < 0 ? STAHL : SCHATTEN, a); continue; }
    const steg = W >= 7 && Math.abs(i) < 0.6;
    const f = (j - y0) / H;
    g.put(cx + i, cy + j, steg ? STEG : (i < -hw * 0.25 && f < 0.7 ? HELL : (i > hw * 0.3 ? TIEF : ROT)), a);
  }
}
const ppFx13GuardianShield = ppR1Leinwand((g, t, sz) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, C = PP_FX13_SCHILD;
  const u = t / 1000;
  if (u > 1) return;
  const [sc, op] = ppKf(u, [[0, [0.3, 0]], [0.25, [1.2, 1]], [0.6, [1, 0.8]], [1, [1.5, 0]]]);
  const R = 35 * sc / S;
  if (op <= 0.02) return;
  // innere Tönung (inset-Schein) und äußerer Hof
  ppFx13Glow(g, cx, cy, R - 0.5, R - 0.5, [C[2], C[0]], op * 0.12, 0.5);
  ppFx13Hof(g, cx, cy, R, 15 / S, C[0], op * 0.3);
  g.ring(cx, cy, Math.max(0, R - 1.1), R, C[1], op * 0.95);                       // Ring, 3 px
  // Schild (Schrift 32 px in 40-px-Feld: ~28 × 32 px)
  ppFx13SchildZeichnen(g, cx, cy, Math.max(3, Math.round(28 * sc / S)), Math.max(3, Math.round(33 * sc / S)), op);
}, 1000, { breite: 240, hoehe: 240 }, { z: 10100 });

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Madame Guillotine (`guillotine_drop`) — PIXELART. Zeitplan wie vorher: Rahmen (zwei Pfosten + Querbalken, Holz in drei Tönen) blendet in 160 ms ein (rutscht 10 px herab), steht und dithert ab 700 ms
//  bis 900 ms aus; das Fallbeil (Stahl, schräge Unterkante, vier Graustufen) fällt von 120 bis 540 ms um 96 px (beschleunigend), bleibt liegen und dithert zuletzt weg; ab 480 ms ein roter Schnitt
//  quer über die Zone (-12°, wächst .2 → 1,05 → 1, rote Enden, heller Kern) und eine rote Glut (Dither-Scheibe, .4 → 1 → 1,3). Von 300 bis 560 ms bebt alles um 1–2 Rasterpixel.
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX13_BEIL = ppFx13Hex(['#4a2a10', '#5a341a', '#9d612f', '#7f7f7f', '#d2d2db', '#ffffff', '#9aa3b6', '#e5edfa', '#ef2929', '#f0bfbc', '#ff1a1a', '#8f0000']);
const PP_FX13_BEIL_E = ppFx13Bez(0.55, 0, 0.9, 0.35);
const ppFx13Guillotine = ppR1Leinwand((g, t, sz) => {
  const S = sz.S, C = PP_FX13_BEIL;
  // Beben (Fensterbilder 300–560 ms, linear): Verschiebung in Rasterpixeln
  const bk = (t - 300) / 260;
  let bx = 0, by = 0;
  if (bk > 0 && bk < 1) { const [px, py] = ppKf(bk, [[0, [0, 0]], [0.25, [-3, 2]], [0.5, [3, -2]], [0.75, [-2, -1]], [1, [0, 0]]], true); bx = Math.round(px / S); by = Math.round(py / S); }
  const cx = sz.cx + bx, cy = sz.cy + by;
  // Rahmen: Deckung 0 → 1 (18 %) → 1 (78 %) → 0 über 900 ms; rutscht in den ersten 18 % von −10 px auf 0
  const rk = t / 900;
  if (rk >= 0 && rk <= 1) {
    const [ro, rdy] = ppKf(rk, [[0, [0, -10]], [0.18, [1, 0]], [0.78, [1, 0]], [1, [0, 0]]]);
    const dy = Math.round(rdy / S), a = ro;
    if (a > 0.02) {
      for (const px of [-44, 36]) {                                   // zwei Pfosten (8 × 130 px): dunkel – hell – dunkel
        const x0 = Math.round(cx + px / S), y0 = Math.round(cy - 86 / S) + dy, h = Math.round(130 / S);
        g.block(x0, y0, 1, h, C[1], a); g.block(x0 + 1, y0, 1, h, C[2], a); g.block(x0 + 2, y0, 1, h, C[0], a);
        for (let k = 3; k < h; k += 5) g.put(x0 + 1, y0 + k, C[1], a);   // Maserung
      }
      const bx0 = Math.round(cx - 48 / S), by0 = Math.round(cy - 92 / S) + dy, bw = Math.round(96 / S);   // Querbalken (96 × 10 px): hell oben, dunkel unten
      g.block(bx0, by0, bw, 1, C[2], a); g.block(bx0, by0 + 1, bw, 1, C[1], a); g.block(bx0, by0 + 2, bw, 1, C[0], a);
      g.block(bx0, by0 + 3, bw, 1, C[0], a);
    }
  }
  // Glut (480 ms ab, 560 ms): Scheibe 92 px, sichtbar bis 72 %
  const gk = (t - 480) / 560;
  if (gk >= 0 && gk <= 1) {
    const [go, gs] = ppKf(gk, [[0, [0, 0.4]], [0.3, [1, 1]], [1, [0, 1.3]]]), r = 46 * 0.72 * gs / S;
    ppFx13Glow(g, cx, cy + 6 / S, r, r, [C[11], C[8]], go * 0.65, 0.9);
  }
  // Fallbeil: 120–540 ms, 96 px nach unten (beschleunigend); bleibt liegen und dithert ab 850 ms aus
  const fk = (t - 120) / 420, fa = ppR1Aus(t, 850, 1000);
  if (fk >= 0 && fa > 0.02) {
    const fall = ppKf(Math.min(1, fk), [[0, [0]], [1, [96]]], PP_FX13_BEIL_E)[0];
    const x0 = cx - 36 / S, x1 = cx + 36 / S, ytop = cy + (-82 + fall) / S, hl = 46 / S, hr = 46 * 0.62 / S;
    const pts = [[x0, ytop], [x1, ytop], [x1, ytop + hr], [x0, ytop + hl]];
    const farbe = (X, Y) => ppFx13Stufe([[0, C[3]], [0.45, C[4]], [0.7, C[5]], [1, C[6]]], (Y - ytop) / hl, X, Y);
    ppFx13Flaeche(g, pts, farbe, C[7], fa);
  }
  // Schnitt: 480 ms ab, 520 ms; Länge .2 → 1,05 → 1, Deckung 0 → 1 → 0; gedreht um −12° (Linie, kein Bild)
  const sk = (t - 480) / 520;
  if (sk >= 0 && sk <= 1) {
    const [so, ss] = ppKf(sk, [[0, [0, 0.2]], [0.3, [1, 1.05]], [1, [0, 1]]]);
    const halbL = 52 * ss / S, ang = -12 * Math.PI / 180, ux = Math.cos(ang), uy = Math.sin(ang), mx = cx, my = cy + 9 / S;
    const n = Math.ceil(halbL * 2);
    for (let k = 0; k <= n; k++) {
      const f = k / Math.max(1, n), l = (f - 0.5) * 2 * halbL;                 // l = Lage entlang der Achse
      const fw = f < 0.2 ? f / 0.2 : f > 0.8 ? (1 - f) / 0.2 : 1, kern = Math.abs(f - 0.5) < 0.2;
      const x = mx + ux * l, y = my + uy * l;
      g.put(x, y - 1, C[10], so * fw * 0.35);                                  // Schein
      g.put(x, y + 1, C[10], so * fw * 0.35);
      g.put(x, y, kern ? C[9] : C[8], so * fw);
      g.put(x, y + 0.6, kern ? C[9] : C[8], so * fw);
    }
  }
}, 1000, { breite: 200, hoehe: 220, ankerX: 100, ankerY: 130 }, { z: 10100 });

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Heal Sparkle (`heal_sparkle`; Heal, Cure …) — PIXELART. 36 grüne Kugeln (4–14 px; Rand, Mitte, Kern in drei Grüntönen statt Verlauf) wachsen .5 → 1,2 → 0, steigen vom zufälligen Punkt im 80-px-Feld
//  auf einer Bahn nach außen/oben (Weite 10–55 px, −20 px Auftrieb) und dithern aus. Verzug 0–500 ms, Dauer .5–1,1 s; was über 1000 ms hinausragte, läuft hier verkürzt aus. Ebene 9999 wie vorher.
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX13_HEIL = ppFx13Hex(['#00cc50', '#4ceb70', '#75f091']);
const ppFx13HealSparkle = ppR1Leinwand((g, t, sz, te) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, C = PP_FX13_HEIL;
  for (const p of te.teile) {
    const u = ppFx13Lauf(t, p.verzug, p.dauer, 1000);
    if (u === null) continue;
    const [op, f, sc] = ppKf(u, [[0, [0, 0, 0.5]], [0.3, [1, 0.3, 1.2]], [1, [0, 1, 0]]]);
    const d = p.size * sc / S;
    const x = cx + (p.x + p.size / 2 + p.tx * f) / S, y = cy + (p.y + p.size / 2 + p.ty * f) / S;
    if (d < 1.5) g.put(x, y, C[1], op);
    else if (d < 2.5) g.block(x - 1, y - 1, 2, 2, C[1], op);
    else { g.disc(x, y, d / 2 - 0.2, C[0], op); g.disc(x, y, d / 2 * 0.66, C[1], op); if (d >= 3.5) g.disc(x, y, d / 2 * 0.3, C[2], op); }
  }
}, 1000, { breite: 240, hoehe: 240 }, {
  z: 9999,
  vorbereiten: () => ({
    teile: Array.from({ length: ppFxN(36) }, () => {
      const w = Math.random() * Math.PI * 2, dist = ppFx13Zufall(10, 55);
      return { x: ppFx13Zufall(-40, 40), y: ppFx13Zufall(-40, 40), size: ppFx13Zufall(4, 14), verzug: Math.random() * 500, dauer: ppFx13Zufall(500, 1100), tx: Math.cos(w) * dist, ty: Math.sin(w) * dist - 20 };
    }),
  }),
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Healing Hearts (`healing_hearts`; Healing Potion, Life Serum …) — PIXELART. Grüner Blitz (.anim-gold-flash, 500 ms) und 20 Teilchen, die aus ±40 px um die Mitte 100 px aufsteigen (`holySparkleRise`:
//  .3 → 1 → .2 mal, Deckung 0 → 1 → 0): 60 % Herzen (rote bzw. grüne Pixel-Herzen, 12–26 px), 40 % Pluszeichen (✚, rot oder grün, 10–22 px). Verzug 0–500 ms, Dauer .6–1,2 s, auf 1000 ms gekürzt.
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX13_HERZ_ROT = { P: ppHex('#e92f38'), L: ppHex('#fe7476'), d: ppHex('#b5171c') };
const PP_FX13_HERZ_GRUEN = { P: ppHex('#3ddc57'), L: ppHex('#b3f9b8'), d: ppHex('#167927') };
const PP_FX13_AUFSTIEG = [[0, [0, 0, 0.3]], [0.2, [1, -10, 1]], [1, [0, -100, 0.2]]];   // Deckung, Höhe (px), Maß — wie `holySparkleRise`
const ppFx13HealingHearts = ppR1Leinwand((g, t, sz, te) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy;
  ppFx13Blitz(g, t, cx, cy, S, 20, ppFx13Hex(['#00cc50', '#66ff71']), 0.8, 0.7);
  for (const p of te.teile) {
    const u = ppFx13Lauf(t, p.verzug, p.dauer, 1000);
    if (u === null) continue;
    const [op, dy, sc] = ppKf(u, PP_FX13_AUFSTIEG);
    const x = cx + (p.xOff + p.size * 0.55) / S, y = cy + (10 + p.size * 0.58 + dy) / S;
    if (p.herz) ppFx13Herz(g, x, y, p.size * sc * 1.1, p.rot ? PP_FX13_HERZ_ROT : PP_FX13_HERZ_GRUEN, op);
    else ppFx13Kreuz(g, x, y, p.size * sc, p.rot ? PP_FX13_HERZ_ROT.P : PP_FX13_HERZ_GRUEN.P, op);
  }
}, 1000, { breite: 240, hoehe: 280, ankerY: 200 }, {
  z: 10100,
  vorbereiten: () => ({
    teile: Array.from({ length: ppFxN(20) }, () => {
      const herz = Math.random() > 0.4;
      return { herz, rot: Math.random() > 0.5, xOff: ppFx13Zufall(-40, 40), verzug: Math.random() * 500, dauer: ppFx13Zufall(600, 1200), size: herz ? ppFx13Zufall(12, 26) : ppFx13Zufall(10, 22) };
    }),
  }),
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Heart Burst (`heart_burst`; Army of the Cute, Cute Angel Molinda …) — PIXELART. Rosa Blitz (500 ms) und 18 Pixel-Herzen in acht Farbsätzen (statt der Herz-Emojis), 12–28 px, steigen aus ±50 px um die
//  Mitte 100 px auf (`holySparkleRise`), Verzug 0–300 ms, Dauer .5–1 s (auf 1000 ms gekürzt).
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX13_HERZSAETZE = [
  ['#e92f38', '#fe7476', '#b5171c'], ['#f174ab', '#f1e5fa', '#ea2f80'], ['#fc69c6', '#f8b4df', '#ea2f80'], ['#ea2f80', '#fc69c6', '#b62600'],
  ['#fe6794', '#f8b4c8', '#ae264c'], ['#fc1c5f', '#fe6794', '#a60f39'], ['#ec2d62', '#fe6794', '#a60f39'], ['#f8b4df', '#ffffff', '#f174ab'],
].map(([P, L, d]) => ({ P: ppHex(P), L: ppHex(L), d: ppHex(d) }));
const ppFx13HeartBurst = ppR1Leinwand((g, t, sz, te) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy;
  ppFx13Blitz(g, t, cx, cy, S, 20, ppFx13Hex(['#ec2d62', '#fe6794']), 0.6, 0.72);
  for (const p of te.teile) {
    const u = ppFx13Lauf(t, p.verzug, p.dauer, 1000);
    if (u === null) continue;
    const [op, dy, sc] = ppKf(u, PP_FX13_AUFSTIEG);
    ppFx13Herz(g, cx + (p.xOff + p.size * 0.6) / S, cy + (10 + p.size * 0.58 + dy) / S, p.size * sc * 1.1, PP_FX13_HERZSAETZE[p.satz], op);
  }
}, 1000, { breite: 240, hoehe: 280, ankerY: 200 }, {
  z: 10100,
  vorbereiten: () => ({
    teile: Array.from({ length: ppFxN(18) }, () => ({ satz: Math.floor(Math.random() * PP_FX13_HERZSAETZE.length), xOff: ppFx13Zufall(-50, 50), verzug: Math.random() * 300, dauer: ppFx13Zufall(500, 1000), size: ppFx13Zufall(12, 28) })),
  }),
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Hell Charm (`hell_charm`; The Sixth Circle of Hell) — PIXELART. Wie vorher (auf 1000 ms gekürzt, die DOM-Fassung lief 1100–1560 ms und wurde abgeschnitten): ein dunkelroter Schein (120 px, .4 → 1 → 1,5),
//  zwei Ringe (ein roter durchgezogener, ein orangefarbener gestrichelt; .3 → 1,6 mal, der gestrichelte dreht sich um 120°, mit Dither-Hof), zehn senkrechte Schlieren (rot/dunkelrot/violett/orange),
//  die aufsteigen (−64 px) und dabei von unten (voll) nach oben (leer) ausdithern.
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX13_HOELLE = ppFx13Hex(['#c0141c', '#8c0014', '#7e41ba', '#f87420', '#55011a', '#e92f38']);
const ppFx13HellCharm = ppR1Leinwand((g, t, sz, te) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, C = PP_FX13_HOELLE;
  // Schein 120 px (1100 ms → 1000)
  const fk = ppFx13Lauf(t, 0, 1100, 1000);
  if (fk !== null) {
    const [op, sc] = ppKf(fk, [[0, [0, 0.4]], [0.3, [1, 1]], [1, [0, 1.5]]]), r = 60 * 0.72 * sc / S;
    ppFx13Glow(g, cx, cy, r, r, [C[4], C[1], C[0]], op * 0.75, 0.9);
  }
  // Ringe (1000 ms, zweiter ab 200 ms)
  for (let i = 0; i < 2; i++) {
    const u = ppFx13Lauf(t, i * 200, 1000, 1000);
    if (u === null) continue;
    const [op, sc, rot] = ppKf(u, [[0, [0.95, 0.3, 0]], [1, [0, 1.6, 120]]]);
    const R = 42 * sc / S;
    if (R < 1.5 || op <= 0.02) continue;
    ppFx13Hof(g, cx, cy, R, 10 / S, C[0], op * 0.45);
    if (!i) g.ring(cx, cy, Math.max(0, R - 1), R, C[0], op);
    else {                                                              // gestrichelt, dreht sich (Winkelversatz)
      const n = Math.max(8, Math.round(R * 2.2)), versatz = rot * Math.PI / 180;
      for (let k = 0; k < n; k++) {
        if (k % 2) continue;
        const w = (k / n) * Math.PI * 2 + versatz;
        g.put(cx + Math.cos(w) * (R - 0.5), cy + Math.sin(w) * (R - 0.5), C[3], op);
        if (k % 4 === 0) g.put(cx + Math.cos(w) * (R - 0.5) * 0.98, cy + Math.sin(w) * (R - 0.5) * 0.98, C[3], op);
      }
    }
  }
  // Schlieren
  for (const d of te.schlieren) {
    const u = ppFx13Lauf(t, d.delay, d.dur, 1000);
    if (u === null) continue;
    const [op, dy, sy] = ppKf(u, [[0, [0, 0, 0.4]], [0.25, [1, -16, 0.65]], [1, [0, -64, 1.2]]]);
    const h = d.h * sy / S, mitte = cy + (24 + d.h / 2 + dy) / S, x = cx + d.left / S + 0.5;
    const n = Math.max(2, Math.round(h));
    for (let k = 0; k < n; k++) {
      const f = k / (n - 1);                                           // 0 oben (leer) … 1 unten (voll)
      g.put(x, mitte - h / 2 + k, d.farbe, op * f);
      if (f > 0.5) g.put(x + 1, mitte - h / 2 + k, d.farbe, op * (f - 0.5));   // 3 px ≈ 1 Rasterpixel, unten etwas dicker
    }
  }
}, 1000, { breite: 200, hoehe: 200 }, {
  z: 10100,
  vorbereiten: () => ({
    schlieren: Array.from({ length: ppFxN(10) }, (_, i) => ({
      left: Math.round((i - 4.5) * 9 + (Math.random() - 0.5) * 6), delay: Math.round(Math.random() * 420), dur: Math.round(780 + Math.random() * 360), h: 26 + Math.random() * 26,
      farbe: [PP_FX13_HOELLE[0], PP_FX13_HOELLE[1], PP_FX13_HOELLE[2], PP_FX13_HOELLE[3]][i % 4],
    })),
  }),
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Hydra Goo (`hydra_goo`; Cute Hydra) — PIXELART. Violetter Schleim, wie vorher: ein heller Einschlagblitz (0,9 w × 0,7 h der Karte, .4 → 1,05 → 1,35 mal, 360 ms), sieben Schleimflecken, die auf dem Ziel
//  kleben (Ellipsen mit dunklem Rand, mittlerem Körper, hellem Kern und Dither-Hof; wachsen .2 → 1,2 → 1, sinken 8 px und dithern aus), 18 Tropfen, die im 360°-Fächer (mit Fall) wegfliegen
//  (acht Violett-/Rosatöne, Kugel mit Glanz), und zehn Blasen (Weiß/Flieder), die aufploppen und 10 px aufsteigen. Flecken und Tropfen, die über 1000 ms hinausragten, laufen verkürzt aus.
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX13_GOO = ppFx13Hex(['#50008c', '#702db3', '#9544d5', '#ba74ff', '#a040ff', '#d6b3f9', '#fa6bed', '#a952ff', '#47117e', '#903ae6', '#d6bbf1', '#ffffff']);
const PP_FX13_GOO_E = ppFx13Bez(0.2, 0.6, 0.4, 1);
const ppFx13HydraGoo = ppR1Leinwand((g, t, sz, te) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, C = PP_FX13_GOO, cw = te.cw, ch = te.ch;
  // Einschlagblitz (360 ms)
  const bk = t / 360;
  if (bk >= 0 && bk <= 1) {
    const [op, sc] = ppKf(bk, [[0, [0, 0.4]], [0.25, [0.95, 1.05]], [1, [0, 1.35]]]);
    ppFx13Glow(g, cx, cy, cw * 0.45 * sc * 0.8 / S, ch * 0.35 * sc * 0.8 / S, [C[1], C[3], C[10]], op, 0.9);
  }
  // Flecken
  for (const s of te.flecken) {
    const u = ppFx13Lauf(t, s.delay, s.dur, 1000);
    if (u === null) continue;
    const [op, sc, dy] = ppKf(u, [[0, [0, 0.2, 0]], [0.3, [1, 1.2, 0]], [0.6, [0.95, 1, 0]], [1, [0, 1.05, 8]]]);
    const x = cx + (s.x + s.rx) / S, y = cy + (s.y + s.ry + dy) / S, rx = s.rx * sc / S, ry = s.ry * sc / S;
    if (rx < 0.8 || ry < 0.6 || op <= 0.02) continue;
    if (rx > 2) ppFx13Glow(g, x, y, rx + 2.5, ry + 2.5, [C[9]], op * 0.4, 1);                  // Hof (Schein)
    g.ell(x, y, rx, ry, C[8], op);                                                                // Rand
    g.ell(x, y, Math.max(0.6, rx - 1), Math.max(0.6, ry - 1), C[1], op);                         // Körper
    g.ell(x, y, rx * 0.55, ry * 0.5, C[4], op);                                                   // Kern
    if (rx > 3) g.put(x - rx * 0.3, y - ry * 0.3, C[3], op);                                       // Glanzpunkt
  }
  // Tropfen
  for (const d of te.tropfen) {
    const u = ppFx13Lauf(t, d.delay, d.dur, 1000);
    if (u === null) continue;
    const [f, sc] = ppKf(u, [[0, [0, 0.4]], [0.15, [0.18, 1.1]], [0.8, [0.92, 0.95]], [1, [1, 0.55]]], PP_FX13_GOO_E);
    const op = u < 0.15 ? u / 0.15 : u < 0.8 ? 1 : 1 - (u - 0.8) / 0.2;
    ppFx13Kugel(g, cx + (d.size / 2 + d.dx * f) / S, cy + (d.size / 2 + d.dy * f) / S, d.size * sc / S, d.farbe, C[5], op);
  }
  // Blasen
  for (const b of te.blasen) {
    const u = ppFx13Lauf(t, b.delay, b.dur, 1000);
    if (u === null) continue;
    const [op, sc, dy] = ppKf(u, [[0, [0, 0.3, 0]], [0.35, [1, 1, -2]], [1, [0, 0.4, -10]]]);
    const d = b.size * sc / S, x = cx + (b.x + b.size / 2) / S, y = cy + (b.y + b.size / 2 + dy) / S;
    if (d >= 2.5) { g.disc(x, y, d / 2 - 0.2, C[3], op); g.disc(x, y, d / 2 * 0.65, C[5], op); g.put(x - d * 0.12, y - d * 0.12, C[11], op); }
    else ppFx13Kugel(g, x, y, d, C[5], null, op);
  }
}, 1000, (p) => {
  const cw = p.w || 100, ch = p.h || 140;
  const hb = Math.ceil(Math.max(cw * 0.45, cw * 0.32 + 44, 108) + 9), hh = Math.ceil(Math.max(ch * 0.35, ch * 0.28 + 30, 125) + 9);
  return { breite: hb * 2, hoehe: hh * 2 };
}, {
  z: 10100,
  vorbereiten: (sz) => {
    const cw = sz.props.w || 100, ch = sz.props.h || 140;
    return {
      cw, ch,
      tropfen: Array.from({ length: ppFxN(18) }, (_, i) => {
        const w = -Math.PI / 6 + Math.random() * (Math.PI * 7 / 6), v = 35 + Math.random() * 55;
        return { dx: Math.cos(w) * v, dy: Math.sin(w) * v + 18, size: 6 + Math.random() * 8, delay: i * 12 + Math.random() * 60, dur: 380 + Math.random() * 220, farbe: PP_FX13_GOO[Math.floor(Math.random() * 8)] };
      }),
      flecken: Array.from({ length: ppFxN(7) }, () => ({ x: -cw * 0.32 + Math.random() * cw * 0.64, y: -ch * 0.28 + Math.random() * ch * 0.56, rx: 8 + Math.random() * 10, ry: 5 + Math.random() * 6, delay: 80 + Math.random() * 220, dur: 600 + Math.random() * 500 })),
      blasen: Array.from({ length: ppFxN(10) }, () => ({ x: -cw * 0.3 + Math.random() * cw * 0.6, y: -ch * 0.3 + Math.random() * ch * 0.6, size: 4 + Math.random() * 4, delay: 200 + Math.random() * 300, dur: 280 + Math.random() * 220 })),
    };
  },
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Ice Block Crash (`ice_block_crash`; Slippery Spikeblock) — PIXELART. Ein Eisblock (90 px, gezackte Form, Verlauf Weiß → Hellblau → Blau → Tiefblau diagonal als Farbstufen mit Dither, helle
//  Streifen, dunkler Rand) rast aus 560 px Entfernung von links heran (0–266 ms), schlägt links der Mitte ein, wippt (308 ms: 1,12 mal), schrumpft und dithert aus (bis 700 ms). Die Drehung des Blocks
//  entfällt (kein gedrehtes Bild). Ab 380 ms: Frostwelle (Ellipse, wächst auf 2,6 mal) und kühler Blitz (Dither-Scheiben), 18 Eissplitter (Kugeln, 380–440 ms Verzug) fliegen weg.
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX13_EIS = ppFx13Hex(['#ffffff', '#bddcef', '#7bbeea', '#1788bd', '#405f8c', '#e5edfa', '#e5f5fa', '#b3d8f9', '#b4dff8']);
const PP_FX13_EIS_E = ppFx13Bez(0.4, 0.1, 0.6, 0.7);
const PP_FX13_EISBLOCK = [[8, 18], [22, 4], [44, 12], [62, 0], [78, 8], [94, 20], [100, 40], [92, 58], [100, 78], [84, 92], [64, 100], [44, 92], [22, 100], [6, 84], [0, 60], [4, 38]];
const ppFx13IceBlockCrash = ppR1Leinwand((g, t, sz, te) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, C = PP_FX13_EIS;
  // Frostwelle (400 ms ab, 700 ms): Ellipse 220 × 90 px, sichtbar bis 75 %; Maß (.25,.35) → (1,6, 1,15) → (2,6, 1,6)
  const wk = (t - 400) / 700;
  if (wk >= 0 && wk <= 1) {
    const [op, sx, sy] = ppKf(wk, [[0, [1, 0.25, 0.35]], [0.35, [0.9, 1.6, 1.15]], [1, [0, 2.6, 1.6]]]);
    ppFx13Glow(g, cx, cy, 110 * 0.75 * sx / S, 45 * 0.75 * sy / S, [C[3], C[2], C[1], C[5]], op, 0.9);
  }
  // kühler Blitz (380 ms ab, 550 ms): 170 × 70 px, sichtbar bis 70 %
  const kk = (t - 380) / 550;
  if (kk >= 0 && kk <= 1) {
    const [op, sx, sy] = ppKf(kk, [[0, [1, 0.3, 0.4]], [0.35, [0.9, 1.55, 1.1]], [1, [0, 2.3, 1.55]]]);
    ppFx13Glow(g, cx, cy, 85 * 0.7 * sx / S, 35 * 0.7 * sy / S, [C[8], C[6], C[0]], op * 0.9, 0.9);
  }
  // Block (700 ms): Lage/Maß wie die Keyframes (`iceBlockFly`), alle Abschnitte mit cubic-bezier(.4,.1,.6,.7)
  const bk = t / 700;
  if (bk >= 0 && bk <= 1) {
    const [tx, ty, sc] = ppKf(bk, [[0, [-560, -20, 1]], [0.38, [0, 0, 1]], [0.44, [8, 4, 1.12]], [0.6, [4, 2, 0.7]], [1, [0, 0, 0.2]]], PP_FX13_EIS_E);
    const [op] = ppKf(bk, [[0, [0]], [0.1, [1]], [0.44, [1]], [0.6, [0.55]], [1, [0]]], PP_FX13_EIS_E);
    if (op > 0.02) {
      const mx = cx + (-45 + tx) / S, my = cy + (-9 + ty) / S, k = 90 * sc / S;     // Mitte des Blocks, Kantenlänge in Rasterpixeln
      const x0 = mx - k / 2, y0 = my - k / 2;
      const pts = PP_FX13_EISBLOCK.map(([px, py]) => [x0 + px / 100 * k, y0 + py / 100 * k]);
      const farbe = (X, Y) => {
        const f = ((X - x0) / k + (Y - y0) / k) / 2;
        const c = ppFx13Stufe([[0, C[0]], [0.3, C[1]], [0.6, C[2]], [1, C[3]]], f, X, Y);
        return ((X + Y) % 4 === 0 && f > 0.3 && f < 0.85) ? C[7] : c;               // helle Streifen
      };
      ppFx13Flaeche(g, pts, farbe, C[4], op);
    }
  }
  // Splitter
  for (const s of te.splitter) {
    const u = ppFx13Lauf(t, s.delay, s.dur, 1000);
    if (u === null) continue;
    const e = 1 - (1 - u) * (1 - u), op = u < 0.2 ? 1 : 1 - (u - 0.2) / 0.8, sc = 1.2 * (1 - u);
    ppFx13Kugel(g, cx + s.dx * e / S, cy + s.dy * e / S, s.size * sc / S, s.farbe, null, op);
  }
}, 1000, { breite: 900, hoehe: 280, ankerX: 690 }, {
  z: 10100,
  vorbereiten: () => ({
    splitter: Array.from({ length: ppFxN(18) }, () => {
      const w = Math.random() * Math.PI * 2, v = 30 + Math.random() * 70;
      return { dx: Math.cos(w) * v, dy: Math.sin(w) * v - 8, size: 4 + Math.random() * 7, farbe: ppFx13Wahl([PP_FX13_EIS[1], PP_FX13_EIS[7], PP_FX13_EIS[6], PP_FX13_EIS[2], PP_FX13_EIS[1]]), delay: 360 + Math.random() * 80, dur: 380 + Math.random() * 220 };
    }),
  }),
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Ice Encase (`ice_encase`; Frost Rune, Cold-Hearted Yuki-Onna, Dragon Egg …) — PIXELART. Wie vorher (Ende 900 ms, denn Tränke rufen die Animation mit 900 ms): 20 Eiskristalle (❄ ❅ ❆ ✦ · als kleine
//  Pixelbilder: Flocke groß/klein, Stern, Punkt) fliegen aus 60–100 px Entfernung von allen Seiten zur Mitte (Verzug 0–150 ms, Dauer .2–.4 s, beschleunigend, 1,2 → .4 mal), ab 300 ms flammt ein
//  eisblauer Blitz auf (100 × 120 px, .2 → 1,8 → 2,2 mal), ab 350 ms stieben zwölf Eiskugeln nach außen (Verzug 350–450 ms, Dauer .3–.5 s).
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX13_FLOCKE = {
  gross: ['..X..', 'X.X.X', '.XXX.', 'XXXXX', '.XXX.', 'X.X.X', '..X..'],
  klein: ['.X.', 'XXX', '.X.'],
  stern: ['..X..', '..X..', 'XXWXX', '..X..', '..X..'],
};
const PP_FX13_FROST = ppFx13Hex(['#b3d8f9', '#7bbeea', '#bddcef', '#ffffff', '#e5edfa', '#66b6ff', '#7fdfff', '#b3e8f9']);
const ppFx13IceEncase = ppR1Leinwand((g, t, sz, te) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, C = PP_FX13_FROST, farbe = { X: C[0], W: C[3] };
  // Blitz (300 ms ab, 600 ms): 100 × 120 px, sichtbar bis 70 %
  const fk = (t - 300) / 600;
  if (fk >= 0 && fk <= 1) {
    const [op, sc] = ppKf(fk, [[0, [1, 0.2]], [0.5, [0.7, 1.8]], [1, [0, 2.2]]]);
    ppFx13Glow(g, cx, cy + 10 / S, 50 * 0.7 * sc / S, 60 * 0.7 * sc / S, [C[5], C[6], C[7]], op * 0.9, 0.9);
  }
  for (const s of te.kristalle) {
    const u = ppFx13Lauf(t, s.delay, s.dur, 900);
    if (u === null) continue;
    const e = u * u, sc = 1.2 - 0.8 * u, op = u < 0.8 ? 1 : 1 - (u - 0.8) / 0.2;
    const x = cx + s.sx * (1 - e) / S, y = cy + s.sy * (1 - e) / S, px = s.size * sc;
    if (s.art === 'flocke') { if (px >= 6.5) g.spr(PP_FX13_FLOCKE.gross, farbe, x, y, op); else if (px >= 3.5) g.spr(PP_FX13_FLOCKE.klein, farbe, x, y, op); else g.put(x, y, C[3], op); }
    else if (s.art === 'stern') { if (px >= 5) g.spr(PP_FX13_FLOCKE.stern, farbe, x, y, op); else g.put(x, y, C[3], op); }
    else g.put(x, y, C[0], op);
  }
  for (const k of te.splitter) {
    const u = ppFx13Lauf(t, k.delay, k.dur, 900);
    if (u === null) continue;
    const e = 1 - (1 - u) * (1 - u), op = u < 0.2 ? 1 : 1 - (u - 0.2) / 0.8, sc = 1.2 * (1 - u);
    ppFx13Kugel(g, cx + k.dx * e / S, cy + k.dy * e / S, k.size * sc / S, k.farbe, null, op);
  }
}, 900, { breite: 270, hoehe: 270 }, {
  z: 10100,
  vorbereiten: () => ({
    kristalle: Array.from({ length: ppFxN(20) }, () => {
      const w = Math.random() * Math.PI * 2, d = 60 + Math.random() * 40;
      return { sx: Math.cos(w) * d, sy: Math.sin(w) * d, size: 4 + Math.random() * 8, delay: Math.random() * 150, dur: 200 + Math.random() * 200, art: ppFx13Wahl(['flocke', 'flocke', 'flocke', 'stern', 'punkt']) };
    }),
    splitter: Array.from({ length: ppFxN(12) }, () => {
      const w = Math.random() * Math.PI * 2, v = 10 + Math.random() * 25;
      return { dx: Math.cos(w) * v, dy: Math.sin(w) * v, size: 3 + Math.random() * 6, farbe: ppHex(ppFx13Wahl(['#b3d8f9', '#7bbeea', '#bddcef', '#ffffff', '#e5edfa'])), delay: 350 + Math.random() * 100, dur: 300 + Math.random() * 200 };
    }),
  }),
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Juice Bubbles (`juice_bubbles`; Juice) — PIXELART. Oranger Blitz (.anim-gold-flash, 500 ms) und 18 Saftblasen (fünf Orangetöne, 4–12 px), die unten (10 px unter der Mitte) aus ±25 px aufsteigen
//  (80 px hoch, seitlich schwankend, .5 → 1 → .4 mal, Deckung 0 → .9 → .7 → 0) mit Glanzpunkt. Verzug 0–300 ms, Dauer .5–1 s (auf 1000 ms gekürzt).
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX13_SAFT = ppFx13Hex(['#ff8b1a', '#ff9b3a', '#ffd066', '#f87420', '#f7e0b5', '#fff8e8', '#ff491a']);
const ppFx13JuiceBubbles = ppR1Leinwand((g, t, sz, te) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, C = PP_FX13_SAFT;
  ppFx13Blitz(g, t, cx, cy, S, 20, [C[3], C[0], C[2]], 0.8, 0.7);
  for (const b of te.blasen) {
    const u = ppFx13Lauf(t, b.verzug, b.dauer, 1000);
    if (u === null) continue;
    const [op, dy, dx, sc] = ppKf(u, [[0, [0, 0, 0, 0.5]], [0.2, [0.9, -15, b.wobble, 1]], [0.6, [0.7, -45, -b.wobble * 0.5, 1.1]], [1, [0, -80, b.wobble, 0.4]]]);
    const d = b.size * sc / S, x = cx + (b.xOff + b.size / 2 + dx) / S, y = cy + (10 - b.size / 2 + dy) / S;
    if (d >= 2.5) { g.disc(x, y, d / 2 - 0.2, b.farbe, op); if (d >= 3) g.put(x - d * 0.2, y - d * 0.2, C[5], op); }
    else ppFx13Kugel(g, x, y, d, b.farbe, null, op);
  }
}, 1000, { breite: 150, hoehe: 160, ankerY: 115 }, {
  z: 10100,
  vorbereiten: () => ({
    blasen: Array.from({ length: ppFxN(18) }, () => ({ xOff: ppFx13Zufall(-25, 25), size: ppFx13Zufall(4, 12), verzug: Math.random() * 300, dauer: ppFx13Zufall(500, 1000), farbe: ppFx13Wahl(PP_FX13_SAFT.slice(0, 5)), wobble: ppFx13Zufall(-8, 8) })),
  }),
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Knowledge Sparkle (`knowledge_sparkle`; Trial of Knowledge) — PIXELART. Blauer Blitz (500 ms) und 16 Teilchen, die in einem Kreis um die Mitte nach außen treiben (18–40 px, 14 px Auftrieb, .4 → 1 → .75
//  mal): jedes vierte ein blaues Pixel-Herz (12–20 px), die übrigen Pünktchen (3–7 px) in vier Blautönen mit einem Dither-Hof statt des Leuchtens. Verzug 0–260 ms, Dauer .64–1,02 s (auf 1000 ms gekürzt).
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX13_WISSEN = [
  { ton: ppHex('#77c8ee'), P: ppHex('#77c8ee'), L: ppHex('#b3e8f9'), d: ppHex('#399edf') },
  { ton: ppHex('#1ca9fd'), P: ppHex('#1ca9fd'), L: ppHex('#68c6fd'), d: ppHex('#0351c9') },
  { ton: ppHex('#b4dff8'), P: ppHex('#b4dff8'), L: ppHex('#ffffff'), d: ppHex('#77c8ee') },
  { ton: ppHex('#4e82cb'), P: ppHex('#4e82cb'), L: ppHex('#89abdc'), d: ppHex('#2f539d') },
];
const ppFx13KnowledgeSparkle = ppR1Leinwand((g, t, sz, te) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy;
  ppFx13Blitz(g, t, cx, cy, S, 20, ppFx13Hex(['#4e82cb', '#66b6ff']), 0.55, 0.72);
  for (const p of te.teile) {
    const u = ppFx13Lauf(t, p.verzug, p.dauer, 1000);
    if (u === null) continue;
    const [op, f, dyp, sc] = ppKf(u, [[0, [0, 0, 0, 0.4]], [0.15, [1, 0.3, 0, 1]], [1, [0, 1, -14, 0.75]]]);
    const x = cx + (p.size / 2 + p.dx * f) / S, y = cy + (p.size / 2 + p.dy * f + dyp * f) / S, farbe = PP_FX13_WISSEN[p.ton];
    if (p.herz) { ppFx13Herz(g, x, y, p.size * sc * 1.1, farbe, op); continue; }
    const d = p.size * sc / S;
    if (d >= 1.5) ppFx13Hof(g, x, y, d / 2, 1.6, farbe.ton, op * 0.4);
    ppFx13Kugel(g, x, y, d, farbe.ton, null, op);
  }
}, 1000, { breite: 200, hoehe: 200 }, {
  z: 10100,
  vorbereiten: () => ({
    teile: Array.from({ length: ppFxN(16) }, (_, i) => {
      const herz = i % 4 === 0, w = (i / 16) * Math.PI * 2 + (Math.random() * 0.5 - 0.25), r = 18 + Math.random() * 22;
      return { herz, dx: Math.cos(w) * r, dy: Math.sin(w) * r, size: herz ? 12 + Math.random() * 8 : 3 + Math.random() * 4, verzug: Math.random() * 260, dauer: 640 + Math.random() * 380, ton: Math.floor(Math.random() * 4) };
    }),
  }),
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Laser Burst (`laser_burst`; Cosmic Skeleton) — PIXELART. Roter Blitz (80 px, 500 ms) und zwölf Laserstrahlen (30° auseinander, 40–70 px lang, 2–4 px stark, Rot → Hellrot → Ende ausdithernd),
//  die sich von innen nach außen aufbauen (0–20 %), halten und von innen her wieder einziehen (60 → 100 %: die vorderen 60 % verschwinden); dazu acht Funken (3–7 px), die 15 px nach außen sprühen.
//  Verzug der Strahlen 0–150 ms, Dauer .4–.7 s; der Dither-Hof ersetzt das Leuchten.
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX13_LASER = ppFx13Hex(['#ff1a1a', '#f03232', '#c80000', '#ffffff']);
const ppFx13LaserBurst = ppR1Leinwand((g, t, sz, te) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, C = PP_FX13_LASER;
  ppFx13Blitz(g, t, cx, cy, S, 40, [C[2], C[0], C[1]], 0.9, 0.7);
  for (const b of te.strahlen) {
    const u = ppFx13Lauf(t, b.verzug, b.dauer, 1000);
    if (u === null) continue;
    const op = u < 0.2 ? u / 0.2 : u < 0.6 ? 1 - 0.2 * (u - 0.2) / 0.4 : 0.8 * (1 - (u - 0.6) / 0.4);
    const von = u < 0.6 ? 0 : (u - 0.6) / 0.4 * 0.6, bis = u < 0.2 ? u / 0.2 : 1;      // sichtbarer Abschnitt der Länge (clip-path)
    const L = b.laenge / S, dx = Math.cos(b.winkel), dy = Math.sin(b.winkel), dick = Math.max(1, Math.round(b.breite / S));
    const n = Math.ceil(L * 1.3);
    for (let k = 0; k <= n; k++) {
      const f = k / n;
      if (f < von || f > bis) continue;
      const a = op * (f < 0.5 ? 1 : 1 - (f - 0.5) / 0.5), x = cx + dx * L * f, y = cy + dy * L * f;
      if (a <= 0.03) continue;
      g.block(x - Math.floor((dick - 1) / 2), y - Math.floor((dick - 1) / 2), dick, dick, f < 0.5 ? C[0] : C[1], a);
      if (k % 2 === 0) { g.put(x + dy, y - dx, C[0], a * 0.3); g.put(x - dy, y + dx, C[0], a * 0.3); }   // Hof
    }
  }
  for (const s of te.funken) {
    const u = ppFx13Lauf(t, s.delay, s.dur, 1000);
    if (u === null) continue;
    const [op, f, sc] = ppKf(u, [[0, [0, 0, 0.5]], [0.3, [1, 0.3, 1.2]], [1, [0, 1, 0]]]);
    const d = s.size * sc / S, x = cx + (Math.cos(s.winkel) * (s.dist + 15 * f) + s.size / 2) / S, y = cy + (Math.sin(s.winkel) * (s.dist + 15 * f) + s.size / 2) / S;
    if (d >= 1.5) ppFx13Hof(g, x, y, d / 2, 1.3, C[0], op * 0.4);
    ppFx13Kugel(g, x, y, d, C[1], null, op);
  }
}, 1000, { breite: 240, hoehe: 240 }, {
  z: 10100,
  vorbereiten: () => ({
    strahlen: Array.from({ length: ppFxN(12) }, (_, i) => ({ winkel: (i * 30 + Math.random() * 10 - 5) * Math.PI / 180, laenge: 40 + Math.random() * 30, verzug: Math.random() * 150, dauer: 400 + Math.random() * 300, breite: 2 + Math.random() * 2 })),
    funken: Array.from({ length: ppFxN(8) }, () => ({ winkel: Math.random() * Math.PI * 2, dist: 20 + Math.random() * 25, size: 3 + Math.random() * 4, delay: 100 + Math.random() * 200, dur: 300 + Math.random() * 300 })),
  }),
});

// ── Registrierung ───────────────────────────────────────────────────────────────────────────────────────────────────────
ppFxUeberschreiben('guardian_shield', ppFx13GuardianShield);
ppFxUeberschreiben('guillotine_drop', ppFx13Guillotine);
ppFxUeberschreiben('heal_sparkle', ppFx13HealSparkle);
ppFxUeberschreiben('healing_hearts', ppFx13HealingHearts);
ppFxUeberschreiben('heart_burst', ppFx13HeartBurst);
ppFxUeberschreiben('hell_charm', ppFx13HellCharm);
ppFxUeberschreiben('hydra_goo', ppFx13HydraGoo);
ppFxUeberschreiben('ice_block_crash', ppFx13IceBlockCrash);
ppFxUeberschreiben('ice_encase', ppFx13IceEncase);
ppFxUeberschreiben('juice_bubbles', ppFx13JuiceBubbles);
ppFxUeberschreiben('knowledge_sparkle', ppFx13KnowledgeSparkle);
ppFxUeberschreiben('laser_burst', ppFx13LaserBurst);
