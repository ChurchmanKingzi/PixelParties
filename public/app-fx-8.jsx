// Pixelart-Portierungen (Canvas statt vieler CSS-animierter DOM-Elemente), Batch 8: siehe app-fx-0.jsx. Jede Portierung: `ppFxUeberschreiben('typ', Komponente)`.
//   thicket_cover · time_rewind · trex_chomp · venom_fog · victorica_holy_cleanse · weapon_absorption · weapon_storm · weapon_unleashing · whirlpool
// Gemeinsame Bausteine tragen das Präfix `ppFx8` / `PP_FX8_` (die Dateien teilen sich den globalen Namensraum).
// Alle Effekte laufen in der Standard-Lebensdauer von 1000 ms (`onZoneAnim` → `playAnimation`, kein `duration` vom Server): Anfangszeiten bleiben wie in den DOM-Fassungen, die Enden sind auf ~1000 ms gerafft
// (die DOM-Fassungen wurden nach 1000 ms hart abgeschnitten, einzelne Teilchen liefen noch).

// ── Bausteine ────────────────────────────────────────────────────────────────
/** Keyframes: `st` = [[Anteil 0..1, Wert], …]; `e` = Easing je Abschnitt (wie `animation-timing-function` je Keyframe-Intervall). */
function ppFx8Kf(q, st, e) {
  if (q <= st[0][0]) return st[0][1];
  for (let i = 1; i < st.length; i++) {
    if (q <= st[i][0]) {
      const a = st[i - 1], b = st[i];
      let u = (q - a[0]) / ((b[0] - a[0]) || 1);
      if (e) u = e(u);
      return a[1] + (b[1] - a[1]) * u;
    }
  }
  return st[st.length - 1][1];
}
const ppFx8Ein = (u) => u * u;
const ppFx8Aus = (u) => 1 - (1 - u) * (1 - u);
const ppFx8Aus3 = (u) => 1 - Math.pow(1 - u, 3);
/** Dauer so kürzen, dass Anfang + Dauer in die Lebensdauer (≈1000 ms) passt. */
const ppFx8Kap = (delay, dur, ende = 985) => Math.max(140, Math.min(dur, ende - delay));
/** Kreislinie (oder Bogen w0..w1, Bogenmaß) als lückenlose Pixelkette, `dicke` Rasterpixel nach innen. */
function ppFx8Kreis(g, cx, cy, R, dicke, c, a = 1, w0 = 0, w1 = Math.PI * 2) {
  if (R < 0.6) { g.put(cx, cy, c, a); return; }
  const n = Math.ceil((w1 - w0) * R * 1.7) + 1;
  for (let k = 0; k <= n; k++) {
    const th = w0 + (w1 - w0) * k / n, co = Math.cos(th), si = Math.sin(th);
    for (let d = 0; d < dicke; d++) g.put(cx + co * (R - d), cy + si * (R - d), c, a);
  }
}
/** Gestrichelte Kreislinie: abwechselnd `strich` lange Bögen (Rasterpixel) an/aus. */
function ppFx8KreisStrich(g, cx, cy, R, c, a, strich, versatz = 0) {
  if (R < 1) return;
  const n = Math.ceil(2 * Math.PI * R * 1.7) + 1;
  for (let k = 0; k <= n; k++) {
    const th = (k / n) * Math.PI * 2, laenge = th * R;
    if (Math.floor((laenge + versatz) / strich) % 2 !== 0) continue;
    g.put(cx + Math.cos(th) * R, cy + Math.sin(th) * R, c, a);
  }
}
/** Farbe zwischen zwei Stufen (Keyframes `st` = [[v, [r,g,b]], …]) per Bayer-Dithering wählen. */
function ppFx8Stufe(st, v, X, Y) {
  if (v <= st[0][0]) return st[0][1];
  for (let i = 1; i < st.length; i++) {
    if (v <= st[i][0]) { const f = (v - st[i - 1][0]) / ((st[i][0] - st[i - 1][0]) || 1); return f > ppBayer(X, Y) ? st[i][1] : st[i - 1][1]; }
  }
  return st[st.length - 1][1];
}
/** Pixelschrift 3×5 mit Umriss und Schrägstellung (kursiv): Mitte (cx, cy), `m` = Pixel je Schriftpunkt. */
function ppFx8Schrift(g, text, cx, cy, m, c, rand, a = 1) {
  m = Math.max(1, Math.round(m));
  const txt = String(text).toUpperCase(), breite = txt.length * 4 * m - m, hoch = 5 * m;
  const x0 = Math.round(cx - breite / 2), y0 = Math.round(cy - hoch / 2);
  const zeichne = (dx, dy, farbe) => {
    let px = x0 + dx;
    for (const ch of txt) {
      const mm = PP_R1_SCHRIFT[ch] || PP_R1_SCHRIFT[' '];
      for (let j = 0; j < 5; j++) {
        const schr = Math.round((2 - j) * m * 0.3);
        for (let i = 0; i < 3; i++) if (mm[j * 3 + i] === '1') g.block(px + i * m + schr, y0 + j * m + dy, m, m, farbe, a);
      }
      px += 4 * m;
    }
  };
  for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [-1, 0], [1, 0], [0, -1], [0, 1]]) zeichne(dx, dy, rand);
  zeichne(0, 0, c);
}

// ═════════════════════════════════════════════════════════════════
//  Venom Fog (`venom_fog`; Venom Infusion) — PIXELART. Wie vorher: eine grüne Giftwolke aus bis zu 20 weichen Ballen (30–70 px), die nacheinander (alle 40 ms, mit Streuung) aus der Zonenmitte
//  aufquellen (Größe .3 → 1 → 1,3), leicht auseinander- und aufwärtsdriften und ausblenden. Jetzt: Dither-Kugeln (Schein, Körper, helle Mitte oben links) statt Weichzeichner.
// ═════════════════════════════════════════════════════════════════
const PP_FX8_GIFT = ['#167927', '#20ac37', '#3ddc57'].map(ppHex);
const ppFx8VenomFog = ppR1Leinwand((g, t, sz, teile) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, C = PP_FX8_GIFT;
  for (const p of teile) {
    const q = (t - p.delay) / p.dur;
    if (q < 0 || q > 1) continue;
    const x = cx + ppFx8Kf(q, [[0, 0], [0.5, p.dx], [1, p.dx * 1.5]], ppR1Weich) / S;
    const y = cy + ppFx8Kf(q, [[0, 10], [0.5, p.dy], [1, p.dy * 1.5 - 20]], ppR1Weich) / S;
    const sc = ppFx8Kf(q, [[0, 0.3], [0.5, 1], [1, 1.3]], ppR1Weich);
    const a = ppFx8Kf(q, [[0, 0], [0.2, p.op], [0.5, p.op], [1, 0]]);
    const r = p.size * sc / 2 / S;
    if (a <= 0.02 || r < 0.5) continue;
    const d = Math.min(1, a * 1.3);
    g.glow(x, y, r * 1.5, r * 1.5, [C[0]], d * 0.4, 1.4);                         // Schein
    g.glow(x, y, r, r, [C[0], C[1]], d, 0.55);                                     // Körper
    g.glow(x - r * 0.25, y - r * 0.25, r * 0.6, r * 0.6, [C[2]], d, 0.6);         // helle Mitte
  }
}, 1000, { breite: 240, hoehe: 240 }, {
  z: 10100,
  vorbereiten: () => {
    const n = ppFxN(20);
    return Array.from({ length: n }, (_, i) => {
      const delay = (i / n) * 600 + Math.random() * 70;
      return { dx: -30 + Math.random() * 60, dy: -20 + Math.random() * 40, size: 30 + Math.random() * 40, delay, dur: ppFx8Kap(delay, 800 + Math.random() * 600), op: 0.4 + Math.random() * 0.4 };
    });
  },
});

// ═════════════════════════════════════════════════════════════════
//  Whirlpool (`whirlpool`; Aquatic Arrows/Spear, Silent Water Mizune, Venom …) — PIXELART. Wie vorher: neun blaue Ringe (Halbmesser 20 + 16·i px, versetzt um je 60 ms) ziehen sich aus 1,8-facher Größe
//  strudelnd zur Mitte zusammen (Größe 1,8 → 1,2 → .55 → 0, Deckung 0 → 1 → 0), 24 Wassertropfen sausen von außen nach innen, in der Mitte eine Welle. Vorher große gedrehte/skalierte Kreise mit
//  Weichzeichner-Schein; jetzt Pixelketten, die Drehung zeigt ein heller Bogen auf jedem Ring (statt gedrehter Kreise), der Tropfenweg biegt sich leicht (Strudel); 🌊 → gezeichnete Wellenbänder.
// ═════════════════════════════════════════════════════════════════
const PP_FX8_WASSER = { ring: ppHex('#399edf'), schein: ppHex('#1ca9fd'), hell: ppHex('#b6eff7'), tropfen: ppHex('#66b6ff'), kern: ppHex('#b6eff7'), welle: ['#b6eff7', '#68c6fd', '#399edf', '#2f539d'].map(ppHex), weiss: ppHex('#e5f5fa') };
/** Wellenbänder (Ersatz für 🌊): drei geschwungene Streifen, Breite 2·W Rasterpixel, Phase = Zeit. */
function ppFx8Welle(g, cx, cy, W, ph, a) {
  const C = PP_FX8_WASSER.welle;
  const amp = Math.max(1, W * 0.22), band = Math.max(1, Math.round(W * 0.18));
  for (let b = 0; b < 3; b++) {
    for (let i = -Math.round(W); i <= Math.round(W); i++) {
      const u = i / W, huell = Math.sqrt(Math.max(0, 1 - u * u * 0.85));
      const y = cy + (b - 1) * W * 0.5 + Math.sin(u * 4.2 + ph + b * 0.9) * amp * huell;
      for (let d = 0; d < band; d++) g.put(cx + i, y + d - band / 2, d === 0 && b === 0 ? PP_FX8_WASSER.weiss : C[Math.min(b + (d > 0 ? 1 : 0), 3)], a);
    }
  }
}
const ppFx8Whirlpool = ppR1Leinwand((g, t, sz, teile) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, W = PP_FX8_WASSER;
  teile.ringe.forEach((r) => {
    const q = (t - r.delay) / r.dur;
    if (q < 0 || q > 1) return;
    const sc = ppFx8Kf(q, [[0, 1.8], [0.2, 1.2], [0.55, 0.55], [1, 0.03]], ppFx8Ein);
    const op = Math.min(1, ppFx8Kf(q, [[0, 0], [0.2, 1], [0.55, 0.9], [1, 0]], ppFx8Ein) * r.op * 1.3);
    const R = r.radius * sc / S;
    if (op <= 0.03 || R < 0.8) return;
    const dick = Math.max(1, Math.round(r.breite / S));
    ppFx8Kreis(g, cx, cy, R + 1.4, 2, W.schein, op * 0.3);                    // Schein (außen)
    ppFx8Kreis(g, cx, cy, R, dick, W.ring, op);
    const ph = ppFx8Kf(q, [[0, 0], [0.2, Math.PI], [0.55, 3 * Math.PI], [1, 6 * Math.PI]]) * r.richtung;   // Drehung: heller Bogen läuft um den Ring
    ppFx8Kreis(g, cx, cy, R, dick, W.hell, op, ph, ph + 1.3);
    ppFx8Kreis(g, cx, cy, R, dick, W.hell, op * 0.8, ph + Math.PI, ph + Math.PI + 0.6);
  });
  teile.tropfen.forEach((d) => {
    const q = (t - d.delay) / d.dur;
    if (q < 0 || q > 1) return;
    const lauf = ppFx8Kf(q, [[0, 0], [0.4, 0.4], [1, 1]], ppFx8Ein);          // Anteil des Wegs zur Mitte
    const rad = d.dist * (1 - 0.9 * lauf), ang = d.angle + 1.1 * lauf;
    const sc = ppFx8Kf(q, [[0, 1], [0.4, 0.8], [1, 0.05]], ppFx8Ein), a = ppFx8Kf(q, [[0, 0.9], [0.4, 0.8], [1, 0]], ppFx8Ein);
    const r = d.size * sc / 2 / S;
    if (a <= 0.05 || r < 0.35) return;
    const x = cx + Math.cos(ang) * rad / S, y = cy + Math.sin(ang) * rad / S;
    g.disc(x, y, r, W.tropfen, a);
    if (r > 1.4) g.put(x - 0.5, y - 0.5, W.kern, a);
  });
  // Welle in der Mitte (50–950 ms): Größe .6 → 1,8 → 1 → .1, Deckung 0 → 1 → .8 → 0
  const wq = (t - 50) / 900;
  if (wq >= 0 && wq <= 1) {
    const sc = ppFx8Kf(wq, [[0, 0.6], [0.2, 1.8], [0.55, 1], [1, 0.1]], ppFx8Ein), a = ppFx8Kf(wq, [[0, 0], [0.2, 1], [0.55, 0.8], [1, 0]], ppFx8Ein);
    if (a > 0.04) ppFx8Welle(g, cx, cy, 20 * sc / S, t / 90, a);
  }
}, 1000, { breite: 560, hoehe: 560 }, {
  z: 9999,
  vorbereiten: () => {
    const n = ppFxN(9), nd = ppFxN(24);
    const ringe = Array.from({ length: n }, (_, i) => {
      const f = n > 1 ? i / (n - 1) : 0, delay = f * 480;
      return { radius: 20 + f * 128, delay, dur: ppFx8Kap(delay, 900 - f * 320), op: 1 - f * 0.64, breite: 4 - f * 2, richtung: i % 2 ? -1 : 1 };
    });
    const tropfen = Array.from({ length: nd }, (_, i) => {
      const delay = Math.random() * 300;
      return { angle: (i / nd) * Math.PI * 2 + Math.random() * 0.26, dist: 35 + Math.random() * 55, delay, dur: ppFx8Kap(delay, 700 + Math.random() * 300), size: 5 + Math.random() * 8 };
    });
    return { ringe, tropfen };
  },
});

// ═════════════════════════════════════════════════════════════════
//  Time Rewind (`time_rewind`; Rewrite History) — PIXELART. Wie vorher: zwei Ringe (einer gestrichelt, 160 ms später) laufen in 700 ms aus 2,2-facher Größe nach innen, dazwischen erscheint eine
//  Uhr (900 ms; Größe .4 → 1 → 1,25) mit Gold-Rand, deren Zeiger sich schnell RÜCKWÄRTS drehen (Minutenzeiger 3 Umdrehungen, Stundenzeiger 3/4 in 800 ms). Zeiger als Pixellinien.
// ═════════════════════════════════════════════════════════════════
const PP_FX8_ZEIT = { gold: ppHex('#e0c085'), tief: ppHex('#d1a148'), hell: ppHex('#f7e0b5'), zeiger: ppHex('#5a3c14'), fuell: ['#fbc86a', '#fff196', '#fffbd2'].map(ppHex) };
const ppFx8TimeRewind = ppR1Leinwand((g, t, sz) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, C = PP_FX8_ZEIT;
  [[0, false], [160, true]].forEach(([d, strich]) => {
    const q = (t - d) / 700;
    if (q < 0 || q > 1) return;
    const R = 60 * (2.2 - 1.9 * ppFx8Ein(q)) / S, a = ppFx8Kf(q, [[0, 0], [0.25, 0.9], [1, 0]]);
    if (a < 0.04) return;
    if (strich) ppFx8KreisStrich(g, cx, cy, R, C.hell, a, 2.4);
    else { ppFx8Kreis(g, cx, cy, R + 1.5, 2, C.tief, a * 0.3); ppFx8Kreis(g, cx, cy, R, 1, C.gold, a); }
  });
  const q = t / 900;
  if (q <= 1) {
    const sc = ppFx8Kf(q, [[0, 0.4], [0.2, 1], [0.8, 1], [1, 1.25]], ppFx8Aus), a = ppFx8Kf(q, [[0, 0], [0.2, 1], [0.8, 1], [1, 0]]);
    const R = 34 * sc / S;
    if (a > 0.03) {
      ppFx8Kreis(g, cx, cy, R + 2.2, 2, C.gold, a * 0.3);                               // Schein um den Rand
      g.glow(cx, cy, R, R, C.fuell, a, 0.4);                                      // Zifferblatt (Creme in der Mitte, Gold außen)
      ppFx8Kreis(g, cx, cy, R, 1, C.tief, a);
      ppFx8Kreis(g, cx, cy, R - 1, 1, C.tief, a * 0.6);
      for (let k = 0; k < 4; k++) { const w = k * Math.PI / 2; g.put(cx + Math.sin(w) * (R - 2.6), cy - Math.cos(w) * (R - 2.6), C.tief, a); }   // 12/3/6/9
      const hq = ppR1Klemme(t / 800);
      const minute = -1080 * Math.PI / 180 * ppR1Weich(hq), stunde = -270 * Math.PI / 180 * ppR1Weich(hq);
      const Lm = 26 * sc / S, Ls = 18 * sc / S;
      g.line(cx, cy, cx + Math.sin(minute) * Lm, cy - Math.cos(minute) * Lm, C.zeiger, a, 1);
      g.line(cx, cy, cx + Math.sin(stunde) * Ls, cy - Math.cos(stunde) * Ls, C.zeiger, a, 2);
      g.put(cx, cy, C.zeiger, a);
    }
  }
}, 1000, { breite: 300, hoehe: 300 }, { z: 10100 });

// ═════════════════════════════════════════════════════════════════
//  Victorica, Holy Cleanse (`victorica_holy_cleanse`) — PIXELART. Wie vorher: goldweißer Kern (900 ms; Größe .2 → 1,2 → 1 → 1,5) mit Schein, ein Heiligenschein in Kartengröße (1000 ms), Lichtstrahlen
//  (850 ms, wachsen von der Mitte, Länge 144 px) und 14 Lichtfunken, die nach oben aufsteigen. HINWEIS: in der DOM-Fassung überschrieb die Keyframe-Drehung die Strahl-Drehung, alle vier Strahlen
//  standen senkrecht aufeinander; hier sind es – wie im Kommentar gemeint – ein senkrechter und ein waagerechter Strahl (Kreuz).
// ═════════════════════════════════════════════════════════════════
const PP_FX8_LICHT = { kern: ['#ffd066', '#fff196', '#fffbd2'].map(ppHex), halo: ['#fbe181', '#fffbd2'].map(ppHex), strahl: ppHex('#fffbd2'), strahlSchein: ppHex('#f9ecb3'), funke: ppHex('#fff8e8'), funkenSchein: ppHex('#f9ecb3') };
const ppFx8VictoricaCleanse = ppR1Leinwand((g, t, sz, teile) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, C = PP_FX8_LICHT;
  // Heiligenschein (1000 ms): Größe .5 → 1,05 → 1,35, Deckung 0 → .9 → 0
  let q = t / 1000;
  if (q <= 1) {
    const sc = ppFx8Kf(q, [[0, 0.5], [0.45, 1.05], [1, 1.35]], ppFx8Aus), a = ppFx8Kf(q, [[0, 0], [0.45, 0.9], [1, 0]]) * 0.6;
    g.glow(cx, cy, teile.cw / 2 * sc * 1.1 / S, teile.ch / 2 * sc * 1.1 / S, C.halo, a, 0.9);
  }
  // Kern (900 ms)
  q = t / 900;
  if (q <= 1) {
    const sc = ppFx8Kf(q, [[0, 0.2], [0.35, 1.2], [0.65, 1], [1, 1.5]], ppFx8Aus), a = ppFx8Kf(q, [[0, 0], [0.35, 1], [0.65, 1], [1, 0]]);
    const R = 44 * sc / S;
    g.glow(cx, cy, R * 1.55, R * 1.55, [C.kern[0]], a * 0.35, 1.5);                    // Schein
    g.glow(cx, cy, R, R, C.kern, a * 0.9, 0.9);
  }
  // Strahlen: senkrecht und waagerecht, wachsen aus der Mitte (850 ms ab 0–80 ms)
  teile.strahlen.forEach((s) => {
    const k = (t - s.delay) / 850;
    if (k < 0 || k > 1) return;
    const sy = ppFx8Kf(k, [[0, 0.2], [0.4, 1.1], [1, 1.4]], ppFx8Aus), a = ppFx8Kf(k, [[0, 0], [0.4, 1], [1, 0]]);
    if (a < 0.04) return;
    const L = 72 * sy / S, dx = s.waagerecht ? 1 : 0, dy = s.waagerecht ? 0 : 1;
    const form = (w, farbe, aa) => (u) => { const e = 2 * u - 1, ab = Math.abs(e), p = (e + 1) / 2, f = p < 0.4 ? p / 0.4 : p < 0.6 ? 1 : (1 - p) / 0.4; return f > 0.02 ? { w, c: farbe, a: f * aa } : null; };
    ppR1Band(g, cx - dx * L, cy - dy * L, cx + dx * L, cy + dy * L, form(5, C.strahlSchein, 0.35), a);
    ppR1Band(g, cx - dx * L, cy - dy * L, cx + dx * L, cy + dy * L, form(2.4, C.strahl, 0.95), a);
  });
  // Lichtfunken
  teile.funken.forEach((m) => {
    const k = (t - m.delay) / m.dur;
    if (k < 0 || k > 1) return;
    const lauf = ppFx8Kf(k, [[0, 0], [0.35, 0.4], [1, 1]], ppFx8Aus), sc = ppFx8Kf(k, [[0, 0.3], [0.35, 1], [1, 0.3]]), a = ppFx8Kf(k, [[0, 0], [0.35, 1], [1, 0]]);
    const x = cx + m.dx * lauf / S, y = cy + m.dy * lauf / S, r = Math.max(0.5, m.size * sc / 2 / S);
    if (a < 0.05) return;
    g.disc(x, y, r + 1, C.funkenSchein, a * 0.4);
    g.disc(x, y, r, C.funke, a);
  });
}, 1000, (p) => { const m = Math.max(260, (p.w || 100) * 1.7 + 30, (p.h || 140) * 1.7 + 30); return { breite: m, hoehe: m }; }, {
  z: 10110,
  vorbereiten: (sz) => ({
    cw: sz.props.w || 100, ch: sz.props.h || 140,
    strahlen: [{ waagerecht: false, delay: Math.random() * 80 }, { waagerecht: true, delay: Math.random() * 80 }],
    funken: Array.from({ length: ppFxN(14) }, () => { const w = -Math.PI / 2 + (Math.random() - 0.5) * 1.6, d = 20 + Math.random() * 55, delay = Math.random() * 300; return { dx: Math.cos(w) * d, dy: Math.sin(w) * d, size: 3 + Math.random() * 4, delay, dur: ppFx8Kap(delay, 700 + Math.random() * 300) }; }),
  }),
});

// ═════════════════════════════════════════════════════════════════
//  Thicket Cover (`thicket_cover`; Thicket) — PIXELART. Wie vorher: ein dichtes Dickicht – 34 Blätter, Halme, Kleeblätter und Bäumchen schlagen von einer Ellipse (Halbmesser 46–72 px) zur Mitte
//  zusammen (Größe .35 → 1,15), halten als Wand und sinken ab. Statt Emojis gezeichnete Pixelblätter in drei Grüntönen (Blatt, Spross, Klee, Baum, Gras); Drehung als Wechsel der Blattrichtung
//  in 45°-Schritten. Die Laufzeiten sind (wie die DOM-Fassung bei 1000 ms abgeschnitten) auf ~1000 ms gerafft.
// ═════════════════════════════════════════════════════════════════
const PP_FX8_LAUB = [['#167927', '#20ac37', '#3ddc57'], ['#2f4e1d', '#5b9438', '#80bf59'], ['#18300a', '#2ca058', '#66ffa2']].map(s => s.map(ppHex));
const PP_FX8_STAMM = ppHex('#7d3911'), PP_FX8_AEHRE = ppHex('#fad54a');
/** Ein Pflanzenteil. kind 0 Blatt (Linse, Richtung `dir` 0–3), 1 Spross, 2 Klee, 3 Bäumchen, 4 Gras. `r` = Halbmesser (Raster). */
function ppFx8Pflanze(g, x, y, r, kind, dir, C, a) {
  x = Math.round(x); y = Math.round(y);
  if (r < 1.2) { g.put(x, y, C[1], a); return; }
  if (kind === 0) {
    const R = Math.ceil(r + 1), b = Math.max(0.7, r * 0.45), k = Math.SQRT1_2;
    for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) {
      let u, v;
      if (dir === 0) { u = -j; v = i; } else if (dir === 1) { u = (i - j) * k; v = (i + j) * k; } else if (dir === 2) { u = i; v = j; } else { u = (i + j) * k; v = (j - i) * k; }
      const d = (u / (r + 0.4)) ** 2 + (v / b) ** 2;
      if (d > 1) continue;
      g.put(x + i, y + j, Math.abs(v) < 0.55 ? C[2] : d > 0.62 ? C[0] : C[1], a);
    }
  } else if (kind === 1) {
    g.line(x, y + r, x, y - r * 0.2, C[0], a, 1);
    g.ell(x - r * 0.55, y - r * 0.45, r * 0.55, r * 0.32, C[1], a);
    g.ell(x + r * 0.55, y - r * 0.45, r * 0.55, r * 0.32, C[2], a);
  } else if (kind === 2) {
    const o = r * 0.5, rr = Math.max(1, r * 0.5);
    for (const [dx, dy] of [[-o, 0], [o, 0], [0, -o], [0, o]]) { g.disc(x + dx, y + dy, rr, C[1], a); g.put(x + dx, y + dy, C[2], a); }
    g.put(x, y, C[0], a);
  } else if (kind === 3) {
    g.block(x - 0.5, y + r * 0.35, Math.max(1, Math.round(r * 0.3)), Math.max(1, Math.round(r * 0.6)), PP_FX8_STAMM, a);
    g.disc(x, y - r * 0.2, r * 0.8, C[0], a);
    g.disc(x - r * 0.15, y - r * 0.3, r * 0.5, C[1], a);
    g.put(x - r * 0.3, y - r * 0.45, C[2], a);
  } else {
    g.line(x, y + r, x, y - r * 0.6, C[1], a, 1);
    for (let k = 0; k < 3; k++) { const yy = y - r * 0.6 + k * r * 0.45; g.put(x - 1, yy, PP_FX8_AEHRE, a); g.put(x + 1, yy - 0.5, PP_FX8_AEHRE, a); }
  }
}
const ppFx8Thicket = ppR1Leinwand((g, t, sz, teile) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy;
  for (const l of teile) {
    const q = (t - l.delay) / l.dur;
    if (q < 0 || q > 1) continue;
    const e = ppFx8Aus3;
    const x = ppFx8Kf(q, [[0, l.sx], [0.45, l.dx], [1, l.dx]], e);
    const y = ppFx8Kf(q, [[0, l.sy], [0.45, l.dy], [0.78, l.dy + 3], [1, l.dy + 10]], e);
    const sc = ppFx8Kf(q, [[0, 0.35], [0.45, 1.15], [0.78, 1.05], [1, 0.95]], e);
    const a = ppFx8Kf(q, [[0, 0], [0.18, 1], [0.78, 1], [1, 0]]);
    if (a < 0.05) continue;
    ppFx8Pflanze(g, cx + x / S, cy + y / S, l.size * sc / 2 / S, l.kind, q < 0.45 ? l.dir0 : l.dir1, l.farben, a);
  }
}, 1000, { breite: 280, hoehe: 240 }, {
  z: 10100,
  vorbereiten: () => {
    const n = ppFxN(34), arten = [0, 1, 2, 0, 4, 3, 2];
    return Array.from({ length: n }, (_, i) => {
      const w = (i / n) * Math.PI * 2 + Math.random() * 0.35, weite = 46 + Math.random() * 26, delay = (i / n) * 330 + Math.random() * 50;
      return {
        sx: Math.cos(w) * weite, sy: Math.sin(w) * weite * 0.72,
        dx: Math.cos(w) * (6 + Math.random() * 12), dy: Math.sin(w) * (4 + Math.random() * 9) + 6,
        delay, dur: ppFx8Kap(delay, 900 + Math.random() * 500),
        kind: arten[Math.floor(Math.random() * 7)], size: 15 + Math.random() * 16,
        dir0: Math.floor(Math.random() * 4), dir1: Math.floor(Math.random() * 4), farben: PP_FX8_LAUB[Math.floor(Math.random() * 3)],
      };
    });
  },
});

// ═════════════════════════════════════════════════════════════════
//  Explosion für `weapon_storm` — PIXELART. Gleicher Ablauf wie `ExplosionEffect` (app-board.jsx): weißer Kern (300 ms), Druckwelle (460 ms ab 40 ms), Feuerball (500 ms), 38 Splitter in sieben Farben,
//  8 Trümmer (fliegen hoch und fallen), 12 Glutfunken, 7 Rauchballen. Die Rauch-/Glut-Laufzeiten sind auf ~1000 ms gerafft.
// ═════════════════════════════════════════════════════════════════
const PP_FX8_KNALL = {
  splitter: ['#ff491a', '#ff8b1a', '#fad54a', '#ff1a1a', '#f9ac20', '#ffffff', '#fbe181'].map(ppHex),
  brocken: ['#68332a', '#7d3911', '#323232', '#b62600'].map(ppHex),
  glut: ['#ffe469', '#f9ac20', '#ff7d00'].map(ppHex),
  rauch: ['#59606e', '#3e3e51'].map(ppHex),
  ball: ['#ff7d00', '#f9ac20', '#fad54a'].map(ppHex), kern: ['#fad54a', '#f9ecb3', '#ffffff'].map(ppHex), welle: ppHex('#f9ac20'), wellenSchein: ppHex('#ff7d00'),
};
const ppFx8Explosion = ppR1Leinwand((g, t, sz, teile) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, K = PP_FX8_KNALL;
  for (const r of teile.rauch) {
    const q = (t - r.delay) / r.dur;
    if (q < 0 || q > 1) continue;
    const e = ppFx8Aus(q), a = ppFx8Kf(q, [[0, 0], [0.3, 0.9], [1, 0]]), R = r.size * (0.4 + 1.1 * e) / 2 / S;
    g.glow(cx + r.dx * e / S, cy + r.dy * e / S, R, R, [r.ton], a, 0.7);
  }
  let q = t / 500;
  if (q >= 0 && q <= 1) {                                                   // Feuerball
    const sc = ppFx8Kf(q, [[0, 0.2], [0.4, 1.6], [1, 2.2]], ppFx8Aus), a = ppFx8Kf(q, [[0, 1], [0.4, 0.8], [1, 0]]), R = 45 * sc / S;
    g.glow(cx, cy, R, R, K.ball, a, 0.8);
  }
  q = (t - 40) / 460;
  if (q >= 0 && q <= 1) {                                                   // Druckwelle
    const R = 32 * (0.25 + 2.35 * ppFx8Aus(q)) / S, a = ppFx8Kf(q, [[0, 1], [0.7, 0.9], [1, 0]]);
    ppFx8Kreis(g, cx, cy, R + 1.5, 2, K.wellenSchein, a * 0.35);
    ppFx8Kreis(g, cx, cy, R, 2, K.welle, a);
  }
  q = t / 300;
  if (q >= 0 && q <= 1) {                                                   // Kern
    const sc = ppFx8Kf(q, [[0, 0.2], [0.45, 1.35], [1, 1.6]], ppFx8Aus), a = ppFx8Kf(q, [[0, 1], [0.45, 1], [1, 0]]), R = 28 * sc / S;
    g.glow(cx, cy, R, R, K.kern, a, 0.6);
  }
  for (const p of teile.splitter) {
    const k = (t - p.delay) / p.dur;
    if (k < 0 || k > 1) continue;
    const e = ppFx8Aus(k), a = ppFx8Kf(k, [[0, 1], [0.2, 1], [1, 0]]), r = p.size * (1.2 * (1 - k)) / 2 / S;
    if (a < 0.05 || r < 0.35) continue;
    g.disc(cx + p.dx * e / S, cy + p.dy * e / S, r, p.farbe, a);
  }
  for (const b of teile.brocken) {
    const k = (t - b.delay) / b.dur;
    if (k < 0 || k > 1) continue;
    const e = (u) => 1 - Math.pow(1 - u, 2.4);
    const x = ppFx8Kf(k, [[0, 0], [0.55, b.dx], [1, b.dx * 1.3]], e), y = ppFx8Kf(k, [[0, 0], [0.55, b.dy], [1, b.dy * 0.2 + 40]], e), a = ppFx8Kf(k, [[0, 1], [0.55, 1], [1, 0]]);
    const s = Math.max(1, Math.round(b.size / S));
    if (a < 0.05) continue;
    g.block(cx + x / S - s / 2, cy + y / S - s / 2, s, s, b.farbe, a);
  }
  for (const f of teile.glut) {
    const k = (t - f.delay) / f.dur;
    if (k < 0 || k > 1) continue;
    const e = ppFx8Aus(k), a = ppFx8Kf(k, [[0, 1], [0.7, 1], [1, 0]]);
    if (a < 0.05) continue;
    g.block(cx + f.dx * e / S, cy + f.dy * e / S, Math.max(1, Math.round(f.size / S)), Math.max(1, Math.round(f.size / S)), f.farbe, a);
  }
}, 1000, { breite: 300, hoehe: 300 }, {
  z: 10100,
  vorbereiten: () => {
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    return {
      splitter: Array.from({ length: ppFxN(38) }, () => { const w = Math.random() * Math.PI * 2, v = 30 + Math.random() * 75, delay = Math.random() * 80; return { dx: Math.cos(w) * v, dy: Math.sin(w) * v, size: 4 + Math.random() * 9, farbe: pick(PP_FX8_KNALL.splitter), delay, dur: ppFx8Kap(delay, 380 + Math.random() * 420) }; }),
      brocken: Array.from({ length: ppFxN(8) }, () => { const w = -Math.PI * (0.15 + Math.random() * 0.7), v = 45 + Math.random() * 45, delay = 40 + Math.random() * 60; return { dx: Math.cos(w) * v, dy: Math.sin(w) * v, size: 6 + Math.random() * 6, farbe: pick(PP_FX8_KNALL.brocken), delay, dur: ppFx8Kap(delay, 620 + Math.random() * 200) }; }),
      glut: Array.from({ length: ppFxN(12) }, () => { const delay = 220 + Math.random() * 180; return { dx: -34 + Math.random() * 68, dy: -(30 + Math.random() * 45), size: 3 + Math.random() * 3, farbe: pick(PP_FX8_KNALL.glut), delay, dur: ppFx8Kap(delay, 450 + Math.random() * 250) }; }),
      rauch: Array.from({ length: ppFxN(7) }, (_, i) => { const delay = 180 + i * 35; return { dx: -26 + Math.random() * 52, dy: -(22 + Math.random() * 30), size: 30 + Math.random() * 22, ton: pick(PP_FX8_KNALL.rauch), delay, dur: ppFx8Kap(delay, 560 + Math.random() * 160) }; }),
    };
  },
});

// ═════════════════════════════════════════════════════════════════
//  Sog-Kuppel für `weapon_absorption` (🌀) und `weapon_unleashing` (💥) — PIXELART. Gleicher Ablauf wie `idej_projection_absorb`: grüne Holo-Kuppel (880 ms, Größe .18 → 1,18 → 1,3, mit Scanlinien),
//  Blitz (340 ms), drei Ringe (je 110 ms später, 900 ms, Größe .12 → 1,5), dazu ein Zeichen in der Mitte (Emoji → gezeichnet: Wirbel bzw. Knall-Stern). Ring-Laufzeiten auf ~1000 ms gerafft.
// ═════════════════════════════════════════════════════════════════
const PP_FX8_SOG = { dome: ['#2ca058', '#4ceb70', '#b3f9cf'].map(ppHex), rand: ppHex('#b3f9cf'), scan: ppHex('#b3f9b8'), ring: ppHex('#66ffa2'), ringSchein: ppHex('#4ceb70'), blitz: ['#68fdc1', '#e5fae7'].map(ppHex), zeichen: ['#b3f9cf', '#66ffa2', '#ffffff'].map(ppHex), umriss: ppHex('#167927'), stern: ['#ff491a', '#ff8b1a', '#fad54a', '#fffbd2'].map(ppHex) };
/** Wirbel (🌀): zwei Spiralarme (weiß mit dunkelgrünem Umriss, damit er sich von der hellen Kuppel abhebt), drehen sich. R = Halbmesser (Raster). */
function ppFx8Wirbel(g, cx, cy, R, ph, a) {
  const Z = PP_FX8_SOG.zeichen, N = Math.ceil(R * 6), dick = R > 6 ? 2 : 1;
  for (const [farbe, dd] of [[PP_FX8_SOG.umriss, dick + 2], [Z[2], dick]]) {
    for (let arm = 0; arm < 2; arm++) for (let s = 0; s <= N; s++) {
      const f = s / N, th = f * 5.2 + ph + arm * Math.PI, r = R * (0.12 + 0.88 * f);
      g.block(cx + Math.cos(th) * r - dd / 2 + 0.5, cy + Math.sin(th) * r - dd / 2 + 0.5, dd, dd, farbe, a);
    }
  }
}
/** Knall-Stern (💥): achtzackig, innen hell, außen rot. */
function ppFx8Stern(g, cx, cy, R, a) {
  const C = PP_FX8_SOG.stern, Rc = Math.ceil(R) + 1;
  for (let j = -Rc; j <= Rc; j++) for (let i = -Rc; i <= Rc; i++) {
    const d = Math.hypot(i, j), th = Math.atan2(j, i), rr = R * (0.5 + 0.5 * Math.pow(Math.abs(Math.cos(4 * th)), 1.4));
    if (d > rr) continue;
    const f = d / rr;
    g.put(cx + i, cy + j, f < 0.3 ? C[3] : f < 0.55 ? C[2] : f < 0.82 ? C[1] : C[0], a);
  }
}
function ppFx8SogKuppel(zeichen) {
  return ppR1Leinwand((g, t, sz, teile) => {
    const S = sz.S, cx = sz.cx, cy = sz.cy, C = PP_FX8_SOG, base = teile.base;
    // Ringe (außen)
    teile.ringe.forEach((r) => {
      const q = (t - r.delay) / r.dur;
      if (q < 0 || q > 1) return;
      const R = r.durch / 2 * (0.12 + 1.38 * ppFx8Aus(q)) / S, a = ppFx8Kf(q, [[0, 0], [0.18, 0.95], [1, 0]]);
      if (a < 0.04) return;
      ppFx8Kreis(g, cx, cy, R + 1.5, 2, C.ringSchein, a * 0.35);
      ppFx8Kreis(g, cx, cy, R, 1, C.ring, a);
    });
    // Blitz (340 ms)
    let q = t / 340;
    if (q >= 0 && q <= 1) {
      const sc = ppFx8Kf(q, [[0, 0.3], [0.35, 1], [1, 1.35]], ppFx8Aus), a = ppFx8Kf(q, [[0, 0], [0.35, 1], [1, 0]]), R = base * 1.1 * sc / S;
      g.glow(cx, cy, R, R, C.blitz, a * 0.9, 0.9);
    }
    // Kuppel (880 ms)
    q = t / 880;
    if (q >= 0 && q <= 1) {
      const sc = ppFx8Kf(q, [[0, 0.18], [0.22, 1.18], [0.5, 0.98], [1, 1.3]], ppFx8Aus), a = ppFx8Kf(q, [[0, 0], [0.22, 1], [0.5, 1], [1, 0]]), R = base * 0.95 * sc / S;
      if (a > 0.03 && R > 1) {
        g.glow(cx, cy, R * 1.12, R * 1.12, [C.dome[0]], a * 0.35, 1.6);          // Schein
        g.glow(cx, cy, R, R, C.dome, a * 0.9, 0.7);
        const Rc = Math.ceil(R);
        for (let j = -Rc; j <= Rc; j += 2) {                                      // Scanlinien
          const hw = Math.floor(Math.sqrt(Math.max(0, R * R - j * j)));
          for (let i = -hw; i <= hw; i++) g.put(cx + i, cy + j, C.scan, a * 0.28);
        }
        ppFx8Kreis(g, cx, cy, R, 1, C.rand, a * 0.95);
      }
    }
    // Zeichen (880 ms): Größe .3 → 1,15 → 1 → 1,1, Deckung 0 → 1 → 1 → 0
    if (q >= 0 && q <= 1) {
      const sc = ppFx8Kf(q, [[0, 0.3], [0.28, 1.15], [0.6, 1], [1, 1.1]], ppFx8Aus), a = ppFx8Kf(q, [[0, 0], [0.28, 1], [0.6, 1], [1, 0]]);
      const R = 21 * sc / S, y = cy + ppFx8Kf(q, [[0, 4 / S], [0.28, 0]], ppFx8Aus);
      if (a > 0.05) { if (zeichen === 'wirbel') ppFx8Wirbel(g, cx, y, R, -t / 160, a); else ppFx8Stern(g, cx, y, R, a); }
    }
  }, 1000, (p) => { const b = Math.max(p.w || 72, 60), m = b * 2.25 + 30; return { breite: m * 2, hoehe: m * 2 }; }, {
    z: 10130,
    vorbereiten: (sz) => {
      const base = Math.max(sz.props.w || 72, 60);
      return { base, ringe: [1.7, 2.3, 2.9].map((f, i) => { const delay = i * 110; return { durch: base * f, delay, dur: ppFx8Kap(delay, 900) }; }) };
    },
  });
}

// ═════════════════════════════════════════════════════════════════
//  Biss für `trex_chomp` (T-Rex-Gebiss, Foresta the Guard) — PIXELART. Gleicher Ablauf wie `dino_bite` (hier mit `damage` 500 und `gore: true`): Ober- und Unterkiefer fallen aus 260 px herein und
//  schnappen bei 608 ms zu (kurzes Nachfedern), dazu Zahnreihen, Einschlagblitz (460 ms), 59 Blutspritzer, 9 Tropfen und der Schriftzug „DEVOUR!" (Pixelschrift, kursiv). Die Zähne von Ober- und
//  Unterkiefer greifen versetzt ineinander. Laufzeit: Einschlag unverändert bei 608 ms (der Schaden kommt 620 ms nach dem Sendezeitpunkt), danach Spritzer/Schrift/Tropfen auf ~1000 ms gerafft und die
//  Kiefer ziehen sich ab 880 ms zurueck (die DOM-Fassung wurde bei 1000 ms hart abgeschnitten).
// ═════════════════════════════════════════════════════════════════
const PP_FX8_BISS = {
  haut: { normal: [[0, '#3a5a25'], [0.35, '#2f4e1d'], [0.8, '#18300a'], [1, '#0f2412']], gore: [[0, '#18300a'], [0.35, '#18300a'], [0.8, '#0f2412'], [1, '#141414']] },
  rand: ppHex('#0a1a04'), glanz: { normal: ppHex('#80bf59'), gore: ppHex('#3a5a25') },
  zahn: ['#ffffff', '#fff8e8', '#ccb799'].map(ppHex),
  blut: { gore: ['#270d0c', '#5b0102', '#be0e0e'].map(ppHex), normal: ['#3a0000', '#780000', '#c80000'].map(ppHex) },
  tropfen: ['#520a0c', '#8b0d0d'].map(ppHex),
  blitz: { gore: ['#5b0102', '#8b0d0d', '#c80000'].map(ppHex), normal: ['#b62600', '#ff491a', '#ff8b1a'].map(ppHex) },
  schrift: { gore: [ppHex('#f0bfbc'), ppHex('#270d0c')], normal: [ppHex('#f9ecb3'), ppHex('#270d0c')] },
};
for (const k of ['normal', 'gore']) PP_FX8_BISS.haut[k] = PP_FX8_BISS.haut[k].map(([v, h]) => [v, ppHex(h)]);
function ppFx8BissWerte(p) {
  const goreP = p.gore === undefined || p.gore === null ? true : p.gore, gl = goreP === true ? 1 : Math.max(0, Math.min(1, +goreP || 0));
  const t = Math.max(0, Math.min(1, (((p.damage === undefined || p.damage === null ? 500 : p.damage) || 50) - 50) / 350)), lerp = (a, b) => a + (b - a) * t, gs = 1 + gl * 0.18;
  return {
    gl, t, lerp, gs, jawW: lerp(80, 230) * gs, jawH: lerp(20, 38) * gs, toothW: lerp(8, 16) * (1 + gl * 0.1), toothH: lerp(10, 24) * gs, zaehne: Math.round(lerp(5, 9) + gl * 2),
    fall: lerp(90, 260), spritzer: Math.round(lerp(12, 32) * (1 + gl * 0.85)), anim: lerp(900, 1600),
  };
}
/** Kiefer (gefüllte Rundung mit Verlauf, Rand, Glanz). Oberkante y0, Mitte cx, Breite W, Höhe H in Raster; `oben`: große Ecken oben. */
function ppFx8Kiefer(g, cx, y0, W, H, oben, gore, a) {
  const x0 = Math.round(cx - W / 2), Y0 = Math.round(y0), rt = Math.min(Math.round(H * 0.55), Math.floor(H / 2)), rb = 3;
  const rO = oben ? rt : rb, rU = oben ? rb : rt, st = PP_FX8_BISS.haut[gore ? 'gore' : 'normal'];
  const test = (i, j, px, py, r) => (i + 0.5 - px) ** 2 + (j + 0.5 - py) ** 2 <= r * r;
  const drin = (i, j) => {
    if (i < 0 || j < 0 || i >= W || j >= H) return false;
    const fx = i + 0.5, fy = j + 0.5;
    if (fy < rO && fx < rO) return test(i, j, rO, rO, rO);
    if (fy < rO && fx > W - rO) return test(i, j, W - rO, rO, rO);
    if (fy > H - rU && fx < rU) return test(i, j, rU, H - rU, rU);
    if (fy > H - rU && fx > W - rU) return test(i, j, W - rU, H - rU, rU);
    return true;
  };
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    if (!drin(i, j)) continue;
    const X = x0 + i, Y = Y0 + j, rd = !drin(i - 1, j) || !drin(i + 1, j) || !drin(i, j - 1) || !drin(i, j + 1);
    if (rd) { g.put(X, Y, PP_FX8_BISS.rand, a); continue; }
    const v = oben ? j / (H - 1) : (H - 1 - j) / (H - 1);
    g.put(X, Y, ppFx8Stufe(st, v, X, Y), a);
    if ((oben && j === 1) || (!oben && j === H - 2)) g.put(X, Y, PP_FX8_BISS.glanz[gore ? 'gore' : 'normal'], a * 0.3);
  }
}
/** Zahn (Dreieck): Basis bei yBasis, Spitze nach unten (`abwaerts`) oder oben. */
function ppFx8Zahn(g, cx, yBasis, breit, hoch, abwaerts, a) {
  const Z = PP_FX8_BISS.zahn;
  for (let k = 0; k < hoch; k++) {
    const hw = breit / 2 * (1 - k / hoch), y = abwaerts ? yBasis + k : yBasis - k, farbe = k / hoch < 0.35 ? Z[0] : k / hoch < 0.7 ? Z[1] : Z[2];
    for (let i = Math.round(cx - hw); i <= Math.round(cx + hw - 0.01); i++) g.put(i, y, farbe, a);
  }
}
const ppFx8Chomp = ppR1Leinwand((g, t, sz, teile) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, w = teile.w, gore = w.gl > 0, B = PP_FX8_BISS;
  const q = t / w.anim, rueck = ppR1Klemme((t - 880) / 120);                       // Rückzug ab 880 ms (gerafft)
  const a = (q < 0.08 ? q / 0.08 : 1) * (1 - rueck);
  const dy = ppFx8Kf(q, [[0, -w.fall], [0.38, 0], [0.44, 3], [0.52, 0]], (u) => Math.pow(u, 1.8)) + (rueck > 0 ? -w.fall * 0.4 * ppFx8Ein(rueck) : 0);
  const W = Math.round(w.jawW / S), H = Math.max(6, Math.round(w.jawH / S)), th = Math.max(3, Math.round(w.toothH / S)), tw = Math.max(3, Math.round(w.toothW / S));
  const yO = cy + (-w.jawH - w.toothH * 0.4 + dy) / S, yU = cy + (w.toothH * 0.4 - dy) / S;
  if (a > 0.03) {
    ppFx8Kiefer(g, cx, yO, W, H, true, gore, a);
    ppFx8Kiefer(g, cx, yU, W, H, false, gore, a);
    // Zähne: oben hängen sie von der Unterkante des Oberkiefers, unten ragen sie aus dem Unterkiefer; versetzt, damit sie ineinander greifen
    const n = teile.zaehne.length;
    teile.zaehne.forEach((z, i) => {
      const x = cx - W / 2 + z.x * W;
      ppFx8Zahn(g, x, yO + H - 1, tw, Math.max(3, Math.round(th * z.mass)), true, a);
      if (i < n - 1) ppFx8Zahn(g, cx - W / 2 + (z.x + 0.5 / n) * W, yU + 1 + th * 0.8, tw, Math.max(3, Math.round(th * z.mass2)), false, a);
    });
  }
  // Einschlagblitz (520 ms ab 460 ms)
  const fq = (t - w.lerp(360, 460)) / 520;
  if (fq >= 0 && fq <= 1) {
    const sx = ppFx8Kf(fq, [[0, 0.25], [0.3, 1.05], [1, 2.1]], ppFx8Aus), sy = ppFx8Kf(fq, [[0, 0.3], [0.3, 0.95], [1, 1.5]], ppFx8Aus), fa = ppFx8Kf(fq, [[0, 0], [0.3, 1], [1, 0]]);
    const rx = Math.min(w.lerp(45, 130) * w.gs * 1.1 * sx, sz.gw * S / 2 - 6) / S, ry = w.lerp(18, 50) * w.gs * 1.1 * sy / S;
    g.glow(cx, cy, rx, ry, B.blitz[gore ? 'gore' : 'normal'], fa, 1);
  }
  // Blutspritzer
  for (const s of teile.spritzer) {
    const k = (t - s.delay) / s.dur;
    if (k < 0 || k > 1) continue;
    const e = ppFx8Kf(k, [[0, 0], [0.25, 0.4], [1, 1]], ppFx8Aus), sc = ppFx8Kf(k, [[0, 0.35], [0.25, 1.1], [1, 0.55]]), aa = ppFx8Kf(k, [[0, 0], [0.25, 1], [1, 0]]), r = s.size * sc / 2 / S;
    if (aa < 0.05) continue;
    const C = B.blut[gore ? 'gore' : 'normal'], x = cx + s.dx * e / S, y = cy + s.dy * e / S;
    if (r < 0.9) g.put(x, y, C[2], aa); else { g.disc(x, y, r, C[1], aa); g.disc(x - 0.3, y - 0.3, r * 0.55, C[2], aa); }
  }
  // Tropfen (nur Gore)
  for (const d of teile.tropfen) {
    const k = (t - d.delay) / d.dur;
    if (k < 0 || k > 1) continue;
    const lauf = ppFx8Kf(k, [[0, -4], [0.12, 0], [0.8, d.len * 1.4], [1, d.len * 1.7]], ppFx8Ein), aa = ppFx8Kf(k, [[0, 0], [0.12, 1], [0.8, 1], [1, 0]]), len = Math.max(2, Math.round(d.len * ppFx8Kf(k, [[0, 0.2], [0.12, 1], [0.8, 1.1], [1, 0.95]]) / S));
    if (aa < 0.05) continue;
    const x = Math.round(cx + d.x / S), y0 = cy + lauf / S;
    for (let i = 0; i < len; i++) g.put(x, y0 - len + i, i > len * 0.35 ? B.tropfen[i > len * 0.8 ? 0 : 1] : B.tropfen[1], aa * (i < len * 0.3 ? 0.5 : 1));
    g.put(x + 1, y0 - 1, B.tropfen[0], aa); g.put(x, y0, B.tropfen[0], aa);
  }
  // Schriftzug
  const tq = (t - w.lerp(400, 460)) / teile.schriftDauer;
  if (tq >= 0 && tq <= 1 && (gore || w.t > 0.6)) {
    const sc = ppFx8Kf(tq, [[0, 0.45], [0.22, 1.2], [0.6, 1], [1, 0.85]], ppFx8Aus), aa = ppFx8Kf(tq, [[0, 0], [0.22, 1], [0.6, 1], [1, 0]]);
    const px = gore ? w.lerp(36, 62) : w.lerp(28, 60), m = Math.max(1, Math.round(3 * sc * px / 62));
    if (aa > 0.05) ppFx8Schrift(g, gore ? 'DEVOUR!' : 'CHOMP!', cx, cy, m, B.schrift[gore ? 'gore' : 'normal'][0], B.schrift[gore ? 'gore' : 'normal'][1], aa);
  }
}, 1000, (p) => {
  const w = ppFx8BissWerte(p), halbH = w.fall + w.jawH + w.toothH * 0.4 + 26;
  return { breite: Math.max(w.jawW * 1.55, 460), hoehe: halbH * 2 };
}, {
  z: 10100,
  vorbereiten: (sz) => {
    const w = ppFx8BissWerte(sz.props), n = w.zaehne;
    return {
      w,
      schriftDauer: ppFx8Kap(w.lerp(400, 460), 760, 1000),
      zaehne: Array.from({ length: n }, (_, i) => ({ x: (i + 0.5) / n, mass: 0.85 + Math.random() * 0.3, mass2: 0.85 + Math.random() * 0.3 })),
      spritzer: Array.from({ length: w.spritzer }, () => {
        const ang = Math.random() * Math.PI * 2, v = (24 + Math.random() * 50) * (0.55 + w.t * 0.85 + w.gl * 0.55), delay = 380 + Math.random() * 120;
        return { dx: Math.cos(ang) * v, dy: Math.sin(ang) * v - 6, size: 3 + Math.random() * (3 + w.t * 4 + w.gl * 3), delay, dur: ppFx8Kap(delay, w.lerp(450, 720)) };
      }),
      tropfen: Array.from({ length: Math.round(w.gl * 9) }, () => { const delay = 420 + Math.random() * 140; return { x: -40 + Math.random() * 80, len: 20 + Math.random() * 36, delay, dur: ppFx8Kap(delay, 600 + Math.random() * 380) }; }),
    };
  },
});

// ── Registrierung ────────────────────────────────────────────────────────────
ppFxUeberschreiben('venom_fog', ppFx8VenomFog);
ppFxUeberschreiben('whirlpool', ppFx8Whirlpool);
ppFxUeberschreiben('time_rewind', ppFx8TimeRewind);
ppFxUeberschreiben('victorica_holy_cleanse', ppFx8VictoricaCleanse);
ppFxUeberschreiben('thicket_cover', ppFx8Thicket);
ppFxUeberschreiben('weapon_storm', ppFx8Explosion);
ppFxUeberschreiben('weapon_absorption', ppFx8SogKuppel('wirbel'));
ppFxUeberschreiben('weapon_unleashing', ppFx8SogKuppel('stern'));
ppFxUeberschreiben('trex_chomp', ppFx8Chomp);
