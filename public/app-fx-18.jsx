// Pixelart-Portierungen (Canvas), Batch 18 (dritte Welle, alle übrigen Effekte): siehe app-fx-0.jsx. Jede Portierung: `ppFxUeberschreiben('typ', Komponente)`.
// Effekte: blood_hearts, capture_net, cosmic_counter_remove, cosmic_invader_strike, crescent_reap.
// Schon auf Leinwand (ppSalve / ppPunktBild / ppProjektil in app-board.jsx) und deshalb NICHT hier: bounce_burst, bounce_spring, breakthrough_shatter, buttap_orbs, celia_candles, cell_escape,
// chosen_one_aura, clown_pop, control_monitors, cosmic_explosion, crown_flutter, darion_equip.
// Alle fünf laufen auf EINER Leinwand je Effekt (`ppR1Leinwand`, 1 Rasterpixel = 3 Bildschirmpixel, 30 Bilder/s): keine weichen Schatten, Scheine oder Verläufe — Schein = Dither-Stufen (`ppFx7Glow`),
// Deckung = Bayer-Raster, Herz/Schädel = kleine Pixelbilder statt ♥ / 💀, Klinge und Strahlen = harte Pixelbänder. Bewegung rechnet in Bildschirmpixeln und landet auf ganzen Rasterpixeln.
// Bausteine aus app-fx-7.jsx (nur gelesen): ppFx7Kf (Keyframes), ppFx7Bez (CSS-Kurven), ppFx7Glow (schneller Dither-Schein); app-fx-4.jsx: ppFx4Leinwand (Dauer aus den Eigenschaften).

// ── Bausteine (Präfix ppFx18 / PP_FX18) ─────────────────────────────────────────────────────────────────────────────────
const ppFx18R = (a, b) => a + Math.random() * (b - a);
const ppFx18Hex = (l) => l.map(ppHex);
const PP_FX18_EO = ppFx7Bez(0, 0, 0.58, 1);              // CSS ease-out
const PP_FX18_EI = ppFx7Bez(0.42, 0, 1, 1);              // CSS ease-in
/** Fortschritt u (0..1) eines Teilchens mit Verzug und Dauer; die Dauer wird so gekürzt, dass es spätestens bei `ende` fertig ist (null = nicht sichtbar). */
function ppFx18Lauf(t, verzug, dauer, ende) {
  const d = Math.max(60, Math.min(dauer, ende - verzug));
  const u = (t - verzug) / d;
  return (u < 0 || u > 1) ? null : u;
}
/** Runder Punkt mit Durchmesser `d` Rasterpixeln: 1 Pixel, 2×2 oder Scheibe. */
function ppFx18Korn(g, x, y, d, c, a) {
  if (d < 0.55 || a <= 0.02) return;
  if (d < 1.5) g.put(x, y, c, a);
  else if (d < 2.5) g.block(x - 1, y - 1, 2, 2, c, a);
  else g.disc(x, y, d / 2 - 0.3, c, a);
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Trial of Dominance (`blood_hearts`) — PIXELART. Ein Kranz blutroter Herzen blüht um die dem Untergang geweihte Kreatur: dunkler Blutblitz (Standard-Blitz, 500 ms: .3 → 1,3 → 1,6 mal,
//  Deckung 1 → .6 → 0, hart gedithert) und zwölf Pixel-Herzen (13–25 px, vier Rottöne mit Glanz und Schattenkante), die bei 35 % auf 60 % der Strecke und 1,15 Größe aufgehen, bei 70 % den Kranz
//  (30–46 px) erreichen und dann leicht aufsteigend ausblenden. Aufruf ohne `duration` → 1000 ms; die alten Verzüge/Dauern (bis 1160 ms) sind auf ≤ 960 ms gestaucht.
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX18_HERZ = [
  ['PLP', 'PPP', '.d.'],
  ['PP.PP', 'PLPPP', 'PPPPP', '.PPP.', '..d..'],
  ['.PP.PP.', 'PLLPPPP', 'PLPPPPP', '.PPPPPd', '..dPPd.', '...d...'],
  ['.PPP.PPP.', 'PLLPPPPPP', 'PLPPPPPPP', 'PPPPPPPPd', '.PPPPPPd.', '..PPPPd..', '...ddd...', '....d....'],
];
function ppFx18Herz(g, x, y, px, farbe, a) {
  if (a <= 0.02 || px < 3) return;
  g.spr(PP_FX18_HERZ[px < 10 ? 0 : px < 17 ? 1 : px < 24 ? 2 : 3], farbe, x, y, a);
}
const PP_FX18_BLUT = [
  { P: ppHex('#b5171c'), L: ppHex('#e73b41'), d: ppHex('#780014') },
  { P: ppHex('#8c0014'), L: ppHex('#b5171c'), d: ppHex('#520a0c') },
  { P: ppHex('#c0141c'), L: ppHex('#e73b41'), d: ppHex('#8c0014') },
  { P: ppHex('#780014'), L: ppHex('#b5171c'), d: ppHex('#520a0c') },
  { P: ppHex('#8c0014'), L: ppHex('#b5171c'), d: ppHex('#520a0c') },
];
const PP_FX18_BLUTBLITZ = ppFx18Hex(['#3a0000', '#5b0102', '#8c0014']);   // außen → innen
const ppFx18BloodHearts = ppR1Leinwand((g, t, sz, te) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy;
  const ub = t / 500;
  if (ub >= 0 && ub <= 1) {                                               // `.anim-gold-flash` mit dunklem Blutverlauf
    const [sc, op] = ppKf(ub, [[0, [0.3, 1]], [0.5, [1.3, 0.6]], [1, [1.6, 0]]]);
    const r = 20 * sc / S;
    ppFx7Glow(g, cx, cy, r, r, PP_FX18_BLUTBLITZ, 0.8 * op, 1);
  }
  for (const h of te.herzen) {
    const u = (t - h.verzug) / h.dauer;
    if (u < 0 || u > 1) continue;
    const [op, f, off, sc] = ppKf(u, [[0, [0, 0, 0, 0.2]], [0.35, [1, 0.6, 0, 1.15]], [0.7, [1, 1, 0, 1]], [1, [0, 1.25, -14, 0.7]]]);
    const mx = h.dx * f + h.size / 2, my = h.dy * f + off + h.size / 2;     // Mitte der Glyphe (Skalierung um die Boxmitte)
    ppFx18Herz(g, cx + mx / S, cy + my / S, h.size * sc * 1.1, h.farbe, op);
  }
}, 1000, { breite: 240, hoehe: 240 }, {
  z: 10100,
  vorbereiten: () => ({
    herzen: Array.from({ length: ppFxN(12) }, (_, i) => {
      const w = (i / 12) * Math.PI * 2 + (Math.random() * 0.4 - 0.2), rad = 30 + Math.random() * 16;
      let verzug = Math.random() * 220, dauer = 620 + Math.random() * 320;
      const r = Math.min(1, 960 / (verzug + dauer)); verzug *= r; dauer *= r;   // auf die Lebensdauer (1000 ms) stauchen
      return { dx: Math.cos(w) * rad, dy: Math.sin(w) * rad, size: 13 + Math.random() * 12, verzug, dauer, farbe: PP_FX18_BLUT[Math.floor(Math.random() * PP_FX18_BLUT.length)] };
    }),
  }),
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Capture Net (`capture_net`) — PIXELART. Ein Fangnetz (Seilrand, Rautenmaschen, Abstand ~5 Rasterpixel) stürzt von oben aufs Ziel, schlägt auf (Stauchung) und blendet aus, während die Kreatur eingeholt wird.
//  Der Aufrufer sendet `duration: 1900` (Aufschlag bei 58 %, Stauchung 58–79 %, Ausblenden ab 88 %); Fallkurve und Stauchung folgen den alten Keyframes (Schwerkraft-Ease je Abschnitt).
//  Das Netz ist 1,3 × Zonenbreite (mind. 83 px) groß; Maschen bleiben am Netz haften (nur der Umriss staucht), der weiche Schlagschatten ist ein hartes, gedithertes Pixelband.
//  Die Leinwand reicht vom Fensterrand bis unter das Ziel (das Netz fällt 115 vh herab).
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX18_NETZ = { seil: ppHex('#72541d'), seilHell: ppHex('#a89370'), masche: ppHex('#e0c085'), innen: ppHex('#4a2a10'), schatten: ppHex('#141414') };
const PP_FX18_NETZ_KURVE = ppFx7Bez(0.55, 0.06, 0.78, 0.13);
/** Innerhalb eines Rechtecks (b × h Pixel, Eckenradius r) mit abgerundeten Ecken? (Pixelmitte (x + .5, y + .5)) */
function ppFx18InRR(x, y, b, h, r) {
  if (x < 0 || y < 0 || x >= b || y >= h) return false;
  const px = x + 0.5, py = y + 0.5, qx = Math.min(Math.max(px, r), b - r), qy = Math.min(Math.max(py, r), h - r);
  const dx = px - qx, dy = py - qy;
  return dx * dx + dy * dy <= r * r;
}
const ppFx18CaptureNet = ppFx4Leinwand((g, t, sz) => {
  const S = sz.S, p = sz.props, cx = sz.cx, cy = sz.cy, D = p.duration || 1900;
  const gross = Math.round(Math.max(p.w || 80, 64) * 1.3), N = gross / S;     // Netzgröße in Rasterpixeln
  const u = Math.min(1, t / D), Hf = (window.innerHeight || 720) * 1.15;
  // Verschiebung (px), Höhen-/Breitenfaktor — Abschnitt für Abschnitt mit der Schwerkraft-Kurve
  const [ty, sy, sx] = ppKf(u, [[0, [-Hf, 1.25, 0.9]], [0.58, [0, 1, 1]], [0.68, [0, 0.78, 1.14]], [0.79, [0, 1.06, 0.97]], [0.88, [0, 1, 1]], [1, [0, 1, 1]]], PP_FX18_NETZ_KURVE);
  const op = u < 0.1 ? PP_FX18_NETZ_KURVE(u / 0.1) : u < 0.88 ? 1 : 1 - PP_FX18_NETZ_KURVE((u - 0.88) / 0.12);
  if (op <= 0.02) return;
  const W = Math.max(4, Math.round(N * sx)), H = Math.max(4, Math.round(N * sy));
  const x0 = Math.round(cx - W / 2), y0 = Math.round(cy + N / 2 + ty / S - H);   // Fuß des Netzes bleibt am Boden der Zone (transform-origin 50 % 100 %)
  if (y0 + H < -2) return;
  const R = 5, F = PP_FX18_NETZ;
  for (let j = -1; j <= H + 1; j++) {
    for (let i = -1; i <= W; i++) {
      const aussen = ppFx18InRR(i, j, W, H, R);
      if (!aussen) {
        if (ppFx18InRR(i, j - 1, W, H, R) && op > 0.5) g.put(x0 + i, y0 + j, F.schatten, 0.4 * op);   // harter Schatten unter dem Netz (eine Pixelreihe)
        continue;
      }
      const innen = ppFx18InRR(i - 1, j - 1, W - 2, H - 2, R - 1);
      if (!innen) { g.put(x0 + i, y0 + j, (i + j) & 1 ? F.seil : F.seilHell, op); continue; }
      const rand = !ppFx18InRR(i - 3, j - 3, W - 6, H - 6, R - 3);
      const sx2 = i + 1000, sy2 = j + 1000;
      if (sx2 % 7 === (sy2 % 7) || (sx2 + sy2) % 7 === 0) g.put(x0 + i, y0 + j, F.masche, op * (rand ? 0.8 : 1));
      else if (rand) g.put(x0 + i, y0 + j, F.innen, 0.35 * op);                   // innerer Schatten am Rand (statt weicher Verlauf)
    }
  }
}, (p) => p.duration || 1900, (p) => {
  const gross = Math.round(Math.max(p.w || 80, 64) * 1.3), v = ppR1FeldVersatz(p);
  const ay = Math.max(40, p.y - v.dy);                                          // Abstand vom Fensterrand bis zur Zonenmitte
  return { breite: Math.ceil(gross * 1.14) + 16, hoehe: Math.ceil(ay + gross / 2 + 12), ankerY: ay };
}, { z: 10115 });

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Cosmic Counter entfernt (`cosmic_counter_remove`; Cosmic-Karten) — PIXELART. Umgekehrter Funkenschlag: zehn violette Funken (4–7 px) fliegen aus 30 px Abstand zur Mitte (600 ms, ease-in,
//  Deckung 1 → 0, schrumpfend auf .2), bei 400 ms gibt es einen kleinen Implosionsblitz (350 ms, .3 → 1,4 → 1,8 mal, weiß mit violettem Rand, Dither-Stufen).
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX18_KOSMOS = { funke: ppHex('#702db3'), funkeHell: ppHex('#b866ff'), blitz: ppFx18Hex(['#b866ff', '#f1e5fa', '#ffffff']) };
const ppFx18CosmicCounterRemove = ppR1Leinwand((g, t, sz, te) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, K = PP_FX18_KOSMOS;
  for (const s of te.funken) {
    const u = (t - s.verzug) / 600;
    if (u < 0 || u > 1) continue;
    const e = PP_FX18_EI(u), sc = 1 - 0.8 * e, a = 1 - e;
    const x = cx + Math.cos(s.w) * 30 * (1 - e) / S, y = cy + Math.sin(s.w) * 30 * (1 - e) / S, d = s.size * sc / S;
    if (d >= 2.5) ppFx18Korn(g, x, y, d + 1.4, K.funkeHell, a * 0.45);          // Schein als Dither-Ring
    ppFx18Korn(g, x, y, d, K.funke, a);
    if (d >= 1.8) g.put(x - 0.5, y - 0.5, K.funkeHell, a);
  }
  const uf = (t - 400) / 350;
  if (uf >= 0 && uf <= 1) {
    const [op, sc] = ppKf(uf, [[0, [0, 0.3]], [0.5, [1, 1.4]], [1, [0, 1.8]]]);
    const r = Math.max(1.2, 7 * sc / S);
    ppFx7Glow(g, cx, cy, r, r, K.blitz, 0.95 * op, 0.9);
  }
}, 800, { breite: 120, hoehe: 120 }, {
  z: 10100,
  vorbereiten: () => ({
    funken: Array.from({ length: ppFxN(10) }, (_, i) => ({ w: (i / 10) * Math.PI * 2, size: 4 + Math.random() * 3, verzug: Math.random() * 60 })),
  }),
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Invader aus den kosmischen Tiefen (`cosmic_invader_strike`; auch Invader-Token) — PIXELART. Fünf violett-weiße Strahlen (Fächer ±21° nach oben, 4 px breit, 60 px lang; Verzug 35 ms
//  gestaffelt, 500 ms: Länge .2 → 1 → .4, Deckung 0 → 1 → 0; hell am Fuß, auslaufend zur Spitze) und ein runder Schlagblitz (50 px, ab 250 ms, 600 ms: .3 → 1,3 → 1,8 mal, Dither-Stufen).
//  (Im alten CSS blieben die Strahlen wegen einer nie gesetzten Variable senkrecht übereinander stehen — hier ist es der gemeinte Fächer.)
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX18_INVASOR = { weiss: ppHex('#ffffff'), hell: ppHex('#c98aff'), mitte: ppHex('#a952ff'), blitz: ppFx18Hex(['#702db3', '#a952ff', '#c98aff', '#ffffff']) };
const ppFx18CosmicInvaderStrike = ppR1Leinwand((g, t, sz) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, K = PP_FX18_INVASOR;
  for (let i = 0; i < 5; i++) {
    const u = (t - i * 35) / 500;
    if (u < 0 || u > 1) continue;
    const [op, sy] = ppKf(u, [[0, [0, 0.2]], [0.6, [1, 1]], [1, [0, 0.4]]]);
    const w = (i - 2) * 0.18, len = 60 * sy / S, dx = Math.sin(w), dy = -Math.cos(w);
    ppR1Band(g, cx, cy, cx + dx * len, cy + dy * len, (v) => (v < 0.22 ? { w: 1.6, c: K.weiss } : v < 0.62 ? { w: 1.5, c: K.hell, a: 0.95 } : { w: 1, c: K.mitte, a: Math.max(0.15, (1 - v) / 0.38) }), op);
  }
  const up = (t - 250) / 600;
  if (up >= 0 && up <= 1) {
    const [op, sc] = ppKf(up, [[0, [0, 0.3]], [0.4, [1, 1.3]], [1, [0, 1.8]]]);
    const r = 25 * sc / S;
    ppFx7Glow(g, cx, cy, r, r, K.blitz, 0.95 * op, 0.9);
  }
}, 900, { breite: 200, hoehe: 200 }, { z: 10100 });

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
//  Skeleton Reaper (`crescent_reap`) — PIXELART. Eine bogenförmige Sensenklinge wird (Quadratkurve von links unten über die Mitte nach rechts unten) in einem Zug gezeichnet.
//  Nicht tödlich (`duration` 600): kleine blassblaue Klinge, 420 ms. Tödlich (`duration` 1300): 3× so groß und breit (24 px), fast schwarze Klinge mit blutrotem Kern (850 ms), darunter ein
//  schwarzviolettes Dunkel (Dither-Ellipse, ab 180 ms) und ein großer Pixel-Schädel, der ab 280 ms durch das Dunkel aufsteigt. Der Schlagschein der Klinge ist ein gedithertes Band; der Schädel
//  schwankt nicht mehr (keine Drehung). Aura und Schädel sind auf die Aufruferdauer gestaucht (vorher bis 1480 ms bei 1300 ms Lebensdauer).
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
const PP_FX18_REAP = {
  hell: { aussen: ppHex('#e5edfa'), innen: ppHex('#ffffff'), schein: ppHex('#b3d8f9') },
  tod: { aussen: ppHex('#08060c'), innen: ppHex('#e92f38'), schein: ppHex('#b5171c'), schein2: ppHex('#3a0000') },
  dunkel: ppFx18Hex(['#08060c', '#3a0000', '#4b1021']),                     // außen → innen
  schaedel: { o: ppHex('#3a0000'), w: ppHex('#fae5eb'), s: ppHex('#a89370'), k: ppHex('#08060c') },
};
const PP_FX18_REAP_KURVE = ppFx7Bez(0.2, 0.85, 0.35, 1);
const _ppFx18SchaedelCache = new Map();
/** Schädel mit Breite `n` Rasterpixel (Hirnschale, Kiefer, Augenhöhlen, Nase, Zähne) als Zeichenzeilen: o Rand, w Knochen, s Schatten, k Loch. */
function ppFx18SchaedelBild(n) {
  let b = _ppFx18SchaedelCache.get(n);
  if (b) return b;
  const h = n, inn = (x, y) => {
    const cx = (x + 0.5) / n - 0.5, cy = (y + 0.5) / h;
    const hirn = (cx / 0.5) ** 2 + ((cy - 0.42) / 0.42) ** 2 <= 1;
    const kiefer = Math.abs(cx) <= 0.27 && cy >= 0.58 && cy <= 0.96 && (Math.abs(cx) <= 0.27 - Math.max(0, cy - 0.9) * 2.5);
    return hirn || kiefer;
  };
  const z = [];
  for (let y = 0; y < h; y++) {
    let r = '';
    for (let x = 0; x < n; x++) {
      if (!inn(x, y)) { r += '.'; continue; }
      const cx = (x + 0.5) / n - 0.5, cy = (y + 0.5) / h;
      const rand = !inn(x - 1, y) || !inn(x + 1, y) || !inn(x, y - 1) || !inn(x, y + 1);
      const auge = (((Math.abs(cx) - 0.19) / 0.13) ** 2 + ((cy - 0.46) / 0.15) ** 2) <= 1;
      const nase = cy >= 0.6 && cy <= 0.69 && Math.abs(cx) <= (cy - 0.58) * 0.5;
      const zahn = cy >= 0.8 && cy <= 0.94 && Math.abs(cx) < 0.25 && Math.round(((cx + 0.25) * n) / 1.0) % 2 === 0 && cy < 0.86 + 0.0;
      let c = 'w';
      if (rand) c = 'o'; else if (auge || nase) c = 'k'; else if (cx > 0.3 || (cy > 0.9)) c = 's'; else if (cy >= 0.82 && cy <= 0.87 && zahn) c = 's';
      r += c;
    }
    z.push(r);
  }
  _ppFx18SchaedelCache.set(n, z);
  return z;
}
/** Bogenlinie der Klinge: Punkte (Rasterkoordinaten relativ zur Leinwand) in gleichen Bogenlängen-Abständen, mit Gesamtlänge. */
function ppFx18Bogen(x0, y0, x1, y1, x2, y2) {
  const pts = [], M = 240;
  let L = 0, px = x0, py = y0;
  pts.push({ x: x0, y: y0, s: 0 });
  for (let i = 1; i <= M; i++) {
    const t = i / M, a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t;
    const x = a * x0 + b * x1 + c * x2, y = a * y0 + b * y1 + c * y2;
    L += Math.hypot(x - px, y - py); px = x; py = y;
    pts.push({ x, y, s: L });
  }
  return { pts, L };
}
/** Zeichnet den Bogen von Anfang bis Bruchteil `p` (0..1 der Länge) mit runder Pinselspitze der Breite `breite` (Rasterpixel). */
function ppFx18Strich(g, bogen, p, breite, c, a) {
  if (p <= 0 || a <= 0.02) return;
  const bis = bogen.L * Math.min(1, p), r = Math.max(0.5, breite / 2), schritt = Math.max(0.8, r * 0.7);
  let naechste = 0;
  for (const q of bogen.pts) {
    if (q.s > bis) break;
    if (q.s < naechste) continue;
    naechste = q.s + schritt;
    const n = Math.round(breite);
    if (n <= 1) g.put(q.x, q.y, c, a); else if (n <= 3) g.block(Math.round(q.x - n / 2 + 0.5), Math.round(q.y - n / 2 + 0.5), n, n, c, a); else g.disc(q.x, q.y, r - 0.3, c, a);
  }
}
const ppFx18CrescentReap = ppFx4Leinwand((g, t, sz, te) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, p = sz.props, leth = !!p.lethal, K = leth ? PP_FX18_REAP.tod : PP_FX18_REAP.hell;
  const dauer = leth ? 850 : 420, stops = leth ? [[0, 0], [0.18, 1], [0.72, 1], [1, 0]] : [[0, 0], [0.15, 1], [0.85, 0.95], [1, 0]];
  // Klinge: Außenlinie, Kern (12 % später)
  for (const lage of [0, 1]) {
    const u = (t - (lage ? Math.round(dauer * 0.12) : 0)) / dauer;
    if (u < 0 || u > 1) continue;
    const prog = PP_FX18_REAP_KURVE(u), op = ppFx7Kf(u, stops, PP_FX18_REAP_KURVE);
    if (op <= 0.02) continue;
    if (!lage) {
      ppFx18Strich(g, te.bogen, prog, te.breite + (leth ? 5 : 3), K.schein, op * (leth ? 0.4 : 0.35));          // Schein: gedithertes, breiteres Band
      if (leth) ppFx18Strich(g, te.bogen, prog, te.breite + 10, K.schein2, op * 0.22);
      ppFx18Strich(g, te.bogen, prog, te.breite, K.aussen, op);
    } else ppFx18Strich(g, te.bogen, prog, Math.max(1, te.breite * 0.35), K.innen, op * (leth ? 0.92 : 0.95));
  }
  if (!leth) return;
  const ende = Math.max(900, (p.duration || 1300) - 40), AH = te.arcH;
  // schwarzviolettes Dunkel unter dem Schnitt (1100 ms ab 180 ms → gestaucht)
  const ua = ppFx18Lauf(t, 180, 1100, ende);
  if (ua !== null) {
    const [op, sc] = ppKf(ua, [[0, [0, 0.5]], [0.35, [0.95, 1]], [1, [0, 1.45]]]);
    const rx = te.arcW * 0.425 * sc / S, ry = AH * 0.275 * sc / S;
    ppFx7Glow(g, cx, cy + AH * 0.225 / S, rx, ry, PP_FX18_REAP.dunkel, 0.95 * op, 0.9);
  }
  // Schädel: steigt durch das Dunkel auf (1200 ms ab 280 ms → gestaucht)
  const us = ppFx18Lauf(t, 280, 1200, ende);
  if (us !== null) {
    const [op, dy, sc] = ppKf(us, [[0, [0, 28, 0.8]], [0.3, [1, 0, 1]], [0.7, [1, -10, 1.05]], [1, [0, -36, 1.1]]]);
    const n = Math.max(8, Math.round(25 * sc));
    g.spr(ppFx18SchaedelBild(n), PP_FX18_REAP.schaedel, cx, cy + (-AH * 0.3 + 45 + dy) / S, op);
  }
}, (p) => p.duration || (p.lethal ? 1300 : 600), (p) => {
  const leth = !!p.lethal, baseW = Math.max(p.w || 80, 80), baseH = Math.max(p.h || 110, 110), sk = leth ? 3 : 1;
  const arcW = baseW * 1.7 * sk, arcH = baseH * sk, pad = 24;
  const halbB = Math.max(arcW * 0.5, leth ? arcW * 0.64 : 0) + (leth ? 40 : 14) + pad;
  const oben = Math.max(arcH * 0.18 + (leth ? 24 : 8), leth ? arcH * 0.3 + 50 + 36 : 0) + pad;
  const unten = Math.max(arcH * 0.42 + (leth ? 24 : 8), leth ? arcH * 0.64 : 0) + pad;
  return { breite: halbB * 2, hoehe: oben + unten, ankerY: oben };
}, {
  z: 10100,
  vorbereiten: (sz) => {
    const p = sz.props, S = sz.S, leth = !!p.lethal, baseW = Math.max(p.w || 80, 80), baseH = Math.max(p.h || 110, 110), sk = leth ? 3 : 1;
    const arcW = baseW * 1.7 * sk, arcH = baseH * sk;
    // SVG-Ursprung: (x − arcW · .5, y − arcH · .4); Pfad M .05W .78H Q .5W −.18H, .95W .78H
    const ox = sz.cx - arcW * 0.5 / S, oy = sz.cy - arcH * 0.4 / S;
    const bogen = ppFx18Bogen(ox + arcW * 0.05 / S, oy + arcH * 0.78 / S, ox + arcW * 0.5 / S, oy - arcH * 0.18 / S, ox + arcW * 0.95 / S, oy + arcH * 0.78 / S);
    return { bogen, arcW, arcH, breite: (leth ? 24 : 6) / S };
  },
});

ppFxUeberschreiben('blood_hearts', ppFx18BloodHearts);
ppFxUeberschreiben('capture_net', ppFx18CaptureNet);
ppFxUeberschreiben('cosmic_counter_remove', ppFx18CosmicCounterRemove);
ppFxUeberschreiben('cosmic_invader_strike', ppFx18CosmicInvaderStrike);
ppFxUeberschreiben('crescent_reap', ppFx18CrescentReap);
