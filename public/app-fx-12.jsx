// Pixelart-Portierungen (Canvas), Batch 12 (zweite Welle, Schwelle 50 ms): siehe app-fx-0.jsx. Jede Portierung: `ppFxUeberschreiben('typ', Komponente)`.
// Effekte: empowered_strike_apply, equip_flash, falling_boulder, fan_blow, field_standard_rally, firewall, flame_pillars, flaming_slash, gate_shield, giant_dino_stomp, golden_banana_rain,
//          grave_worm_burrow.
// Alle laufen auf EINER Leinwand je Effekt (`ppR1Leinwand`, 1 Rasterpixel = 3 Bildschirmpixel, 30 Bilder/s): keine weichen Schatten, Scheine oder Verläufe — Schein = Dither-Stufen (`ppFx7Glow`),
// Deckung = Bayer-Raster, Symbole (Faust, Fächer, Trompete, Banane, Schild, Fels …) = kleine Pixelbilder bzw. Formen, die je Bild neu gerastert werden (keine gedrehten Bitmaps).
// Alle Effekte laufen in der Standard-Lebensdauer von 1000 ms (`onZoneAnim` → `playAnimation`, kein `duration` vom Server): Anfangszeiten bleiben wie in den DOM-Fassungen, die Enden sind auf
// ~960 ms gerafft (`ppFx12Fit`; die DOM-Fassungen wurden nach 1000 ms hart abgeschnitten, einzelne Teilchen liefen noch).
// Bausteine aus anderen Dateien (nur gelesen): `ppFx7Kf` / `ppFx7Bez` / `ppFx7Glow` (app-fx-7.jsx), `ppFx1Flamme` (app-fx-1.jsx). Eigene Namen: Präfix `ppFx12` / `PP_FX12_`.

// ── Bausteine ────────────────────────────────────────────────────────────────────────────────────────────────────────
const ppFx12R = (a, b) => a + Math.random() * (b - a);
const ppFx12Pick = (l) => l[Math.floor(Math.random() * l.length)];
const ppFx12Farben = (l) => l.map(ppHex);
const ppFx12Aus = ppFx7Bez(0, 0, 0.58, 1);                 // CSS `ease-out`
const ppFx12Ein = (u) => u * u;
/** Verzug + Dauer so raffen, dass das Teilchen vor `ende` (ms) fertig ist (der Aufrufer räumt nach 1000 ms ab). */
function ppFx12Fit(verzug, dauer, ende = 960) {
  const k = Math.min(1, ende / (verzug + dauer));
  return [verzug * k, dauer * k];
}
/** Quadrat mit Seitenlänge aus Bildschirmpixeln (mind. 1 Rasterpixel), zentriert. */
function ppFx12Punkt(g, x, y, px, c, a) {
  const n = Math.max(1, Math.round(px / 3));
  g.block(x - n / 2, y - n / 2, n, n, c, a);
}
/** Funke: Punkt mit kurzem, dunklerem Schweif darunter (steigende Glut). */
function ppFx12Glut(g, x, y, px, c, schweif, a) {
  const n = Math.max(1, Math.round(px / 3));
  const X = Math.round(x - n / 2), Y = Math.round(y - n / 2);
  if (schweif && n >= 2) g.block(X, Y + n, n, Math.max(1, n - 1), schweif, a * 0.5);
  g.block(X, Y, n, n, c, a);
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Elixir of Strength (`empowered_strike_apply`) — oranger Auradunst (950 ms: wächst .7 → 1 → 1,18, blendet aus), ein Druckring (800 ms) bis 1,25 × Zonenbreite, eine Pixel-Faust (Bizeps) ab 120 ms (700 ms),
//  16 Funken (Sternzeichen → kleine Kreuze) steigen aus einem Ring um die Mitte auf (650–950 ms, ab 0–260 ms).
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX12_ARM_PAL = { o: ppHex('#c68206'), Y: ppHex('#fad54a'), W: ppHex('#fff196'), s: ppHex('#f9ac20') };
const PP_FX12_ARM = {
  gross: ['......ooo....', '.....oYYYo...', '.....oYWYYo..', '.....oYYYYo..', '.....oYYYo...', '..oo.oYYYo...', '.oYYooYYYYoo.', 'oYYYYYYYYYYYo', 'oYYYYYYYYYYYo', '.osYYYYYYYYso', '..ooooooooo..'],
  klein: ['...oo..', '..oYYo.', '.ooYYoo', 'oYYYYYo', 'oYssssY', '.ooooo.'],
};
const PP_FX12_FUNKE_PAL = { Y: ppHex('#fbc86a'), W: ppHex('#fff196') };
const PP_FX12_FUNKE = { gross: ['..Y..', '..Y..', 'YYWYY', '..Y..', '..Y..'], mittel: ['.Y.', 'YWY', '.Y.'] };
const ppFx12Emp = ppR1Leinwand((g, t, sz, te) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, cw = te.cw, ch = te.ch;
  const ak = t / 950;
  if (ak < 1) {
    const sc = ppFx7Kf(ak, [[0, 0.7], [0.3, 1], [1, 1.18]], ppFx12Aus), a = ppFx7Kf(ak, [[0, 0], [0.3, 0.95], [1, 0]], ppFx12Aus);
    if (a > 0.04) ppFx7Glow(g, cx, cy, cw * 0.55 * sc / S, ch * 0.55 * sc / S, te.aura, a * 0.85, 1);
  }
  const rk = t / 800;
  if (rk < 1) {
    const e = ppFx12Aus(rk), r = (3 + (cw * 0.625 - 3) * e) / S, a = Math.min(1, (1 - e) * 2);
    g.ring(cx, cy, r + 0.2, r + 1.5, te.schein, a * 0.6);          // harter Schein statt Leuchten
    g.ring(cx, cy, r - 1, r + 0.2, te.ring, a);
  }
  const fk = (t - 120) / 700;
  if (fk >= 0 && fk <= 1) {
    const sc = ppFx7Kf(fk, [[0, 0.5], [0.4, 1.25], [1, 1]], ppFx12Aus), a = ppFx7Kf(fk, [[0, 0], [0.4, 1], [1, 0]], ppFx12Aus);
    if (sc >= 1.1 && a > 0.1) ppFx7Glow(g, cx, cy, 11, 11, te.aura, a * 0.35, 1);
    g.spr(sc < 0.8 ? PP_FX12_ARM.klein : PP_FX12_ARM.gross, PP_FX12_ARM_PAL, cx, cy, a);
  }
  for (const s of te.funken) {
    const u = (t - s.verzug) / s.dauer;
    if (u < 0 || u > 1) continue;
    const f = ppFx7Kf(u, [[0, 0], [0.25, 0.3], [1, 1]], ppFx12Aus), sc = ppFx7Kf(u, [[0, 0.4], [0.25, 1], [1, 0.5]], ppFx12Aus), a = ppFx7Kf(u, [[0, 0], [0.25, 1], [1, 0]], ppFx12Aus);
    const px = (s.sx + s.drift * f + s.gr * 0.5) / S + cx, py = (s.sy + s.rise * f + s.gr * 0.6) / S + cy, gr = s.gr * sc;
    if (gr >= 15) g.spr(PP_FX12_FUNKE.gross, PP_FX12_FUNKE_PAL, px, py, a);
    else if (gr >= 8) g.spr(PP_FX12_FUNKE.mittel, PP_FX12_FUNKE_PAL, px, py, a);
    else g.put(px, py, PP_FX12_FUNKE_PAL.Y, a);
  }
}, 1000, (p) => {
  const cw = p.w || 100, ch = p.h || 140, hx = Math.max(cw * 0.72, 90) + 24, up = Math.max(ch * 0.7, 100) + 80, dn = Math.max(ch * 0.65, 90) + 20;
  return { breite: hx * 2, hoehe: up + dn, ankerY: up };
}, {
  z: 10100,
  vorbereiten: (sz) => ({
    cw: sz.props.w || 100, ch: sz.props.h || 140,
    aura: ppFx12Farben(['#cf5f00', '#ff8b1a', '#f9ac20']), schein: ppHex('#ff9a1a'), ring: ppHex('#ffd066'),
    funken: Array.from({ length: ppFxN(16) }, () => {
      const w = Math.random() * Math.PI * 2, d = ppFx12R(22, 52), [verzug, dauer] = ppFx12Fit(Math.random() * 260, 650 + Math.random() * 300);
      return { sx: Math.cos(w) * d, sy: Math.sin(w) * d * 0.6, rise: -ppFx12R(28, 83), drift: ppFx12R(-17.5, 17.5), gr: ppFx12R(10, 22), verzug, dauer };
    }),
  }),
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Equip-Aktivierungs-Flash (`equip_flash`; Shield of Life / Death, Castling, Glass Sword …) — ein pulsierender Rahmen in Zonengröße (mind. 60×80, Rundung 10) in der Farbe `color` (Standard Gold; auf die
//  Palette gerastet): 900 ms, wächst .85 → 1,06 → 1 → 1,12 und blendet 0 → 1 → .9 → 0. Rand = ein Rasterpixel, Schein innen und außen = Dither-Stufen. Zeichnet auf Ebene 10050 (unter den Zonen-Effekten).
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const ppFx12Equip = ppR1Leinwand((g, t, sz, te) => {
  const S = sz.S, u = t / 900;
  if (u > 1) return;
  const sc = ppFx7Kf(u, [[0, 0.85], [0.2, 1.06], [0.55, 1], [1, 1.12]], ppFx12Aus), op = ppFx7Kf(u, [[0, 0], [0.2, 1], [0.55, 0.9], [1, 0]], ppFx12Aus);
  if (op <= 0.03) return;
  const cx = Math.round(sz.cx), cy = Math.round(sz.cy);
  const hx = te.bw * sc / 2 / S, hy = te.bh * sc / 2 / S, r = Math.min(10 * sc / S, hx, hy), RX = Math.ceil(hx) + 9, RY = Math.ceil(hy) + 9;
  for (let j = -RY; j <= RY; j++) {
    const qy = Math.max(Math.abs(j) - (hy - r), 0), qyn = Math.abs(j) - (hy - r);
    for (let i = -RX; i <= RX; i++) {
      const qx = Math.max(Math.abs(i) - (hx - r), 0), qxn = Math.abs(i) - (hx - r);
      const d = Math.sqrt(qx * qx + qy * qy) + Math.min(Math.max(qxn, qyn), 0) - r;           // Abstand zur Kante (Rasterpixel): < 0 innen
      let a;
      if (d > 8) continue;
      if (d > 0) a = op * 0.9 * (1 - d / 8);                                                  // äußerer Schein
      else if (d > -1) a = op;                                                                // Rand
      else if (d > -8) a = op * 0.85 * (1 - (-d - 1) / 7);                                    // innerer Schein
      else continue;
      g.put(cx + i, cy + j, d > -1 && d <= 0 ? te.rand : te.c, a);
    }
  }
}, 900, (p) => {
  const bw = Math.max(60, p.w || 80), bh = Math.max(80, p.h || 110);
  return { breite: bw * 1.12 + 60, hoehe: bh * 1.12 + 60 };
}, {
  z: 10050,
  vorbereiten: (sz) => {
    let farbe = String(sz.props.color || '#fad54a');
    if (!/^#[0-9a-fA-F]{6}$/.test(farbe)) farbe = '#fad54a';
    try { if (window.ppSnap) farbe = window.ppSnap(farbe); } catch (e) { /* ohne Palettenrasterung */ }
    const c = ppHex(farbe);
    let rand = c.map((v) => Math.min(255, v + 60));                          // hellerer Rand — ebenfalls auf die Palette gerastet
    try { if (window.ppSnapRgb) rand = Array.from(window.ppSnapRgb(rand[0], rand[1], rand[2])); } catch (e) { /* ohne Rasterung */ }
    return { bw: Math.max(60, sz.props.w || 80), bh: Math.max(80, sz.props.h || 110), c, rand };
  },
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Falling Boulder (`falling_boulder`, Boulder in a Bottle) — EIN Fels fällt aus 320 px Höhe in die Zone (540 ms, Kurve .55/0/.85/.4, Drehung -22° → 6°, Stauchen beim Aufschlag), Schatten wächst mit,
//  Staubwelle + 9 Gerölle ab 470 ms. Der Fels bleibt liegen (wie `forwards`). Der Fels ist ein Neuneck, das je Bild gedreht GERASTERT wird (Licht fest oben links, Risse drehen mit) — kein gedrehtes Bild.
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX12_FELS_FORM = [[0.30, 0.04], [0.64, 0.00], [0.88, 0.22], [1.00, 0.54], [0.82, 0.84], [0.52, 1.00], [0.20, 0.92], [0.02, 0.62], [0.06, 0.26]].map(([x, y]) => [x - 0.5, y - 0.5]);
const PP_FX12_FELS_RISSE = [[-0.22, -0.30, 0.05, 0.02], [0.08, 0.02, 0.30, 0.22], [-0.30, 0.18, -0.08, 0.34]];     // Strecken (x0, y0, x1, y1) im Felsmaß
const PP_FX12_FELS_FARBE = ppFx12Farben(['#929292', '#686868', '#535353', '#323232']);
const PP_FX12_FELS_MASKE = new Uint8Array(96 * 96);
/** Fels der Größe `gr` (Rasterpixel) um (cx, cy), Drehung `rot` (Bogenmaß), Streckung (sx, sy). */
function ppFx12Fels(g, cx, cy, gr, rot, sx, sy, a) {
  cx = Math.round(cx); cy = Math.round(cy);
  const R = Math.min(47, Math.ceil(gr * 0.85 * Math.max(sx, sy)) + 1), n = 2 * R + 1, cs = Math.cos(rot), sn = Math.sin(rot), maske = PP_FX12_FELS_MASKE, P = PP_FX12_FELS_FORM, nP = P.length;
  const ix = 1 / (sx * gr), iy = 1 / (sy * gr);
  maske.fill(0, 0, n * n);
  for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) {
    const lx = (i * cs + j * sn) * ix, ly = (-i * sn + j * cs) * iy;
    let innen = false;
    for (let q = 0, w = nP - 1; q < nP; w = q++) {
      const yi = P[q][1], yw = P[w][1];
      if ((yi > ly) !== (yw > ly) && lx < ((P[w][0] - P[q][0]) * (ly - yi)) / (yw - yi) + P[q][0]) innen = !innen;
    }
    if (innen) maske[(j + R) * n + i + R] = 1;
  }
  const F = PP_FX12_FELS_FARBE;
  for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) {
    const k = (j + R) * n + i + R;
    if (!maske[k]) continue;
    let c;
    if (!(i > -R && i < R && j > -R && j < R && maske[k - 1] && maske[k + 1] && maske[k - n] && maske[k + n])) c = F[3];
    else {
      const dl = Math.sqrt((i + 0.16 * gr) * (i + 0.16 * gr) + (j + 0.22 * gr) * (j + 0.22 * gr)) / (0.85 * gr), w = dl + (ppBayer(cx + i, cy + j) - 0.5) * 0.22;
      c = w < 0.3 ? F[0] : w < 0.6 ? F[1] : w < 0.9 ? F[2] : F[3];
      const lx = (i * cs + j * sn) * ix, ly = (-i * sn + j * cs) * iy;
      for (let r = 0; r < 3; r++) {                                              // Risse im Felsmaß (drehen mit)
        const [x0, y0, x1, y1] = PP_FX12_FELS_RISSE[r], dx = x1 - x0, dy = y1 - y0, kk = Math.max(0, Math.min(1, ((lx - x0) * dx + (ly - y0) * dy) / (dx * dx + dy * dy)));
        const ex = lx - x0 - dx * kk, ey = ly - y0 - dy * kk;
        if (ex * ex + ey * ey < 0.001) { c = F[3]; break; }
      }
    }
    g.put(cx + i, cy + j, c, a);
  }
}
const ppFx12FelsFall = ppFx7Bez(0.55, 0, 0.85, 0.4);
const ppFx12Boulder = ppR1Leinwand((g, t, sz, te) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, gr = te.gr;
  // Schatten (540 ms, bleibt)
  {
    const q = Math.min(1, t / 540), e = ppFx12FelsFall;
    const sc = ppFx7Kf(q, [[0, 0.25], [0.7, 0.7], [1, 1]], e), op = ppFx7Kf(q, [[0, 0], [0.7, 0.5], [1, 0.9]], e);
    if (op > 0.03) ppFx7Glow(g, cx, cy + (te.hh * 0.16 + te.gross * 0.15) / S, te.gross * 0.42 * sc / S, te.gross * 0.15 * sc / S, [te.schwarz], op * 0.85, 0.8);
  }
  // Fels
  {
    const q = Math.min(1, t / 540), e = ppFx12FelsFall;
    let ty, rot, sx = 1, sy = 1, op;
    if (q < 0.82) { const k = e(q / 0.82); ty = -320 * (1 - k); rot = -22 + 28 * k; sx = sy = 0.92 + 0.08 * k; }
    else if (q < 0.9) { const k = e((q - 0.82) / 0.08); ty = 0; rot = 6; sx = 1 + 0.06 * k; sy = 1 - 0.1 * k; }
    else { const k = e((q - 0.9) / 0.1); ty = 0; rot = 6 - 2 * k; sx = 1.06 - 0.06 * k; sy = 0.9 + 0.1 * k; }
    op = Math.min(1, q / 0.12);
    if (op > 0.03) ppFx12Fels(g, cx, cy + ty / S, gr, rot * Math.PI / 180, sx, sy, op);
  }
  // Staubwelle (ab 470 ms, 620 ms)
  {
    const k = (t - 470) / 620;
    if (k >= 0 && k <= 1) {
      const sc = ppFx7Kf(k, [[0, 0.3], [0.25, 1], [1, 1.6]], ppFx12Aus), op = ppFx7Kf(k, [[0, 0], [0.25, 1], [1, 0]], ppFx12Aus);
      if (op > 0.03) ppFx7Glow(g, cx, cy + (te.hh * 0.06 + te.ww * 0.21) / S, te.ww * 0.5 * sc / S, te.ww * 0.21 * sc / S, te.staub, op * 0.85, 1);
    }
  }
  // Geröll
  for (const d of te.geroell) {
    const u = (t - 470) / d.dauer;
    if (u < 0 || u > 1) continue;
    const e = ppFx12Aus(u), a = u < 0.15 ? u / 0.15 : 1 - (u - 0.15) / 0.85, n = Math.max(1, Math.round(d.groesse / S));
    const x = Math.round(cx + d.dx * e / S - n / 2), y = Math.round(cy + (te.hh * 0.1 + d.dy * e) / S - n / 2);
    g.block(x, y, n, n, te.geroellFarbe[0], a);
    if (n >= 2) g.block(x + 1, y + 1, n - 1, n - 1, te.geroellFarbe[1], a);
  }
}, 1500, (p) => {
  const ww = Math.max(p.w || 80, 80), hh = Math.max(p.h || 110, 110), gross = ww * 0.74;
  const hx = ww * 0.95 + 20, oben = 320 + gross / 2 + 40, unten = hh * 0.06 + ww * 0.55 + 24;
  return { breite: hx * 2, hoehe: oben + unten, ankerY: oben };
}, {
  z: 10140,
  vorbereiten: (sz) => {
    const ww = Math.max(sz.props.w || 80, 80), hh = Math.max(sz.props.h || 110, 110), gross = ww * 0.74;
    return {
      ww, hh, gross, gr: gross / 3, schwarz: ppHex('#000000'), staub: ppFx12Farben(['#929292', '#c5b7a0']), geroellFarbe: ppFx12Farben(['#929292', '#535353']),
      geroell: Array.from({ length: ppFxN(9) }, () => {
        const w = -Math.PI * (0.1 + Math.random() * 0.8), weite = ww * (0.35 + Math.random() * 0.5), [, dauer] = ppFx12Fit(470, 420 + Math.random() * 260);
        return { dx: Math.cos(w) * weite, dy: Math.sin(w) * weite * 0.5, groesse: 3 + Math.random() * 6, dauer };
      }),
    };
  },
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Fan Blow (`fan_blow`, Noble Mummy Guards) — sechs Fächer (Handfächer-Emoji → Pixelfächer, je 40 ms versetzt, 500–700 ms: poppen auf 1,3 und gleiten 20 px nach rechts) und 14 Windstriche (waagerecht, 8–24 px lang,
//  schießen 40–70 px nach rechts, ab 50–250 ms, 400–700 ms). Der Fächer dreht sich nicht (kein gedrehtes Bild); er wechselt zwischen zwei Größen.
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX12_FAECHER_PAL = { o: ppHex('#8c0014'), r: ppHex('#e92f38'), p: ppHex('#fe7476'), y: ppHex('#fad54a') };
const PP_FX12_FAECHER = {
  gross: ['..ooooo..', '.orpprro.', 'orpyryrro', 'orpyryrro', '.orryrro.', '..ooyoo..', '....y....'],
  klein: ['.ooo.', 'orrro', '.ryr.', '..y..'],
};
const PP_FX12_WIND = ppFx12Farben(['#f9ecb3', '#e0c085', '#ffd066', '#fbe181', '#fffbd2']);
const ppFx12Faecher = ppR1Leinwand((g, t, sz, te) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy;
  for (const f of te.faecher) {
    const u = (t - f.verzug) / f.dauer;
    if (u < 0 || u > 1) continue;
    const sc = ppFx7Kf(u, [[0, 0.5], [0.3, 1.3], [0.6, 1.1], [1, 0.8]], ppFx12Aus), a = ppFx7Kf(u, [[0, 0], [0.3, 1], [0.6, 0.8], [1, 0]], ppFx12Aus), dx = ppFx7Kf(u, [[0, 0], [0.6, 0], [1, 20]], ppFx12Aus);
    g.spr(f.size * sc >= 14 ? PP_FX12_FAECHER.gross : PP_FX12_FAECHER.klein, PP_FX12_FAECHER_PAL, cx + (f.x + f.size / 2 + dx) / S, cy + (f.y + f.size * 0.6) / S, a);
  }
  for (const w of te.wind) {
    const u = (t - w.verzug) / w.dauer;
    if (u < 0 || u > 1) continue;
    const dx = ppFx7Kf(u, [[0, 0], [0.3, 10], [1, w.weg]], ppFx12Aus), sx = ppFx7Kf(u, [[0, 0.5], [0.3, 1.5], [1, 0.3]], ppFx12Aus), a = ppFx7Kf(u, [[0, 0], [0.3, 0.8], [1, 0]], ppFx12Aus);
    const len = Math.max(1, Math.round(w.size * sx / S)), x = cx + (w.x + w.size / 2 + dx) / S - len / 2;
    g.block(x, cy + (w.y + 1) / S, len, 1, w.farbe, Math.min(1, a * 1.15));
  }
}, 1000, { breite: 270, hoehe: 150 }, {
  z: 10100,
  vorbereiten: () => ({
    faecher: Array.from({ length: ppFxN(6) }, (_, i) => {
      const [verzug, dauer] = ppFx12Fit(i * 40, 500 + Math.random() * 200);
      return { x: ppFx12R(-12, 12), y: ppFx12R(-5, 5), size: ppFx12R(14, 20), verzug, dauer };
    }),
    wind: Array.from({ length: ppFxN(14) }, () => {
      const [verzug, dauer] = ppFx12Fit(50 + Math.random() * 200, 400 + Math.random() * 300);
      return { x: ppFx12R(-8, 8), y: ppFx12R(-10, 10), size: ppFx12R(8, 24), weg: ppFx12R(40, 70), farbe: ppFx12Pick(PP_FX12_WIND), verzug, dauer };
    }),
  }),
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Field Standard Rally (`field_standard_rally`, Field Standard / Great Offensive) — sechs Trompeten (Pixeltrompete) schmettern strahlenförmig 42 px nach außen (je 45 ms versetzt, 1000 ms, poppen
//  .3 → 1,15 → 1 → .7), dazu 16 Konfetti-Zeichen (Knallbonbon, Konfettikugel, Funkeln, Stern als Pixelbilder) fliegen nach oben-außen (700–1080 ms, ab 0–280 ms). Goldener Dither-Schein um die Trompeten.
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX12_TROMPETE_PAL = { o: ppHex('#c68206'), Y: ppHex('#fad54a'), W: ppHex('#fff196'), s: ppHex('#f9ac20') };
const PP_FX12_TROMPETE = {
  gross: ['.......ooo..', '......oYYYo.', '.ooooooYWYYo', 'oYYYYYYYYYYo', '.oooooooYsYo', '......oYssYo', '.......ooo..'],
  klein: ['...oo', '.oYYo', 'oYYYo', '.oooo'],
};
const PP_FX12_KONFETTI_PAL = { R: ppHex('#e92f38'), B: ppHex('#68c6fd'), G: ppHex('#4ceb70'), Y: ppHex('#fad54a'), P: ppHex('#fe7476'), M: ppHex('#a040ff'), o: ppHex('#c68206'), W: ppHex('#fff196'), k: ppHex('#ffd066') };
const PP_FX12_KONFETTI = [
  ['...B..Y', '.R..G..', '...P.M.', '..oY...', '.oYYo..', 'oYRYYo.', 'ooooooo'],                                   // Knallbonbon
  ['.kkkk.', 'kRBYGk', 'kYMRBk', 'kGBYPk', 'kMRGYk', '.kkkk.'],                                                      // Konfettikugel
  ['..W..', '..Y..', 'WYWYW', '..Y..', '..W..'],                                                                      // Funkeln
  ['...Y...', '...Y...', 'YYYWYYY', '.YYWYY.', '..YYY..', '.YY.YY.', '.Y...Y.'],                                    // Stern
];
const ppFx12Rally = ppR1Leinwand((g, t, sz, te) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy;
  for (const tr of te.trompeten) {
    const u = (t - tr.verzug) / tr.dauer;
    if (u < 0 || u > 1) continue;
    const f = ppFx7Kf(u, [[0, 0], [0.22, 0.55], [0.72, 1], [1, 1.25]], ppFx12Aus), sc = ppFx7Kf(u, [[0, 0.3], [0.22, 1.15], [0.72, 1], [1, 0.7]], ppFx12Aus), a = ppFx7Kf(u, [[0, 0], [0.22, 1], [0.72, 1], [1, 0]], ppFx12Aus);
    const x = cx + tr.dx * f / S, y = cy + tr.dy * f / S;
    if (sc >= 0.7 && a > 0.2) ppFx7Glow(g, x, y, 6.5, 6, te.schein, a * 0.32, 1);
    g.spr(sc < 0.7 ? PP_FX12_TROMPETE.klein : PP_FX12_TROMPETE.gross, PP_FX12_TROMPETE_PAL, x, y, a);
  }
  for (const c of te.konfetti) {
    const u = (t - c.verzug) / c.dauer;
    if (u < 0 || u > 1) continue;
    const f = ppFx7Kf(u, [[0, 0], [0.3, 0.4], [1, 1]], ppFx12Aus), sc = ppFx7Kf(u, [[0, 0.4], [0.3, 1.05], [1, 0.55]], ppFx12Aus), a = ppFx7Kf(u, [[0, 0], [0.3, 1], [1, 0]], ppFx12Aus);
    const x = cx + c.dx * f / S, y = cy + c.dy * f / S;
    if (c.size * sc >= 10) g.spr(PP_FX12_KONFETTI[c.art], PP_FX12_KONFETTI_PAL, x, y, a);
    else g.put(x, y, PP_FX12_KONFETTI_PAL[c.farbe], a);
  }
}, 1000, { breite: 240, hoehe: 220 }, {
  z: 10100,
  vorbereiten: () => ({
    schein: ppFx12Farben(['#f9ac20', '#fbe181']),
    trompeten: Array.from({ length: ppFxN(6) }, (_, i) => {
      const w = (i / 6) * Math.PI * 2 - Math.PI / 2, [verzug, dauer] = ppFx12Fit(i * 45, 1000);
      return { dx: Math.cos(w) * 42, dy: Math.sin(w) * 42, verzug, dauer };
    }),
    konfetti: Array.from({ length: ppFxN(16) }, () => {
      const w = Math.random() * Math.PI * 2, d = ppFx12R(26, 48), [verzug, dauer] = ppFx12Fit(Math.random() * 280, 700 + Math.random() * 380);
      return { dx: Math.cos(w) * d, dy: Math.sin(w) * d - 14, size: ppFx12R(11, 20), art: Math.floor(Math.random() * 4), farbe: ppFx12Pick(['R', 'B', 'G', 'Y', 'P', 'M']), verzug, dauer };
    }),
  }),
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Flammenzunge für Firewall / Flame Pillars: die Pixelflamme von Bomblebee/Flame Strike (`ppFx1Flamme`), Fuß bei (cx, by). `art`: 'f' Flamme · 'k' (Knall) breiter und flacher · 's' (Stern) schmal und hoch.
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
function ppFx12Zunge(g, cx, by, gr, sy, a, art, seed) {
  const B = gr * (art === 'k' ? 0.95 : art === 's' ? 0.45 : 0.75), H = gr * 0.92 * sy * (art === 'k' ? 0.8 : art === 's' ? 1.15 : 1);
  ppFx1Flamme(g, cx, by, B, H, a, seed);
}
const PP_FX12_STERN_PAL = { Y: ppHex('#fad54a'), W: ppHex('#fffbd2') };
const PP_FX12_STERN = { gross: ['..Y..', '.YWY.', 'YWWWY', '.YWY.', '..Y..'], klein: ['.Y.', 'YWY', '.Y.'] };

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Firewall (`firewall`, Surprise Spell) — eine Feuerwand am Zonenboden: ein Bodenschein (900 ms, wächst von .3 auf 1 Breite), 14 Flammensäulen quer über 1,1 Zonenbreiten (Flammen-Emoji → Pixelflamme,
//  780–1100 ms, Verzug 0–220 ms: steigen 150 px, strecken sich bis 2fach und blenden aus) und 28 Glutfunken, die 0,7–1,9 Zonenhöhen aufsteigen (500–1000 ms, ab 0–600 ms). Dither-Schein hinter der Wand.
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const ppFx12Firewall = ppR1Leinwand((g, t, sz, te) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, cw = te.cw, ch = te.ch;
  const bk = t / 900;
  if (bk < 1) {
    const sx = ppFx7Kf(bk, [[0, 0.3], [0.3, 1], [1, 1.05]], ppFx12Aus), a = ppFx7Kf(bk, [[0, 0], [0.3, 1], [1, 0]], ppFx12Aus);
    if (a > 0.03) ppFx7Glow(g, cx, cy + (ch * 0.35 + 25) / S, cw * 0.6 * sx / S, 25 / S, te.boden, a * 0.85, 0.9);
  }
  let hell = 0;
  for (const c of te.saeulen) {
    const u = (t - c.verzug) / c.dauer;
    if (u < 0 || u > 1) continue;
    const ty = ppFx7Kf(u, [[0, 20], [0.25, -30], [0.6, -90], [1, -150]], ppFx12Aus), sy = ppFx7Kf(u, [[0, 0.4], [0.25, 1.2], [0.6, 1.6], [1, 2]], ppFx12Aus), a = ppFx7Kf(u, [[0, 0], [0.25, 1], [0.6, 1], [1, 0]], ppFx12Aus);
    hell = Math.max(hell, a);
    if (a < 0.03) continue;
    const x = cx + (c.offsetX + c.size * 0.55) / S, fuss = cy + (ch * 0.45 + c.size * 1.05 + ty) / S;
    ppFx12Zunge(g, x, fuss, c.size / S, sy, a, c.art, c.seed);
  }
  if (hell > 0.05) ppFx7Glow(g, cx, cy + ch * 0.05 / S, cw * 0.62 / S, ch * 0.62 / S, te.wandschein, hell * 0.2, 1.2);
  for (const e of te.glut) {
    const u = (t - e.verzug) / e.dauer;
    if (u < 0 || u > 1) continue;
    const f = ppFx12Aus(u), a = ppFx7Kf(u, [[0, 0], [0.25, 1], [1, 0]], ppFx12Aus);
    ppFx12Glut(g, cx + e.offsetX / S, cy + (ch * 0.45 + e.riseY * f) / S, e.size, e.farbe, e.schweif, a);
  }
}, 1000, (p) => {
  const cw = p.w || 100, ch = p.h || 140, hx = cw * 0.62 + 50, oben = ch * 1.55 + 40, unten = ch * 0.45 + 100;
  return { breite: hx * 2, hoehe: oben + unten, ankerY: oben };
}, {
  z: 10100,
  vorbereiten: (sz) => {
    const cw = sz.props.w || 100, ch = sz.props.h || 140;
    return {
      cw, ch, boden: ppFx12Farben(['#cc2b00', '#ff491a', '#ff8b1a']), wandschein: ppFx12Farben(['#b62600', '#f87420']),
      saeulen: Array.from({ length: ppFxN(14) }, (_, i) => {
        const [verzug, dauer] = ppFx12Fit(Math.random() * 220, 780 + Math.random() * 320), r = Math.random();
        return { offsetX: -cw * 0.55 + (cw * 1.1 / 13) * i + ppFx12R(-6, 6), size: ppFx12R(34, 54), art: r < 0.667 ? 'f' : r < 0.833 ? 'k' : 's', seed: Math.random() * 6, verzug, dauer };
      }),
      glut: Array.from({ length: ppFxN(28) }, () => {
        const [verzug, dauer] = ppFx12Fit(Math.random() * 600, 500 + Math.random() * 500), farbe = ppFx12Pick(['#ff1a1a', '#ff491a', '#ff8b1a', '#f9ac20', '#fad54a']);
        return { offsetX: ppFx12R(-cw * 0.55, cw * 0.55), riseY: -(ch * 0.7 + Math.random() * ch * 1.2), size: ppFx12R(4, 11), farbe: ppHex(farbe), schweif: ppHex('#b62600'), verzug, dauer };
      }),
    };
  },
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Dance of the Flame Pillars (`flame_pillars`) — ein Feuerstrahl schießt vom Zonenboden nach oben: heller Fußblitz (380 ms), 26 Flammen (Pixelflamme bzw. Sternchen; 12–26 px, je 18 ms versetzt,
//  420–660 ms, steigen 1–1,6 Zonenhöhen mit leichtem Schwanken, Kurve .3/.7/.3/1) und 14 Glutfunken, die ab 230 ms oben nach außen spritzen (500–820 ms).
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const ppFx12Steig = ppFx7Bez(0.3, 0.7, 0.3, 1);
const ppFx12Pillars = ppR1Leinwand((g, t, sz, te) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, cw = te.cw, ch = te.ch;
  const bk = t / 380;
  if (bk < 1) {
    const sx = ppFx7Kf(bk, [[0, 0.35], [0.3, 1.1], [1, 1.45]], ppFx12Aus), sy = ppFx7Kf(bk, [[0, 0.5], [0.3, 1.15], [1, 0.8]], ppFx12Aus), a = ppFx7Kf(bk, [[0, 0], [0.3, 0.95], [1, 0]], ppFx12Aus);
    if (a > 0.03) ppFx7Glow(g, cx, cy + ch * 0.38 / S, cw * 0.42 * sx / S, ch * 0.16 * sy / S, te.fuss, a * 0.95, 0.9);
  }
  for (const p of te.strahl) {
    const u = (t - p.verzug) / p.dauer;
    if (u < 0 || u > 1) continue;
    const dy = ppFx7Kf(u, [[0, 0], [0.15, p.rise * 0.15], [0.7, p.rise * 0.7], [1, p.rise]], ppFx12Steig), dx = ppFx7Kf(u, [[0, 0], [0.15, 0], [0.7, p.sway], [1, p.sway]], ppFx12Steig);
    const sc = ppFx7Kf(u, [[0, 0.4], [0.15, 1.25], [0.7, 1], [1, 0.5]], ppFx12Steig), a = ppFx7Kf(u, [[0, 0], [0.15, 1], [0.7, 1], [1, 0]], ppFx12Steig);
    if (a < 0.03) continue;
    const gr = p.size * sc, x = cx + (p.startX + p.size * 0.55 + dx) / S, y = cy + (ch * 0.45 + p.size * 0.6 + dy) / S;
    if (p.art === 'f') ppFx1Flamme(g, x, y + gr * 0.5 / S, gr * 0.78 / S, gr / S, a, p.seed);
    else if (gr >= 15) g.spr(PP_FX12_STERN.gross, PP_FX12_STERN_PAL, x, y, a);
    else g.spr(PP_FX12_STERN.klein, PP_FX12_STERN_PAL, x, y, a);
  }
  for (const e of te.glut) {
    const u = (t - e.verzug) / e.dauer;
    if (u < 0 || u > 1) continue;
    const f = ppFx12Aus(u), a = u < 0.22 ? u / 0.22 : 1 - ppFx12Aus((u - 0.22) / 0.78), sc = 1 - 0.65 * f;
    ppFx12Punkt(g, cx + e.dx * f / S, cy + (-ch * 0.35 + e.dy * f) / S, e.size * sc, e.farbe, a);
  }
}, 1000, (p) => {
  const cw = p.w || 100, ch = p.h || 140, hx = Math.max(cw * 0.75, 110) + 20, oben = Math.max(ch * 1.3 + 50, 210), unten = ch * 0.45 + 70;
  return { breite: hx * 2, hoehe: oben + unten, ankerY: oben };
}, {
  z: 10100,
  vorbereiten: (sz) => {
    const cw = sz.props.w || 100, ch = sz.props.h || 140;
    return {
      cw, ch, fuss: ppFx12Farben(['#ff491a', '#f9ac20', '#f7f7ad']),
      strahl: Array.from({ length: ppFxN(26) }, (_, i) => {
        const [verzug, dauer] = ppFx12Fit(i * 18 + Math.random() * 60, 420 + Math.random() * 240);
        return { startX: ppFx12R(-cw * 0.18, cw * 0.18), verzug, dauer, size: ppFx12R(12, 26), art: Math.random() < 4 / 6 ? 'f' : 's', sway: ppFx12R(-10, 10), rise: -(ch + Math.random() * ch * 0.6), seed: Math.random() * 6 };
      }),
      glut: Array.from({ length: ppFxN(14) }, () => {
        const w = -Math.PI / 2 + (Math.random() - 0.5) * 1.4, v = ppFx12R(38, 98), [verzug, dauer] = ppFx12Fit(230 + Math.random() * 220, 500 + Math.random() * 320);
        return { dx: Math.cos(w) * v, dy: Math.sin(w) * v, size: ppFx12R(3, 7), farbe: ppHex(ppFx12Pick(['#ff1a1a', '#ff8b1a', '#f9ac20', '#f8ca21', '#ffe469'])), verzug, dauer };
      }),
    };
  },
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Spirit of the Barbarian Sword (`flaming_slash`) — zwei feurige Hiebe im Kreuz: ein Band (118 × 13 px, -38°, ab 0 ms) und ein kürzeres (96 × 9 px, +26°, ab 130 ms) fahren in 460 ms aus der Mitte heraus
//  (Länge 0 → 1 → 1,12, Dicke .5 → 1,15 → .35); Farbfolge Creme – Orange – Rot, dazu ein gedithertes Außenband als Schein. Nachglühen (620 ms ab 120 ms) und 18 Glutfunken (ab 60–280 ms).
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const ppFx12Hieb = ppFx7Bez(0.15, 0.85, 0.3, 1);
const ppFx12Slash = ppR1Leinwand((g, t, sz, te) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy;
  for (const h of te.streiche) {
    const u = (t - h.verzug) / 460;
    if (u < 0 || u > 1) continue;
    const sx = ppFx7Kf(u, [[0, 0], [0.55, 1], [1, 1.12]], ppFx12Hieb), sy = ppFx7Kf(u, [[0, 0.5], [0.55, 1.15], [1, 0.35]], ppFx12Hieb), a = ppFx7Kf(u, [[0, 0], [0.18, 1], [0.55, 1], [1, 0]], ppFx12Hieb);
    if (a < 0.03 || sx < 0.04) continue;
    const L = h.laenge * sx / S, w = Math.max(1.2, h.dicke * sy / S), dx = Math.cos(h.rot), dy = Math.sin(h.rot);
    const kopf = (v) => 1 - Math.pow(Math.abs(v * 2 - 1), 1.7);                        // Spindelform: an den Enden dünn
    const x0 = cx - dx * L / 2, y0 = cy - dy * L / 2, x1 = cx + dx * L / 2, y1 = cy + dy * L / 2;
    ppR1Band(g, x0, y0, x1, y1, (v) => ({ w: w + 4 * kopf(v), c: te.glut[0], a: 0.3 * kopf(v) }), a);                      // Schein (gedithert)
    ppR1Band(g, x0, y0, x1, y1, (v) => {                                               // Körper: Orange – Creme – Orange – Rot
      const q = kopf(v);
      if (q < 0.1) return null;
      return { w: Math.max(1, w * Math.pow(q, 0.6)), c: v < 0.1 || v > 0.94 ? te.rampe[4] : v < 0.3 ? te.rampe[2] : v < 0.6 ? te.rampe[1] : v < 0.9 ? te.rampe[0] : te.rampe[4] };
    }, a);
    ppR1Band(g, x0, y0, x1, y1, (v) => (kopf(v) > 0.4 && v > 0.14 && v < 0.5 ? { w: Math.max(1, w * 0.3), c: te.rampe[3] } : null), a);   // weißer Kern
  }
  const nk = (t - 120) / 620;
  if (nk >= 0 && nk <= 1) {
    const sc = ppFx7Kf(nk, [[0, 0.4], [0.3, 1], [1, 1.5]], ppFx12Aus), a = ppFx7Kf(nk, [[0, 0], [0.3, 1], [1, 0]], ppFx12Aus);
    if (a > 0.04) ppFx7Glow(g, cx, cy, 30 * sc / S, 30 * sc / S, te.nachglut, a * 0.5, 1);
  }
  for (const e of te.funken) {
    const u = (t - e.verzug) / e.dauer;
    if (u < 0 || u > 1) continue;
    const f = ppFx12Aus(u), a = ppFx7Kf(u, [[0, 0], [0.25, 1], [1, 0]], ppFx12Aus), sc = ppFx7Kf(u, [[0, 0.4], [1, 0.2]], ppFx12Aus);
    ppFx12Glut(g, cx + e.dx * f / S, cy + e.dy * f / S, Math.max(3, e.size * (1.1 - sc)), e.farbe, null, a);
  }
}, 1000, { breite: 270, hoehe: 210 }, {
  z: 10100,
  vorbereiten: () => ({
    rampe: ppFx12Farben(['#ff491a', '#ff9a1a', '#f9ecb3', '#fffbd2', '#cc2b00']), glut: ppFx12Farben(['#f87420', '#ff491a', '#cf5f00']), nachglut: ppFx12Farben(['#cf5f00', '#f9ac20', '#fbc86a']),
    streiche: [{ rot: -38 * Math.PI / 180, verzug: 0, laenge: 118, dicke: 13 }, { rot: 26 * Math.PI / 180, verzug: 130, laenge: 96, dicke: 9 }],
    funken: Array.from({ length: ppFxN(18) }, () => {
      const [verzug, dauer] = ppFx12Fit(60 + Math.random() * 220, 380 + Math.random() * 300);
      return { dx: ppFx12R(-40, 40), dy: -ppFx12R(10, 56), size: ppFx12R(3, 8), farbe: ppHex(ppFx12Pick(['#fad54a', '#ff8b1a', '#ff491a'])), verzug, dauer };
    }),
  }),
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Defending the Gate (`gate_shield`) — ein Schild (Wappenschild, je Bild neu gerastert: Höhe 44 px × Maßstab .3 → 1,4 → 1 → .8, steigt/sinkt -5 … 10 px, 900 ms) und acht blaue Punkte im Kreis
//  (Radius 30 px, je 50 ms versetzt, 700 ms: poppen .5 → 1,3 → .3). Dither-Schein in Blau hinter dem Schild.
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX12_SCHILD = ppFx12Farben(['#223962', '#bddcef', '#66b6ff', '#4e82cb', '#e5edfa']);
/** Wappenschild der Höhe `hoch` (Rasterpixel), Mitte (cx, cy): Rand, heller Innenrand, links hell / rechts dunkel, weißes Kreuz. */
function ppFx12Schild(g, cx, cy, hoch, a) {
  cx = Math.round(cx); cy = Math.round(cy);
  if (hoch < 3) { g.block(cx - 1, cy - 1, 2, 2, PP_FX12_SCHILD[2], a); return; }
  const W = hoch * 0.84, R = Math.ceil(hoch / 2) + 1;
  const innen = (i, j) => {
    const v = j / hoch;
    if (v < -0.5 || v > 0.5) return false;
    const f = v < 0.12 ? 1 : 1 - Math.pow((v - 0.12) / 0.38, 1.7);
    return Math.abs(i) <= (W / 2) * f;
  };
  const [rand, rim, hellBlau, dunkelBlau, kreuz] = PP_FX12_SCHILD;
  for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) {
    if (!innen(i, j)) continue;
    let c;
    if (!(innen(i - 1, j) && innen(i + 1, j) && innen(i, j - 1) && innen(i, j + 1))) c = rand;
    else if (hoch >= 9 && !(innen(i - 2, j) && innen(i + 2, j) && innen(i, j - 2) && innen(i, j + 2))) c = rim;
    else if (hoch >= 9 && ((i === 0 && j > -hoch * 0.34 && j < hoch * 0.3) || (j === Math.round(-hoch * 0.1) && Math.abs(i) < W * 0.26))) c = kreuz;
    else c = i < 0 ? hellBlau : dunkelBlau;
    g.put(cx + i, cy + j, c, a);
  }
}
const ppFx12Gate = ppR1Leinwand((g, t, sz, te) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy;
  const sk = t / 900;
  if (sk <= 1) {
    const sc = ppFx7Kf(sk, [[0, 0.3], [0.3, 1.4], [0.6, 1], [1, 0.8]], ppFx12Aus), ty = ppFx7Kf(sk, [[0, 10], [0.3, -5], [0.6, 0], [1, -15]], ppFx12Aus);
    const a = ppFx7Kf(sk, [[0, 0], [0.3, 1], [0.6, 0.9], [1, 0]], ppFx12Aus);
    if (a > 0.03) {
      const hoch = Math.round(44 * sc / S), y = cy + (-7 + ty) / S;
      if (hoch >= 6) ppFx7Glow(g, cx, y, hoch * 0.5 + 3, hoch * 0.55 + 3, te.schein, a * 0.3, 1);
      ppFx12Schild(g, cx, y, hoch, a);
    }
  }
  for (const d of te.punkte) {
    const u = (t - d.verzug) / d.dauer;
    if (u < 0 || u > 1) continue;
    const sc = ppFx7Kf(u, [[0, 0.5], [0.4, 1.3], [1, 0.3]], ppFx12Aus), a = ppFx7Kf(u, [[0, 0], [0.4, 1], [1, 0]], ppFx12Aus), n = Math.max(1, Math.round(2 * sc)), x = cx + d.x / S, y = cy + d.y / S;
    if (n >= 2) { g.block(x - n / 2 - 1, y - n / 2, 1, n, te.punktRand, a * 0.7); g.block(x + n / 2, y - n / 2, 1, n, te.punktRand, a * 0.7); g.block(x - n / 2, y - n / 2 - 1, n, 1, te.punktRand, a * 0.7); g.block(x - n / 2, y + n / 2, n, 1, te.punktRand, a * 0.7); }
    g.block(x - n / 2, y - n / 2, n, n, te.punkt, a);
  }
}, 1000, { breite: 180, hoehe: 180 }, {
  z: 9999,
  vorbereiten: () => ({
    schein: ppFx12Farben(['#4e82cb', '#66b6ff']), punkt: ppHex('#68c6fd'), punktRand: ppHex('#4e82cb'),
    punkte: Array.from({ length: ppFxN(8) }, (_, i) => {
      const w = (i / 8) * Math.PI * 2, [verzug, dauer] = ppFx12Fit(i * 50, 700);
      return { x: Math.cos(w) * 30, y: Math.sin(w) * 30, verzug, dauer };
    }),
  }),
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Gigantisaur Stomp (`giant_dino_stomp`) — das riesige Dinobein (120 × 250 px, grüne Schuppen, fünf Krallen) fällt aus 820 px Höhe auf die Zone (Kurve .18/0/.72/.45), schlägt bei 500 ms auf
//  (Stauchen/Strecken in ganzen Rasterzeilen), steht kurz und zieht sich bei ~870–980 ms zurück (die DOM-Fassung wurde nach 1000 ms abgeschnitten). Beim Aufschlag: brauner Staubring (bis 2,6fach, ellipsenförmig),
//  heller Blitz, 22 Staubbrocken. Das Ziel wird wie vorher flachgedrückt (`giant-dino-stomp-squashed`, Zone aus `zoneEl`/nächste Zone).
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX12_BEIN_TOENE = ppFx12Farben(['#0f2412', '#18300a', '#2f4e1d', '#3a5a25', '#5b9438', '#80bf59']);
let PP_FX12_BEIN_CACHE = null;
/** Das Bein einmal als Farbfeld (Palettenindex je Rasterpixel, -1 leer) vorberechnen: 40 × 83 Körper + 6 Zeilen Krallen. */
function ppFx12BeinBild() {
  if (PP_FX12_BEIN_CACHE) return PP_FX12_BEIN_CACHE;
  const W = 40, HB = 83, HG = HB + 6, zellen = new Int8Array(W * HG).fill(-1), RO = 7, RU = 5, RAND = -2;
  const band = (v) => (v < 0.12 ? 3 - v / 0.12 : v < 0.28 ? 2 + (v - 0.12) / 0.16 : v < 0.48 ? 3 - (v - 0.28) / 0.2 : v < 0.68 ? 2 - (v - 0.48) / 0.2 : 1);
  const innen = (i, j) => {
    if (i < 0 || j < 0 || i >= W || j >= HB) return false;
    if (j < RO) { const cx0 = Math.min(Math.max(i, RO - 1), W - RO); return (i - cx0) * (i - cx0) + (j - (RO - 1)) * (j - (RO - 1)) <= RO * RO; }
    if (j > HB - 1 - RU) { const cx0 = Math.min(Math.max(i, RU - 1), W - RU); return (i - cx0) * (i - cx0) + (j - (HB - RU)) * (j - (HB - RU)) <= RU * RU; }
    return true;
  };
  for (let j = 0; j < HB; j++) for (let i = 0; i < W; i++) {
    if (!innen(i, j)) continue;
    const kante = !(innen(i - 1, j) && innen(i + 1, j) && innen(i, j - 1) && innen(i, j + 1));
    if (kante) { zellen[j * W + i] = RAND; continue; }
    let k = band(j / HB) + (ppBayer(i, j) - 0.5) * 0.9;
    const seite = Math.min(i, W - 1 - i);
    if (seite < 6 && ppBayer(i + 2, j + 1) < (1 - seite / 6) * 0.8) k -= 1.2;                           // dunkle Flanken (inset)
    if (j <= 3) k += 0.7;                                                                                 // heller oberer Rand
    if ((i + j) % 5 === 0) k += 0.6;                                                                      // Schuppenmuster (diagonal hell/dunkel)
    if (((i - j) % 6 + 6) % 6 === 0) k -= 0.5;
    const hx = (i - 10.5) / 3.9, hy = (j - HB * 0.48) / (HB * 0.4);
    if (hx * hx + hy * hy < 1) k += 0.9 * (1 - hx * hx - hy * hy) + 0.5;                                 // Glanzstreifen links
    zellen[j * W + i] = Math.max(0, Math.min(5, Math.round(k)));
  }
  // Krallen: fünf Dreiecke (6 Zeilen unter dem Körper, 3 Zeilen davor)
  for (let k = 0; k < 5; k++) {
    const mx = 4 + k * 8;
    for (let j = HB - 3; j < HG; j++) {
      const h = 1 - (j - (HB - 3)) / 9, hw = Math.max(0, Math.round(2.5 * h));
      for (let i = -hw; i <= hw; i++) { const X = mx + i; if (X >= 0 && X < W) zellen[j * W + X] = (i === -hw || i === hw || j === HG - 1) ? RAND : 1; }
    }
  }
  PP_FX12_BEIN_CACHE = { W, HG, HB, zellen };
  return PP_FX12_BEIN_CACHE;
}
const PP_FX12_BEIN_RAND = ppHex('#0a1a04');
/** Das Bein mit unterer Mitte (cx, y) zeichnen; (sx, sy) streckt/staucht in ganzen Rasterzeilen/-spalten (nur beim Aufschlag nötig). */
function ppFx12Bein(g, cx, y, sx, sy, a) {
  const b = ppFx12BeinBild(), Wd = Math.max(1, Math.round(b.W * sx)), Hd = Math.max(1, Math.round(b.HG * sy)), x0 = Math.round(cx - Wd / 2), y0 = Math.round(y) - Hd;
  const T = PP_FX12_BEIN_TOENE;
  for (let jd = 0; jd < Hd; jd++) {
    const js = sy === 1 ? jd : Math.min(b.HG - 1, Math.floor(jd / sy));
    for (let id = 0; id < Wd; id++) {
      const is = sx === 1 ? id : Math.min(b.W - 1, Math.floor(id / sx)), z = b.zellen[js * b.W + is];
      if (z === -1) continue;
      g.put(x0 + id, y0 + jd, z === -2 ? PP_FX12_BEIN_RAND : T[z], a);
    }
  }
}
const ppFx12BeinFall = ppFx7Bez(0.18, 0, 0.72, 0.45);
const ppFx12Dino = ppR1Leinwand((g, t, sz, te) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, TREFF = 500;
  // Das Bein
  {
    let ty, sx = 1, sy = 1, a = 1;
    if (t < TREFF) { ty = -820 * (1 - ppFx12BeinFall(t / TREFF)); a = Math.min(1, t / 54); }
    else if (t < 554) { const k = ppFx12BeinFall((t - TREFF) / 54); ty = 6 * k; sy = 1 - 0.28 * k; sx = 1 + 0.18 * k; }
    else if (t < 654) { const k = ppFx12BeinFall((t - 554) / 100); ty = 6 * (1 - k); sy = 0.72 + 0.28 * k; sx = 1.18 - 0.18 * k; }
    else if (t < 760) { const k = ppFx12BeinFall((t - 654) / 106); ty = -4 * k; sy = 1 + 0.02 * k; sx = 1 - 0.01 * k; }
    else if (t < 870) { const k = ppFx12BeinFall((t - 760) / 110); ty = -4 * (1 - k); sy = 1.02 - 0.02 * k; sx = 0.99 + 0.01 * k; }
    else { const k = (t - 870) / 110; ty = -1100 * k * k; }
    if (t < 990 && ty > -1100) {
      ppFx12Bein(g, cx, cy + (-te.zielH / 2 + 18 + ty) / S, Math.abs(sx - 1) < 0.03 ? 1 : sx, Math.abs(sy - 1) < 0.03 ? 1 : sy, a);
    }
  }
  const ik = t - TREFF;
  // Staubring (480 ms ab Aufschlag): bis 2,6 × 220 px breit, 1,6 × 90 px hoch
  if (ik >= 0 && ik <= 480) {
    const u = ik / 480, sx = ppFx7Kf(u, [[0, 0.25], [0.35, 1.6], [1, 2.6]], ppFx12Aus), sy = ppFx7Kf(u, [[0, 0.35], [0.35, 1.1], [1, 1.6]], ppFx12Aus), a = ppFx7Kf(u, [[0, 1], [0.35, 0.9], [1, 0]], ppFx12Aus);
    if (a > 0.08) ppFx7Glow(g, cx, cy, 110 * sx / S, 45 * sy / S, te.ring, a * a * 0.9, 1);
  }
  // Heller Blitz (480 ms)
  if (ik >= 0 && ik <= 480) {
    const u = ik / 480, sx = ppFx7Kf(u, [[0, 0.3], [0.35, 1.5], [1, 2.2]], ppFx12Aus), sy = ppFx7Kf(u, [[0, 0.4], [0.35, 1], [1, 1.4]], ppFx12Aus), a = ppFx7Kf(u, [[0, 1], [0.35, 0.9], [1, 0]], ppFx12Aus);
    if (a > 0.1) ppFx7Glow(g, cx, cy, 90 * sx / S, 35 * sy / S, te.blitz, a * a * 0.6, 1);
  }
  // Staubbrocken (animExpParticle: Bahn ease-out, Größe 1,2 → 0, Deckung 1 bis 20 %, dann aus)
  for (const d of te.staub) {
    const u = (t - d.verzug) / d.dauer;
    if (u < 0 || u > 1) continue;
    const e = ppFx12Aus(u), a = u < 0.2 ? 1 : 1 - ppFx12Aus((u - 0.2) / 0.8), px = d.size * 1.2 * (1 - e);
    if (a > 0.03 && px > 0.8) ppFx12Punkt(g, cx + d.dx * e / S, cy + d.dy * e / S, px, d.farbe, a);
  }
}, 1000, (p) => {
  const zielH = p.h || 90, v = ppR1FeldVersatz(p), oben = Math.min(1140, Math.max(380, Math.round(p.y - v.dy) + 40)), unten = zielH / 2 + 80;   // bis über den oberen Fensterrand (Welt-Versatz eingerechnet)
  return { breite: 640, hoehe: oben + unten, ankerY: oben };
}, {
  z: 10100,
  vorbereiten: (sz) => (ppFx12BeinBild(), {
    zielH: sz.props.h || 90, ring: ppFx12Farben(['#5a341a', '#886c44', '#b29466']), blitz: ppFx12Farben(['#fbe181', '#fffbd2']),
    staub: Array.from({ length: ppFxN(22) }, () => {
      const w = -Math.PI * 0.12 + Math.random() * Math.PI * 1.24, v = ppFx12R(28, 103), [verzug, dauer] = ppFx12Fit(500 + Math.random() * 40, 380 + Math.random() * 320);
      return { dx: Math.cos(w) * v, dy: -Math.abs(Math.sin(w) * v) - 6, size: ppFx12R(4, 12), farbe: ppHex(ppFx12Pick(['#6b4a2a', '#5a3c14', '#886c44', '#3a2412', '#886c44', '#3a2412'])), verzug, dauer };
    }),
  }),
  wirkung: (p) => {
    // Squash am echten Ziel-Element (wie die DOM-Fassung): Lage der Zonen JETZT merken, nach 480 ms die nächste Zone (oder `zoneEl`) quetschen
    if (window._playAnimations === false) return undefined;
    const x = p.x, y = p.y, zoneEl = p.zoneEl, frost = ppZonenFrost();
    const timer = setTimeout(() => {
      let best = null, bestDist = Infinity;
      document.querySelectorAll('[data-hero-zone],[data-support-zone]').forEach((el) => {
        const r = frost.get(el) || el.getBoundingClientRect(), d = Math.abs(r.left + r.width / 2 - x) + Math.abs(r.top + r.height / 2 - y);
        if (d < bestDist) { bestDist = d; best = el; }
      });
      if (zoneEl && zoneEl.isConnected) { best = zoneEl; bestDist = 0; }
      if (best && bestDist < 100) {
        best.classList.add('giant-dino-stomp-squashed');
        setTimeout(() => best.classList.remove('giant-dino-stomp-squashed'), 850);
      }
    }, 480);
    return () => clearTimeout(timer);
  },
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Logan / Cheeky Monkee (`golden_banana_rain`; `count` Bananen, Standard 14, 3–24) — ein goldener Blitz (500 ms) und ein Regen goldener Bananen: jede fällt 132 px (520–840 ms, Verzug 0–420 ms,
//  Kurve .45/.05/.55/.95), driftet seitlich (±35 px) und dreht sich (±220°); die Banane ist eine gebogene Pixelform, die je Bild gedreht GERASTERT wird (kein gedrehtes Bild).
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const ppFx12BananeFall = ppFx7Bez(0.45, 0.05, 0.55, 0.95);
const PP_FX12_BANANE = ppFx12Farben(['#c68206', '#fad54a', '#fff196', '#7d3911']);
/** Banane der Länge `L` (Rasterpixel), Mitte (cx, cy), Drehwinkel `w` (Bogenmaß): Bogen mit Rand, Körper, Glanz und braunem Stielende. */
function ppFx12Banane(g, cx, cy, L, w, a) {
  const [rand, koerper, glanz, stiel] = PP_FX12_BANANE, cs = Math.cos(w), sn = Math.sin(w), n = Math.max(6, Math.round(L * 1.6));
  const pt = (s) => { const x = s * L / 2, y = -(1 - s * s) * L * 0.26 + L * 0.13; return [cx + x * cs - y * sn, cy + x * sn + y * cs]; };
  const dick = (s) => 0.55 + (L >= 6 ? 1.15 : 0.7) * (1 - Math.pow(Math.abs(s), 2.2));
  for (let k = 0; k <= n; k++) { const s = (k / n) * 2 - 1, [x, y] = pt(s); g.disc(x, y, dick(s) + 0.7, rand, a); }
  for (let k = 0; k <= n; k++) { const s = (k / n) * 2 - 1, [x, y] = pt(s); g.disc(x, y, dick(s), koerper, a); }
  if (L >= 6) for (let k = Math.round(n * 0.2); k <= Math.round(n * 0.7); k++) { const s = (k / n) * 2 - 1, [x, y] = pt(s); g.put(x - 0.5, y - 0.7, glanz, a); }
  const [sx, sy] = pt(-1);
  g.put(sx, sy, stiel, a);
}
const ppFx12Bananen = ppR1Leinwand((g, t, sz, te) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy;
  const fk = t / 500;
  if (fk <= 1) {
    const sc = ppFx7Kf(fk, [[0, 0.3], [0.5, 1.3], [1, 1.6]], ppFx12Aus), a = ppFx7Kf(fk, [[0, 1], [0.5, 0.6], [1, 0]], ppFx12Aus);
    if (a > 0.03) ppFx7Glow(g, cx, cy, 20 * sc / S, 20 * sc / S, te.blitz, a * 0.85, 0.8);
  }
  for (const b of te.bananen) {
    const u = (t - b.verzug) / b.dauer;
    if (u < 0 || u > 1) continue;
    const e = ppFx12BananeFall(u), a = u < 0.12 ? u / 0.12 : u < 0.8 ? 1 : 1 - (u - 0.8) / 0.2;
    if (a < 0.03) continue;
    ppFx12Banane(g, cx + (b.xOff + b.size / 2 + b.tilt * e) / S, cy + (-70 + b.size * 0.6 + 132 * e) / S, b.size * 1.05 / S, b.spin * e * Math.PI / 180, a);
  }
}, 1000, { breite: 240, hoehe: 250, ankerY: 110 }, {
  z: 10100,
  vorbereiten: (sz) => {
    const anzahl = Math.max(3, Math.min(24, sz.props.count || 14));
    return {
      blitz: ppFx12Farben(['#f29a3e', '#fad54a', '#f7f7ad']),
      bananen: Array.from({ length: anzahl }, () => {
        const [verzug, dauer] = ppFx12Fit(Math.random() * 420, 520 + Math.random() * 320);
        return { xOff: ppFx12R(-46, 46), size: ppFx12R(16, 28), spin: ppFx12R(-220, 220), tilt: ppFx12R(-35, 35), verzug, dauer };
      }),
    };
  },
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Grave Worm (`grave_worm_burrow`) — ein dunkler Erdhügel (68 × 18 px unter der Mitte, 700 ms: .4 → 1,1 → 1) und 22 Erdbrocken (3–9 px, schwarz/braun) stieben nach oben-außen (500–850 ms, ab 0–120 ms,
//  Größe 1,2 → 0), dazu 8 langsame, gedithert schwarze Rauchwolken (14–32 px), die 50–120 px aufsteigen (700–1100 ms, ab 100–350 ms) und anwachsen.
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const ppFx12Wurm = ppR1Leinwand((g, t, sz, te) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy;
  const hk = t / 700;
  if (hk <= 1) {
    const sc = ppFx7Kf(hk, [[0, 0.4], [0.3, 1.1], [1, 1]], ppFx12Aus), a = ppFx7Kf(hk, [[0, 0], [0.3, 1], [1, 0.4]], ppFx12Aus);
    if (a > 0.03) ppFx7Glow(g, cx, cy + 15 / S, 34 * sc / S, 9 * sc / S, te.huegel, a * 0.9, 0.8);
  }
  for (const c of te.brocken) {
    const u = (t - c.verzug) / c.dauer;
    if (u < 0 || u > 1) continue;
    const e = ppFx12Aus(u), a = u < 0.2 ? 1 : 1 - ppFx12Aus((u - 0.2) / 0.8), px = c.size * 1.2 * (1 - e);
    if (a > 0.03 && px > 0.8) ppFx12Punkt(g, cx + c.dx * e / S, cy + c.dy * e / S, px, c.farbe, a);
  }
  for (const w of te.rauch) {
    const u = (t - w.verzug) / w.dauer;
    if (u < 0 || u > 1) continue;
    const e = ppFx12Aus(u), sc = 0.4 + 1.0 * e, a = ppFx7Kf(u, [[0, 0], [0.3, 1], [1, 0]], ppFx12Aus) * w.deckung;
    if (a > 0.03) ppFx7Glow(g, cx + (w.startX + w.size / 2) / S, cy + (w.size / 2 - w.rise * e) / S, w.size * sc / 2 / S, w.size * sc / 2 / S, te.rauchFarbe, a * 1.6, 0.9);
  }
}, 1000, { breite: 240, hoehe: 300, ankerY: 200 }, {
  z: 10100,
  vorbereiten: () => ({
    huegel: ppFx12Farben(['#27180c', '#141414']), rauchFarbe: ppFx12Farben(['#27180c', '#141414']),
    brocken: Array.from({ length: ppFxN(22) }, () => {
      const w = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.9, v = ppFx12R(35, 105), [verzug, dauer] = ppFx12Fit(Math.random() * 120, 500 + Math.random() * 350);
      return { dx: Math.cos(w) * v, dy: Math.sin(w) * v - ppFx12R(10, 35), size: ppFx12R(3, 9), farbe: ppHex(ppFx12Pick(['#141414', '#27180c', '#3a2412', '#141414', '#4a2a10'])), verzug, dauer };
    }),
    rauch: Array.from({ length: ppFxN(8) }, () => {
      const [verzug, dauer] = ppFx12Fit(100 + Math.random() * 250, 700 + Math.random() * 400);
      return { startX: ppFx12R(-28, 28), rise: ppFx12R(50, 120), size: ppFx12R(14, 32), deckung: ppFx12R(0.25, 0.6), verzug, dauer };
    }),
  }),
});

ppFxUeberschreiben('empowered_strike_apply', ppFx12Emp);
ppFxUeberschreiben('equip_flash', ppFx12Equip);
ppFxUeberschreiben('falling_boulder', ppFx12Boulder);
ppFxUeberschreiben('fan_blow', ppFx12Faecher);
ppFxUeberschreiben('field_standard_rally', ppFx12Rally);
ppFxUeberschreiben('firewall', ppFx12Firewall);
ppFxUeberschreiben('flame_pillars', ppFx12Pillars);
ppFxUeberschreiben('flaming_slash', ppFx12Slash);
ppFxUeberschreiben('gate_shield', ppFx12Gate);
ppFxUeberschreiben('giant_dino_stomp', ppFx12Dino);
ppFxUeberschreiben('golden_banana_rain', ppFx12Bananen);
ppFxUeberschreiben('grave_worm_burrow', ppFx12Wurm);
