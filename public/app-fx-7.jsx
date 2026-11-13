// Pixelart-Portierungen (Canvas), Batch 7: siehe app-fx-0.jsx. Jede Portierung: `ppFxUeberschreiben('typ', Komponente)`.
// Effekte: sand_burst, sand_twister, scythe_cut, silence_seal, snake_devour, spider_avalanche, stun_strike, sun_beam, super_kill_cut, super_saiyan_aura, tempeluna_infuse, tempeluna_steam, thaw.
// Alle laufen auf EINER Leinwand je Effekt (`ppR1Leinwand`, 1 Rasterpixel = 3 Bildschirmpixel, 30 Bilder/s): keine weichen Schatten, Scheine oder Verläufe — Schein = Dither-Stufen (`g.glow`),
// Deckung = Bayer-Raster, Symbole (Schlange, Spinne, Blitz, Stern) = kleine Pixelbilder bzw. hart gefüllte Vielecke. Bewegung rechnet in Bildschirmpixeln und landet auf ganzen Rasterpixeln.

// ── Bausteine (Präfix ppFx7) ────────────────────────────────────────────────────────────────────────────────────────────
const ppFx7R = (a, b) => a + Math.random() * (b - a);
const ppFx7Pick = (l) => l[Math.floor(Math.random() * l.length)];
const ppFx7Lin = (u) => u;
const ppFx7Eo = (u) => 1 - (1 - u) * (1 - u);                      // ease-out
const ppFx7Ei = (u) => u * u;                                       // ease-in
const ppFx7Eio = (u) => (u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u));
/** CSS-`cubic-bezier(x1, y1, x2, y2)` als Funktion u → Wert (Bisektion). */
function ppFx7Bez(x1, y1, x2, y2) {
  const kurve = (a, b, s) => 3 * a * s * (1 - s) * (1 - s) + 3 * b * s * s * (1 - s) + s * s * s;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0, hi = 1;
    for (let i = 0; i < 18; i++) { const m = (lo + hi) / 2; if (kurve(x1, x2, m) < x) lo = m; else hi = m; }
    return kurve(y1, y2, (lo + hi) / 2);
  };
}
/** Keyframes wie in CSS: `stops` = [[u, Wert], …]; `ease` wirkt je Abschnitt (wie `animation-timing-function`). */
function ppFx7Kf(u, stops, ease) {
  const e = ease || ppFx7Lin;
  if (u <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    if (u <= stops[i][0]) {
      const [u0, v0] = stops[i - 1], [u1, v1] = stops[i];
      return v0 + (v1 - v0) * e((u - u0) / (u1 - u0 || 1));
    }
  }
  return stops[stops.length - 1][1];
}
/** Hart gefülltes Vieleck (Rasterkoordinaten, gerade-ungerade-Regel) — z. B. Blitze. */
function ppFx7Poly(g, pts, c, a = 1) {
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const p of pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  const n = pts.length;
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
    let innen = false;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const yi = pts[i][1], yj = pts[j][1];
      if ((yi > y + 0.5) !== (yj > y + 0.5) && x + 0.5 < ((pts[j][0] - pts[i][0]) * (y + 0.5 - yi)) / (yj - yi) + pts[i][0]) innen = !innen;
    }
    if (innen) g.put(x, y, c, a);
  }
}
/** Blitz (⚡) als Einheits-Vieleck um (0, 0), Höhe 1. */
const PP_FX7_BLITZ = [[0.05, -0.5], [-0.25, 0.05], [0, 0.05], [-0.12, 0.5], [0.28, -0.1], [0.03, -0.1], [0.25, -0.5]];
/** Blitz mit Rand, Körper und weißem Kern: (cx, cy) Mitte, `h` Höhe in Rasterpixeln, `spiegel` kehrt links/rechts um. */
function ppFx7Blitz(g, cx, cy, h, spiegel, pal, a) {
  const f = (k, dy) => PP_FX7_BLITZ.map(([x, y]) => [cx + (spiegel ? -x : x) * h * k, cy + y * h * k + (dy || 0)]);
  ppFx7Poly(g, f(1.22), pal[0], a * 0.55);
  ppFx7Poly(g, f(1), pal[1], a);
  ppFx7Poly(g, f(0.5), pal[2], a);
}
/** Wie `g.glow` (Dither-Stufen von außen nach innen, Deckung `a`), nur schneller (Math.sqrt statt Math.hypot, Potenz nur bei p ≠ 1) — die großen Scheine (Radius ~40 Rasterpixel) rechnen je Bild tausende Pixel. */
function ppFx7Glow(g, cx, cy, rx, ry, stufen, a = 1, p = 1) {
  cx = Math.round(cx); cy = Math.round(cy);
  const RX = Math.ceil(rx), RY = Math.ceil(ry), n = stufen.length, irx = 1 / rx, iry = 1 / ry;
  for (let j = -RY; j <= RY; j++) {
    const v = j * iry, v2 = v * v;
    if (v2 >= 1) continue;
    for (let i = -RX; i <= RX; i++) {
      const u = i * irx, d2 = u * u + v2;
      if (d2 >= 1) continue;
      const w = 1 - Math.sqrt(d2), sv = (p === 1 ? w : Math.pow(w, p)) * n, k = Math.floor(sv), neu = (sv - k) > ppBayer(cx + i, cy + j) ? k + 1 : k;
      if (neu <= 0) continue;
      g.put(cx + i, cy + j, stufen[Math.min(n, neu) - 1], a);
    }
  }
}
/** Dithernde Kugel/Wolke aus zwei Stufen — Rand dunkler, Mitte heller; dünne Deckung `a` wird gedithert. */
function ppFx7Wolke(g, cx, cy, r, stufen, a, p) {
  if (r < 0.7 || a <= 0.02) return;
  ppFx7Glow(g, cx, cy, r, r, stufen, a, p || 1);
}
/** Quadrat mit Seitenlänge aus Bildschirmpixeln (mind. 1 Rasterpixel). */
function ppFx7Koernchen(g, x, y, px, S, c, a) {
  const n = Math.max(1, Math.round(px / S));
  g.block(x - n / 2, y - n / 2, n, n, c, a);
}

// ── Pixelbilder ───────────────────────────────────────────────────────────────────────────────────────────────────────
const PP_FX7_SCHLANGE = {
  gross: ['....oooo....', '...oGGGgo...', '...oGeGggor.', '...oGGgggo..', '....oggoo...', '..oooggo....', '.oGGgggo....', 'oGGgggggoo..', 'ogggGGGggo..', '.oggggggo...', '..oooooo....'],
  mittel: ['...ooo..', '..oGego.', '..oGggor', '.ooogoo.', 'oGggo...', 'ogGGgoo.', '.oggggo.', '..oooo..'],
  klein: ['.ooo.', 'oGegr', '.ogg.', 'oggo.', '.oo..'],
};
const PP_FX7_SCHLANGE_FARBE = { o: ppHex('#167927'), g: ppHex('#20ac37'), G: ppHex('#75f091'), e: ppHex('#fad54a'), r: ppHex('#e92f38') };
const PP_FX7_SPINNE = { gross: ['o.o.o', '.obe.', 'ob.bo', '.o.o.'], klein: ['o.o', '.b.', 'o.o'] };
const PP_FX7_SPINNE_FARBE = { o: ppHex('#7a2bd0'), b: ppHex('#a040ff'), e: ppHex('#f1e5fa') };

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Trunk Sand / Pocket Sand (`sand_burst`) — PIXELART. Sanddusche am Einschlag: ① SPRÜH: Körner stieben fächerförmig auseinander und fallen ab (550–800 ms, ab 0–120 ms), ② DUSCHE: Körner
//  rieseln von oben über das Ziel, ③ STAUB: ein dünner, gedithert Dunst (950 ms: wächst .35 → 1 → 1,5, blendet aus). Wie vorher: je Korn ein Rasterpixel in vier Sandtönen.
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX7_SAND = ['#f9ecb3', '#e0c085', '#ca874e', '#9d612f'].map(ppHex);
const ppFx7SandBurst = ppR1Leinwand((g, t, sz, te) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, C = PP_FX7_SAND;
  const sk = t / 950;
  if (sk <= 1) {
    const sc = ppFx7Kf(sk, [[0, 0.35], [0.3, 1], [1, 1.5]]), a = ppFx7Kf(sk, [[0, 0], [0.3, 1], [1, 0]]);
    if (a > 0.04) ppFx7Glow(g, cx, cy, 46 * sc / S, 30 * sc / S, [C[2], C[1]], a * 0.28, 1.3);
  }
  for (const k of te.spruh) {
    const u = (t - k.verzug) / k.dauer;
    if (u < 0 || u > 1) continue;
    let x, y, a;
    if (u < 0.45) { const e = ppFx7Eo(u / 0.45); x = k.sx * e; y = k.sy * e; a = u < 0.08 ? u / 0.08 : 1; }
    else { const e = ppFx7Eo((u - 0.45) / 0.55); x = k.sx * (1 + 0.12 * e); y = k.sy + k.fall * e; a = 1 - e; }
    g.put(cx + x / S, cy + y / S, k.farbe, a);
  }
  for (const k of te.dusche) {
    const u = (t - k.verzug) / k.dauer;
    if (u < 0 || u > 1) continue;
    const a = 0.95 * (u < 0.15 ? u / 0.15 : 1 - (u - 0.15) / 0.85);
    g.block(cx + k.x / S, cy + (k.von + (k.bis - k.von) * u) / S, 1, k.hoch, k.farbe, a);
  }
}, 1000, { breite: 220, hoehe: 280, ankerX: 110, ankerY: 125 }, {
  z: 10100,
  vorbereiten: () => ({
    spruh: Array.from({ length: ppFxN(110) }, () => {
      const w = -Math.PI * (0.05 + Math.random() * 0.9) + (Math.random() < 0.25 ? Math.PI * Math.random() : 0), weite = 18 + Math.pow(Math.random(), 0.7) * 62;
      return { sx: Math.cos(w) * weite, sy: Math.sin(w) * weite * 0.8, fall: 30 + Math.random() * 45, farbe: ppFx7Pick(PP_FX7_SAND), verzug: Math.random() * 120, dauer: 550 + Math.random() * 250 };
    }),
    dusche: Array.from({ length: ppFxN(70) }, () => ({
      x: (Math.random() - 0.5) * 96, von: -(60 + Math.random() * 50), bis: 10 + Math.random() * 40, hoch: Math.random() < 0.5 ? 2 : 1,
      farbe: ppFx7Pick(PP_FX7_SAND), verzug: 40 + Math.random() * 360, dauer: 350 + Math.random() * 170,
    })),
  }),
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Sand Tornado (`sand_twister`) — PIXELART. 24 Sandkörner (3–7 px) wirbeln in zwei Umläufen auf und nach innen (600–800 ms, je 20 ms versetzt), dazu ein Pixel-Trichter (statt 🌪️), der in
//  700 ms (ab 100 ms) aufpoppt (.3 → 1,3 → .5), nach oben steigt und ausblendet. Die Körnerbahn rechnet wie vorher: Drehung, Radius und Anstieg im gedrehten Bezugssystem.
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const ppFx7SandTwister = ppR1Leinwand((g, t, sz, te) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, C = PP_FX7_SAND;
  for (const p of te.koerner) {
    const u = (t - p.delay) / p.dur;
    if (u < 0 || u > 1) continue;
    const dreh = (p.winkel + ppFx7Kf(u, [[0, 0], [0.3, 180], [0.7, 360], [1, 540]], ppFx7Eo)) * Math.PI / 180;
    const tx = ppFx7Kf(u, [[0, 2], [0.3, p.radius], [0.7, p.radius], [1, p.radius * 0.5]], ppFx7Eo);
    const ty = -p.hub * ppFx7Kf(u, [[0, 0], [0.3, 0.3], [0.7, 0.7], [1, 1]], ppFx7Eo);
    const a = ppFx7Kf(u, [[0, 0], [0.3, 0.9], [0.7, 0.7], [1, 0]], ppFx7Eo) * p.deck;
    ppFx7Koernchen(g, cx + (tx * Math.cos(dreh) - ty * Math.sin(dreh)) / S, cy + (tx * Math.sin(dreh) + ty * Math.cos(dreh)) / S, p.size, S, p.farbe, a);
  }
  const u = (t - 100) / 700;
  if (u >= 0 && u <= 1) {
    const sc = ppFx7Kf(u, [[0, 0.3], [0.4, 1.3], [1, 0.5]], ppFx7Eo), a = ppFx7Kf(u, [[0, 0], [0.4, 1], [1, 0]], ppFx7Eo), hoch = Math.max(3, Math.round(18 * sc * 1.15 / S));
    const y0 = cy - ppFx7Eo(u) * 20 / S - hoch / 2;
    for (let j = 0; j < hoch; j++) {
      const f = j / hoch, w = Math.max(1, Math.round(hoch * (0.55 - 0.45 * f))), vers = Math.round(Math.sin(j * 0.9 + t / 90) * (1 + (1 - f)));
      g.block(cx - w / 2 + vers, y0 + j, w, 1, ((j + Math.floor(t / 66)) & 1) ? C[1] : C[2], a);
      if (w > 2) g.put(cx - w / 2 + vers, y0 + j, C[0], a);
    }
  }
}, 900, { breite: 160, hoehe: 160, ankerX: 80, ankerY: 80 }, {
  z: 9999,
  vorbereiten: () => ({
    koerner: Array.from({ length: ppFxN(24) }, (_, i) => ({
      winkel: (i / 24) * 720 + Math.random() * 30, radius: 4 + (i / 24) * 18, size: 3 + Math.random() * 4, delay: i * 20, dur: 600 + Math.random() * 200, hub: 10 + (i / 24) * 30,
      farbe: ppFx7Pick(PP_FX7_SAND.slice(0, 3)), deck: 0.65 + Math.random() * 0.35,
    })),
  }),
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Scythe Cut (`scythe_cut`) — PIXELART. Eine stählerne Klinge (Pixelband, hell in der Mitte, bläulich zum Ende) saust in 420 ms schräg (−42°) quer durchs Ziel, bremst stark ab; ab 180 ms
//  blitzt der Aufprall (Dither-Schein + Kreuzfunkel); ab 220 ms bleibt eine rote Schnittwunde stehen (zieht sich in 124 ms auf, blendet bis 840 ms aus); zehn Blutstropfen fallen davon ab.
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX7_WINKEL42 = (-42 * Math.PI) / 180;
const ppFx7ScytheCut = ppR1Leinwand((g, t, sz, te) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, len = te.len / S, dx = Math.cos(PP_FX7_WINKEL42), dy = Math.sin(PP_FX7_WINKEL42);
  const stahl = te.stahl;
  // Klinge
  const u = t / 420;
  if (u <= 1) {
    const e = te.bez(u), s = (-1.2 + 2.4 * e) * len, a = u < 0.25 ? te.bez(u / 0.25) : 1 - te.bez((u - 0.25) / 0.75);
    const x0 = cx + dx * (s - len / 2), y0 = cy + dy * (s - len / 2), x1 = cx + dx * (s + len / 2), y1 = cy + dy * (s + len / 2);
    const prof = (q) => ppFx7Kf(q, [[0, 0], [0.2, 0.1], [0.48, 0.95], [0.52, 1], [0.7, 0.7], [1, 0]]);
    ppR1Band(g, x0, y0, x1, y1, (q) => ({ w: 3.4, c: stahl[3], a: prof(q) * 0.42 }), a);
    ppR1Band(g, x0, y0, x1, y1, (q) => (q > 0.1 && q < 0.9 ? { w: q > 0.36 && q < 0.64 ? 2 : 1.3, c: q < 0.4 ? stahl[1] : q < 0.6 ? stahl[0] : stahl[2], a: prof(q) } : null), a);
  }
  // Aufprallglanz (ab 180 ms, 360 ms)
  const v = (t - 180) / 360;
  if (v >= 0 && v <= 1) {
    const sc = ppFx7Kf(v, [[0, 0.2], [0.3, 1.4], [1, 2.2]], ppFx7Eo), a = ppFx7Kf(v, [[0, 0], [0.3, 1], [1, 0]], ppFx7Eo);
    ppFx7Glow(g, cx, cy, 14 * sc / S, 14 * sc / S, [stahl[2], stahl[1], stahl[0]], a);
    if (a > 0.3) ppKreuzfunkel(g, cx - 1, cy - 1, Math.round(1 + 3 * a), [stahl[0], stahl[1], stahl[2], stahl[3]], a);
  }
  // Wunde (ab 220 ms, 620 ms)
  const w = (t - 220) / 620;
  if (w >= 0 && w <= 1) {
    const sx = ppFx7Kf(w, [[0, 0], [0.2, 1], [1, 1]], ppFx7Eo), a = ppFx7Kf(w, [[0, 0], [0.2, 1], [0.75, 0.85], [1, 0]], ppFx7Eo), L = te.wunde / S / 2 * sx;
    ppR1Band(g, cx - dx * L, cy - dy * L, cx + dx * L, cy + dy * L, (q) => ({ w: 2.2, c: Math.abs(q - 0.5) < 0.3 ? te.blut[1] : te.blut[0], a: ppFx7Kf(q, [[0, 0], [0.2, 0.7], [0.5, 0.95], [0.8, 0.7], [1, 0]]) }), a);
  }
  // Tropfen
  for (const d of te.tropfen) {
    const k = (t - d.delay) / d.dur;
    if (k < 0 || k > 1) continue;
    const e = ppFx7Ei(k), a = k < 0.2 ? k / 0.2 : 1 - (k - 0.2) / 0.8;
    const n = d.size >= 5 ? 2 : 1;
    g.block(cx + (d.dx - 6 * e) / S, cy + (-2 + d.dy * e) / S, n, 2, te.blut[2], a);
  }
}, 1000, (p) => { const h = Math.round(Math.max(180, Math.hypot(Math.max(p.w || 80, 80), Math.max(p.h || 110, 110)) * 1.6 * 0.8)); return { breite: h * 2, hoehe: h * 2 }; }, {
  z: 10100,
  vorbereiten: (sz) => {
    const ww = Math.max(sz.props.w || 80, 80), hh = Math.max(sz.props.h || 110, 110);
    return {
      len: Math.hypot(ww, hh) * 1.6, wunde: ww * 1.2, bez: ppFx7Bez(0.2, 0.9, 0.3, 1),
      stahl: ['#ffffff', '#e5edfa', '#b3d8f9', '#7bbeea'].map(ppHex), blut: ['#8f0000', '#e92f38', '#b5171c'].map(ppHex),
      tropfen: Array.from({ length: ppFxN(10) }, () => ({ dx: -18 + Math.random() * 36, dy: 10 + Math.random() * 40, delay: 220 + Math.random() * 150, dur: 400 + Math.random() * 200, size: 3 + Math.random() * 4 })),
    };
  },
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Silence (`silence_seal`, Standardbild der Negierung) — PIXELART. Vier gedämpfte Lagen in Violett-Grau: ① ein Siegelring zieht sich in 880 ms von 1,6 auf .55 zusammen (Rand, innen dunkel
//  abgesetzt), ② ein Verbotszeichen (Ring + Querbalken) scheint ab 140 ms auf, ③ eine dunkle, gedithert Schwade überzieht das Ziel (980 ms), ④ sechs Zeichen (kleine Doppelquadrate)
//  fallen nach innen und erlöschen. Kein Schein, kein Verlauf.
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const ppFx7SilenceSeal = ppR1Leinwand((g, t, sz, te) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, R = te.R, C = te.farbe;
  // ③ Schwade
  const sv = t / 980;
  if (sv <= 1) ppFx7Glow(g, cx, cy, te.ww * 0.62 / S, te.hh * 0.62 / S, [C.dunkel], ppFx7Kf(sv, [[0, 0], [0.3, 1], [1, 0]], ppFx7Eo) * 0.62, 0.8);
  // ① Ring
  const u = t / 880;
  if (u <= 1) {
    const e = te.bez(u), r = (R / 2) * (1.6 - 1.05 * e) / S, a = u < 0.25 ? 0.95 * (u / 0.25) : 0.95 * (1 - (u - 0.25) / 0.75);
    g.ring(cx, cy, r, r + 2, C.schein, a * 0.4);
    g.ring(cx, cy, r - 1.6, r, C.ring, a);
    g.ring(cx, cy, r - 4, r - 1.6, C.innen, a * 0.5);
  }
  // ② Verbotszeichen
  const m = (t - 140) / 760;
  if (m >= 0 && m <= 1) {
    const sc = ppFx7Kf(m, [[0, 0.4], [0.35, 1], [1, 1.12]], ppFx7Eo), a = ppFx7Kf(m, [[0, 0], [0.35, 1], [1, 0]], ppFx7Eo), r = R * 0.22 * sc / S, dicke = Math.max(1.5, Math.max(3, R * 0.045) / S);
    g.ring(cx, cy, r - dicke, r, C.zeichen, a * 0.95);
    const q = r * 1.06 * Math.SQRT1_2;
    g.line(cx + q, cy - q, cx - q, cy + q, C.zeichen, a * 0.95, Math.round(dicke));
  }
  // ④ Zeichen fallen nach innen
  for (const z of te.zeichen) {
    const k = (t - z.delay) / 700;
    if (k < 0 || k > 1) continue;
    const e = ppFx7Ei(k), sc = 1.2 - 0.9 * e, a = k < 0.2 ? k / 0.2 : 1 - (k - 0.2) / 0.8, n = Math.max(1, Math.round(z.gr * sc / S));
    const x = cx + z.dx * (1 - e) / S - n / 2, y = cy + z.dy * (1 - e) / S - n / 2;
    g.block(x, y, n, n, C.zeichen, a);
    if (n >= 2) g.block(x + 1, y + 1, n - 1, n - 1, C.glyph, a);
  }
}, 1100, (p) => { const R = Math.max(Math.max(p.w || 80, 60), Math.max(p.h || 110, 80)) * 1.25, h = Math.round(R * 0.9 + 12); return { breite: h * 2, hoehe: h * 2 }; }, {
  z: 10155,
  vorbereiten: (sz) => {
    const ww = Math.max(sz.props.w || 80, 60), hh = Math.max(sz.props.h || 110, 80), R = Math.max(ww, hh) * 1.25;
    return {
      ww, hh, R, bez: ppFx7Bez(0.3, 0.7, 0.35, 1),
      farbe: { ring: ppHex('#b38ed7'), schein: ppHex('#8066b2'), innen: ppHex('#2b457e'), zeichen: ppHex('#d9c0ec'), glyph: ppHex('#8066b2'), dunkel: ppHex('#291f3d') },
      zeichen: Array.from({ length: ppFxN(6) }, (_, i) => { const w = (i / 6) * Math.PI * 2 + Math.random() * 0.4; return { dx: Math.cos(w) * R * 0.75, dy: Math.sin(w) * R * 0.75, gr: 5 + Math.random() * 5, delay: 60 + i * 55 }; }),
    };
  },
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Snake Devour (`snake_devour`) — PIXELART. Ein Schlangenkopf (Pixelbild statt 🐍) schlägt in 700 ms von oben zu (.5 → 1,3 → 1,1 → .3), darunter ein dunkler Strudel (Dither-Scheibe mit
//  zwei Spiralarmen; wächst, schrumpft, 800 ms); sechs kleine Schlangen kreisen aus 20–35 px Abstand ein und verschwinden in der Mitte (600–800 ms, je 60 ms versetzt).
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const ppFx7SnakeDevour = ppR1Leinwand((g, t, sz, te) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, C = te.farbe;
  // Strudel
  const w = t / 800;
  if (w <= 1) {
    const sc = ppFx7Kf(w, [[0, 0.3], [0.3, 1.2], [0.7, 1], [1, 0.1]], ppFx7Ei), a = ppFx7Kf(w, [[0, 0], [0.3, 0.9], [0.7, 0.7], [1, 0]], ppFx7Ei), R = 35 * sc / S;
    ppFx7Glow(g, cx, cy, R, R, [C.v1, C.v2, C.v3], a, 0.8);
    const dreh = ppFx7Kf(w, [[0, 0], [0.3, 90], [0.7, 200], [1, 360]], ppFx7Ei) * Math.PI / 180;
    for (let arm = 0; arm < 2; arm++) for (let r = 1; r < R; r += 0.7) {
      const th = dreh + arm * Math.PI + r * 0.28;
      g.put(cx + Math.cos(th) * r, cy + Math.sin(th) * r * 0.9, r > R * 0.6 ? C.arm : C.v1, a * 0.85);
    }
  }
  // einkreisende Schlangen
  for (const c of te.coils) {
    const u = (t - c.delay) / c.dur;
    if (u < 0 || u > 1) continue;
    const f = ppFx7Kf(u, [[0, 0], [0.3, 0.3], [0.7, 0.8], [1, 1]], ppFx7Ei), sc = ppFx7Kf(u, [[0, 1], [0.3, 0.8], [0.7, 0.5], [1, 0.1]], ppFx7Ei);
    const a = ppFx7Kf(u, [[0, 0], [0.3, 0.8], [0.7, 0.6], [1, 0]], ppFx7Ei), px = c.size * sc / S, x = cx + c.x * (1 - f) / S, y = cy + c.y * (1 - f) / S;
    if (px >= 5.5) g.spr(PP_FX7_SCHLANGE.mittel, PP_FX7_SCHLANGE_FARBE, x, y, a, c.spiegel);
    else if (px >= 3.5) g.spr(PP_FX7_SCHLANGE.klein, PP_FX7_SCHLANGE_FARBE, x, y, a, c.spiegel);
    else if (px >= 1) g.block(x - 0.5, y - 0.5, 1, 1, PP_FX7_SCHLANGE_FARBE.g, a);
  }
  // Kopf
  const k = t / 700;
  if (k <= 1) {
    const sc = ppFx7Kf(k, [[0, 0.5], [0.3, 1.3], [0.6, 1.1], [1, 0.3]], ppFx7Eio), a = ppFx7Kf(k, [[0, 0], [0.3, 1], [0.6, 1], [1, 0]], ppFx7Eio);
    const ty = ppFx7Kf(k, [[0, -20], [0.3, 5], [0.6, 0], [1, 10]], ppFx7Eio), px = 36 * sc / S;
    const x = cx + 2 / S, y = cy + (-32 + ty) / S;
    if (px >= 9) g.spr(PP_FX7_SCHLANGE.gross, PP_FX7_SCHLANGE_FARBE, x, y, a);
    else if (px >= 5.5) g.spr(PP_FX7_SCHLANGE.mittel, PP_FX7_SCHLANGE_FARBE, x, y, a);
    else g.spr(PP_FX7_SCHLANGE.klein, PP_FX7_SCHLANGE_FARBE, x, y, a);
  }
}, 900, { breite: 200, hoehe: 200, ankerX: 100, ankerY: 100 }, {
  z: 10100,
  vorbereiten: () => ({
    farbe: { v1: ppHex('#47117e'), v2: ppHex('#2e0a51'), v3: ppHex('#1a0a3a'), arm: ppHex('#7a2bd0') },
    coils: Array.from({ length: ppFxN(6) }, (_, i) => {
      const w = (i * 60 + Math.random() * 20) * Math.PI / 180, d = 20 + Math.random() * 15;
      return { x: Math.cos(w) * d, y: Math.sin(w) * d, delay: i * 60, dur: 600 + Math.random() * 200, size: 20 + Math.random() * 10, spiegel: Math.cos(w) < 0 };
    }),
  }),
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Spider Avalanche (`spider_avalanche`) — PIXELART. Ein Wolkenbruch winziger Spinnen: bis zu 80 (Pixel-Spinnen in zwei Größen, ein Drittel nur Punkte) fallen aus ~140 px Höhe auf das Ziel
//  (ab 0–600 ms, je 300–700 ms), blenden ein (15 %), triften seitwärts und blenden unten aus; zu Beginn ein violetter Dither-Schein (300 ms).
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const ppFx7SpiderAvalanche = ppR1Leinwand((g, t, sz, te) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy - 60 / S;           // Ursprung der Spinnen: 60 px über dem Ziel (wie vorher)
  const f = t / 300;
  if (f <= 1) {
    const sc = ppFx7Kf(f, [[0, 0.3], [0.5, 1.2], [1, 1.5]], ppFx7Eo), a = ppFx7Kf(f, [[0, 0], [0.5, 1], [1, 0]], ppFx7Eo);
    ppFx7Glow(g, cx, cy + 20 / S, 40 * sc / S, 40 * sc / S, [ppHex('#2e0a51'), ppHex('#47117e')], a * 0.7);
  }
  for (const s of te.spinnen) {
    const u = (t - s.delay) / s.dur;
    if (u < 0 || u > 1) continue;
    let x, y, sc, a;
    if (u < 0.15) { const e = ppFx7Ei(u / 0.15); x = s.startX; y = -80 + 40 * e; sc = 0.5 + 0.5 * e; a = e; }
    else { const e = ppFx7Ei((u - 0.15) / 0.85); x = s.startX + s.drift * e; y = -40 + 120 * e; sc = 1 - 0.3 * e; a = 1 - e; }
    const px = s.size * sc, X = cx + x / S, Y = cy + y / S;
    if (!s.spinne || px < 5) g.block(X, Y, 1, 1, PP_FX7_SPINNE_FARBE.e, a);
    else g.spr(px >= 9 ? PP_FX7_SPINNE.gross : PP_FX7_SPINNE.klein, PP_FX7_SPINNE_FARBE, X, Y, a);
  }
}, 1100, { breite: 220, hoehe: 240, ankerX: 110, ankerY: 150 }, {
  z: 10100,
  vorbereiten: () => ({
    spinnen: Array.from({ length: ppFxN(80) }, () => ({ startX: -60 + Math.random() * 120, delay: Math.random() * 600, dur: 300 + Math.random() * 400, size: 6 + Math.random() * 8, drift: -15 + Math.random() * 30, spinne: Math.random() < 0.67 })),
  }),
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Guardian Beast Ji (`stun_strike`) — PIXELART. Cyan-weißer Schlag: ① ein großer Dither-Schein (ab 100 ms, 700 ms: .25 → 1,6 → 2,4), ② zwei Riesenblitze (hart gefüllte Blitz-Vielecke mit hellem
//  Kern; 550/600 ms) krachen von oben aufs Ziel, ③ 22 kleine Zickzackblitze laufen von außen zur Mitte (200–400 ms), ④ ab 280 ms stieben 22 Funken nach außen.
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const ppFx7StunStrike = ppR1Leinwand((g, t, sz, te) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, C = te.farbe;
  // ① Schein
  const f = (t - 100) / 700;
  if (f >= 0 && f <= 1) {
    const sc = ppFx7Kf(f, [[0, 0.25], [0.35, 1.6], [0.7, 2], [1, 2.4]], ppFx7Eo), a = ppFx7Kf(f, [[0, 1], [0.35, 0.9], [0.7, 0.55], [1, 0]], ppFx7Eo);
    const r = 66 * sc / S;
    ppFx7Glow(g, cx, cy, r, r, [C.blau, C.hell, C.weiss], a * 0.85, 1.1);
  }
  // ② Riesenblitze (Mitte 15 / 53 px rechts, 55 px über dem Ziel; Höhe 72 px · Skala)
  [[15, 0, 550, 1.4, 1.2, 1.0, false], [53, 100, 600, 1.5, 1.3, 1.1, true]].forEach(([mx, delay, dur, s1, s2, s3, spiegel]) => {
    const u = (t - delay) / dur;
    if (u < 0 || u > 1) return;
    const ease = te.bez;
    const sc = ppFx7Kf(u, [[0, 0.6], [0.25, s1], [0.55, s2], [1, s3]], ease), ty = ppFx7Kf(u, [[0, -60], [0.25, -10], [0.55, 0], [1, 0]], ease);
    const a = ppFx7Kf(u, [[0, 0], [0.25, 1], [0.55, 1], [1, 0]], ease);
    ppFx7Blitz(g, cx + mx / S, cy + (-55 + ty) / S, 72 * sc / S, spiegel, [C.cyan, C.blitz, C.weiss], a);
  });
  // ③ Zickzackblitze nach innen
  for (const b of te.bolzen) {
    const u = (t - b.delay) / b.dur;
    if (u < 0 || u > 1) continue;
    const e = ppFx7Ei(u), sc = 1.5 - 1.1 * e, a = u < 0.7 ? 1 : 1 - (u - 0.7) / 0.3, l = b.size * sc / S;
    const x = cx + b.sx * (1 - e) / S, y = cy + b.sy * (1 - e) / S, dx = -Math.cos(b.w), dy = -Math.sin(b.w), nx = -dy, ny = dx;
    const P = [[0, 0], [0.38, 0.32], [0.62, -0.32], [1, 0]].map(([s, q]) => [x + dx * l * (s - 0.5) + nx * l * q * 0.5, y + dy * l * (s - 0.5) + ny * l * q * 0.5]);
    for (let i = 1; i < P.length; i++) { g.line(P[i - 1][0], P[i - 1][1], P[i][0], P[i][1], C.blitz, a, 1); g.put(P[i][0], P[i][1], C.weiss, a); }
  }
  // ④ Funken
  for (const s of te.funken) {
    const u = (t - s.delay) / s.dur;
    if (u < 0 || u > 1) continue;
    const e = ppFx7Eo(u), sc = 1.2 * (1 - e);
    ppFx7Koernchen(g, cx + s.dx * e / S, cy + s.dy * e / S, s.size * sc, S, s.farbe, u < 0.2 ? 1 : 1 - (u - 0.2) / 0.8);
  }
}, 1000, { breite: 360, hoehe: 360 }, {
  z: 10100,
  vorbereiten: () => ({
    bez: ppFx7Bez(0.4, 0, 0.7, 1),
    farbe: { blau: ppHex('#4e77ca'), hell: ppHex('#66b6ff'), weiss: ppHex('#ffffff'), cyan: ppHex('#7fdfff'), blitz: ppHex('#b3e8f9') },
    bolzen: Array.from({ length: ppFxN(22) }, () => { const w = Math.random() * Math.PI * 2, d = 70 + Math.random() * 60; return { sx: Math.cos(w) * d, sy: Math.sin(w) * d, w, size: 14 + Math.random() * 14, delay: Math.random() * 250, dur: 200 + Math.random() * 200 }; }),
    funken: Array.from({ length: ppFxN(22) }, () => {
      const w = Math.random() * Math.PI * 2, v = 18 + Math.random() * 38;
      return { dx: Math.cos(w) * v, dy: Math.sin(w) * v, size: 3 + Math.random() * 6, farbe: ppHex(ppFx7Pick(['#7fdfff', '#b3e8f9', '#ffffff', '#b3e8f9', '#b2eeee'])), delay: 280 + Math.random() * 200, dur: 300 + Math.random() * 300 };
    }),
  }),
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Sun Beam (`sun_beam`) — PIXELART. Ein riesiger weißer Orbitalstrahl fällt vom Bildrand aufs Ziel: drei Säulen (außen 160 px blass-gelb, Mitte 60 px cremeweiß, Kern 20 px weiß), jede senkt sich
//  mit eigenem Anlauf (320/260/220 ms) von oben herab, die Deckung steigt zum Ziel hin (Dither statt Verlauf), ab ~540–580 ms blenden sie aus (fertig mit der Standard-Sekunde); am Einschlag
//  blitzt ein Dither-Schein (260 ms, 700 ms), danach steigen 18 helle Funken nach oben.
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const ppFx7SunBeam = ppR1Leinwand((g, t, sz, te) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, C = te.farbe, BH = te.bh;
  const saeulen = [
    { hw: 80, rand: 16, delay: 0, dur: 320, f0: 540, f1: 980, stops: [[0, 0], [0.2, 0.15], [0.7, 0.35], [1, 0.5]], c: C.gelb },
    { hw: 30, rand: 6, delay: 40, dur: 260, f0: 560, f1: 990, stops: [[0, 0], [0.3, 0.6], [1, 0.85]], c: C.creme },
    { hw: 18, rand: 5, delay: 80, dur: 220, f0: 580, f1: 1000, stops: [[0, 0], [1, 0.25]], c: C.creme },
    { hw: 10, rand: 0, delay: 80, dur: 220, f0: 580, f1: 1000, stops: [[0, 0], [0.4, 0.95], [1, 1]], c: C.weiss },
  ];
  for (const s of saeulen) {
    const u = ppR1Klemme((t - s.delay) / s.dur);
    if (u <= 0) continue;
    const sy = ppFx7Eo(u), env = ppFx7Kf(u, [[0, 0], [0.2, 0.9], [1, 1]], ppFx7Eo), aus = 1 - ppFx7Ei(ppR1Klemme((t - s.f0) / (s.f1 - s.f0)));
    if (aus <= 0.02) continue;
    const boden = -BH + sy * BH, i0 = Math.floor(cx - s.hw / S), i1 = Math.ceil(cx + s.hw / S);
    for (let j = 0; j < sz.gh; j++) {
      const yRel = (j + 0.5 - cy) * S;
      if (yRel > boden || yRel > 0) continue;
      const f = (yRel + BH) / (sy * BH), aF = ppFx7Kf(f, s.stops) * env * aus;
      if (aF <= 0.02) continue;
      for (let i = i0; i <= i1; i++) {
        const dxs = Math.abs(i + 0.5 - cx) * S;
        if (dxs > s.hw) continue;
        const kante = s.rand > 0 ? Math.min(1, (s.hw - dxs) / s.rand) : 1;
        g.put(i, j, s.c, aF * kante);
      }
    }
  }
  // Einschlag (ab 260 ms, 700 ms)
  const e = (t - 260) / 700;
  if (e >= 0 && e <= 1) {
    const sc = ppFx7Kf(e, [[0, 0.2], [0.25, 1.1], [1, 2.2]], ppFx7Eo), a = ppFx7Kf(e, [[0, 0], [0.25, 1], [1, 0]], ppFx7Eo), r = 70 * sc / S;
    ppFx7Glow(g, cx, cy, r, r, [C.gold, C.creme2, C.weiss], a, 1);
  }
  for (const f of te.funken) {
    const u = (t - f.delay) / f.dur;
    if (u < 0 || u > 1) continue;
    const k = ppFx7Eo(u);
    ppFx7Koernchen(g, cx + f.dx * k / S, cy + f.dy * k / S, f.size * (0.6 - 0.3 * u), S * 0.75, f.farbe, u < 0.2 ? u / 0.2 : 1 - (u - 0.2) / 0.8);
  }
}, 1100, (p) => { const hoch = Math.round(Math.min(1100, Math.max(300, (p.y || 0) + 60))); return { breite: 280, hoehe: hoch + 140, ankerX: 140, ankerY: hoch }; }, {
  z: 10100,
  vorbereiten: () => ({
    bh: Math.max(window.innerHeight, 1200),
    farbe: { gelb: ppHex('#f9ecb3'), creme: ppHex('#fffbd2'), weiss: ppHex('#ffffff'), gold: ppHex('#fbe181'), creme2: ppHex('#f9ecb3') },
    funken: Array.from({ length: ppFxN(18) }, () => {
      const w = -Math.PI / 2 + (Math.random() - 0.5) * 1.8, d = 30 + Math.random() * 60;
      return { dx: Math.cos(w) * d, dy: Math.sin(w) * d * 0.7, size: 3 + Math.random() * 5, delay: 350 + Math.random() * 300, dur: 450 + Math.random() * 300, farbe: ppHex(ppFx7Pick(['#ffffff', '#fff8e8', '#f7f7ad', '#fbe181'])) };
    }),
  }),
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Kohta, Master of Super-Killing (`super_kill_cut`) — PIXELART. Ein hässlicher, ausgefranster Schnitt: ein breites Band (3,4 × Zielbreite, Rand zufällig gezackt; vorn weiß, hinten rot, am Ende
//  dunkelrot) fegt in 260 ms (stark gebremst) quer durchs Ziel; ab 180 ms klafft die Wunde als schwarzer Dither-Spalt auseinander (je 16 px nach oben/unten, 520 ms); dazu 18 eckige Splitter
//  (hell oder rot) fliegen nach oben/unten weg.
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const ppFx7SuperKillCut = ppR1Leinwand((g, t, sz, te) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, C = te.farbe, B = te.breite / S;
  // Schnitt
  const u = t / 260;
  if (u <= 1) {
    const tx = ppFx7Kf(u, [[0, -1.2], [0.7, 0.1], [1, 0.24]], te.bez) * B, sy = ppFx7Kf(u, [[0, 0.5], [0.7, 1], [1, 1.1]], te.bez), a = ppFx7Kf(u, [[0, 0], [0.18, 1], [0.7, 1], [1, 0]], te.bez);
    const n = te.zacken.length - 1, x0 = cx + tx - B / 2;
    for (let i = 0; i < B; i++) {
      const q = i / B, pos = q * n, k = Math.min(n - 1, Math.floor(pos)), fr = pos - k;
      const oben = (te.zacken[k][0] + (te.zacken[k + 1][0] - te.zacken[k][0]) * fr), unten = (te.zacken[k][1] + (te.zacken[k + 1][1] - te.zacken[k][1]) * fr);
      let y0 = (Math.min(oben, unten) * 52 - 26) * sy / S, y1 = (Math.max(oben, unten) * 52 - 26) * sy / S;
      if (y1 - y0 < 1.2) { const m = (y0 + y1) / 2; y0 = m - 0.6; y1 = m + 0.6; }
      const ap = ppFx7Kf(q, [[0, 0], [0.08, 0.25], [0.38, 0.95], [0.5, 1], [0.62, 0.9], [0.86, 0.55], [1, 0]]);
      const c = q < 0.07 ? C.schmutz : q < 0.56 ? C.weiss : q < 0.8 ? C.rot : C.dunkelrot;
      for (let y = Math.floor(cy + y0); y <= Math.ceil(cy + y1); y++) g.put(x0 + i, y, c, a * ap);
    }
  }
  // Wunde klafft (ab 180 ms, 520 ms)
  const w = (t - 180) / 520;
  if (w >= 0 && w <= 1) {
    const a = ppFx7Kf(w, [[0, 0], [0.25, 1], [1, 0]], ppFx7Eo), ver = 16 * ppFx7Eo(w), halb = (te.ww * 1.8) / S / 2;
    for (let j = 0; j < 10; j++) {
      const v = (j + 0.5) / 10, aj = v < 0.55 ? 0 : 0.85 * (v - 0.55) / 0.45;
      if (aj <= 0) continue;
      g.block(cx - halb, cy + (-30 + 30 * (j / 10) - ver) / S, halb * 2, 1, C.schwarz, a * aj);
      g.block(cx - halb, cy + (30 - 30 * (j / 10) + ver) / S - 1, halb * 2, 1, C.schwarz, a * aj);
    }
  }
  // Splitter
  for (const sp of te.splitter) {
    const k = (t - sp.delay) / sp.dur;
    if (k < 0 || k > 1) continue;
    const e = ppFx7Eo(k), a = k < 0.2 ? k / 0.2 : 1 - (k - 0.2) / 0.8, x = cx + (-te.breite / 2 + (sp.links / 100) * te.breite + sp.drift * e) / S, y = cy + (-3 + (sp.hoch ? -sp.weite : sp.weite) * e) / S;
    g.block(x, y, Math.max(1, Math.round(sp.size / S)), Math.max(1, Math.round(sp.size * 0.6 / S)), sp.hoch ? C.hell : C.blut, a);
  }
}, 900, (p) => { const b = Math.max(p.w || 80, 80) * 3.4, hb = Math.round(b * 0.5 * 1.25 + 10); return { breite: hb * 2, hoehe: 480 }; }, {
  z: 10120,
  vorbereiten: (sz) => {
    const ww = Math.max(sz.props.w || 80, 80), breite = ww * 3.4;
    return {
      ww, breite, bez: ppFx7Bez(0.05, 0.9, 0.2, 1),
      farbe: { weiss: ppHex('#ffffff'), schmutz: ppHex('#e2d8cb'), rot: ppHex('#e92f38'), dunkelrot: ppHex('#780014'), schwarz: ppHex('#08060c'), hell: ppHex('#e2d8cb'), blut: ppHex('#b5171c') },
      zacken: Array.from({ length: 23 }, () => [0.38 + Math.random() * 0.22, 0.62 - Math.random() * 0.22]),
      splitter: Array.from({ length: ppFxN(18) }, () => ({ links: Math.random() * 100, hoch: Math.random() < 0.5, weite: 60 + Math.random() * 150, drift: -30 + Math.random() * 60, size: 3 + Math.random() * 9, dur: 320 + Math.random() * 320, delay: 60 + Math.random() * 140 })),
    };
  },
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Divine Zeal (`super_saiyan_aura`) — PIXELART. Goldene Heilaura: ein großer gelber Dither-Schein (wächst .4 → 1,1 → 1,5 → 2), drei sich weitende Goldringe (je 150 ms versetzt), 18 aufsteigende
//  „Ki"-Streifen (Spindeln, unten orange, oben cremeweiß) und 22 Goldfunken, die nach außen stieben. Die Zeit ist auf 62 % gestaucht: vorher lief die Aura 1,6 s, wurde aber nach der
//  Standard-Sekunde abgeschnitten — jetzt endet sie von selbst, bevor sie abgeräumt wird.
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const ppFx7SuperSaiyanAura = ppR1Leinwand((g, t0, sz, te) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, C = te.farbe, t = t0 / 0.62;       // `t` = Zeit der Originalfassung (ms)
  // Schein (1,3 s)
  const f = t / 1300;
  if (f <= 1) {
    const sc = ppFx7Kf(f, [[0, 0.4], [0.18, 1.1], [0.55, 1.5], [1, 2]], ppFx7Eo), a = ppFx7Kf(f, [[0, 0], [0.18, 1], [0.55, 0.85], [1, 0]], ppFx7Eo), r = 70 * sc / S;
    ppFx7Glow(g, cx, cy, r, r, [C.orange, C.gold, C.blass], a * 0.8, 1);
  }
  // Ringe
  [0, 150, 300].forEach((d) => {
    const u = (t - d) / 1100;
    if (u < 0 || u > 1) return;
    const sc = ppFx7Kf(u, [[0, 0.3], [0.18, 0.65], [0.7, 1.7], [1, 2.4]], ppFx7Eo), a = ppFx7Kf(u, [[0, 0], [0.18, 1], [0.7, 0.55], [1, 0]], ppFx7Eo), r = 45 * sc / S;
    g.ring(cx, cy, r, r + 2, C.orange, a * 0.4);
    g.ring(cx, cy, r - 1.5, r, C.gold, a);
    g.ring(cx, cy, r - 3, r - 1.5, C.blass, a * 0.4);
  });
  // Ki-Streifen
  for (const s of te.streifen) {
    const u = (t - s.delay) / s.dur;
    if (u < 0 || u > 1) continue;
    const sy = ppFx7Kf(u, [[0, 0.2], [0.25, 1], [1, 0.4]], ppFx7Eo), ty = ppFx7Kf(u, [[0, 0], [0.25, -20], [1, -110]], ppFx7Eo), a = ppFx7Kf(u, [[0, 0], [0.25, 1], [1, 0]], ppFx7Eo);
    const unten = 30 + s.hoehe + ty, hr = Math.max(2, Math.round(s.hoehe * sy / S)), top = cy + (unten - s.hoehe * sy) / S, br = Math.max(1, Math.round(s.breite / S)), mx = cx + (s.x + s.breite / 2) / S;
    for (let j = 0; j < hr; j++) {
      const fb = 1 - j / hr, prof = Math.sqrt(Math.max(0, 1 - Math.pow(2 * (1 - fb) - 1, 2))), w = Math.max(1, Math.round(br * (0.5 + 0.6 * prof)));
      const c = fb > 0.8 ? C.creme : fb > 0.4 ? C.gold : C.orange, am = fb < 0.4 ? fb / 0.4 : 1;
      g.block(mx - w / 2, top + j, w, 1, c, a * am);
    }
  }
  // Funken
  for (const p of te.funken) {
    const u = (t - p.delay) / p.dur;
    if (u < 0 || u > 1) continue;
    const e = ppFx7Eo(u), sc = ppFx7Kf(u, [[0, 0.4], [0.25, 1.2], [1, 0.2]], ppFx7Eo), a = ppFx7Kf(u, [[0, 0], [0.25, 1], [1, 0]], ppFx7Eo);
    const n = Math.round(p.size * sc / S), x = cx + p.tx * e / S, y = cy + p.ty * e / S;
    if (n >= 3) { g.disc(x, y, n / 2, C.gold, a); g.put(x - 1, y - 1, C.creme, a); }
    else if (n >= 2) { g.block(x - 1, y - 1, 2, 2, C.gold, a); g.put(x - 1, y - 1, C.creme, a); }
    else if (n >= 1) g.put(x, y, C.gold, a);
  }
}, 1100, { breite: 360, hoehe: 400, ankerX: 180, ankerY: 200 }, {
  z: 10110,
  vorbereiten: () => ({
    farbe: { orange: ppHex('#f9ac20'), gold: ppHex('#fad54a'), blass: ppHex('#f8f8bd'), creme: ppHex('#fffbd2') },
    streifen: Array.from({ length: ppFxN(18) }, () => ({ x: -55 + Math.random() * 110, delay: Math.random() * 350, dur: 700 + Math.random() * 550, hoehe: 60 + Math.random() * 80, breite: 4 + Math.random() * 6 })),
    funken: Array.from({ length: ppFxN(22) }, () => { const w = Math.random() * Math.PI * 2, d = 30 + Math.random() * 60; return { tx: Math.cos(w) * d, ty: Math.sin(w) * d - 18, size: 5 + Math.random() * 9, delay: Math.random() * 400, dur: 550 + Math.random() * 500 }; }),
  }),
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Tempeluna — Fee angelegt (`tempeluna_infuse`) und Dampf (`tempeluna_steam`) — PIXELART. Dampfschwaden = weiß/hellgraue Dither-Wolken, die aufsteigen und dabei wachsen (.35 → 2), ausblenden;
//  Funken = kleine helle (infuse) bzw. warme (steam) Pixel; infuse zusätzlich neun aufblitzende Sterne (Kreuzfunkel). Alles über die Laufzeit (`duration`, infuse 1100, steam 2400 ms) verteilt;
//  am Ende der Laufzeit blendet alles in 300 ms aus (statt abgeschnitten zu werden).
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX7_DAMPF = [['#d2d2db', '#ffffff'], ['#b9b9b9', '#d2d2db']].map(l => l.map(ppHex));
function ppFx7Dampf(g, t, S, cx, cy, schwaden, aus) {
  for (const p of schwaden) {
    const u = (t - p.delay) / p.dur;
    if (u < 0 || u > 1) continue;
    const e = ppFx7Eo(u), sc = 0.35 + (p.ende - 0.35) * e, r = p.size * sc / 2 / S;
    const a = (u < 0.22 ? p.deck * (u / 0.22) : p.deck * (1 - (u - 0.22) / 0.78)) * aus;
    ppFx7Wolke(g, cx + (p.startX + p.size / 2 + p.dx * e) / S, cy + (p.startY + p.size / 2 + p.dy * e) / S, r, p.hell ? PP_FX7_DAMPF[0] : PP_FX7_DAMPF[1], a, 0.9);
  }
}
function ppFx7DampfPlan(n, laufzeit, vorlauf, o) {
  return Array.from({ length: ppFxN(n) }, (_, i) => ({
    startX: o.sx[0] + Math.random() * (o.sx[1] - o.sx[0]), startY: o.sy[0] + Math.random() * (o.sy[1] - o.sy[0]), dx: -o.dx + Math.random() * 2 * o.dx, dy: -(o.dy[0] + Math.random() * (o.dy[1] - o.dy[0])),
    size: o.size[0] + Math.random() * (o.size[1] - o.size[0]), delay: (i / n) * (laufzeit - vorlauf) + Math.random() * o.streu, dur: o.dur[0] + Math.random() * (o.dur[1] - o.dur[0]),
    deck: o.deck[0] + Math.random() * (o.deck[1] - o.deck[0]), hell: Math.random() < 0.5, ende: o.ende,
  }));
}
const ppFx7TempelunaInfuse = ppR1Leinwand((g, t, sz, te) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, aus = ppR1Aus(t, te.lauf - 300, te.lauf);
  if (aus <= 0) return;
  ppFx7Dampf(g, t, S, cx, cy, te.schwaden, aus);
  for (const f of te.funken) {
    const u = (t - f.delay) / f.dur;
    if (u < 0 || u > 1) continue;
    const e = ppFx7Eo(u), a = ppFx7Kf(u, [[0, 0], [0.25, 1], [1, 0]], ppFx7Eo) * aus, sc = ppFx7Kf(u, [[0, 0.4], [0.25, 1], [1, 0.25]], ppFx7Eo), n = Math.max(1, Math.round(f.size * sc / S));
    const x = cx + f.dx * e / S, y = cy + (10 + f.dy * e) / S;
    g.block(x - n / 2, y - n / 2, n, n, f.farbe, a);
    if (n >= 2) g.put(x - n / 2, y - n / 2, te.weiss, a);
  }
  for (const s of te.sterne) {
    const u = (t - s.delay) / s.dur;
    if (u < 0 || u > 1) continue;
    const sc = ppFx7Kf(u, [[0, 0.2], [0.35, 1.35], [1, 0.5]], ppFx7Eo), a = ppFx7Kf(u, [[0, 0], [0.35, 1], [1, 0]], ppFx7Eo) * aus, arm = Math.max(1, Math.round(s.size * sc / S / 2.4));
    ppKreuzfunkel(g, cx + (s.x + s.size / 2) / S - 1, cy + (s.y + s.size / 2) / S - 1, arm, te.stern, a);
  }
}, 1300, { breite: 240, hoehe: 300, ankerX: 120, ankerY: 200 }, {
  z: 10100,
  vorbereiten: (sz) => {
    const lauf = Math.max(600, Number(sz.props.duration) || 1100);
    return {
      lauf, weiss: ppHex('#ffffff'), stern: ['#ffffff', '#fffbd2', '#f9ecb3', '#fbe181'].map(ppHex),
      schwaden: ppFx7DampfPlan(14, lauf, 520, { sx: [-28, 28], sy: [24, 40], dx: 18, dy: [56, 120], size: [20, 46], dur: [780, 1160], deck: [0.3, 0.6], streu: 110, ende: 2.0 }),
      funken: Array.from({ length: ppFxN(22) }, (_, i) => ({ dx: -40 + Math.random() * 80, dy: -(8 + Math.random() * 70), size: 4 + Math.random() * 5, delay: (i / 22) * (lauf - 420) + Math.random() * 130, dur: 460 + Math.random() * 280, farbe: ppHex(['#fffbd2', '#b4dff8', '#f1e5fa'][i % 3]) })),
      sterne: Array.from({ length: ppFxN(9) }, (_, i) => ({ x: -36 + Math.random() * 72, y: -40 + Math.random() * 84, size: 16 + Math.random() * 14, delay: (i / 9) * (lauf - 480) + Math.random() * 150, dur: 660 + Math.random() * 260 })),
    };
  },
});
const ppFx7TempelunaSteam = ppR1Leinwand((g, t, sz, te) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, aus = ppR1Aus(t, te.lauf - 300, te.lauf);
  if (aus <= 0) return;
  ppFx7Dampf(g, t, S, cx, cy, te.schwaden, aus);
  for (const f of te.funken) {
    const u = (t - f.delay) / f.dur;
    if (u < 0 || u > 1) continue;
    const e = ppFx7Eo(u), a = ppFx7Kf(u, [[0, 0], [0.3, 1], [1, 0]], ppFx7Eo) * aus, sc = ppFx7Kf(u, [[0, 0.5], [0.3, 1], [1, 0.2]], ppFx7Eo), n = Math.max(1, Math.round(f.size * sc / S));
    g.block(cx + f.dx * e / S - n / 2, cy + (26 + f.dy * e) / S - n / 2, n, n, te.funke, a);
  }
}, 2600, { breite: 260, hoehe: 320, ankerX: 130, ankerY: 220 }, {
  z: 10100,
  vorbereiten: (sz) => {
    const lauf = Math.max(900, Number(sz.props.duration) || 2200);
    return {
      lauf, funke: ppHex('#fbc86a'),
      schwaden: ppFx7DampfPlan(26, lauf, 700, { sx: [-34, 34], sy: [30, 52], dx: 22, dy: [70, 160], size: [22, 56], dur: [1100, 1700], deck: [0.3, 0.64], streu: 160, ende: 2.1 }),
      funken: Array.from({ length: ppFxN(9) }, (_, i) => ({ dx: -20 + Math.random() * 40, dy: -(20 + Math.random() * 45), size: 2 + Math.random() * 3, delay: (i / 9) * (lauf - 500) + Math.random() * 120, dur: 520 + Math.random() * 260 })),
    };
  },
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Thaw (`thaw`) — PIXELART. Ein hellblauer Dither-Schein (700 ms: .5 → 1,3 → 1,8, blendet aus) und zwölf Tropfen (1–3 Pixel breit, runder Boden, Glanzpixel) fallen 30–80 px, dehnen sich beim Fallen
//  und blenden aus (500–900 ms, ab 0–300 ms).
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const ppFx7Thaw = ppR1Leinwand((g, t, sz, te) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, C = te.farbe;
  const f = t / 700;
  if (f <= 1) {
    const sc = ppFx7Kf(f, [[0, 0.5], [0.4, 1.3], [1, 1.8]], ppFx7Eo), a = ppFx7Kf(f, [[0, 1], [0.4, 0.6], [1, 0]], ppFx7Eo), r = 40 * sc / S;
    ppFx7Glow(g, cx, cy, r, r, [C.blau, C.hell, C.weiss], a * 0.65, 1.2);
  }
  for (const d of te.tropfen) {
    const u = (t - d.delay) / d.dur;
    if (u < 0 || u > 1) continue;
    const ty = ppFx7Kf(u, [[0, 0], [0.3, 5], [1, d.speed]], ppFx7Ei), sy = ppFx7Kf(u, [[0, 0.5], [0.3, 1], [1, 1.5]], ppFx7Ei), a = ppFx7Kf(u, [[0, 0.8], [0.3, 1], [1, 0]], ppFx7Ei);
    const w = Math.max(1, Math.round(d.size / S)), h = Math.max(2, Math.round(d.size * 1.5 * sy / S)), x = Math.round(cx + d.xOff / S), y = Math.round(cy + (-5 + ty) / S);
    g.block(x, y, w, h - 1, d.farbe, a);
    if (w >= 2) { g.block(x + 1, y + h - 1, w - 2 || 1, 1, d.farbe, a); g.put(x, y, C.weiss, a); } else g.put(x, y + h - 1, d.farbe, a);
  }
}, 1300, { breite: 200, hoehe: 240, ankerX: 100, ankerY: 80 }, {
  z: 10100,
  vorbereiten: () => ({
    farbe: { blau: ppHex('#7bbeea'), hell: ppHex('#b3d8f9'), weiss: ppHex('#e5f5fa') },
    tropfen: Array.from({ length: ppFxN(12) }, () => ({ xOff: -20 + Math.random() * 40, speed: 30 + Math.random() * 50, size: 3 + Math.random() * 5, delay: Math.random() * 300, dur: 500 + Math.random() * 400, farbe: ppHex(ppFx7Pick(['#b3d8f9', '#7bbeea', '#bddcef', '#e5f5fa'])) })),
  }),
});

ppFxUeberschreiben('sand_burst', ppFx7SandBurst);
ppFxUeberschreiben('sand_twister', ppFx7SandTwister);
ppFxUeberschreiben('scythe_cut', ppFx7ScytheCut);
ppFxUeberschreiben('silence_seal', ppFx7SilenceSeal);
ppFxUeberschreiben('snake_devour', ppFx7SnakeDevour);
ppFxUeberschreiben('spider_avalanche', ppFx7SpiderAvalanche);
ppFxUeberschreiben('stun_strike', ppFx7StunStrike);
ppFxUeberschreiben('sun_beam', ppFx7SunBeam);
ppFxUeberschreiben('super_kill_cut', ppFx7SuperKillCut);
ppFxUeberschreiben('super_saiyan_aura', ppFx7SuperSaiyanAura);
ppFxUeberschreiben('tempeluna_infuse', ppFx7TempelunaInfuse);
ppFxUeberschreiben('tempeluna_steam', ppFx7TempelunaSteam);
ppFxUeberschreiben('thaw', ppFx7Thaw);
