// Pixelart-Portierungen (Canvas), Batch 10 (zweite Welle, Schwelle 50 ms): siehe app-fx-0.jsx. Jede Portierung: `ppFxUeberschreiben('typ', Komponente)`.
// Effekte: bomblebee_dive, bomblebee_tick, cactus_burst, cannibalism_chomp, cavalry_charge, claw_maul, cloud_disperse, cloud_gather, cold_strike_apply, cosmic_counter_add,
// cosmic_token_drop, creature_death.
// Alle laufen auf EINER Leinwand je Effekt (`ppR1Leinwand`, 1 Rasterpixel = 3 Bildschirmpixel, 30 Bilder/s): keine weichen Schatten, Scheine oder Verläufe — Schein = Dither-Stufen
// (`ppFx7Glow`), Deckung = Bayer-Raster, Symbole (Wolke, Keule, Kaktus, Pferd, Schneeflocke, Stern) = kleine Pixelbilder bzw. Pixelmasken mit hartem Rand, nichts wird gedreht.
// Bewegung rechnet in Bildschirmpixeln und landet auf ganzen Rasterpixeln. Zeitachsen wie in den alten CSS-Keyframes, nur dort gekürzt, wo die Zonen-Animation vor dem
// Ende der Partikel abgeräumt wurde (Standard-Lebensdauer 1000 ms, creature_death 1200 ms).

// ── Bausteine (Präfix ppFx10) ───────────────────────────────────────────────────────────────────────────────────────────
const ppFx10R = (a, b) => a + Math.random() * (b - a);
const ppFx10Pick = (l) => l[Math.floor(Math.random() * l.length)];
const ppFx10P = (liste) => liste.map(ppHex);
const PP_FX10_BEZ_KRALLE = ppFx7Bez(0.2, 0.9, 0.3, 1);     // clawSlash
const PP_FX10_BEZ_MEAT = ppFx7Bez(0.4, 0, 0.55, 1);        // animCannibalismMeat
const PP_FX10_BEZ_TOKEN = ppFx7Bez(0.5, 0, 0.7, 1);        // cosmic-token-fall
/** Pixelmaske mit hartem 1-Pixel-Rand: `fn(i, j)` (ganzzahlig, relativ zur Mitte) gibt die Füllfarbe oder null; `rand` = Randfarbe (oder null); `R` = Halbmaß der Maske. */
function ppFx10Maske(g, cx, cy, R, fn, rand, a) {
  cx = Math.round(cx); cy = Math.round(cy);
  for (let j = -R - 1; j <= R + 1; j++) for (let i = -R - 1; i <= R + 1; i++) {
    const c = fn(i, j);
    if (c) { g.put(cx + i, cy + j, c, a); continue; }
    if (rand && (fn(i - 1, j) || fn(i + 1, j) || fn(i, j - 1) || fn(i, j + 1))) g.put(cx + i, cy + j, rand, a);
  }
}
/** Wolke (☁) der Breite W Rasterpixel: drei Wülste auf flachem Boden, oben weiß, unten bläulich; Rand blaugrau. */
const PP_FX10_WOLKE = ppFx10P(['#ffffff', '#e5edfa', '#b4cff8', '#89abdc']);
function ppFx10Wolke(g, cx, cy, W, a) {
  if (a <= 0.02 || W < 1.5) return;
  if (W < 4.5) { g.block(cx - W / 2, cy - 0.5, Math.max(2, Math.round(W)), 1, PP_FX10_WOLKE[1], a); return; }
  const C = PP_FX10_WOLKE, W2 = W * W;
  const fn = (i, j) => {
    const x = i / W, y = j / W;
    const innen = ((x + 0.26) * (x + 0.26) + (y - 0.04) * (y - 0.04) <= 0.0576) || (x * x + (y + 0.1) * (y + 0.1) <= 0.0784)
      || ((x - 0.27) * (x - 0.27) + (y - 0.05) * (y - 0.05) <= 0.0484) || (x >= -0.44 && x <= 0.44 && y >= 0.02 && y <= 0.27);
    return innen ? (y < -0.05 ? C[0] : y < 0.16 ? C[1] : C[2]) : null;
  };
  ppFx10Maske(g, cx, cy, Math.ceil(W * 0.55), fn, W >= 7 ? C[3] : null, a);
}
/** Vierzackiger Stern (✦/✧) mit Armlänge n Rasterpixeln. */
function ppFx10Stern(g, cx, cy, n, c, a) {
  cx = Math.round(cx); cy = Math.round(cy);
  for (let k = -n; k <= n; k++) { g.put(cx + k, cy, c, a); g.put(cx, cy + k, c, a); }
  const m = Math.floor(n / 2);
  for (let k = -m; k <= m; k++) { g.put(cx + k, cy - 1, c, a); g.put(cx + k, cy + 1, c, a); g.put(cx - 1, cy + k, c, a); g.put(cx + 1, cy + k, c, a); }
}
/** Funke: n×n-Block mit Halo-Kreuz (gedithert) — wie `ppFx4Funke`. */
const ppFx10Funke = (g, x, y, n, c, halo, a) => ppFx4Funke(g, x, y, n, c, halo, a);

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Dive Bomblebee (`bomblebee_dive`) — weiß/hellblau. Ein schräger Strich stürzt von rechts oben aufs Ziel (280 ms, Neigung 35°, er wird als Pixelkette auf der Strecke gezeichnet),
//  der Aufschlagknall (Dither-Kugel, 500 ms ab 230 ms: .3 → 1,2 → 1,7) und 14 Funken, die nach links unten stieben (360–560 ms ab 220–300 ms). Vorher lag der Strich wegen des
//  Drehpunkts im CSS rund 60 px rechts unterhalb des Ziels; jetzt endet er im Ziel.
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX10_BLAU = ppFx10P(['#ffffff', '#e5edfa', '#b4cff8', '#89abdc']);
const ppFx10BombDive = ppR1Leinwand((g, t, sz, te) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, C = PP_FX10_BLAU, K = ppFx7Kf;
  const su = t / 280;
  if (su >= 0 && su <= 1) {
    const d0 = K(su, [[0, 40], [0.4, 0], [1, -20]], ppFx7Ei), len = 140 * K(su, [[0, 0.6], [0.4, 1], [1, 0.8]], ppFx7Ei), a = K(su, [[0, 0], [0.4, 1], [1, 0]], ppFx7Ei);
    const sx = 0.574, sy = -0.819, d1 = d0 + len;
    ppR1Band(g, cx + sx * d1 / S, cy + sy * d1 / S, cx + sx * d0 / S, cy + sy * d0 / S, (u) => ({ w: 3, c: C[2], a: 0.3 * u }), a);      // Schein (gedithert)
    ppR1Band(g, cx + sx * d1 / S, cy + sy * d1 / S, cx + sx * d0 / S, cy + sy * d0 / S, (u) => (u < 0.08 ? null : { w: u > 0.9 ? 1 : 2, c: u > 0.7 ? C[2] : C[0], a: Math.min(1, u / 0.6) * 0.95 }), a);
  }
  const pu = (t - 230) / 500;
  if (pu >= 0 && pu <= 1) {
    const sc = K(pu, [[0, 0.3], [0.3, 1.2], [1, 1.7]], ppFx7Eo), a = K(pu, [[0, 0], [0.3, 0.9], [1, 0]], ppFx7Eo), r = 35 * sc / S;
    ppFx7Glow(g, cx, cy, r, r, [C[2], C[1], C[0]], a, 1.1);
  }
  for (const s of te.funken) {
    const u = (t - s.delay) / s.dur;
    if (u < 0 || u > 1) continue;
    const e = ppFx7Eo(u), n = Math.max(1, Math.round(s.size * (1 - e) / S));
    ppFx10Funke(g, cx + s.dx * e / S, cy + s.dy * e / S, n, s.farbe, n >= 2 ? C[2] : null, 1 - e);
  }
}, 900, { breite: 180, hoehe: 220, ankerX: 80, ankerY: 130 }, {
  z: 10100,
  vorbereiten: () => ({
    funken: Array.from({ length: ppFxN(14) }, () => {
      const w = Math.PI * (0.7 + Math.random() * 0.6), v = 18 + Math.random() * 32;
      return { dx: Math.cos(w) * v, dy: Math.sin(w) * v, size: 3 + Math.random() * 5, farbe: ppFx10Pick(PP_FX10_BLAU), delay: 220 + Math.random() * 80, dur: 360 + Math.random() * 200 };
    }),
  }),
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Time Bomblebee: Bomb Counter (`bomblebee_tick`) — leise: ein gelb-oranger Ring (28 px, 700 ms: .5 → 1,3 → 1,7, blendet aus) und sechs Funken, die je 70 ms versetzt 22 px nach außen
//  tickern (600 ms, schrumpfen auf 0). Kein Splitter, kein Knall.
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX10_TICK = ppFx10P(['#ffd066', '#f9ac20', '#fbe181', '#ffe469']);
const ppFx10BombTick = ppR1Leinwand((g, t, sz, te) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, C = PP_FX10_TICK, K = ppFx7Kf;
  const ru = t / 700;
  if (ru >= 0 && ru <= 1) {
    const sc = K(ru, [[0, 0.5], [0.4, 1.3], [1, 1.7]], ppFx7Eo), a = K(ru, [[0, 0], [0.4, 0.9], [1, 0]], ppFx7Eo), R = 14 * sc / S;
    g.ring(cx, cy, R, R + 1.6, C[1], a * 0.5);                  // Schein (gedithert) außen
    g.ring(cx, cy, Math.max(0, R - 1.4), R, C[0], a);            // Ring
    g.ring(cx, cy, Math.max(0, R - 2.4), Math.max(0, R - 1.4), C[2], a * 0.45);   // innerer Schein
  }
  for (const s of te.funken) {
    const u = (t - s.delay) / 600;
    if (u < 0 || u > 1) continue;
    const e = ppFx7Eo(u), sk = 0.6 * (1 - e), n = Math.max(1, Math.round(6 * sk / S + 0.4));
    ppFx10Funke(g, cx + Math.cos(s.w) * 22 * e / S, cy + Math.sin(s.w) * 22 * e / S, n, C[3], n >= 2 ? C[1] : null, 1 - e);
  }
}, 1000, { breite: 120, hoehe: 120 }, {
  z: 10100,
  vorbereiten: () => ({ funken: Array.from({ length: ppFxN(6) }, (_, i) => ({ w: (i / 6) * Math.PI * 2, delay: i * 70 + Math.random() * 40 })) }),
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Kaktus-Platzen (`cactus_burst`) — 16 Teilchen fliegen aus der Mitte (Winkel gleichmäßig + Streuung, 12–34 px, leicht nach oben gedriftet; 400–700 ms ab 0–100 ms): 40 % kleine Pixel-Kakteen
//  (statt 🌵), der Rest grüne Kügelchen. Hüllkurve wie `cactusPop`: .4 → 1,2 (20 %) → 1 (60 %) → .2, Deckung 0 → 1 → .8 → 0. Ebene 9999 wie vorher.
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX10_KAKTUS = ppFx10P(['#167927', '#20ac37', '#75f091']);
const PP_FX10_KUGEL = ppFx10P(['#5b9438', '#3ddc57', '#20ac37']);
function ppFx10Kaktus(g, cx, cy, gr, a) {          // gr = Höhe in Rasterpixeln
  const C = PP_FX10_KAKTUS;
  if (gr < 2.6) { g.block(cx - 0.5, cy - 1, 1, 2, C[1], a); return; }
  const gross = gr >= 6, H = gross ? 4 : 2;
  const fn = (i, j) => {
    if (Math.abs(i) <= (gross ? 1 : 0) && j >= -H && j <= H) return i === (gross ? -1 : 0) ? C[2] : C[1];
    if (gross) {
      if ((i === -3 && j >= -1 && j <= 1) || (i === -2 && j === 1)) return C[1];
      if ((i === 3 && j >= -2 && j <= 0) || (i === 2 && j === 0)) return C[1];
    } else if ((i === -1 && j === 0) || (i === 1 && j === -1)) return C[1];
    return null;
  };
  ppFx10Maske(g, cx, cy, 5, fn, C[0], a);
}
const ppFx10CactusBurst = ppR1Leinwand((g, t, sz, te) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, K = ppFx7Kf;
  for (const p of te.teile) {
    const u = (t - p.delay) / p.dur;
    if (u < 0 || u > 1) continue;
    // Hüllkurven wie `cactusPop` (die Keyframe-Prozente laufen über die ganze Dauer, die Beschleunigung wirkt je Abschnitt)
    const tp = K(u, [[0, 0], [0.2, 0.3], [0.6, 1], [1, 1.3]], ppFx7Eo), tpy = K(u, [[0, 0], [0.2, 0.3], [0.6, 1], [1, 1.2]], ppFx7Eo);
    const sc = K(u, [[0, 0.4], [0.2, 1.2], [0.6, 1], [1, 0.2]], ppFx7Eo), a = K(u, [[0, 0], [0.2, 1], [0.6, 0.8], [1, 0]], ppFx7Eo);
    const x = cx + p.tx * tp / S, y = cy + p.ty * tpy / S;
    if (p.kaktus) ppFx10Kaktus(g, x, y, (p.size + 4) * 1.15 * sc / S, a);
    else {
      const r = Math.max(0.6, p.size * sc / 2 / S);
      if (r < 1.2) g.put(x, y, p.farbe, a); else g.disc(x, y, r - 0.4, p.farbe, a);
    }
  }
}, 820, { breite: 190, hoehe: 190 }, {
  z: 9999,
  vorbereiten: () => ({
    teile: Array.from({ length: ppFxN(16) }, (_, i) => {
      const w = ((i / 16) * 360 + Math.random() * 22) * Math.PI / 180, dist = 12 + Math.random() * 22, drift = -8 - Math.random() * 15;
      return { tx: Math.cos(w) * dist, ty: Math.sin(w) * dist + drift, size: 6 + Math.random() * 8, delay: Math.random() * 100, dur: 400 + Math.random() * 300, kaktus: Math.random() < 0.4, farbe: ppFx10Pick(PP_FX10_KUGEL) };
    }),
  }),
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Cannibalism (`cannibalism_chomp`; Maos Fähigkeit) — grüner Heilschein (650 ms: .4 → 1,15 → 1,4 → 1,7), eine Pixel-Keule (statt 🍖) poppt auf (.3 → 1,2) und schrumpft in drei Bissen
//  (28/48/72 %), zwei weiße Biss-Sterne (bei 270 und 490 ms, je 250 ms) und grüne Heilzeichen (+ und ✦), die aufsteigen (Start 220–470 ms, 480–800 ms, vor dem Abräumen bei 1000 ms fertig).
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX10_MAO = ppFx10P(['#75f091', '#66ff71', '#3ddc57', '#b3f9b8', '#167927', '#20ac37']);
const PP_FX10_KEULE = { fleisch: ppHex('#9d612f'), hell: ppHex('#ca874e'), dunkel: ppHex('#7d3911'), knochen: ppHex('#f9ecb3'), schatten: ppHex('#e0c085'), rand: ppHex('#fbc86a') };
/** Keule (Fleisch oben rechts, Knochen mit Knorpelknubbeln nach links unten), Maß D = Breite in Rasterpixeln; Rand = harte gelbe Kontur wie die Kontur des alten Emoji. */
function ppFx10Keule(g, cx, cy, D, a) {
  if (D < 2.5) { g.block(cx - 1, cy - 1, 2, 2, PP_FX10_KEULE.fleisch, a); return; }
  const C = PP_FX10_KEULE, s2 = Math.SQRT1_2;
  const fn = (i, j) => {
    const x = i / D, y = j / D, u = (x - y) * s2, v = (x + y) * s2;
    const mu = (u - 0.2) / 0.38, mv = v / 0.3;
    if (mu * mu + mv * mv <= 1) return mv < -0.4 && mu > -0.5 ? C.hell : mv > 0.42 ? C.dunkel : C.fleisch;
    if (Math.abs(v) <= 0.075 && u >= -0.52 && u <= -0.1) return C.knochen;
    for (const q of [-1, 1]) { const du = u + 0.57, dv = v - q * 0.1; if (du * du + dv * dv <= 0.0121) return q < 0 ? C.knochen : C.schatten; }
    return null;
  };
  ppFx10Maske(g, cx, cy, Math.ceil(D * 0.72), fn, C.rand, a);
}
const ppFx10Cannibalism = ppR1Leinwand((g, t, sz, te) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, C = PP_FX10_MAO, K = ppFx7Kf;
  const fu = t / 650;
  if (fu >= 0 && fu <= 1) {
    const sc = K(fu, [[0, 0.4], [0.3, 1.15], [0.7, 1.4], [1, 1.7]], ppFx7Eo), a = K(fu, [[0, 0], [0.3, 0.9], [0.7, 0.55], [1, 0]], ppFx7Eo), r = 55 * sc / S;
    ppFx7Glow(g, cx, cy, r, r, [C[5], C[2], C[3]], a * 0.7, 1.2);
  }
  // Keule: 900 ms, cubic-bezier(.4,0,.55,1) je Abschnitt
  const mu = t / 900;
  if (mu >= 0 && mu <= 1) {
    const sc = K(mu, [[0, 0.3], [0.15, 1.2], [0.28, 1], [0.35, 0.85], [0.48, 0.85], [0.55, 0.65], [0.72, 0.65], [0.82, 0.4], [1, 0.15]], PP_FX10_BEZ_MEAT);
    const dy = K(mu, [[0, 0], [0.28, 0], [0.35, -1.3], [0.48, 0], [0.55, -1.3], [0.72, 0], [0.82, -2.6], [1, -6.4]], PP_FX10_BEZ_MEAT);
    const a = K(mu, [[0, 0], [0.15, 1], [0.82, 0.85], [1, 0]], PP_FX10_BEZ_MEAT);
    ppFx10Keule(g, cx, cy + dy / S, 19 * sc, a);
  }
  // Biss-Sterne
  [[270, -17, 5], [490, 25, 9]].forEach(([t0, bx, by]) => {
    const u = (t - t0) / 250;
    if (u < 0 || u > 1) return;
    const sc = K(u, [[0, 0.3], [0.4, 1.4], [1, 0.8]], ppFx7Eo), a = K(u, [[0, 0], [0.4, 1], [1, 0]], ppFx7Eo), n = Math.max(1, Math.round(4.2 * sc));
    ppFx10Stern(g, cx + (bx + 1) / S, cy + (by + 1) / S, n, PP_FX10_KEULE.rand, a * 0.8);   // gelber Schatten
    ppFx10Stern(g, cx + bx / S, cy + by / S, n, ppHex('#ffffff'), a);
  });
  // Heilzeichen
  for (const p of te.teile) {
    const u = (t - p.delay) / p.dur;
    if (u < 0 || u > 1) continue;
    const ty = K(u, [[0, 0], [0.2, -6], [0.85, p.endY * 0.85], [1, p.endY]], ppFx7Eo);
    const sc = K(u, [[0, 0.4], [0.2, 1], [0.85, 1], [1, 0.7]], ppFx7Eo), a = K(u, [[0, 0], [0.2, 1], [0.85, 0.9], [1, 0]], ppFx7Eo);
    const x = cx + (p.xOff + p.size * 0.3) / S, y = cy + (p.startY + p.size * 0.5 + ty) / S, n = Math.max(1, Math.round(p.size * sc / S * 0.9));
    if (p.stern) ppFx10Stern(g, x, y, n >= 3 ? 2 : 1, p.farbe, a);
    else { g.block(x - n, y, 2 * n + 1, 1, p.farbe, a); g.block(x, y - n, 1, 2 * n + 1, p.farbe, a); }
    if (n >= 2) g.put(x + n + 1, y + 1, C[4], a * 0.7);
  }
}, 1000, { breite: 300, hoehe: 300, ankerX: 150, ankerY: 170 }, {
  z: 10100,
  vorbereiten: () => ({
    teile: Array.from({ length: ppFxN(16) }, () => {
      const delay = 220 + Math.random() * 250;
      return { xOff: -52 + Math.random() * 104, startY: 18 + Math.random() * 22, endY: -68 - Math.random() * 70, size: 4 + Math.random() * 6, stern: Math.random() >= 0.55,
        farbe: ppFx10Pick(PP_FX10_MAO.slice(0, 4)), delay, dur: Math.min(480 + Math.random() * 320, 985 - delay) };
    }),
  }),
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Cavalry (`cavalry_charge`) — sechs galoppierende Pixel-Pferde (statt 🐎; Bildwechsel alle 90 ms) jagen quer durchs Ziel, von links nach rechts (Weg = 1,1 × Spanne, 520–640 ms, je 55 ms
//  versetzt, Hüpfer −6 px), dazu 22 Staubwolken in vier Sandtönen (gedithert, wachsen .4 → 2,2, driften nach links oben). Spanne = max(260, 3,2 × Breite): in der Support-Reihe
//  (Aufruf mit `duration: 1400`) läuft der Effekt entsprechend länger/breiter; das Ende folgt der Lebensdauer des Aufrufers.
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX10_PFERD = { o: ppHex('#7d3911'), b: ppHex('#ca874e'), l: ppHex('#e0c085'), m: ppHex('#5a341a') };
const PP_FX10_PFERD_BILD = [
  ['.......oo.', '......oblo', '.ooooobbbo', 'obbbbbbbo.', 'obbllbbbo.', '.oobbbboo.', '.o.o..o.o.', 'o.o....o.o'],
  ['.......oo.', '......oblo', '.mmmmobbbo', 'obbbbbbbo.', 'obbllbbbo.', '.oobbbboo.', '..oo..oo..', '..o....o..'],
];
const PP_FX10_STAUB = ppFx10P(['#e0c085', '#b29466', '#e0c085', '#886c44']);
const ppFx10Cavalry = ppFx4Leinwand((g, t, sz, te) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, span = te.span, K = ppFx7Kf;
  for (const d of te.staub) {
    const u = (t - d.delay) / d.dur;
    if (u < 0 || u > 1) continue;
    const e = ppFx7Eo(u), sc = 0.4 + 1.8 * e, a = 0.85 * (1 - e), r = d.size * sc / 2 / S;
    if (r < 0.7) g.put(cx + (d.xOff + d.size / 2 - 26 * e) / S, cy + (d.yOff + d.size / 2 - 22 * e) / S, d.farbe, a);
    else g.disc(cx + (d.xOff + d.size / 2 - 26 * e) / S, cy + (d.yOff + d.size / 2 - 22 * e) / S, r - 0.4, d.farbe, a);
  }
  for (const r of te.reiter) {
    const u = (t - r.delay) / r.dur;
    if (u < 0 || u > 1) continue;
    const tx = span * K(u, [[0, -0.55], [0.25, -0.28], [0.5, 0], [0.75, 0.28], [1, 0.55]]), ty = K(u, [[0, 0], [0.25, -6], [0.5, 0], [0.75, -6], [1, 0]]);
    const a = K(u, [[0, 0], [0.08, 1], [0.92, 1], [1, 0]]), frame = Math.floor(t / 90) % 2;
    g.spr(PP_FX10_PFERD_BILD[frame], PP_FX10_PFERD, cx + (tx + r.size * 0.55) / S, cy + (r.yOff + r.size * 0.6 + ty) / S, a);
  }
}, (p) => p.duration || 1000, (p) => {
  const w = p.w || 80, h = p.h || 110, span = Math.max(260, w * 3.2);
  const breite = span * 1.1 + 110, hoehe = 0.85 * h + 110;
  return { breite, hoehe, ankerX: breite / 2, ankerY: 0.35 * h + 40 };
}, {
  z: 10100,
  vorbereiten: (sz) => {
    const w = sz.props.w || 80, h = sz.props.h || 110, span = Math.max(260, w * 3.2), D = sz.props.duration || 1000;
    return {
      span,
      reiter: Array.from({ length: ppFxN(6) }, (_, i) => ({ yOff: -h * 0.35 + (i % 3) * (h * 0.32) + (Math.random() - 0.5) * 8, delay: i * 55 + Math.random() * 40, dur: 520 + Math.random() * 120, size: 22 + Math.random() * 8 })),
      staub: Array.from({ length: ppFxN(22) }, () => {
        const dur = 380 + Math.random() * 300;
        return { xOff: -span * 0.5 + Math.random() * span, yOff: h * 0.15 + Math.random() * h * 0.35, size: 6 + Math.random() * 12, dur,
          delay: 120 + Math.random() * Math.min(480, Math.max(60, D - 40 - 120 - dur)), farbe: ppFx10Pick(PP_FX10_STAUB) };
      }),
    };
  },
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Claw Maul (`claw_maul`; Deepsea Werewolf, Zombified Assault) — vier parallele Krallenstriche (Neigung −32°, versetzt −18/−6/6/18 px, Start 0/60/30/90 ms) rasen in 380 ms
//  von links unten nach rechts oben über das Ziel (cubic-bezier(.2,.9,.3,1)), jeder hinterlässt eine rote Wunde (580 ms ab Strich + 160 ms, wächst von der Mitte), dazu ein roter
//  Dunst (500 ms ab 250 ms: .3 → 1,5 → 2, gedithert) und 16 Blutstropfen, die nach unten fallen. Striche und Wunden sind Pixelketten (nicht gedreht).
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX10_KRALLE = ppFx10P(['#ffffff', '#e2d8cb', '#c0141c', '#8b0d0d', '#b5171c', '#520a0c', '#be0e0e', '#5b0102', '#fff8e8']);
const PP_FX10_KRALLEN = [{ offY: -18, delay: 0, thick: 3.5 }, { offY: -6, delay: 60, thick: 3 }, { offY: 6, delay: 30, thick: 3.5 }, { offY: 18, delay: 90, thick: 2.5 }];
const ppFx10ClawMaul = ppR1Leinwand((g, t, sz, te) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, C = PP_FX10_KRALLE, K = ppFx7Kf, p = sz.props;
  const ww = Math.max(p.w || 80, 80), len = te.len, ax = Math.cos(32 * Math.PI / 180), ay = -Math.sin(32 * Math.PI / 180);
  // Dunst (500 ms ab 250 ms)
  const hu = (t - 250) / 500;
  if (hu >= 0 && hu <= 1) {
    const sc = K(hu, [[0, 0.3], [0.5, 1.5], [1, 2]], ppFx7Eo), a = K(hu, [[0, 1], [0.5, 0.7], [1, 0]], ppFx7Eo), r = 55 * sc / S;
    ppFx7Glow(g, cx, cy, r, r, [C[7], C[6]], a * 0.5, 1);
  }
  for (const k of PP_FX10_KRALLEN) {
    const oy = cy + k.offY / S;
    // Wunde: 580 ms ab Strich + 160 ms, Länge wächst von der Mitte (scaleX 0 → 1 in 22 %)
    const wu = (t - k.delay - 160) / 580;
    if (wu >= 0 && wu <= 1) {
      const a = K(wu, [[0, 0], [0.22, 1], [0.75, 0.75], [1, 0]], ppFx7Eo), L = ww * 1.1 * K(wu, [[0, 0], [0.22, 1], [1, 1]], ppFx7Eo) / S;
      ppR1Band(g, cx - ax * L / 2, oy - ay * L / 2, cx + ax * L / 2, oy + ay * L / 2, (u) => { const m = 1 - Math.abs(u - 0.5) * 2; return m < 0.06 ? null : { w: 3, c: C[3], a: 0.55 * Math.min(1, m / 0.36) }; }, a);
      ppR1Band(g, cx - ax * L / 2, oy - ay * L / 2, cx + ax * L / 2, oy + ay * L / 2, (u) => { const m = 1 - Math.abs(u - 0.5) * 2; return m < 0.12 ? null : { w: 1, c: m > 0.6 ? C[2] : C[3], a: Math.min(1, m / 0.36) }; }, a);
    }
    // Strich: 380 ms, Mitte wandert von −1,2 bis +1,2 Strichlängen entlang der Neigung
    const su = (t - k.delay) / 380;
    if (su >= 0 && su <= 1) {
      const s = -1.2 + 2.4 * PP_FX10_BEZ_KRALLE(su), a = K(su, [[0, 0], [0.25, 1], [1, 0]], PP_FX10_BEZ_KRALLE);
      const mx = cx + ax * s * len / S, my = oy + ay * s * len / S, L = len / S;
      const form = (w, c, f) => (u) => {      // u = 0 … 1 entlang des Strichs; Helligkeit wie der CSS-Verlauf (Spitze bei 50 %)
        const al = u < 0.2 ? 0.1 * (u / 0.2) : u < 0.48 ? 0.1 + 0.85 * ((u - 0.2) / 0.28) : u < 0.52 ? 1 : u < 0.7 ? 1 - 0.3 * ((u - 0.52) / 0.18) : 0.7 * (1 - (u - 0.7) / 0.3);
        return al < 0.05 ? null : { w, c: c(u), a: al * f };
      };
      ppR1Band(g, mx - ax * L / 2, my - ay * L / 2, mx + ax * L / 2, my + ay * L / 2, form(3, () => C[4], 0.4), a);     // roter Schein (gedithert)
      ppR1Band(g, mx - ax * L / 2, my - ay * L / 2, mx + ax * L / 2, my + ay * L / 2, form(1, (u) => (u > 0.45 && u < 0.58 ? C[0] : u > 0.58 ? C[1] : C[8]), 1), a);
    }
  }
  for (const d of te.blut) {
    const u = (t - d.delay) / d.dur;
    if (u < 0 || u > 1) continue;
    const e = u * u, a = K(u, [[0, 0], [0.18, 1], [1, 0]]), n = Math.max(1, Math.round(d.size / S));
    g.block(cx + (d.dx - 4 * e + d.size / 2) / S - n / 2, cy + (-4 + d.dy * e + d.size / 2) / S - n / 2, n, n, d.farbe, a);
  }
}, 1000, (p) => {
  const ww = Math.max(p.w || 80, 80), hh = Math.max(p.h || 110, 110), len = Math.hypot(ww, hh) * 1.55;
  return { breite: len * 3 + 60, hoehe: len * 1.9 + 60 };
}, {
  z: 10100,
  vorbereiten: (sz) => {
    const ww = Math.max(sz.props.w || 80, 80), hh = Math.max(sz.props.h || 110, 110);
    return {
      len: Math.hypot(ww, hh) * 1.55,
      blut: Array.from({ length: ppFxN(16) }, () => {
        const delay = 180 + Math.random() * 220;
        return { dx: -30 + Math.random() * 60, dy: 8 + Math.random() * 55, delay, dur: Math.min(420 + Math.random() * 220, 995 - delay), size: 3 + Math.random() * 5, farbe: Math.random() < 0.7 ? PP_FX10_KRALLE[4] : PP_FX10_KRALLE[5] };
      }),
    };
  },
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Cloud in a Bottle / Cloud Pillow: Wolke sammelt sich (`cloud_gather`) und löst sich auf (`cloud_disperse`) — Pixel-Wolken (statt ☁).
//  gather: 16 kleine Wolken (14–32 px) fliegen aus 60–110 px Abstand zur Mitte (500–800 ms ab 0–300 ms, schrumpfen .6 → .3, Deckung bis .8 → .4), ab 600 ms (400 ms) poppt die
//  große Mitte-Wolke auf (.3 → 1,15 → 1) und bleibt bis zum Abräumen; am Ende blendet sie gedithert aus. disperse: die Mitte-Wolke schrumpft in 350 ms (1 → 1,1 → .4, blendet aus),
//  18 kleine Wolken stieben ab 250–450 ms (400–700 ms) 50–110 px nach außen (.8 → .3, blenden aus); alles vor dem Abräumen bei 1000 ms fertig.
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const ppFx10CloudGather = ppR1Leinwand((g, t, sz, te) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, K = ppFx7Kf;
  for (const p of te.puffs) {
    const u = (t - p.delay) / p.dur;
    if (u < 0 || u > 1) continue;
    const e = ppFx7Ei(u), sc = 0.6 - 0.3 * e, a = K(u, [[0, 0], [0.2, 0.8], [1, 0.4]], ppFx7Ei);
    ppFx10Wolke(g, cx + p.sx * (1 - e) / S + p.size * 0.5 / S, cy + p.sy * (1 - e) / S + p.size * 0.5 / S, p.size * 1.0 * sc / S * 1.4, a);
  }
  const u = (t - 600) / 400;
  if (u >= 0) {
    const sc = u > 1 ? 1 : K(u, [[0, 0.3], [0.6, 1.15], [1, 1]], ppFx7Eo), a = (u > 1 ? 0.9 : K(u, [[0, 0], [0.6, 1], [1, 0.9]], ppFx7Eo)) * (t > 880 ? Math.max(0, 1 - (t - 880) / 110) : 1);
    ppFx10Wolke(g, cx, cy, 15 * sc, a);
  }
}, 1000, { breite: 330, hoehe: 330 }, {
  z: 10100,
  vorbereiten: () => ({
    puffs: Array.from({ length: ppFxN(16) }, () => {
      const w = Math.random() * Math.PI * 2, d = 60 + Math.random() * 50, delay = Math.random() * 300;
      return { sx: Math.cos(w) * d, sy: Math.sin(w) * d, size: 14 + Math.random() * 18, delay, dur: Math.min(500 + Math.random() * 300, 985 - delay) };
    }),
  }),
});
const ppFx10CloudDisperse = ppR1Leinwand((g, t, sz, te) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, K = ppFx7Kf;
  const cu = t / 350;
  if (cu >= 0 && cu <= 1) ppFx10Wolke(g, cx, cy, 15 * K(cu, [[0, 1], [0.4, 1.1], [1, 0.4]], ppFx7Ei), K(cu, [[0, 0.9], [0.4, 0.7], [1, 0]], ppFx7Ei));
  for (const p of te.puffs) {
    const u = (t - p.delay) / p.dur;
    if (u < 0 || u > 1) continue;
    const e = ppFx7Eo(u), sc = 0.8 - 0.5 * e, a = K(u, [[0, 0.9], [0.7, 0.6], [1, 0]], ppFx7Eo);
    ppFx10Wolke(g, cx + (p.ex * e + p.size * 0.5) / S, cy + (p.ey * e + p.size * 0.5) / S, p.size * sc / S * 1.4, a);
  }
}, 1000, { breite: 300, hoehe: 300 }, {
  z: 10100,
  vorbereiten: () => ({
    puffs: Array.from({ length: ppFxN(18) }, () => {
      const w = Math.random() * Math.PI * 2, d = 50 + Math.random() * 60, delay = 250 + Math.random() * 200;
      return { ex: Math.cos(w) * d, ey: Math.sin(w) * d, size: 10 + Math.random() * 14, delay, dur: Math.min(400 + Math.random() * 300, 985 - delay) };
    }),
  }),
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Elixir of Cold (`cold_strike_apply`) — blaue Aura über der Karte (950 ms: .7 → 1 → 1,15, Dither-Schein in Kartenform, ohne Weichzeichner), ein Eisring wächst von 6 px auf 1,2 × Breite
//  (800 ms, blendet linear aus) und 14 Pixel-Schneeflocken (statt ❄❅❆✦; nicht gedreht) steigen auf (700–1050 ms ab 0–280 ms, vor dem Abräumen bei 1000 ms fertig, driften seitlich).
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX10_EIS = ppFx10P(['#4e77ca', '#66b6ff', '#77c8ee', '#b4dff8', '#68c6fd', '#e5edfa', '#b4cff8', '#ffffff']);
const PP_FX10_FLOCKE = {
  gross: ['..b.b..', '.bwbwb.', 'bwwwwwb', '.bwwwb.', 'bwwwwwb', '.bwbwb.', '..b.b..'],
  mittel: ['b.w.b', '.www.', 'wwwww', '.www.', 'b.w.b'],
  klein: ['.w.', 'www', '.w.'],
  stern: ['..w..', '.bwb.', 'wwwww', '.bwb.', '..w..'],
};
const PP_FX10_FLOCKE_FARBE = { w: ppHex('#e5edfa'), b: ppHex('#68c6fd') };
const ppFx10ColdStrike = ppR1Leinwand((g, t, sz, te) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, C = PP_FX10_EIS, K = ppFx7Kf, cw = sz.props.w || 100, ch = sz.props.h || 140;
  const au = t / 950;
  if (au >= 0 && au <= 1) {
    const sc = K(au, [[0, 0.7], [0.35, 1], [1, 1.15]], ppFx7Eo), a = K(au, [[0, 0], [0.35, 0.95], [1, 0]], ppFx7Eo);
    ppFx7Glow(g, cx, cy, cw * 0.55 * sc / S, ch * 0.55 * sc / S, [C[0], C[1], C[2]], a * 0.8, 0.8);
  }
  const ru = t / 800;
  if (ru >= 0 && ru <= 1) {
    const R = (3 + (cw * 0.6 - 3) * ppFx7Eo(ru)) / S, a = 0.9 * (1 - ru);
    g.ring(cx, cy, R, R + 1.8, C[4], a * 0.4);                       // Schein außen (gedithert)
    g.ring(cx, cy, Math.max(0, R - 1), R, C[3], a);
  }
  for (const f of te.flocken) {
    const u = (t - f.delay) / f.dur;
    if (u < 0 || u > 1) continue;
    const px = K(u, [[0, 0], [0.25, 0.3], [1, 1]], ppFx7Eo), py = K(u, [[0, 0], [0.25, 0.25], [1, 1]], ppFx7Eo);
    const sc = K(u, [[0, 0.5], [0.25, 1], [1, 0.6]], ppFx7Eo), a = K(u, [[0, 0], [0.25, 1], [1, 0]], ppFx7Eo), gr = f.size * sc * 0.9 / S;
    const x = cx + (f.sx + f.drift * px + f.size * 0.45) / S, y = cy + (f.sy + f.rise * py + f.size * 0.5) / S;
    g.spr(gr >= 5.2 ? (f.stern ? PP_FX10_FLOCKE.stern : PP_FX10_FLOCKE.gross) : gr >= 3.4 ? (f.stern ? PP_FX10_FLOCKE.klein : PP_FX10_FLOCKE.mittel) : PP_FX10_FLOCKE.klein, PP_FX10_FLOCKE_FARBE, x, y, a);
  }
}, 1000, (p) => {
  const cw = p.w || 100, ch = p.h || 140;
  return { breite: 2 * Math.max(cw * 0.7, 100), hoehe: 2 * Math.max(ch * 0.66, 140) };
}, {
  z: 10100,
  vorbereiten: () => ({
    flocken: Array.from({ length: ppFxN(14) }, () => {
      const w = Math.random() * Math.PI * 2, d = 30 + Math.random() * 25, delay = Math.random() * 280;
      return { sx: Math.cos(w) * d, sy: Math.sin(w) * d * 0.7, rise: -(20 + Math.random() * 50), drift: (Math.random() - 0.5) * 30, size: 12 + Math.random() * 12, delay,
        dur: Math.min(700 + Math.random() * 350, 990 - delay), stern: Math.random() < 0.25 };
    }),
  }),
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Cosmic Depths: Zähler +1 (`cosmic_counter_add`) — violetter Blitz (36 px, 600 ms: .3 → 1,3 → 1,7, Dither-Schein) und zehn helle Funken, die im Kreis 28 px nach außen schrumpfen
//  (700 ms ab 0–80 ms).  Token-Fall (`cosmic_token_drop`) — ein flaches violettes Portal (60 × 14 px, 800 ms: breit .2 → 1,1 → 1,3 → .6) öffnet sich, ab 200 ms fällt eine Pixelkugel
//  (Ø 18 px, 700 ms, beschleunigt, −10 → 15 → 35 px) hindurch und blendet aus.
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX10_KOSMOS = ppFx10P(['#702db3', '#b866ff', '#d6b3f9', '#d6bbf1', '#50008c', '#7e41ba', '#d9c0ec', '#1a0a3a']);
const ppFx10CosmicCounterAdd = ppR1Leinwand((g, t, sz, te) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, C = PP_FX10_KOSMOS, K = ppFx7Kf;
  const fu = t / 600;
  if (fu >= 0 && fu <= 1) {
    const sc = K(fu, [[0, 0.3], [0.4, 1.3], [1, 1.7]], ppFx7Eo), a = K(fu, [[0, 0], [0.4, 1], [1, 0]], ppFx7Eo), r = 18 * sc / S;
    g.ring(cx, cy, r, r + 1.6, C[1], a * 0.45);                                  // äußerer Schein (gedithert)
    ppFx7Glow(g, cx, cy, r, r, [C[0], C[1], C[2]], a * 0.95, 0.9);
  }
  for (const s of te.funken) {
    const u = (t - s.delay) / 700;
    if (u < 0 || u > 1) continue;
    const e = ppFx7Eo(u), n = Math.max(1, Math.round(s.size * (0.6 * (1 - e)) / S + 0.4));
    ppFx10Funke(g, cx + Math.cos(s.w) * 28 * e / S, cy + Math.sin(s.w) * 28 * e / S, n, C[3], n >= 2 ? C[1] : null, 1 - e);
  }
}, 800, { breite: 130, hoehe: 130 }, {
  z: 10100,
  vorbereiten: () => ({ funken: Array.from({ length: ppFxN(10) }, (_, i) => ({ w: (i / 10) * Math.PI * 2, size: 4 + Math.random() * 3, delay: Math.random() * 80 })) }),
});
const ppFx10CosmicTokenDrop = ppR1Leinwand((g, t, sz) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, C = PP_FX10_KOSMOS, K = ppFx7Kf;
  const pu = t / 800;
  if (pu >= 0 && pu <= 1) {
    const sx = K(pu, [[0, 0.2], [0.3, 1.1], [0.8, 1.3], [1, 0.6]], ppFx7Eo), sy = K(pu, [[0, 0.4], [0.3, 0.7], [0.8, 0.9], [1, 0.4]], ppFx7Eo), a = K(pu, [[0, 0], [0.3, 1], [0.8, 1], [1, 0]], ppFx7Eo);
    const px = 30 * sx / S, py = Math.max(1.2, 7 * sy / S), mx = cx, my = cy - 23 / S;
    g.ellRing(mx, my, px + 1.5, py + 1.2, 1, C[1], a * 0.5);                    // Schein (gedithert)
    ppFx7Glow(g, mx, my, px, py, [C[4], C[5], C[1]], a * 0.95, 0.7);
    g.ellRing(mx, my, px, py, 1, C[1], a);
  }
  const ku = (t - 200) / 700;
  if (ku >= 0 && ku <= 1) {
    const ty = K(ku, [[0, -10], [0.3, 15], [1, 35]], PP_FX10_BEZ_TOKEN), sc = K(ku, [[0, 0.6], [0.3, 1], [1, 0.85]], PP_FX10_BEZ_TOKEN), a = K(ku, [[0, 0], [0.3, 1], [1, 0]], PP_FX10_BEZ_TOKEN);
    const r = Math.max(1.5, 9 * sc / S), x = cx, y = cy + (-16 + ty) / S;
    g.ring(x, y, r, r + 1.2, C[1], a * 0.5);
    g.disc(x, y, r, C[7], a);
    g.disc(x, y, Math.max(0.8, r - 1), C[5], a);
    g.disc(x - r * 0.3, y - r * 0.3, Math.max(0.6, r * 0.4), C[6], a);
  }
}, 900, { breite: 150, hoehe: 150 }, { z: 10100 });

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Creature Death (`creature_death`; Kreatur geht in den Ablagestapel/wird gelöscht, Anker = Kartenmitte, Lebensdauer 1200 ms) — ein weiß-roter Aufblitz (700 ms: .3 → 1,8 → 1,2 → 2,5,
//  Dither-Kugel), 14 Seelenpunkte steigen blau-weiß auf (600–1100 ms ab 0–200 ms, 40–100 px hoch, schrumpfen auf .3) und 18 rote Funken stieben nach außen (400–800 ms ab 50–200 ms).
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX10_TOD = { seele: ppFx10P(['#ffffff', '#b4cff8', '#6d9bf8', '#b3d8f9', '#e5edfa']), funke: ppFx10P(['#f03232', '#ff6666', '#f9b3b3', '#ec7f79', '#b5171c']), blitz: ppFx10P(['#ec7f79', '#f9b3b3', '#ffffff']) };
const ppFx10CreatureDeath = ppR1Leinwand((g, t, sz, te) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, K = ppFx7Kf, C = PP_FX10_TOD;
  const fu = t / 700;
  if (fu >= 0 && fu <= 1) {
    const sc = K(fu, [[0, 0.3], [0.3, 1.8], [0.6, 1.2], [1, 2.5]], ppFx7Eo), a = K(fu, [[0, 1], [0.3, 0.9], [0.6, 0.4], [1, 0]], ppFx7Eo), r = 40 * sc / S;
    ppFx7Glow(g, cx, cy, r, r, C.blitz, a * 0.95, 1.5);
  }
  for (const s of te.seelen) {
    const u = (t - s.delay) / s.dur;
    if (u < 0 || u > 1) continue;
    const e = ppFx7Eo(u), sc = 1 - 0.7 * e, a = K(u, [[0, 0.9], [0.3, 1], [1, 0]], ppFx7Eo), n = Math.max(1, Math.round(s.size * sc / S + 0.3));
    ppFx10Funke(g, cx + s.dx * e / S, cy + s.dy * e / S, n, s.farbe, n >= 2 ? C.seele[3] : null, a);
  }
  for (const s of te.funken) {
    const u = (t - s.delay) / s.dur;
    if (u < 0 || u > 1) continue;
    const e = ppFx7Eo(u), n = Math.max(1, Math.round(s.size * 1.3 * (1 - e) / S + 0.3));
    g.block(cx + s.dx * e / S - n / 2, cy + s.dy * e / S - n / 2, n, n, s.farbe, 1 - e);
  }
}, 1190, { breite: 270, hoehe: 270 }, {
  z: 10100,
  vorbereiten: () => ({
    seelen: Array.from({ length: ppFxN(14) }, () => {
      const delay = Math.random() * 200;
      return { dx: -20 + Math.random() * 40, dy: -(40 + Math.random() * 60), size: 4 + Math.random() * 6, farbe: ppFx10Pick(PP_FX10_TOD.seele), delay, dur: Math.min(600 + Math.random() * 500, 1170 - delay) };
    }),
    funken: Array.from({ length: ppFxN(18) }, () => {
      const w = Math.random() * Math.PI * 2, v = 15 + Math.random() * 40;
      return { dx: Math.cos(w) * v, dy: Math.sin(w) * v, size: 2 + Math.random() * 4, farbe: ppFx10Pick(PP_FX10_TOD.funke), delay: 50 + Math.random() * 150, dur: 400 + Math.random() * 400 };
    }),
  }),
});

ppFxUeberschreiben('bomblebee_dive', ppFx10BombDive);
ppFxUeberschreiben('bomblebee_tick', ppFx10BombTick);
ppFxUeberschreiben('cactus_burst', ppFx10CactusBurst);
ppFxUeberschreiben('cannibalism_chomp', ppFx10Cannibalism);
ppFxUeberschreiben('cavalry_charge', ppFx10Cavalry);
ppFxUeberschreiben('claw_maul', ppFx10ClawMaul);
ppFxUeberschreiben('cloud_gather', ppFx10CloudGather);
ppFxUeberschreiben('cloud_disperse', ppFx10CloudDisperse);
ppFxUeberschreiben('cold_strike_apply', ppFx10ColdStrike);
ppFxUeberschreiben('cosmic_counter_add', ppFx10CosmicCounterAdd);
ppFxUeberschreiben('cosmic_token_drop', ppFx10CosmicTokenDrop);
ppFxUeberschreiben('creature_death', ppFx10CreatureDeath);
