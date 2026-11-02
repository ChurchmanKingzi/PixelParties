// Pixelart-Portierungen (Canvas), Batch 21 (dritte Welle, alle übrigen Effekte): siehe app-fx-0.jsx. Jede Portierung: `ppFxUeberschreiben('typ', Komponente)`.
//
//  Typen: gunshot_barrage (Gangster Angel / Vena, Mündungsblitze + Leuchtspuren + Einschlagfunken), heart_expand (Lovely Teddy, wachsendes Herz).
//  Beide laufen innerhalb der Standard-Lebensdauer der Zonen-Animation (1000 ms, `ZONEN_ANIM_DAUER[type] || 1000`) aus.
//
//  NICHT portiert (schon Pixel-Leinwand bzw. an DOM-Kartenbilder gebunden), unverändert in `ANIM_REGISTRY` (app-board.jsx):
//    hockey_wish, hero_creature_on, hero_creature_off, hand_level_down, leafagami_leaves, hot_potato_blast, lament_rain, hydra_regrow, hydra_drain  → `ppPunktBild` (eine Canvas)
//    lament_tears  → `ppProjektil` (= `ppSalve`, eine Canvas);  kidnap_sack, intel_peek, inheritance_flow  → `ppSalve` (eine Canvas)
//    hot_potato_throw  → die KARTE selbst (DOM-Kartenbild) hüpft in die neue Zone, samt Zonen-Wechsel der Engine
//    hole_in_the_sky_pull  → Loch auf Leinwand, aber die eingesogenen Karten sind <div>s mit echtem Kartenbild (Teil der Animation, `data-pp-im-sog` an den Zonen)

// ── gemeinsame Bausteine ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const PP_FX21_GOLD = { weiss: '#ffffff', kern: '#fffbd2', creme: '#f9ecb3', hell: '#fbe181', warm: '#ffd066', amber: '#f9ac20', orange: '#ff8b1a' };
const PP_FX21_G = (() => { const r = {}; for (const k in PP_FX21_GOLD) r[k] = ppHex(PP_FX21_GOLD[k]); return r; })();

// ═════════════════════════════════════════════════════════════════
//  Schusssalve (`gunshot_barrage`, Gangster Angel / Vena) — auf dem Ziel (Held oder Ausrüstung, Mitte (x, y), Maß b = max(w, 60)):
//   drei Mündungsblitze am linken Rand (je 200 ms, im Abstand von 90 ms; gedithertes Oval, wächst/schrumpft in ganzen Pixeln),
//   sechs Leuchtspuren (je 260 ms, im Abstand von 55 ms) ziehen als Pixelzeile (Schweif → gold → weißer Kopf, gedithert) quer durchs Ziel,
//   sieben Einschlagfunken (ab 150 ms, im Abstand von 30 ms, je 360 ms) fliegen strahlenförmig aus der Mitte. Ende ~700 ms.
// ═════════════════════════════════════════════════════════════════
const ppFx21Basis = (p) => Math.max(p.w || 72, 60);
const PP_FX21_SPUREN = [0, 1, 2, 3, 4, 5].map((i) => ({ yOff: -0.34 + i * 0.14, delay: i * 55, laenge: 0.9 + (i % 3) * 0.22, dicke: i % 2 === 0 ? 3 : 2 }));
const PP_FX21_BLITZE = [0, 1, 2].map((i) => ({ yOff: -0.2 + i * 0.2, delay: i * 90 }));
const PP_FX21_FUNKEN = [0, 1, 2, 3, 4, 5, 6].map((i) => ({ winkel: (i / 7) * Math.PI * 2, delay: 150 + i * 30, gr: 3 + (i % 3) }));
const ppFx21Schuss = ppR1Leinwand((g, t, sz) => {
  const S = sz.S, b = ppFx21Basis(sz.props), cx = sz.cx, cy = sz.cy, F = PP_FX21_G;
  // Mündungsblitze
  PP_FX21_BLITZE.forEach((m) => {
    const k = (t - m.delay) / 200;
    if (k < 0 || k > 1) return;
    const [sx, sy, op] = ppKf(k, [[0, [0.3, 0.6, 0]], [0.35, [1.15, 1, 1]], [1, [0.7, 0.8, 0]]]);
    const rx = Math.max(1.5, (b * 0.15 * sx) / S), ry = Math.max(1, (b * 0.08 * sy) / S);
    g.glow(cx + (-0.8 * b) / S, cy + ((m.yOff + 0.08) * b) / S, rx, ry, [F.orange, F.amber, F.kern], op, 0.9);
  });
  // Leuchtspuren: Pixelzeile mit Schweif (gedithert) → Gold → weißer Kopf; Länge wächst .4 → 1, Weg linear
  PP_FX21_SPUREN.forEach((s) => {
    const k = (t - s.delay) / 260;
    if (k < 0 || k > 1) return;
    const op = ppKf(k, [[0, [0]], [0.15, [1]], [0.7, [1]], [1, [0]]], true)[0];
    const L = (s.laenge * b * (0.4 + 0.6 * k)) / S, n = Math.max(3, Math.round(L));
    const mitte = cx + (-0.8 * b + (s.laenge * b) / 2 + 1.5 * b * k) / S, y = Math.round(cy + (s.yOff * b) / S);
    const x0 = Math.round(mitte - n / 2);
    for (let j = 0; j < n; j++) {
      const u = n > 1 ? j / (n - 1) : 1;
      let c, a;
      if (u < 0.35) { c = F.hell; a = 0.35 + 0.65 * (u / 0.35); }
      else if (u < 0.75) { c = u < 0.55 ? F.hell : F.creme; a = 1; }
      else { c = F.weiss; a = 1 - ((u - 0.75) / 0.25) * 0.55; }
      g.put(x0 + j, y, c, a * op);
      if (u > 0.2 && u < 0.9) {                                   // Glut-Rand: Dither-Zeilen darüber/darunter statt Schein
        g.put(x0 + j, y - 1, F.warm, op * (s.dicke === 3 ? 0.5 : 0.3));
        g.put(x0 + j, y + 1, F.warm, op * (s.dicke === 3 ? 0.5 : 0.3));
      }
    }
    g.block(x0 + n - 2, y, 2, 1, F.weiss, op);                    // heller Kopf
  });
  // Einschlagfunken
  PP_FX21_FUNKEN.forEach((f) => {
    const k = (t - f.delay) / 360;
    if (k < 0 || k > 1) return;
    const [pos, sc, op] = ppKf(k, [[0, [0, 0.4, 0]], [0.25, [0.4, 1.1, 1]], [1, [1, 0.5, 0]]]);
    const d = 0.42 * b * pos, n = Math.max(1, Math.round((f.gr * sc) / S));
    const X = Math.round(cx + (Math.cos(f.winkel) * d) / S), Y = Math.round(cy + (Math.sin(f.winkel) * d) / S);
    if (n >= 2) {
      g.block(X - 1, Y, 1, n, F.amber, op * 0.55); g.block(X + n, Y, 1, n, F.amber, op * 0.55);
      g.block(X, Y - 1, n, 1, F.amber, op * 0.55); g.block(X, Y + n, n, 1, F.amber, op * 0.55);
    }
    g.block(X, Y, n, n, F.kern, op);
  });
}, 720, (p) => { const b = ppFx21Basis(p); return { breite: Math.ceil(b * 2.7), hoehe: Math.ceil(b * 1.3), ankerX: Math.ceil(b * 1.15), ankerY: Math.ceil(b * 1.3) / 2 }; }, { z: 10120 });

// ═════════════════════════════════════════════════════════════════
//  Herz (`heart_expand`, Lovely Teddy) — ein 9×8-Pixelherz auf dem Ziel, das sich ausdehnt und durchsichtig wird (1000 ms): Größe .35 → .6 (12 %) → 2,6, Deckung 0 → 1 → 0.
//  Die Vergrößerung geschieht in GANZEN Pixelstufen (jede Herzzelle ist m×m Rasterpixel, m = 1 … 7), die Durchsichtigkeit als Bayer-Dither; statt des rosa Scheins ein
//  gedithertes Doppelband um das Herz und ein dunkler Pixelrand.
// ═════════════════════════════════════════════════════════════════
const PP_FX21_HERZ = ['.XX...XX.', 'XXXX.XXXX', 'XXXXXXXXX', 'XXXXXXXXX', '.XXXXXXX.', '..XXXXX..', '...XXX...', '....X....'];
const PP_FX21_HERZ_F = { rot: ppHex('#ec2d62'), licht: ppHex('#f3bad3'), rand: ppHex('#b5171c'), schein: ppHex('#fc69c6') };
/** Herz-Raster für Zellgröße m (einmal je m berechnet): Feld 0 = außen, 1 = Rand, 2 = Fläche, 3 = Licht; Schein 1..R = Abstand außen. */
const _ppFx21HerzRaster = new Map();
function ppFx21HerzRaster(m) {
  let r = _ppFx21HerzRaster.get(m);
  if (r) return r;
  const W = 9, H = 8, rs = Math.max(1, Math.round(m * 0.3)), R = rs * 2 + 1, P = R + 1;
  const bw = W * m + 2 * P, bh = H * m + 2 * P, n = bw * bh, innen = new Uint8Array(n);
  for (let y = 0; y < H * m; y++) for (let x = 0; x < W * m; x++) if (PP_FX21_HERZ[Math.floor(y / m)][Math.floor(x / m)] === 'X') innen[(y + P) * bw + x + P] = 1;
  // Chebyshev-Abstand per Zwei-Durchgang-Verfahren: dI = Abstand eines Innenpixels zum nächsten Außenpixel, dA = Abstand eines Außenpixels zum nächsten Innenpixel
  const dist = (quelle) => {
    const d = new Uint8Array(n);
    for (let i = 0; i < n; i++) d[i] = innen[i] === quelle ? 0 : 250;
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {          // Vorwärtsdurchgang
      const i = y * bw + x; let v = d[i];
      if (y > 0) { const o = i - bw; if (x > 0 && d[o - 1] + 1 < v) v = d[o - 1] + 1; if (d[o] + 1 < v) v = d[o] + 1; if (x < bw - 1 && d[o + 1] + 1 < v) v = d[o + 1] + 1; }
      if (x > 0 && d[i - 1] + 1 < v) v = d[i - 1] + 1;
      d[i] = v;
    }
    for (let y = bh - 1; y >= 0; y--) for (let x = bw - 1; x >= 0; x--) {   // Rückwärtsdurchgang
      const i = y * bw + x; let v = d[i];
      if (y < bh - 1) { const o = i + bw; if (x > 0 && d[o - 1] + 1 < v) v = d[o - 1] + 1; if (d[o] + 1 < v) v = d[o] + 1; if (x < bw - 1 && d[o + 1] + 1 < v) v = d[o + 1] + 1; }
      if (x < bw - 1 && d[i + 1] + 1 < v) v = d[i + 1] + 1;
      d[i] = v;
    }
    return d;
  };
  const dA = dist(1), dI = dist(0);                  // dA: Abstand zum Herzen (0 innen) · dI: Abstand zum Außenraum (0 außen)
  r = { bw, bh, P, rs, R, innen, dA, dI };
  _ppFx21HerzRaster.set(m, r);
  return r;
}
const ppFx21Herz = ppR1Leinwand((g, t, sz) => {
  const k = t / 1000;
  if (k < 0 || k > 1) return;
  const [sc, op] = ppKf(k, [[0, [0.35, 0]], [0.12, [0.6, 1]], [1, [2.6, 0]]]);
  if (op <= 0.02) return;
  const F = PP_FX21_HERZ_F, W = 9, H = 8;
  const m = Math.max(1, Math.round((sc * 8) / sz.S));                        // Kantenlänge einer Herzzelle in Rasterpixeln (8 px je Zelle bei Maßstab 1)
  const r = ppFx21HerzRaster(m);
  const ox = Math.round(sz.cx - (W * m) / 2) - r.P, oy = Math.round(sz.cy - (H * m) / 2) - r.P;
  for (let y = 0; y < r.bh; y++) for (let x = 0; x < r.bw; x++) {
    const i = y * r.bw + x;
    if (r.innen[i]) {
      const zx = Math.floor((x - r.P) / m), zy = Math.floor((y - r.P) / m);
      g.put(ox + x, oy + y, r.dI[i] <= r.rs ? F.rand : (zx <= 1 && zy <= 1 ? F.licht : F.rot), op);
    } else if (r.dA[i] <= r.R) {
      g.put(ox + x, oy + y, F.schein, op * (r.dA[i] <= r.rs ? 0.55 : 0.25));   // gedithertes Doppelband statt Schein
    }
  }
}, 1000, { breite: 240, hoehe: 216 }, { z: 10100 });

ppFxUeberschreiben('gunshot_barrage', ppFx21Schuss);
ppFxUeberschreiben('heart_expand', ppFx21Herz);
