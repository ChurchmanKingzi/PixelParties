// Pixelart-Portierungen (Canvas), Batch 11 (zweite Welle, Schwelle 50 ms): siehe app-fx-0.jsx. Jede Portierung: `ppFxUeberschreiben('typ', Komponente)`.
//   crystal_drain · dark_gear_spin_ccw · dark_wave_engulf · dino_bite · disruption_impact · dive_down · dog_bite · dumbbell_pump · earth_rift · egg_of_god_glow · electric_strike · emergency_spell_armor
// Gemeinsame Bausteine tragen das Präfix `ppFx11` / `PP_FX11_` (die Dateien teilen sich den globalen Namensraum). Je Effekt EINE Leinwand (`ppR1Leinwand` / `ppFx4Leinwand`): ein Rasterpixel = 3 Bildschirmpixel,
// 30 Bilder/s, Palettenfarben, Bayer-Dithering statt Alpha, Drehungen nur als Geometrie (Pixel werden einzeln berechnet), kein Weichzeichner.
// Zonen-Animationen laufen beim Aufrufer 1000 ms (`onZoneAnim`, ohne `duration`): Anfangszeiten bleiben wie in den DOM-Fassungen, Enden/Bewegungen sind auf die Aufruferdauer gerafft (die DOM-Fassungen wurden dort
// hart abgeschnitten — Zahnrad, Hantel und Eier-Schein liefen 1,4–1,8 s). Wird ein `duration` mitgegeben (dive_down, dino_bite), gilt es wie vorher.

// ── Bausteine ────────────────────────────────────────────────────────────────────────────────────────────────────────
/** Keyframes: `st` = [[Anteil 0..1, Wert], …]; `e` = Easing je Abschnitt (wie `animation-timing-function` je Keyframe-Intervall). */
function ppFx11Kf(q, st, e) {
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
const ppFx11Aus = (u) => 1 - (1 - u) * (1 - u);                     // CSS „ease-out" (grob)
const ppFx11Ein = (u) => Math.pow(Math.max(0, u), 1.7);              // CSS „ease-in" (grob)
const ppFx11Glatt = (u) => { u = ppR1Klemme(u); return u * u * (3 - 2 * u); };   // „ease-in-out"
/** Zeitraffer für Effekte, deren DOM-Fassung länger lief als die Aufruferdauer: Faktor ≤ 1 (natürliche Länge `nat` ms → verfügbare Dauer − 40 ms). */
const ppFx11Raffer = (p, nat) => Math.min(1, Math.max(0.3, ((p.duration || 1000) - 40) / nat));
/** Wie `g.glow` (Dither-Stufen von außen nach innen, nie Alpha), nur schneller (Math.sqrt statt Math.hypot, Potenz nur bei p ≠ 1). */
function ppFx11Glow(g, cx, cy, rx, ry, stufen, a = 1, p = 1) {
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
/** Gefülltes Vieleck (Punkte in Rasterpixeln, auch gedreht/verschoben berechnet); `c` = Farbe oder Funktion (x, y) → Farbe. */
function ppFx11Poly(g, pts, c, a = 1) {
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const q of pts) { if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0]; if (q[1] < y0) y0 = q[1]; if (q[1] > y1) y1 = q[1]; }
  const n = pts.length, fn = typeof c === 'function';
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
    let drin = false;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const yi = pts[i][1], yj = pts[j][1];
      if ((yi > y) !== (yj > y) && x < ((pts[j][0] - pts[i][0]) * (y - yi)) / (yj - yi) + pts[i][0]) drin = !drin;
    }
    if (drin) g.put(x, y, fn ? c(x, y) : c, a);
  }
}
/** Punkte um (ox, oy) drehen (Winkel in Grad, CSS-Richtung: positiv = im Uhrzeigersinn) und um (dx, dy) verschieben. */
function ppFx11Dreh(pts, ox, oy, grad, dx = 0, dy = 0) {
  const w = grad * Math.PI / 180, co = Math.cos(w), si = Math.sin(w);
  return pts.map(([x, y]) => [ox + (x - ox) * co - (y - oy) * si + dx, oy + (x - ox) * si + (y - oy) * co + dy]);
}
/** Funke/Splitter wie `.anim-explosion-particle` (Kreis, fliegt per ease-out nach (dx, dy), schrumpft von 1,2 auf 0, blendet nach 20 % aus; Schein als gedithert Ring). p = { dx, dy, size, color, delay, dur }. */
function ppFx11Teilchen(g, cx, cy, t, p, S, ox = 0, oy = 0, deckung = 1) {
  const u = (t - p.delay) / p.dur;
  if (u < 0 || u > 1) return;
  const e = ppFx11Aus(u), a = (u < 0.2 ? 1 : 1 - ppFx11Aus((u - 0.2) / 0.8)) * deckung, r = p.size * 1.2 * (1 - e) / 2 / S;
  if (a < 0.04 || r < 0.3) return;
  const x = cx + (ox + p.dx * e) / S, y = cy + (oy + p.dy * e) / S;
  if (r < 0.9) { g.put(x, y, p.color, a); return; }
  if (r >= 1.5) g.disc(x, y, r + 1, p.color, a * 0.28);
  g.disc(x, y, r, p.color, a);
}
const ppFx11Wahl = (liste) => liste[Math.floor(Math.random() * liste.length)];
/** Gekappte Dauer: Anfang + Dauer soll vor `ende` liegen (mind. 140 ms). */
const ppFx11Kap = (delay, dur, ende = 985) => Math.max(140, Math.min(dur, ende - delay));

// ═════════════════════════════════════════════════════════════════
//  Weakening Crystal (`crystal_drain`; Brett-Animation auf der Hintergrund-Ebene, 1200 ms) — PIXELART. Wie vorher: sieben dünne violette Splitter (3 px breit, 16–34 px hoch, Farbe läuft oben transparent → unten
//  Violett) sinken im Abstand von 90 ms in den Spalten 12 % … 87,5 % des Fensters, 30 % über der Unterkante: Höhe wächst .5 → 1, wandern 22 px hoch → 26 px tiefer, blenden ein (35 %) und aus. Der Schein
//  (box-shadow) ist ein Dither-Rand um die Splitter. Die Leinwand ist nur der Streifen, in dem sich die Splitter bewegen (Fensterbreite, 130 px hoch).
// ═════════════════════════════════════════════════════════════════
const PP_FX11_KRISTALL = { kern: ppHex('#c98aff'), schein: ppHex('#a36afb'), spitze: ppHex('#d6b3f9') };
const ppFx11CrystalDrain = ppR1Leinwand((g, t, sz, d) => {
  const S = sz.S, C = PP_FX11_KRISTALL;
  d.splitter.forEach((sp) => {
    const u = (t - sp.verzug) / 1200;
    if (u < 0 || u > 1) return;
    const e = ppFx11Ein(u), ty = -22 + 48 * e, sy = 0.5 + 0.5 * e;
    const op = u < 0.35 ? 0.9 * ppFx11Ein(u / 0.35) : 0.9 * (1 - ppFx11Ein((u - 0.35) / 0.65));
    const h = sp.hoehe * sy, mitte = 90 - sp.hoehe / 2 + ty;               // Mitte des Splitters im Streifen (Bildschirmpixel; Unterkante unskaliert bei 90 px)
    const X = Math.floor((d.W * sp.links / 100) / S), y0 = Math.round((mitte - h / 2) / S), n = Math.max(2, Math.round(h / S));
    for (let k = 0; k < n; k++) {
      const f = (k + 0.5) / n, a = op * f, y = y0 + k;
      g.put(X, y, k >= n - 2 ? C.spitze : C.kern, a * 0.95);
      g.put(X - 1, y, C.schein, a * 0.42); g.put(X + 1, y, C.schein, a * 0.42);
      if (k > n * 0.4) { g.put(X - 2, y, C.schein, a * 0.18); g.put(X + 2, y, C.schein, a * 0.18); }
    }
  });
}, 1760, (p) => {
  const o = ppR1FeldVersatz(p), H = window.innerHeight, Y0 = Math.round(H * 0.7 - 90);
  return { breite: window.innerWidth, hoehe: 130, ankerX: p.x - o.dx, ankerY: p.y - o.dy - Y0 };
}, {
  z: 10100,
  vorbereiten: (sz) => ({
    W: sz.gw * sz.S,
    splitter: Array.from({ length: ppFxN(7) }, (_, i) => ({ links: 12 + i * 12.5, verzug: i * 90, hoehe: 16 + (i % 3) * 9 })),
  }),
});

// ═════════════════════════════════════════════════════════════════
//  Dark Gear (`dark_gear_spin_ccw`; Zahnrad dreht gegen den Uhrzeigersinn) — PIXELART. Wie vorher: ein dunkelvioletter Schein (100×120 px, wächst .3 → 1,2 → 1 → 1,5) und ein 72-px-Zahnrad (acht Zähne, grau mit
//  dunkler Nabe), das .3 → 1 hereinwächst, 280° dreht (gegen den Uhrzeigersinn, linear) und wieder schrumpft. Das Zahnrad ist Geometrie (Zahn/Körper/Nabe je Rasterpixel aus Radius und Winkel berechnet, kein
//  gedrehtes Bild). Die DOM-Fassung lief 1,4 s, wurde aber nach 1,0 s abgeschnitten: der Ablauf ist auf die Aufruferdauer gerafft.
// ═════════════════════════════════════════════════════════════════
const PP_FX11_RAD = { rand: ppHex('#323232'), schatten: ppHex('#7f7f7f'), koerper: ppHex('#d2d2db'), licht: ppHex('#ffffff'), nabe: ppHex('#222222'), nabeMitte: ppHex('#59606e'), schein: ppHex('#2e0a51'), dunkel: ppHex('#170b28'), mittel: ppHex('#2b0b47') };
/** Liegt das Rasterpixel (i, j) (relativ zur Mitte) im Zahnrad? Acht Zähne, `rot` im Bogenmaß, `sk` = Größenfaktor. */
function ppFx11RadDrin(i, j, rot, sk) {
  const r = Math.sqrt(i * i + j * j), R0 = 9.3 * sk, R1 = 12.2 * sk;
  if (r > R1) return false;
  if (r <= R0) return true;
  const per = Math.PI / 4, m = (((Math.atan2(j, i) - rot) % per) + per) % per, d = Math.min(m, per - m);
  return d * r <= (2.4 - 1.0 * (r - R0) / (R1 - R0)) * sk;
}
const ppFx11GearCCW = ppR1Leinwand((g, t, sz, d) => {
  const S = sz.S, C = PP_FX11_RAD, u = t / d.T;
  if (u > 1) return;
  // Schein (ease-out je Abschnitt): Größe .3 → 1,2 (15 %) → 1 (85 %) → 1,5; Deckung 0 → .8 → .5 → 0
  const fs = ppFx11Kf(u, [[0, 0.3], [0.15, 1.2], [0.85, 1], [1, 1.5]], ppFx11Aus), fo = ppFx11Kf(u, [[0, 0], [0.15, 0.8], [0.85, 0.5], [1, 0]], ppFx11Aus);
  if (fo > 0.03) ppFx11Glow(g, sz.cx, sz.cy + 10 / S, 50 * fs * 0.78 / S, 60 * fs * 0.78 / S, [C.dunkel, C.mittel], fo * 0.9, 0.9);
  // Zahnrad (linear): Drehung 0 → −40° → −320° → −360°, Größe .3 → 1 → 1 → .3, Deckung 0 → 1 → 1 → 0
  const rot = ppFx11Kf(u, [[0, 0], [0.15, -40], [0.85, -320], [1, -360]]) * Math.PI / 180;
  const sk = ppFx11Kf(u, [[0, 0.3], [0.15, 1], [0.85, 1], [1, 0.3]]), a = ppFx11Kf(u, [[0, 0], [0.15, 1], [0.85, 1], [1, 0]]);
  if (a < 0.03) return;
  const R = Math.ceil(12.2 * sk) + 2, B = 2 * R + 1, cx = Math.round(sz.cx), cy = Math.round(sz.cy - 1.5);
  const m = d.maske; m.fill(0);
  for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) m[(j + R) * B + i + R] = ppFx11RadDrin(i, j, rot, sk) ? 1 : 0;
  const innen = (i, j) => i >= -R && j >= -R && i <= R && j <= R && m[(j + R) * B + i + R] === 1;
  for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) {
    if (!innen(i, j)) {
      if (innen(i - 1, j) || innen(i + 1, j) || innen(i, j - 1) || innen(i, j + 1)) g.put(cx + i, cy + j, C.schein, a * 0.55);     // dunkler Rand-Schein statt Schatten
      continue;
    }
    const r = Math.sqrt(i * i + j * j), kante = !(innen(i - 1, j) && innen(i + 1, j) && innen(i, j - 1) && innen(i, j + 1)), l = (i + j) / (12.2 * sk);
    let c;
    if (kante) c = C.rand;
    else if (r < 3.4 * sk) c = (r < 1.4 * sk) ? C.nabeMitte : C.nabe;
    else if (r < 4.6 * sk) c = C.rand;
    else c = l > 0.5 ? C.schatten : l < -0.45 ? C.licht : C.koerper;
    g.put(cx + i, cy + j, c, a);
  }
}, 1440, { breite: 150, hoehe: 170, ankerY: 85 }, {
  z: 10100,
  vorbereiten: (sz) => ({ T: Math.round(1400 * ppFx11Raffer(sz.props, 1400)), maske: new Uint8Array(33 * 33) }),
});

// ═════════════════════════════════════════════════════════════════
//  Dark Wave (`dark_wave_engulf`; The Spawn Mother) — PIXELART. Wie vorher (950 ms): eine dunkle Welle in Größe der Zielzone (Standard 110×140; Form = `border-radius: 46% 54% 38% 62% / 60% 50% 50% 40%`) steigt von unten auf
//  (Versatz .6 → −.05 → −.15 → −.95 Zonenhöhen), Farbverlauf Schwarzblau → Nachtblau → Stahlblau (gedithert), dunkler Innenschatten unten, hellblauer Gischt-Kamm an der Oberkante, drei Ringwellen am Fuß, 14 dunkle
//  Spritzer vom Kamm. Die Wellenform wird einmal als Zellenliste (Farbe + Deckungsschwelle je Rasterpixel) vorberechnet; je Bild wird sie nur verschoben. Die Leinwand reicht 1,5 Zonenhöhen nach oben.
// ═════════════════════════════════════════════════════════════════
const PP_FX11_WELLE = {
  stops: [[0, '#12101f', 0.96], [0.35, '#00213f', 0.92], [0.65, '#2d4362', 0.7], [0.9, '#2d4362', 0.25], [1, '#2d4362', 0]].map(([p, h, a]) => [p, ppHex(h), a]),
  kamm: ppHex('#bddcef'), kammBlau: ppHex('#1788bd'), ring: ppHex('#2d4362'), schwarz: ppHex('#000000'), schein: ppHex('#2d4362'),
  tropfen: ['#282834', '#2d4362', '#2d4362', '#1a1a2e', '#2d4362', '#12101f'].map(ppHex),
};
/** Form und Farbverlauf der Welle als Zellenliste (Rasterpixel relativ zur linken oberen Ecke). */
function ppFx11WelleZellen(cw, ch, S) {
  const W = Math.ceil(cw / S), H = Math.ceil(ch / S), st = PP_FX11_WELLE.stops;
  const r1x = 0.46 * cw, r1y = 0.6 * ch, r2x = 0.54 * cw, r2y = 0.5 * ch, r3x = 0.38 * cw, r3y = 0.5 * ch, r4x = 0.62 * cw, r4y = 0.4 * ch;
  const ell = (x, y, mx, my, rx, ry) => ((x - mx) / rx) ** 2 + ((y - my) / ry) ** 2 <= 1;
  const drin = (x, y) => {
    if (x < 0 || y < 0 || x > cw || y > ch) return false;
    if (x < r1x && y < r1y) return ell(x, y, r1x, r1y, r1x, r1y);
    if (x > cw - r2x && y < r2y) return ell(x, y, cw - r2x, r2y, r2x, r2y);
    if (x > cw - r3x && y > ch - r3y) return ell(x, y, cw - r3x, ch - r3y, r3x, r3y);
    if (x < r4x && y > ch - r4y) return ell(x, y, r4x, ch - r4y, r4x, r4y);
    return true;
  };
  const maske = new Uint8Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) maske[j * W + i] = drin((i + 0.5) * S, (j + 0.5) * S) ? 1 : 0;
  const zellen = [], rx = cw / 2 * Math.SQRT2, ry = 0.7 * ch * Math.SQRT2;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    if (!maske[j * W + i]) continue;
    const px = (i + 0.5) * S, py = (j + 0.5) * S, dd = Math.sqrt(((px - cw / 2) / rx) ** 2 + ((py - 0.7 * ch) / ry) ** 2);
    let k = 0; while (k < st.length - 2 && dd > st[k + 1][0]) k++;
    const f = ppR1Klemme((dd - st[k][0]) / (st[k + 1][0] - st[k][0])), al = st[k][2] + (st[k + 1][2] - st[k][2]) * f;
    let c = f > ppBayer(i + 1, j + 2) ? st[k + 1][1] : st[k][1];
    const sh = ppR1Klemme((py - (ch - 18)) / 18) * 0.6;                                  // Innenschatten unten
    if (sh > ppBayer(i + 3, j)) c = PP_FX11_WELLE.schwarz;
    if (al > 0.04) zellen.push([i, j, c, al]);
  }
  // Schein (24 px Weichzeichner) als zwei Dither-Ringe um die Form
  const rand = [];
  const nah = (i, j, r) => { for (let q = -r; q <= r; q++) for (let p = -r; p <= r; p++) { const a = i + p, b = j + q; if (a >= 0 && b >= 0 && a < W && b < H && maske[b * W + a]) return true; } return false; };
  for (let j = -2; j < H + 2; j++) for (let i = -2; i < W + 2; i++) {
    if (i >= 0 && j >= 0 && i < W && j < H && maske[j * W + i]) continue;
    if (nah(i, j, 1)) rand.push([i, j, 0.34]); else if (nah(i, j, 2)) rand.push([i, j, 0.16]);
  }
  return { W, H, zellen, rand };
}
const ppFx11DarkWave = ppR1Leinwand((g, t, sz, d) => {
  const S = sz.S, C = PP_FX11_WELLE, cw = d.cw, ch = d.ch, u = t / 950, cx = sz.cx, cy = sz.cy;
  // Ringwellen am Fuß
  d.ringe.forEach((r) => {
    const k = (t - r.delay) / r.dur;
    if (k < 0 || k > 1) return;
    const sc = 0.3 + 2.2 * ppFx11Aus(k), a = ppFx11Kf(k, [[0, 0], [0.15, 0.7], [1, 0]], ppFx11Aus);
    if (a > 0.04) g.ellRing(cx, cy + (ch / 2 - 10 + r.size * 0.16) / S, r.size / 2 * sc / S, r.size * 0.16 * sc / S, 1, C.ring, a * 0.9);
  });
  if (u <= 1) {
    const ty = ppFx11Kf(u, [[0, 0.6], [0.55, -0.05], [0.85, -0.15], [1, -0.95]], ppFx11Aus) * ch, a = ppFx11Kf(u, [[0, 0], [0.18, 0.95], [0.55, 0.95], [0.85, 0.85], [1, 0]], ppFx11Aus);
    const Z = d.form, bx = Math.round(cx - Z.W / 2), by = Math.round(cy - Z.H / 2 + ty / S);
    if (a > 0.03) {
      for (const [i, j, al] of Z.rand) if (al * a > ppBayer(i, j)) g.put(bx + i, by + j, C.schein, 1);
      for (const [i, j, c, al] of Z.zellen) if (al * a > ppBayer(i, j)) g.put(bx + i, by + j, c, 1);
    }
    // Gischt-Kamm (14 px hoch, Ellipse in Zonenbreite): hell → Blau, steigt mit der Welle
    const ky = ppFx11Kf(u, [[0, 0.55], [0.55, -0.1], [1, -0.95]], ppFx11Aus) * ch, kx = ppFx11Kf(u, [[0, 0.9], [0.55, 1.05], [1, 1.15]], ppFx11Aus), ka = ppFx11Kf(u, [[0, 0], [0.2, 0.9], [0.55, 0.9], [1, 0]], ppFx11Aus);
    if (ka > 0.03) {
      const y0 = cy + (-ch / 2 - 6 + ky) / S, hw0 = cw / 2 * kx / S;
      for (let j = 0; j < 5; j++) {
        const q = (j + 0.5 - 2.5) / 2.5, hw = hw0 * Math.sqrt(Math.max(0, 1 - q * q)), pa = [0.25, 0.6, 0.85, 0.7, 0.25][j], c = j < 3 ? C.kamm : C.kammBlau;
        for (let i = -Math.round(hw); i <= Math.round(hw); i++) g.put(cx + i, y0 + j, c, pa * ka);
      }
    }
  }
  // Spritzer
  d.tropfen.forEach((p) => {
    const k = (t - p.delay) / p.dur;
    if (k < 0 || k > 1) return;
    const e = ppFx11Aus(k), a = k < 0.15 ? k / 0.15 : 1 - ppFx11Aus((k - 0.15) / 0.85), r = p.size * (1 - 0.6 * e) / 2 / S;
    if (a < 0.04 || r < 0.3) return;
    const x = cx + p.dx * e / S, y = cy + (-ch / 2 + p.size / 2 + p.dy * e) / S;
    if (r < 0.9) { g.put(x, y, p.farbe, a); return; }
    g.disc(x, y, r + 1, C.schein, a * 0.4); g.disc(x, y, r, p.farbe, a);
  });
}, 1000, (p) => {
  const cw = p.w || 110, ch = p.h || 140;
  return { breite: cw + 200, hoehe: ch * 2.7 + 40, ankerY: ch * 1.5 + 12 };
}, {
  z: 10100,
  vorbereiten: (sz) => {
    const cw = sz.props.w || 110, ch = sz.props.h || 140;
    return {
      cw, ch, form: ppFx11WelleZellen(cw, ch, sz.S),
      ringe: Array.from({ length: 3 }, (_, i) => ({ delay: i * 180, dur: ppFx11Kap(i * 180, 750 + i * 200), size: cw * 0.8 + i * 24 })),
      tropfen: Array.from({ length: ppFxN(14) }, () => {
        const w = -Math.PI * 0.15 + Math.random() * Math.PI * 1.3, v = 30 + Math.random() * 50, delay = 200 + Math.random() * 280;
        return { dx: Math.cos(w) * v, dy: -Math.abs(Math.sin(w) * v) - 8, size: 4 + Math.random() * 7, delay, dur: ppFx11Kap(delay, 600 + Math.random() * 350), farbe: ppFx11Wahl(PP_FX11_WELLE.tropfen) };
      }),
    };
  },
});

// ═════════════════════════════════════════════════════════════════
//  Dino-Biss (`dino_bite`; Gigantisaur Spinor/King Trex/Chimera, Opferung) — PIXELART, Leinwand-Fassung von `trex_chomp` (app-fx-8.jsx) mit den Vorgaben von `dino_bite`: `damage` (Standard 50) bestimmt Kiefergröße,
//  Zähne, Fallhöhe, Spritzer und Dauer (900 → 1600 ms), `gore` (Standard 0; `true` = 1) färbt dunkler/blutiger, ergänzt Tropfen und den Schriftzug „DEVOUR!"; ohne Gore erscheint „CHOMP!" erst ab Stärke .6. Ablauf wie
//  vorher: Ober-/Unterkiefer fallen herein und schnappen bei 38 % zu (Nachfedern), Einschlagblitz, Spritzer; bei 78 % ziehen sie sich zurück. Endet die Aufruferdauer vor der Animationsdauer (Standard 1000 ms bei
//  hohem Schaden), ziehen sich die Kiefer in den letzten 120 ms zurück statt abgeschnitten zu werden. Zeichenbausteine (Kiefer, Zahn, Schrift) kommen aus app-fx-8.jsx.
// ═════════════════════════════════════════════════════════════════
function ppFx11BissWerte(p) {
  const goreP = p.gore === true ? 1 : Math.max(0, Math.min(1, +p.gore || 0)), t = Math.max(0, Math.min(1, ((p.damage || 50) - 50) / 350)), lerp = (a, b) => a + (b - a) * t, gs = 1 + goreP * 0.18;
  const anim = lerp(900, 1600), dauer = p.duration || 1000;
  return {
    gl: goreP, t, lerp, gs, jawW: lerp(80, 230) * gs, jawH: lerp(20, 38) * gs, toothW: lerp(8, 16) * (1 + goreP * 0.1), toothH: lerp(10, 24) * gs, zaehne: Math.round(lerp(5, 9) + goreP * 2),
    fall: lerp(90, 260), spritzer: Math.round(lerp(12, 32) * (1 + goreP * 0.85)), anim,
    E: Math.min(anim, dauer), Er: dauer < anim ? dauer - 120 : anim * 0.78,       // Ende und Beginn des Rückzugs
  };
}
const ppFx11Biss = ppFx4Leinwand((g, t, sz, teile) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, w = teile.w, gore = w.gl > 0, B = PP_FX8_BISS;
  const q = t / w.anim, rueck = ppR1Klemme((t - w.Er) / Math.max(60, w.E - w.Er));
  const a = (q < 0.08 ? q / 0.08 : 1) * (1 - rueck);
  const dy = ppFx8Kf(q, [[0, -w.fall], [0.38, 0], [0.44, 3], [0.52, 0]], (u) => Math.pow(u, 1.8)) + (rueck > 0 ? -w.fall * 0.4 * ppFx8Ein(rueck) : 0);
  const W = Math.round(w.jawW / S), H = Math.max(6, Math.round(w.jawH / S)), th = Math.max(3, Math.round(w.toothH / S)), tw = Math.max(3, Math.round(w.toothW / S));
  const yO = cy + (-w.jawH - w.toothH * 0.4 + dy) / S, yU = cy + (w.toothH * 0.4 - dy) / S;
  if (a > 0.03) {
    ppFx8Kiefer(g, cx, yO, W, H, true, gore, a);
    ppFx8Kiefer(g, cx, yU, W, H, false, gore, a);
    const n = teile.zaehne.length;
    teile.zaehne.forEach((z, i) => {
      const x = cx - W / 2 + z.x * W;
      ppFx8Zahn(g, x, yO + H - 1, tw, Math.max(3, Math.round(th * z.mass)), true, a);
      if (i < n - 1) ppFx8Zahn(g, cx - W / 2 + (z.x + 0.5 / n) * W, yU + 1 + th * 0.8, tw, Math.max(3, Math.round(th * z.mass2)), false, a);
    });
  }
  // Einschlagblitz (520 ms ab 360–460 ms)
  const fq = (t - w.lerp(360, 460)) / 520;
  if (fq >= 0 && fq <= 1) {
    const sx = ppFx8Kf(fq, [[0, 0.25], [0.3, 1.05], [1, 2.1]], ppFx8Aus), sy = ppFx8Kf(fq, [[0, 0.3], [0.3, 0.95], [1, 1.5]], ppFx8Aus), fa = ppFx8Kf(fq, [[0, 0], [0.3, 1], [1, 0]]);
    const rx = Math.min(w.lerp(45, 130) * w.gs * 1.1 * sx, sz.gw * S / 2 - 6) / S, ry = w.lerp(18, 50) * w.gs * 1.1 * sy / S;
    ppFx11Glow(g, cx, cy, rx, ry, B.blitz[gore ? 'gore' : 'normal'], fa * (1 - rueck), 1);
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
}, (p) => ppFx11BissWerte(p).E + 40, (p) => {
  const w = ppFx11BissWerte(p), halbH = w.fall + w.jawH + w.toothH * 0.4 + 26;
  return { breite: Math.max(w.jawW * 1.55, 460), hoehe: halbH * 2 };
}, {
  z: 10100,
  vorbereiten: (sz) => {
    const w = ppFx11BissWerte(sz.props), n = w.zaehne, ende = w.E - 15;
    return {
      w,
      schriftDauer: ppFx11Kap(w.lerp(400, 460), 760, ende),
      zaehne: Array.from({ length: n }, (_, i) => ({ x: (i + 0.5) / n, mass: 0.85 + Math.random() * 0.3, mass2: 0.85 + Math.random() * 0.3 })),
      spritzer: Array.from({ length: w.spritzer }, () => {
        const ang = Math.random() * Math.PI * 2, v = (24 + Math.random() * 50) * (0.55 + w.t * 0.85 + w.gl * 0.55), delay = 380 + Math.random() * 120;
        return { dx: Math.cos(ang) * v, dy: Math.sin(ang) * v - 6, size: 3 + Math.random() * (3 + w.t * 4 + w.gl * 3), delay, dur: ppFx11Kap(delay, w.lerp(450, 720), ende) };
      }),
      tropfen: Array.from({ length: Math.round(w.gl * 9) }, () => { const delay = 420 + Math.random() * 140; return { x: -40 + Math.random() * 80, len: 20 + Math.random() * 36, delay, dur: ppFx11Kap(delay, 600 + Math.random() * 380, ende) }; }),
    };
  },
});

// ═════════════════════════════════════════════════════════════════
//  Disruption Ray (`disruption_impact`; Einschlag des Strahls, zweimal kurz hintereinander) — PIXELART. Wie vorher: ein giftgrüner Aufschlag (Schein Ø 92 px, wächst .3 → 1,05 → 1,5, 620 ms), zwei Ringwellen
//  (Ø 40 px → 3,4fach, 700/900 ms, zweiter 120 ms später) und 22 Splitter in Limetten-/Grüntönen. Die Gesamtdeckung `opacity` (Laser Volley dämpft den Einschlag) wirkt als Dither-Deckung.
// ═════════════════════════════════════════════════════════════════
const PP_FX11_GIFT = { hell: ppHex('#cbff66'), lime: ppHex('#87cc00'), moos: ppHex('#5b9438'), schein: ppHex('#80bf59'), splitter: ['#87cc00', '#87cc00', '#f0f075', '#5b9438', '#f0f075', '#f8f8bd'].map(ppHex) };
const ppFx11Disruption = ppR1Leinwand((g, t, sz, d) => {
  const S = sz.S, C = PP_FX11_GIFT, cx = sz.cx, cy = sz.cy, wr = d.wr;
  const uf = t / 620;
  if (uf <= 1) {
    const sc = ppFx11Kf(uf, [[0, 0.3], [0.3, 1.05], [1, 1.5]], ppFx11Aus), a = ppFx11Kf(uf, [[0, 0], [0.3, 1], [1, 0]], ppFx11Aus), r = 46 * sc / S;
    if (a > 0.03) { ppFx11Glow(g, cx, cy, r * 1.3, r * 1.3, [C.schein], a * wr * 0.22, 1.2); ppFx11Glow(g, cx, cy, r * 0.95, r * 0.95, [C.moos, C.lime, C.hell], a * wr * 0.85, 0.9); }
  }
  [[700, 0, 3, C.hell, 0.9], [900, 120, 2, C.lime, 0.7]].forEach(([dur, delay, dick, farbe, amax]) => {
    const u = (t - delay) / dur;
    if (u < 0 || u > 1) return;
    const sc = 0.3 + 3.1 * ppFx11Aus(u), a = (u < 0.25 ? amax * u / 0.25 : amax * (1 - ppFx11Aus((u - 0.25) / 0.75))) * wr, r = 20 * sc / S;
    if (a > 0.03) g.ring(cx, cy, Math.max(0, r - Math.max(1, dick / S * sc)), r, farbe, a);
  });
  d.splitter.forEach((p) => ppFx11Teilchen(g, cx, cy, t, p, S, 0, 0, wr));
}, 1020, { breite: 400, hoehe: 400 }, {
  z: 10100,
  vorbereiten: (sz) => ({
    wr: (typeof sz.props.opacity === 'number' && sz.props.opacity >= 0 && sz.props.opacity <= 1) ? sz.props.opacity : 1,
    splitter: Array.from({ length: ppFxN(22) }, () => {
      const w = Math.random() * Math.PI * 2, v = 22 + Math.random() * 52;
      return { dx: Math.cos(w) * v, dy: Math.sin(w) * v, size: 3 + Math.random() * 7, color: ppFx11Wahl(PP_FX11_GIFT.splitter), delay: Math.random() * 70, dur: 360 + Math.random() * 380 };
    }),
  }),
});

// ═════════════════════════════════════════════════════════════════
//  Dive Down (`dive_down`; Held taucht ab, `duration` 1400 ms vom Server) — PIXELART. Wie vorher: ein Wasserspiegel steigt von unten über die ganze Zone (Verlauf Dunkelblau → Blau → Hellblau mit Dither-Deckung,
//  heller Rand oben; 100 % → 6 % bei 70 % → 0 %, ease-in), 18 Blasen perlen auf (Ø 4–13 px) und drei Ringe laufen an der Oberfläche (ab 45 % der Laufzeit). Die Leinwand IST das Zonenrechteck (wie `overflow: hidden`).
// ═════════════════════════════════════════════════════════════════
const PP_FX11_TAUCH = {
  stops: [[0, '#405f8c', 0.82], [0.55, '#399edf', 0.62], [1, '#77c8ee', 0.3]].map(([p, h, a]) => [p, ppHex(h), a]),
  rand: ppHex('#b3e8f9'), blase: ppHex('#b4dff8'), glanz: ppHex('#ffffff'), ring: ppHex('#b3e8f9'), blasenRand: ppHex('#e5f5fa'),
};
const ppFx11DiveDown = ppFx4Leinwand((g, t, sz, d) => {
  const S = sz.S, C = PP_FX11_TAUCH, W = sz.gw, Hp = d.hoehe, H = Hp / S, L = d.laufzeit, st = C.stops;
  const u = t / L, k = u < 0.7 ? 1 - 0.94 * ppFx11Ein(u / 0.7) : 0.06 * (1 - ppFx11Ein((u - 0.7) / 0.3));
  const top = Math.round(k * H);
  for (let j = top; j < sz.gh; j++) {
    const v = ppR1Klemme(1 - (j - k * H) / H);
    let s = 0; while (s < st.length - 2 && v > st[s + 1][0]) s++;
    const f = (v - st[s][0]) / (st[s + 1][0] - st[s][0]), al = st[s][2] + (st[s + 1][2] - st[s][2]) * f;
    for (let i = 0; i < W; i++) {
      if (j === top) { g.put(i, j, C.rand, 0.85); continue; }
      if (al > ppBayer(i, j)) g.put(i, j, f > ppBayer(i + 1, j + 2) ? st[s + 1][1] : st[s][1], 1);
    }
  }
  d.blasen.forEach((b) => {
    const q = (t - b.delay) / b.dur;
    if (q < 0 || q > 1) return;
    const e = ppFx11Aus(q), a = ppFx11Kf(q, [[0, 0], [0.18, 0.95], [1, 0]], ppFx11Aus), sc = 0.4 + 0.7 * e, r = b.size * sc / 2 / S;
    const x = (sz.gw * S / 2 + b.dx + b.size / 2 + b.drift * e) / S, y = (Hp + 10 - b.size / 2 - (Hp + 16) * e) / S;
    if (a < 0.04) return;
    if (r < 0.9) { g.put(x, y, C.blasenRand, a); return; }
    g.disc(x, y, r, C.blase, a * 0.42);
    if (r >= 1.5) g.ring(x, y, Math.max(0, r - 1), r, C.blasenRand, a); else g.disc(x, y, r, C.blasenRand, a * 0.8);
    if (r >= 2) g.put(x - r * 0.4, y - r * 0.4, C.glanz, a);
  });
  d.ringe.forEach((r) => {
    const q = (t - r.delay) / r.dur;
    if (q < 0 || q > 1) return;
    const e = ppFx11Aus(q), sc = 0.4 + 5.1 * e, a = 0.9 * (1 - e) * 0.9;
    g.ellRing(sz.gw / 2, (0.32 * Hp + 3) / S, 5 * sc / S, 3 * sc / S, 1, C.ring, a);
  });
}, (p) => Math.max(700, Number(p.duration) || 1400) + 40, (p) => ({ breite: Math.max(60, Number(p.w) || 90), hoehe: Math.max(80, Number(p.h) || 126) }), {
  z: 10090,
  vorbereiten: (sz) => {
    const p = sz.props, breite = Math.max(60, Number(p.w) || 90), hoehe = Math.max(80, Number(p.h) || 126), laufzeit = Math.max(700, Number(p.duration) || 1400);
    return {
      hoehe, laufzeit,
      blasen: Array.from({ length: ppFxN(18) }, (_, i) => ({ dx: -breite * 0.35 + Math.random() * breite * 0.7, size: 4 + Math.random() * 9, delay: (i / 18) * (laufzeit * 0.75) + Math.random() * 120, dur: 620 + Math.random() * 520, drift: -10 + Math.random() * 20 })),
      ringe: Array.from({ length: 3 }, (_, i) => ({ delay: laufzeit * 0.45 + i * 170, dur: 760 })),
    };
  },
});

// ═════════════════════════════════════════════════════════════════
//  Dog Bite (`dog_bite`; Loyal Terrier) — PIXELART. Wie vorher (360 ms Biss + Nachspiel bis ~880 ms): zwei Fangzähne schnappen von links oben / rechts unten zu (Zahn oben fährt aus (−26|−28) px Versatz und −25° Neigung
//  ein, der untere gespiegelt aus (22|28) und 28°; je ease-in, Deckung 0 → 1 → 1 → 0), ein blasser Aufschlag (ab 320 ms, 280 ms), kurze braune Stoßlinien und zehn Speichel-/Fellspritzer nach oben. Die Zähne sind
//  gedrehte Vielecke (Geometrie) mit dunklem Rand statt des 🦷-Zeichens. Die alten Stoßlinien standen wegen einer fehlenden CSS-Variable (`--rot`) alle waagerecht nach rechts — hier genauso: eine kurze braune Spur.
// ═════════════════════════════════════════════════════════════════
const PP_FX11_HUND = { rand: ppHex('#27180c'), zahn: ppHex('#fff8e8'), schatten: ppHex('#ccb799'), blitz: [ppHex('#e0c085'), ppHex('#f7e0b5')], linie: ppHex('#4a2a10'), tropfen: [ppHex('#fff8e8'), ppHex('#ccb799')] };
/** Fangzahn als Vieleck (Wurzel oben bei y = 0, Spitze bei y = L), Maße in Bildschirmpixeln, Mitte x = 0. */
const PP_FX11_FANG = [[-13, 0], [13, 0], [12, 8], [9, 19], [5, 30], [0, 38], [-5, 30], [-9, 19], [-12, 8]];
function ppFx11Fang(g, S, cx, cy, pts, a) {
  const rp = pts.map(([x, y]) => [cx + x / S, cy + y / S]);
  const mx = rp.reduce((s, q) => s + q[0], 0) / rp.length, my = rp.reduce((s, q) => s + q[1], 0) / rp.length;
  const innen = rp.map(([x, y]) => [mx + (x - mx) * 0.7, my + (y - my) * 0.74]);
  ppFx11Poly(g, rp, PP_FX11_HUND.rand, a);
  ppFx11Poly(g, innen, (x, y) => (x - mx) > 0.35 * Math.abs(y - my) + 0.6 ? PP_FX11_HUND.schatten : PP_FX11_HUND.zahn, a);
}
const ppFx11DogBite = ppR1Leinwand((g, t, sz, d) => {
  const S = sz.S, C = PP_FX11_HUND, cx = sz.cx, cy = sz.cy, ease = ppFx11Ein;
  const u = t / 360;
  if (u <= 1) {
    // oberer Zahn: Wurzel (−1|−34) px, Drehpunkt (3|1) px; Versatz −26|−28 → −6|−8 → 0|0 → 0|0, Neigung −25° → −8° → 0° → 2°
    const tx = ppFx11Kf(u, [[0, -26], [0.5, -6], [0.8, 0], [1, 0]], ease), ty = ppFx11Kf(u, [[0, -28], [0.5, -8], [0.8, 0], [1, 0]], ease), rot = ppFx11Kf(u, [[0, -25], [0.5, -8], [0.8, 0], [1, 2]], ease);
    const a = ppFx11Kf(u, [[0, 0], [0.5, 1], [0.8, 1], [1, 0]], ease);
    if (a > 0.03) {
      const pts = ppFx11Dreh(PP_FX11_FANG.map(([x, y]) => [x - 1, y - 34]), 3, 1, rot, tx, ty);
      ppFx11Fang(g, S, cx, cy, pts, a);
    }
    // unterer Zahn (gespiegelt: Spitze nach oben): Frame vor der Spiegelung um (13|7) px; Versatz 22|−28 → 6|−10 → 0|−2, Neigung 28° → 10° → 0° → −2°
    const bx = ppFx11Kf(u, [[0, 22], [0.5, 6], [0.8, 0], [1, 0]], ease), by = ppFx11Kf(u, [[0, -28], [0.5, -10], [0.8, -2], [1, -2]], ease), br = ppFx11Kf(u, [[0, 28], [0.5, 10], [0.8, 0], [1, -2]], ease);
    if (a > 0.03) {
      const O = [13, 7], lokal = PP_FX11_FANG.map(([x, y]) => [x + 17 - O[0], y - 8]);                // Wurzel bei y = 15, Spitze bei −23 (nach Spiegelung)
      const pts = ppFx11Dreh(lokal, 0, 0, br, bx, by).map(([x, y]) => [O[0] + x, O[1] - y]);
      ppFx11Fang(g, S, cx, cy, pts, a);
    }
  }
  // Aufschlag (ab 320 ms, 280 ms): Größe .4 → 1,2 → 1,6, Deckung 0 → 1 → 0
  const fu = (t - 320) / 280;
  if (fu >= 0 && fu <= 1) {
    const sc = ppFx11Kf(fu, [[0, 0.4], [0.35, 1.2], [1, 1.6]], ppFx11Aus), a = ppFx11Kf(fu, [[0, 0], [0.35, 1], [1, 0]], ppFx11Aus);
    if (a > 0.03) ppFx11Glow(g, cx, cy + 4 / S, 22 * sc * 0.8 / S, 16 * sc * 0.8 / S, [C.blitz[0], C.blitz[1]], a * 0.85, 0.9);
  }
  // Stoßlinien (alle waagerecht nach rechts, braun → Rand): Länge .2 → 1 → 1,3
  d.linien.forEach((l) => {
    const q = (t - l.delay) / 280;
    if (q < 0 || q > 1) return;
    const sx = ppFx11Kf(q, [[0, 0.2], [0.4, 1], [1, 1.3]], ppFx11Aus), a = ppFx11Kf(q, [[0, 0], [0.4, 0.95], [1, 0]], ppFx11Aus), n = Math.max(2, Math.round(l.len * sx / S));
    for (let i = 0; i < n; i++) g.put(cx + i, cy, C.linie, a * (1 - i / n) * 0.95);
  });
  // Speichel / Fell
  d.tropfen.forEach((p) => {
    const q = (t - p.delay) / p.dur;
    if (q < 0 || q > 1) return;
    const e = ppFx11Aus(q), a = ppFx11Kf(q, [[0, 0], [0.25, 1], [1, 0]]), sc = ppFx11Kf(q, [[0, 0.4], [0.25, 1], [1, 0.6]]), r = p.size * sc / 2 / S;
    if (a < 0.05) return;
    const x = cx + p.dx * e / S, y = cy + p.dy * e / S;
    if (r < 0.9) g.put(x, y, C.tropfen[0], a); else { g.disc(x, y, r, C.tropfen[1], a); g.disc(x - 0.3, y - 0.3, r * 0.6, C.tropfen[0], a); }
  });
}, 880, { breite: 260, hoehe: 260 }, {
  z: 10100,
  vorbereiten: () => ({
    tropfen: Array.from({ length: ppFxN(10) }, () => {
      const w = -Math.PI + Math.random() * Math.PI, v = 24 + Math.random() * 28;
      return { dx: Math.cos(w) * v, dy: Math.sin(w) * v * 0.55 + 6 + Math.random() * 8, size: 3 + Math.random() * 3, delay: 220 + Math.random() * 140, dur: 320 + Math.random() * 200 };
    }),
    linien: Array.from({ length: ppFxN(8) }, () => ({ len: 22 + Math.random() * 14, delay: 200 + Math.random() * 80 })),
  }),
});

// ═════════════════════════════════════════════════════════════════
//  Muscle Training (`dumbbell_pump`) — PIXELART. Wie vorher: eine Hantel (70×36 px: zwei Scheiben 10×36, Stange 50×8, grau gestuft) taucht über dem Helden auf (.3 → 1), stemmt sich zweimal hoch (−30 px) und
//  sackt jeweils tiefer ein (+5 px, Größe 1,08), steigt weiter und verschwindet (1,5 s in der DOM-Fassung, dort nach 1,0 s abgeschnitten — hier auf die Aufruferdauer gerafft). Beim Einsacken (32 % / 62 %) stieben je zehn
//  gelbe Funken aus der Zonenmitte. Größen je Bild in ganzen Rasterpixeln neu gerechnet (kein skaliertes Bild).
// ═════════════════════════════════════════════════════════════════
const PP_FX11_HANTEL = { scheibe: ['#b9b9b9', '#929292', '#535353'].map(ppHex), rand: ppHex('#323232'), stange: ['#b9b9b9', '#7f7f7f', '#b9b9b9'].map(ppHex), funken: ['#fad54a', '#ff8b1a', '#f9ac20', '#ffe469', '#ffffff'].map(ppHex) };
const ppFx11Dumbbell = ppR1Leinwand((g, t, sz, d) => {
  const S = sz.S, C = PP_FX11_HANTEL, u = t / d.T, cx = sz.cx, cy = sz.cy;
  if (u <= 1) {
    const e = ppFx11Glatt;
    const ty = ppFx11Kf(u, [[0, 0], [0.08, 0], [0.2, -30], [0.32, 5], [0.5, -30], [0.62, 5], [0.78, -8], [1, -12]], e);
    const sc = ppFx11Kf(u, [[0, 0.3], [0.08, 1], [0.2, 1], [0.32, 1.08], [0.5, 1], [0.62, 1.08], [0.78, 1], [1, 0.6]], e), a = ppFx11Kf(u, [[0, 0], [0.08, 1], [0.78, 1], [1, 0]], e);
    if (a > 0.03) {
      const wb = Math.max(2, Math.round(10 * sc / S)), wh = Math.max(3, Math.round(36 * sc / S)), bl = Math.max(3, Math.round(50 * sc / S)), bd = Math.max(1, Math.round(8 * sc / S));
      const gesamt = bl + 2 * wb, x0 = Math.round(cx - gesamt / 2), my = Math.round(cy + (-32 + ty * 1) / S), y0 = my - Math.round(wh / 2);
      // Scheiben (links/rechts): Spalten hell → dunkel, Rand oben/unten, Ecken ausgespart
      for (const sx of [x0, x0 + gesamt - wb]) {
        for (let j = 0; j < wh; j++) for (let i = 0; i < wb; i++) {
          if ((j === 0 || j === wh - 1) && (i === 0 || i === wb - 1) && wb > 2) continue;
          const spalte = Math.min(2, Math.floor(i / wb * 3)), c = (j === 0 || j === wh - 1) ? C.rand : (sx === x0 ? C.scheibe[spalte] : C.scheibe[2 - spalte]);
          g.put(sx + i, y0 + j, c, a);
        }
      }
      // Stange
      const sy = my - Math.floor(bd / 2);
      for (let j = 0; j < bd; j++) for (let i = 0; i < bl; i++) g.put(x0 + wb + i, sy + j, C.stange[bd >= 3 ? Math.min(2, Math.floor(j / bd * 3)) : 1], a);
    }
  }
  d.funken.forEach((p) => ppFx11Teilchen(g, cx, cy, t, p, S));
}, 1000, { breite: 220, hoehe: 260, ankerY: 150 }, {
  z: 10100,
  vorbereiten: (sz) => {
    const k = ppFx11Raffer(sz.props, 1500), T = Math.round(1500 * k);
    const funken = (base) => Array.from({ length: ppFxN(10) }, () => {
      const w = Math.random() * Math.PI, v = 15 + Math.random() * 30;
      return { dx: Math.cos(w) * v - v / 2, dy: -Math.abs(Math.sin(w) * v), size: 2 + Math.random() * 4, color: ppFx11Wahl(PP_FX11_HANTEL.funken), delay: (base + Math.random() * 60) * k, dur: (300 + Math.random() * 200) * k };
    });
    return { T, funken: funken(480).concat(funken(1080)) };
  },
});

// ═════════════════════════════════════════════════════════════════
//  Erdriss (`earth_rift`; Cybug Rhinoceros, auch auf einer Area-Zone) — PIXELART. Wie vorher (700 ms): ein brauner Staubstoß (Ellipse 1,8 × .55 Zonenbreiten, wächst .25 → 1 → 1,5, Dither-Dichte statt Weichzeichner), drei
//  aufreißende Spalten (Abstand 18 px, je 70 ms später; 1,25 Zonenbreiten hoch, dunkelbraun mit orangem Seitenschein, leicht geneigt) und fünf hochgeschleuderte Brocken (6/9/12 px, 38 px hoch, Quadrate, die sich drehen —
//  als Geometrie).
// ═════════════════════════════════════════════════════════════════
const PP_FX11_ERDE = { staub: [ppHex('#6b4a2a'), ppHex('#886c44')], riss: [ppHex('#1f0f04'), ppHex('#3a2412')], schein: ppHex('#ff9b3a'), brocken: [ppHex('#b29466'), ppHex('#6b4a2a')], rand: ppHex('#3a2412') };
const ppFx11EarthRift = ppR1Leinwand((g, t, sz, d) => {
  const S = sz.S, C = PP_FX11_ERDE, cx = sz.cx, cy = sz.cy, base = d.base;
  const su = t / 700;
  if (su <= 1) {
    const sc = ppFx11Kf(su, [[0, 0.25], [0.25, 1], [1, 1.5]], ppFx11Aus), a = ppFx11Kf(su, [[0, 0], [0.25, 0.95], [1, 0]], ppFx11Aus), dust = base * 1.8;
    if (a > 0.03) ppFx11Glow(g, cx, cy + 0.171 * base / S, dust / 2 * sc / S, dust * 0.275 * sc / S, [C.staub[0], C.staub[1]], a * 0.85, 0.85);
  }
  [-18, 0, 18].forEach((off, i) => {
    const q = (t - i * 70) / 700;
    if (q < 0 || q > 1) return;
    const sy = ppFx11Kf(q, [[0, 0], [0.3, 1], [1, 1]], ppFx11Aus), a = ppFx11Kf(q, [[0, 0], [0.3, 1], [1, 0]], ppFx11Aus), H = base * 1.25 * sy, n = Math.max(1, Math.round(H / S));
    if (a < 0.03) return;
    const yc = (-base * 0.6 + base * 1.25 / 2) / S, x0 = cx + (off + 2.5) / S;
    for (let k = 0; k < n; k++) {
      const v = (k + 0.5) / n, f = v < 0.18 ? v / 0.18 : v > 0.55 ? 1 - (v - 0.55) / 0.45 : 1, dyr = (k + 0.5 - n / 2) * S, x = Math.round(x0 + dyr * 0.07 / S), y = cy + yc - n / 2 + k;
      const c = v < 0.55 ? C.riss[0] : C.riss[1];
      g.put(x - 1, y, c, a * f * 0.95); g.put(x, y, c, a * f * 0.95);
      g.put(x - 2, y, C.schein, a * f * 0.5); g.put(x + 1, y, C.schein, a * f * 0.5);
      if (f > 0.7) { g.put(x - 3, y, C.schein, a * f * 0.2); g.put(x + 2, y, C.schein, a * f * 0.2); }
    }
  });
  d.brocken.forEach((b) => {
    const q = (t - b.delay) / 680;
    if (q < 0 || q > 1) return;
    const e = ppFx11Kf(q, [[0, 0], [1, 1]], (u) => 1 - Math.pow(1 - u, 2.4)), a = ppFx11Kf(q, [[0, 0], [0.2, 1], [1, 0]]), rot = 220 * e, h = b.sz / 2 / S;
    if (a < 0.05) return;
    const x = cx + b.dx / S, y = cy - 38 * e / S;
    const quad = ppFx11Dreh([[-h, -h], [h, -h], [h, h], [-h, h]], 0, 0, rot, x, y);
    const w = rot * Math.PI / 180;
    ppFx11Poly(g, quad, (px, py) => ((px - x) * Math.cos(w + 0.6) + (py - y) * Math.sin(w + 0.6)) < 0 ? C.brocken[0] : C.brocken[1], a);
  });
}, 880, (p) => {
  const b = Math.max(p.w || 72, 60);
  return { breite: b * 3 + 60, hoehe: Math.max(b * 0.67, 40) + Math.max(b * 0.6, 56) + 60, ankerY: Math.max(b * 0.6, 56) + 30 };
}, {
  z: 10130,
  vorbereiten: (sz) => {
    const base = Math.max(sz.props.w || 72, 60);
    return { base, brocken: [0, 1, 2, 3, 4].map((i) => ({ dx: (i - 2) * base * 0.22, delay: i * 45, sz: 6 + (i % 3) * 3 })) };
  },
});

// ═════════════════════════════════════════════════════════════════
//  The Egg of God (`egg_of_god_glow`; Erscheinen und Auslösen) — PIXELART. Wie vorher: ein goldener Schein um die Zone (Ellipse 116×144 px, wächst .7 → 1,05 → 1 → 1,12, blendet ein/aus; Dither-Dichte statt Weichzeichner und
//  `screen`-Mischung) und 22 aufsteigende Teilchen — jedes dritte ein vierzackiger Stern (dreht 0 → 90°, als Geometrie), sonst Funken —, die ab 0–520 ms 40–95 px steigen. Die DOM-Fassung lief 1,5 s (Teilchen bis 1,8 s) und wurde bei
//  1,0 s abgeschnitten: Anfänge unverändert, der Schein auf die Aufruferdauer gerafft, die Teilchen enden spätestens bei ~985 ms.
// ═════════════════════════════════════════════════════════════════
const PP_FX11_EI = { schein: [ppHex('#f8ca21'), ppHex('#fff196')], farben: ['#fffbd2', '#ffe469', '#fad54a', '#ffffff', '#ffc61c'].map(ppHex) };
const ppFx11StarPts = [[0, -0.5], [0.12, -0.12], [0.5, 0], [0.12, 0.12], [0, 0.5], [-0.12, 0.12], [-0.5, 0], [-0.12, -0.12]];
const ppFx11EggGlow = ppR1Leinwand((g, t, sz, d) => {
  const S = sz.S, C = PP_FX11_EI, cx = sz.cx, cy = sz.cy, u = t / d.T;
  if (u <= 1) {
    const sc = ppFx11Kf(u, [[0, 0.7], [0.25, 1.05], [0.6, 1], [1, 1.12]], ppFx11Aus), a = ppFx11Kf(u, [[0, 0], [0.25, 1], [0.6, 0.8], [1, 0]], ppFx11Aus);
    if (a > 0.03) ppFx11Glow(g, cx, cy + 7 * sc / S, 58 * sc / S, 72 * sc / S, [C.schein[0], C.schein[1]], a * 0.62, 0.9);
  }
  d.teile.forEach((p) => {
    const q = (t - p.verzug) / p.dauer;
    if (q < 0 || q > 1) return;
    const e = ppFx11Aus(q), x = cx + (p.dx + p.drift * e) / S, y = cy + (p.dy + p.steig * e) / S;
    if (p.stern) {
      const a = q < 0.35 ? q / 0.35 : 1 - (q - 0.35) / 0.65, sc = ppFx11Kf(q, [[0, 0.2], [0.35, 1.2], [1, 0.4]], ppFx11Aus), gr = p.g * sc / S, rot = 90 * e;
      if (a < 0.05 || gr < 1.2) return;
      if (gr < 2.6) {                                                                          // winzig: Punkt mit Kreuz bzw. (ab 45°) diagonalem Kreuz
        g.put(x, y, p.farbe, a);
        for (const [ox, oy] of (rot < 45 ? [[1, 0], [-1, 0], [0, 1], [0, -1]] : [[1, 1], [-1, -1], [-1, 1], [1, -1]])) g.put(x + ox, y + oy, p.farbe, a * 0.8);
        return;
      }
      ppFx11Poly(g, ppFx11Dreh(ppFx11StarPts.map(([sx, sy]) => [x + sx * gr, y + sy * gr]), x, y, rot), p.farbe, a);
    } else {
      const a = q < 0.15 ? q / 0.15 : 1 - ppFx11Aus((q - 0.15) / 0.85), r = Math.max(p.g >= 5 ? 0.95 : 0.6, p.g * ppFx11Kf(q, [[0, 0.8], [1, 0.4]]) / 2 / S);
      if (a < 0.05 || r < 0.3) return;
      if (r < 0.9) { g.put(x, y, p.farbe, a); return; }
      if (r >= 1.2) g.disc(x, y, r + 1, p.farbe, a * 0.28);
      g.disc(x, y, r, p.farbe, a);
    }
  });
}, 1000, { breite: 240, hoehe: 300, ankerY: 150 }, {
  z: 10100,
  vorbereiten: (sz) => ({
    T: Math.round(1500 * ppFx11Raffer(sz.props, 1500)),
    teile: Array.from({ length: ppFxN(22) }, (_, i) => {
      const stern = i % 3 === 0, verzug = Math.round(Math.random() * 520);
      return {
        stern, dx: (Math.random() - 0.5) * 70, dy: 20 + Math.random() * 40, steig: -(40 + Math.random() * 55), drift: (Math.random() - 0.5) * 22, g: stern ? 6 + Math.random() * 6 : 3 + Math.random() * 4,
        farbe: PP_FX11_EI.farben[i % 5], verzug, dauer: ppFx11Kap(verzug, Math.round(760 + Math.random() * 520), (sz.props.duration || 1000) - 15),
      };
    }),
  }),
});

// ═════════════════════════════════════════════════════════════════
//  Electric Strike (`electric_strike`; Deepsea Mummy, Sparky Slime, Ferocious Tiger Kick, Coreling-Strahl …) — PIXELART. Wie vorher: 16 Blitze (⚡ 8–18 px) fliegen aus 55–100 px Abstand von allen Seiten zur Mitte
//  (150–300 ms, Verzug 0–200 ms, ease-in, schrumpfen 1,3 → .3, zeigen zur Mitte), ab 200 ms ein gelber Aufschlagschein (500 ms, wächst .3 → 1,4 → 1,8) und 14 gelbe/weiße Funken ab 250–400 ms. Blitz = gedrehtes
//  Vieleck (Rand, Körper, weißer Kern) statt Emoji.
// ═════════════════════════════════════════════════════════════════
const PP_FX11_BLITZ = { pts: [[0.05, -0.5], [-0.25, 0.05], [0, 0.05], [-0.12, 0.5], [0.28, -0.1], [0.03, -0.1], [0.25, -0.5]], rand: ppHex('#f9ac20'), koerper: ppHex('#ffe23d'), kern: ppHex('#fff8e8'), schein: [ppHex('#ffe23d'), ppHex('#ffe469'), ppHex('#fff8e8')], funken: ['#ffe23d', '#ffffff', '#fad54a', '#f7f7ad', '#fad54a'].map(ppHex) };
const ppFx11Electric = ppR1Leinwand((g, t, sz, d) => {
  const S = sz.S, C = PP_FX11_BLITZ, cx = sz.cx, cy = sz.cy;
  const fu = (t - 200) / 500;
  if (fu >= 0 && fu <= 1) {
    const sc = ppFx11Kf(fu, [[0, 0.3], [0.5, 1.4], [1, 1.8]], ppFx11Aus), a = ppFx11Kf(fu, [[0, 1], [0.5, 0.7], [1, 0]], ppFx11Aus), r = 35 * sc * 0.78 / S;
    if (a > 0.03) ppFx11Glow(g, cx, cy, r, r, C.schein, a * 0.85, 0.9);
  }
  d.blitze.forEach((b) => {
    const q = (t - b.delay) / b.dur;
    if (q < 0 || q > 1) return;
    const e = ppFx11Ein(q), x = cx + (b.sx * (1 - e)) / S, y = cy + (b.sy * (1 - e)) / S, h = b.size * (1.3 - 1.0 * e) / S, a = q < 0.7 ? 1 : 1 - (q - 0.7) / 0.3;
    if (a < 0.05) return;
    if (h < 2) { g.put(x, y, C.koerper, a); return; }
    const form = (k) => ppFx11Dreh(C.pts.map(([px, py]) => [x + px * h * k, y + py * h * k]), x, y, b.rot);
    ppFx11Poly(g, form(1.3), C.rand, a * 0.6);
    ppFx11Poly(g, form(1), C.koerper, a);
    if (h >= 4) ppFx11Poly(g, form(0.5), C.kern, a);
  });
  d.funken.forEach((p) => ppFx11Teilchen(g, cx, cy, t, p, S));
}, 960, { breite: 360, hoehe: 360 }, {
  z: 10100,
  vorbereiten: () => ({
    blitze: Array.from({ length: ppFxN(16) }, () => {
      const w = Math.random() * Math.PI * 2, dist = 55 + Math.random() * 45;
      return { sx: Math.cos(w) * dist, sy: Math.sin(w) * dist, size: 8 + Math.random() * 10, delay: Math.random() * 200, dur: 150 + Math.random() * 150, rot: w * 180 / Math.PI + 180 };
    }),
    funken: Array.from({ length: ppFxN(14) }, () => {
      const w = Math.random() * Math.PI * 2, v = 12 + Math.random() * 30;
      return { dx: Math.cos(w) * v, dy: Math.sin(w) * v, size: 2 + Math.random() * 5, color: ppFx11Wahl(PP_FX11_BLITZ.funken), delay: 250 + Math.random() * 150, dur: 250 + Math.random() * 250 };
    }),
  }),
});

// ═════════════════════════════════════════════════════════════════
//  Emergency Spell Armor (`emergency_spell_armor`; bisher ein Alias auf `spectral_armor`) — PIXELART. Wie vorher (700 ms): ein türkiser Heiligenschein (Ø 96 px, .3 → 1,1 → 1,45 → 1,85) hinter einem Ritterschild (🛡️ 64 px,
//  steigt von 28 px darunter auf, wächst .45 → 1,15 → .92 und löst sich 26 px höher auf), darunter gekreuzte Schwerter (36 px, 60 ms später), 14 hellblaue Funken im Bogen darüber und der türkise Umriss (`.spectral-armor-teal`)
//  an der getroffenen Karte (700 ms, wie vorher per Klasse gesetzt). Schild und Schwerter sind Geometrie je Größe (kein skaliertes Bild) mit türkisem Dither-Rand statt Leuchten.
// ═════════════════════════════════════════════════════════════════
const PP_FX11_RUESTUNG = {
  schein: [ppHex('#07aec5'), ppHex('#7ce9dc')], rand1: ppHex('#7ce9dc'), rand2: ppHex('#08d3ef'), funke: ppHex('#b6eff7'),
  schild: { aussen: ppHex('#2f539d'), rim: ppHex('#b3d8f9'), koerper: ppHex('#4e82cb'), licht: ppHex('#66b6ff'), tief: ppHex('#4e77ca') },
  klinge: ppHex('#d2d2db'), klingeRand: ppHex('#535353'), griff: ppHex('#fad54a'), griffRand: ppHex('#8e503a'),
};
/** Ritterschild (Breite W, Höhe H Rasterpixel): gerade Seiten, unten zur Spitze gerundet; Rand, heller Saum, Glanz links oben, türkiser Dither-Rand ringsum. */
function ppFx11Schild(g, cx, cy, W, H, a) {
  cx = Math.round(cx); cy = Math.round(cy);
  const C = PP_FX11_RUESTUNG, y0 = -Math.round(H / 2), hwMax = W / 2;
  const hw = (j) => { const v = (j - y0) / H; return v < 0.58 ? hwMax : hwMax * (1 - Math.pow((v - 0.58) / 0.42, 1.5)); };
  const drin = (i, j) => j >= y0 && j < y0 + H && Math.abs(i + 0.0) <= hw(j) - 0.01;
  for (let j = y0 - 3; j <= y0 + H + 3; j++) for (let i = -Math.ceil(hwMax) - 3; i <= Math.ceil(hwMax) + 3; i++) {
    if (!drin(i, j)) {
      if (drin(i - 1, j) || drin(i + 1, j) || drin(i, j - 1) || drin(i, j + 1)) g.put(cx + i, cy + j, C.rand1, a * 0.85);
      else if (drin(i - 2, j) || drin(i + 2, j) || drin(i, j - 2) || drin(i, j + 2) || drin(i - 1, j - 1) || drin(i + 1, j + 1) || drin(i - 1, j + 1) || drin(i + 1, j - 1)) g.put(cx + i, cy + j, C.rand2, a * 0.4);
      continue;
    }
    const kante = !(drin(i - 1, j) && drin(i + 1, j) && drin(i, j - 1) && drin(i, j + 1)), innen = !(drin(i - 2, j) && drin(i + 2, j) && drin(i, j - 2) && drin(i, j + 2));
    let c;
    if (kante) c = C.schild.aussen;
    else if (innen && W >= 8) c = C.schild.rim;
    else c = (i < -hwMax * 0.2 && j < y0 + H * 0.45) ? C.schild.licht : (i > hwMax * 0.3 ? C.schild.tief : C.schild.koerper);
    g.put(cx + i, cy + j, c, a);
  }
}
/** Gekreuzte Schwerter: Halbbreite r Rasterpixel; Klinge hell mit dunklem Rand (Spitzen oben), goldene Parierstange und Knauf, türkiser Dither-Rand. */
function ppFx11Schwerter(g, cx, cy, r, a) {
  const C = PP_FX11_RUESTUNG;
  if (r < 1.5) { g.put(cx, cy, C.klinge, a); return; }
  const klingen = [[-1, 1], [1, 1]].map(([s, v]) => [cx + s * r, cy + v * r, cx - s * r, cy - v * r]);       // Griff unten, Spitze oben (über Kreuz)
  for (const [hx, hy, tx, ty] of klingen) { g.line(hx, hy, tx, ty, C.rand1, a * 0.5, 5); g.line(hx, hy, tx, ty, C.klingeRand, a, 3); }
  for (const [hx, hy, tx, ty] of klingen) {
    g.line(hx, hy, tx, ty, C.klinge, a, 2);
    const gx = hx + (tx - hx) * 0.22, gy = hy + (ty - hy) * 0.22, sx = Math.sign(tx - hx);
    g.line(gx - sx * 2, gy - 2, gx + sx * 2, gy + 2, C.griff, a, 1);                                         // Parierstange quer zur Klinge
    g.put(hx, hy, C.griff, a); g.put(hx, hy + 1, C.griffRand, a);
  }
}
const ppFx11Ruestung = ppR1Leinwand((g, t, sz, d) => {
  const S = sz.S, C = PP_FX11_RUESTUNG, cx = sz.cx, cy = sz.cy, u = t / 700;
  // Halo (700 ms, ease-out): Größe .3 → 1,1 → 1,45 → 1,85, Deckung 0 → .9 → .55 → 0
  if (u <= 1) {
    const sc = ppFx11Kf(u, [[0, 0.3], [0.3, 1.1], [0.6, 1.45], [1, 1.85]], ppFx11Aus), a = ppFx11Kf(u, [[0, 0], [0.3, 0.9], [0.6, 0.55], [1, 0]], ppFx11Aus);
    if (a > 0.03) ppFx11Glow(g, cx, cy - 20 / S, 48 * sc / S, 48 * sc / S, [C.schein[0], C.schein[1]], a * 0.7, 0.9);
  }
  const hebe = (v) => ({
    dy: ppFx11Kf(v, [[0, 28], [0.55, -8], [0.78, -14], [1, -26]], ppFx11Aus), sc: ppFx11Kf(v, [[0, 0.45], [0.55, 1.15], [0.78, 1.05], [1, 0.92]], ppFx11Aus),
    a: ppFx11Kf(v, [[0, 0], [0.22, 1], [0.78, 0.95], [1, 0]], ppFx11Aus),
  });
  // Schild (64 px: ~19 × 21 Rasterpixel), gleichzeitig die Schwerter (36 px) 60 ms später
  { const v = hebe(u); if (u <= 1 && v.a > 0.03) ppFx11Schild(g, cx - 4 / S, cy + (-48 + v.dy) / S, Math.max(3, Math.round(17 * v.sc)), Math.max(4, Math.round(20 * v.sc)), v.a); }
  { const q = (t - 60) / 700; if (q >= 0 && q <= 1) { const v = hebe(q); if (v.a > 0.03) ppFx11Schwerter(g, cx - 4 / S, cy + (-10 + v.dy) / S, 5 * v.sc, v.a); } }
  d.funken.forEach((s) => {
    const q = (t - s.verzug) / s.dauer;
    if (q < 0 || q > 1) return;
    const e = ppFx11Aus(q), a = q < 0.3 ? q / 0.3 : 1 - (q - 0.3) / 0.7, sc = 0.4 + 1.1 * e, n = Math.max(1, Math.round(s.size * sc / S));
    if (a < 0.04) return;
    const x = cx + (s.x + s.size / 2) / S, y = cy + (s.y + s.size / 2 - 12 * e) / S;
    if (n >= 2) g.disc(x, y, n / 2 + 1, C.rand1, a * 0.3);
    g.block(x - n / 2, y - n / 2, n, n, C.funke, a);
  });
}, 720, { breite: 280, hoehe: 280, ankerY: 190 }, {
  z: 10100,
  // Wie `spectral_armor`: die getroffene Karte (nächste Helden-/Support-Zone zum Anker) bekommt 700 ms den türkisen Umriss
  wirkung: (p) => {
    const els = document.querySelectorAll('[data-hero-zone],[data-support-zone]');
    let best = null, bestDist = Infinity;
    els.forEach((el) => {
      const r = el.getBoundingClientRect(), d = Math.abs(r.left + r.width / 2 - p.x) + Math.abs(r.top + r.height / 2 - p.y);
      if (d < bestDist) { bestDist = d; best = el; }
    });
    if (best && bestDist < 120) {
      best.classList.add('spectral-armor-teal');
      const tm = setTimeout(() => best.classList.remove('spectral-armor-teal'), 700);
      return () => { clearTimeout(tm); best.classList.remove('spectral-armor-teal'); };
    }
    return undefined;
  },
  vorbereiten: () => ({
    funken: Array.from({ length: ppFxN(14) }, () => {
      const w = -Math.PI * 0.5 + (Math.random() - 0.5) * Math.PI * 1.4, dist = 35 + Math.random() * 35;
      return { x: Math.cos(w) * dist, y: Math.sin(w) * dist - 30, size: 3 + Math.random() * 5, verzug: 80 + Math.random() * 240, dauer: 380 + Math.random() * 280 };
    }),
  }),
});

// ── Registrierung ────────────────────────────────────────────────────────────
ppFxUeberschreiben('crystal_drain', ppFx11CrystalDrain);
ppFxUeberschreiben('dark_gear_spin_ccw', ppFx11GearCCW);
ppFxUeberschreiben('dark_wave_engulf', ppFx11DarkWave);
ppFxUeberschreiben('dino_bite', ppFx11Biss);
ppFxUeberschreiben('disruption_impact', ppFx11Disruption);
ppFxUeberschreiben('dive_down', ppFx11DiveDown);
ppFxUeberschreiben('dog_bite', ppFx11DogBite);
ppFxUeberschreiben('dumbbell_pump', ppFx11Dumbbell);
ppFxUeberschreiben('earth_rift', ppFx11EarthRift);
ppFxUeberschreiben('egg_of_god_glow', ppFx11EggGlow);
ppFxUeberschreiben('electric_strike', ppFx11Electric);
ppFxUeberschreiben('emergency_spell_armor', ppFx11Ruestung);
