// Pixelart-Portierungen (Canvas), Batch 9 (zweite Welle, Schwelle 50 ms): siehe app-fx-0.jsx. Jede Portierung: `ppFxUeberschreiben('typ', Komponente)`.
//
// Effekte: acid_splash, angel_revival, aquatic_arrow_rain, arrow_impact, arrow_rain, baby_spider_opfer, battery_charge, biomancy_bloom, biomancy_vines, black_flame_strike, boiling_oil,
// bomblebee_blast.
// Alle laufen auf EINER Leinwand je Effekt (`ppR1Leinwand`, app-board.jsx; 1 Rasterpixel = 3 Bildschirmpixel, 30 Bilder/s): keine weichen Schatten, Scheine oder Verlaeufe — Schein =
// Dither-Stufen (`ppFx9Schein`), Deckung = Bayer-Raster, Symbole (Blumen, Blaetter, Engel, Flamme, Reagenzglas, Spinne) = kleine Pixelbilder bzw. aus Pixeln berechnete
// Formen (nie ein gedrehtes Bild). Zeiten, Anker und Streuung folgen den DOM-Fassungen (ANIM_REGISTRY, Keyframes in style.css). Wo die Teilchen laenger liefen, als die Zonen-Animation
// lebt (`duration` des Aufrufers, sonst 1000 ms), werden Verzoegerung und Dauer des einzelnen Teilchens gekuerzt (`ppFx9Fit`), damit der Effekt vor dem Abraeumen ausklingt statt abgeschnitten zu werden.

// ── Bausteine (Praefix ppFx9) ─────────────────────────────────────────────────────────────────────────────────────────────
const ppFx9H = (l) => l.map(ppHex);
const ppFx9R = (a, b) => a + Math.random() * (b - a);
const ppFx9Pick = (l) => l[Math.floor(Math.random() * l.length)];
/** CSS-`cubic-bezier(x1, y1, x2, y2)` als Funktion u → Wert (Nachschlagetabelle, im Bild nur eine Interpolation). */
function ppFx9Bez(x1, y1, x2, y2) {
  const N = 64, tab = new Float32Array(N + 1);
  const kurve = (a, b, s) => 3 * a * s * (1 - s) * (1 - s) + 3 * b * s * s * (1 - s) + s * s * s;
  for (let i = 0; i <= N; i++) {
    const x = i / N;
    let lo = 0, hi = 1;
    for (let k = 0; k < 20; k++) { const m = (lo + hi) / 2; if (kurve(x1, x2, m) < x) lo = m; else hi = m; }
    tab[i] = kurve(y1, y2, (lo + hi) / 2);
  }
  return (u) => { if (u <= 0) return 0; if (u >= 1) return 1; const f = u * N, i = f | 0; return tab[i] + (tab[i + 1] - tab[i]) * (f - i); };
}
const PP_FX9_AUS = ppFx9Bez(0, 0, 0.58, 1);       // CSS `ease-out`
const PP_FX9_EIN = ppFx9Bez(0.42, 0, 1, 1);       // CSS `ease-in`
const PP_FX9_EAUS = ppFx9Bez(0.42, 0, 0.58, 1);   // CSS `ease-in-out`
const ppFx9Lin = (u) => u;
/** Keyframes wie in CSS: `stops` = [[u, Wert], …]; `ease` wirkt je Abschnitt (wie `animation-timing-function`). */
function ppFx9Kf(u, stops, ease) {
  const e = ease || ppFx9Lin;
  if (u <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    if (u <= stops[i][0]) {
      const [u0, v0] = stops[i - 1], [u1, v1] = stops[i];
      return v0 + (v1 - v0) * e((u - u0) / (u1 - u0 || 1));
    }
  }
  return stops[stops.length - 1][1];
}
/** Verzoegerung und Dauer so kuerzen, dass beides vor `ende` (ms) fertig ist (gleichmaessig, Verhaeltnis bleibt). */
const ppFx9Fit = (delay, dur, ende) => { const e = delay + dur; if (e <= ende) return [delay, dur]; const f = ende / e; return [delay * f, dur * f]; };
/** Letzter nutzbarer Zeitpunkt: die Zonen-Animation lebt `duration` ms (ohne Angabe raeumt `playAnimation` nach 800 ms ab). */
const ppFx9Ende = (sz) => (sz.props.duration || 800) - 60;
/** Punkt/Scheibe aus n Rasterpixeln Durchmesser (Mitte x/y). */
function ppFx9Punkt(g, x, y, n, c, a) {
  if (n < 0.7) return;
  if (n < 1.6) g.put(x, y, c, a);
  else if (n < 2.6) g.block(x - 1, y - 1, 2, 2, c, a);
  else g.disc(x, y, n / 2, c, a);
}
/** Pixelbild, ganzzahlig vergroessert (jeder Bildpunkt = m×m Rasterpixel); `am` = optionale Deckungsfaktoren je Zeichen. */
function ppFx9Bild(g, zeilen, pal, cx, cy, a, m = 1, am) {
  const h = zeilen.length, w = zeilen[0].length, x0 = Math.round(cx - (w * m) / 2), y0 = Math.round(cy - (h * m) / 2);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const ch = zeilen[j][i], c = pal[ch];
    if (!c) continue;
    const aa = am && am[ch] != null ? a * am[ch] : a;
    if (m === 1) g.put(x0 + i, y0 + j, c, aa); else g.block(x0 + i * m, y0 + j * m, m, m, c, aa);
  }
}
/** Schein als Dither-Stufen (Ellipse, Stufen von aussen nach innen): `al` = Deckungsfaktor je Stufe (wie die Stopps des alten Radialverlaufs), `a` = Gesamtdeckung; nie Alpha, nur Bayer-Raster. */
function ppFx9Schein(g, cx, cy, rx, ry, stufen, a, al) {
  if (a <= 0.03 || rx < 0.8 || ry < 0.8) return;
  cx = Math.round(cx); cy = Math.round(cy);
  const RX = Math.ceil(rx), RY = Math.ceil(ry), n = stufen.length, irx = 1 / rx, iry = 1 / ry;
  for (let j = -RY; j <= RY; j++) {
    const v = j * iry, v2 = v * v;
    if (v2 >= 1) continue;
    for (let i = -RX; i <= RX; i++) {
      const u = i * irx, d2 = u * u + v2;
      if (d2 >= 1) continue;
      const sv = (1 - Math.sqrt(d2)) * n, k = Math.floor(sv), neu = (sv - k) > ppBayer(cx + i, cy + j) ? k + 1 : k;
      if (neu <= 0) continue;
      const q = Math.min(n, neu) - 1;
      const aq = al ? a * al[q] : a;
      if (aq >= 0.1) g.put(cx + i, cy + j, stufen[q], aq);   // darunter bliebe nur ein weitmaschiges Punktgitter
    }
  }
}
/** Deckung fuer Teilchen: die alten Teilchen blieben bis in die Ausblendung hinein dicht — erst im letzten Drittel der Deckung wird gedithert. */
const ppFx9Fest = (a) => Math.min(1, a * 1.5);

/** Quadratische Kurve (Eckpunkte in Rasterpixeln) → Punktliste, `n` Teilstuecke. */
function ppFx9Bogen(x0, y0, cx, cy, x1, y1, n) {
  const pts = [];
  for (let i = 0; i <= n; i++) { const u = i / n, v = 1 - u; pts.push([v * v * x0 + 2 * v * u * cx + u * u * x1, v * v * y0 + 2 * v * u * cy + u * u * y1]); }
  return pts;
}
/** Dichte Pixelkette entlang der Eckpunkte, nur die ersten `anteil` (0..1) davon zeichnen. */
function ppFx9Zug(g, pts, anteil, c, a) {
  if (anteil <= 0 || a <= 0) return;
  const kette = ppR1Kette(pts), n = Math.ceil(kette.length * Math.min(1, anteil));
  for (let i = 0; i < n; i++) g.put(kette[i][0], kette[i][1], c, a);
}
/** Silhouette (alle Zeichen ausser '.') mit 1 Pixel dunklem Rand: Rand 'v', Koerper 'b', helle linke Kante 'h'. */
function ppFx9Umriss(zeilen) {
  const h = zeilen.length, w = zeilen[0].length, out = [];
  const f = (x, y) => y >= 0 && y < h && x >= 0 && x < w && zeilen[y][x] !== '.';
  for (let j = -1; j <= h; j++) {
    let s = '';
    for (let i = -1; i <= w; i++) s += f(i, j) ? (!f(i - 1, j) || !f(i, j - 1) ? 'h' : 'b') : (f(i - 1, j) || f(i + 1, j) || f(i, j - 1) || f(i, j + 1)) ? 'v' : '.';
    out.push(s);
  }
  return out;
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Bomblebee Blast (`bomblebee_blast`) — PIXELART. Ein heller Blitz (480 ms: waechst .25 → 1,7 → 2,2 mal 45 px, gelb → orange → braun gedithert) und 26 Splitter in Wespenfarben, die in 380–700 ms
//  (ab 0–60 ms) nach aussen fliegen und schrumpfen.
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX9_BB_FARBE = ppFx9H(['#fad54a', '#f9ac20', '#ff8b1a', '#222222', '#000000', '#f7f7ad']);
const PP_FX9_BB_SCHEIN = ppFx9H(['#7d3911', '#ffb91a', '#fff196']);
const ppFx9Bomblebee = ppR1Leinwand((g, t, sz, te) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy;
  const fk = t / 480;
  if (fk < 1) {
    const sc = ppFx9Kf(fk, [[0, 0.25], [0.4, 1.7], [1, 2.2]], PP_FX9_AUS), a = ppFx9Kf(fk, [[0, 1], [0.4, 0.9], [1, 0]], PP_FX9_AUS);
    ppFx9Schein(g, cx, cy, (45 * sc) / S, (45 * sc) / S, PP_FX9_BB_SCHEIN, a, [0.4, 0.6, 0.95]);
  }
  for (const p of te.splitter) {
    const u = (t - p.delay) / p.dur;
    if (u < 0 || u > 1) continue;
    const e = PP_FX9_AUS(u), a = u < 0.22 ? 1 : 1 - PP_FX9_AUS((u - 0.22) / 0.78);
    ppFx9Punkt(g, cx + (p.dx * e) / S, cy + (p.dy * e) / S, (p.size * 1.3 * (1 - e)) / S, p.farbe, a);
  }
}, 1100, { breite: 222, hoehe: 222 }, {
  z: 10100,
  vorbereiten: () => ({
    splitter: Array.from({ length: ppFxN(26) }, () => {
      const w = Math.random() * Math.PI * 2, v = 30 + Math.random() * 60;
      return { dx: Math.cos(w) * v, dy: Math.sin(w) * v, size: 3 + Math.random() * 7, farbe: ppFx9Pick(PP_FX9_BB_FARBE), delay: Math.random() * 60, dur: 380 + Math.random() * 320 };
    }),
  }),
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Black Flame Strike (`black_flame_strike`; Black-Thorn Dragon, Skeleton Demon) — PIXELART. Schwarze Flammen (Flamme, Dreieck, Stern als Silhouetten mit violettem Rand) fliegen von allen
//  Seiten zur Mitte (240–440 ms, ab 0–220 ms, beschleunigend, schrumpfend), ab 220 ms ein dunkelvioletter Schein (650 ms: .3 → 1,5 → 2,3), ab 320–480 ms dunkle Splitter nach aussen.
//  `intensity` (1…5) staffelt Zahl, Groesse und Reichweite wie vorher.
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX9_BF_SCHEIN = ppFx9H(['#2e0a51', '#19062d', '#2b0b47']);
const PP_FX9_BF_SPLITTER = ppFx9H(['#19062d', '#2b0b47', '#2e0a51', '#47117e', '#1a0a3a']);
const PP_FX9_BF_PAL = { v: ppHex('#170b28'), b: ppHex('#58238c'), h: ppHex('#7e41ba'), k: ppHex('#08060c') };
const PP_FX9_BF_BILD = {
  gross: ppFx9Umriss(['...o...', '..oo...', '..ooo..', '.oooo.o', '.ooooo.', 'ooooooo', 'ooooooo', '.ooooo.']),
  klein: ppFx9Umriss(['..o..', '..oo.', '.ooo.', 'ooooo', 'ooooo', '.ooo.']),
  dreieck: ppFx9Umriss(['..o..', '.ooo.', 'ooooo']),
  stern: ppFx9Umriss(['..o..', '..o..', 'ooooo', '..o..', '..o..']),
};
const ppFx9BlackFlame = ppR1Leinwand((g, t, sz, te) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, sm = te.sm;
  const fk = (t - 220) / 650;
  if (fk >= 0 && fk <= 1) {
    const sc = ppFx9Kf(fk, [[0, 0.3], [0.5, 1.5], [1, 2.3]], PP_FX9_AUS), a = ppFx9Kf(fk, [[0, 1], [0.5, 0.85], [1, 0]], PP_FX9_AUS), r = (40 * sm * sc) / S;
    ppFx9Schein(g, cx, cy, r, r, PP_FX9_BF_SCHEIN, a, [0.25, 0.55, 0.9]);
  }
  for (const f of te.flammen) {
    const u = (t - f.delay) / f.dur;
    if (u < 0 || u > 1) continue;
    const e = PP_FX9_EIN(u), sc = 1.3 - 1.05 * e, a = u < 0.7 ? 1 : 1 - PP_FX9_EIN((u - 0.7) / 0.3);
    const x = cx + (f.sx * (1 - e) + f.size * 0.35) / S, y = cy + (f.sy * (1 - e) + f.size * 0.4) / S, n = (f.size * sc) / S;
    if (n < 2.4) { ppFx9Punkt(g, x, y, Math.max(1, n * 0.8), PP_FX9_BF_PAL.b, a); continue; }
    let bild, m = 1;
    if (f.zeichen === 'flamme') { bild = n >= 5.5 ? PP_FX9_BF_BILD.gross : PP_FX9_BF_BILD.klein; m = n >= 16 ? 2 : 1; }
    else if (f.zeichen === 'dreieck') { bild = PP_FX9_BF_BILD.dreieck; m = n >= 10 ? 2 : 1; }
    else { bild = PP_FX9_BF_BILD.stern; m = n >= 11 ? 2 : 1; }
    ppFx9Bild(g, bild, PP_FX9_BF_PAL, x, y, a, m);
  }
  for (const s of te.splitter) {
    const u = (t - s.delay) / s.dur;
    if (u < 0 || u > 1) continue;
    const e = PP_FX9_AUS(u), a = u < 0.2 ? 1 : 1 - PP_FX9_AUS((u - 0.2) / 0.8), n = (s.size * 1.2 * (1 - e)) / S, x = cx + (s.dx * e) / S, y = cy + (s.dy * e) / S;
    if (n >= 2.6) g.disc(x, y, n / 2 + 0.8, PP_FX9_BF_PAL.h, a * 0.4);
    ppFx9Punkt(g, x, y, n, s.farbe, a);
  }
}, 1100, (p) => {
  const k = Math.min(Math.max(p.intensity || 1, 1), 5), sm = 0.85 + k * 0.22, R = Math.ceil(Math.max(92 * sm, 30 + 50 + k * 16 + 30 * sm, 45 * sm + 20)) + 14;
  return { breite: R * 2, hoehe: R * 2 };
}, {
  z: 10100,
  vorbereiten: (sz) => {
    const ende = ppFx9Ende(sz), k = Math.min(Math.max(sz.props.intensity || 1, 1), 5);
    const flammenZahl = 14 + Math.round(k * 7), funkenZahl = 10 + Math.round(k * 4), sm = 0.85 + k * 0.22, reach = 50 + k * 16;
    return {
      sm,
      flammen: Array.from({ length: flammenZahl }, () => {
        const w = Math.random() * Math.PI * 2, d = 30 + Math.random() * reach, [delay, dur] = ppFx9Fit(Math.random() * 220, 240 + Math.random() * 200, ende);
        return { sx: Math.cos(w) * d, sy: Math.sin(w) * d, size: (10 + Math.random() * 14) * sm, delay, dur, zeichen: ppFx9Pick(['flamme', 'flamme', 'flamme', 'dreieck', 'stern']) };
      }),
      splitter: Array.from({ length: funkenZahl }, () => {
        const w = Math.random() * Math.PI * 2, v = (15 + Math.random() * 30) * sm, [delay, dur] = ppFx9Fit(320 + Math.random() * 160, 320 + Math.random() * 260, ende);
        return { dx: Math.cos(w) * v, dy: Math.sin(w) * v, size: 2 + Math.random() * 5 * sm, farbe: ppFx9Pick(PP_FX9_BF_SPLITTER), delay, dur };
      }),
    };
  },
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Acid Splash (`acid_splash`; Acid Vial, Boiling Oil-Karte) — PIXELART. Ein roter Schein (500 ms: .3 → 1,3 → 1,6 mal 60 px) und 22 Saeureblasen, die vom unteren Rand der Zone aufsteigen
//  (wackeln seitlich, wachsen .5 → 1,1, schrumpfen und verblassen; 500–1100 ms ab 0–120 ms), dazu 6 dunkle Spritzer mit Reagenzglas (die gleiche Bahn, 600–1000 ms ab 50–250 ms).
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX9_SAEURE = ppFx9H(['#c80000', '#ef2929', '#ef2929', '#c80000', '#be0e0e', '#e92f38', '#ff1a1a', '#c80000']);
const PP_FX9_SAEURE_SCHEIN = ppFx9H(['#780000', '#be0e0e', '#c80000']);
const PP_FX9_KOLBEN = ['..ccc..', '..owo..', '..owo..', '.owwwo.', '.oRRRo.', 'oRRrRRo', 'oRRRRRo', '.oRRRo.', '..ooo..'];
const PP_FX9_KOLBEN_PAL = { c: ppHex('#9d612f'), o: ppHex('#59606e'), w: ppHex('#e5edfa'), R: ppHex('#e92f38'), r: ppHex('#ff6666') };
/** Bahn einer aufsteigenden Blase (`animBeerBubble`, ease-out je Abschnitt): u 0..1 → Versatz (px), Massstab, Deckung. */
function ppFx9Blase(u, wob) {
  return {
    x: ppFx9Kf(u, [[0, 0], [0.2, wob], [0.6, -wob / 2], [1, wob]], PP_FX9_AUS),
    y: ppFx9Kf(u, [[0, 0], [0.2, -15], [0.6, -45], [1, -80]], PP_FX9_AUS),
    sc: ppFx9Kf(u, [[0, 0.5], [0.2, 1], [0.6, 1.1], [1, 0.4]], PP_FX9_AUS),
    a: ppFx9Kf(u, [[0, 0], [0.2, 0.9], [0.6, 0.7], [1, 0]], PP_FX9_AUS),
  };
}
const ppFx9Saeure = ppR1Leinwand((g, t, sz, te) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy;
  const fk = t / 500;
  if (fk < 1) {
    const sc = ppFx9Kf(fk, [[0, 0.3], [0.5, 1.3], [1, 1.6]], PP_FX9_AUS), a = ppFx9Kf(fk, [[0, 1], [0.5, 0.6], [1, 0]], PP_FX9_AUS), r = (60 * sc) / S;
    ppFx9Schein(g, cx, cy, r, r, PP_FX9_SAEURE_SCHEIN, a, [0.3, 0.6, 0.95]);
  }
  for (const d of te.tropfen) {
    const u = (t - d.delay) / d.dur;
    if (u < 0 || u > 1) continue;
    const b = ppFx9Blase(u, d.wobble), x = cx + (d.xOff + d.size / 2 + b.x) / S, y = cy + (10 - d.size / 2 + b.y) / S, n = (d.size * b.sc) / S;
    if (n < 0.8) continue;
    ppFx9Punkt(g, x, y, n, d.farbe, ppFx9Fest(b.a));
    if (n >= 3.4) g.put(x - n * 0.22, y - n * 0.22, PP_FX9_KOLBEN_PAL.w, ppFx9Fest(b.a) * 0.7);
  }
  for (const s of te.spritzer) {
    const u = (t - s.delay) / s.dur;
    if (u < 0 || u > 1) continue;
    const b = ppFx9Blase(u, 0), x = cx + (s.links + s.size / 2 + b.x) / S, y = cy + (10 - s.size / 2 + b.y) / S, n = (s.size * b.sc) / S;
    if (n < 1.2) continue;
    ppFx9Punkt(g, x, y, n, PP_FX9_SAEURE_SCHEIN[0], ppFx9Fest(b.a));
    if (n >= 5.6) ppFx9Bild(g, PP_FX9_KOLBEN, PP_FX9_KOLBEN_PAL, x, y, ppFx9Fest(b.a));
  }
}, 1100, { breite: 213, hoehe: 213 }, {
  z: 10100,
  vorbereiten: (sz) => {
    const ende = ppFx9Ende(sz);
    return {
      tropfen: Array.from({ length: ppFxN(22) }, () => {
        const [delay, dur] = ppFx9Fit(Math.random() * 120, 500 + Math.random() * 600, ende);
        return { xOff: -50 + Math.random() * 100, size: 8 + Math.random() * 16, wobble: -20 + Math.random() * 40, farbe: ppFx9Pick(PP_FX9_SAEURE), delay, dur };
      }),
      spritzer: Array.from({ length: ppFxN(6) }, () => {
        const [delay, dur] = ppFx9Fit(50 + Math.random() * 200, 600 + Math.random() * 400, ende);
        return { links: -15 + Math.random() * 30, size: 18 + Math.random() * 8, delay, dur };   // wie vorher: `left` = der Zufallswert yOff (-15…15)
      }),
    };
  },
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Boiling Oil (`boiling_oil`) — PIXELART. 22 rote Oeltropfen (Tropfenform, strecken sich beim Fallen .65 → 1,15) fallen beschleunigend von 0,65 Kartenhoehen ueber der Mitte bis auf das
//  untere Drittel (320–500 ms, alle 18 ms einer); dort 9 dunkle, rot glimmende Spritzer (Ringe: dunkelrot, rot, hellrot; wachsen .25 → 1,25 → 1,4) und 7 blasse Dampfwolken, die 28 px steigen.
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX9_OEL = ppFx9H(['#c80000', '#ff1a1a', '#cc2b00', '#be0e0e', '#ff491a', '#b5171c']);
const PP_FX9_OEL_SPRITZER = ppFx9H(['#520a0c', '#be0e0e', '#ff1a1a', '#c80000']);
const PP_FX9_OEL_DAMPF = ppFx9H(['#f4ae64', '#f0bfbc']);
const PP_FX9_OEL_FALL = ppFx9Bez(0.5, 0, 1, 1);
const ppFx9Oel = ppR1Leinwand((g, t, sz, te) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, ch = te.ch;
  for (const d of te.tropfen) {
    const u = (t - d.delay) / d.dur;
    if (u < 0 || u > 1) continue;
    const dy = ppFx9Kf(u, [[0, 0], [0.12, ch * 1.05 * 0.12], [1, ch * 1.05]], PP_FX9_OEL_FALL), sy = ppFx9Kf(u, [[0, 0.65], [0.12, 0.9], [1, 1.15]], PP_FX9_OEL_FALL), a = ppFx9Kf(u, [[0, 0], [0.12, 1], [1, 0.85]], PP_FX9_OEL_FALL);
    const x = cx + (d.startX + d.size / 2) / S, hoch = d.size * 1.7 * sy, y = cy + (-ch * 0.65 + (d.size * 1.7) / 2 + dy) / S;
    const rx = Math.max(0.6, d.size / 2 / S), ry = Math.max(1, hoch / 2 / S);
    g.ell(x, y + ry * 0.12, rx + 1, ry + 0.8, PP_FX9_OEL_SPRITZER[3], a * 0.45);   // Hof (statt Leuchten)
    g.ell(x, y + ry * 0.12, rx, ry, d.farbe, a);                                   // Tropfen: runder Bauch ...
    g.put(x, y - ry - 0.4, d.farbe, a);                                            // ... spitzes Oberende
    if (rx >= 1.1) g.put(x - rx * 0.4, y - ry * 0.1, PP_FX9_OEL_DAMPF[1], a * 0.75);   // Lichtpunkt
  }
  for (const s of te.spritzer) {
    const u = (t - s.delay) / s.dur;
    if (u < 0 || u > 1) continue;
    const sc = ppFx9Kf(u, [[0, 0.25], [0.35, 1.25], [1, 1.4]], PP_FX9_AUS), dy = ppFx9Kf(u, [[0, -4], [0.35, 0], [1, 2]], PP_FX9_AUS), a = ppFx9Kf(u, [[0, 0], [0.35, 0.95], [1, 0]], PP_FX9_AUS);
    const x = cx + (s.x + s.rx) / S, y = cy + (s.y + s.ry + dy) / S, rx = (s.rx * sc) / S, ry = (s.ry * sc) / S;
    if (rx < 0.8) continue;
    const af = ppFx9Fest(a);
    g.ell(x, y, rx + 1.6, ry + 1.3, PP_FX9_OEL_SPRITZER[3], af * 0.5);              // Glimmen am Rand
    g.ell(x, y, rx, ry, PP_FX9_OEL_SPRITZER[0], af);
    g.ell(x, y, rx * 0.72, ry * 0.72, PP_FX9_OEL_SPRITZER[1], af);
    g.ell(x, y, rx * 0.38, ry * 0.38, PP_FX9_OEL_SPRITZER[2], af);
  }
  for (const d of te.dampf) {
    const u = (t - d.delay) / d.dur;
    if (u < 0 || u > 1) continue;
    const sc = ppFx9Kf(u, [[0, 0.5], [0.3, 1], [1, 1.5]], PP_FX9_AUS), dy = ppFx9Kf(u, [[0, 0], [0.3, -8], [1, -28]], PP_FX9_AUS), a = ppFx9Kf(u, [[0, 0], [0.3, 0.7], [1, 0]], PP_FX9_AUS);
    const x = cx + (d.x + d.size / 2) / S, y = cy + (d.y + d.size * 0.7 + dy) / S, rx = (d.size * sc) / 2 / S, ry = (d.size * 1.4 * sc) / 2 / S;
    if (rx < 0.7) continue;
    g.ell(x, y, rx, ry, PP_FX9_OEL_DAMPF[0], a * 0.55);
    g.ell(x, y, rx * 0.55, ry * 0.55, PP_FX9_OEL_DAMPF[1], a * 0.6);
  }
}, 1100, (p) => {
  const cw = p.w || 100, ch = p.h || 140, hb = cw * 0.6 + 26, oben = ch * 0.65 + 14, unten = ch * 0.45 + 44;
  return { breite: hb * 2, hoehe: oben + unten, ankerX: hb, ankerY: oben };
}, {
  z: 10100,
  vorbereiten: (sz) => {
    const p = sz.props, cw = p.w || 100, ch = p.h || 140, ende = ppFx9Ende(sz);
    return {
      ch,
      tropfen: Array.from({ length: ppFxN(22) }, (_, i) => {
        const [delay, dur] = ppFx9Fit(i * 18 + Math.random() * 60, 320 + Math.random() * 180, ende);
        return { startX: -cw * 0.5 + Math.random() * cw, size: 4 + Math.random() * 6, farbe: ppFx9Pick(PP_FX9_OEL), delay, dur };
      }),
      spritzer: Array.from({ length: ppFxN(9) }, () => {
        const [delay, dur] = ppFx9Fit(150 + Math.random() * 220, 500 + Math.random() * 350, ende);
        return { x: -cw * 0.4 + Math.random() * cw * 0.8, y: ch * 0.15 + Math.random() * ch * 0.25, rx: 6 + Math.random() * 9, ry: 3 + Math.random() * 4, delay, dur };
      }),
      dampf: Array.from({ length: ppFxN(7) }, () => {
        const [delay, dur] = ppFx9Fit(280 + Math.random() * 250, 600 + Math.random() * 280, ende);
        return { x: -cw * 0.35 + Math.random() * cw * 0.7, y: ch * 0.18 + Math.random() * ch * 0.15, size: 6 + Math.random() * 5, delay, dur };
      }),
    };
  },
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Arrow Rain / Aquatic Arrow Rain (`arrow_rain`, `aquatic_arrow_rain`; Rain of Arrows, Aquatic Arrows) — PIXELART. 28 (Wasser: 26) Pfeile fallen beschleunigend 180 px aus 150–250 px Hoehe
//  (Schaft in drei Farbstufen, Spitze nach unten; 200–400 ms, ab 0–600 ms) und blenden im letzten Fuenftel aus; ab 250 ms spritzen 16 Funken bzw. Tropfen seitlich weg (Einschlag),
//  dazu ein Schein (600 ms ab 300 ms: .3 → 1,5 → 2 mal 40 px; Feuer: gelb-orange, Wasser: blau).
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
function ppFx9Pfeilregen(o) {
  const F = ppFx9H(o.schaft), SCHEIN = ppFx9H(o.schein), FUNKEN = ppFx9H(o.funken);
  return ppR1Leinwand((g, t, sz, te) => {
    const S = sz.S, cx = sz.cx, cy = sz.cy;
    const fk = (t - o.blitzVerzug) / 600;
    if (fk >= 0 && fk <= 1) {
      const sc = ppFx9Kf(fk, [[0, 0.3], [0.5, 1.5], [1, 2]], PP_FX9_AUS), a = ppFx9Kf(fk, [[0, 1], [0.5, 0.7], [1, 0]], PP_FX9_AUS), r = (40 * sc) / S;
      ppFx9Schein(g, cx, cy, r, r, SCHEIN, a, [0.15, 0.3, 0.5]);
    }
    for (const p of te.pfeile) {
      const u = (t - p.delay) / p.dur;
      if (u < 0 || u > 1) continue;
      const a = u < 0.8 ? 1 : 1 - PP_FX9_EIN((u - 0.8) / 0.2);
      const X = Math.round(cx + (p.xOff + 1) / S), Y = Math.round(cy + (p.startY + 180 * PP_FX9_EIN(u)) / S), n = p.n, z0 = Math.round(n * 0.3), z1 = Math.round(n * 0.75);
      for (let j = 0; j < n; j++) g.put(X, Y + j, j < z0 ? F[0] : j < z1 ? F[1] : F[2], a);
      g.block(X - 1, Y + n, 3, 1, F[3], a);
      g.put(X, Y + n + 1, F[3], a);
    }
    for (const p of te.funken) {
      const u = (t - p.delay) / p.dur;
      if (u < 0 || u > 1) continue;
      const e = PP_FX9_AUS(u), a = u < 0.2 ? 1 : 1 - PP_FX9_AUS((u - 0.2) / 0.8);
      ppFx9Punkt(g, cx + (p.dx * e) / S, cy + (p.dy * e) / S, (p.size * 1.2 * (1 - e)) / S, p.farbe, a);
    }
  }, 1100, { breite: 192, hoehe: 360, ankerY: 266 }, {
    z: 10100,
    vorbereiten: (sz) => {
      const ende = ppFx9Ende(sz);
      return {
        pfeile: Array.from({ length: ppFxN(o.pfeile) }, () => {
          const [delay, dur] = ppFx9Fit(Math.random() * o.pfeilZeit, 200 + Math.random() * 200, ende);
          return { xOff: -o.streuung + Math.random() * 2 * o.streuung, startY: -150 - Math.random() * 100, n: Math.round((18 + Math.random() * 14) / sz.S), delay, dur };
        }),
        funken: Array.from({ length: ppFxN(16) }, () => {
          const [delay, dur] = ppFx9Fit(o.funkenVon + Math.random() * o.funkenZeit, o.funkenDauer + Math.random() * 200, ende);
          return { dx: -o.funkenX + Math.random() * 2 * o.funkenX, dy: Math.random() * -(o.funkenHoch), size: 3 + Math.random() * 5, farbe: ppFx9Pick(FUNKEN), delay, dur };
        }),
      };
    },
  });
}
const ppFx9ArrowRain = ppFx9Pfeilregen({
  pfeile: 28, pfeilZeit: 600, streuung: 70, funkenX: 50, funkenHoch: 20, funkenVon: 250, funkenZeit: 500, funkenDauer: 300, blitzVerzug: 300,
  schaft: ['#ffd066', '#f9ac20', '#ff8b1a', '#ff8b1a'], schein: ['#ff8b1a', '#f9ac20', '#ffc61c'], funken: ['#fad54a', '#ff8b1a', '#f9ac20', '#c79e05', '#ffe469'],
});
const ppFx9AquaticArrowRain = ppFx9Pfeilregen({
  pfeile: 26, pfeilZeit: 550, streuung: 60, funkenX: 46, funkenHoch: 22, funkenVon: 240, funkenZeit: 480, funkenDauer: 320, blitzVerzug: 280,
  schaft: ['#b3e8f9', '#68c6fd', '#399edf', '#399edf'], schein: ['#399edf', '#77c8ee', '#b3e8f9'], funken: ['#b3e8f9', '#68c6fd', '#399edf', '#b3e8f9', '#77c8ee'],
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Arrow Impact (`arrow_impact`; Skeleton Archer, Crusader's Flintlock, Cybug Ants) — PIXELART. Ein heller Einschlagblitz (380 ms: .4 → 1,2 → 1,6 mal 15 px), 14 weisse Funken in einem Kranz
//  (22–40 px weit, 600 ms, ab 0–90 ms) und 6 rote Blutstropfen, die nach aussen fliegen und mit Schwerkraft absacken (720 ms, ab 0–60 ms).
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX9_EINSCHLAG_SCHEIN = ppFx9H(['#fbc86a', '#fbe181', '#fffbd2']);
const PP_FX9_EINSCHLAG_HOF = ppHex('#9d612f');
const PP_FX9_BLUT = ppFx9H(['#780000', '#c0141c']);
const PP_FX9_BLUT_BAHN = ppFx9Bez(0.2, 0.5, 0.4, 1);
const ppFx9ArrowImpact = ppR1Leinwand((g, t, sz, te) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy;
  const fk = t / 380;
  if (fk < 1) {
    const sc = ppFx9Kf(fk, [[0, 0.4], [0.3, 1.2], [1, 1.6]], PP_FX9_AUS), a = ppFx9Kf(fk, [[0, 0], [0.3, 1], [1, 0]], PP_FX9_AUS), r = (15 * sc) / S;
    ppFx9Schein(g, cx, cy, r, r, PP_FX9_EINSCHLAG_SCHEIN, a, [0.3, 0.5, 0.9]);
  }
  for (const s of te.funken) {
    const u = (t - s.delay) / 600;
    if (u < 0 || u > 1) continue;
    const e = ppFx9Kf(u, [[0, 0], [0.25, 0.4], [1, 1]], PP_FX9_AUS), sc = ppFx9Kf(u, [[0, 0.3], [0.25, 1], [1, 0.5]], PP_FX9_AUS), a = ppFx9Kf(u, [[0, 0], [0.25, 1], [1, 0]], PP_FX9_AUS);
    const x = cx + (s.dx * e) / S, y = cy + (s.dy * e) / S, n = (s.size * sc) / S;
    if (a > 0.25) g.disc(x, y, 1.9, PP_FX9_EINSCHLAG_HOF, a * 0.55);   // Hof (statt Leuchten)
    ppFx9Punkt(g, x, y, Math.max(1.8, n), PP_FX9_EINSCHLAG_SCHEIN[2], a);
  }
  for (const b of te.blut) {
    const u = (t - b.delay) / 720;
    if (u < 0 || u > 1) continue;
    const sc = ppFx9Kf(u, [[0, 0.5], [0.25, 1.1], [1, 0.8]], PP_FX9_BLUT_BAHN), a = ppFx9Kf(u, [[0, 0], [0.25, 1], [1, 0]], PP_FX9_BLUT_BAHN);
    const n = (b.size * sc) / S, x = cx + ppFx9Kf(u, [[0, 0], [0.25, b.dx * 0.5], [1, b.dx]], PP_FX9_BLUT_BAHN) / S, y = cy + ppFx9Kf(u, [[0, 0], [0.25, b.dy * 0.5], [1, b.gy]], PP_FX9_BLUT_BAHN) / S;
    if (n >= 2.2) g.disc(x, y, n / 2 + 0.7, PP_FX9_BLUT[0], a * 0.45);
    ppFx9Punkt(g, x, y, Math.max(1, n), PP_FX9_BLUT[1], a);
  }
}, 900, { breite: 150, hoehe: 150 }, {
  z: 10100,
  vorbereiten: () => ({
    funken: Array.from({ length: ppFxN(14) }, (_, i) => {
      const w = (i / 14) * Math.PI * 2 + Math.random() * 0.3, d = 22 + Math.random() * 18;
      return { dx: Math.cos(w) * d, dy: Math.sin(w) * d, size: 2 + Math.random() * 3, delay: Math.random() * 90 };
    }),
    blut: Array.from({ length: ppFxN(6) }, () => {
      const w = Math.random() * Math.PI * 2, d = 14 + Math.random() * 22;
      return { dx: Math.cos(w) * d, dy: Math.sin(w) * d, gy: Math.sin(w) * d + 14, size: 4 + Math.random() * 4, delay: Math.random() * 60 };
    }),
  }),
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Battery Charge (`battery_charge`; Future Tech Battery, Handkarte) — PIXELART. Ein hellblauer Blitzring (520 ms: Ellipse .35 → .9 → 1,35, blendet aus) und `count` (4…18) Funken, die vom Rand der
//  Karte nach aussen schiessen: ein Pixelstreifen (Enden blass, Mitte weiss, schmaler blauer Hof), wird .15 → 1 → 1,25 → 1,6 mal so lang (14–26 px, 520 ms, ab 0–320 ms).
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX9_STROM = ppFx9H(['#b3e8f9', '#77c8ee', '#399edf', '#b4dff8', '#ffffff']);
const ppFx9Batterie = ppR1Leinwand((g, t, sz, te) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, C = PP_FX9_STROM;
  const rk = t / 520;
  if (rk < 1) {
    const sc = ppFx9Kf(rk, [[0, 0.35], [0.35, 0.9], [1, 1.35]], PP_FX9_AUS), a = ppFx9Kf(rk, [[0, 0], [0.35, 0.95], [1, 0]], PP_FX9_AUS);
    const rx = (te.rx * 1.1 * sc) / S, ry = (te.ry * 1.1 * sc) / S;
    if (rx >= 1.5 && ry >= 1.5) {
      g.ellRing(cx, cy, rx - 0.8, ry - 0.8, 1, C[1], a * 0.45);   // innerer Schimmer
      g.ellRing(cx, cy, rx, ry, 1, C[0], a);
    }
  }
  for (const f of te.funken) {
    const u = (t - f.delay) / 520;
    if (u < 0 || u > 1) continue;
    const sx = ppFx9Kf(u, [[0, 0.15], [0.3, 1], [0.7, 1.25], [1, 1.6]], PP_FX9_AUS), a = ppFx9Kf(u, [[0, 0], [0.3, 1], [0.7, 1], [1, 0]], PP_FX9_AUS);
    const x0 = cx + f.x / S, y0 = cy + f.y / S, L = (f.laenge * sx) / S, x1 = x0 + f.dx * L, y1 = y0 + f.dy * L;
    g.line(x0, y0, x1, y1, C[2], a * 0.22, 3);   // Hof
    ppR1Band(g, x0, y0, x1, y1, (v) => (v < 0.2 || v > 0.85 ? { w: 1, c: C[3], a: 0.55 } : v > 0.45 && v < 0.75 ? { w: 1, c: C[4] } : { w: 1, c: C[3] }), a);
  }
}, 600, (p) => {
  const rx = Math.max(p.w || 44, 30) * 0.42, ry = Math.max(p.h || 62, 40) * 0.42;
  return { breite: 2 * (Math.max(rx * 1.5, rx + 44) + 10), hoehe: 2 * (Math.max(ry * 1.5, ry + 44) + 10) };
}, {
  z: 10110,
  vorbereiten: (sz) => {
    const p = sz.props, n = Math.max(4, Math.min(p.count || 4, 18)), rx = Math.max(p.w || 44, 30) * 0.42, ry = Math.max(p.h || 62, 40) * 0.42, ende = ppFx9Ende(sz);
    return {
      rx, ry,
      funken: Array.from({ length: n }, (_, i) => {
        const w = (i / n) * Math.PI * 2 + Math.random() * 0.5, [delay, dur] = ppFx9Fit(Math.random() * 320, 520, ende);
        return { x: Math.cos(w) * rx, y: Math.sin(w) * ry, dx: Math.cos(w), dy: Math.sin(w), laenge: 14 + Math.random() * 12, delay, dur };
      }),
    };
  },
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Angel Revival (`angel_revival`; Reincarnation) — PIXELART. Zwei goldene Scheine (gross 150 px: .3 → 1,5 → 2, 900 ms ab 250 ms; klein 90 px: 700 ms ab 250 ms), 12 kleine Engel (Heiligenschein,
//  Gesicht, Fluegel — aus Pixeln gezeichnet) steigen 70–150 px auf (700–1200 ms, ab 100–600 ms) und 20 helle Funken (500–1000 ms, ab 200–800 ms).
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX9_ENGEL = { halo: ppHex('#fad54a'), rand: ppHex('#f9ac20'), gesicht: ppHex('#ffe469'), auge: ppHex('#6e4421'), fluegel: ppHex('#ffffff'), fluegelRand: ppHex('#b3e8f9') };
const PP_FX9_ENGEL_SCHEIN1 = ppFx9H(['#f9ecb3', '#fad54a', '#fffbd2']);
const PP_FX9_ENGEL_SCHEIN2 = ppFx9H(['#ffe469', '#fff196', '#ffffff']);
const PP_FX9_ENGEL_FUNKEN = ppFx9H(['#fad54a', '#fbe181', '#fffbd2', '#ffffff', '#ffe469']);
/** Kleiner Engel aus Pixeln: `n` = Kantenlaenge in Rasterpixeln (ca. 5…11), Mitte (cx, cy). */
function ppFx9Engel(g, cx, cy, n, a) {
  const E = PP_FX9_ENGEL, r = Math.max(1.5, n * 0.27);
  g.ell(cx - r * 1.55, cy + r * 0.05, r * 0.95, r * 0.7, E.fluegelRand, a);
  g.ell(cx + r * 1.55, cy + r * 0.05, r * 0.95, r * 0.7, E.fluegelRand, a);
  g.ell(cx - r * 1.55, cy, r * 0.65, r * 0.4, E.fluegel, a);
  g.ell(cx + r * 1.55, cy, r * 0.65, r * 0.4, E.fluegel, a);
  g.ellRing(cx, cy - r * 1.3, r * 0.95, r * 0.4, 1, E.halo, a);
  g.disc(cx, cy, r + 0.55, E.rand, a);
  g.disc(cx, cy, r - 0.05, E.gesicht, a);
  if (r >= 2) { g.put(cx - r * 0.42, cy - 0.2, E.auge, a); g.put(cx + r * 0.42, cy - 0.2, E.auge, a); }
}
const ppFx9AngelRevival = ppR1Leinwand((g, t, sz, te) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy;
  const k1 = (t - te.f1[0]) / te.f1[1];
  if (k1 >= 0 && k1 <= 1) {
    const sc = ppFx9Kf(k1, [[0, 0.3], [0.5, 1.5], [1, 2]], PP_FX9_AUS), a = ppFx9Kf(k1, [[0, 1], [0.5, 0.7], [1, 0]], PP_FX9_AUS), r = (75 * sc) / S;
    ppFx9Schein(g, cx, cy, r, r, PP_FX9_ENGEL_SCHEIN1, a, [0.15, 0.45, 0.9]);
  }
  const k2 = (t - te.f2[0]) / te.f2[1];
  if (k2 >= 0 && k2 <= 1) {
    const sc = ppFx9Kf(k2, [[0, 0.3], [0.5, 1.5], [1, 2]], PP_FX9_AUS), a = ppFx9Kf(k2, [[0, 1], [0.5, 0.7], [1, 0]], PP_FX9_AUS), r = (45 * sc) / S;
    ppFx9Schein(g, cx, cy, r, r, PP_FX9_ENGEL_SCHEIN2, a, [0.2, 0.55, 0.98]);
  }
  for (const e of te.engel) {
    const u = (t - e.delay) / e.dur;
    if (u < 0 || u > 1) continue;
    const dy = ppFx9Kf(u, [[0, 0], [0.15, 0], [1, e.endY]], PP_FX9_AUS), sc = ppFx9Kf(u, [[0, 0.5], [0.15, 1.1], [1, 0.6]], PP_FX9_AUS), a = ppFx9Kf(u, [[0, 0], [0.15, 1], [0.8, 0.8], [1, 0]], PP_FX9_AUS);
    const n = (e.size * sc * 1.35) / S;
    if (n < 3) { ppFx9Punkt(g, cx + (e.xOff + e.size * 0.35) / S, cy + (e.startY + e.size * 0.4 + dy) / S, n, PP_FX9_ENGEL.halo, a); continue; }
    ppFx9Engel(g, cx + (e.xOff + e.size * 0.35) / S, cy + (e.startY + e.size * 0.4 + dy) / S, n, a);
  }
  for (const s of te.funken) {
    const u = (t - s.delay) / s.dur;
    if (u < 0 || u > 1) continue;
    const dy = ppFx9Kf(u, [[0, 0], [0.15, 0], [1, s.endY]], PP_FX9_AUS), sc = ppFx9Kf(u, [[0, 0.5], [0.15, 1.1], [1, 0.6]], PP_FX9_AUS), a = ppFx9Kf(u, [[0, 0], [0.15, 1], [0.8, 0.8], [1, 0]], PP_FX9_AUS);
    const n = (s.size * sc) / S, x = cx + (s.xOff + s.size / 2) / S, y = cy + (s.startY + s.size / 2 + dy) / S;
    if (n >= 2.2) g.disc(x, y, n / 2 + 1, PP_FX9_ENGEL_FUNKEN[0], a * 0.3);   // Hof
    ppFx9Punkt(g, x, y, n, s.farbe, a);
  }
}, 1100, { breite: 330, hoehe: 330 }, {
  z: 10100,
  vorbereiten: (sz) => {
    const ende = ppFx9Ende(sz);
    return {
      f1: ppFx9Fit(250, 900, ende), f2: ppFx9Fit(250, 700, ende),
      engel: Array.from({ length: ppFxN(12) }, () => {
        const [delay, dur] = ppFx9Fit(100 + Math.random() * 500, 700 + Math.random() * 500, ende);
        return { xOff: -45 + Math.random() * 90, startY: 20 + Math.random() * 30, endY: -70 - Math.random() * 80, size: 18 + Math.random() * 14, delay, dur };
      }),
      funken: Array.from({ length: ppFxN(20) }, () => {
        const [delay, dur] = ppFx9Fit(200 + Math.random() * 600, 500 + Math.random() * 500, ende);
        return { xOff: -50 + Math.random() * 100, startY: 10 + Math.random() * 40, endY: -50 - Math.random() * 70, size: 3 + Math.random() * 7, farbe: ppFx9Pick(PP_FX9_ENGEL_FUNKEN), delay, dur };
      }),
    };
  },
});

// ── Pflanzen-Pixelbilder (Biomancy): Zeichen p/P = Blatt dunkel/hell, y = Mitte, g/G/d = Gruen mittel/hell/dunkel ──────────────────────────────────────────────────
const PP_FX9_PFL = {
  bluete5: ['.ppp.', 'pPyPp', 'pyyyp', 'pPyPp', '.ppp.'],
  bluete7: ['..ppp..', '.pPpPp.', 'ppPyPpp', 'pPyyyPp', 'ppPyPpp', '.pPpPp.', '..ppp..'],
  klee5: ['gg.gg', 'gGggg', '.ggg.', 'gGggg', 'gg.gg'],
  klee7: ['.gg.gg.', 'gGggGgg', '.gggGg.', '..gdg..', '.gggGg.', 'gGggGgg', '.gg.gg.'],
  kraut5: ['...gG', '..gGg', '.gGg.', 'gGg..', 'd....'],
  kraut7: ['.....gG', '....gGg', '..ggGg.', '.gGgg..', 'gGgg...', '.d.....', 'd......'],
  spross5: ['gg.gg', 'gGgGg', '.ggg.', '..d..', '..d..'],
  spross7: ['.gg.gg.', 'gGggGgg', 'ggGgGgg', '.ggdgg.', '...d...', '...d...', '...d...'],
  halm5: ['..y..', '.yyy.', '..y..', '.yyy.', '..d..'],
  halm7: ['...y...', '..yYy..', '...y...', '..yYy..', '...y...', '..yYy..', '...d...'],
  laub5: ['.gggG', 'gggGG', 'gggG.', '.dg..', 'd....'],
  laub7: ['..gggGG', '.gggGGg', 'gggGGgg', '.ggGgg.', '..dg...', '.d.....', 'd......'],
};
const ppFx9Gruen = { g: ppHex('#20ac37'), G: ppHex('#75f091'), d: ppHex('#167927') };
const PP_FX9_PFL_PAL = {
  rosa: { ...ppFx9Gruen, p: ppHex('#f174ab'), P: ppHex('#f8b4df'), y: ppHex('#fad54a') },
  rot: { ...ppFx9Gruen, p: ppHex('#e92f38'), P: ppHex('#ff6666'), y: ppHex('#fad54a') },
  gelb: { ...ppFx9Gruen, p: ppHex('#fad54a'), P: ppHex('#fffbd2'), y: ppHex('#9d612f') },
  gruen: ppFx9Gruen,
  halm: { ...ppFx9Gruen, y: ppHex('#c79e05'), Y: ppHex('#fbe181') },
};
/** Art → [Bildname, Palette, Punktfarbe]. */
const PP_FX9_PFL_ARTEN = {
  rosa: ['bluete', 'rosa', '#f174ab'], rot: ['bluete', 'rot', '#e92f38'], gelb: ['bluete', 'gelb', '#fad54a'],
  klee: ['klee', 'gruen', '#20ac37'], kraut: ['kraut', 'gruen', '#20ac37'], spross: ['spross', 'gruen', '#75f091'], halm: ['halm', 'halm', '#c79e05'], laub: ['laub', 'gruen', '#20ac37'],
};
/** Pflanze zeichnen: `n` = Kantenlaenge in Rasterpixeln; kleiner als 3 → ein Punkt. */
function ppFx9Pflanze(g, art, x, y, n, a) {
  const [bild, pal, punkt] = PP_FX9_PFL_ARTEN[art];
  if (n < 3) { ppFx9Punkt(g, x, y, Math.max(1, n * 0.8), ppHex(punkt), a); return; }
  ppFx9Bild(g, PP_FX9_PFL[bild + (n < 5.8 ? '5' : '7')], PP_FX9_PFL_PAL[pal], x, y, a);
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Biomancy Bloom (`biomancy_bloom`; Biomancy-Token entsteht) — PIXELART. 16 Blumen und Blaetter (Pixelbilder statt Emojis) bluehen im Kranz um die Mitte auf: wachsen .2 → 1,1, wandern auf
//  15–40 × 10–30 px nach aussen, schrumpfen und verblassen (600–1000 ms, ab i·40 ms). Biomancy Vines (`biomancy_vines`): 12 Ranken (Sprosse, Blaetter, Kleeblaetter, Halme) schwimmen aus einem
//  Ring (30 × 20 px) zur Mitte (500–800 ms, ab i·30 ms).
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const ppFx9Bluete = ppR1Leinwand((g, t, sz, te) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy;
  for (const f of te.blumen) {
    const u = (t - f.delay) / f.dur;
    if (u < 0 || u > 1) continue;
    const dx = ppFx9Kf(u, [[0, 0], [0.6, f.dx], [1, f.dx * 1.2]], PP_FX9_AUS), dy = ppFx9Kf(u, [[0, 0], [0.6, f.dy], [1, f.dy * 1.2]], PP_FX9_AUS), sc = ppFx9Kf(u, [[0, 0.2], [0.6, 1.1], [1, 0.8]], PP_FX9_AUS);
    const a = ppFx9Kf(u, [[0, 0], [0.2, 1], [0.6, 1], [1, 0]], PP_FX9_AUS);
    ppFx9Pflanze(g, f.art, cx + (dx + f.size * 0.35) / S, cy + (dy + f.size * 0.4) / S, (f.size * sc * 1.15) / S, a);
  }
}, 1100, { breite: 192, hoehe: 168 }, {
  z: 10100,
  vorbereiten: (sz) => {
    const ende = ppFx9Ende(sz);
    return {
      blumen: Array.from({ length: ppFxN(16) }, (_, i) => {
        const w = (i / 16) * Math.PI * 2, [delay, dur] = ppFx9Fit(i * 40 + Math.random() * 60, 600 + Math.random() * 400, ende);
        return { dx: Math.cos(w) * (15 + Math.random() * 25), dy: Math.sin(w) * (10 + Math.random() * 20), size: 10 + Math.random() * 14, art: ppFx9Pick(['rosa', 'rot', 'gelb', 'klee', 'kraut', 'klee']), delay, dur };
      }),
    };
  },
});
const ppFx9Ranken = ppR1Leinwand((g, t, sz, te) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy;
  for (const v of te.ranken) {
    const u = (t - v.delay) / v.dur;
    if (u < 0 || u > 1) continue;
    const e = ppFx9Kf(u, [[0, 1], [0.7, 0], [1, 0]], PP_FX9_EAUS), sc = ppFx9Kf(u, [[0, 0.3], [0.7, 1.1], [1, 0.9]], PP_FX9_EAUS), a = ppFx9Kf(u, [[0, 0], [0.3, 1], [0.7, 1], [1, 0]], PP_FX9_EAUS);
    ppFx9Pflanze(g, v.art, cx + (v.dx * e + v.size * 0.35) / S, cy + (v.dy * e + v.size * 0.4) / S, (v.size * sc * 1.15) / S, a);
  }
}, 1100, { breite: 147, hoehe: 132 }, {
  z: 10100,
  vorbereiten: (sz) => {
    const ende = ppFx9Ende(sz);
    return {
      ranken: Array.from({ length: ppFxN(12) }, (_, i) => {
        const w = (i / 12) * Math.PI * 2, [delay, dur] = ppFx9Fit(i * 30 + Math.random() * 50, 500 + Math.random() * 300, ende);
        return { dx: Math.cos(w) * 30, dy: Math.sin(w) * 20, size: 12 + Math.random() * 10, art: ppFx9Pick(['kraut', 'spross', 'klee', 'laub', 'halm']), delay, dur };
      }),
    };
  },
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Baby Spider — Opfer (`baby_spider_opfer`; Surprise-Zone) — PIXELART. Angehaengt an die Surprise Zone, die Baby Spider kommt als `von` (vonDx/vonDy). Ablauf wie vorher (1900 ms):
//     0–520   Seide spinnt die Baby Spider ein (7 geschwungene Faeden, ab i·55 ms) + weisser Dunst (ab 360 ms)
//   360–830   ein Faden spannt sich von der Baby Spider zur Surprise; ab 410 ms laeuft eine kleine Spinne (Beine zappeln, Kopf voraus) ueber den Faden, springt an und huscht am Netz hin und her
//   880–1900  die Spinne webt ein Netz (9 Speichen ab 880 ms, 4 Ringe ab 1000 ms; jeder Strang wird in 460 ms gezogen und blendet aus)
//  1200–1780  Aktivierung: violetter Blitz, ab 1220 ms ein heller Ring. Die vier Klaenge der DOM-Fassung (debuff / elem_wind / slash / elem_dark) spielt die Huelle unveraendert.
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX9_SP = { koerper: ppHex('#08060c'), rand: ppHex('#291f3d'), streifen: ppHex('#3e3e51'), auge: ppHex('#f03232'), bein: ppHex('#291f3d') };
const PP_FX9_SEIDE = ppHex('#e5edfa');
const PP_FX9_SP_DUNST = ppFx9H(['#f1e5fa', '#ffffff']);
const PP_FX9_SP_BLITZ = ppFx9H(['#7a2bd0', '#ba74ff', '#ffffff']);
const PP_FX9_SP_RING = ppFx9H(['#d6b3f9', '#a952ff']);
/** Kleine Spinne aus Pixeln (Mitte px/py, Blickrichtung fx/fy, k = Rasterpixel je Einheit der alten 44er-Zeichnung, ph = Beinschlag -1…1). */
function ppFx9Spinne(g, px, py, fx, fy, k, t, a) {
  const P = PP_FX9_SP, qx = -fy, qy = fx;
  const W = (lx, ly) => [px + k * (lx * qx - ly * fx), py + k * (lx * qy - ly * fy)];
  [-1, 1].forEach((s) => [-0.55, -0.2, 0.15, 0.5].forEach((v, i) => {
    const th = (Math.PI / 20) * Math.sin(((t + (i % 2 ? 70 : 0)) / 280) * Math.PI * 2), c = Math.cos(th), sn = Math.sin(th);
    const R = (x, y) => W(x * c - y * sn, x * sn + y * c), p0 = R(s * 3, v * 10), p1 = R(s * 11, v * 10 - 6), p2 = R(s * 17, v * 14 + 4);
    g.line(p0[0], p0[1], p1[0], p1[1], P.bein, a);
    g.line(p1[0], p1[1], p2[0], p2[1], P.bein, a);
  }));
  const Rr = Math.ceil(11 * k) + 1;
  px = Math.round(px); py = Math.round(py);
  for (let j = -Rr; j <= Rr; j++) for (let i = -Rr; i <= Rr; i++) {
    const lx = (i * qx + j * qy) / k, ly = -(i * fx + j * fy) / k;
    const hinten = ((lx / 7) ** 2 + ((ly - 5) / 8.5) ** 2), kopf = lx * lx + (ly + 6) * (ly + 6);
    if (hinten <= 1 || kopf <= 25) {
      g.put(px + i, py + j, hinten <= 1 && ly > 1 && ly < 3.4 && Math.abs(lx) < 4 ? P.streifen : P.koerper, a);
    } else if (hinten <= 1.5 || kopf <= 38) g.put(px + i, py + j, P.rand, a);
  }
  const e1 = W(-2.2, -8), e2 = W(2.2, -8);
  g.put(e1[0], e1[1], P.auge, a); g.put(e2[0], e2[1], P.auge, a);
}
const PpFx9BabySpiderLeinwand = ppR1Leinwand((g, t, sz, te) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, qx = te.qx, qy = te.qy, sw = te.sw, sh = te.sh;
  // ── Kokon + Dunst um die Baby Spider
  te.kokon.forEach((kette, i) => {
    const u = (t - i * 55) / 1100;
    if (u < 0 || u > 1) return;
    const f = u < 0.45 ? PP_FX9_AUS(u / 0.45) : 1, a = ppFx9Kf(u, [[0, 0], [0.1, 1], [0.45, 1], [0.7, 0.9], [1, 0]], PP_FX9_AUS);
    const n = Math.ceil(kette.length * f);
    for (let q = 0; q < n; q++) g.put(kette[q][0], kette[q][1], PP_FX9_SEIDE, a);
  });
  { const u = (t - 360) / 900;
    if (u >= 0 && u <= 1) {
      const sc = ppFx9Kf(u, [[0, 0.7], [0.3, 1.05], [1, 1.35]], PP_FX9_AUS), a = ppFx9Kf(u, [[0, 0], [0.3, 1], [1, 0]], PP_FX9_AUS);
      ppFx9Schein(g, qx, qy, (sw / 2 * sc) / S, (sh / 2 * sc) / S, PP_FX9_SP_DUNST, a, [0.45, 0.85]);
    } }
  // ── Faden von der Baby Spider zur Surprise (wird von der Quelle aus gezogen)
  { const u = t / 1650;
    if (u < 0.9) {
      const f = u < 0.22 ? 0 : u < 0.5 ? PP_FX9_AUS((u - 0.22) / 0.28) : 1, a = u < 0.74 ? 0.95 : 0.9 * (1 - (u - 0.74) / 0.16);
      const n = Math.ceil(te.faden.length * f);
      for (let q = 0; q < n; q++) g.put(te.faden[q][0], te.faden[q][1], PP_FX9_SEIDE, a);
    } }
  // ── die kleine Spinne
  { const u = t / 1650;
    if (u < 0.76) {
      const sx = te.vonDx, sy = te.vonDy;
      const X = ppFx9Kf(u, [[0, sx], [0.22, sx], [0.25, sx * 0.96], [0.3, sx * 0.88], [0.54, 0], [0.6, -6], [0.66, 6], [0.71, 0], [1, 0]]);
      const Y = ppFx9Kf(u, [[0, sy], [0.22, sy], [0.25, sy * 0.96 - 16], [0.3, sy * 0.88], [0.54, 0], [0.6, -5], [0.66, 3], [0.71, 0], [1, 0]]);
      const sc = ppFx9Kf(u, [[0, 0.6], [0.22, 0.6], [0.25, 1.1], [0.3, 1], [0.71, 1], [0.76, 0.3]]), a = ppFx9Kf(u, [[0, 0], [0.22, 0], [0.25, 1], [0.71, 1], [0.76, 0]]);
      if (a > 0.04) ppFx9Spinne(g, cx + X / S, cy + Y / S, te.fx, te.fy, (te.sg / 20 / S) * sc, t, a);
    } }
  // ── Netz ueber der Surprise
  const netz = (kette, versatz) => {
    const u = (t - versatz) / 770;
    if (u < 0 || u > 1) return;
    const f = u < 0.6 ? PP_FX9_AUS(u / 0.6) : 1, a = u < 0.15 ? PP_FX9_AUS(u / 0.15) : u < 0.6 ? 1 : 1 - PP_FX9_AUS((u - 0.6) / 0.4);
    const n = Math.ceil(kette.length * f);
    for (let q = 0; q < n; q++) g.put(kette[q][0], kette[q][1], PP_FX9_SEIDE, a);
  };
  te.speichen.forEach((k, i) => netz(k, 880 + i * 18));
  te.ringe.forEach((k, i) => netz(k, 1000 + i * 55));
  // ── Aktivierung: Blitz + Ring
  { const u = (t - 1200) / 520;
    if (u >= 0 && u <= 1) {
      const sc = ppFx9Kf(u, [[0, 0.6], [0.25, 1.05], [1, 1.3]], PP_FX9_AUS), a = ppFx9Kf(u, [[0, 0], [0.25, 1], [1, 0]], PP_FX9_AUS);
      ppFx9Schein(g, cx, cy, (te.w * 0.75 * sc) / S, (te.h * 0.65 * sc) / S, PP_FX9_SP_BLITZ, a, [0.25, 0.7, 0.95]);
    } }
  { const u = (t - 1220) / 560;
    if (u >= 0 && u <= 1) {
      const r = (te.w * 0.6 * ppFx9Kf(u, [[0, 0.3], [1, 1.6]], PP_FX9_AUS)) / S, a = ppFx9Kf(u, [[0, 0], [0.2, 1], [1, 0]], PP_FX9_AUS);
      if (r >= 2) { g.ring(cx, cy, r - 2.2, r - 1, PP_FX9_SP_RING[1], a * 0.5); g.ring(cx, cy, r - 1, r, PP_FX9_SP_RING[0], a); }
    } }
}, 2000, (p) => {
  const w = p.w || 70, h = p.h || 100, vdx = p.vonDx == null ? 0 : p.vonDx, vdy = p.vonDy == null ? -140 : p.vonDy, sw = p.vonW || w, sh = p.vonH || h;
  const l = Math.min(-w * 1.0, vdx - sw * 0.75) - 8, r = Math.max(w * 1.0, vdx + sw * 0.75) + 8, o = Math.min(-h * 0.9, -w * 0.96, vdy - sh * 0.7) - 8, u = Math.max(h * 0.9, w * 0.96, vdy + sh * 0.7) + 8;
  return { breite: r - l, hoehe: u - o, ankerX: -l, ankerY: -o };
}, {
  z: 10206,
  vorbereiten: (sz) => {
    const p = sz.props, S = sz.S, cx = sz.cx, cy = sz.cy, w = p.w || 70, h = p.h || 100, vonDx = p.vonDx == null ? 0 : p.vonDx, vonDy = p.vonDy == null ? -140 : p.vonDy, sw = p.vonW || w, sh = p.vonH || h;
    const qx = cx + vonDx / S, qy = cy + vonDy / S, lang = Math.hypot(vonDx, vonDy) || 1;
    const kokon = Array.from({ length: 7 }, (_, i) => {
      const yy = -sh * 0.42 + (i / 6) * sh * 0.84, kipp = (i % 2 ? 1 : -1) * sh * 0.14;
      return ppR1Kette(ppFx9Bogen(qx - (sw * 0.52) / S, qy + (yy - kipp) / S, qx, qy + (yy + kipp * 1.6) / S, qx + (sw * 0.52) / S, qy + (yy + kipp) / S, 14));
    });
    const netz = ppR1NetzEcken(w * 0.62, h * 0.52, 9, 4), abb = (pts) => ppR1Kette(pts.map(([x, y]) => [cx + x / S, cy + y / S]));
    return {
      w, h, sw, sh, vonDx, vonDy, qx, qy, kokon,
      faden: ppR1Kette([[qx, qy], [cx, cy]]),
      fx: vonDx === 0 && vonDy === 0 ? -1 : -vonDx / lang, fy: vonDx === 0 && vonDy === 0 ? 0 : -vonDy / lang,
      sg: Math.max(12, w * 0.2),
      speichen: netz.speichen.map(abb), ringe: netz.ringe.map(abb),
    };
  },
});
function ppFx9BabySpider(props) {
  useEffect(() => {
    const spiel = (name, opts, at) => setTimeout(() => { if (window.playSFX) window.playSFX(name, { ...opts, dedupe: 0 }); }, at);
    spiel('debuff', { rate: 1.35, volume: 0.6 }, 0);
    spiel('elem_wind', { rate: 1.9, volume: 0.45 }, 380);
    spiel('slash', { rate: 1.7, volume: 0.35 }, 900);
    spiel('elem_dark', { rate: 1.3, volume: 0.6 }, 1200);
  }, []);
  return <PpFx9BabySpiderLeinwand {...props} />;
}

ppFxUeberschreiben('bomblebee_blast', ppFx9Bomblebee);
ppFxUeberschreiben('black_flame_strike', ppFx9BlackFlame);
ppFxUeberschreiben('acid_splash', ppFx9Saeure);
ppFxUeberschreiben('boiling_oil', ppFx9Oel);
ppFxUeberschreiben('arrow_rain', ppFx9ArrowRain);
ppFxUeberschreiben('aquatic_arrow_rain', ppFx9AquaticArrowRain);
ppFxUeberschreiben('arrow_impact', ppFx9ArrowImpact);
ppFxUeberschreiben('battery_charge', ppFx9Batterie);
ppFxUeberschreiben('angel_revival', ppFx9AngelRevival);
ppFxUeberschreiben('biomancy_bloom', ppFx9Bluete);
ppFxUeberschreiben('biomancy_vines', ppFx9Ranken);
ppFxUeberschreiben('baby_spider_opfer', ppFx9BabySpider);
