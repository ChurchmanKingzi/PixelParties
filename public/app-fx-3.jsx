// Pixelart-Portierungen (Canvas), Batch 3: siehe app-fx-0.jsx. Jede Portierung: `ppFxUeberschreiben('typ', Komponente)`.
// Effekte: explosion, demon_fire_pillar, druid_leaf_storm, elephant_stomp, fire_sweep, fireball, flame_jet, flame_slash, flamethrower_douse, flooding,
//          gewaltsame_erweckung, gift_shower, glass_blade_shatter.
// Jeder Effekt malt auf EINER Leinwand (`ppR1Leinwand`, app-board.jsx): ein Rasterpixel = 3 Bildschirmpixel, 30 Bilder/s, Deckung < 1 = Bayer-Dithering, keine Drehung von Bildern,
// Emojis sind kleine Pixel-Sprites. Zeitablauf, Anker und Streuung folgen den DOM-Fassungen in `ANIM_REGISTRY` (app-board.jsx) + style.css. Namen in dieser Datei tragen das Praefix `ppFx3`
// (der Build macht aus `const` globale `var`s — gleiche Namen in anderen app-fx-Dateien wuerden sich ueberschreiben).

const PP_FX3_S = 3;
const ppFx3Aus = (u) => 1 - (1 - u) * (1 - u);                       // ease-out
const ppFx3Zw = (a, b) => a + Math.random() * (b - a);                // Zufallszahl a..b
const ppFx3Wahl = (liste) => liste[Math.floor(Math.random() * liste.length)];
const ppFx3Farben = (liste) => liste.map(ppHex);
const ppFx3Grad = (w) => w * Math.PI / 180;
/** cubic-bezier(x1, y1, x2, y2) wie CSS: u 0..1 → Wert. */
function ppFx3Bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = (s) => ((ax * s + bx) * s + cx) * s, Y = (s) => ((ay * s + by) * s + cy) * s;
  return (u) => {
    if (u <= 0) return 0;
    if (u >= 1) return 1;
    let lo = 0, hi = 1, s = u;
    for (let i = 0; i < 24; i++) { const x = X(s); if (Math.abs(x - u) < 1e-4) break; if (x < u) lo = s; else hi = s; s = (lo + hi) / 2; }
    return Y(s);
  };
}
/** Farbstufe aus `farben` (gleichmaessig verteilt) fuer v 0..1, zwischen den Stufen per Bayer-Raster gedithert. */
function ppFx3Stufe(farben, v, x, y) {
  const n = farben.length, f = Math.max(0, Math.min(n - 1, v * n - 0.5)), k = Math.floor(f);
  return farben[k + 1 < n && (f - k) > ppBayer(x, y) ? k + 1 : k];
}
/** Punkt/Scheibe mit Durchmesser d (Raster) um (x, y). */
function ppFx3Punkt(g, x, y, d, c, a) {
  if (d >= 3) g.disc(x, y, d / 2 - 0.2, c, a);
  else { const n = d >= 1.6 ? 2 : 1; g.block(x - n / 2, y - n / 2, n, n, c, a); }
}
/** Pixelbild in ganzzahliger Vergroesserung n, linke obere Ecke (x0, y0). */
function ppFx3Bild(g, zeilen, pal, x0, y0, n, a) {
  x0 = Math.round(x0); y0 = Math.round(y0);
  for (let j = 0; j < zeilen.length; j++) {
    const z = zeilen[j];
    for (let i = 0; i < z.length; i++) {
      const c = pal[z[i]];
      if (!c) continue;
      if (n === 1) g.put(x0 + i, y0 + j, c, a); else g.block(x0 + i * n, y0 + j * n, n, n, c, a);
    }
  }
}
/** Pixelbild um 90° * q drehen (Zeichenfeld → Zeichenfeld). */
function ppFx3Dreh(zeilen, q) {
  let z = zeilen;
  for (let k = 0; k < (q & 3); k++) {
    const h = z.length, w = z[0].length, neu = [];
    for (let i = 0; i < w; i++) { let s = ''; for (let j = h - 1; j >= 0; j--) s += z[j][i]; neu.push(s); }
    z = neu;
  }
  return z;
}

// ── Flammen-Sprites (Pixel statt 🔥 💥 ✦) ───────────────────────────────────────────────────────────────────────────────────────
const PP_FX3_FLAMMENFARBE = { o: ppHex('#ff491a'), r: ppHex('#ff8b1a'), Y: ppHex('#fad54a'), W: ppHex('#f9ecb3') };
const PP_FX3_BILD = {
  gross: ['...o...', '..oro..', '..orro.', '.orYro.', '.orYYo.', 'orrYYro', 'orYYWYo', 'orYWWYo', '.orYYo.'],
  klein: ['..o..', '.orr.', '.orYo', 'orYYo', 'orYWo', '.ooo.'],
  mini: ['.o.', 'orr', 'oYo', '.o.'],
  stern: ['..Y..', '..Y..', 'YYWYY', '..Y..', '..Y..'],
  knall: ['o..Y..o', '.o.Y.o.', '..oYo..', 'YYYWYYY', '..oYo..', '.o.Y.o.', 'o..Y..o'],
};
/** Flamme/Stern/Knall der Groesse `gr` (Raster, Hoehe) um (x, y). art: 'f' (🔥) · 's' (✦) · 'k' (💥). */
function ppFx3Flamme(g, x, y, gr, a, art) {
  if (gr < 2) { g.block(x - 0.5, y - 0.5, 1, 1, PP_FX3_FLAMMENFARBE.Y, a); return; }
  if (art === 's') g.spr(gr >= 3.5 ? PP_FX3_BILD.stern : ['.Y.', 'YWY', '.Y.'], PP_FX3_FLAMMENFARBE, x, y, a);
  else if (art === 'k') g.spr(gr >= 5 ? PP_FX3_BILD.knall : PP_FX3_BILD.stern, PP_FX3_FLAMMENFARBE, x, y, a);
  else g.spr(gr >= 7 ? PP_FX3_BILD.gross : gr >= 4.6 ? PP_FX3_BILD.klein : PP_FX3_BILD.mini, PP_FX3_FLAMMENFARBE, x, y, a);
}
/** Flammenzunge nach oben: Fusspunkt (bx, by), Breite/Hoehe in Rasterpixeln, `rampe` = [Rand, …, Kern] (2–4 Farben), `phase` = Flackern. Die Spitze dithert aus. */
function ppFx3Zunge(g, bx, by, breite, hoehe, rampe, a, phase) {
  const H = Math.max(2, Math.round(hoehe)), n = rampe.length;
  for (let j = 0; j < H; j++) {
    const v = j / H;
    const prof = v < 0.16 ? 0.6 + 0.4 * (v / 0.16) : Math.pow(1 - (v - 0.16) / 0.84, 0.75);
    const mx = bx + Math.sin(phase + v * 5.5) * 0.9 * v * Math.min(2, breite / 3);
    const hw = Math.max(0.5, breite / 2 * prof), y = Math.round(by - j);
    const x0 = Math.round(mx - hw), x1 = Math.round(mx + hw), al = a * (v > 0.78 ? Math.max(0, 1 - (v - 0.78) / 0.28) : 1);
    if (al <= 0) continue;
    for (let x = x0; x <= x1; x++) {
      const d = Math.min(1, Math.abs(x - mx) / hw), t = d * 0.75 + v * 0.45;     // 0 = Kern … 1 = Rand/Spitze
      g.put(x, y, rampe[Math.max(0, Math.min(n - 1, n - 1 - Math.floor(t * n * 0.95)))], al);
    }
  }
}
const PP_FX3_RAMPEN = {   // Zungenfarbe (Name der Grundfarbe) → [Rand, Mitte, Kern]
  '#fad54a': ppFx3Farben(['#ff8b1a', '#fad54a', '#f9ecb3']), '#ff9a1a': ppFx3Farben(['#ff491a', '#ff9a1a', '#fad54a']),
  '#ff7d00': ppFx3Farben(['#cc2b00', '#ff7d00', '#f9ac20']), '#ff491a': ppFx3Farben(['#b62600', '#ff491a', '#ff8b1a']),
  '#f7f7ad': ppFx3Farben(['#f9ac20', '#f7f7ad', '#ffffff']),
};

// ═════════════════════════════════════════════════════════════════
//  Explosion (`explosion`) — Kern, Druckwelle, Splitter, Truemmer, Glut, Rauch (wie `ExplosionEffect`, app-board.jsx). Prop `opacity` dimmt per Dither.
// ═════════════════════════════════════════════════════════════════
const ppFx3Explosion = (() => {
  const C = { gelb: ppHex('#fad54a'), creme: ppHex('#f9ecb3'), weiss: ppHex('#ffffff'), orange: ppHex('#f87420'), welle: ppHex('#f9ac20'), wellenRand: ppHex('#ff7d00') };
  const PART = ppFx3Farben(['#ff491a', '#ff8b1a', '#fad54a', '#ff1a1a', '#f9ac20', '#ffffff', '#fbe181']);
  const BROCKEN = ppFx3Farben(['#68332a', '#7d3911', '#323232', '#b62600']);
  const GLUT = ppFx3Farben(['#ffe469', '#f9ac20', '#ff7d00']);
  const RAUCH = ppFx3Farben(['#59606e', '#3e3e51']);
  return ppR1Leinwand((g, t, sz, tl) => {
    const S = PP_FX3_S, cx = sz.cx, cy = sz.cy, ow = tl.ow;
    for (const r of tl.rauch) {
      const u = (t - r.delay) / r.dur;
      if (u < 0 || u > 1) continue;
      const e = ppFx3Aus(u), a = (u < 0.3 ? 0.9 * u / 0.3 : 0.9 * (1 - (u - 0.3) / 0.7)) * ow;
      const x = cx + r.dx * e / S, y = cy + r.dy * e / S, rad = r.size / 2 * (0.4 + 1.1 * e) / S;
      g.disc(x, y, rad * 0.78, r.ton, a * 0.45);
      g.disc(x, y, rad * 0.45, r.ton, a * 0.8);
    }
    let u = t / 500;
    if (u <= 1) { const [sc, op] = ppKf(u, [[0, [0.2, 1]], [0.4, [1.6, 0.8]], [1, [2.2, 0]]]), r = 45 * sc / S; g.glow(cx, cy, r * 0.72, r * 0.72, [C.orange, C.gelb], op * ow * 0.6, 1.5); }
    u = t / 300;
    if (u <= 1) {
      const [sc, op] = ppKf(u, [[0, [0.2, 1]], [0.45, [1.35, 1]], [1, [1.6, 0]]]), r = 28 * sc / S;
      g.disc(cx, cy, r * 0.72, C.gelb, op * ow); g.disc(cx, cy, r * 0.5, C.creme, op * ow); g.disc(cx, cy, r * 0.28, C.weiss, op * ow);
    }
    u = (t - 40) / 460;
    if (u >= 0 && u <= 1) {
      const sc = 0.25 + 2.35 * ppFx3Aus(u), op = ppKf(u, [[0, [1]], [0.7, [0.9]], [1, [0]]], true)[0], R = 32 * sc / S, th = Math.max(1, 5 * sc / S);
      g.ring(cx, cy, R, R + 1, C.wellenRand, op * ow * 0.7);
      g.ring(cx, cy, R - th, R, C.welle, op * ow);
    }
    for (const p of tl.partikel) {
      u = (t - p.delay) / p.dur;
      if (u < 0 || u > 1) continue;
      const e = ppFx3Aus(u), a = (u < 0.2 ? 1 : 1 - (u - 0.2) / 0.8) * ow, d = p.size * 1.2 * (1 - e) / S;
      if (d < 0.7) continue;
      ppFx3Punkt(g, cx + p.dx * e / S, cy + p.dy * e / S, d, p.farbe, a);
    }
    for (const b of tl.brocken) {
      u = (t - b.delay) / b.dur;
      if (u < 0 || u > 1) continue;
      let dx, dy;
      if (u < 0.55) { const e = ppFx3Aus(u / 0.55); dx = b.dx * e; dy = b.dy * e; }
      else { const e = ppFx3Aus((u - 0.55) / 0.45); dx = b.dx * (1 + 0.3 * e); dy = b.dy + (b.dy * 0.2 + 40 - b.dy) * e; }
      const a = (u < 0.55 ? 1 : 1 - (u - 0.55) / 0.45) * ow, n = Math.max(2, Math.round(b.size / S));
      g.block(cx + dx / S - n / 2, cy + dy / S - n / 2, n, n, b.farbe, a);
    }
    for (const o of tl.glut) {
      u = (t - o.delay) / o.dur;
      if (u < 0 || u > 1) continue;
      const e = ppFx3Aus(u), a = (u < 0.7 ? 1 : 1 - (u - 0.7) / 0.3) * ow;
      g.block(cx + o.dx * e / S - 0.5, cy + o.dy * e / S - 0.5, o.size >= 4.5 ? 2 : 1, o.size >= 4.5 ? 2 : 1, o.farbe, a);
    }
  }, 1150, { breite: 300, hoehe: 300 }, {
    vorbereiten: (sz) => {
      const op = sz.props.opacity;
      return {
        ow: (typeof op === 'number' && op >= 0 && op <= 1) ? op : 1,
        partikel: Array.from({ length: ppFxN(38) }, () => {
          const w = Math.random() * Math.PI * 2, v = 30 + Math.random() * 75;
          return { dx: Math.cos(w) * v, dy: Math.sin(w) * v, size: 4 + Math.random() * 9, farbe: ppFx3Wahl(PART), delay: Math.random() * 80, dur: 380 + Math.random() * 420 };
        }),
        brocken: Array.from({ length: ppFxN(8) }, () => {
          const w = -Math.PI * (0.15 + Math.random() * 0.7), v = 45 + Math.random() * 45;
          return { dx: Math.cos(w) * v, dy: Math.sin(w) * v, size: 6 + Math.random() * 6, farbe: ppFx3Wahl(BROCKEN), delay: 40 + Math.random() * 60, dur: 620 + Math.random() * 200 };
        }),
        glut: Array.from({ length: ppFxN(12) }, () => ({ dx: -34 + Math.random() * 68, dy: -(30 + Math.random() * 45), size: 3 + Math.random() * 3, farbe: ppFx3Wahl(GLUT), delay: 220 + Math.random() * 180, dur: 450 + Math.random() * 250 })),
        rauch: Array.from({ length: ppFxN(7) }, (_, i) => ({ dx: -26 + Math.random() * 52, dy: -(22 + Math.random() * 30), size: 30 + Math.random() * 22, delay: 180 + i * 35, dur: 560 + Math.random() * 160, ton: ppFx3Wahl(RAUCH) })),
      };
    },
  });
})();

// ═════════════════════════════════════════════════════════════════
//  Feuersaeule (`demon_fire_pillar`, Horned Demon) — von unten schiessende Saeule durch das Ziel (1000 ms, Saeule ab 140 ms), Bodenglut, Flammenzungen, Glut.
//  `intensity` (1–5) = mehr Zungen, breitere und hoehere Saeule; w/h = Zielkarte.
// ═════════════════════════════════════════════════════════════════
const ppFx3FeuerSaeule = (() => {
  const SAEULE = ppFx3Farben(['#fad54a', '#ff8b1a', '#ff491a', '#cc2b00']);
  const KERN = ppFx3Farben(['#fffbd2', '#ffe469', '#f9ac20']);
  const GLUT = ppFx3Farben(['#f8ca21', '#ff9a1a', '#ff7d00', '#ff491a', '#f9ecb3']);
  const grund = ppFx3Farben(['#ff491a', '#ff7d00']);
  const mase = (p) => {
    const k = Math.min(Math.max(p.intensity || 1, 1), 5), w = p.w || 80, h = p.h || 110;
    const breite = Math.max(48, w * (0.85 + k * 0.05)), hoehe = h * (1.35 + k * 0.12);
    const oben = hoehe - h * 0.5 + 120;
    return { breite: Math.max(breite * 1.5, 160) + 30, hoehe: oben + h * 0.5 + 50, ankerY: oben };
  };
  // Saeule (Rand-/Rundung) von der Fusslinie `y0` aus nach oben, Hoehe `H` (Raster), Breite `W`, Farbstufen `farben`, Deckung `a`.
  const saeule = (g, cx, y0, W, H, farben, a, t, zeit) => {
    const Hn = Math.round(H);
    for (let j = 0; j < Hn; j++) {
      const v = j / Math.max(1, Hn - 1);
      let hw = W / 2;
      if (v > 0.8) hw *= Math.sqrt(Math.max(0, 1 - Math.pow((v - 0.8) / 0.2, 2)));
      const wob = Math.sin(j * 0.55 + zeit * 0.016) * 0.9 + Math.sin(j * 0.23 - zeit * 0.011) * 0.8;
      const hh = Math.max(0.5, hw + wob * Math.min(1, v * 2.2)), al = a * (v < 0.62 ? 1 : Math.max(0, 1 - (v - 0.62) / 0.38));
      if (al <= 0) continue;
      const y = Math.round(y0 - j);
      for (let x = Math.round(cx - hh); x <= Math.round(cx + hh); x++) g.put(x, y, ppFx3Stufe(farben, v, x, y), al);
    }
  };
  return ppR1Leinwand((g, t, sz, tl) => {
    const S = PP_FX3_S, cx = sz.cx, y0 = sz.cy + tl.h * 0.5 / S;
    // Bodenglut
    let u = t / 1000;
    if (u <= 1) {
      const [sx, op] = ppKf(u, [[0, [0.2, 0]], [0.18, [1, 1]], [0.7, [1.1, 0.9]], [1, [0.6, 0]]]);
      g.glow(cx, y0 + 1, tl.breite * 1.3 / 2 * sx / S, 3.2, grund, op);
    }
    // Saeule + Kern
    u = (t - 140) / 1000;
    if (u >= 0 && u <= 1) {
      const [sy, sx, op] = ppKf(u, [[0, [0, 0.6, 0]], [0.26, [1.06, 1, 1]], [0.4, [0.96, 1.05, 1]], [0.55, [1.02, 0.97, 0.95]], [0.75, [0.9, 0.9, 0.8]], [1, [0.2, 0.5, 0]]]);
      if (sy > 0.02) saeule(g, cx, y0, tl.breite * sx / S, tl.hoehe * sy / S, SAEULE, op, t, t);
    }
    u = (t - 190) / 1000;
    if (u >= 0 && u <= 1) {
      const [sy, sx, op] = ppKf(u, [[0, [0, 0.6, 0]], [0.26, [1.06, 1, 1]], [0.4, [0.96, 1.05, 1]], [0.55, [1.02, 0.97, 0.95]], [0.75, [0.9, 0.9, 0.8]], [1, [0.2, 0.5, 0]]]);
      if (sy > 0.02) saeule(g, cx, y0, tl.breite * 0.4 * sx / S, tl.hoehe * 0.8 * sy / S, KERN, op, t, t + 90);
    }
    // Flammenzungen (🔥)
    for (const z of tl.zungen) {
      u = (t - z.delay) / z.dur;
      if (u < 0 || u > 1) continue;
      const e = ppFx3Aus(u), a = u < 0.2 ? u / 0.2 : 1 - (u - 0.2) / 0.8, gr = z.size * (0.6 + 0.65 * e) / S;
      ppFx3Flamme(g, cx + (z.xOff + z.sway * e) / S, sz.cy + (z.startY - z.rise * e) / S, gr, a, 'f');
    }
    // Glutfunken
    for (const o of tl.glut) {
      u = (t - o.delay) / o.dur;
      if (u < 0 || u > 1) continue;
      const e = ppFx3Aus(u), n = o.size * (1 - 0.7 * e) >= 2.5 ? 2 : 1;
      g.block(cx + o.xOff / S - n / 2, sz.cy + (tl.h * 0.5 - o.rise * e) / S - n / 2, n, n, o.farbe, 1 - u);
    }
  }, 1150, mase, {
    vorbereiten: (sz) => {
      const p = sz.props, k = Math.min(Math.max(p.intensity || 1, 1), 5), w = p.w || 80, h = p.h || 110;
      const breite = Math.max(48, w * (0.85 + k * 0.05)), hoehe = h * (1.35 + k * 0.12);
      return {
        h, breite, hoehe,
        zungen: Array.from({ length: 10 + k * 4 }, () => ({ xOff: (-0.5 + Math.random()) * breite * 0.9, startY: h * 0.5 + Math.random() * 10, rise: 60 + Math.random() * hoehe * 0.7, size: 12 + Math.random() * 12 + k * 1.5, delay: 120 + Math.random() * 380, dur: 380 + Math.random() * 320, sway: -14 + Math.random() * 28 })),
        glut: Array.from({ length: 12 + k * 3 }, () => ({ xOff: (-0.5 + Math.random()) * breite, rise: 80 + Math.random() * hoehe, size: 2 + Math.random() * 4, farbe: ppFx3Wahl(GLUT), delay: 200 + Math.random() * 450, dur: 450 + Math.random() * 350 })),
      };
    },
  });
})();

// ═════════════════════════════════════════════════════════════════
//  Laubsturm (`druid_leaf_storm`, Elven Druid) — 36 Blaetter stieben in alle Richtungen (Verzug 0–220 ms, 750–1250 ms), taumeln dabei; statt 🌿🌱☘️🍃🌾🍀 Pixelblaetter, die in
//  Vierteldrehungen kippen (Drehung der kleinen Pixelzeichen, nicht eines Bildes).
// ═════════════════════════════════════════════════════════════════
const ppFx3Laubsturm = (() => {
  const GRUEN_A = { D: ppHex('#167927'), G: ppHex('#20ac37'), L: ppHex('#3ddc57') };
  const GRUEN_B = { D: ppHex('#29663f'), G: ppHex('#2ca058'), L: ppHex('#5bbd7e') };
  const RIESIG = ['......DDDD', '....DDGGGD', '...DGGGLLD', '..DGGGLLGD', '.DGGLLLGD.', '.DGLLLGDD.', 'DGGLGDD...', 'DGGDD.....', 'DGD.......', 'D.........'];
  const ART = [
    { z: ['....DDD', '..DDGGD', '.DGGLGD', '.DGLLD.', 'DGLGD..', 'DGDD...', 'D......'], p: GRUEN_A, gross: true },
    { z: ['..DDD', '.DGGD', 'DGLD.', 'DGD..', 'D....'], p: GRUEN_A },
    { z: ['GG.GG', 'GLGLG', '.GGG.', '..D..', '..D..'], p: GRUEN_A },
    { z: ['....DDD', '..DDGGD', '.DGGLGD', '.DGLLD.', 'DGLGD..', 'DGDD...', 'D......'], p: GRUEN_B, gross: true },
    { z: ['..DDD', '.DGGD', 'DGLD.', 'DGD..', 'D....'], p: GRUEN_B },
    { z: ['GG.GG', 'GLGLG', '.GGG.', '..D..', '..D..'], p: GRUEN_B },
    { z: RIESIG, p: GRUEN_A, gross: true, riesig: true },
    { z: RIESIG, p: GRUEN_B, gross: true, riesig: true },
  ];
  const DREHT = ART.map(a => [0, 1, 2, 3].map(q => ppFx3Dreh(a.z, q)));
  return ppR1Leinwand((g, t, sz, tl) => {
    const S = PP_FX3_S, cx = sz.cx, cy = sz.cy;
    for (const l of tl.blaetter) {
      const u = (t - l.delay) / l.dur;
      if (u < 0 || u > 1) continue;
      let px, py, sc;
      if (u < 0.7) { const e = ppFx3Aus(u / 0.7); px = l.dx * e; py = l.dy * e; sc = 0.35 + 0.7 * e; }
      else { const e = ppFx3Aus((u - 0.7) / 0.3); px = l.dx * (1 + 0.35 * e); py = l.dy * (1 + 0.35 * e); sc = 1.05 - 0.25 * e; }
      const a = u < 0.15 ? u / 0.15 : u < 0.7 ? 1 : 1 - (u - 0.7) / 0.3;
      const winkel = l.spin * (u < 0.7 ? ppFx3Aus(u / 0.7) : 1), q = ((Math.floor(winkel / 90) % 4) + 4) % 4;
      const x = cx + px / S, y = cy + py / S;
      if (sc < 0.55) { g.block(x - 1, y - 1, 2, 2, l.art.p.G, a); continue; }
      const ar = l.art, z = DREHT[l.idx][q];
      g.spr(z, ar.p, x, y, a);
    }
  }, 1500, { breite: 480, hoehe: 360 }, {
    vorbereiten: () => ({
      blaetter: Array.from({ length: ppFxN(36) }, () => {
        const w = Math.random() * Math.PI * 2, dist = 70 + Math.random() * 90, size = 14 + Math.random() * 14;
        let idx = Math.floor(Math.random() * 6);
        if (size >= 24 && Math.random() < 0.6) idx = 6 + Math.floor(Math.random() * 2);                    // grosse Blaetter: grosses Zeichen
        else if (size < 20 && ART[idx].gross) idx = idx === 0 ? 1 : 4;      // kleine Blaetter: kleines Zeichen
        return { dx: Math.cos(w) * dist, dy: Math.sin(w) * dist * 0.75, spin: (Math.random() < 0.5 ? -1 : 1) * (180 + Math.random() * 540), delay: Math.random() * 220, dur: 750 + Math.random() * 500, idx, art: ART[idx] };
      }),
    }),
  });
})();

// ═════════════════════════════════════════════════════════════════
//  Elefantenfuss (`elephant_stomp`) — der 40×53-Pixelfuss faellt aus der Hoehe auf die Zielmitte (0–330 ms), setzt auf (Schatten, Stossring, Risse, Staub), steht bis 780 ms
//  und hebt wieder ab. Das Ziel wird dabei flachgedrueckt (`pp-elephant-squash`, style.css) — als Nebenwirkung wie zuvor.
// ═════════════════════════════════════════════════════════════════
const ppFx3Elefant = (() => {
  const ZEILEN = [
    '..........K12232334454455566K...........', '..........K11223333445453555K...........', '.........K1112333344445554444K..........', '.........K1112223322121234455K..........',
    '.........K1111111123445555656K..........', '.........K1112233434433312233K..........', '.........K1111111112334456656K..........', '........K111111334344445455556K.........',
    '........K111111121434444555565K.........', '........K111111212121212343555K.........', '........K111223233445454444323K.........', '........K111122323343444455656K.........',
    '........K111221233333222323343K.........', '.........K1111111112234456565K..........', '.........K1111323344444455555K..........', '.........K1112222333344444555K..........',
    '.........K1122223332443233334K..........', '.........K1112111112133345566K..........', '.........K1111113344445454556K..........', '.........K1111111111122323555K..........',
    '.........K1122223444555444433K..........', '.........K1112122333244445566K..........', '.........K1111111111222233444K..........', '.........K1111122333244445454K..........',
    '.........K1122223343445555656K..........', '.........K1112232324444545555K..........', '.........K1122213333445453556K..........', '........K111122313343333332333K.........',
    '........K111111111112244556566K.........', '........K111122334334445353333K.........', '........K111223233433232334455K.........', '.......K11111211111223354545555K........',
    '......K1111111113344544454545555K.......', '.....K111112232333333434454545455K......', '....K11111222223334443434455545555K.....', '...K1111111223232333334434454555455K....',
    '..K111112112333113434114544425555555K...', '.K11111112122321143321144445154555555K..', '.K11112122123331133341144444155455655K..', 'K1111112121122211333311434411545454545K.',
    'K1111122211133311443411443412555455565K.', '111111121211232314333144444115444455555K', '111111212211323313434144445114555555556K', '111111121211222314333134444115454545555K',
    '111111112211323313434143444115545555655K', '111111nnnNN123231333314434311nnnNN45555K', '111111MMMNN132321143114443412MMMNN54555K', 'K11111MMMNN2nnnNN3332434nnnNNMMMNN4545K.',
    '.KKK111nnn21MMMNN3nnnNN3MMMNN4nnn55KKK..', '....KKKKKKKKMMMNN2MMMNN4MMMNNKKKKKK.....', '............KnnnKKMMMNNKKnnnK...........', '.............KKK..KnnnK..KKK............',
    '...................KKK..................',
  ];
  const FARBE = { K: '#282834', '1': '#3e3e51', '2': '#59606e', '3': '#7e7d9b', '4': '#9aa3b6', '5': '#a5b0c0', '6': '#d2d2db', N: '#fff8e8', M: '#ebdcc1', n: '#a89370' };
  const PAL = {}; for (const k of Object.keys(FARBE)) PAL[k] = ppHex(FARBE[k]);
  const STAUB = ppFx3Farben(['#c5b7a0', '#7f7f7f', '#e2d8cb', '#686868']);
  const RISSE = [-70, -25, 20, 65, 110, 155, 200, 245];
  const CRISS = ppHex('#12101f'), CRING = ppHex('#ffffff'), CSCHATTEN = ppHex('#000000');
  const mase = (p) => {
    const px = Math.max(2, Math.ceil((p.w || 90) * 0.95 / 40)), fw = 40 * px, fh = 53 * px, H = Math.round(fh * 3.2 + 220);
    const oben = Math.min(fh + H, Math.max(fh + 40, Math.round(p.y) + 20)) + 10, seite = Math.max(fw * 1.2, fw * 0.5 + 60);
    return { breite: seite * 2, hoehe: oben + 130 + fw * 0.4, ankerY: oben };
  };
  return ppR1Leinwand((g, t, sz, tl) => {
    const S = PP_FX3_S, cx = sz.cx, cy = sz.cy, u = t / 1000, px = tl.px, fw = tl.fw, fh = tl.fh, n = tl.n;
    // Schatten (steps(8))
    {
      const us = Math.floor(u * 8) / 8, [sc, op] = ppKf(us, [[0, [0.35, 0]], [0.3, [1, 1]], [0.8, [1.1, 1]], [1, [1.1, 0]]], true);
      if (op > 0) g.ell(cx, cy, fw * 0.55 * sc / S, px * 3 * sc / S, CSCHATTEN, 0.55 * op);
    }
    // Der Fuss
    {
      const H = tl.H;
      let ty, op;
      if (u < 0.33) { ty = -H * (1 - u / 0.33); op = Math.min(1, u / 0.06); }
      else if (u < 0.4) { ty = 4 * (u - 0.33) / 0.07; op = 1; }
      else if (u < 0.78) { ty = 4; op = 1; }
      else { const k = (u - 0.78) / 0.22; ty = 4 + (-H - 4) * k * k; op = 1 - k; }
      if (op > 0) ppFx3Bild(g, ZEILEN, PAL, cx - 20 * n + 0.5, cy + (px * 2 + ty) / S - 53 * n, n, op);
    }
    // Stossring (steps(6)) — viereckiger Rahmen
    if (u >= 0.33) {
      const k = Math.min(1, Math.floor((u - 0.33) / 0.22 * 6) / 6), op = u < 0.55 ? 1 - k : 0, sc = 0.4 + 1.3 * k;
      if (op > 0) {
        const hs = Math.round(fw / 2 * sc / S), th = Math.max(1, Math.round(px * sc / S)), x0 = Math.round(cx) - hs, y0 = Math.round(cy) - hs;
        g.block(x0, y0, hs * 2, th, CRING, op); g.block(x0, y0 + hs * 2 - th, hs * 2, th, CRING, op);
        g.block(x0, y0, th, hs * 2, CRING, op); g.block(x0 + hs * 2 - th, y0, th, hs * 2, CRING, op);
      }
    }
    // Risse (33–72 %)
    if (u >= 0.33 && u <= 0.72) {
      RISSE.forEach((grad, i) => {
        const L = fw * (0.42 + (i % 3) * 0.1) / S, w = ppFx3Grad(grad);
        g.line(cx, cy, cx + Math.cos(w) * L, cy + Math.sin(w) * L, CRISS, 0.9, Math.max(1, Math.round(px / S)));
      });
    }
    // Staub (ab 32 %)
    if (u > 0.32) {
      for (const s of tl.staub) {
        let x, y, a;
        if (u < 0.62) { const k = (u - 0.34) / 0.28; x = s.dx * 0.85 * ppR1Klemme(k); y = s.dy * ppR1Klemme(k); a = 1; }
        else { const k = (u - 0.62) / 0.38; x = s.dx * (0.85 + 0.15 * k); y = s.dy + 34 * k; a = 1 - k; }
        const d = Math.max(1, Math.round(s.gross / S));
        g.block(cx + x / S - d / 2, cy + y / S - d / 2, d, d, s.farbe, a);
      }
    }
  }, 1000, mase, {
    vorbereiten: (sz) => {
      const px = Math.max(2, Math.ceil((sz.props.w || 90) * 0.95 / 40)), fw = 40 * px, fh = 53 * px;
      return {
        px, fw, fh, H: Math.round(fh * 3.2 + 220), n: Math.max(1, Math.round(px / PP_FX3_S)),
        staub: Array.from({ length: ppFxN(16) }, (_, i) => ({
          dx: (i % 2 === 0 ? -1 : 1) * (fw * 0.35 + Math.random() * fw * 0.7), dy: -(6 + Math.random() * fh * 0.55),
          gross: (Math.random() < 0.4 ? 2 : 1) * Math.max(3, px), farbe: STAUB[i % 4],
        })),
      };
    },
    wirkung: (p) => {
      const el = p.ankerSel ? document.querySelector(p.ankerSel) : null;
      if (!el || window._playAnimations === false) return undefined;
      el.classList.add('pp-elephant-squash');
      const tm = setTimeout(() => el.classList.remove('pp-elephant-squash'), 1000);
      return () => { clearTimeout(tm); el.classList.remove('pp-elephant-squash'); };
    },
  });
})();

// ═════════════════════════════════════════════════════════════════
//  Feuerwalze (`fire_sweep`, Cleansing of the Land) — fensterfuellend: eine 30 % breite Feuerwand (Kern-Verlauf, Zungen, Funken, Rauch) zieht in 2,1 s von links nach rechts durch
//  das Bild (cubic-bezier .35,.05,.6,1), dahinter waechst die verkohlte Spur (2,6 s, verglimmt). Zungen/Funken/Rauch laufen in Schleifen wie zuvor.
// ═════════════════════════════════════════════════════════════════
const ppFx3FeuerWalze = (() => {
  const zufall = (start) => { let t = start >>> 0; return () => { t = (t * 1664525 + 1013904223) >>> 0; return t / 4294967296; }; };
  const r = zufall(8801);
  const ZUNGEN = Array.from({ length: ppFxN(34) }, () => ({ x: r() * 100, y: r() * 100, b: 26 + r() * 46, h: 56 + r() * 92, dauer: 480 + r() * 420, verzug: r() * 700, hell: r() < 0.4 }));
  const FUNKEN = Array.from({ length: ppFxN(26) }, () => ({ x: r() * 100, y: 40 + r() * 60, g: 2 + r() * 3, dauer: 700 + r() * 700, verzug: r() * 1400, drift: (r() - 0.5) * 60 }));
  const RAUCH = Array.from({ length: ppFxN(8) }, () => ({ x: r() * 100, g: 60 + r() * 70, dauer: 1500 + r() * 900, verzug: r() * 900 }));
  const ZUG = ppFx3Bezier(0.35, 0.05, 0.6, 1);
  const KERN = ppFx3Farben(['#b62600', '#f87420', '#ffd066', '#fff8e8']);
  const RAMPE = ppFx3Farben(['#b62600', '#f87420', '#ffb91a', '#fff8e8']), RAMPE_HELL = ppFx3Farben(['#ff8b1a', '#fbe181', '#fff8e8', '#ffffff']);
  const NARBE = ppHex('#1f0f04'), HITZE = ppHex('#ff9b3a'), FUNKE = ppHex('#fbc86a'), FUNKE_HOF = ppHex('#ff9a1a'), RAUCHTON = ppHex('#393123'), RAUCHKERN = ppHex('#27180c');
  const KERN_A = [[0, 0], [0.28, 0.45], [0.58, 0.78], [0.84, 0.92], [0.96, 0.75], [1, 0]];
  const kernA = (f) => { for (let i = 1; i < KERN_A.length; i++) if (f <= KERN_A[i][0]) { const a = KERN_A[i - 1], b = KERN_A[i]; return a[1] + (b[1] - a[1]) * (f - a[0]) / (b[0] - a[0]); } return 0; };
  const schleife = (t, verzug, dauer) => (t < verzug ? -1 : ((t - verzug) % dauer) / dauer);
  return ppR1Leinwand((g, t, sz) => {
    const S = PP_FX3_S, W = sz.gw, H = sz.gh, Wd = 0.3 * W, L = -1.4 * Wd + 5.8 * Wd * ZUG(ppR1Klemme(t / 2100)), hoch = 1.24 * H, oben = -0.12 * H;
    // verkohlte Spur: waechst von links mit der Zeit (scaleX 0 → 1 bis 70 % von 2,6 s), verglimmt gegen Ende
    {
      const u = t / 2600;
      if (u <= 1) {
        const sx = u < 0.7 ? ppFx3Aus(u / 0.7) : 1, op = u < 0.7 ? 0.9 - 0.1 * (u / 0.7) : 0.8 * (1 - (u - 0.7) / 0.3), breite = Math.round(W * sx);
        for (let x = 0; x < breite; x++) { const f = x / Math.max(1, breite), a = (f < 0.7 ? 0.42 - 0.12 * (f / 0.7) : 0.3 * (1 - (f - 0.7) / 0.3)) * op * 0.8; g.block(x, 0, 1, H, NARBE, a); }
      }
    }
    // Rauch
    for (const q of RAUCH) {
      const u = schleife(t, q.verzug, q.dauer);
      if (u < 0) continue;
      const e = u, a = (u < 0.22 ? 0.6 * u / 0.22 : 0.6 * (1 - (u - 0.22) / 0.78)), sc = 0.6 + 0.9 * e, rad = q.g / 2 * sc / S;
      const x = L + q.x / 100 * Wd, y = H * 1.0208 - q.g / 2 / S - 150 * e / S;
      g.disc(x, y, rad * 0.8, RAUCHTON, a * 0.5); g.disc(x, y, rad * 0.5, RAUCHKERN, a * 0.5);
    }
    // Wand-Kern (Verlauf in x, Franse an der Vorderkante)
    for (let y = 0; y < H; y++) {
      const wob = Math.sin(y * 0.45 + t * 0.012) * 0.035 + Math.sin(y * 0.17 - t * 0.007) * 0.03;
      for (let x = Math.max(0, Math.floor(L)); x < Math.min(W, Math.ceil(L + Wd)); x++) {
        const f = (x - L) / Wd + wob, a = kernA(Math.max(0, Math.min(1, f)));
        if (a > 0) g.put(x, y, ppFx3Stufe(KERN, Math.max(0, Math.min(1, f)), x, y), a);
      }
    }
    // Hitze vor der Wand
    for (let k = 0; k < Wd * 0.3; k++) g.block(L + Wd + k, 0, 1, H, HITZE, 0.3 * (1 - k / (Wd * 0.3)) * 0.6);
    // Zungen
    for (const z of ZUNGEN) {
      const u = schleife(t, z.verzug, z.dauer), p = u < 0 ? 0 : u;
      const [op, sx, sy, ty] = ppKf(p, [[0, [0.82, 1, 1, 0]], [0.3, [1, 0.86, 1.18, -6]], [0.6, [0.7, 1.1, 0.9, 3]], [1, [0.82, 1, 1, 0]]], true);
      const bx = L + z.x / 100 * Wd - 8 / S + z.b / 2 / S, by = oben + z.y / 100 * hoch - 40 / S + z.h / S + ty / S;
      ppFx3Zunge(g, bx, by, z.b * sx / S, z.h * sy / S, z.hell ? RAMPE_HELL : RAMPE, op, t * 0.012 + z.x);
    }
    // Funken
    for (const f of FUNKEN) {
      const u = schleife(t, f.verzug, f.dauer);
      if (u < 0) continue;
      const e = ppFx3Aus(u), a = u < 0.18 ? u / 0.18 : 1 - (u - 0.18) / 0.82, x = L + f.x / 100 * Wd + f.drift * e / S, y = oben + f.y / 100 * hoch - 90 * e / S, n = f.g >= 3.5 ? 2 : 1;
      g.block(x - n, y - n, n + 2, n + 2, FUNKE_HOF, a * 0.35);
      g.block(x - n / 2, y - n / 2, n, n, FUNKE, a);
    }
  }, 2200, (p) => ({ breite: Math.max(320, window.innerWidth), hoehe: Math.max(240, window.innerHeight), ankerX: p.x, ankerY: p.y }), { z: 10100 });
})();

// ═════════════════════════════════════════════════════════════════
//  Fireball (`fireball`, Steam Dwarf Dragon Pilot, Green Dragoneer …) — Feuerball kommt von links oben (0–280 ms), schlaegt ein: Blitz (600 ms), drei Druckringe, Flammensplitter
//  und aufsteigender Rauch (bis ~2,3 s). Wie `FireballEffect`.
// ═════════════════════════════════════════════════════════════════
const ppFx3Fireball = (() => {
  const SCHEIN = ppFx3Farben(['#ff1a1a', '#ff491a', '#f8ca21', '#fff8e8']);
  const RING = ppHex('#f87420'), RINGAUSSEN = ppHex('#ff491a'), GRAU = ppHex('#535353'), DUNKEL = ppHex('#323232');
  const KOERPER = ppFx3Farben(['#ff1a1a', '#ff491a', '#ff8b1a', '#fad54a', '#f9ecb3']);
  const ZEIT = ppFx3Bezier(0.42, 0, 1, 1);
  return ppR1Leinwand((g, t, sz, tl) => {
    const S = PP_FX3_S, cx = sz.cx, cy = sz.cy, cw = tl.cw, ch = tl.ch;
    // Rauch (hinten)
    for (const s of tl.rauch) {
      const u = (t - s.delay) / s.dur;
      if (u < 0 || u > 1) continue;
      const e = ppFx3Aus(u), a = u < 0.3 ? 0.7 * u / 0.3 : 0.7 * (1 - (u - 0.3) / 0.7), rad = s.size / 2 * (0.5 + e) / S;
      g.disc(cx + s.dx * e / S, cy + s.dy * e / S, rad * 0.8, DUNKEL, a * 0.5); g.disc(cx + s.dx * e / S, cy + s.dy * e / S, rad * 0.5, GRAU, a * 0.6);
    }
    // anfliegender Feuerball + Schweif (0–280 ms)
    if (t < 300) {
      const u = Math.min(1, t / 280), e = ZEIT(u), sc = 0.4 + 1.2 * e, op = u < 0.3 ? u / 0.3 : 1;
      const hx = cx - 52 / S * (1 - e), hy = cy - 52 / S * (1 - e), R = 25 * sc / S;
      const tu = ppKf(u, [[0, [0.3, 0]], [0.5, [1, 0.9]], [1, [0.6, 0]]], true), L = 120 * tu[0] / S, ta = tu[1];
      ppR1Band(g, hx, hy, hx - L * 0.707, hy - L * 0.707, (k) => ({ w: Math.max(1, (10 / S) * (1 - 0.6 * k) + 2 * (1 - k)), c: k < 0.35 ? KOERPER[2] : k < 0.7 ? KOERPER[1] : KOERPER[0], a: (1 - k) * ta }), 1);
      if (u > 0.04) {
        g.disc(hx, hy, R * 1.05, KOERPER[0], op); g.disc(hx, hy, R * 0.85, KOERPER[1], op); g.disc(hx, hy, R * 0.62, KOERPER[2], op); g.disc(hx, hy, R * 0.42, KOERPER[3], op); g.disc(hx, hy, R * 0.2, KOERPER[4], op);
        for (let i = 0; i < 5; i++) { const w = ppFx3Grad(225 + (i - 2) * 22 + Math.sin(t * 0.03 + i) * 8), mitte = i === 2; g.line(hx + Math.cos(w) * R * 0.6, hy + Math.sin(w) * R * 0.6, hx + Math.cos(w) * R * (mitte ? 1.9 : 1.45), hy + Math.sin(w) * R * (mitte ? 1.9 : 1.45), i % 2 ? KOERPER[1] : KOERPER[2], op, mitte ? Math.max(1, Math.round(R / 6)) : 1); }
      }
    }
    // Einschlagblitz
    {
      const u = (t - 280) / 600;
      if (u >= 0 && u <= 1) { const [sc, op] = ppKf(u, [[0, [0.2, 0]], [0.2, [1, 1]], [0.6, [1.15, 0.7]], [1, [1.3, 0]]]); g.glow(cx, cy, cw * 0.6 * sc / S * 0.9, ch * 0.6 * sc / S * 0.9, SCHEIN, op); }
    }
    // Druckringe
    for (const r of tl.ringe) {
      const u = (t - r.delay) / r.dur;
      if (u < 0 || u > 1) continue;
      const e = ppFx3Aus(u), R = (8 + (r.maxSize - 8) * e) / 2 / S, a = u < 0.3 ? 0.8 * u / 0.3 : 0.8 * (1 - (u - 0.3) / 0.7);
      g.ring(cx, cy, R, R + 1, RINGAUSSEN, a * 0.6); g.ring(cx, cy, R - 1, R, RING, a);
    }
    // Splitter
    for (const s of tl.splitter) {
      const u = (t - s.delay) / s.dur;
      if (u < 0 || u > 1) continue;
      const e = ppFx3Aus(u), a = u < 0.25 ? u / 0.25 : 1 - (u - 0.25) / 0.75;
      ppFx3Flamme(g, cx + s.dx * e / S, cy + s.dy * e / S, s.size * (0.4 + 0.3 * e) / S, a, s.art);
    }
  }, 2400, (p) => { const R = Math.max(150, (p.w || 100) * 0.78 + 30); return { breite: R * 2, hoehe: R * 2 }; }, {
    vorbereiten: (sz) => ({
      cw: sz.props.w || 100, ch: sz.props.h || 140,
      ringe: [0, 1, 2].map(i => ({ delay: 280 + i * 90, dur: 500 + i * 50, maxSize: 140 + i * 40 })),
      splitter: Array.from({ length: ppFxN(22) }, () => {
        const w = Math.random() * Math.PI * 2, d = 40 + Math.random() * 60;
        return { dx: Math.cos(w) * d, dy: Math.sin(w) * d, size: 14 + Math.random() * 14, delay: 280 + Math.random() * 120, dur: 450 + Math.random() * 250, art: ppFx3Wahl(['f', 'f', 'k', 's']) };
      }),
      rauch: Array.from({ length: ppFxN(10) }, (_, i) => ({ dx: -25 + Math.random() * 50, dy: -(20 + Math.random() * 35), size: 20 + Math.random() * 20, delay: 500 + i * 60 + Math.random() * 80, dur: 800 + Math.random() * 400 })),
    }),
  });
})();

// ═════════════════════════════════════════════════════════════════
//  Stichflamme (`flame_jet`, Blind Destruction) — 26 Flammenzungen schiessen am Ankerpunkt auf (Mitte hoch, aussen niedrig), flackern und sinken, dazu Glutfunken und Hitzeflimmern am Fuss.
// ═════════════════════════════════════════════════════════════════
const ppFx3Stichflamme = (() => {
  const FUNKE = ppHex('#fbe181'), FUNKEHOF = ppHex('#f9ac20');
  const HITZE = ppFx3Farben(['#ff7d00', '#ff9b3a']);
  const FARBEN = ['#fad54a', '#ff9a1a', '#ff7d00', '#ff491a', '#f7f7ad'];
  return ppR1Leinwand((g, t, sz, tl) => {
    const S = PP_FX3_S, cx = sz.cx, cy = sz.cy;
    {
      const u = t / 760;
      if (u <= 1) { const [sx, op] = ppKf(u, [[0, [0.4, 0]], [0.25, [1.1, 1]], [1, [1.4, 0]]]); g.glow(cx, cy + 17 / S, 34 * sx / S, 11 / S, HITZE, op * 0.9, 0.9); }
    }
    for (const z of tl.zungen) {
      const u = (t - z.delay) / z.dur;
      if (u < 0 || u > 1) continue;
      const [sy, sx, ty, op] = ppKf(u, [[0, [0.15, 0.7, 18, 0]], [0.22, [1.05, 1, 0, 1]], [0.55, [0.92, 1.08, -4, 1]], [1, [0.25, 0.6, 6, 0]]]);
      ppFx3Zunge(g, cx + z.dx / S, cy + ty / S, Math.max(2, z.breite * sx / S), z.h * sy / S, z.rampe, op, t * 0.02 + z.dx);
    }
    for (const f of tl.funken) {
      const u = (t - f.delay) / f.dur;
      if (u < 0 || u > 1) continue;
      const e = ppFx3Aus(u), a = u < 0.2 ? u / 0.2 : 1 - (u - 0.2) / 0.8, n = f.size >= 5 ? 2 : 1, x = cx + f.dx * e / S, y = cy + (8 + (f.dy - 8) * e) / S;
      g.block(x - n, y - n, n + 2, n + 2, FUNKEHOF, a * 0.35); g.block(x - n / 2, y - n / 2, n, n, FUNKE, a);
    }
  }, 1150, { breite: 200, hoehe: 270, ankerY: 230 }, {
    vorbereiten: () => ({
      zungen: Array.from({ length: ppFxN(26) }, (_, i) => {
        const mitte = i / 25 - 0.5, hoehe = (1 - Math.abs(mitte) * 1.35) * (110 + Math.random() * 70);
        return { dx: mitte * 46, h: Math.max(26, hoehe), breite: 5 + Math.random() * 8, delay: Math.abs(mitte) * 90 + Math.random() * 60, dur: 520 + Math.random() * 260, rampe: PP_FX3_RAMPEN[ppFx3Wahl(FARBEN)] };
      }),
      funken: Array.from({ length: ppFxN(16) }, () => ({ dx: -26 + Math.random() * 52, dy: -(60 + Math.random() * 90), size: 3 + Math.random() * 4, delay: 120 + Math.random() * 260, dur: 420 + Math.random() * 300 })),
    }),
  });
})();

// ═════════════════════════════════════════════════════════════════
//  Flammenhieb (`flame_slash`, Thaw Blader) — gleissender Flammenstreifen schlaegt in 460 ms schraeg (-42°, von unten links nach oben rechts) durch das Ziel, Glutspur (ab 240 ms),
//  Aufprallblitz, Hitzeschein, Flammenzungen entlang der Bahn und Glut im Faecher.
// ═════════════════════════════════════════════════════════════════
const ppFx3Flammenhieb = (() => {
  const W = ppFx3Grad(-42), DX = Math.cos(W), DY = Math.sin(W);            // Bahnrichtung (nach oben rechts)
  const SCHLAG = ppFx3Bezier(0.2, 0.9, 0.3, 1);
  const SCHEIN = ppFx3Farben(['#b62600', '#ff491a', '#f9ac20']);
  const BLITZ = ppFx3Farben(['#ff491a', '#fad54a', '#fff8e8']);
  const KLINGE = [[0, null], [0.18, ['#ff9a1a', 0.2]], [0.46, ['#ffd066', 0.95]], [0.52, ['#fffbd2', 1]], [0.62, ['#ff8b1a', 0.85]], [0.82, ['#cc2b00', 0.5]], [1, null]].map(([k, v]) => [k, v && [ppHex(v[0]), v[1]]]);
  const SPUR = [[0, null], [0.18, ['#ff491a', 0.7]], [0.5, ['#ff9a1a', 0.95]], [0.82, ['#ff491a', 0.7]], [1, null]].map(([k, v]) => [k, v && [ppHex(v[0]), v[1]]]);
  const HOF = ppHex('#f87420');
  const farbeBei = (tab, k) => {
    for (let i = 1; i < tab.length; i++) if (k <= tab[i][0]) {
      const a = tab[i - 1], b = tab[i], f = (k - a[0]) / (b[0] - a[0]);
      if (!a[1] && !b[1]) return null;
      const c = (f < 0.5 ? a[1] : b[1]) || (a[1] || b[1]), wa = a[1] ? a[1][1] : 0, wb = b[1] ? b[1][1] : 0;
      return { c: c[0], a: wa + (wb - wa) * f };
    }
    return null;
  };
  const EMBER = ppFx3Farben(['#ffd066', '#ff8b1a', '#ff491a', '#f9ac20', '#f9ecb3']);
  return ppR1Leinwand((g, t, sz, tl) => {
    const S = PP_FX3_S, cx = sz.cx, cy = sz.cy, ww = tl.ww, hh = tl.hh, len = tl.len;
    // Hitzeschein
    {
      const u = (t - 60) / 620;
      if (u >= 0 && u <= 1) { const [sc, op] = ppKf(u, [[0, [0.45, 0]], [0.35, [1.05, 0.85]], [1, [1.45, 0]]]); g.glow(cx, cy, ww * 0.7 * sc / S * 0.9, hh * 0.65 * sc / S * 0.9, SCHEIN, op * 0.55, 1); }
    }
    // Glutspur
    {
      const u = (t - 240) / 680;
      if (u >= 0 && u <= 1) {
        const sx = ppR1Klemme(u / 0.22), op = ppKf(u, [[0, [0]], [0.22, [1]], [0.7, [0.95]], [1, [0]]], true)[0], L = ww * 1.2 * sx / S;
        if (L > 1) {
          ppR1Band(g, cx - DX * L / 2, cy - DY * L / 2, cx + DX * L / 2, cy + DY * L / 2, (k) => { const f = farbeBei(SPUR, k); return f && { w: 8, c: HOF, a: f.a * 0.4 }; }, op);
          ppR1Band(g, cx - DX * L / 2, cy - DY * L / 2, cx + DX * L / 2, cy + DY * L / 2, (k) => { const f = farbeBei(SPUR, k); return f && { w: 4, c: f.c, a: f.a }; }, op);
        }
      }
    }
    // Klinge
    {
      const u = t / 460;
      if (u <= 1) {
        const off = (-1.3 + 2.6 * SCHLAG(u)) * len / S, op = u < 0.25 ? u / 0.25 : 1 - (u - 0.25) / 0.75, mx = cx + DX * off, my = cy + DY * off, h = len / 2 / S;
        ppR1Band(g, mx - DX * h, my - DY * h, mx + DX * h, my + DY * h, (k) => { const f = farbeBei(KLINGE, k); return f && { w: 8, c: HOF, a: f.a * 0.45 }; }, op);
        ppR1Band(g, mx - DX * h, my - DY * h, mx + DX * h, my + DY * h, (k) => { const f = farbeBei(KLINGE, k); return f && { w: 4, c: f.c, a: f.a }; }, op);
      }
    }
    // Aufprallblitz
    {
      const u = (t - 200) / 400;
      if (u >= 0 && u <= 1) { const [sc, op] = ppKf(u, [[0, [0.25, 0]], [0.35, [1.5, 1]], [1, [2.6, 0]]]); g.glow(cx, cy, 16 * sc / S, 16 * sc / S, BLITZ, op, 0.8); }
    }
    // Flammenzungen entlang der Bahn
    for (const f of tl.flammen) {
      const u = (t - f.delay) / f.dur;
      if (u < 0 || u > 1) continue;
      const [ty, sc, op] = ppKf(u, [[0, [0, 0.4, 0]], [0.3, [-6, 1.15, 1]], [1, [-22, 0.8, 0]]]);
      const x = cx + (DX * f.startX - DY * ty) / S, y = cy + (DY * f.startX + DX * ty) / S - f.size * 0.35 / S;
      ppFx3Flamme(g, x, y, f.size * sc / S, op, f.art);
    }
    // Glut
    for (const e of tl.glut) {
      const u = (t - e.delay) / e.dur;
      if (u < 0 || u > 1) continue;
      const k = ppFx3Aus(u), a = u < 0.2 ? u / 0.2 : 1 - (u - 0.2) / 0.8, d = e.size * (1 - 0.8 * k) / S;
      ppFx3Punkt(g, cx + Math.cos(e.w) * e.dist * k / S, cy + Math.sin(e.w) * e.dist * k / S, Math.max(1, d), e.farbe, a);
    }
  }, 1250, (p) => { const ww = Math.max(p.w || 80, 80), hh = Math.max(p.h || 110, 110), R = Math.hypot(ww, hh) * 1.6 * 0.95 + 20; return { breite: R * 2, hoehe: R * 2 }; }, {
    vorbereiten: (sz) => {
      const ww = Math.max(sz.props.w || 80, 80), hh = Math.max(sz.props.h || 110, 110);
      return {
        ww, hh, len: Math.hypot(ww, hh) * 1.6,
        glut: Array.from({ length: ppFxN(16) }, () => ({ w: ppFx3Grad((Math.random() < 0.5 ? -42 : 138) + (-55 + Math.random() * 110)), dist: 36 + Math.random() * 50, size: 2 + Math.random() * 5, farbe: ppFx3Wahl(EMBER), delay: 200 + Math.random() * 200, dur: 380 + Math.random() * 260 })),
        flammen: Array.from({ length: ppFxN(8) }, (_, i) => ({ startX: -ww * 0.42 + ww * 0.84 * (i / 7), delay: 240 + i * 30 + Math.random() * 70, dur: 420 + Math.random() * 220, size: 18 + Math.random() * 10, art: ppFx3Wahl(['f', 'f', 's']) })),
      };
    },
  });
})();

// ═════════════════════════════════════════════════════════════════
//  Flammenwerfer (`flamethrower_douse`, Steam Dwarf Exterminator) — Blitz am Ziel (360 ms), 26 Feuerstrahlen schiessen von links durchs Ziel, danach bleiben Flammen auf dem Ziel
//  stehen und Glut steigt auf (bis ~1,5 s).
// ═════════════════════════════════════════════════════════════════
const ppFx3Flammenwerfer = (() => {
  const GLUT = ppFx3Farben(['#ff491a', '#ff8b1a', '#f9ac20', '#f8ca21']);
  const BLITZ = ppFx3Farben(['#ff491a', '#f9ac20', '#fff8e8']);
  const SPUR = ppFx3Farben(['#ff491a', '#ff8b1a', '#fad54a']);
  const WEG = ppFx3Bezier(0.2, 0.7, 0.4, 1);
  return ppR1Leinwand((g, t, sz, tl) => {
    const S = PP_FX3_S, cx = sz.cx, cy = sz.cy, cw = tl.cw, ch = tl.ch;
    {
      const u = t / 360;
      if (u <= 1) { const [sc, op] = ppKf(u, [[0, [0.3, 0]], [0.3, [1.1, 0.95]], [1, [1.4, 0]]]); g.glow(cx, cy, cw * 0.45 * sc / S * 0.9, ch * 0.45 * sc / S * 0.9, BLITZ, op, 0.9); }
    }
    for (const f of tl.glimm) {
      const u = (t - f.delay) / f.dur;
      if (u < 0 || u > 1) continue;
      const [ty, sc, op] = ppKf(u, [[0, [0, 0.5, 0]], [0.3, [-2, 1, 1]], [1, [-10, 0.7, 0]]]);
      ppFx3Flamme(g, cx + (f.x + f.size / 2) / S, cy + (f.y + f.size / 2 + ty) / S, f.size * sc / S, op, 'f');
    }
    for (const p of tl.strahlen) {
      const u = (t - p.delay) / p.dur;
      if (u < 0 || u > 1) continue;
      const e = WEG(u), a = u < 0.2 ? u / 0.2 : 1 - (u - 0.2) / 0.8, x = cx + (-cw * 0.7 + (p.endX + cw * 0.7) * e + p.size / 2) / S, y = cy + (p.endY + p.size / 2) / S;
      const L = Math.min(14, (p.size / S) * (0.6 + 0.8 * u) * 1.1 + 3 * (1 - u));
      for (let i = 1; i <= L; i++) g.put(x - i, y + (i % 3 === 0 ? 1 : 0) - 0.5, SPUR[i < L * 0.4 ? 2 : i < L * 0.75 ? 1 : 0], a * (1 - i / (L + 1)));
      ppFx3Flamme(g, x, y, p.size * (0.8 + 0.3 * u) / S, a, p.art);
    }
    for (const e of tl.glut) {
      const u = (t - e.delay) / e.dur;
      if (u < 0 || u > 1) continue;
      const k = ppFx3Aus(u), a = u < 0.2 ? u / 0.2 : 1 - (u - 0.2) / 0.8, n = e.size * (1 - 0.7 * k) >= 3 ? 2 : 1;
      g.block(cx + e.dx * k / S - n / 2, cy + e.dy * k / S - n / 2, n, n, e.farbe, a);
    }
  }, 1550, (p) => {
    const cw = p.w || 100, ch = p.h || 140, links = cw * 0.7 + 30, rechts = cw * 1.2 + 50, oben = Math.max(ch * 0.65, 110), unten = ch * 0.65 + 30;
    return { breite: links + rechts, hoehe: oben + unten, ankerX: links, ankerY: oben };
  }, {
    vorbereiten: (sz) => {
      const cw = sz.props.w || 100, ch = sz.props.h || 140;
      return {
        cw, ch,
        strahlen: Array.from({ length: ppFxN(26) }, (_, i) => ({ endX: -cw * 0.2 + Math.random() * cw * 1.4, endY: -ch * 0.15 + Math.random() * ch * 0.3, size: 14 + Math.random() * 16, delay: i * 18 + Math.random() * 40, dur: 280 + Math.random() * 160, art: ppFx3Wahl(['f', 'f', 'f', 'k', 's']) })),
        glimm: Array.from({ length: ppFxN(16) }, () => ({ x: -cw * 0.35 + Math.random() * cw * 0.7, y: -ch * 0.35 + Math.random() * ch * 0.7, size: 10 + Math.random() * 14, delay: 300 + Math.random() * 300, dur: 400 + Math.random() * 300 })),
        glut: Array.from({ length: ppFxN(14) }, () => { const w = -Math.PI / 2 + (Math.random() - 0.5) * 1.2, v = 30 + Math.random() * 50; return { dx: Math.cos(w) * v, dy: Math.sin(w) * v, size: 3 + Math.random() * 4, farbe: ppFx3Wahl(GLUT), delay: 350 + Math.random() * 250, dur: 500 + Math.random() * 400 }; }),
      };
    },
  });
})();

// ═════════════════════════════════════════════════════════════════
//  Flut (`flooding`, Flooding) — fensterfuellend: eine Wasserwand steigt von unten ueber das ganze Feld (0–28 %), steht (bis 72 %) und sinkt wieder ab (2400 ms insgesamt).
//  Wasser = Farbstufen hellblau → dunkelblau (gedithert) mit Schaumkrone und leicht wogender Oberkante; dazu Blasen (Ringe) und Spritzer (Tropfen-Sprites).
// ═════════════════════════════════════════════════════════════════
const ppFx3Flut = (() => {
  const WASSER = ppFx3Farben(['#7bbeea', '#4e77ca', '#0351c9', '#02398c']);
  const SCHAUM = ppHex('#ffffff'), SCHAUM2 = ppHex('#bddcef');
  const BLASE = ppHex('#b3d8f9'), BLASE_IN = ppHex('#399edf'), BLASE_LICHT = ppHex('#ffffff');
  const TROPFEN = { d: ppHex('#399edf'), m: ppHex('#66d9ff'), l: ppHex('#b3e8f9'), w: ppHex('#ffffff') };
  const TROPFEN_BILD = ['..d..', '.dmd.', '.dmd.', 'dmlmd', 'dmwmd', 'dmmmd', '.ddd.'];
  const STEIG = ppFx3Bezier(0.22, 0.61, 0.36, 1);
  // Stufe s (0..3) bei Tiefe f (Anteil der 130vh hohen Wassermasse): Stopps 0 / .22 / .55 / 1
  const stufeBei = (f) => (f < 0.22 ? f / 0.22 : f < 0.55 ? 1 + (f - 0.22) / 0.33 : 2 + (f - 0.55) / 0.45);
  return ppR1Leinwand((g, t, sz, tl) => {
    const S = PP_FX3_S, W = sz.gw, H = sz.gh, u = t / 2400, vh = tl.vh, vw = tl.vw;
    // Wasserstand: translateY(100% → 15% → 15% → 100%) der 130vh hohen Masse, Oberkante bei vh * (-0.3 + 1.3 p)
    let p;
    if (u < 0.28) p = 1 - 0.85 * STEIG(u / 0.28); else if (u <= 0.72) p = 0.15; else p = 0.15 + 0.85 * STEIG((u - 0.72) / 0.28);
    const hoeheMasse = 1.3 * H, oberkante = H * (-0.3 + 1.3 * p);
    if (p < 0.999) {
      for (let x = 0; x < W; x++) {
        const o = oberkante + Math.sin(x * 0.11 + t * 0.006) * 1.2 + Math.sin(x * 0.047 - t * 0.004) * 1.6, y0 = Math.max(0, Math.ceil(o));
        for (let y = y0; y < H; y++) {
          const d = y - o, f = d / hoeheMasse;
          const s = stufeBei(Math.min(1, f)), k = Math.floor(s), c = WASSER[Math.min(3, (s - k) > ppBayer(x, y) ? k + 1 : k)];
          let col = c;
          if (f < 0.08) {                                 // Schaumkrone: weiss .9 → .55 (3 %) → 0 (8 %)
            const fa = f < 0.03 ? 0.9 - 0.35 * (f / 0.03) : 0.55 * (1 - (f - 0.03) / 0.05);
            if (ppBayer(x + 1, y + 2) < fa) col = f < 0.012 ? SCHAUM : SCHAUM2;
          }
          g.put(x, y, col, 1);
        }
      }
    }
    // Blasen (steigen von unterhalb des Bildschirms)
    for (const b of tl.blasen) {
      const k = (t - b.delay) / b.dur;
      if (k < 0 || k > 1) continue;
      const [dx, dy, sc, op] = ppKf(k, [[0, [0, 0, 0.4, 0]], [0.14, [b.drift * 0.15, -50, 1, 1]], [0.85, [b.drift, -0.8 * vh, 1.05, 0.85]], [1, [b.drift, -0.95 * vh, 0.9, 0]]]);
      const d = b.size * sc / S, x = (b.x + dx) / S, y = (vh + b.size / 2 + dy) / S;
      if (y < -4 || y > H + 6) continue;
      if (d >= 3) { g.disc(x, y, d / 2 - 0.3, BLASE_IN, op * 0.35); g.ring(x, y, d / 2 - 1.4, d / 2 - 0.3, BLASE, op); g.put(x - d / 4, y - d / 4, BLASE_LICHT, op); }
      else g.block(x - 0.5, y - 0.5, 1, 1, BLASE, op);
    }
    // Spritzer (💧) nahe der steigenden Oberflaeche
    for (const s of tl.spritzer) {
      const k = (t - s.delay) / s.dur;
      if (k < 0 || k > 1) continue;
      const [ty, sc, op] = ppKf(k, [[0, [0, 0.5, 0]], [0.22, [-40, 1.15, 1]], [0.7, [-10, 1, 0.7]], [1, [10, 0.7, 0]]]);
      const gr = s.size * sc / S, n = Math.max(1, Math.round(gr / 7));
      ppFx3Bild(g, TROPFEN_BILD, TROPFEN, s.x / S - 2.5 * n, (0.12 * vh + ty) / S - 3.5 * n, n, op);
    }
  }, 2400, (p) => ({ breite: Math.max(320, window.innerWidth), hoehe: Math.max(240, window.innerHeight), ankerX: p.x, ankerY: p.y }), {
    z: 10200,
    vorbereiten: () => {
      const vw = window.innerWidth, vh = window.innerHeight;
      return {
        vw, vh,
        blasen: Array.from({ length: ppFxN(32) }, () => ({ x: Math.random() * vw, size: 8 + Math.random() * 24, delay: 250 + Math.random() * 1300, dur: 1200 + Math.random() * 900, drift: -60 + Math.random() * 120 })),
        spritzer: Array.from({ length: ppFxN(22) }, () => ({ x: Math.random() * vw, delay: 450 + Math.random() * 500, dur: 700 + Math.random() * 500, size: 18 + Math.random() * 22 })),
      };
    },
  });
})();

// ═════════════════════════════════════════════════════════════════
//  Forceful Revival (`gewaltsame_erweckung`) — der Crash an der Support Zone: gruengelber Aufprallblitz, Energiesaeule, zwei Druckringe, Brocken, Sterne und Staub (0–700 ms),
//  dazu Klang und Bildschirmwackeln (Nebenwirkung wie zuvor).
// ═════════════════════════════════════════════════════════════════
const ppFx3Erweckung = (() => {
  const SAEULE = ppFx3Farben(['#cbff66', '#b1ff1a', '#f7f7ad']);
  const BLITZ = ppFx3Farben(['#87cc00', '#cbff66', '#f8f8bd', '#ffffff']);
  const RING1 = ppHex('#fffbd2'), RING2 = ppHex('#cbff66');
  const TON = ppFx3Farben(['#6b4a2a', '#886c44', '#4a2a10', '#b29466']);
  const STAUB = ppHex('#ccb799'), STAUB2 = ppHex('#a89370'), FLUG = ppFx3Bezier(0.2, 0.7, 0.4, 1);
  const STERN = { W: ppHex('#fffbd2'), G: ppHex('#ffd066') };
  const mase = (p) => {
    const w = p.w || 70, h = p.h || 100, seite = Math.max(w * 1.7, 100) + 10;
    const oben = Math.max(h * 1.9, 110) + 10;
    return { breite: seite * 2, hoehe: oben + Math.max(h * 0.7, 80) + 30, ankerY: oben };
  };
  return ppR1Leinwand((g, t, sz, tl) => {
    const S = PP_FX3_S, cx = sz.cx, cy = sz.cy, w = tl.w, h = tl.h;
    let u = t / 520;
    if (u <= 1) { const [sc, op] = ppKf(u, [[0, [0.4, 0]], [0.12, [1.05, 1]], [1, [1.3, 0]]]); g.glow(cx, cy, w * 1.05 * sc / S * 0.72, h * 0.85 * sc / S * 0.72, BLITZ, op, 0.8); }
    u = t / 650;
    if (u <= 1) {
      const [sy, op] = ppKf(u, [[0, [0.05, 0]], [0.2, [1.05, 1]], [1, [1.1, 0]]]), Hn = Math.round(h * 2.1 * sy / S), y0 = cy + h * 0.5 / S, hw0 = w * 1.05 / 2 / S;
      for (let j = 0; j < Hn; j++) {
        const v = j / Math.max(1, Hn - 1);
        let hw = hw0 * (v > 0.65 ? Math.sqrt(Math.max(0, 1 - Math.pow((v - 0.65) / 0.35, 2))) : 1);
        hw = Math.max(0.5, hw + Math.sin(j * 0.6 + t * 0.02) * 0.8 * Math.min(1, v * 2));
        const al = op * (v < 0.4 ? 0.95 - 0.25 * v / 0.4 : v < 0.75 ? 0.7 - 0.35 * (v - 0.4) / 0.35 : 0.35 * (1 - (v - 0.75) / 0.25)), y = Math.round(y0 - j);
        for (let x = Math.round(cx - hw); x <= Math.round(cx + hw); x++) g.put(x, y, ppFx3Stufe(SAEULE, v, x, y), al);
      }
    }
    for (const r of [{ d: 0, c: RING1 }, { d: 90, c: RING2 }]) {
      u = (t - r.d) / 520;
      if (u < 0 || u > 1) continue;
      const sc = 0.25 + 1.65 * ppFx3Aus(u), op = u < 0.15 ? u / 0.15 : 1 - (u - 0.15) / 0.85, R = w * 0.8 * sc / S;
      g.ring(cx, cy, R, R + 1.4, RING2, op * 0.5); g.ring(cx, cy, R - 1, R, r.c, op);
    }
    for (const s of tl.staub) {
      u = (t - s.verzug) / 700;
      if (u < 0 || u > 1) continue;
      const [ty, sc, op] = ppKf(u, [[0, [0, 0.5, 0]], [0.3, [-5, 0.95, 1]], [1, [-16, 1.4, 0]]]), x = cx + s.dx / S, y = cy + (h * 0.32 + s.g * 0.35 + ty) / S;
      g.ell(x, y, s.g / 2 * sc / S, s.g * 0.35 * sc / S, STAUB2, op * 0.35); g.ell(x, y, s.g / 2 * sc / S * 0.75, s.g * 0.35 * sc / S * 0.75, STAUB, op * 0.6);
    }
    for (const b of tl.brocken) {
      u = t / 620;
      if (u > 1) break;
      const e = FLUG(u), n = Math.max(2, Math.round(b.g / S));
      g.block(cx + b.bx * e / S - n / 2, cy + b.by * e / S - n / 2, n, n, b.ton, 1 - u);
    }
    for (const s of tl.sterne) {
      u = (t - s.verzug) / 600;
      if (u < 0 || u > 1) continue;
      const e = ppFx3Aus(u), op = u < 0.25 ? u / 0.25 : 1 - (u - 0.25) / 0.75, gr = 12 * (0.4 + 0.7 * e) / S;
      g.spr(gr >= 3.5 ? PP_FX3_BILD.stern.map(z => z.replace(/Y/g, 'W')) : ['.W.', 'WGW', '.W.'], STERN, cx + Math.cos(s.w) * s.d * e / S, cy + Math.sin(s.w) * s.d * e / S, op);
    }
  }, 1050, mase, {
    vorbereiten: (sz) => {
      const w = sz.props.w || 70, h = sz.props.h || 100;
      return {
        w, h,
        brocken: Array.from({ length: ppFxN(14) }, (_, i) => { const a = ((i * 360) / 14 + (i % 3) * 9) * Math.PI / 180, d = 36 + (i % 4) * 14; return { bx: Math.cos(a) * d, by: Math.sin(a) * d - 14, g: 4 + (i % 3) * 2, ton: TON[i % 4] }; }),
        sterne: Array.from({ length: 8 }, (_, i) => ({ w: ppFx3Grad(i * 45 + 12), d: 44 + (i % 3) * 14, verzug: (i % 4) * 25 })),
        staub: Array.from({ length: ppFxN(6) }, (_, i) => ({ dx: (i - 2.5) * w * 0.28, g: w * (0.35 + (i % 3) * 0.1), verzug: 120 + i * 40 })),
      };
    },
    wirkung: () => {
      const spiel = (name, opts, at) => setTimeout(() => { if (window.playSFX) window.playSFX(name, { ...opts, dedupe: 0 }); }, at);
      spiel('heavy_impact', { rate: 0.85, volume: 1 }, 0);
      spiel('attack_ram', { rate: 0.7, volume: 0.7 }, 10);
      spiel('summon', { rate: 0.9, volume: 0.8 }, 40);
      spiel('elem_biomancy', { rate: 0.8, volume: 0.5 }, 90);
      const layout = document.querySelector('.game-layout');
      if (layout) { layout.classList.remove('pp-wackeln-stark'); void layout.offsetWidth; layout.classList.add('pp-wackeln-stark'); }
      const tm = setTimeout(() => layout && layout.classList.remove('pp-wackeln-stark'), 700);
      return () => clearTimeout(tm);
    },
  });
})();

// ═════════════════════════════════════════════════════════════════
//  Geschenkregen (`gift_shower`, Festive Werz) — neun bunte Paeckchen mit Schleife steigen ueber dem Ziel auf (je 1000 ms, gestaffelt), wachsen von .6 auf 1 und verblassen (Dither).
// ═════════════════════════════════════════════════════════════════
const ppFx3Geschenke = (() => {
  const PAKETE = Array.from({ length: ppFxN(9) }, (_, i) => ({
    x: -46 + i * 11 + (i % 3) * 4, groesse: 13 + (i % 4) * 4, farbe: i % 5, verzug: (i % 5) * 90, drift: -10 + (i % 4) * 7,
  }));
  const FARBE = ppFx3Farben(['#e94e53', '#2ca058', '#ffb91a', '#4e77ca', '#b278ed']);
  const DUNKEL = ppFx3Farben(['#b5171c', '#167927', '#c68206', '#2f539d', '#7a2bd0']);
  const HELL = ppFx3Farben(['#fe7476', '#5bbd7e', '#fff196', '#89abdc', '#c98aff']);
  const BAND = ppHex('#fff8e8'), KANTE = ppHex('#12101f');
  return ppR1Leinwand((g, t, sz) => {
    const S = PP_FX3_S, cx = sz.cx, cy = sz.cy;
    for (const p of PAKETE) {
      const u = (t - p.verzug) / 1000;
      if (u < 0 || u > 1) continue;
      const e = ppFx3Aus(u), op = u < 0.2 ? u / 0.2 : u < 0.55 ? 1 : 1 - (u - 0.55) / 0.45, sc = 0.6 + 0.4 * e;
      const n = Math.max(5, Math.round(p.groesse * sc / S * 1.25)), x0 = Math.round(cx + (p.x + p.drift * e) / S), y0 = Math.round(cy + (10 - 68 * e) / S);
      g.block(x0, y0, n, n, KANTE, op * 0.6);
      g.block(x0 + 1, y0 + 1, n - 2, n - 2, FARBE[p.farbe], op);
      g.block(x0 + 1, y0 + n - 2, n - 2, 1, DUNKEL[p.farbe], op);
      g.block(x0 + n - 2, y0 + 1, 1, n - 2, DUNKEL[p.farbe], op);
      g.block(x0 + 1, y0 + 1, n - 3, 1, HELL[p.farbe], op);
      const bw = n >= 9 ? 2 : 1, mm = Math.floor((n - bw) / 2);
      g.block(x0 + mm, y0 + 1, bw, n - 2, BAND, op * 0.9);
      if (n >= 7) g.block(x0 + 1, y0 + mm, n - 2, bw, BAND, op * 0.9);
      g.block(x0 + mm - 1, y0 - 1, bw + 2, 1, BAND, op);
    }
  }, 1400, { breite: 210, hoehe: 150, ankerY: 110 });
})();

// ═════════════════════════════════════════════════════════════════
//  Glasklingen-Bruch (`glass_blade_shatter`, Breaking Strike) — glasiger Streifen schlaegt schraeg (-32°) durchs Ziel (320 ms), Riss am Einschlag (ab 220 ms, 420 ms) und 22 Scherben,
//  die auseinanderfliegen und fallen (ab 140 ms, 620–1140 ms). Scherben = kleine drehende Pixelstriche.
// ═════════════════════════════════════════════════════════════════
const ppFx3Glasbruch = (() => {
  const W = ppFx3Grad(-32), DX = Math.cos(W), DY = Math.sin(W);
  const SCHLAG = ppFx3Bezier(0.2, 0.7, 0.3, 1), SCHERBE = ppFx3Bezier(0.25, 0.6, 0.5, 1);
  const GLAS = ppHex('#e5f5fa'), WEISS = ppHex('#ffffff'), HOF = ppHex('#b3e8f9'), TIEF = ppHex('#77c8ee');
  const RISS = ppFx3Farben(['#b3e8f9', '#e5f5fa', '#ffffff']);
  const SC = [WEISS, HOF, TIEF, GLAS];
  return ppR1Leinwand((g, t, sz, tl) => {
    const S = PP_FX3_S, cx = sz.cx, cy = sz.cy, ww = tl.ww;
    // Riss
    {
      const u = (t - 220) / 420;
      if (u >= 0 && u <= 1) {
        const [sc, op] = ppKf(u, [[0, [0.2, 0]], [0.3, [1, 1]], [1, [1.5, 0]]]), R = ww * 0.3 * sc / S;
        g.glow(cx, cy, R * 0.72, R * 0.72, RISS, op);
        for (const w of tl.risse) g.line(cx + Math.cos(w) * R * 0.15, cy + Math.sin(w) * R * 0.15, cx + Math.cos(w) * R * 1.05, cy + Math.sin(w) * R * 1.05, WEISS, op * 0.9, 1);
      }
    }
    // Klinge
    {
      const u = t / 320;
      if (u <= 1) {
        const B = SCHLAG(u), off = (-0.6 + 0.9 * B) * ww * 1.9 / S, len = ww * 1.9 * (0.4 + 0.75 * B) / S, op = u < 0.35 ? u / 0.35 : 1 - (u - 0.35) / 0.65;
        const mx = cx + DX * off, my = cy + DY * off, h = len / 2;
        const prof = (k) => Math.min(1, (1 - Math.abs(k - 0.5) * 2) * 1.5);
        ppR1Band(g, mx - DX * h, my - DY * h, mx + DX * h, my + DY * h, (k) => ({ w: 8, c: HOF, a: prof(k) * 0.45 }), op);
        ppR1Band(g, mx - DX * h, my - DY * h, mx + DX * h, my + DY * h, (k) => ({ w: 4, c: Math.abs(k - 0.5) < 0.07 ? WEISS : GLAS, a: prof(k) }), op);
      }
    }
    // Scherben
    for (const s of tl.scherben) {
      const u = (t - s.delay) / s.dur;
      if (u < 0 || u > 1) continue;
      const e = SCHERBE(u), op = u < 0.15 ? u / 0.15 : 1 - (u - 0.15) / 0.85, w = ppFx3Grad(s.kippen + s.dreh * e), L = s.laenge * (1.1 - 0.35 * e) / S, x = cx + s.dx * e / S, y = cy + s.dy * e / S;
      const hx = Math.cos(w) * L / 2, hy = Math.sin(w) * L / 2;
      g.line(x - hx, y - hy, x + hx, y + hy, s.farbe, op, s.breite >= 4.5 ? 2 : 1);
      g.put(x + hx, y + hy, WEISS, op);
    }
  }, 1500, (p) => { const ww = Math.max(p.w || 80, 80), hh = Math.max(p.h || 110, 110), rx = ww * 1.5 + 20, ry = Math.max(hh * 0.9 + ww * 0.5, ww * 1.1) + 20; return { breite: rx * 2, hoehe: ry * 2 }; }, {
    z: 10160,
    vorbereiten: (sz) => {
      const ww = Math.max(sz.props.w || 80, 80), hh = Math.max(sz.props.h || 110, 110);
      return {
        ww,
        risse: Array.from({ length: 8 }, (_, i) => ppFx3Grad(i * 45 + Math.random() * 30)),
        scherben: Array.from({ length: ppFxN(22) }, () => {
          const w = Math.random() * Math.PI * 2, weite = ww * (0.35 + Math.random() * 0.85);
          return { dx: Math.cos(w) * weite, dy: Math.sin(w) * weite * 0.55 + hh * (0.3 + Math.random() * 0.4), laenge: 6 + Math.random() * 14, breite: 2 + Math.random() * 5, dreh: -540 + Math.random() * 1080, dur: 620 + Math.random() * 520, delay: 140 + Math.random() * 220, kippen: Math.random() * 360, farbe: ppFx3Wahl(SC) };
        }),
      };
    },
  });
})();

ppFxUeberschreiben('explosion', ppFx3Explosion);
ppFxUeberschreiben('demon_fire_pillar', ppFx3FeuerSaeule);
ppFxUeberschreiben('druid_leaf_storm', ppFx3Laubsturm);
ppFxUeberschreiben('elephant_stomp', ppFx3Elefant);
ppFxUeberschreiben('fire_sweep', ppFx3FeuerWalze);
ppFxUeberschreiben('fireball', ppFx3Fireball);
ppFxUeberschreiben('flame_jet', ppFx3Stichflamme);
ppFxUeberschreiben('flame_slash', ppFx3Flammenhieb);
ppFxUeberschreiben('flamethrower_douse', ppFx3Flammenwerfer);
ppFxUeberschreiben('flooding', ppFx3Flut);
ppFxUeberschreiben('gewaltsame_erweckung', ppFx3Erweckung);
ppFxUeberschreiben('gift_shower', ppFx3Geschenke);
ppFxUeberschreiben('glass_blade_shatter', ppFx3Glasbruch);
