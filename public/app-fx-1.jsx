// Pixelart-Portierungen (Canvas), Batch 1: siehe app-fx-0.jsx. Jede Portierung: `ppFxUeberschreiben('typ', Komponente)`.
//
// Hier: ankylo_tail_smash, armageddon, assassination_cut, battle_axe_cleave, biseria_ice_engulf, blood_moon_pulse, blue_ice_flames, bomblebee_carpet, bomblebee_cluster,
// bomblebee_detonate, bomblebee_fuse, cataclysm, club_bash. Alle auf EINER Leinwand je Effekt (`ppR1Leinwand`, app-board.jsx): ein Rasterpixel = 3 Bildschirmpixel, 30 Bilder/s,
// Palettenfarben, Bayer-Dithering statt Alpha, Verlaeufe als gedithertes Stufenfeld, Drehungen nur als Geometrie (Pixel werden einzeln berechnet, kein Bild wird gedreht).
// Die Zeiten, Groessen und Anker folgen den alten DOM-Fassungen (`ANIM_REGISTRY`, Keyframes in style.css); Zonen-Animationen laufen beim Aufrufer 1000 ms (`onZoneAnim`).

// ── gemeinsame Bausteine (Praefix ppFx1) ─────────────────────────────────────────────────────────────────────────────
const ppFx1Raus = (u) => 1 - (1 - u) * (1 - u);                 // CSS „ease-out" (grob)
const ppFx1Raus3 = (u) => 1 - Math.pow(1 - u, 3);                 // starkes Abbremsen (cubic-bezier(.12,.72,.28,1) o. ae.)
const ppFx1Rein = (u) => u * u;                                   // CSS „ease-in" (grob)
const ppFx1Glatt = (u) => { u = ppR1Klemme(u); return u * u * (3 - 2 * u); };
/** 0..1 linear zwischen `a` und `b` (ms). */
const ppFx1Lin = (t, a, b) => ppR1Klemme((t - a) / (b - a));
/** Keyframes: `pts` = [[u, wert], …] aufsteigend, dazwischen linear (oder mit `ease` je Abschnitt, wie die CSS-Zeitfunktion je Keyframe-Abschnitt). */
function ppFx1Kf(u, pts, ease) {
  if (u <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (u <= pts[i][0]) {
      let k = (u - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0]);
      if (ease) k = ease(k);
      return pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k;
    }
  }
  return pts[pts.length - 1][1];
}
/** Farbstopps eines Radialverlaufs: [[Lage 0..1, '#hex', Deckung], …] → mit RGB-Feldern. */
const ppFx1St = (arr) => arr.map(([p, h, a]) => [p, ppHex(h), a]);
const PP_FX1_BAY = new Float32Array(16), PP_FX1_BAY2 = new Float32Array(16);
for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { PP_FX1_BAY[y * 4 + x] = ppBayer(x, y); PP_FX1_BAY2[y * 4 + x] = ppBayer(x + 2, y + 1); }
/** Nachschlagetabelle eines Stopp-Verlaufs (einmal je Stoppliste): Abschnitt, Mischanteil und Deckung je Abstandsstufe — spart im Bild die Suche und die Wurzel. */
function ppFx1Lut(stops) {
  if (stops._lut) return stops._lut;
  const N = 1024, n = stops.length, last = stops[n - 1][0], f = new Float32Array(N), al = new Float32Array(N), k = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const d = (i + 0.5) / N * last;
    let q = 0;
    while (q < n - 2 && d >= stops[q + 1][0]) q++;
    const s0 = stops[q], s1 = stops[q + 1], ff = Math.min(1, (d - s0[0]) / (s1[0] - s0[0]));
    k[i] = q; f[i] = ff; al[i] = s0[2] + (s1[2] - s0[2]) * ff;
  }
  return (stops._lut = { N, last, f, al, k, scale: N / last });
}
/** Gestufter Radial-/Ellipsenverlauf (Mittelpunkt cx/cy, Radien rx/ry in Rasterpixeln): zwischen zwei Stopps wird gedithert, die Deckung ebenfalls (nie Alpha). `lim` = [halbeBreite, halbeHoehe] beschneidet auf ein Rechteck, `klip` = [x, y, r] auf einen Kreis. */
function ppFx1Radial(g, sz, cx, cy, rx, ry, stops, a = 1, lim, klip) {
  if (a <= 0 || rx < 0.6 || ry < 0.6) return;
  cx = Math.round(cx); cy = Math.round(cy);
  const L = ppFx1Lut(stops), last = L.last, sc = L.scale;
  const RX = Math.ceil(rx * last), RY = Math.ceil(ry * last);
  const i0 = Math.max(-RX, -cx, lim ? -lim[0] : -RX), i1 = Math.min(RX, sz.gw - 1 - cx, lim ? lim[0] : RX);
  const j0 = Math.max(-RY, -cy, lim ? -lim[1] : -RY), j1 = Math.min(RY, sz.gh - 1 - cy, lim ? lim[1] : RY);
  const irx = 1 / (rx * rx), iry = 1 / (ry * ry);
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const d = Math.sqrt(i * i * irx + j * j * iry);
    if (d >= last) continue;
    const X = cx + i, Y = cy + j;
    if (klip && (X - klip[0]) * (X - klip[0]) + (Y - klip[1]) * (Y - klip[1]) > klip[2] * klip[2]) continue;
    const di = (d * sc) | 0, al = L.al[di] * a;
    if (al <= 0.03) continue;
    const bi = (Y & 3) * 4 + (X & 3);
    if (al < 1 && PP_FX1_BAY[bi] >= al) continue;
    const kk = L.k[di];
    g.put(X, Y, L.f[di] > PP_FX1_BAY2[bi] ? stops[kk + 1][1] : stops[kk][1], 1);
  }
}
/** Radialverlauf ueber das GANZE Bild mit vorberechneten Abstaenden `dist` (Bildschirmpixel zum Mittelpunkt, je Rasterpixel): Radius `Rpx`, Stopps in Einheiten von `Rpx`. */
function ppFx1Voll(g, sz, dist, Rpx, stops, a = 1) {
  if (a <= 0 || Rpx < 1) return;
  const gw = sz.gw, gh = sz.gh, L = ppFx1Lut(stops), last = L.last, sc = L.scale / Rpx, lim = last * Rpx;
  let idx = 0;
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++, idx++) {
    const dd = dist[idx];
    if (dd >= lim) continue;
    const di = (dd * sc) | 0, al = L.al[di] * a;
    if (al <= 0.03) continue;
    const bi = (j & 3) * 4 + (i & 3);
    if (al < 1 && PP_FX1_BAY[bi] >= al) continue;
    const kk = L.k[di];
    g.put(i, j, L.f[di] > PP_FX1_BAY2[bi] ? stops[kk + 1][1] : stops[kk][1], 1);
  }
}
/** Abstaende (Bildschirmpixel) jedes Rasterpixels zu einem Punkt (cx/cy in Rasterpixeln) — einmal vorberechnet. */
function ppFx1Abstaende(sz, cx, cy) {
  const dist = new Float32Array(sz.gw * sz.gh), S = sz.S;
  let idx = 0;
  for (let j = 0; j < sz.gh; j++) { const dy = (j - cy) * S, dy2 = dy * dy; for (let i = 0; i < sz.gw; i++, idx++) { const dx = (i - cx) * S; dist[idx] = Math.sqrt(dx * dx + dy2); } }
  return dist;
}
/** Ring/Kreisring zwischen den Radien `r0` und `r1` (Rasterpixel); `ky` staucht die Hoehe (Ellipse). Pixel auf Winkelschritten, keine Luecken. */
function ppFx1Ring(g, cx, cy, r0, r1, c, a = 1, ky = 1) {
  if (a <= 0 || r1 < 0.5) return;
  if (r0 > r1 - 1) r0 = r1 - 1;
  const n = Math.max(12, Math.ceil(Math.PI * 2 * r1 * 1.3));
  const rs = []; for (let r = Math.max(0, r0); r <= r1 + 1e-6; r += 0.7) rs.push(r);
  if (!rs.length) rs.push(r1);
  for (let k = 0; k < n; k++) {
    const w = (k / n) * Math.PI * 2, co = Math.cos(w), si = Math.sin(w);
    for (let q = 0; q < rs.length; q++) g.put(cx + co * rs[q], cy + si * rs[q] * ky, c, a);
  }
}
/** Kugel aus gestuften Scheiben: `pal` von aussen (dunkel) nach innen (hell). */
function ppFx1Ball(g, cx, cy, r, pal, a = 1) {
  const n = pal.length;
  for (let k = 0; k < n; k++) { const rr = r * (1 - k / n); if (rr >= 0.5 || k === n - 1) g.disc(cx, cy, Math.max(0.5, rr), pal[k], a); }
}
/** Rundes Teilchen in passender Pixelgroesse: Durchmesser `d` Rasterpixel. */
function ppFx1Punkt(g, x, y, d, c, a = 1) {
  if (d < 0.7 || a <= 0) return;
  if (d >= 3.2) g.disc(x, y, d / 2, c, a);
  else { const n = Math.max(1, Math.round(d)); g.block(x - n / 2, y - n / 2, n, n, c, a); }
}
/** Teilchen wie `.anim-explosion-particle`: Flug nach (dx,dy) in Bildschirmpixeln (ease-out), Groesse 1,2× → 0, Deckung 1 → 0 ab 20 %. */
function ppFx1Teilchen(g, t, p, cx, cy, S, sk0 = 1.2) {
  const u = (t - p.delay) / p.dur;
  if (u < 0 || u > 1) return;
  const e = ppFx1Raus(u), a = u < 0.2 ? 1 : 1 - ppFx1Raus((u - 0.2) / 0.8);
  ppFx1Punkt(g, cx + p.dx * e / S, cy + p.dy * e / S, p.size * sk0 * (1 - e) / S, p.farbe, a);
}
const ppFx1Wahl = (arr) => arr[Math.floor(Math.random() * arr.length)];
/** Sprite mit ganzzahliger Vergroesserung `z` (Zeichenfeld wie PP_R1_FSCHLAG_BILD). */
function ppFx1Spr(g, zeilen, pal, cx, cy, z, a = 1) {
  const h = zeilen.length, w = zeilen[0].length, x0 = Math.round(cx - w * z / 2), y0 = Math.round(cy - h * z / 2);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const c = pal[zeilen[j][i]]; if (c) g.block(x0 + i * z, y0 + j * z, z, z, c, a); }
}
/** Fuellt ein gedrehtes Rechteck/eine Form: Geometrie wird gedreht (um `winkel` Grad, Uhrzeigersinn), jedes Rasterpixel einzeln befragt — `farbe(lx, ly)` (Bildschirmpixel um die Mitte) gibt eine Farbe oder null. */
function ppFx1Gedreht(g, sz, cx, cy, winkel, halbW, halbH, farbe, a = 1) {
  if (a <= 0) return;
  const S = sz.S, w = winkel * Math.PI / 180, co = Math.cos(w), si = Math.sin(w);
  const R = Math.ceil(Math.hypot(halbW, halbH) / S) + 1;
  cx = Math.round(cx); cy = Math.round(cy);
  for (let j = -R; j <= R; j++) {
    const Y = cy + j; if (Y < 0 || Y >= sz.gh) continue;
    for (let i = -R; i <= R; i++) {
      const X = cx + i; if (X < 0 || X >= sz.gw) continue;
      const px = i * S, py = j * S;
      const lx = px * co + py * si, ly = -px * si + py * co;       // zurueck ins Eigensystem
      if (lx < -halbW || lx > halbW || ly < -halbH || ly > halbH) continue;
      const c = farbe(lx, ly, X, Y);
      if (c) g.put(X, Y, c, a);
    }
  }
}
/** Balken entlang der Richtung (ux,uy) ab (ax,ay) (Rasterpixel): `s0..s1` Laenge, `halbT` halbe Dicke (Bildschirmpixel); `farbe(s, t)` → Farbe/null. */
function ppFx1Balken(g, S, ax, ay, ux, uy, s0, s1, halbT, farbe, a = 1) {
  if (a <= 0) return;
  const nx = -uy, ny = ux, st = 0.6 * S;
  for (let s = s0; s <= s1; s += st) {
    for (let q = -halbT; q <= halbT; q += st) {
      const c = farbe(s, q);
      if (c) g.put(ax + (ux * s + nx * q) / S, ay + (uy * s + ny * q) / S, c, a);
    }
  }
}
/** Gefuellte Dreieck-Spitze: Eckpunkte in Rasterpixeln. */
function ppFx1Dreieck(g, x0, y0, x1, y1, x2, y2, farbe, a = 1) {
  const l = Math.floor(Math.min(x0, x1, x2)), r = Math.ceil(Math.max(x0, x1, x2)), o = Math.floor(Math.min(y0, y1, y2)), u = Math.ceil(Math.max(y0, y1, y2));
  const d = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2);
  if (Math.abs(d) < 1e-6) return;
  for (let Y = o; Y <= u; Y++) for (let X = l; X <= r; X++) {
    const a1 = ((y1 - y2) * (X - x2) + (x2 - x1) * (Y - y2)) / d, a2 = ((y2 - y0) * (X - x2) + (x0 - x2) * (Y - y2)) / d, a3 = 1 - a1 - a2;
    if (a1 < -0.05 || a2 < -0.05 || a3 < -0.05) continue;
    const c = farbe(a1, a2, a3);
    if (c) g.put(X, Y, c, a);
  }
}
/** Flamme als Pixelform (Fuss unten bei `by`, Spitze oben): Breite `B`, Hoehe `H` in Rasterpixeln; innen heiss (gelb-weiss), aussen rot, Uebergaenge im Bayer-Raster. */
const PP_FX1_FLAMME = ['#cc2b00', '#f87420', '#fad54a', '#fffbd2'].map(ppHex);
function ppFx1Flamme(g, cx, by, B, H, a, seed) {
  cx = Math.round(cx); by = Math.round(by);
  B = Math.max(2, B); H = Math.max(2, H);
  for (let j = 0; j < Math.round(H); j++) {
    const v = j / H;
    const hw = (B / 2) * (v < 0.22 ? 0.8 + v * 0.9 : Math.pow(1 - (v - 0.22) / 0.78, 0.8));
    if (hw < 0.45) continue;
    const kurve = Math.round(Math.sin(v * 3.2 + seed) * B * 0.1 * v), y = by - j, hr = Math.ceil(hw);
    for (let i = -hr; i <= hr; i++) {
      const nx = Math.abs(i) / hw;
      if (nx > 1) continue;
      const heat = (1 - nx * 0.9) * (1 - v * 0.65) + (ppBayer(cx + i, y) - 0.5) * 0.3;
      g.put(cx + i + kurve, y, PP_FX1_FLAMME[heat > 0.62 ? 3 : heat > 0.42 ? 2 : heat > 0.2 ? 1 : 0], a);
    }
  }
}
/** Zonenmasse: Standard 64×90 wie `ppR1Leinwand`. */
const ppFx1Zone = (p) => ({ w: Math.max(p.w || 100, 40), h: Math.max(p.h || 140, 40) });

// ═════════════════════════════════════════════════════════════════
//  Bomblebee-Familie: carpet · cluster · detonate · fuse — gelb/schwarz/orange Sprengungen als gestufte Kugeln mit Dither-Schein
// ═════════════════════════════════════════════════════════════════
const PP_FX1_BB = {
  gelb: ['#ff8b1a', '#fad54a', '#fffbd2'].map(ppHex),            // hue ≥ 45
  amber: ['#f87420', '#f9ac20', '#fbe181'].map(ppHex),            // hue ≥ 34
  orange: ['#7d3911', '#ff7d00', '#ffd066'].map(ppHex),           // darunter
  schwarz: ppHex('#1f0f04'),
  rauch: ppFx1St([[0, '#393123', 0.65], [0.6, '#27180c', 0.35], [1, '#27180c', 0]]),
};
const ppFx1BBFarben = (hue) => (hue >= 45 ? PP_FX1_BB.gelb : hue >= 34 ? PP_FX1_BB.amber : PP_FX1_BB.orange);
/** „Knall"-Kugel: Rand dunkel, Mitte hell, dazu ein gedithertes Leuchten aussen. */
function ppFx1Knall(g, cx, cy, r, hue, a) {
  if (r < 0.7 || a <= 0) return;
  const f = ppFx1BBFarben(hue);
  g.ring(cx, cy, r, r + 1.6, f[0], a * 0.45);
  ppFx1Ball(g, cx, cy, r, [PP_FX1_BB.orange[0], f[0], f[1], f[2]], a);
}

// 2. bomblebee_carpet — eine Reihe kleiner Sprengungen quer ueber den Helden, dazwischen Rauch (Start versetzt je 60 ms); 7 Knalle + 10 Rauchwolken.
const ppFx1Carpet = ppR1Leinwand((g, t, sz, d) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy;
  for (const s of d.rauch) {
    const u = (t - s.delay) / s.dur;
    if (u < 0 || u > 1) continue;
    const sk = ppFx1Kf(u, [[0, 0.6], [0.4, 1.1], [1, 1.6]], ppFx1Raus), al = ppFx1Kf(u, [[0, 0], [0.4, 0.7], [1, 0]], ppFx1Raus);
    const rise = ppFx1Kf(u, [[0, 0], [0.4, -6], [1, -22]], ppFx1Raus), r = s.size / 2 * sk / S;
    ppFx1Radial(g, sz, cx + s.x / S, cy + (s.y + rise) / S, r, r, PP_FX1_BB.rauch, al * 1.1);
  }
  for (const b of d.knalle) {
    const u = (t - b.delay) / b.dur;
    if (u < 0 || u > 1) continue;
    const sk = ppFx1Kf(u, [[0, 0.25], [0.35, 1.15], [1, 1.6]], ppFx1Raus), al = ppFx1Kf(u, [[0, 0], [0.35, 1], [1, 0]], ppFx1Raus);
    ppFx1Knall(g, cx + b.x / S, cy + b.y / S, b.size / 2 * sk / S, b.hue, al);
  }
}, 1500, (p) => {
  const cw = p.w || 110;
  return { breite: cw + 150, hoehe: 150 };
}, {
  z: 10100,
  vorbereiten: (sz) => {
    const cw = sz.props.w || 110, n7 = ppFxN(7);
    return {
      knalle: Array.from({ length: n7 }, (_, i) => ({
        x: -cw * 0.45 + (i / Math.max(1, n7 - 1)) * cw * 0.9 + (Math.random() - 0.5) * 8, y: -20 + Math.random() * 40,
        size: 14 + Math.random() * 12, delay: i * 60 + Math.random() * 30, dur: 380 + Math.random() * 200, hue: 18 + Math.random() * 22,
      })),
      rauch: Array.from({ length: ppFxN(10) }, () => ({
        x: -cw * 0.35 + Math.random() * cw * 0.7, y: -10 + Math.random() * 30, size: 18 + Math.random() * 14, delay: 200 + Math.random() * 300, dur: 700 + Math.random() * 300,
      })),
    };
  },
});

// 6. bomblebee_cluster — drei schnelle Sprengungen nacheinander (Gelb → Orange), dazu gelbe und schwarze Splitter, die auseinanderstieben.
const ppFx1Cluster = ppR1Leinwand((g, t, sz, d) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy;
  for (const b of d.knalle) {
    const u = (t - b.delay) / 520;
    if (u < 0 || u > 1) continue;
    const sk = ppFx1Kf(u, [[0, 0.3], [0.4, 1.2], [1, 1.8]], ppFx1Raus), al = ppFx1Kf(u, [[0, 0], [0.4, 1], [1, 0]], ppFx1Raus);
    ppFx1Knall(g, cx + b.x / S, cy + b.y / S, b.size / 2 * sk / S, b.hue, al);
  }
  for (const s of d.splitter) {
    const u = (t - s.delay) / 700;
    if (u < 0 || u > 1) continue;
    const e = ppFx1Raus(u);
    ppFx1Punkt(g, cx + s.dx * e / S, cy + s.dy * e / S, 6 * (1 - e) / S * 1.4, s.schwarz ? PP_FX1_BB.schwarz : PP_FX1_BB.gelb[1], 1 - e * e);
  }
}, 1200, { breite: 220, hoehe: 220 }, {
  z: 10100,
  vorbereiten: () => ({
    knalle: [{ x: -28, y: -10, size: 32, delay: 0, hue: 50 }, { x: 28, y: -22, size: 38, delay: 120, hue: 38 }, { x: 0, y: 22, size: 44, delay: 250, hue: 30 }],
    splitter: Array.from({ length: ppFxN(14) }, (_, i) => {
      const w = Math.random() * Math.PI * 2, dist = 25 + Math.random() * 35;
      return { dx: Math.cos(w) * dist, dy: Math.sin(w) * dist, schwarz: i % 3 === 0, delay: 100 + i * 25 };
    }),
  }),
});

// 5. bomblebee_detonate — die grosse Entladung: weissglühender Kern, drei Druckwellenringe, Funkenregen (Weiss/Gelb/Orange/Rot).
const PP_FX1_DETO = {
  farben: ['#ffffff', '#fffbd2', '#f9ac20', '#ff491a', '#fad54a', '#7a1900'].map(ppHex),
  ringe: ['#ffd066', '#ff8b1a', '#f87420'].map(ppHex),
  kern: ppFx1St([[0, '#fff8e8', 1], [0.3, '#f9ac20', 0.85], [0.7, '#b62600', 0.5], [1, '#b62600', 0]]),
};
const ppFx1Detonate = ppR1Leinwand((g, t, sz, d) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy;
  // Kern (600 ms): Groesse .4 → 1,6 → 2, Deckung 1 → .8 → 0
  const uk = t / 600;
  if (uk <= 1) {
    const sk = ppFx1Kf(uk, [[0, 0.4], [0.5, 1.6], [1, 2]], ppFx1Raus), al = ppFx1Kf(uk, [[0, 1], [0.5, 0.8], [1, 0]], ppFx1Raus);
    const r = 40 * sk / S;
    ppFx1Radial(g, sz, cx, cy, r, r, PP_FX1_DETO.kern, al);
  }
  // Druckwellen: 700 ms, Ring 110 px, Groesse .3 → 1,2 → 2,4, versetzt 0/130/250 ms
  [0, 130, 250].forEach((v, i) => {
    const u = (t - v) / 700;
    if (u < 0 || u > 1) return;
    const sk = ppFx1Kf(u, [[0, 0.3], [0.3, 1.2], [1, 2.4]], ppFx1Raus), al = ppFx1Kf(u, [[0, 0], [0.3, 1], [1, 0]], ppFx1Raus) * (0.85 - i * 0.2) / 0.85;
    const r1 = 55 * sk / S, dick = Math.max(1, (4 - i) * sk / S);
    g.ring(cx, cy, Math.max(0, r1 - dick - 1.4), r1 + 1.4, PP_FX1_DETO.ringe[2], al * 0.4);          // Schein (aussen/innen)
    ppFx1Ring(g, cx, cy, r1 - dick, r1, PP_FX1_DETO.ringe[i], al);
  });
  for (const p of d.teile) ppFx1Teilchen(g, t, p, cx, cy, S, 1.4);
}, 1150, { breite: 340, hoehe: 340 }, {
  z: 10100,
  vorbereiten: () => ({
    teile: Array.from({ length: ppFxN(38) }, () => {
      const w = Math.random() * Math.PI * 2, v = 35 + Math.random() * 75;
      return { dx: Math.cos(w) * v, dy: Math.sin(w) * v, size: 4 + Math.random() * 9, farbe: ppFx1Wahl(PP_FX1_DETO.farben), delay: Math.random() * 120, dur: 500 + Math.random() * 500 };
    }),
  }),
});

// 7. bomblebee_fuse — die Zuendschnur: braune Linie quer ueber die Zone, ein Funkenball laeuft von links nach rechts (700 ms), Funken entlang der Schnur, am Ende ein Blitz.
const PP_FX1_FUSE = {
  schnur: ['#6e4421', '#886c44', '#a89370', '#b29466'].map(ppHex),
  ball: ppFx1St([[0, '#fffbd2', 1], [0.5, '#ff8b1a', 1], [0.9, '#ff491a', 0.6], [1, '#ff491a', 0]]),
  schein: ppFx1St([[0, '#ff7d00', 0.35], [1, '#ff491a', 0]]),
  blitz: ppFx1St([[0, '#f7f7ad', 1], [0.5, '#ff9a1a', 0.7], [1, '#ff9a1a', 0]]),
  funke: ppHex('#fad54a'), funkeRand: ppHex('#ff9a1a'),
};
const ppFx1Fuse = ppR1Leinwand((g, t, sz, d) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, cw = sz.props.w || 110, L = cw * 0.9 / S, x0 = cx - cw * 0.45 / S;
  // Schnur (2 Zeilen), Enden dunkler
  const aus = ppR1Aus(t, 860, 1000);
  if (aus > 0) {
    const ys = Math.round(cy);
    for (let i = 0; i < L; i++) {
      const m = Math.abs(i / L - 0.5) * 2, c = m < 0.35 ? PP_FX1_FUSE.schnur[3] : m < 0.7 ? PP_FX1_FUSE.schnur[2] : PP_FX1_FUSE.schnur[1];
      g.put(x0 + i, ys - 1, c, aus); g.put(x0 + i, ys, PP_FX1_FUSE.schnur[0], aus);
    }
  }
  // Funkenball: 700 ms, Weg 0 → 90 % der Breite, Deckung 0 → 1 (15 %)
  const ub = t / 700;
  if (t < 960) {
    const w = ppFx1Glatt(ub), x = x0 + L * w, al = ppFx1Lin(t, 0, 105) * (t < 860 ? 1 : ppR1Aus(t, 860, 960));
    ppFx1Radial(g, sz, x, cy, 8, 8, PP_FX1_FUSE.schein, al);
    ppFx1Radial(g, sz, x, cy, 4.6, 4.6, PP_FX1_FUSE.ball, al);
  }
  // Funken entlang der Schnur
  for (const s of d.funken) {
    const u = (t - s.delay) / s.dur;
    if (u < 0 || u > 1) continue;
    const sk = ppFx1Kf(u, [[0, 0.4], [0.5, 1.4], [1, 0.8]]), al = ppFx1Kf(u, [[0, 0], [0.5, 1], [1, 0]]), n = s.size * sk / S;
    ppFx1Punkt(g, x0 + L * s.pos, cy, n, PP_FX1_FUSE.funke, al);
    if (n >= 2.6) g.ring(x0 + L * s.pos, cy, n / 2, n / 2 + 1, PP_FX1_FUSE.funkeRand, al * 0.5);
  }
  // Blitz am Ende (ab 600 ms, 400 ms): Groesse .3 → 1,4 → 2, Deckung 0 → 1 → 0
  const uf = (t - 600) / 400;
  if (uf >= 0 && uf <= 1) {
    const sk = ppFx1Kf(uf, [[0, 0.3], [0.4, 1.4], [1, 2]], ppFx1Raus), al = ppFx1Kf(uf, [[0, 0], [0.4, 1], [1, 0]], ppFx1Raus), r = 25 * sk / S;
    ppFx1Radial(g, sz, x0 + L, cy, r, r, PP_FX1_FUSE.blitz, al);
  }
}, 1050, (p) => ({ breite: (p.w || 110) + 120, hoehe: 140 }), {
  z: 10100,
  vorbereiten: () => {
    const n18 = ppFxN(18);
    return {
      funken: Array.from({ length: n18 }, (_, i) => ({ pos: i / Math.max(1, n18 - 1), delay: i * 18 + Math.random() * 30, dur: 320 + Math.random() * 180, size: 3 + Math.random() * 4 })),
    };
  },
});


// ═════════════════════════════════════════════════════════════════
//  blood_moon_pulse (Blood Moon under the Sea, Blood Rock) — dunkelroter Halo, ein Blutmond gleitet ueber der Karte ein, rote Lichtstrahlen stossen nach unten (die alte Fassung
//  zeichnet alle sieben Strahlen senkrecht uebereinander, weil die Keyframes den Winkel ueberschreiben — hier genauso), rote Tropfen rinnen an der Karte vorbei. ~1100 ms.
// ═════════════════════════════════════════════════════════════════
const PP_FX1_BLUT = {
  halo: ppFx1St([[0, '#8c0014', 0.55], [0.4, '#520a0c', 0.35], [0.8, '#520a0c', 0], [1, '#520a0c', 0]]),
  rand: ppHex('#b5171c'),
  mond: { rand: ppHex('#3a0000'), t: ['#e92f38', '#b21a29', '#780014', '#3a0000'].map(ppHex) },
  mondSchein: ['#520a0c', '#8c0014'].map(ppHex),
  strahl: ['#e73b41', '#b5171c', '#8c0014'].map(ppHex),
  tropfen: ['#e92f38', '#8c0014'].map(ppHex),
};
const ppFx1BloodMoon = ppR1Leinwand((g, t, sz, d) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, C = PP_FX1_BLUT;
  // Halo (1100 ms): 110 px, Groesse .55 → 1,08 → 1,25, Deckung 0 → 1 → 0
  const uh = t / 1100;
  if (uh <= 1) {
    const sk = ppFx1Kf(uh, [[0, 0.55], [0.4, 1.08], [1, 1.25]], ppFx1Raus), al = ppFx1Kf(uh, [[0, 0], [0.4, 1], [1, 0]], ppFx1Raus), r = 55 * sk / S;
    ppFx1Radial(g, sz, cx, cy, r * 1.4, r * 1.4, C.halo, al, [r, r]);
    g.ring(cx, cy, r - 0.3, r + 1.2, C.rand, al * 0.55);
  }
  // Blutmond (1000 ms): Mitte 56 px ueber der Karte, steigt 14 → 0 → −6, Groesse .4 → 1,15 → 1, Deckung 0 → 1 → .85
  const um = t / 1000;
  if (um <= 1) {
    const sk = ppFx1Kf(um, [[0, 0.4], [0.35, 1.15], [1, 1]], ppFx1Raus), al = ppFx1Kf(um, [[0, 0], [0.35, 1], [1, 0.85]], ppFx1Raus), ty = ppFx1Kf(um, [[0, 14], [0.35, 0], [1, -6]], ppFx1Raus);
    const r = 18 * sk / S, mx = cx, my = cy + (-56 + ty) / S;
    g.glow(mx, my, r + 5, r + 5, C.mondSchein, al * 0.8);
    ppW76Kugel(g, mx, my, Math.max(1.5, r), C.mond, al);
    if (r > 3) { g.put(mx + r * 0.3, my + r * 0.2, C.mond.t[3], al); g.put(mx - r * 0.35, my + r * 0.4, C.mond.t[2], al); }
  }
  // Strahlen: von 58 px ueber der Mitte nach unten, wachsen in 35 % auf die Laenge
  for (const r of d.strahlen) {
    const u = (t - r.delay) / r.dur;
    if (u < 0 || u > 1) continue;
    const al = ppFx1Kf(u, [[0, 0], [0.35, 1], [0.8, 0.85], [1, 0]]), sk = ppFx1Kf(u, [[0, 0], [0.35, 1], [1, 1]], ppFx1Raus), n = Math.round(r.len * sk / S), y0 = cy - 58 / S;
    for (let j = 0; j < n; j++) {
      const v = j / (r.len / S), c = v < 0.45 ? C.strahl[0] : v < 0.75 ? C.strahl[1] : C.strahl[2];
      if (v > 0.9 && (j & 1)) continue;                                              // Spitze franst aus
      g.put(cx, y0 + j, c, al); g.put(cx + 1, y0 + j, c, al * 0.7);
      g.put(cx - 1, y0 + j, C.strahl[2], al * 0.3); g.put(cx + 2, y0 + j, C.strahl[2], al * 0.3);
    }
  }
  for (const p of d.tropfen) {
    const u = (t - p.delay) / p.dur;
    if (u < 0 || u > 1) continue;
    const y = cy + (p.y0 + (p.y1 - p.y0) * ppFx1Rein(u)) / S, x = cx + p.x / S, al = ppFx1Kf(u, [[0, 0], [0.2, 1], [1, 0]]);
    const w = Math.max(1, Math.round(p.size / S)), h = Math.max(2, Math.round(p.size * 1.4 * (1 + 0.2 * u) / S));
    g.block(x, y, w, h, C.tropfen[0], al);
    g.put(x + w - 1, y + h - 1, C.tropfen[1], al); if (w > 1) g.put(x, y, C.tropfen[1], al * 0.6);
  }
}, 1400, { breite: 220, hoehe: 260, ankerY: 150 }, {
  z: 10100,
  vorbereiten: () => ({
    strahlen: Array.from({ length: ppFxN(7) }, () => ({ len: 70 + Math.random() * 30, delay: Math.random() * 150, dur: 700 + Math.random() * 250 })),
    tropfen: Array.from({ length: ppFxN(14) }, () => ({ x: -30 + Math.random() * 60, y0: -30 + Math.random() * 10, y1: 70 + Math.random() * 30, delay: 120 + Math.random() * 320, dur: 650 + Math.random() * 300, size: 3 + Math.random() * 4 })),
  }),
});

// ═════════════════════════════════════════════════════════════════
//  assassination_cut (Midnight Assault) — Dunkelheit faellt ueber das Ziel (dunkler Ring, 0–1000 ms), eine Mondsichel blitzt oben rechts auf, ein weisser Blitz und EIN duenner
//  Silberschnitt reisst bei 280 ms von links unten nach rechts oben ueber die Karte (klafft auf, zwei Nachbilder driften auseinander), Silber-/Violett-Splitter fliegen entlang der Linie.
// ═════════════════════════════════════════════════════════════════
const PP_FX1_ASSA = {
  schleier: ppFx1St([[0, '#12101f', 0], [0.255, '#12101f', 0], [0.64, '#12101f', 0.78], [0.9, '#12101f', 0.55], [1, '#12101f', 0]]),
  blitz: ppFx1St([[0, '#ffffff', 0.95], [0.5, '#d6bbf1', 0.55], [1, '#d6bbf1', 0]]),
  mond: ppHex('#e5edfa'), mondSchein: ppHex('#d6bbf1'),
  schnitt: ['#ffffff', '#e5edfa', '#d6bbf1', '#a952ff', '#7a2bd0'].map(ppHex),
  nach: ppHex('#a952ff'),
  splitter: ['#e5edfa', '#c98aff'].map(ppHex),
};
const ppFx1Assassin = ppR1Leinwand((g, t, sz, d) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, C = PP_FX1_ASSA, ww = d.ww, hh = d.hh;
  // Schleier (1000 ms)
  const uv = t / 1000;
  if (uv <= 1) {
    const sk = ppFx1Kf(uv, [[0, 1.45], [0.28, 1], [0.72, 1], [1, 0.92]], ppFx1Raus), al = ppFx1Kf(uv, [[0, 0], [0.28, 1], [0.72, 0.9], [1, 0]], ppFx1Raus);
    const r = d.schleier / 2 * 1.414 * sk / S;                                       // Verlauf bis zur Ecke des Quadrats
    ppFx1Radial(g, sz, cx, cy, r, r, C.schleier, al, [d.schleier / 2 * sk / S, d.schleier / 2 * sk / S]);
  }
  // Mondsichel (900 ms) oben rechts: Kreis minus verschobener Kreis
  const um = t / 900;
  if (um <= 1) {
    const al = ppFx1Kf(um, [[0, 0], [0.26, 1], [0.7, 1], [1, 0]], ppFx1Raus), sk = ppFx1Kf(um, [[0, 0.6], [0.26, 1], [0.7, 1], [1, 0.9]], ppFx1Raus);
    const off = ppFx1Kf(um, [[0, 6], [0.26, 0], [0.7, 0], [1, -4]], ppFx1Raus);
    const mx = cx + (ww * 0.32 + 13 + off) / S, my = cy + (-hh * 0.52 + 13 + off) / S, r = 13 * sk / S;
    g.glow(mx, my, r + 3.5, r + 3.5, [C.nach, C.mondSchein], al * 0.5);
    const R = Math.ceil(r) + 1, ex = 8 * sk / S, ey = -6 * sk / S;
    for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) {
      if (i * i + j * j > r * r + r * 0.5) continue;
      if ((i - ex) * (i - ex) + (j - ey) * (j - ey) <= r * r + r * 0.5) continue;
      g.put(mx + i, my + j, C.mond, al);
    }
  }
  // Blitz (380 ms ab 280)
  const ub = (t - 280) / 380;
  if (ub >= 0 && ub <= 1) {
    const sk = ppFx1Kf(ub, [[0, 0.25], [0.3, 1], [1, 1.7]], ppFx1Raus), al = ppFx1Kf(ub, [[0, 0], [0.3, 1], [1, 0]], ppFx1Raus), r = ww * 0.45 * sk * 1.414 / S;
    ppFx1Radial(g, sz, cx, cy, r, r, C.blitz, al, [ww * 0.45 * sk / S, ww * 0.45 * sk / S]);
  }
  // Schnittlinie: -38°, von links unten (Anfang) nach rechts oben
  const w = -38 * Math.PI / 180, ux = Math.cos(w), uy = Math.sin(w), L = d.laenge;
  const ax = cx - ux * L / 2 / S, ay = cy - uy * L / 2 / S, nx = -uy, ny = ux;
  const uc = (t - 280) / 640;
  if (uc >= 0 && uc <= 1) {
    const laenge = ppFx1Kf(uc, [[0, 0], [0.14, 1], [1, 1.04]], ppFx1Raus3), dick = ppFx1Kf(uc, [[0, 1], [0.14, 1], [0.45, 2.2], [1, 0]], ppFx1Raus);   // Dicke in Rasterpixeln (3 px = 1)
    const n = Math.round(L / S * laenge);
    for (let i = 0; i <= n; i++) {
      const v = i / (L / S), rand = v < 0.12 ? v / 0.12 : v > 0.88 ? (1 - v) / 0.12 : 1;
      if (rand <= 0.05) continue;
      const hw = dick * rand / 2, px = ax + ux * i, py = ay + uy * i;
      for (let q = -hw - 3; q <= hw + 3; q += 0.5) {
        const aq = Math.abs(q), c = aq <= hw * 0.5 ? C.schnitt[0] : aq <= hw ? C.schnitt[1] : aq <= hw + 1 ? C.schnitt[2] : aq <= hw + 2 ? C.schnitt[3] : C.schnitt[4];
        const a = aq <= hw ? 1 : aq <= hw + 1 ? 0.8 : aq <= hw + 2 ? 0.45 : 0.25;
        g.put(px + nx * q, py + ny * q, c, a * rand);
      }
    }
  }
  // Nachbilder (560 ms ab 360): zwei duenne Linien, driften ±7 px auseinander
  const un = (t - 360) / 560;
  if (un >= 0 && un <= 1) {
    const al = ppFx1Kf(un, [[0, 0], [0.25, 0.85], [1, 0]], ppFx1Raus);
    for (const so of [-7, 7]) {
      const off = so * ppFx1Raus(un) / S, n = Math.round(L * 0.88 / S);
      for (let i = 0; i <= n; i++) {
        const v = i / n, rand = Math.min(1, v / 0.2, (1 - v) / 0.2);
        g.put(ax + ux * (L * 0.06 / S + i) + nx * off, ay + uy * (L * 0.06 / S + i) + ny * off, C.nach, al * rand * 0.9);
      }
    }
  }
  for (const s of d.splitter) {
    const u = (t - s.delay) / s.dur;
    if (u < 0 || u > 1) continue;
    const e = ppFx1Kf(u, [[0, 0], [0.15, 0.15], [1, 1]], ppFx1Raus), sk = ppFx1Kf(u, [[0, 0.6], [0.15, 1.1], [1, 0.3]]), al = ppFx1Kf(u, [[0, 0], [0.15, 1], [1, 0]], ppFx1Raus);
    ppFx1Punkt(g, cx + s.dx * e / S, cy + s.dy * e / S, s.size * sk / S * 1.2, s.farbe, al);
  }
}, 1100, (p) => {
  const ww = Math.max(p.w || 80, 80), hh = Math.max(p.h || 110, 110), sch = Math.max(ww, hh) * 2.3, L = Math.hypot(ww, hh) * 1.35;
  const half = Math.max(sch / 2 * 1.02, Math.cos(38 * Math.PI / 180) * L / 2 + 130, ww * 0.32 + 30);
  return { breite: half * 2, hoehe: Math.max(sch * 1.02, Math.sin(38 * Math.PI / 180) * L + 260) };
}, {
  z: 10110,
  vorbereiten: (sz) => {
    const p = sz.props, ww = Math.max(p.w || 80, 80), hh = Math.max(p.h || 110, 110), rad = -38 * Math.PI / 180;
    return {
      ww, hh, schleier: Math.max(ww, hh) * 2.3, laenge: Math.hypot(ww, hh) * 1.35,
      splitter: Array.from({ length: ppFxN(14) }, (_, i) => {
        const ri = i % 2 === 0 ? 1 : -1, streu = (Math.random() - 0.5) * 0.5, weite = 40 + Math.random() * 70;
        return { dx: Math.cos(rad + streu) * weite * ri, dy: Math.sin(rad + streu) * weite * ri, size: 4 + Math.random() * 4, farbe: Math.random() < 0.6 ? PP_FX1_ASSA.splitter[0] : PP_FX1_ASSA.splitter[1], delay: 300 + Math.random() * 120, dur: 420 + Math.random() * 260 };
      }),
    };
  },
});

// ═════════════════════════════════════════════════════════════════
//  blue_ice_flames (Blue-Ice Dragon auf bereits eingefrorenes Ziel) — zwoelf blaue Flammenzungen schiessen aus allen Richtungen nach innen (620 ms, je 18 ms versetzt), schlagen zusammen
//  (weissblauer Kern, 300 ms ff.), kalte Druckwelle nach aussen (380 ms ff.), Glutfunken steigen auf (420–1100 ms).
// ═════════════════════════════════════════════════════════════════
const PP_FX1_BIF = {
  zunge: ['#3866f0', '#6d9bf8', '#66d9ff', '#e5f5fa', '#ffffff'].map(ppHex),
  kern: ppFx1St([[0, '#ffffff', 1], [0.25, '#b3e8f9', 0.95], [0.55, '#1ca9fd', 0.6], [0.78, '#1ca9fd', 0]]),
  welle: ['#7fdfff', '#4e82cb'].map(ppHex),
  glut: ['#ffffff', '#7bbeea'].map(ppHex),
};
const ppFx1BlueIce = ppR1Leinwand((g, t, sz, d) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, C = PP_FX1_BIF;
  // Kern: 1,8 × Zone, 620 ms ab 300: Groesse .25 → 1,12 → 1,75, Deckung 0 → 1 → 0
  const uk = (t - 300) / 620;
  if (uk >= 0 && uk <= 1) {
    const sk = ppFx1Kf(uk, [[0, 0.25], [0.35, 1.12], [1, 1.75]], ppFx1Raus), al = ppFx1Kf(uk, [[0, 0], [0.35, 1], [1, 0]], ppFx1Raus);
    ppFx1Radial(g, sz, cx, cy, d.cw * 0.9 * sk / S * 1.2, d.ch * 0.9 * sk / S * 1.2, C.kern, al);
  }
  // Zungen
  for (const j of d.zungen) {
    const u = (t - j.delay) / 620;
    if (u < 0 || u > 1) continue;
    const e = ppFx1Kf(u, [[0, 0], [0.72, 1], [1, 1]], (k) => 1 - Math.pow(1 - k, 2.4)), sk = ppFx1Kf(u, [[0, 0.35], [0.72, 1], [1, 1.3]], ppFx1Raus);
    const al = ppFx1Kf(u, [[0, 0], [0.18, 1], [0.72, 1], [1, 0]]);
    const px = cx + j.sx * (1 - e) / S, py = cy + j.sy * (1 - e) / S, ux = Math.cos(j.w), uy = Math.sin(j.w), halb = j.len * sk / 2 / S;
    // innen (hinten) schwach, aussen (Spitze, Richtung Rand) hell — wie der Verlauf der alten Zunge
    ppR1Band(g, px - ux * halb, py - uy * halb, px + ux * halb, py + uy * halb, (v) => {
      if (v < 0.06 || v > 0.97) return null;
      const w = j.dick / S * Math.min(1, v * 6, (1 - v) * 9 + 0.2);
      const c = v < 0.2 ? C.zunge[0] : v < 0.42 ? C.zunge[1] : v < 0.7 ? C.zunge[2] : v < 0.9 ? C.zunge[3] : C.zunge[4];
      return { w: Math.max(1.4, w), c, a: v < 0.2 ? 0.55 : v < 0.42 ? 0.75 : 1 };
    }, al);
  }
  // Druckwelle: Ellipse 3·Zone, 520 ms ab 380, Groesse .25 → 1,15, Deckung .95 → 0
  const us = (t - 380) / 520;
  if (us >= 0 && us <= 1) {
    const sk = ppFx1Kf(us, [[0, 0.25], [1, 1.15]], ppFx1Raus), al = 0.95 * (1 - ppFx1Raus(us)) + 0.0;
    const rx = d.cw * 1.5 * sk / S, ry = d.ch * 1.5 * sk / S;
    ppFx1Ring(g, cx, cy, rx - 1.6, rx, C.welle[0], al, ry / rx);
    ppFx1Ring(g, cx, cy, rx - 3.4, rx - 1.6, C.welle[1], al * 0.5, (ry - 1.6) / Math.max(1, rx - 1.6));
  }
  for (const e of d.glut) {
    const u = (t - e.delay) / e.dur;
    if (u < 0 || u > 1) continue;
    const k = ppFx1Raus(u), al = ppFx1Kf(u, [[0, 0], [0.25, 1], [1, 0]]), r = e.size * (0.5 - 0.3 * k) / S * 1.5;
    const x = cx + e.dx * k / S, y = cy + e.dy * k / S;
    if (r >= 1.6) { g.disc(x, y, r, C.glut[1], al); g.disc(x, y, r * 0.5, C.glut[0], al); } else ppFx1Punkt(g, x, y, Math.max(1, r * 2), C.glut[0], al);
  }
}, 1700, (p) => {
  const z = ppFx1Zone(p), reach = Math.max(z.w, z.h), e = reach * 2.0 + 20;
  return { breite: e * 2, hoehe: e * 2 };
}, {
  z: 10100,
  vorbereiten: (sz) => {
    const z = ppFx1Zone(sz.props), cw = z.w, ch = z.h, reach = Math.max(cw, ch);
    return {
      cw, ch,
      zungen: Array.from({ length: ppFxN(12) }, (_, i, n = ppFxN(12)) => {
        const w = (Math.PI * 2 * i) / n + (i % 2 ? 0.12 : -0.12), dist = reach * 2.0;
        return { w, sx: Math.cos(w) * dist, sy: Math.sin(w) * dist, len: reach * (1.05 + (i % 3) * 0.2), dick: Math.max(9, cw * (0.19 + (i % 4) * 0.04)), delay: 18 * i };
      }),
      glut: Array.from({ length: ppFxN(18) }, () => {
        const a = Math.random() * Math.PI * 2, dd = 30 + Math.random() * reach * 0.9;
        return { dx: Math.cos(a) * dd, dy: Math.sin(a) * dd - 40, size: 5 + Math.random() * 9, delay: 420 + Math.random() * 260, dur: 520 + Math.random() * 420 };
      }),
    };
  },
});

// ═════════════════════════════════════════════════════════════════
//  battle_axe_cleave (Minocrete War Counselor) — eine doppelseitige Streitaxt faehrt von oben rechts herein (520 ms: Drehung um den Griff −78° → 6° → 0° → −8°, Deckung 0 → 1 → 0),
//  schlaegt durch das Ziel, laesst eine helle Schnittspur (ab 250 ms) und Funken (ab 240 ms) zurueck. Die Axt wird als Geometrie gedreht (jedes Rasterpixel einzeln befragt), kein Bild gedreht.
// ═════════════════════════════════════════════════════════════════
const PP_FX1_AXT = {
  stiel: ['#5a3c14', '#ca874e', '#6b4a2a'].map(ppHex),
  knauf: ['#e0c085', '#72541d'].map(ppHex),
  klinge: ['#ffffff', '#d2d2db', '#808898', '#e5edfa'].map(ppHex),
  zwinge: ['#9aa3b6', '#59606e'].map(ppHex),
  schein: ['#808898', '#b4cff8'].map(ppHex),
  spur: ppFx1St([[0, '#fff8e8', 1], [1, '#f7e0b5', 0]]),
  spurFarben: ['#ffffff', '#f7e0b5', '#fff8e8'].map(ppHex),
  funke: ppHex('#f9ecb3'), funkeRand: ppHex('#e0c085'),
};
const ppFx1AxtFarbe = (AX) => (lx, ly, X, Y) => {
  const C = PP_FX1_AXT, pos = ly / AX + 0.06;                                 // Lage im alten Kasten (0 = oben; der Drehpunkt liegt bei 6 %)
  // Klingen (Kasten 70–96 %): links x ∈ [−45, 0], rechts [0, 45]; nach aussen breiter werdend, Spitze rund — wie die gerundete Blattform der alten Axt
  if (pos >= 0.66 && pos <= 1.0) {
    const bx = Math.abs(lx) / 45;
    if (bx <= 1) {
      const halb = 0.5 * (0.3 + 0.7 * Math.pow(bx, 0.55)) * (bx > 0.88 ? Math.sqrt(Math.max(0, 1 - Math.pow((bx - 0.88) / 0.12, 2))) : 1) * 1.28;
      const h = (pos - 0.83) / 0.26;                                          // −0,5 … 0,5 um die Mitte
      if (Math.abs(h) <= halb) {
        if (Math.abs(h) > halb - 0.07 || bx > 0.95) return C.klinge[3];     // heller Rand
        return ppStufe([C.klinge[0], C.klinge[1], C.klinge[2]], (h + halb) / (2 * halb) * 2.1, X, Y);
      }
    }
  }
  if (Math.abs(lx) <= 6 && pos >= 0.72 && pos <= 0.92) return pos < 0.82 ? C.zwinge[0] : C.zwinge[1];
  if (Math.abs(lx) <= 3.2 && pos >= 0.04 && pos <= 0.84) return lx < -1.1 ? C.stiel[0] : lx < 1.1 ? C.stiel[1] : C.stiel[2];
  if (Math.abs(lx) <= 5.3 && pos >= 0.02 && pos <= 0.06) return pos < 0.04 ? C.knauf[0] : C.knauf[1];
  return null;
};
const ppFx1Axt = ppR1Leinwand((g, t, sz, d) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, C = PP_FX1_AXT, AX = d.AX;
  // Axt (520 ms): Drehpunkt 0,78·AX ueber der Zielmitte
  const u = t / 520;
  if (u <= 1) {
    const ease = (k) => ppR1Klemme(ppFx1Kf(k, [[0, 0], [0.5, 0.78], [1, 1]]));            // cubic-bezier(.5,.05,.35,1): zuerst langsam, dann schnell, dann ruhig
    const rot = u < 0.62 ? -78 + 84 * ease(u / 0.62) : u < 0.8 ? 6 - 6 * ((u - 0.62) / 0.18) : -8 * ((u - 0.8) / 0.2);
    const ty = u < 0.62 ? -30 * (1 - ease(u / 0.62)) : u < 0.8 ? 0 : -14 * ((u - 0.8) / 0.2);
    const al = u < 0.25 ? u / 0.25 : u < 0.8 ? 1 : 1 - (u - 0.8) / 0.2;
    const px = cx, py = cy + (-AX * 0.78 + ty) / S;
    // Kopfmitte (0,78·AX unter dem Drehpunkt) fuer den Schein
    const w = rot * Math.PI / 180, hx = px - Math.sin(w) * AX * 0.78 / S, hy = py + Math.cos(w) * AX * 0.78 / S;
    g.glow(hx, hy + 0, 17 / 1, 10, [C.schein[0], C.schein[1]], al * 0.45);
    ppFx1Gedreht(g, sz, px, py, rot, 75, AX * 0.95, ppFx1AxtFarbe(AX), al);
  }
  // Schnittspur (420 ms ab 250): 180 × 8 px, Breite .2 → 1 → 1,15, Deckung 0 → 1 → 0
  const us = (t - 250) / 420;
  if (us >= 0 && us <= 1) {
    const sk = ppFx1Kf(us, [[0, 0.2], [0.3, 1], [1, 1.15]], ppFx1Raus), al = ppFx1Kf(us, [[0, 0], [0.3, 1], [1, 0]], ppFx1Raus), L = 90 * sk / S;
    g.glow(cx, cy, L * 1.05, 4.5, [C.schein[1], C.spurFarben[2]], al * 0.6);
    for (let i = -Math.floor(L); i <= L; i++) {
      const m = Math.abs(i) / L, rand = m > 0.8 ? (1 - m) / 0.2 : 1;
      if (rand <= 0.1) continue;
      const c = m < 0.35 ? C.spurFarben[0] : C.spurFarben[1];
      g.put(cx + i, cy - 1, c, al * rand); g.put(cx + i, cy, C.spurFarben[0], al * rand); g.put(cx + i, cy + 1, c, al * rand * 0.9);
    }
  }
  for (const sp of d.funken) {
    const uf = (t - sp.delay) / sp.dur;
    if (uf < 0 || uf > 1) continue;
    const e = ppFx1Raus(uf), w = sp.angle * Math.PI / 180, al = ppFx1Kf(uf, [[0, 0], [0.15, 1], [1, 0]]);
    ppFx1Punkt(g, cx + Math.cos(w) * sp.dist * e / S, cy + Math.sin(w) * sp.dist * e / S, sp.size * (1 - 0.7 * uf) / S * 1.3, C.funke, al);
  }
}, 1100, (p) => {
  const AX = Math.max(p.h || 120, 120) * 1.6, half = Math.max(250, AX * 1.25);
  return { breite: half * 2, hoehe: AX * 0.78 + 80 + 190, ankerY: AX * 0.78 + 100 };
}, {
  z: 10120,
  vorbereiten: (sz) => ({
    AX: Math.max(sz.props.h || 120, 120) * 1.6,
    funken: Array.from({ length: ppFxN(16) }, () => ({ angle: -20 + Math.random() * 220, dist: 40 + Math.random() * 90, size: 3 + Math.random() * 5, delay: 240 + Math.random() * 140, dur: 380 + Math.random() * 260 })),
  }),
});


// ═════════════════════════════════════════════════════════════════
//  ankylo_tail_smash (Gigantisaur Ankylos) — ein gewaltiger Schwanz mit knochenbesetzter Keule schwingt von oben rechts herab (Drehpunkt = Keulenende; Lage und Drehung nach den
//  Keyframes der alten Fassung, 1300 ms), die Keule landet bei 520 ms auf dem Ziel (Stoss bei 440 ms: die Zone wird gequetscht — Nebenwirkung unveraendert), dahinter Druckring und Blitz (Staub-
//  braun/Gelb) und Knochensplitter. Schwanz und Keule sind gedrehte Geometrie (Pixel einzeln berechnet).
// ═════════════════════════════════════════════════════════════════
const PP_FX1_ANK = {
  schwanz: ['#3a5a25', '#2f4e1d', '#18300a', '#0f2412'].map(ppHex), rand: ppHex('#0a1a04'),
  keule: { rand: ppHex('#0a1a04'), t: ['#5b9438', '#3a5a25', '#2f4e1d', '#18300a'].map(ppHex) },
  dorn: ['#f7e0b5', '#a89370', '#886c44'].map(ppHex),
  ring: ppFx1St([[0, '#d1a148', 0.85], [0.4, '#9d612f', 0.55], [0.733, '#5a341a', 0.25], [1, '#5a341a', 0]]),
  blitz: ppFx1St([[0, '#fffbd2', 0.75], [0.57, '#fbe181', 0.35], [1, '#fbe181', 0]]),
  splitter: ['#a89370', '#6b4a2a', '#ccb799', '#3a2412', '#b29466', '#1f0f04'].map(ppHex),
};
// Keyframes der Baugruppe (Anteile an 1300 ms): [Anteil, x, y, Drehung°]
const PP_FX1_ANK_KF = [[0, 180, -540, -78], [0.22, 140, -260, -50], [0.34, 54, -64, -18], [0.40, 0, 0, 0], [0.44, -4, 6, 2], [0.52, 0, 0, 0], [0.68, 0, 0, 0], [1, 220, -540, -90]];
const ppFx1Ankylo = ppR1Leinwand((g, t, sz, d) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, C = PP_FX1_ANK, u = t / 1300;
  if (u <= 1) {
    const e = ppFx1Rein;                                                    // cubic-bezier(.18,0,.62,.45) je Abschnitt: beschleunigt in den Einschlag
    const px = ppFx1Kf(u, PP_FX1_ANK_KF.map(k => [k[0], k[1]]), e), py = ppFx1Kf(u, PP_FX1_ANK_KF.map(k => [k[0], k[2]]), e), rot = ppFx1Kf(u, PP_FX1_ANK_KF.map(k => [k[0], k[3]]), e);
    const al = ppFx1Kf(u, [[0, 0], [0.06, 1], [0.68, 1], [1, 0]]);
    const w = rot * Math.PI / 180, ux = Math.cos(w), uy = Math.sin(w), nx = -uy, ny = ux;
    const ox = cx + px / S, oy = cy + py / S;                               // Drehpunkt = Keulenende
    // Schwanz: von 58 px bis 460 px, 50 px dick, Rand dunkel, Querstreifen alle 26 px, Licht oben → dunkel unten
    ppFx1Balken(g, S, ox, oy, ux, uy, 58, 460, 25, (s, q) => {
      const v = (q + 25) / 50, rand = Math.abs(q) > 22.5 || s < 61 || s > 457;
      if (s < 58 + 14 && Math.abs(q) > 25 - (58 + 14 - s) * 0.7) return null;     // linkes Ende rund
      if (rand) return C.rand;
      let k = v < 0.28 ? 0 : v < 0.62 ? 1 : v < 0.88 ? 2 : 3;
      if (((s - 58) % 26) < 8) k = Math.min(3, k + 1);                      // dunkle Querstreifen
      return C.schwanz[k];
    }, al);
    // Keule: Mitte 45,5 px vom Drehpunkt, Radius 65 px
    const kx = ox + ux * 45.5 / S, ky = oy + uy * 45.5 / S;
    ppW76Kugel(g, kx, ky, 65 / S, C.keule, al);
    if (al > 0.2) {
      // Dornen: vorn (zum Ziel, −x im Eigensystem) und hinten
      const lok = (lx, ly) => [ox + (ux * lx + nx * ly) / S, oy + (uy * lx + ny * ly) / S];
      const dorn = (a, b, c) => { const A = lok(...a), B = lok(...b), Cc = lok(...c); ppFx1Dreieck(g, A[0], A[1], B[0], B[1], Cc[0], Cc[1], (p, q, r) => (p > 0.6 ? C.dorn[2] : q > r ? C.dorn[0] : C.dorn[1]), al); };
      dorn([-48.1, 0], [6.5, -15.6], [6.5, 15.6]);
      dorn([139.1, 0], [84.5, -15.6], [84.5, 15.6]);
    }
  }
  // Druckring (750 ms ab 400) und Blitz (550 ms ab 380), Ellipsen
  const ur = (t - 400) / 750;
  if (ur >= 0 && ur <= 1) {
    const sx = ppFx1Kf(ur, [[0, 0.25], [0.35, 1.7], [1, 2.8]], ppFx1Raus), sy = ppFx1Kf(ur, [[0, 0.35], [0.35, 1.2], [1, 1.7]], ppFx1Raus), al = ppFx1Kf(ur, [[0, 1], [0.35, 0.9], [1, 0]], ppFx1Raus);
    ppFx1Radial(g, sz, cx, cy, 127.3 * sx / S, 53 * sy / S, C.ring, al);
  }
  const uf = (t - 380) / 550;
  if (uf >= 0 && uf <= 1) {
    const sx = ppFx1Kf(uf, [[0, 0.3], [0.35, 1.6], [1, 2.3]], ppFx1Raus), sy = ppFx1Kf(uf, [[0, 0.4], [0.35, 1.1], [1, 1.5]], ppFx1Raus), al = ppFx1Kf(uf, [[0, 1], [0.35, 0.9], [1, 0]], ppFx1Raus);
    ppFx1Radial(g, sz, cx, cy, 99 * sx / S, 39.6 * sy / S, C.blitz, al);
  }
  for (const p of d.splitter) ppFx1Teilchen(g, t, p, cx, cy, S);
}, 1300, { breite: 880, hoehe: 640, ankerX: 355, ankerY: 485 }, {
  z: 10100,
  // Der Stoss quetscht die echte Zone (Lage jetzt merken: bis zum Einschlag kann die Kamera das Brett verschoben haben) — wie vorher.
  wirkung: ({ x, y, zoneEl }) => {
    const frost = ppZonenFrost();
    const timer = setTimeout(() => {
      const els = document.querySelectorAll('[data-hero-zone],[data-support-zone]');
      let best = null, bestDist = Infinity;
      els.forEach(el => {
        const r = (frost.get(el) || el.getBoundingClientRect());
        const dd = Math.abs(r.left + r.width / 2 - x) + Math.abs(r.top + r.height / 2 - y);
        if (dd < bestDist) { bestDist = dd; best = el; }
      });
      if (zoneEl && zoneEl.isConnected) { best = zoneEl; bestDist = 0; }
      if (best && bestDist < 100) {
        best.classList.add('giant-dino-stomp-squashed');
        setTimeout(() => best.classList.remove('giant-dino-stomp-squashed'), 850);
      }
    }, 440);
    return () => clearTimeout(timer);
  },
  vorbereiten: () => ({
    splitter: Array.from({ length: ppFxN(26) }, () => {
      const w = -Math.PI * 0.2 + Math.random() * Math.PI * 1.4, v = 36 + Math.random() * 90;
      return { dx: Math.cos(w) * v, dy: -Math.abs(Math.sin(w) * v) - 6, size: 5 + Math.random() * 9, farbe: ppFx1Wahl(PP_FX1_ANK.splitter), delay: 380 + Math.random() * 140, dur: 380 + Math.random() * 340 };
    }),
  }),
});

// ═════════════════════════════════════════════════════════════════
//  club_bash (Rebelliokai Oblivious Oni) — eine Keule faellt WAAGERECHT von oben aufs Ziel (460 ms, beschleunigt, 200 px → 0), bleibt liegen; beim Aufschlag (ab 440 ms): harter Blitz, weissglühender Kern,
//  drei Druckwellenringe (Braun/Gold/Weiss), ein grosser Explosionsstern, Funken, Gesteinsbrocken und aufsteigender Staub. Die Keule ist ein Pixelsprite (statt des 🏏-Zeichens).
// ═════════════════════════════════════════════════════════════════
const PP_FX1_KEULE = {
  holz: ['#27180c', '#6e4421', '#9d612f', '#ca874e', '#fbc86a'].map(ppHex),
  dorn: ['#a89370', '#f7e0b5'].map(ppHex),
  blitz: ppFx1St([[0, '#fffbd2', 1], [0.3, '#ffd066', 0.8], [0.6, '#e37435', 0.45], [0.8, '#7d3911', 0.15], [0.95, '#7d3911', 0], [1, '#7d3911', 0]]),
  kern: ppFx1St([[0, '#ffffff', 1], [0.5, '#f7f7ad', 0.8], [0.8, '#f7f7ad', 0], [1, '#f7f7ad', 0]]),
  ringe: ['#9d612f', '#ffd066', '#fffbd2'].map(ppHex),
  stern: ['#fffbd2', '#f9ac20', '#e37435'].map(ppHex),
  funken: ['#27180c', '#4a2a10', '#6e4421', '#ca874e', '#fbc86a', '#f7f7ad'].map(ppHex),
  brocken: ['#886c44', '#6b4a2a', '#a89370'].map(ppHex),
  staub: ppFx1St([[0, '#b29466', 0.75], [0.55, '#886c44', 0.45], [0.9, '#886c44', 0], [1, '#886c44', 0]]),
};
function ppFx1Keule(g, cx, cy, a) {            // waagerecht, Kopf rechts (~34 × 11 Rasterpixel)
  const C = PP_FX1_KEULE.holz;
  cx = Math.round(cx); cy = Math.round(cy);
  for (let i = -17; i <= 17; i++) {
    const kopf = i >= -2;
    let hh = kopf ? 2.2 + 2.6 * Math.pow((i + 2) / 19, 0.7) : 1.2;
    if (i >= 15) hh *= Math.sqrt(Math.max(0.05, 1 - Math.pow((i - 14.5) / 3, 2)));
    if (i <= -16) hh = 2.3;                                                          // Knauf
    const n = Math.round(hh);
    for (let j = -n; j <= n; j++) {
      const rand = Math.abs(j) === n || i === -17 || i === 17;
      const c = rand ? C[0] : j <= -n + 1 ? C[4] : j < 0 ? C[3] : j === 0 ? C[2] : C[1];
      g.put(cx + i, cy + j, c, a);
    }
  }
  for (const i of [1, 6, 11]) { const n = Math.round(2.2 + 2.6 * Math.pow((i + 2) / 19, 0.7)); g.put(cx + i, cy - n, PP_FX1_KEULE.dorn[1], a); g.put(cx + i, cy + n, PP_FX1_KEULE.dorn[0], a); g.put(cx + i + 1, cy - n + 1, PP_FX1_KEULE.dorn[0], a); g.put(cx + i + 1, cy + n - 1, PP_FX1_KEULE.dorn[0], a); }
}
const ppFx1ClubBash = ppR1Leinwand((g, t, sz, d) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, C = PP_FX1_KEULE, iy = cy + 30 / S;      // Einschlagpunkt: 30 px unter der Zonenmitte
  // Staub (unter allem)
  for (const m of d.staub) {
    const u = (t - m.delay) / m.dur;
    if (u < 0 || u > 1) continue;
    const sk = ppFx1Kf(u, [[0, 0.4], [0.25, 1.1], [1, 1.7]], ppFx1Raus), al = ppFx1Kf(u, [[0, 0], [0.25, 0.8], [1, 0]], ppFx1Raus), rise = ppFx1Kf(u, [[0, 0], [0.25, 0.35], [1, 1]], ppFx1Raus) * m.rise;
    const r = m.size / 2 * sk / S;
    ppFx1Radial(g, sz, cx + m.x / S, cy + (m.y + rise + 8) / S, r, r, C.staub, al);
  }
  // Keule: Mitte 28 px unter der Zonenmitte, faellt 200 px
  const uk = t / 460;
  if (uk <= 1 || t < 1500) {
    const k = Math.min(1, uk), ty = ppFx1Kf(k, [[0, -200], [0.25, -130], [0.8, 0], [0.92, 8], [1, 4]], ppFx1Rein), al = ppFx1Lin(t, 0, 115);
    ppFx1Keule(g, cx, cy + (28 + ty) / S, al);
  }
  // harter Blitz (520 ms ab 440), Mitte 72 px unter der Zonenmitte
  const ub = (t - 440) / 520;
  if (ub >= 0 && ub <= 1) {
    const sk = ppFx1Kf(ub, [[0, 0.35], [0.25, 1.15], [0.55, 1.55], [1, 2.1]], ppFx1Raus), al = ppFx1Kf(ub, [[0, 0], [0.25, 1], [0.55, 0.85], [1, 0]], ppFx1Raus), r = 90 * sk * 1.05 / S;
    ppFx1Radial(g, sz, cx, cy + 72 / S, r, r, C.blitz, al);
  }
  const uc = (t - 460) / 360;
  if (uc >= 0 && uc <= 1) {
    const sk = ppFx1Kf(uc, [[0, 0.3], [0.3, 1.2], [1, 1.8]], ppFx1Raus), al = ppFx1Kf(uc, [[0, 0], [0.3, 1], [1, 0]], ppFx1Raus), r = 42 * sk * 1.25 / S;
    ppFx1Radial(g, sz, cx, iy + 4 / S, r, r, C.kern, al);
  }
  // drei Druckwellen: Ringe 76/64/48 px, Randdicke 5/4/3 px, Groesse .4 → 4,8, Rand → .5
  [[460, 720, 38, 5, 0], [480, 580, 32, 4, 1], [500, 440, 24, 3, 2]].forEach(([v, dur, r0, b0, i]) => {
    const u = (t - v) / dur;
    if (u < 0 || u > 1) return;
    const e = ppFx1Raus(u), sk = 0.4 + 4.4 * e, al = 0.95 * (1 - e), r = r0 * sk / S, dick = Math.max(1, (b0 + (0.5 - b0) * e) * sk / S);
    ppFx1Ring(g, cx, iy, Math.max(0, r - dick), r, C.ringe[i], al);
  });
  // Explosionsstern (720 ms ab 460), Mitte 10 px ueber dem Einschlag
  const ug = (t - 460) / 720;
  if (ug >= 0 && ug <= 1) {
    const sk = ppFx1Kf(ug, [[0, 0.4], [0.18, 1.6], [0.45, 1.35], [0.75, 1.25], [1, 1.55]], ppFx1Raus), al = ppFx1Kf(ug, [[0, 0], [0.18, 1], [0.45, 1], [0.75, 0.7], [1, 0]]);
    ppW76Stern(g, cx, iy - 6 / S, 38 * sk / S, 12, C.stern, al, 0.3);
  }
  for (const p of d.funken) ppFx1Teilchen(g, t, p, cx, iy, S, 1.2);
  for (const b of d.brocken) {
    const u = (t - b.delay) / b.dur;
    if (u < 0 || u > 1) continue;
    const x = ppFx1Kf(u, [[0, 0], [0.15, 0.25], [0.6, 0.7], [1, 1]], ppFx1Raus) * b.dx, y = ppFx1Kf(u, [[0, 0], [0.15, 0.25 * b.dy], [0.6, 0.5 * b.dy], [1, b.dy + 30]], ppFx1Raus), al = ppFx1Kf(u, [[0, 0], [0.15, 1], [0.6, 1], [1, 0]]);
    const n = Math.max(2, Math.round(b.size / S));
    g.block(cx + x / S - n / 2, iy + y / S - n / 2, n, n, b.farbe, al);
    g.put(cx + x / S - n / 2, iy + y / S - n / 2, C.brocken[2], al);
  }
}, 1800, { breite: 440, hoehe: 480, ankerX: 220, ankerY: 200 }, {
  z: 10100,
  vorbereiten: () => ({
    funken: Array.from({ length: ppFxN(28) }, () => {
      const w = Math.random() * Math.PI * 2, v = 60 + Math.random() * 90;
      return { dx: Math.cos(w) * v, dy: Math.sin(w) * v * 0.55 - 12, size: 5 + Math.random() * 9, delay: 460 + Math.random() * 160, dur: 460 + Math.random() * 320, farbe: ppFx1Wahl(PP_FX1_KEULE.funken) };
    }),
    brocken: Array.from({ length: ppFxN(10) }, () => {
      const w = -Math.PI + Math.random() * Math.PI, v = 50 + Math.random() * 70;
      return { dx: Math.cos(w) * v, dy: Math.sin(w) * v * 0.7 - 18, size: 8 + Math.random() * 8, delay: 470 + Math.random() * 100, dur: 620 + Math.random() * 280, farbe: ppFx1Wahl(PP_FX1_KEULE.brocken) };
    }),
    staub: Array.from({ length: ppFxN(22) }, () => ({ x: -56 + Math.random() * 112, y: 4 + Math.random() * 12, rise: -(28 + Math.random() * 44), size: 10 + Math.random() * 14, delay: 470 + Math.random() * 280, dur: 620 + Math.random() * 380 })),
  }),
});


// ═════════════════════════════════════════════════════════════════
//  biseria_ice_engulf (Divine Gift of Biseria, Blue-Ice Dragon) — das Ziel wird von Gletschern verschluckt: kalte Druckwelle, grosser Frosthalo und dichter Frostnebel, zwoelf gewaltige Eisplatten
//  (vier Seiten, vier Diagonalen, vier senkrechte Zacken) krachen von allen Seiten nach innen (480 ms, ab 0–310 ms), blauweisser Schlag in der Mitte (360 ms ff.), Kristallsplitter, danach Schneeflocken
//  (700–3000 ms). Platten und Splitter sind gedrehte Geometrie (Pixel einzeln berechnet); Flocken kleine Pixel-Sprites. Der Aufrufer raeumt Zonen-Animationen nach 1000 ms ab.
// ═════════════════════════════════════════════════════════════════
const PP_FX1_EIS = {
  welle: ppFx1St([[0, '#b4cff8', 0.6], [0.4375, '#7bbeea', 0.35], [0.75, '#4e82cb', 0.15], [1, '#4e82cb', 0]]),
  halo: ppFx1St([[0, '#e5edfa', 0.55], [0.4, '#b3d8f9', 0.4], [0.7, '#7bbeea', 0.15], [1, '#7bbeea', 0]]),
  nebel: ppFx1St([[0, '#ffffff', 0.85], [0.5, '#e5edfa', 0.65], [0.9, '#b3d8f9', 0.3], [1, '#b3d8f9', 0]]),
  schlag: ppFx1St([[0, '#ffffff', 1], [0.3125, '#e5edfa', 0.85], [0.6875, '#b3d8f9', 0.4], [1, '#b3d8f9', 0]]),
  platte: ['#ffffff', '#bddcef', '#b4cff8', '#e5edfa'].map(ppHex), kante: ppHex('#ffffff'), unten: ppHex('#89abdc'), facette: ppHex('#e5f5fa'),
  splitter: ['#ffffff', '#b3d8f9', '#7bbeea'].map(ppHex),
  flocke: { w: ppHex('#ffffff'), b: ppHex('#b4cff8') },
};
const PP_FX1_FLOCKE_GROSS = ['..b.b..', '.bwbwb.', 'bwwwwwb', '.bwwwb.', 'bwwwwwb', '.bwbwb.', '..b.b..'];
const PP_FX1_FLOCKE_KLEIN = ['b.w.b', '.www.', 'wwwww', '.www.', 'b.w.b'];
const ppFx1BiseriaPlatten = (cw, ch) => [
  { w: cw * 2.4, h: ch * 0.7, sx: 0, sy: -ch * 2.2, ex: 0, ey: -ch * 0.20, delay: 0, rot: 0 },
  { w: cw * 2.4, h: ch * 0.7, sx: 0, sy: ch * 2.2, ex: 0, ey: ch * 0.20, delay: 30, rot: 0 },
  { w: cw * 0.7, h: ch * 1.9, sx: -cw * 2.0, sy: 0, ex: -cw * 0.30, ey: 0, delay: 60, rot: 0 },
  { w: cw * 0.7, h: ch * 1.9, sx: cw * 2.0, sy: 0, ex: cw * 0.30, ey: 0, delay: 90, rot: 0 },
  { w: cw * 1.6, h: ch * 0.55, sx: -cw * 1.8, sy: -ch * 1.8, ex: -cw * 0.15, ey: -ch * 0.15, delay: 130, rot: 35 },
  { w: cw * 1.6, h: ch * 0.55, sx: cw * 1.8, sy: -ch * 1.8, ex: cw * 0.15, ey: -ch * 0.15, delay: 150, rot: -35 },
  { w: cw * 1.6, h: ch * 0.55, sx: -cw * 1.8, sy: ch * 1.8, ex: -cw * 0.15, ey: ch * 0.15, delay: 170, rot: -35 },
  { w: cw * 1.6, h: ch * 0.55, sx: cw * 1.8, sy: ch * 1.8, ex: cw * 0.15, ey: ch * 0.15, delay: 190, rot: 35 },
  { w: cw * 0.4, h: ch * 1.2, sx: -cw * 0.45, sy: -ch * 2.4, ex: -cw * 0.45, ey: -ch * 0.05, delay: 220, rot: 0 },
  { w: cw * 0.4, h: ch * 1.2, sx: cw * 0.45, sy: -ch * 2.4, ex: cw * 0.45, ey: -ch * 0.05, delay: 250, rot: 0 },
  { w: cw * 0.4, h: ch * 1.2, sx: -cw * 0.45, sy: ch * 2.4, ex: -cw * 0.45, ey: ch * 0.05, delay: 280, rot: 0 },
  { w: cw * 0.4, h: ch * 1.2, sx: cw * 0.45, sy: ch * 2.4, ex: cw * 0.45, ey: ch * 0.05, delay: 310, rot: 0 },
];
const ppFx1Biseria = ppR1Leinwand((g, t, sz, d) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, C = PP_FX1_EIS, cw = d.cw, ch = d.ch;
  // Druckwelle (700 ms): Groesse .15 → .7 → 1,4, Deckung 0 → 1 → 0
  const uw = t / 700;
  if (uw <= 1) {
    const sk = ppFx1Kf(uw, [[0, 0.15], [0.3, 0.7], [1, 1.4]], ppFx1Raus), al = ppFx1Kf(uw, [[0, 0], [0.3, 1], [1, 0]], ppFx1Raus);
    ppFx1Radial(g, sz, cx, cy, cw * 2.5 * sk / S, ch * 2.5 * sk / S, C.welle, al);
  }
  // Frosthalo (1500 ms ab 200)
  const uh = (t - 200) / 1500;
  if (uh >= 0 && uh <= 1) {
    const sk = ppFx1Kf(uh, [[0, 0.6], [0.35, 1], [0.8, 1.05], [1, 1.1]], ppFx1Raus), al = ppFx1Kf(uh, [[0, 0], [0.35, 0.95], [0.8, 0.7], [1, 0]], ppFx1Raus);
    ppFx1Radial(g, sz, cx, cy, cw * 1.7 * sk / S, ch * 1.7 * sk / S, C.halo, al);
  }
  // Frostnebel dicht ueber der Zone (1800 ms ab 350): 1,6 × Zone
  const un = (t - 350) / 1800;
  if (un >= 0 && un <= 1) {
    const al = ppFx1Kf(un, [[0, 0], [0.35, 1], [0.8, 0.9], [1, 0.7]], ppFx1Rein);
    ppFx1Radial(g, sz, cx, cy, cw * 0.8 * 1.414 / S, ch * 0.8 * 1.414 / S, C.nebel, al, [cw * 0.8 / S, ch * 0.8 / S]);
  }
  // Eisplatten
  for (const p of d.platten) {
    const u = (t - p.delay) / 480;
    if (u < 0) continue;
    const k = Math.min(1, u), e = 1 - Math.pow(1 - k, 3.5), al = ppFx1Kf(k, [[0, 0], [0.25, 1], [1, 1]]), sc = 1.1 - 0.1 * e;
    const px = cx + (p.sx + (p.ex - p.sx) * e) / S, py = cy + (p.sy + (p.ey - p.sy) * e) / S, hw = p.w / 2 * sc, hh = p.h / 2 * sc;
    ppFx1Gedreht(g, sz, px, py, p.rot, hw, hh, (lx, ly, X, Y) => {
      if (Math.abs(lx) > hw - 3 || ly < -hh + 3) return C.kante;
      if (ly > hh - 4) return C.unten;
      if ((((lx * 0.6 + ly) % 44) + 44) % 44 < 3) return C.facette;
      return ppStufe(C.platte, ((lx / hw + ly / hh) / 2 + 1) / 2 * 3, X, Y);
    }, al);
  }
  // Schlag in der Mitte (600 ms ab 360): Groesse .2 → 1,4 → 2,4
  const us = (t - 360) / 600;
  if (us >= 0 && us <= 1) {
    const sk = ppFx1Kf(us, [[0, 0.2], [0.25, 1.4], [1, 2.4]], ppFx1Raus), al = ppFx1Kf(us, [[0, 0], [0.25, 1], [1, 0]], ppFx1Raus);
    ppFx1Radial(g, sz, cx, cy, cw * 1.02 * sk / S, ch * 1.02 * sk / S, C.schlag, al);
  }
  // Kristallsplitter
  for (const s of d.splitter) {
    const u = (t - s.delay) / s.dur;
    if (u < 0 || u > 1) continue;
    const e = ppFx1Raus(u), sk = 0.4 + 0.7 * e, al = ppFx1Kf(u, [[0, 0], [0.25, 1], [1, 0]], ppFx1Raus), hw = s.size * 0.225 * sk, hh = s.size * 0.7 * sk;
    ppFx1Gedreht(g, sz, cx + s.dx * e / S, cy + s.dy * e / S, 360 * u + s.rot, hw, hh, (lx, ly) => (Math.abs(lx) / hw + Math.abs(ly) / hh <= 1 ? (ly < -hh * 0.2 ? C.splitter[0] : ly < hh * 0.4 ? C.splitter[1] : C.splitter[2]) : null), al);
  }
  // Schneeflocken
  for (const f of d.flocken) {
    const u = (t - f.delay) / f.dur;
    if (u < 0 || u > 1) continue;
    const y = f.y0 + (f.y1 - f.y0) * ppFx1Rein(u), al = ppFx1Kf(u, [[0, 0], [0.15, 1], [0.85, 1], [1, 0]]), gross = f.size >= 15;
    ppFx1Spr(g, gross ? PP_FX1_FLOCKE_GROSS : PP_FX1_FLOCKE_KLEIN, C.flocke, cx + f.x / S, cy + y / S, 1, al);
  }
}, 3100, (p) => {
  const z = ppFx1Zone(p);
  return { breite: z.w * 5.6, hoehe: z.h * 5.8 };
}, {
  z: 10100,
  vorbereiten: (sz) => {
    const z = ppFx1Zone(sz.props), cw = z.w, ch = z.h;
    return {
      cw, ch, platten: ppFx1BiseriaPlatten(cw, ch),
      splitter: Array.from({ length: ppFxN(18) }, () => { const a = Math.random() * Math.PI * 2, dd = 60 + Math.random() * cw * 1.2; return { dx: Math.cos(a) * dd, dy: Math.sin(a) * dd - 30, size: 14 + Math.random() * 22, rot: Math.random() * 360, delay: 380 + Math.random() * 220, dur: 600 + Math.random() * 400 }; }),
      flocken: Array.from({ length: ppFxN(30) }, () => ({ x: -cw * 1.4 + Math.random() * cw * 2.8, y0: -ch * 1.6 - 20, y1: ch * 1.6 + Math.random() * 40, size: 10 + Math.random() * 14, delay: 700 + Math.random() * 700, dur: 900 + Math.random() * 700 })),
    };
  },
});

// ═════════════════════════════════════════════════════════════════
//  cataclysm (Spell) — ein riesiger brennender Meteor faellt von oben rechts ueber den GANZEN Bildschirm zur Mitte (1300 ms, mit Feuerschweif; er wird beim Aufprall verschluckt),
//  dann ein bildschirmfuellender Feuerball (1150 ms), weisser Blitz (620 ms), riesiger Druckring (1250 ms), Flammen/Sterne am Einschlag und Funken (bis ~3000 ms).
//  Die Leinwand deckt das Fenster ab (Ankerpunkt wird ignoriert, wie vorher). Der Feuerball ist ein vorberechnetes Abstandsfeld, gestuft und gedithert — kein Weichzeichner.
// ═════════════════════════════════════════════════════════════════
const PP_FX1_KATA = {
  ball: ppFx1St([[0, '#ffffff', 1], [0.08, '#fffbd2', 0.98], [0.2, '#ffb91a', 0.95], [0.38, '#ff7d00', 0.85], [0.58, '#cc2b00', 0.6], [0.75, '#520a0c', 0.28], [0.88, '#520a0c', 0], [2, '#520a0c', 0]]),
  fels: ppFx1St([[0, '#f9ecb3', 1], [0.14, '#f9ac20', 1], [0.32, '#ff7d00', 1], [0.56, '#b62600', 1], [0.78, '#6a1c14', 1], [1, '#270d0c', 1]]),
  schein: ['#780000', '#cc2b00', '#ff491a'].map(ppHex), rand: ppHex('#270d0c'),
  schweif: ['#cc2b00', '#ff491a', '#ff8b1a', '#fad54a', '#fffbd2'].map(ppHex),
  ring: ['#ff9a1a', '#f9ac20'].map(ppHex), weiss: ppHex('#ffffff'),
  funken: ['#ff1a1a', '#ff491a', '#ff8b1a', '#fad54a', '#f9ac20', '#ff1a1a'].map(ppHex),
  stern: ['#fffbd2', '#f9ac20', '#ff491a'].map(ppHex),
};
const ppFx1Kataklysmus = ppR1Leinwand((g, t, sz, d) => {
  const S = sz.S, C = PP_FX1_KATA, ex = d.ex / S, ey = d.ey / S, ux = d.ux, uy = d.uy;
  // Meteor
  if (t < 1440) {
    const u = Math.min(1, t / 1300), e = ppFx1Glatt(u), rxp = (d.sx + (d.ex - d.sx) * e) / S, ryp = (d.sy + (d.ey - d.sy) * e) / S, al = ppR1Aus(t, 1300, 1440);
    const R = 75 / S;
    // Schweif: 460 px hinter dem Felsen, 64 px dick, aussen dunkelrot → innen gelbweiss
    const x0 = rxp - ux * 460 / S, y0 = ryp - uy * 460 / S;
    [[1, 0], [0.62, 1], [0.3, 2]].forEach(([breite, stufe]) => {
      ppR1Band(g, x0, y0, rxp, ryp, (v) => {
        if (v < 0.03) return null;
        const w = 64 / S * breite * Math.min(1, 0.22 + v * 1.05);
        const k = v < 0.22 ? 0 : v < 0.5 ? 1 : v < 0.8 ? 2 : 3;
        return { w, c: C.schweif[Math.min(4, k + stufe)], a: (v < 0.22 ? 0.45 : v < 0.5 ? 0.7 : 0.95) * al };
      }, 1);
    });
    g.glow(rxp, ryp, R * 1.5, R * 1.5, C.schein, 0.75 * al);
    const hx = rxp + ux * 18 / S, hy = ryp + uy * 18 / S;
    ppFx1Radial(g, sz, hx, hy, 119 / S, 119 / S, C.fels, al, null, [rxp, ryp, R]);
    g.ring(rxp, ryp, R - 1.3, R, C.rand, al);
  }
  const te = t - 1300;
  if (te >= 0) {
    // Feuerball
    const uf = te / 1150;
    if (uf <= 1) {
      const sk = ppFx1Kf(uf, [[0, 0.04], [0.1, 0.45], [0.3, 1], [0.6, 1.04], [1, 1.12]], ppFx1Raus), al = ppFx1Kf(uf, [[0, 0], [0.1, 1], [0.3, 1], [0.6, 0.92], [1, 0]], ppFx1Raus);
      ppFx1Voll(g, sz, d.dist, d.R0 * sk, C.ball, al);
    }
    // Weiss
    const uw = te / 620;
    if (uw <= 1) {
      const al = ppFx1Kf(uw, [[0, 0], [0.12, 0.92], [0.38, 0.5], [1, 0]], ppFx1Raus);
      g.block(0, 0, sz.gw, sz.gh, C.weiss, al);
    }
    // Druckring: 120 px, Groesse .3 → 16, Rand 14 → 1 px (mit skaliert), Deckung .95 → 0
    const ur = te / 1250;
    if (ur <= 1) {
      const e = ppFx1Raus(ur), sk = 0.3 + 15.7 * e, r = 60 * sk / S, dick = Math.min(r, Math.max(1, (14 - 13 * e) * sk / S)), al = 0.95 * (1 - e);
      ppFx1Ring(g, ex, ey, r - dick, r - dick * 0.5, C.ring[1], al);
      ppFx1Ring(g, ex, ey, r - dick * 0.5, r, C.ring[0], al);
    }
    for (const f of d.flammen) {
      const u = (te - (f.delay - 1300)) / f.dur;
      if (u < 0 || u > 1) continue;
      const sk = ppFx1Kf(u, [[0, 0.3], [0.25, 1.2], [1, 0.7]], ppFx1Raus), al = ppFx1Kf(u, [[0, 0], [0.25, 1], [1, 0]], ppFx1Raus), x = ex + f.x / S, y = ey + (f.y + 20 * u) / S, hoch = f.size * sk / S;
      if (f.art === 'stern') ppW76Stern(g, x, y, hoch * 0.55, 10, C.stern, al, 0.2);
      else if (f.art === 'plus') ppFx1Spr(g, PP_R1_FSCHLAG_BILD.stern, PP_R1_FLAMMENFARBEN, x, y, Math.max(1, Math.round(hoch / 5)), al);
      else ppFx1Spr(g, hoch >= 9 && f.art === 'gross' ? PP_R1_FSCHLAG_BILD.gross : PP_R1_FSCHLAG_BILD.klein, PP_R1_FLAMMENFARBEN, x, y, Math.max(1, Math.round(hoch / (f.art === 'gross' ? 9 : 6))), al);
    }
    for (const s of d.funken) {
      const u = (te - (s.delay - 1300)) / s.dur;
      if (u < 0 || u > 1) continue;
      const e = ppFx1Raus(u), sk = ppFx1Kf(u, [[0, 0.4], [0.2, 1], [1, 0.5]]), al = ppFx1Kf(u, [[0, 0], [0.2, 1], [1, 0]], ppFx1Raus), n = Math.max(1, Math.round(s.size * sk / S));
      g.block(ex + s.dx * e / S - n / 2, ey + s.dy * e / S - n / 2, n, n, s.farbe, al);
    }
  }
}, 3100, (p) => ({ breite: window.innerWidth || 1280, hoehe: window.innerHeight || 720, ankerX: p.x, ankerY: p.y }), {   // Fenster abdecken: linke obere Ecke = (0, 0), x/y des Aufrufers werden ignoriert

  z: 10200,
  vorbereiten: (sz) => {
    const S = sz.S, vw = sz.gw * S, vh = sz.gh * S, ex = vw / 2, ey = vh / 2, sx = vw + 240, sy = -240, L = Math.hypot(ex - sx, ey - sy);
    return {
      ex, ey, sx, sy, ux: (ex - sx) / L, uy: (ey - sy) / L, R0: 1.556 * Math.max(vw, vh),
      dist: ppFx1Abstaende(sz, ex / S, ey / S),
      flammen: Array.from({ length: ppFxN(32) }, () => {
        const w = Math.random() * Math.PI * 2, dd = 60 + Math.random() * 280, z = Math.floor(Math.random() * 5);
        return { x: Math.cos(w) * dd, y: Math.sin(w) * dd, size: 30 + Math.random() * 36, delay: 1300 + Math.random() * 250, dur: 700 + Math.random() * 500, art: z < 2 ? 'gross' : z === 2 ? 'stern' : z === 3 ? 'klein' : 'plus' };
      }),
      funken: Array.from({ length: ppFxN(40) }, () => {
        const w = Math.random() * Math.PI * 2, v = 80 + Math.random() * 200;
        return { dx: Math.cos(w) * v, dy: Math.sin(w) * v, size: 5 + Math.random() * 9, farbe: ppFx1Wahl(PP_FX1_KATA.funken), delay: 1300 + Math.random() * 200, dur: 600 + Math.random() * 500 };
      }),
    };
  },
});

// ═════════════════════════════════════════════════════════════════
//  armageddon (Spell) — brettweit (`zoneType: 'board'`), Staerke `power` skaliert Groesse, Menge und Beben. Zeitlauf wie vorher (`duration` = 1800 + 1400·Staerke ms):
//    ① Beben (ab 80 ms): die ganze Ebene wackelt in ganzen Pixeln · ② dunkelroter Tonwert ueber dem Brett (Verlauf vom Wirker, gedithert) · ③ Feuerball vom Wirker (waechst auf den Radius bis zur
//    fernsten Ecke · 1,15, gestufter Verlauf) mit 1–3 Druckringen (Gold/Orange/Rot) und weissem Kern · ④ Flammen schlagen dort hoch, wo die Welle ankommt (Verzug nach Abstand) ·
//    ⑤ Feuerregen mit Einschlaegen · ⑥ aufsteigende Glut. Die Streuung ist (wie vorher) aus Brettmass und Staerke gesaet, damit beide Spieler dasselbe sehen. Die Leinwand deckt das Brett
//    plus Rand ab (der alte Feuerball reichte darueber hinaus); `ox`/`oy` (Wirker) kommen als Fensterpunkt und bekommen den Scrollstand des Feldes (`ppR1FeldVersatz`).
// ═════════════════════════════════════════════════════════════════
const PP_FX1_ARMA = {
  tint: ppFx1St([[0, '#fbc86a', 0.55], [0.18, '#ff491a', 0.5], [0.45, '#b62600', 0.55], [1, '#2a0404', 0.72]]),
  ball: ppFx1St([[0, '#fff8e8', 1], [0.113, '#fbe181', 1], [0.283, '#f9ac20', 1], [0.509, '#f87420', 1], [0.764, '#cc2b00', 1], [0.98, '#780000', 0.85], [1, '#780000', 0.85], [1.0001, '#780000', 0], [2, '#780000', 0]]),
  ringe: ['#ffd066', '#ff7d00', '#ff491a'].map(ppHex),
  kern: ppFx1St([[0, '#ffffff', 1], [0.4, '#f9ecb3', 1], [0.8, '#f9ac20', 1], [1, '#f9ac20', 0]]),
  einschlag: ppFx1St([[0, '#fff8e8', 1], [0.39, '#f9ac20', 1], [0.71, '#ff491a', 0.7], [1, '#ff491a', 0]]),
  tropfen: ['#ff491a', '#ff7d00', '#ffd066', '#fff8e8'].map(ppHex),
  glut: ppHex('#f9ac20'), glutRand: ppHex('#f87420'),
};
const ppFx1ArmaMass = (p) => ({ W: Math.max(p.w || 900, 320), H: Math.max(p.h || 560, 240), pw: Math.max(0.05, Math.min(1, typeof p.power === 'number' ? p.power : 0.4)) });
const ppFx1Armageddon = ppR1Leinwand((g, t, sz, d) => {
  const S = sz.S, C = PP_FX1_ARMA, { p, W, H, dauer, welle, R } = d;
  const bl = sz.cx - W / 2 / S, bt = sz.cy - H / 2 / S;                       // Brettecke (Rasterpixel)
  // ① Beben: Versatz in ganzen Rasterpixeln (Hoechstausschlag 2 + 9·p px)
  const ub = (t - 80) / (welle + 500), amp = (2 + 9 * p) / S;
  let bx = 0, by = 0;
  if (ub >= 0 && ub <= 1) {
    bx = Math.round(amp * ppFx1Kf(ub, [[0, 0], [0.1, -1], [0.22, 1], [0.34, -0.7], [0.48, 0.6], [0.62, -0.4], [0.78, 0.25], [1, 0]]));
    by = Math.round(amp * ppFx1Kf(ub, [[0, 0], [0.1, 0.6], [0.22, -0.8], [0.34, -0.4], [0.48, 0.7], [0.62, 0.3], [0.78, -0.2], [1, 0]]));
  }
  const u = t / dauer, ox = d.ox + bl + bx, oy = d.oy + bt + by;
  // ② Tonwert: Opazitaet 0 → t → .8·t → 0 (ease-out je Abschnitt), Verlauf bis zur fernsten Ecke
  const tmax = 0.35 + 0.55 * p;
  const tal = ppFx1Kf(u, [[0, 0], [0.18, tmax], [0.7, tmax * 0.8], [1, 0]], ppFx1Raus);
  ppFx1Voll(g, sz, d.dist, d.Rt, C.tint, tal);
  // ③ Feuerball (cubic-bezier(.12,.72,.28,1) je Abschnitt): Groesse .02 → 1 (28 %) → 1,04 → 1,08, Deckung .95 → .92 → .55 → 0
  const bk = ppFx1Kf(u, [[0, 0.02], [0.28, 1], [0.55, 1.04], [1, 1.08]], ppFx1Raus3), bal = ppFx1Kf(u, [[0, 0.95], [0.28, 0.92], [0.55, 0.55], [1, 0]], ppFx1Raus3);
  if (bal > 0.02) ppFx1Voll(g, sz, d.dist2, R * bk, C.ball, bal * (bx || by ? 1 : 1));
  // Druckringe: Gold aussen, darin 6 px Orange und 6 px Rot (Ring waechst .02 → 1 in welle+260 ms, alles mitskaliert)
  d.ringe.forEach((v, i) => {
    const ur = (t - v) / (welle + 260);
    if (ur < 0 || ur > 1) return;
    const e = ppFx1Raus(ur), al = ppFx1Kf(ur, [[0, 1], [0.75, 0.75], [1, 0]]), sk = 0.02 + 0.98 * e, r = R * sk / S, bw = Math.max(1, (5 + 10 * p - i * 2) * sk / S), s6 = 6 * sk / S;
    ppFx1Ring(g, ox, oy, r - bw, r, C.ringe[0], al);
    ppFx1Ring(g, ox, oy, r - bw - s6, r - bw, C.ringe[1], al);
    ppFx1Ring(g, ox, oy, r - bw - 2 * s6, r - bw - s6, C.ringe[2], al);
  });
  // Kern
  const uk = t / Math.round(420 + 180 * p);
  if (uk <= 1) {
    const sk = ppFx1Kf(uk, [[0, 0.3], [0.25, 1.6 + 3.2 * p], [1, (1.6 + 3.2 * p) * 1.4]], ppFx1Raus), al = ppFx1Kf(uk, [[0, 0], [0.25, 1], [1, 0]], ppFx1Raus), r = 45 * sk / S;
    ppFx1Radial(g, sz, ox, oy, r / 0.75, r / 0.75, C.kern, al);
  }
  // ④ Flammen
  for (const f of d.flammen) {
    const uf = (t - f.verzug) / f.laenge;
    if (uf < 0 || uf > 1) continue;
    const sx = ppFx1Kf(uf, [[0, 0.2], [0.18, 1], [0.4, 0.85], [0.62, 1.05], [1, 0.5]], ppFx1Raus), sy = ppFx1Kf(uf, [[0, 0.1], [0.18, 1.15], [0.4, 1.3], [0.62, 1], [1, 1.4]], ppFx1Raus);
    const al = ppFx1Kf(uf, [[0, 0], [0.18, 1], [0.62, 0.9], [1, 0]], ppFx1Raus), heb = uf > 0.62 ? (uf - 0.62) / 0.38 * 0.3 * f.groesse * 1.7 : 0;
    ppFx1Flamme(g, bl + (f.fx) / S + bx, bt + (f.fy + f.groesse * 0.17 * sy - heb) / S + by, f.groesse * sx / S * 1.05, f.groesse * 1.7 * sy / S * 0.98, al, f.seed);
  }
  // ⑤ Feuerregen
  for (const f of d.tropfen) {
    const uf = (t - f.verzug) / f.fall;
    if (uf >= 0 && uf <= 1) {
      const k = ppFx1Rein(uf), al = ppFx1Kf(uf, [[0, 0], [0.12, 1], [1, 1]]);
      const hx = bl + (f.zx - f.drift * (1 - k)) / S + bx, hy = bt + (f.zy - (f.zy + 120) * (1 - k)) / S + by, w = Math.max(1, Math.round(f.groesse / S)), L = Math.round(f.groesse * 5 / S);
      for (let j = 0; j < L; j++) {
        const v = j / L, c = v < 0.2 ? null : v < 0.5 ? C.tropfen[1] : v < 0.85 ? C.tropfen[2] : C.tropfen[3];
        if (!c) { if (!(j & 1)) g.put(hx - w / 2 + 0, hy - L + j, C.tropfen[0], al * 0.6); continue; }
        const sh = Math.round(-(1 - v) * f.drift * 0.0);
        g.block(hx - w / 2 + sh, hy - L + j, w, 1, c, al);
      }
    }
    const ue = (t - f.verzug - f.fall) / 420;
    if (ue >= 0 && ue <= 1) {
      const sk = 0.2 + 1.3 * ppFx1Raus(ue), al = 1 - ppFx1Raus(ue);
      ppFx1Radial(g, sz, bl + f.zx / S + bx, bt + f.zy / S + by, f.groesse * 3 * sk * 1.2 / S, f.groesse * 1.5 * sk * 1.2 / S, C.einschlag, al);
    }
  }
  // ⑥ Glut
  for (const q of d.glut) {
    const ug = (t - q.verzug) / Math.round(dauer * 0.5);
    if (ug < 0 || ug > 1) continue;
    const e = ppFx1Raus(ug), al = ppFx1Kf(ug, [[0, 0], [0.15, 1], [1, 0]], ppFx1Raus), n = Math.max(1, Math.round(q.groesse / S));
    const x = bl + (q.gx + 10 * e) / S + bx, y = bt + (q.gy - q.steig * e) / S + by;
    if (n >= 2) g.block(x - 1, y - 1, n + 2, n + 2, C.glutRand, al * 0.8);
    g.block(x, y, n, n, C.glut, al);
  }
}, 3300, (p) => {
  const m = ppFx1ArmaMass(p), mx = m.W * 0.12, my = m.H * 0.12;
  return { breite: m.W + 2 * mx, hoehe: m.H + 2 * my };
}, {
  z: 10150,
  vorbereiten: (sz) => {
    const pr = sz.props, S = sz.S, { W, H, pw: p } = ppFx1ArmaMass(pr), off = ppR1FeldVersatz(pr);
    const links = pr.x - W / 2, oben = pr.y - H / 2;
    const oX = (typeof pr.ox === 'number' ? pr.ox + off.dx : pr.x) - links, oY = (typeof pr.oy === 'number' ? pr.oy + off.dy : pr.y + H * 0.3) - oben;
    const R = Math.max(Math.hypot(oX, oY), Math.hypot(W - oX, oY), Math.hypot(oX, H - oY), Math.hypot(W - oX, H - oY)) * 1.15;
    const dauer = pr.duration || Math.round(1800 + 1400 * p), welle = Math.round(520 + 380 * p);
    const zufall = (start) => { let t = start >>> 0; return () => { t = (t * 1664525 + 1013904223) >>> 0; return t / 4294967296; }; };
    const r = zufall(Math.round(W * 7 + H * 13 + p * 1000));
    // Mengen ohne `ppFxN`-Kappung: Zahl und Lage muessen bei beiden Spielern gleich sein (Handy wuerde sonst anders streuen) — die Leinwand ist guenstig genug
    const flammen = Array.from({ length: Math.round(10 + 40 * p) }, () => {
      const fx = r() * W, fy = r() * H, abstand = Math.hypot(fx - oX, fy - oY) / R, groesse = (22 + r() * 40) * (0.6 + 0.8 * p);
      return { fx, fy, groesse, verzug: Math.round(welle * abstand * 0.9 + r() * 140), laenge: Math.round(650 + r() * 520), seed: r() * 6 };
    });
    const tropfen = Array.from({ length: Math.round(8 + 44 * p) }, () => {
      const zx = r() * W, zy = H * 0.1 + r() * H * 0.9, drift = (r() - 0.35) * 160;
      return { zx, zy, drift, groesse: (5 + r() * 7) * (0.8 + 0.6 * p), verzug: Math.round(welle * 0.55 + r() * (dauer - welle - 700)), fall: Math.round(420 + r() * 260) };
    });
    const glut = Array.from({ length: Math.round(6 + 26 * p) }, () => ({ gx: r() * W, gy: H * 0.35 + r() * H * 0.65, groesse: 3 + r() * 5, verzug: Math.round(dauer * 0.45 + r() * dauer * 0.3), steig: 60 + r() * 140 }));
    // Abstandsfeld zum Wirker (Bildschirmpixel): `dist` fuer den Tonwert (Verlauf bis zur fernsten Ecke des Brettkastens), `dist2` gleich — eine Kopie spart nichts, daher ein Feld
    const ox = (sz.cx - W / 2 / S) + oX / S, oy = (sz.cy - H / 2 / S) + oY / S;
    const dist = ppFx1Abstaende(sz, ox, oy);
    return { p, W, H, R, dauer, welle, flammen, tropfen, glut, dist, dist2: dist, Rt: R / 1.15 * 1.08, ox: oX / S, oy: oY / S, ringe: p > 0.6 ? [0, 130, 260] : p > 0.25 ? [0, 160] : [0] };
  },
});

ppFxUeberschreiben('ankylo_tail_smash', ppFx1Ankylo);
ppFxUeberschreiben('armageddon', ppFx1Armageddon);
ppFxUeberschreiben('assassination_cut', ppFx1Assassin);
ppFxUeberschreiben('battle_axe_cleave', ppFx1Axt);
ppFxUeberschreiben('biseria_ice_engulf', ppFx1Biseria);
ppFxUeberschreiben('blood_moon_pulse', ppFx1BloodMoon);
ppFxUeberschreiben('blue_ice_flames', ppFx1BlueIce);
ppFxUeberschreiben('bomblebee_carpet', ppFx1Carpet);
ppFxUeberschreiben('bomblebee_cluster', ppFx1Cluster);
ppFxUeberschreiben('bomblebee_detonate', ppFx1Detonate);
ppFxUeberschreiben('bomblebee_fuse', ppFx1Fuse);
ppFxUeberschreiben('cataclysm', ppFx1Kataklysmus);
ppFxUeberschreiben('club_bash', ppFx1ClubBash);
