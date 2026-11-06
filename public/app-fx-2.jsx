// Pixelart-Portierungen (Canvas), Batch 2: siehe app-fx-0.jsx. Jede Portierung: `ppFxUeberschreiben('typ', Komponente)`.
// Hier: cold_coffin_encase, concert_revival, coolness_summon, core_explosion, corpse_explosion, cute_hearts, dark_blast, decapitation, deep_sea_bubbles, deepsea_idol_negate,
//       deepsea_spores_growth, deepsea_spores_rain, deepsea_summon_whirlpool.
// Alle Effekte laufen auf EINER Leinwand (ppR1Leinwand, 1 Rasterpixel = 3 Bildschirmpixel, 30 Bilder/s) mit denselben Ankern, Zeiten und Zahlen wie die DOM-Fassungen in `ANIM_REGISTRY`
// (app-board.jsx, Keyframes in style.css). Pixelart-Regeln: nur Palettenfarben, Deckung < 1 = Bayer-Dithering, keine Unschärfe/Verläufe, keine Drehung von Bildern (Drehungen nur als
// berechnete Geometrie: Linien, Bögen), Symbole (Noten, Schneeflocken, Totenkopf, Blätter …) als kleine Sprites statt Schrift-Zeichen.

// ═════════════════════════════════════════════════════════════════
//  Bausteine (Präfix ppFx2 / PP_FX2)
// ═════════════════════════════════════════════════════════════════
/** CSS-cubic-bezier als Funktion x → y (für Keyframe-Abschnitte; ppKf bekommt sie als `ease`). */
function ppFx2Bez(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t) => ((ax * t + bx) * t + cx) * t, sy = (t) => ((ay * t + by) * t + cy) * t;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const e = sx(t) - x;
      if (Math.abs(e) < 1e-4) return sy(t);
      const d = (3 * ax * t + 2 * bx) * t + cx;
      if (Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    let lo = 0, hi = 1;
    t = x;
    for (let i = 0; i < 24; i++) { if (sx(t) > x) hi = t; else lo = t; t = (lo + hi) / 2; }
    return sy(t);
  };
}
const PP_FX2_E = { aus: ppFx2Bez(0, 0, 0.58, 1), ein: ppFx2Bez(0.42, 0, 1, 1), eio: ppFx2Bez(0.42, 0, 0.58, 1), ease: ppFx2Bez(0.25, 0.1, 0.25, 1) };
/** Verlauf als Palettenrampe: stops [[Lage 0..1, [r,g,b], Deckung]]; n+1 Einträge, Farben auf die 256er-Palette gerastet. */
function ppFx2Rampe(stops, n) {
  n = n || 32;
  const c = [], a = [];
  for (let k = 0; k <= n; k++) {
    const f = k / n;
    let i = 0;
    while (i < stops.length - 2 && f > stops[i + 1][0]) i++;
    const s0 = stops[i], s1 = stops[Math.min(i + 1, stops.length - 1)];
    const u = s1[0] > s0[0] ? ppR1Klemme((f - s0[0]) / (s1[0] - s0[0])) : 0;
    c.push(ppSzeneFarbe([0, 1, 2].map((q) => s0[1][q] + (s1[1][q] - s0[1][q]) * u)));
    a.push(s0[2] + (s1[2] - s0[2]) * u);
  }
  return { c, a, n };
}
const PP_FX2_RC = {};
/** Zwischengespeicherte Rampe (erst beim ersten Bild gebaut, damit die Palette sicher geladen ist). */
const ppFx2R = (name, stops, n) => PP_FX2_RC[name] || (PP_FX2_RC[name] = ppFx2Rampe(stops, n));
/** Index in die Rampe zur Lage f (0..1) mit Bayer-Dithering zwischen zwei Stufen. */
function ppFx2Stufe(r, f, X, Y) {
  const s = (f >= 1 ? 1 : f < 0 ? 0 : f) * r.n, k = Math.floor(s);
  return (s - k) > ppBayer(X + 1, Y + 2) ? Math.min(r.n, k + 1) : k;
}
/** Verlaufsscheibe (Ellipse rx × ry, Verlaufsradius gx × gy): Farbe und Deckung aus der Rampe, Deckung × a. */
function ppFx2Verlauf(g, cx, cy, rx, ry, gx, gy, r, a) {
  if (rx <= 0 || ry <= 0 || a <= 0) return;
  cx = Math.round(cx); cy = Math.round(cy);
  const RX = Math.ceil(rx), RY = Math.ceil(ry), ix = 1 / gx, iy = 1 / gy, ax = rx * rx + rx * 0.6, ay = ry * ry + ry * 0.6;
  for (let j = -RY; j <= RY; j++) {
    for (let i = -RX; i <= RX; i++) {
      if ((i * i) / ax + (j * j) / ay > 1) continue;
      const X = cx + i, Y = cy + j, idx = ppFx2Stufe(r, Math.sqrt(i * i * ix * ix + j * j * iy * iy), X, Y), al = r.a[idx] * a;
      if (al > 0) g.put(X, Y, r.c[idx], al);
    }
  }
}
/** Gefülltes Rechteck mit Verlauf um (gcx, gcy) (Verlaufsradius gx × gy). */
function ppFx2Fuell(g, x0, y0, w, h, gcx, gcy, gx, gy, r, a) {
  if (a <= 0) return;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      if ((i === 0 || i === w - 1) && (j === 0 || j === h - 1)) continue;
      const X = x0 + i, Y = y0 + j, dx = (X - gcx) / gx, dy = (Y - gcy) / gy, idx = ppFx2Stufe(r, Math.sqrt(dx * dx + dy * dy), X, Y), al = r.a[idx] * a;
      if (al > 0) g.put(X, Y, r.c[idx], al);
    }
  }
}
/** Ring: außen r1, Dicke in Rasterpixeln; läuft nur über die Ringzeilen (auch für Radien über 100 Rasterpixel billig). */
function ppFx2Ring(g, cx, cy, r1, dicke, c, a) {
  if (r1 <= 0 || a <= 0) return;
  cx = Math.round(cx); cy = Math.round(cy);
  const r0 = Math.max(0, r1 - Math.max(1, dicke)), o2 = r1 * r1 + r1 * 0.6, i2 = r0 > 0 ? r0 * r0 + r0 * 0.6 : -1, R = Math.ceil(r1);
  for (let j = -R; j <= R; j++) {
    const jj = j * j;
    if (jj > o2) continue;
    const xo = Math.floor(Math.sqrt(o2 - jj)), xi = i2 > jj ? Math.floor(Math.sqrt(i2 - jj)) : -1;
    for (let i = -xo; i <= xo; i++) {
      if (xi >= 0 && i >= -xi && i <= xi) { i = xi; continue; }
      g.put(cx + i, cy + j, c, a);
    }
  }
}
/** Sprite mit ganzzahliger Vergrößerung m, Mittelpunkt (cx, cy). */
function ppFx2Spr(g, zeilen, pal, cx, cy, m, a) {
  const h = zeilen.length, w = zeilen[0].length, x0 = Math.round(cx - (w * m) / 2), y0 = Math.round(cy - (h * m) / 2);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const c = pal[zeilen[j][i]]; if (c) g.block(x0 + i * m, y0 + j * m, m, m, c, a); }
}
/** Symbol in Wunschhöhe `px` (Bildschirmpixel): winzig → Punkt, sonst Sprite 1× oder 2×. */
function ppFx2Glyphe(g, zeilen, pal, cx, cy, px, a, punkt) {
  const r = px / (zeilen.length * 3);
  if (r < 0.4) { if (px >= 4 && punkt) g.block(Math.round(cx) - 1, Math.round(cy) - 1, 2, 2, punkt, a); return; }
  ppFx2Spr(g, zeilen, pal, cx, cy, r < 1.6 ? 1 : 2, a);
}
/** Blase: Durchmesser d (Rasterpixel); Rand, getupfte Füllung (Dither) und ein Glanzpunkt. pal = { rand, fuell, glanz, fa? (Fülldeckung) }. */
function ppFx2Blase(g, cx, cy, d, a, pal) {
  cx = Math.round(cx); cy = Math.round(cy);
  if (d <= 1.5) { g.put(cx, cy, pal.rand, a); return; }
  const r = d / 2;
  g.disc(cx, cy, r, pal.fuell, (pal.fa || 0.4) * a);
  if (d >= 3) g.ring(cx, cy, r - 1, r, pal.rand, a); else g.disc(cx, cy, r, pal.rand, a * 0.8);
  if (d >= 4) g.put(cx - Math.round(r * 0.4), cy - Math.round(r * 0.4), pal.glanz, a);
}
/** Herz (Breite w Rasterpixel) mit Rand, Glanz und Schatten — Pixelart, nicht gedreht; Deckung a wird gedithert. */
function ppFx2Herz(g, cx, cy, w, a) {
  cx = Math.round(cx); cy = Math.round(cy);
  const hw = Math.max(1.2, w / 2), R = Math.ceil(hw * 1.15) + 1;
  const innen = (i, j) => { const x = (i / hw) * 1.15, y = -(j / hw) * 1.15 + 0.12, q = x * x + y * y - 1; return q * q * q - x * x * y * y * y <= 0; };
  const rand = ppHex('#780014'), koerper = ppHex('#b21a29'), licht = ppHex('#e73b41'), schatten = ppHex('#8c0014'), schein = ppHex('#b21a29');
  for (let j = -R; j <= R; j++) {
    for (let i = -R; i <= R; i++) {
      if (!innen(i, j)) {
        if (innen(i - 1, j) || innen(i + 1, j) || innen(i, j - 1) || innen(i, j + 1)) g.put(cx + i, cy + j, schein, a * 0.4);   // harter Schein statt Schatten-Weichzeichner
        continue;
      }
      const kante = !(innen(i - 1, j) && innen(i + 1, j) && innen(i, j - 1) && innen(i, j + 1));
      let c;
      if (hw < 3) c = kante ? rand : koerper;
      else {
        const x = (i / hw) * 1.15, y = -(j / hw) * 1.15 + 0.12;
        c = kante ? rand : (Math.hypot(x + 0.5, y - 0.55) < 0.3 ? licht : (x - y > 1.05 ? schatten : koerper));
      }
      g.put(cx + i, cy + j, c, a);
    }
  }
}
/** Wie ppR1Leinwand (app-board.jsx), reicht aber den Bildpuffer (RGBA-Bytes) als 5. Argument an `malen` weiter: Vollbild-Ebenen (Vignette, Feuerball, Weißblitz) schreiben darin direkt statt über
 *  100 000 g.put-Aufrufe je Bild (das waren sonst ~100 ms je Bild). Die Wurzel ist dieselbe (`data-pp-px="aus"`, 30 Bilder/s auf dem globalen Raster, pixelated). */
function ppFx2Leinwand(malen, ende, mass, opt) {
  const o = opt || {}, S = 3, TAKT = 1000 / 30;
  return function Fx2Effekt(props) {
    const cvs = React.useRef(null);
    const m = React.useMemo(() => {
      const q = typeof mass === 'function' ? mass(props) : mass;
      const breite = Math.ceil(q.breite / S) * S, hoehe = Math.ceil(q.hoehe / S) * S;
      return { breite, hoehe, ax: q.ankerX != null ? q.ankerX : breite / 2, ay: q.ankerY != null ? q.ankerY : hoehe / 2 };
    }, []);
    const sz = React.useMemo(() => {
      const lx = Math.round(props.x - m.ax), ly = Math.round(props.y - m.ay);
      return { gw: m.breite / S, gh: m.hoehe / S, cx: (props.x - lx) / S, cy: (props.y - ly) / S, S, lx, ly, hw: ((props.w || 64) / S) / 2, hh: ((props.h || 90) / S) / 2, props };
    }, []);
    const teile = React.useMemo(() => (o.vorbereiten ? o.vorbereiten(sz) : null), []);
    React.useEffect(() => {
      const el = cvs.current;
      if (!el || window._playAnimations === false) return undefined;
      const ctx = el.getContext('2d');
      const img = ctx.createImageData(sz.gw, sz.gh);
      const g = ppR1Pinsel(img.data, sz.gw, sz.gh);
      const t0 = performance.now();
      let raf = 0, letzte = -1;
      const takt = window.ppTaktRaf || window.requestAnimationFrame;
      const schritt = (jetzt) => {
        if (typeof jetzt !== 'number') jetzt = performance.now();
        const t = jetzt - t0, fr = Math.floor(jetzt / TAKT);
        if (fr !== letzte) { letzte = fr; img.data.fill(0); malen(g, Math.max(0, t), sz, teile, img.data); ctx.putImageData(img, 0, 0); }
        if (t < ende) raf = takt(schritt);
        else { img.data.fill(0); ctx.putImageData(img, 0, 0); }
      };
      raf = takt(schritt);
      return () => cancelAnimationFrame(raf);
    }, []);
    return (
      <div aria-hidden="true" data-pp-px="aus" style={{ position: 'fixed', left: sz.lx, top: sz.ly, pointerEvents: 'none', zIndex: o.z || 10100 }}>
        <canvas ref={cvs} width={sz.gw} height={sz.gh} style={{ width: m.breite, height: m.hoehe, imageRendering: 'pixelated', display: 'block' }} />
      </div>
    );
  };
}
/** Je Rasterpixel zwei Bayer-Schwellen (Float32): [0] für die Deckung, [1] (um (1, 2) verschoben) für den Farbwechsel zwischen Rampenstufen. */
function ppFx2Schwellen(gw, gh) {
  const a = new Float32Array(gw * gh), b = new Float32Array(gw * gh);
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) { a[j * gw + i] = ppBayer(i, j); b[j * gw + i] = ppBayer(i + 1, j + 2); }
  return [a, b];
}
/** Vollbild-Maß: die Leinwand deckt das Fenster ab; (x, y) der Animation liegt im Bild an der richtigen Stelle (Welt-Versatz eingerechnet). */
function ppFx2Voll(p) {
  const v = ppR1FeldVersatz(p);
  return { breite: Math.max(320, window.innerWidth), hoehe: Math.max(240, window.innerHeight), ankerX: p.x - v.dx, ankerY: p.y - v.dy };
}
/** Lineare Zufallsreihe (feste Saat → jedes Mal dasselbe Bild, wie die alten Module-Konstanten). */
function ppFx2Zufall(start) { let t = start >>> 0; return () => { t = (t * 1664525 + 1013904223) >>> 0; return t / 4294967296; }; }
const ppFx2Z = (a, b) => a + Math.random() * (b - a);
const ppFx2Wahl = (liste) => liste[Math.floor(Math.random() * liste.length)];

// ═════════════════════════════════════════════════════════════════
//  1. Cold Coffin (`cold_coffin_encase`) — Eisplatten von allen vier Seiten, Frostnebel, Einschlagblitz, Schneeflocken
//  Zeiten wie vorher: Nebel 250–1250 ms; Platten 400 ms (Verzug 0/40/80/120) fahren zur Mitte; Blitz ab 380 ms (350 ms); Flocken ab 550–950 ms (700–1200 ms Fall). Die Platten bleiben stehen (bis zum Ende der Animation).
// ═════════════════════════════════════════════════════════════════
const PP_FX2_FLOCKE = { gross: ['W.W.W', '.WWW.', '..W..', '.WWW.', 'W.W.W'], plus: ['.W.', 'WWW', '.W.'], stern: ['..W..', '..W..', 'WWWWW', '..W..', '..W..'] };
PP_FX2_E.slab = ppFx2Bez(0.25, 0.9, 0.35, 1);
const ppFx2ColdCoffin = ppR1Leinwand((g, t, sz, T) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, cw = T.cw, ch = T.ch, E = PP_FX2_E;
  const hell = ppHex('#e5edfa'), mitte = ppHex('#bddcef'), blau = ppHex('#b4dff8'), weiss = ppHex('#ffffff');
  // Frostnebel (pastellblau-weißer Dunst über dem Ziel)
  const fk = (t - 250) / 1000;
  if (fk > 0) {
    const fo = ppKf(Math.min(1, fk), [[0, [0]], [0.4, [1]], [1, [0.85]]], E.ein)[0];
    const hw = Math.round((cw + 20) / 2 / S), hh = Math.round((ch + 20) / 2 / S);
    ppFx2Fuell(g, Math.round(cx) - hw, Math.round(cy) - hh, hw * 2, hh * 2, cx, cy, hw * 1.414, hh * 1.414,
      ppFx2R('coldfog', [[0, [229, 245, 250], 0.7], [0.5, [189, 220, 239], 0.5], [0.9, [180, 223, 248], 0.2], [1, [180, 223, 248], 0]]), fo);
  }
  // Die vier dicken Eisplatten (Bänder in drei Farben, weißer Rand, harter blauer Schein)
  T.platten.forEach((p) => {
    const k = (t - p.d) / 400;
    if (k <= 0) return;
    const kk = Math.min(1, k), e = E.slab(kk), op = ppKf(kk, [[0, [0]], [0.3, [1]], [1, [1]]], E.slab)[0];
    const px = p.sx + (p.ex - p.sx) * e, py = p.sy + (p.ey - p.sy) * e;
    const w = Math.max(3, Math.round(p.w / S)), h = Math.max(3, Math.round(p.h / S));
    const x0 = Math.round(cx + px / S - w / 2), y0 = Math.round(cy + py / S - h / 2);
    g.block(x0 - 1, y0 - 1, w + 2, h + 2, blau, 0.35 * op);
    const far = p.farben.map((f) => (f === 'h' ? hell : f === 'm' ? mitte : blau));
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const rand = i === 0 || j === 0 || i === w - 1 || j === h - 1;
        const u = p.quer ? i / w : j / h;
        g.put(x0 + i, y0 + j, rand ? weiss : far[Math.min(2, Math.floor(u * 3))], op * (rand ? 0.75 : 1));
      }
    }
  });
  // Einschlagblitz in der Mitte (380 ms ab, 350 ms): Größe .3 → 1,2 → 2, Deckung 0 → 1 → 0
  const bk = (t - 380) / 350;
  if (bk >= 0 && bk <= 1) {
    const [sc, op] = ppKf(bk, [[0, [0.3, 0]], [0.3, [1.2, 1]], [1, [2, 0]]], E.aus), R = (50 * sc) / S;
    g.glow(cx, cy, R, R, [blau, hell, weiss], op * 0.9, 1.1);
  }
  // Schneeflocken fallen nach dem Einschlag
  T.flocken.forEach((s) => {
    const k = (t - s.delay) / s.dur;
    if (k < 0 || k > 1) return;
    const y = s.y0 + (s.y1 - s.y0) * E.ein(k), op = ppKf(k, [[0, [0]], [0.15, [1]], [0.85, [1]], [1, [0]]], E.ein)[0];
    ppFx2Spr(g, s.size > 11 ? PP_FX2_FLOCKE[s.stern ? 'stern' : 'gross'] : PP_FX2_FLOCKE.plus, { W: s.stern ? weiss : hell }, cx + s.x / S, cy + y / S, 1, op);
  });
}, 3000, (p) => {
  const cw = p.w || 100, ch = p.h || 140;
  return { breite: Math.ceil(Math.max(cw * 1.5, 120) + 14) * 2, hoehe: Math.ceil(Math.max(ch * 1.5, 120) + 14) * 2 };
}, {
  z: 10100,
  vorbereiten: (sz) => {
    const cw = sz.props.w || 100, ch = sz.props.h || 140;
    return {
      cw, ch,
      platten: [
        { w: cw * 0.95, h: ch * 0.4, sx: 0, sy: -ch * 1.2, ex: 0, ey: -ch * 0.25, d: 0, quer: false, farben: ['h', 'm', 'h'] },
        { w: cw * 0.95, h: ch * 0.4, sx: 0, sy: ch * 1.2, ex: 0, ey: ch * 0.25, d: 40, quer: false, farben: ['h', 'm', 'h'] },
        { w: cw * 0.35, h: ch * 0.75, sx: -cw * 1.2, sy: 0, ex: -cw * 0.3, ey: 0, d: 80, quer: true, farben: ['m', 'b', 'h'] },
        { w: cw * 0.35, h: ch * 0.75, sx: cw * 1.2, sy: 0, ex: cw * 0.3, ey: 0, d: 120, quer: true, farben: ['h', 'b', 'm'] },
      ],
      flocken: Array.from({ length: ppFxN(14) }, () => ({
        x: -cw / 2 + Math.random() * cw, y0: -ch / 2 - 20, y1: ch / 2 + Math.random() * 20, size: ppFx2Z(8, 16), delay: ppFx2Z(550, 950), dur: ppFx2Z(700, 1200), stern: Math.random() < 0.3,
      })),
    };
  },
});

// ═════════════════════════════════════════════════════════════════
//  2. Konzert (`concert_revival`, Hymn of Rebirth) — Lichtkegel von oben (1800 ms), fünf pendelnde Strahlen, goldener Puls, aufsteigende Noten (Sprites).
//  Die Klangserie (Glocken-Melodie, Tusch, Chor) bleibt unverändert in der Hülle unten.
// ═════════════════════════════════════════════════════════════════
const PP_FX2_NOTEN = {
  achtel: ['...X..', '...XX.', '...X.X', '...X..', '...X..', '.XXX..', 'XXXX..', '.XX...'],
  viertel: ['...X.', '...X.', '...X.', '...X.', '...X.', '.XXX.', 'XXXX.', '.XX..'],
  sechzehn: ['..XXXXX.', '..X...X.', '..X...X.', '..X...X.', '.XX..XX.', 'XXX.XXX.', 'XXX.XXX.', '.X...X..'],
  doppel: ['..XXXXX.', '..XXXXX.', '..X...X.', '..X...X.', '.XX..XX.', 'XXX.XXX.', 'XXX.XXX.', '.X...X..'],
  be: ['.X...', '.X...', '.X...', '.XXX.', '.X..X', '.X..X', '.XXX.'],
  kreuz: ['..X.X.', '..X.X.', 'XXXXXX', '..X.X.', '..X.X.', 'XXXXXX', '..X.X.', '..X.X.'],
};
const ppFx2KonzertLeinwand = ppR1Leinwand((g, t, sz, T) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, w = T.w, h = T.h, E = PP_FX2_E;
  const dunkel = ppHex('#c79e05');
  // Lichtkegel (1800 ms): wächst von oben nach unten, Verlauf Hellgelb → Gold → weg (Dither)
  if (t < 1800) {
    const [sy, op] = ppKf(t / 1800, [[0, [0, 0]], [0.2, [1, 1]], [0.8, [1, 0.85]], [1, [1.05, 0]]], E.aus);
    const r = ppFx2R('konzertkegel', [[0, [255, 241, 150], 0.95], [0.55, [250, 213, 74], 0.45], [1, [250, 213, 74], 0]]);
    const cwr = (w * 2.4) / S, hr = (h * 2.2) / S, hsc = hr * sy, top = cy - hr * 1.05;
    for (let rr = 0; rr < Math.ceil(hsc); rr++) {
      const v = rr / Math.max(1, hsc), half = (0.08 + 0.42 * v) * cwr;
      for (let i = -Math.round(half); i <= Math.round(half); i++) {
        const X = Math.round(cx + i), Y = Math.round(top + rr), idx = ppFx2Stufe(r, v, X, Y);
        g.put(X, Y, r.c[idx], r.a[idx] * op);
      }
    }
  }
  // fünf Strahlen pendeln um die Senkrechte (Linien, Pixelketten)
  T.strahlen.forEach((b) => {
    const k = (t - b.delay) / 1600;
    if (k < 0 || k > 1) return;
    const [ang, sc, op] = ppKf(k, [[0, [b.angle, 0.2, 0]], [0.25, [b.angle, 1, 0.9]], [0.55, [-b.angle, 1, 0.6]], [1, [b.angle, 1, 0]]], E.eio);
    const wk = (ang * Math.PI) / 180, dx = Math.sin(wk), dy = -Math.cos(wk), L = (260 * sc) / S;
    ppR1Band(g, cx, cy, cx + dx * L, cy + dy * L, (u) => (u < 0.25 ? { w: 2, c: ppHex('#ffffff'), a: 0.9 } : u < 0.55 ? { w: 2, c: ppHex('#f9ecb3'), a: 0.65 } : u < 0.8 ? { w: 2, c: ppHex('#fad54a'), a: 0.4 } : { w: 1.5, c: ppHex('#fad54a'), a: 0.2 }), op);
  });
  // goldener Puls (ab 250 ms, 1400 ms)
  const pk = (t - 250) / 1400;
  if (pk >= 0 && pk <= 1) {
    const [sc, op] = ppKf(pk, [[0, [0.3, 0]], [0.3, [1, 1]], [1, [1.4, 0]]], E.aus), R = (w * 1.8 * 0.5 * sc) / S;
    ppFx2Verlauf(g, cx, cy, R, R, R * 1.414, R * 1.414, ppFx2R('konzertpuls', [[0, [255, 251, 210], 0.95], [0.4, [250, 213, 74], 0.5], [0.7, [250, 213, 74], 0], [1, [250, 213, 74], 0]]), op);
  }
  // Noten steigen auf (Sprites, ohne Drehung): Größe .5 → 1,2, Deckung 0 → 1 (15 %) → 0
  T.noten.forEach((n) => {
    const k = (t - n.delay) / n.dur;
    if (k < 0 || k > 1) return;
    const [dx, dy, sc] = ppKf(k, [[0, [0, 0, 0.5]], [1, [n.sway, -n.rise, 1.2]]], E.aus), op = ppKf(k, [[0, [0]], [0.15, [1]], [1, [0]]], E.aus)[0];
    const x = cx + (n.xOff + n.size * 0.3 + dx) / S, y = cy + (h * 0.3 + n.size * 0.6 + dy) / S, px = n.size * sc;
    ppFx2Glyphe(g, PP_FX2_NOTEN[n.glyph], { X: dunkel }, x + 1, y + 1, px, op * 0.7, dunkel);
    ppFx2Glyphe(g, PP_FX2_NOTEN[n.glyph], { X: n.farbe }, x, y, px, op, n.farbe);
  });
}, 3150, (p) => {
  const w = p.w || 80, h = p.h || 110, hx = Math.ceil(Math.max(170, w * 1.45 + 60)), oben = Math.ceil(Math.max(310, h * 2.2 * 1.05 + 10)), unten = Math.ceil(Math.max(w * 1.3, h * 0.3 + 70, 120));
  return { breite: hx * 2, hoehe: oben + unten, ankerY: oben };
}, {
  z: 10100,
  vorbereiten: (sz) => {
    const w = sz.props.w || 80, h = sz.props.h || 110;
    return {
      w, h,
      noten: Array.from({ length: ppFxN(26) }, (_, i) => ({
        glyph: ppFx2Wahl(['achtel', 'sechzehn', 'viertel', 'doppel', 'be', 'kreuz']), xOff: (Math.random() - 0.5) * w * 2.2, rise: ppFx2Z(70, 230), sway: (Math.random() - 0.5) * 50, size: ppFx2Z(16, 34),
        farbe: ppHex(ppFx2Wahl(['#fad54a', '#f9ecb3', '#ffffff', '#f9ac20', '#f9ecb3'])), delay: 100 + i * 55 + Math.random() * 60, dur: ppFx2Z(900, 1500),
      })),
      strahlen: Array.from({ length: 5 }, (_, i) => ({ angle: -32 + i * 16 + (Math.random() - 0.5) * 6, delay: 80 + i * 90 })),
    };
  },
});
function ppFx2Konzert(props) {
  // v632: das Konzert als KLANGSERIE (unverändert): `ping` als Glocke gestimmt (rate = 2^(Halbton/12)), Auftakt, Dur-Figur, Tremolo-Lauf, Schluss-Akkord, Chor.
  React.useEffect(() => {
    if (!window.playSFX) return undefined;
    const st = (n) => Math.pow(2, n / 12);
    const at = (ms, name, opts) => setTimeout(() => window.playSFX(name, { dedupe: 0, ...opts }), ms);
    const ts = [];
    ts.push(at(0, 'ability_activate', { rate: 0.9, volume: 0.8 }));
    ts.push(at(0, 'chain_add', { rate: 0.8, volume: 0.7 }));
    ts.push(at(180, 'chain_add', { rate: 0.8, volume: 0.5 }));
    [0, 4, 7, 12, 16, 19].forEach((semi, i) => ts.push(at(300 + i * 130, 'ping', { rate: st(semi), volume: 0.75 })));
    [19, 17, 16, 14, 12].forEach((semi, i) => ts.push(at(1120 + i * 70, 'ping', { rate: st(semi), volume: 0.5 })));
    ts.push(at(900, 'ascension', { rate: 1.0, volume: 0.9 }));
    [0, 4, 7].forEach((semi) => ts.push(at(1500, 'ping', { rate: st(semi + 12), volume: 0.9 })));
    ts.push(at(1500, 'chain_add', { rate: 0.7, volume: 0.9 }));
    ts.push(at(1520, 'buff', { rate: 1.1, volume: 0.6 }));
    return () => ts.forEach(clearTimeout);
  }, []);
  return React.createElement(ppFx2KonzertLeinwand, props);
}

// ═════════════════════════════════════════════════════════════════
//  3. Coolness Summon (`coolness_summon`, Hipdall) — cyanfarbener Schein, zwei Ringe (Gold außen, Cyan innen), 14 Strahlen, Funken, und ein „COOL"-Schild (statt des Emojis)
// ═════════════════════════════════════════════════════════════════
const ppFx2Coolness = ppR1Leinwand((g, t, sz, T) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, E = PP_FX2_E;
  const weiss = ppHex('#ffffff');
  // Schein (1200 ms): Größe .5 → 1,15 → 1,45 → 1,65; Deckung 0 → 1 → .85 → 0
  if (t < 1200) {
    const [sc, op] = ppKf(t / 1200, [[0, [0.5, 0]], [0.3, [1.15, 1]], [0.7, [1.45, 0.85]], [1, [1.65, 0]]], E.aus), R = (65 * sc) / S;
    g.glow(cx, cy, R + 7, R + 7, [ppHex('#68c6fd')], op * 0.35, 1.4);
    ppFx2Verlauf(g, cx, cy, R, R, R * 1.414, R * 1.414, ppFx2R('coolschein', [[0, [179, 232, 249], 0.85], [0.45, [104, 198, 253], 0.55], [0.75, [104, 198, 253], 0], [1, [104, 198, 253], 0]]), op);
  }
  // goldener Ring außen (1100 ms), cyanfarbener innen — die Drehung eines Kreises ist unsichtbar, also nur Größe und Deckung
  const rk = t / 1100;
  if (rk >= 0 && rk <= 1) {
    const ez = ppFx2Bez(0.2, 0.6, 0.3, 1);
    const [s1, o1] = ppKf(rk, [[0, [0.35, 0]], [0.3, [1.05, 1]], [1, [1.55, 0]]], ez), r1 = (60 * s1) / S;
    ppFx2Ring(g, cx, cy, r1 + 3, 3, ppHex('#fbc86a'), o1 * 0.35);
    ppFx2Ring(g, cx, cy, r1, Math.max(1, Math.round((3 * s1) / S)), ppHex('#fbe181'), o1 * 0.9);
    const [s2, o2] = ppKf(rk, [[0, [0.4, 0]], [0.3, [1, 1]], [1, [1.4, 0]]], ez), r2 = (42 * s2) / S;
    ppFx2Ring(g, cx, cy, r2 + 2, 2, ppHex('#7fdfff'), o2 * 0.35);
    ppFx2Ring(g, cx, cy, r2, 1, ppHex('#7fdfff'), o2);
  }
  // Strahlen strahlen von der Mitte aus (ab 0–100 ms, 1000 ms): wachsen auf 80 px Länge, Schwerpunkt 32 px vom Mittelpunkt
  T.strahlen.forEach((b) => {
    const k = (t - b.delay) / 1000;
    if (k < 0 || k > 1) return;
    const [sk, op] = ppKf(k, [[0, [0, 0]], [0.3, [1, 1]], [1, [0.6, 0]]], E.aus), w = (b.angle * Math.PI) / 180, dx = Math.sin(w), dy = -Math.cos(w);
    const r0 = 32 - 40 * sk, r1 = 32 + 40 * sk;
    ppR1Band(g, cx + (dx * r0) / S, cy + (dy * r0) / S, cx + (dx * r1) / S, cy + (dy * r1) / S, (u) => (u < 0.25 ? { w: 1.4, c: ppHex('#b3e8f9'), a: 0.4 } : u < 0.5 ? { w: 1.4, c: ppHex('#b3e8f9'), a: 0.7 } : u < 0.75 ? { w: 1.4, c: ppHex('#b3e8f9'), a: 0.95 } : { w: 1.6, c: weiss, a: 1 }), op);
  });
  // Funken: gehen auf 35 % der Strecke auf (25 %), laufen dann weiter hinaus
  T.funken.forEach((s) => {
    const k = (t - s.delay) / 1300;
    if (k < 0 || k > 1) return;
    const [op, f, sc] = ppKf(k, [[0, [0, 0, 0.3]], [0.25, [1, 0.35, 1.1]], [1, [0, 1, 0.25]]], E.aus);
    const x = cx + (Math.cos(s.angle) * s.dist * f) / S, y = cy + (Math.sin(s.angle) * s.dist * f) / S, r = Math.max(1, Math.round((s.size * sc) / S));
    const [kern, schein] = s.cyan ? [ppHex('#b6eff7'), ppHex('#66d9ff')] : [ppHex('#f9ecb3'), ppHex('#ffd966')];
    const x0 = Math.round(x - r / 2), y0 = Math.round(y - r / 2);
    g.block(x0 - 1, y0, r + 2, r, schein, op * 0.5); g.block(x0, y0 - 1, r, r + 2, schein, op * 0.5);
    g.block(x0, y0, r, r, kern, op);
  });
  // „COOL"-Schild (80 ms ab, 1100 ms): ploppt auf, federt, steigt 20 px und verschwindet (Schildgröße in vier ganzen Stufen)
  const ek = (t - 80) / 1100;
  if (ek >= 0 && ek <= 1) {
    const ez = ppFx2Bez(0.2, 0.7, 0.3, 1);
    const [sc, dy, op] = ppKf(ek, [[0, [0.2, 0, 0]], [0.25, [1.4, 0, 1]], [0.6, [1.15, 0, 0.95]], [1, [1.6, -20, 0]]], ez);
    const blau = ppHex('#0351c9'), hellblau = ppHex('#4e82cb'), y = cy + dy / S;
    const [bw, bh] = sc >= 1.3 ? [19, 11] : sc >= 0.9 ? [17, 9] : sc >= 0.5 ? [11, 6] : [5, 3];
    const x0 = Math.round(cx - bw / 2), y0 = Math.round(y - bh / 2);
    g.block(x0 - 1, y0 - 1, bw + 2, bh + 2, ppHex('#66d9ff'), op * 0.4);
    g.block(x0, y0, bw, bh, weiss, op);
    g.block(x0 + 1, y0 + 1, bw - 2, bh - 2, blau, op);
    g.block(x0 + 1, y0 + 1, bw - 2, 1, hellblau, op);
    if (bw >= 17) g.txt('COOL', x0 + Math.floor((bw - 15) / 2), y0 + Math.floor((bh - 5) / 2), weiss, op, 1);
    else if (bw >= 11) g.block(x0 + 2, y0 + Math.floor(bh / 2), bw - 4, 1, weiss, op);
  }
}, 1300, { breite: 330, hoehe: 330 }, {
  z: 10110,
  vorbereiten: () => {
    const nb = ppFxN(14), ns = ppFxN(22);
    return {
      strahlen: Array.from({ length: nb }, (_, i) => ({ angle: (i / nb) * 360, delay: Math.random() * 100 })),
      funken: Array.from({ length: ns }, (_, i) => ({ angle: (i / ns) * Math.PI * 2 + Math.random() * 0.3, dist: ppFx2Z(50, 95), size: ppFx2Z(3, 8), delay: Math.random() * 250, cyan: Math.random() < 0.5 })),
    };
  },
});

// ═════════════════════════════════════════════════════════════════
//  4. Core Explosion (`core_explosion`) — dunkler Kern mit rotem Rand, türkis-weißer Blitz, zwei Druckwellen, zackige Entladungsbögen, Funken. 1300 ms; Klang unverändert in der Hülle.
// ═════════════════════════════════════════════════════════════════
const ppFx2CoreLeinwand = ppR1Leinwand((g, t, sz, T) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, r = T.r, E = PP_FX2_E;
  const cyan = ppHex('#66d9ff'), tuerkis = ppHex('#6be9fa'), rosa = ppHex('#fc69c6');
  // Blitz (180 ms ab, 900 ms): Größe .3 → .9 → 1,2; Deckung 0 → 1 → 0
  const bk = (t - 180) / 900;
  if (bk >= 0 && bk <= 1) {
    const [sc, op] = ppKf(bk, [[0, [0.3, 0]], [0.2, [0.9, 1]], [1, [1.2, 0]]], E.aus), R = (r * 1.1 * sc) / S;
    ppFx2Verlauf(g, cx, cy, R, R, R * 1.414, R * 1.414, ppFx2R('coreblitz', [[0, [255, 255, 255], 0.95], [0.3, [107, 233, 250], 0.8], [0.55, [102, 217, 255], 0.35], [0.7, [102, 217, 255], 0], [1, [102, 217, 255], 0]]), op);
  }
  // Kern (700 ms): Größe .4 → 1,25 → .9 → 1,8; sichtbar bis zuletzt, dann weg (Schein: Cyan und Violett als Dither-Ringe)
  if (t < 700) {
    const [sc, op] = ppKf(t / 700, [[0, [0.4, 1]], [0.3, [1.25, 1]], [0.55, [0.9, 1]], [1, [1.8, 0]]], E.aus), R = (r * 0.35 * sc) / S;
    g.glow(cx, cy, R + 16, R + 16, [ppHex('#751ff9')], op * 0.3, 1.6);
    g.glow(cx, cy, R + 8, R + 8, [cyan], op * 0.4, 1.4);
    ppFx2Verlauf(g, cx, cy, R, R, R * 1.414, R * 1.414, ppFx2R('corekern', [[0, [26, 10, 58], 1], [0.45, [46, 10, 81], 1], [0.7, [178, 26, 41], 1], [0.72, [178, 26, 41], 0], [1, [178, 26, 41], 0]]), op);
  }
  // zwei Druckwellen (200 / 340 ms ab, 850 ms): Radius .2 → 1,3 · r, Deckung .95 → 0
  [[200, tuerkis, true], [340, rosa, false]].forEach(([d, farbe, innen]) => {
    const k = (t - d) / 850;
    if (k < 0 || k > 1) return;
    const [sc, op] = ppKf(k, [[0, [0.2, 0.95]], [1, [1.3, 0]]], E.aus), R = (r * sc) / S, th = Math.max(1, Math.round((5 * sc) / S));
    ppFx2Ring(g, cx, cy, R + 4, 4, cyan, op * 0.3);
    if (innen) ppFx2Ring(g, cx, cy, R - th, th, rosa, op * 0.5);
    ppFx2Ring(g, cx, cy, R, th, farbe, op);
  });
  // Entladungsbögen (60–220 ms ab, 420 ms linear)
  T.boegen.forEach((b) => {
    const k = (t - b.verzug) / 420;
    if (k < 0 || k > 1) return;
    const op = ppKf(k, [[0, [0]], [0.15, [1]], [0.6, [0.9]], [1, [0]]], true)[0];
    for (let i = 1; i < b.pts.length; i++) {
      const [x0, y0] = b.pts[i - 1], [x1, y1] = b.pts[i];
      g.line(cx + x0 / S, cy + y0 / S, cx + x1 / S, cy + y1 / S, cyan, op * 0.35, 3);
    }
    for (let i = 1; i < b.pts.length; i++) {
      const [x0, y0] = b.pts[i - 1], [x1, y1] = b.pts[i];
      g.line(cx + x0 / S, cy + y0 / S, cx + x1 / S, cy + y1 / S, ppHex('#b6eff7'), op, 1);
    }
  });
  // Funken (80–280 ms ab, 800 ms): fliegen hinaus, schrumpfen, verlöschen
  T.funken.forEach((f) => {
    const k = (t - f.verzug) / 800;
    if (k < 0 || k > 1) return;
    const [e, sc, op] = ppKf(k, [[0, [0, 1, 1]], [1, [1, 0.4, 0]]], E.aus), rr = Math.max(1, Math.round((f.size * sc) / S));
    const x0 = Math.round(cx + (f.dx * e) / S - rr / 2), y0 = Math.round(cy + (f.dy * e) / S - rr / 2);
    g.block(x0 - 1, y0, rr + 2, rr, f.farbe, op * 0.4); g.block(x0, y0 - 1, rr, rr + 2, f.farbe, op * 0.4);
    g.block(x0, y0, rr, rr, f.farbe, op);
  });
}, 1300, (p) => { const r = Math.max(70, (p.w || 80) * 1.5), h = Math.ceil(r * 1.9 + 24); return { breite: h * 2, hoehe: h * 2 }; }, {
  z: 10205,
  vorbereiten: (sz) => {
    const r = Math.max(70, (sz.props.w || 80) * 1.5), nb = ppFxN(10);
    return {
      r,
      boegen: Array.from({ length: nb }, (_, i) => {
        const winkel = (i / nb) * Math.PI * 2 + (Math.random() - 0.5) * 0.4, laenge = r * (0.9 + Math.random() * 0.8), pts = [];
        for (let k = 0; k <= 6; k++) {
          const u = k / 6, quer = (Math.random() - 0.5) * 22 * Math.sin(Math.PI * u);
          pts.push([Math.cos(winkel) * laenge * u - Math.sin(winkel) * quer, Math.sin(winkel) * laenge * u + Math.cos(winkel) * quer]);
        }
        return { pts, verzug: ppFx2Z(60, 220) };
      }),
      funken: Array.from({ length: ppFxN(22) }, () => {
        const w = Math.random() * Math.PI * 2, weite = r * ppFx2Z(0.6, 1.5);
        return { dx: Math.cos(w) * weite, dy: Math.sin(w) * weite, size: ppFx2Z(4, 10), farbe: ppHex(ppFx2Wahl(['#6be9fa', '#ffffff', '#fc69c6', '#66d9ff'])), verzug: ppFx2Z(80, 280) };
      }),
    };
  },
});
function ppFx2Core(props) {
  React.useEffect(() => {
    const spiel = (name, opts, at) => setTimeout(() => { if (window.playSFX) window.playSFX(name, { ...opts, dedupe: 0 }); }, at);
    spiel('heavy_impact', { rate: 0.7, volume: 1 }, 60);
    spiel('elem_lightning', { rate: 0.9, volume: 0.9 }, 0);
  }, []);
  return React.createElement(ppFx2CoreLeinwand, props);
}

// ═════════════════════════════════════════════════════════════════
//  5. Corpse Explosion (`corpse_explosion`) — bildschirmfüllender Feuerball (Farbstufen Weiß → Gelb → Orange → Rot → Dunkelrot, hart abgeschnitten), Weißblitz, riesige Druckwelle und
//  Funken/Splitter. Vollbild-Leinwand. Der Feuerball hat einen Radius von 115 vmax; sein Verlauf reicht bis zur Ecke der Fläche (Radius × 1,414), der Rand schneidet ihn hart ab.
//  Sprites statt der Emojis: Flamme (Flammen-Bild von Flame Strike), Funkenstern, Totenkopf, Knochen.
// ═════════════════════════════════════════════════════════════════
const PP_FX2_EMBER = {
  schaedel: ['.XXXXX.', 'XXXXXXX', 'XooXooX', 'XooXooX', 'XXXoXXX', '.XXXXX.', '.X.X.X.'],
  knochen: ['XX...XX', '.XXXXX.', '.XXXXX.', 'XX...XX'],
  stern: ['o..o..o', '.oYoYo.', '..oYo..', 'oYYWYYo', '..oYo..', '.oYoYo.', 'o..o..o'],
};
const ppFx2Corpse = ppFx2Leinwand((g, t, sz, T, buf) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, gw = sz.gw, gh = sz.gh, E = PP_FX2_E, N = gw * gh, thr = T.thr[0], thr2 = T.thr[1], fn = T.fn;
  // Feuerball (1300 ms, Radius 115 vmax; Größe .03 → .5 → 1 → 1,05 → 1,14; Deckung 0 → 1 → 1 → .9 → 0); Verlauf bis zur Ecke (Radius × 1,414), der Rand schneidet hart ab
  if (t < 1300) {
    const [sc, op] = ppKf(t / 1300, [[0, [0.03, 0]], [0.12, [0.5, 1]], [0.34, [1, 1]], [0.62, [1.05, 0.9]], [1, [1.14, 0]]], E.aus);
    const inv = 1 / sc, rp = ppFx2R('corpseball', [[0, [255, 255, 255], 1], [0.09, [255, 251, 210], 0.98], [0.22, [249, 172, 32], 0.95], [0.4, [255, 73, 26], 0.88], [0.6, [143, 0, 0], 0.62], [0.78, [42, 4, 4], 0.3], [0.9, [42, 4, 4], 0], [1, [42, 4, 4], 0]], 40);
    if (op > 0.01) {
      const rn = rp.n, ra = rp.a, rc = rp.c;
      for (let p = 0; p < N; p++) {
        const f = fn[p] * inv;
        if (f > 0.7072) continue;
        const s = f * rn, k = s | 0, idx = (s - k) > thr2[p] ? k + 1 : k, a = ra[idx] * op;
        if (a <= thr[p]) continue;
        const c = rc[idx], q = p << 2;
        buf[q] = c[0]; buf[q + 1] = c[1]; buf[q + 2] = c[2]; buf[q + 3] = 255;
      }
    }
  }
  // Weißblitz über das ganze Bild (560 ms): Deckung 0 → .9 → .45 → 0
  if (t < 560) {
    const wo = ppKf(t / 560, [[0, [0]], [0.14, [0.9]], [0.4, [0.45]], [1, [0]]], E.aus)[0];
    if (wo > 0.01) for (let p = 0; p < N; p++) if (thr[p] < wo) { const q = p << 2; buf[q] = 255; buf[q + 1] = 255; buf[q + 2] = 255; buf[q + 3] = 255; }
  }
  // Druckwelle (1150 ms): Radius 70 px · Größe (.3 → 13), Rand 16 → 2 px (mit skaliert), Deckung .95 → .4 → 0
  const sk = t / 1150;
  if (sk >= 0 && sk <= 1) {
    const sc = 0.3 + 12.7 * E.aus(sk), op = ppKf(sk, [[0, [0.95]], [0.7, [0.4]], [1, [0]]], E.aus)[0], bw = 16 - 14 * E.aus(sk);
    const R = (70 * sc) / S, th = Math.max(1, Math.round((bw * sc) / S));
    if (op > 0.01) {
      ppFx2Ring(g, cx, cy, R + Math.min(40, th), Math.min(40, th), ppHex('#ff7d00'), op * 0.22);   // harter Schein außen
      ppFx2Ring(g, cx, cy, R - th, Math.min(R, th * 1.4), ppHex('#f9ac20'), op * 0.3);          // innerer Schein
      ppFx2Ring(g, cx, cy, R, th, ppHex('#ff8b1a'), op * 0.9);
    }
  }
  // Splitter fliegen hinaus
  T.glut.forEach((e) => {
    const k = (t - e.delay) / e.dur;
    if (k < 0 || k > 1) return;
    const f = E.aus(k), sc = 0.4 + 0.7 * f, op = ppKf(k, [[0, [0]], [0.18, [1]], [1, [0]]], E.aus)[0];
    const x = cx + (e.dx * f) / S, y = cy + (e.dy * f) / S, px = e.size * sc;
    if (e.art === 'flamme') ppFx2Glyphe(g, PP_R1_FSCHLAG_BILD[px > 24 ? 'gross' : 'klein'], PP_R1_FLAMMENFARBEN, x, y, px, op, PP_R1_FLAMMENFARBEN.r);
    else if (e.art === 'stern') ppFx2Glyphe(g, PP_FX2_EMBER.stern, { o: PP_R1_FLAMMENFARBEN.o, Y: PP_R1_FLAMMENFARBEN.Y, W: PP_R1_FLAMMENFARBEN.W }, x, y, px, op, PP_R1_FLAMMENFARBEN.Y);
    else if (e.art === 'schaedel') ppFx2Glyphe(g, PP_FX2_EMBER.schaedel, { X: ppHex('#e5edfa'), o: ppHex('#323232') }, x, y, px, op, ppHex('#e5edfa'));
    else ppFx2Glyphe(g, PP_FX2_EMBER.knochen, { X: ppHex('#f9ecb3') }, x, y, px, op, ppHex('#f9ecb3'));
  });
}, 1550, ppFx2Voll, {
  z: 10140,
  vorbereiten: (sz) => {
    const gw = sz.gw, gh = sz.gh, fn = new Float32Array(gw * gh), R = (115 * Math.max(window.innerWidth, window.innerHeight)) / 100;
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) fn[j * gw + i] = (Math.hypot(i - sz.cx, j - sz.cy) * sz.S) / (R * 1.414);   // Abstand / Verlaufsradius bei Größe 1
    return {
      fn, thr: ppFx2Schwellen(gw, gh),
      glut: Array.from({ length: ppFxN(20) }, () => {
        const w = Math.random() * Math.PI * 2, d = ppFx2Z(130, 690);
        return { dx: Math.cos(w) * d, dy: Math.sin(w) * d, size: ppFx2Z(14, 46), art: ppFx2Wahl(['flamme', 'stern', 'schaedel', 'knochen', 'flamme']), dur: ppFx2Z(720, 1340), delay: Math.random() * 180 };
      }),
    };
  },
});

// ═════════════════════════════════════════════════════════════════
//  6. Cute Hearts (`cute_hearts`) — sieben Herzen wachsen über dem Ziel von .35 auf 2,6 facher Größe und verblassen (kein Steigen, wie vorher). Pixel-Herz mit Rand, Glanz, Schatten; nicht gekippt.
// ═════════════════════════════════════════════════════════════════
const ppFx2Hearts = ppR1Leinwand((g, t, sz, T) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, ez = ppFx2Bez(0.25, 0.6, 0.4, 1);
  T.herzen.forEach((hz) => {
    const k = (t - hz.delay) / hz.dur;
    if (k < 0 || k > 1) return;
    const sc = 0.35 + 2.25 * ez(k), op = ppKf(k, [[0, [0]], [0.2, [0.95]], [1, [0]]], ez)[0];
    if (op > 0.02) ppFx2Herz(g, cx + hz.dx / S, cy + hz.dy / S, Math.max(2, (hz.groesse * sc) / S), op);
  });
}, 2900, (p) => { const w = Math.max(p.w || 80, 60), h = Math.max(p.h || 110, 80), hx = Math.ceil(w * 0.4 + 34 * 2.6 * 0.5 + 12), hy = Math.ceil(h * 0.25 + 34 * 2.6 * 0.5 + 12); return { breite: hx * 2, hoehe: hy * 2 }; }, {
  z: 10150,
  vorbereiten: (sz) => {
    const ww = Math.max(sz.props.w || 80, 60), hh = Math.max(sz.props.h || 110, 80);
    return { herzen: Array.from({ length: ppFxN(7) }, (_, i) => ({ dx: (Math.random() - 0.5) * ww * 0.8, dy: (Math.random() - 0.5) * hh * 0.5, groesse: ppFx2Z(14, 34), delay: i * 90 + Math.random() * 80, dur: ppFx2Z(1150, 1600) })) };
  },
});

// ═════════════════════════════════════════════════════════════════
//  7. Dark Blast (`dark_blast`, Memory Blast) — dunkelvioletter Schatten, Kern, bis zu drei Ringe, Splitter (senkrechte Streifen, die nach außen fliegen). Alles × Wucht · Zielgröße (`skala`).
//  Zeiten: Schatten .85 s, Kern .7 s, Ringe .8 s (Verzug 0 / .16 / .3 s), Splitter .75 s (Verzug (i % 6) · 40 ms).
// ═════════════════════════════════════════════════════════════════
const PP_FX2_SPLITTER = Array.from({ length: 30 }, (_, i) => ({ winkel: (i / 30) * Math.PI * 2 + (i % 3) * 0.2, laenge: 34 + (i % 7) * 16, breite: 3 + (i % 4) * 2, verzug: (i % 6) * 40 }));
const ppFx2DarkBlast = ppR1Leinwand((g, t, sz, T) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, sk = T.skala, E = PP_FX2_E, p = T.p;
  // Schatten
  if (t < 850) {
    const [sc, op] = ppKf(t / 850, [[0, [0.4, 0]], [0.25, [0.825, 1]], [1, [1.25, 0]]], E.aus), R = (70 * sc * sk) / S;
    ppFx2Verlauf(g, cx, cy, R, R, R * 1.414, R * 1.414, ppFx2R('dbschatten', [[0, [23, 11, 40], 0.85], [0.45, [43, 11, 71], 0.45], [0.75, [71, 17, 126], 0], [1, [71, 17, 126], 0]]), op);
  }
  // Kern
  if (t < 700) {
    const [sc, op] = ppKf(t / 700, [[0, [0.25, 0]], [0.3, [0.775, 1]], [1, [1.3, 0]]], E.aus), R = (26 * sc * sk) / S;
    ppFx2Verlauf(g, cx, cy, R, R, R * 1.414, R * 1.414, ppFx2R('dbkern', [[0, [25, 6, 45], 0.95], [0.45, [80, 0, 140], 0.75], [0.7, [149, 68, 213], 0.35], [1, [102, 24, 180], 0]]), op);
  }
  // Ringe (0 / 160 / 300 ms ab, 800 ms): Radius 30 px · (.2 → 1,9), Rand 3 px, Deckung 0 → .95 → 0
  [0, p > 0.35 ? 160 : -1, p > 0.7 ? 300 : -1].forEach((d) => {
    if (d < 0) return;
    const k = (t - d) / 800;
    if (k < 0 || k > 1) return;
    const [sc, op] = ppKf(k, [[0, [0.2, 0]], [0.25, [0.625, 0.95]], [1, [1.9, 0]]], E.aus), R = (30 * sc * sk) / S, th = Math.max(1, Math.round((3 * sc * sk) / S));
    ppFx2Ring(g, cx, cy, R + th + 4, th + 4, ppHex('#6618b4'), op * 0.35);
    ppFx2Ring(g, cx, cy, R, th, ppHex('#ba74ff'), op * 0.9);
  });
  // Splitter (Streifen: Hellviolett → weg nach unten)
  const rp = ppFx2R('dbsplitter', [[0, [214, 179, 249], 0.95], [1, [80, 0, 140], 0]], 16);
  PP_FX2_SPLITTER.slice(0, T.anzahl).forEach((sp) => {
    const k = (t - sp.verzug) / 750;
    if (k < 0 || k > 1) return;
    const f = E.aus(k), op2 = ppKf(k, [[0, [0]], [0.25, [1]], [1, [0]]], E.aus)[0], sc2 = 0.5 + 0.5 * f;
    const bw = Math.max(1, Math.round((sp.breite * sc2 * sk) / S)), bh = Math.max(2, Math.round((sp.laenge * 0.5 * sc2 * sk) / S));
    const mx = cx + (Math.cos(sp.winkel) * sp.laenge * f * sk + (sp.breite * sk) / 2) / S, my = cy + (Math.sin(sp.winkel) * sp.laenge * f * sk + (sp.laenge * 0.25 * sk)) / S;
    const x0 = Math.round(mx - bw / 2), y0 = Math.round(my - bh / 2);
    for (let j = 0; j < bh; j++) { const idx = ppFx2Stufe(rp, j / bh, x0, y0 + j); for (let i = 0; i < bw; i++) g.put(x0 + i, y0 + j, rp.c[idx], rp.a[idx] * op2); }
  });
}, 1100, (p) => {
  const pw = Math.max(0, Math.min(1, typeof p.power === 'number' ? p.power : 0.5)), R = Math.max(p.w || 90, p.h || 120), sk = (0.8 + pw * 1.9) * (R / 110), h = Math.ceil(Math.min(700, 205 * sk + 14));
  return { breite: h * 2, hoehe: h * 2 };
}, {
  z: 10090,
  vorbereiten: (sz) => {
    const p = Math.max(0, Math.min(1, typeof sz.props.power === 'number' ? sz.props.power : 0.5)), R = Math.max(sz.props.w || 90, sz.props.h || 120);
    return { p, skala: (0.8 + p * 1.9) * (R / 110), anzahl: Math.max(8, Math.round(8 + p * 22)) };
  },
});

// ═════════════════════════════════════════════════════════════════
//  8. Decapitating Strike (`decapitation`) — Vollbild-Leinwand: roter Rand (Vignette), Klinge fährt diagonal durch, Bogen, roter Schnitt (bleibt), Blutnebel, Flecken, Rinnsale und 80 Tropfen in
//  drei Schüben. Das Bild sitzt am „Hals" (y − 0,2 · Höhe) und ruckelt 320 ms lang (ganze Rasterpixel). Zeiten wie die Keyframes (dekaKlinge/-Bogen/-Schnitt/-Nebel/-Fleck/-Rinnsal/-Fontaene).
// ═════════════════════════════════════════════════════════════════
const ppFx2Deka = ppFx2Leinwand((g, t, sz, T, buf) => {
  const S = sz.S, gw = sz.gw, gh = sz.gh, E = PP_FX2_E, W = T.W, H = T.H;
  // roter Rand: Vignette über das ganze Bild (.7 s ab .17 s), Ellipse zur Ecke, Deckung 0 (ab 20 %) → .55 am Rand
  const vk = (t - 170) / 700;
  if (vk >= 0 && vk <= 1) {
    const vo = ppKf(vk, [[0, [0]], [0.15, [1]], [1, [0]]], E.aus)[0], vf = T.vf, thr = T.thr[0], N = gw * gh, col = ppHex('#780000');
    if (vo > 0.01) for (let p = 0; p < N; p++) if (vf[p] * vo > thr[p]) { const q = p << 2; buf[q] = col[0]; buf[q + 1] = col[1]; buf[q + 2] = col[2]; buf[q + 3] = 255; }
  }
  // Ruckeln des Bildes (.32 s ab .17 s): ±6 px → ganze Rasterpixel
  let bx = 0, by = 0;
  const sk = (t - 170) / 320;
  if (sk >= 0 && sk < 1) {
    const [x, y] = ppKf(sk, [[0, [0, 0]], [0.2, [-6, 3]], [0.4, [5, -4]], [0.6, [-4, -2]], [0.8, [3, 2]], [1, [0, 0]]], true);
    bx = Math.round(x / S); by = Math.round(y / S);
  }
  const cx = sz.cx + bx, cy = sz.cy - (H * 0.2) / S + by;     // Hals
  const weiss = ppHex('#ffffff'), rot = ppHex('#ff1a1a'), tan12 = Math.tan((12 * Math.PI) / 180), cos12 = Math.cos((12 * Math.PI) / 180), sin12 = Math.sin((12 * Math.PI) / 180);
  // Blutnebel (.22 s ab, 1,4 s): Größe .4 → 1 → 1,3; Deckung 0 → 1 → 0
  const nk = (t - 220) / 1400;
  if (nk >= 0 && nk <= 1) {
    const [sc, op] = ppKf(nk, [[0, [0.4, 0]], [0.25, [0.7, 1]], [1, [1.3, 0]]], E.aus), rx = (W * 0.95 * sc) / S, ry = (H * 0.45 * sc) / S;
    ppFx2Verlauf(g, cx, cy, rx, ry, rx * 1.414, ry * 1.414, ppFx2R('dekanebel', [[0, [190, 14, 14], 0.55], [0.45, [120, 0, 0], 0.25], [0.72, [91, 1, 2], 0], [1, [91, 1, 2], 0]]), op);
  }
  // Flecken (Blutlachen): wachsen mit Überschwung, bleiben, dithern weg
  T.flecken.forEach((f) => {
    const k = (t - f.verzug) / 1500;
    if (k < 0 || k > 1) return;
    const ez = ppFx2Bez(0.2, 1.4, 0.4, 1), sc = ppKf(k, [[0, [0]], [0.12, [1.15]], [0.22, [1]], [1, [1]]], ez)[0], op = ppKf(k, [[0, [0]], [0.12, [0.95]], [0.75, [0.9]], [1, [0]]], E.aus)[0];
    if (sc <= 0.05 || op <= 0.02) return;
    const rx = Math.max(1, (f.g * W * 1.4 * sc) / 2 / S), ry = Math.max(1, (f.g * W * sc) / 2 / S), x = cx + (f.x * W) / S, y = cy + (f.y * H) / S;
    g.ell(x, y, rx, ry, ppHex('#3a0000'), op);
    g.ell(x, y, Math.max(0.6, rx - 1), Math.max(0.6, ry - 1), ppHex('#780000'), op);
    if (rx > 2.5) g.ell(x - rx * 0.15, y - ry * 0.15, rx * 0.55, ry * 0.55, ppHex('#b5171c'), op);
  });
  // Rinnsale: laufen von oben nach unten
  T.rinnsale.forEach((d) => {
    const k = (t - d.verzug) / 1200;
    if (k < 0 || k > 1) return;
    const [l, op] = ppKf(k, [[0, [0, 0.95]], [0.7, [d.laenge * H, 0.9]], [1, [d.laenge * H, 0]]], E.ein), n = Math.round(l / S);
    if (n < 1 || op <= 0.02) return;
    const bw = Math.max(1, Math.round(d.breite / S)), x0 = Math.round(cx + (d.ax * W) / S - bw / 2), y0 = Math.round(cy + 1);
    for (let j = 0; j < n; j++) g.block(x0 + (j === n - 1 && bw > 1 ? 1 : 0), y0 + j, bw - (j === n - 1 && bw > 1 ? 2 : 0), 1, j < n * 0.5 ? ppHex('#8f0000') : ppHex('#5b0102'), op);
  });
  // Bogen: weißer Halbmond um den Hals (.38 s ab .05 s), -12 Grad gekippt (Geometrie, kein Bild)
  const bk = (t - 50) / 380;
  if (bk >= 0 && bk <= 1) {
    const op = ppKf(bk, [[0, [0]], [0.3, [1]], [1, [0]]], E.aus)[0], rx = (W * 1.3) / S, ry = (H * 0.35) / S;
    if (op > 0.02) {
      for (let q = -rx; q <= rx; q += 0.5) {
        const s = Math.sqrt(Math.max(0, 1 - (q / rx) * (q / rx))), yo = -ry * s, di = Math.max(1, 2 * s), yi = yo + di;
        for (let y = yo; y <= yi; y += 0.5) {
          const x2 = q * cos12 + y * sin12, y2 = -q * sin12 + y * cos12;
          g.put(cx + x2, cy + y2, weiss, op * 0.95);
          if (y === yo) g.put(cx + x2, cy + y2 - 1, weiss, op * 0.35);
        }
      }
    }
  }
  // Klinge (.22 s, cubic-bezier(.6,0,.9,.6)): fährt von links nach rechts durch den Hals, tilt -12 Grad
  const kk = t / 220;
  if (kk >= 0 && kk <= 1) {
    const e = ppFx2Bez(0.6, 0, 0.9, 0.6)(kk), op = ppKf(kk, [[0, [0]], [0.15, [1]], [0.85, [1]], [1, [0]]], true)[0], weg = (W * 1.6) / S, mx = cx + (-weg + 2 * weg * e), L = Math.round((W * 1.5) / S);
    const far = [weiss, ppHex('#e5edfa'), ppHex('#e5edfa'), ppHex('#9aa3b6'), ppHex('#59606e')];
    if (op > 0.02) {
      for (let i = -Math.floor(L / 2); i <= Math.floor(L / 2); i++) {
        const spitze = i > L / 2 - 4 ? Math.round((i - (L / 2 - 4)) / 1.5) : 0, yb = cy - i * tan12;
        for (let r = -2 + spitze; r <= 2 - Math.min(2, spitze); r++) g.put(mx + i, yb + r, far[r + 2] || far[4], op);
        g.put(mx + i, yb - 3 + spitze, weiss, op * 0.4);
        g.put(mx + i, yb + 3, ppHex('#e5edfa'), op * 0.25);
      }
    }
  }
  // Schnitt (1,2 s ab .15 s): rote Linie mit weißen Enden, breitet sich aus, klafft auf (Höhe 4 → 3 → 7 → 5 px), bleibt, verblasst ab 75 %
  const ck = (t - 150) / 1200;
  if (ck >= 0 && ck <= 1) {
    const [sx, hh] = ppKf(ck, [[0, [0, 4]], [0.12, [1, 3]], [0.3, [1, 7]], [1, [1, 5]]], E.aus), op = ppKf(ck, [[0, [1]], [0.75, [1]], [1, [0]]], E.aus)[0];
    const L = Math.round((W * 1.25 * sx) / S), th = Math.max(1, Math.round(hh / S));
    if (L > 1 && op > 0.02) {
      for (let i = -Math.floor(L / 2); i <= Math.floor(L / 2); i++) {
        const u = (i + L / 2) / L, yb = cy - i * tan12;
        if (u < 0.05 || u > 0.95) continue;
        const mitte = Math.abs(u - 0.5) < 0.3, c = mitte ? rot : weiss;
        for (let r = 0; r < th; r++) g.put(cx + i, yb + r - Math.floor(th / 2), c, op);
        g.put(cx + i, yb - Math.floor(th / 2) - 1, rot, op * 0.5); g.put(cx + i, yb + Math.ceil(th / 2) + 1, rot, op * 0.5);
        if (th > 1) { g.put(cx + i, yb - Math.floor(th / 2) - 2, rot, op * 0.2); g.put(cx + i, yb + Math.ceil(th / 2) + 2, rot, op * 0.2); }
      }
    }
  }
  // Tropfen: drei Schübe, Fontäne nach oben, dann Bogen nach unten (cubic-bezier(.25,.6,.55,1) je Abschnitt)
  const tz = ppFx2Bez(0.25, 0.6, 0.55, 1);
  T.tropfen.forEach((d) => {
    const k = (t - d.verzug) / d.dauer;
    if (k < 0 || k > 1) return;
    const [px, py, sc] = ppKf(k, [[0, [0, 0, 0.6]], [0.45, [d.dx * 0.6 * W, -d.hoch * H, 1]], [1, [d.dx * W, d.fall * H, 0.8]]], tz), op = ppKf(k, [[0, [0]], [0.08, [1]], [1, [0]]], tz)[0];
    const w = Math.max(1, Math.round((d.g * sc) / S)), h = Math.max(1, Math.round(w * 1.25)), x0 = Math.round(cx + (d.ax * W + px) / S), y0 = Math.round(cy + py / S);
    const [c1, c2] = d.hell ? [ppHex('#ef2929'), ppHex('#be0e0e')] : [ppHex('#be0e0e'), ppHex('#780000')];
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (!((w > 2 && (i === 0 || i === w - 1) && (j === 0 || j === h - 1)))) g.put(x0 + i, y0 + j, j >= h - 1 && h > 1 ? c2 : (i === 0 && j === 0 && w > 2 ? ppHex('#ff6666') : c1), op);
  });
}, 2000, ppFx2Voll, {
  z: 10110,
  vorbereiten: (sz) => {
    const r = ppFx2Zufall(7331), W = Math.max(sz.props.w || 90, 60), H = Math.max(sz.props.h || 120, 80);
    const tropfen = Array.from({ length: ppFxN(80) }, (_, i) => ({ ax: (r() - 0.5) * 0.9, dx: (r() - 0.5) * 2.4, hoch: 0.35 + r() * 0.9, fall: 0.5 + r() * 0.9, g: 3 + r() * 8, verzug: 200 + (i % 3) * 190 + Math.round(r() * 120), dauer: 650 + Math.round(r() * 350), hell: r() < 0.35 }));
    const flecken = Array.from({ length: ppFxN(12) }, () => ({ x: (r() - 0.5) * 1.5, y: (r() - 0.3) * 1.2, g: 0.12 + r() * 0.22, verzug: 260 + Math.round(r() * 520) }));
    const rinnsale = Array.from({ length: ppFxN(9) }, () => ({ ax: (r() - 0.5) * 0.8, laenge: 0.25 + r() * 0.45, breite: 2 + r() * 3, verzug: 380 + Math.round(r() * 500) }));
    const gw = sz.gw, gh = sz.gh, vf = new Float32Array(gw * gh), hx = gw / 2, hy = gh / 2, gx = hx * 1.414, gy = hy * 1.414;
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) { const f = Math.hypot((i - hx) / gx, (j - hy) / gy); vf[j * gw + i] = f < 0.2 ? 0 : ((f - 0.2) / 0.8) * 0.55; }
    return { W, H, tropfen, flecken, rinnsale, vf, thr: ppFx2Schwellen(gw, gh) };
  },
});

// ═════════════════════════════════════════════════════════════════
//  9. Deep Sea Bubbles (`deep_sea_bubbles`) — 20 Blasen steigen vom Ziel auf (ab 0–800 ms, 800–1400 ms), schlingern; Pixel-Blasen mit Rand, getupfter Füllung und Glanzpunkt.
// ═════════════════════════════════════════════════════════════════
const ppFx2Bubbles = ppR1Leinwand((g, t, sz, T) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, E = PP_FX2_E, pal = T.pal;
  T.blasen.forEach((b) => {
    const k = (t - b.delay) / b.dur;
    if (k < 0 || k > 1) return;
    const [dx, dy] = ppKf(k, [[0, [0, 0]], [0.5, [b.wobble, b.endY * 0.5]], [1, [0, b.endY]]], E.aus), op = ppKf(k, [[0, [0]], [0.15, [b.opacity]], [0.85, [b.opacity]], [1, [0]]], E.aus)[0];
    ppFx2Blase(g, cx + (b.xOff + b.size / 2 + dx) / S, cy + (b.startY + b.size / 2 + dy) / S, b.size / S, op, pal);
  });
}, 2250, { breite: 240, hoehe: 270, ankerY: 175 }, {
  z: 10100,
  vorbereiten: () => ({
    pal: { rand: ppHex('#399edf'), fuell: ppHex('#2b457e'), glanz: ppHex('#b6eff7'), fa: 0.5 },
    blasen: Array.from({ length: ppFxN(20) }, () => ({ xOff: ppFx2Z(-40, 40), startY: ppFx2Z(25, 55), endY: -ppFx2Z(80, 140), delay: Math.random() * 800, dur: ppFx2Z(800, 1400), size: ppFx2Z(6, 20), opacity: ppFx2Z(0.4, 0.8), wobble: ppFx2Z(-8, 8) })),
  }),
});

// ═════════════════════════════════════════════════════════════════
//  10. Deepsea Idol Negate (`deepsea_idol_negate`) — drei blauweiße Wellenringe, ein weißblauer Kern, zwölf Rautenfunken.
// ═════════════════════════════════════════════════════════════════
const ppFx2IdolNegate = ppR1Leinwand((g, t, sz, T) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, E = PP_FX2_E;
  // drei Wellenringe (0 / 100 / 200 ms ab, 700 ms): Größe .3 → 1,3 → 2,3
  [0, 100, 200].forEach((d, i) => {
    const k = (t - d) / 700;
    if (k < 0 || k > 1) return;
    const [sc, op] = ppKf(k, [[0, [0.3, 0]], [0.3, [1.3, 1]], [1, [2.3, 0]]], E.aus), R = (35 * sc) / S, th = Math.max(1, Math.round(((3 - i * 0.6) * sc) / S));
    ppFx2Ring(g, cx, cy, R + 3, 3, ppHex('#7bbeea'), op * 0.3);
    ppFx2Ring(g, cx, cy, R, th, ppHex('#68c6fd'), op * (0.85 - i * 0.18));
  });
  // Kern (500 ms): Größe .4 → 1,4 → 1,9; Deckung 0 → 1 → 0
  const ck = t / 500;
  if (ck >= 0 && ck <= 1) {
    const [sc, op] = ppKf(ck, [[0, [0.4, 0]], [0.45, [1.4, 1]], [1, [1.9, 0]]], E.aus), R = (25 * sc) / S;
    ppFx2Verlauf(g, cx, cy, R, R, R * 1.414, R * 1.414, ppFx2R('idolkern', [[0, [255, 255, 255], 0.95], [0.5, [104, 198, 253], 0.7], [1, [104, 198, 253], 0]]), op);
  }
  // Rautenfunken (200–420 ms ab, 600 ms): fliegen 32 px hinaus und schrumpfen
  T.funken.forEach((s) => {
    const k = (t - s.delay) / 600;
    if (k < 0 || k > 1) return;
    const [e, sc] = ppKf(k, [[0, [0, 0.5]], [1, [1, 0]]], E.aus), x = Math.round(cx + (Math.cos(s.angle) * 32 * e) / S), y = Math.round(cy + (Math.sin(s.angle) * 32 * e) / S);
    const r = Math.round((s.size * Math.max(sc, 0.25)) / S * 1.1), hell = ppHex('#e5f5fa'), schein = ppHex('#7bbeea');
    if (sc < 0.05) return;
    for (let j = -r - 1; j <= r + 1; j++) for (let i = -r - 1; i <= r + 1; i++) { const d = Math.abs(i) + Math.abs(j); if (d <= r) g.put(x + i, y + j, hell, 1); else if (d === r + 1) g.put(x + i, y + j, schein, 0.5); }
  });
}, 1050, { breite: 240, hoehe: 240 }, {
  z: 10100,
  vorbereiten: () => { const n = ppFxN(12); return { funken: Array.from({ length: n }, (_, i) => ({ angle: (i / n) * Math.PI * 2, size: ppFx2Z(4, 8), delay: ppFx2Z(200, 420) })) }; },
});

// ═════════════════════════════════════════════════════════════════
//  11. Deepsea Spores Growth (`deepsea_spores_growth`) — roter Puls über der Kreatur (70 × 96 px), Ranken wachsen (wie im Original senkrecht und übereinander, unten aus der Karte heraus), Wedel (Blatt-/Korallen-Sprites).
//  Die Ranken und Wedel bleiben bis zum Ende der Animation stehen (Aufrufer: 1800 ms).
// ═════════════════════════════════════════════════════════════════
const PP_FX2_WEDEL = {
  blatt: ['...G..', '.G.GG.', 'GGGgG.', '.GgG..', '..g.GG', '..gGG.', '..g...'],
  koralle: ['.R..R.', '.R.RR.', 'RRRR..', '.RR.R.', '..RRR.', '..RR..'],
};
const ppFx2SporenWachstum = ppR1Leinwand((g, t, sz, T) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, E = PP_FX2_E;
  // roter Puls (1600 ms): Größe .6 → 1,05 → 1 → 1,08; Deckung 0 → 1 → .8 → 0; harter roter Rahmen statt Schein
  if (t < 1600) {
    const [sc, op] = ppKf(t / 1600, [[0, [0.6, 0]], [0.3, [1.05, 1]], [0.7, [1, 0.8]], [1, [1.08, 0]]], E.aus), hw = Math.round((35 * sc) / S), hh = Math.round((48 * sc) / S);
    ppFx2Fuell(g, Math.round(cx) - hw, Math.round(cy) - hh, hw * 2, hh * 2, cx, cy, hw * 1.414, hh * 1.414, ppFx2R('sporpuls', [[0, [192, 20, 28], 0.55], [0.55, [120, 0, 20], 0.3], [0.85, [120, 0, 20], 0], [1, [120, 0, 20], 0]]), op);
    const rot = ppHex('#b21a29'), dunkel = ppHex('#5b0102');
    const rahmen = (e, c, a) => {      // Rechteckrand im Abstand e von der Kante (0 = auf der Kante)
      const x0 = Math.round(cx) - hw - e, y0 = Math.round(cy) - hh - e, w = hw * 2 + 2 * e, h = hh * 2 + 2 * e;
      g.block(x0, y0, w, 1, c, a); g.block(x0, y0 + h - 1, w, 1, c, a); g.block(x0, y0 + 1, 1, h - 2, c, a); g.block(x0 + w - 1, y0 + 1, 1, h - 2, c, a);
    };
    rahmen(2, rot, op * 0.3); rahmen(1, rot, op * 0.55); rahmen(0, dunkel, op * 0.4);
  }
  // Ranken: senkrecht, wachsen von unten nach oben (cubic-bezier(.3,1.4,.5,1), 800–1100 ms ab 0–200 ms), Spitze lichter
  const ez = ppFx2Bez(0.3, 1.4, 0.5, 1);
  T.ranken.forEach((r) => {
    const k = (t - r.delay) / r.dur;
    if (k <= 0) return;
    const sk = ppKf(Math.min(1, k), [[0, [0]], [0.6, [1.08]], [1, [1]]], ez)[0], len = (r.len * sk) / S, bw = Math.max(1, Math.round(r.width / S)), x0 = Math.round(cx), yb = Math.round(cy + (20 + r.len) / S);
    for (let j = 0; j < Math.ceil(len); j++) {
      const v = j / Math.max(1, len), a = v < 0.6 ? 1 : v < 0.85 ? 0.75 : 0.45;
      g.block(x0, yb - 1 - j, bw, 1, r.farbe, a);
    }
  });
  // Wedel (150–400 ms ab, 700–900 ms): steigen 18 px und wachsen
  T.wedel.forEach((f) => {
    const k = (t - f.delay) / f.dur;
    if (k < 0) return;
    const kk = Math.min(1, k), [dy, sc, op] = ppKf(kk, [[0, [0, 0.2, 0]], [0.3, [-6, 1.1, 1]], [1, [-18, 1, 0.9]]], E.aus);
    const x = cx + (f.xOff + f.size * 0.5) / S, y = cy + (-8 + f.size * 0.6 + dy) / S;
    ppFx2Glyphe(g, PP_FX2_WEDEL[f.art], { G: ppHex('#3b9159'), g: ppHex('#29663f'), R: ppHex('#e73b41') }, x, y, f.size * sc * 1.15, op, f.art === 'blatt' ? ppHex('#3b9159') : ppHex('#e73b41'));
  });
}, 1800, { breite: 180, hoehe: 240, ankerY: 130 }, {
  z: 10110,
  vorbereiten: () => ({
    ranken: Array.from({ length: ppFxN(8) }, (_, i) => ({ len: ppFx2Z(28, 46), delay: Math.random() * 200, dur: ppFx2Z(800, 1100), width: ppFx2Z(2.5, 4.5), farbe: ppHex(i % 3 === 0 ? '#780014' : i % 3 === 1 ? '#3b9159' : '#2b457e') })),
    wedel: Array.from({ length: 5 }, () => ({ xOff: ppFx2Z(-18, 18), delay: ppFx2Z(150, 400), dur: ppFx2Z(700, 900), size: ppFx2Z(10, 18), art: Math.random() < 0.5 ? 'blatt' : 'koralle' })),
  }),
});

// ═════════════════════════════════════════════════════════════════
//  12. Deepsea Spores Rain (`deepsea_spores_rain`) — Sporenregen über dem Spielfeld (ppFxN(180) Teilchen in Petrol, Blau, Dunkelblau, Rot, Dunkelrot, 3–10 px, mit hartem Schein), dazu ein
//  schwacher roter Hauch (nur dünn gedithert). Fällt wie vorher von oberhalb des Bildschirms bis zur Bildmitte (translate: Höhe/2 + 40 px).
// ═════════════════════════════════════════════════════════════════
const ppFx2SporenRegen = ppFx2Leinwand((g, t, sz, T, buf) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, gw = sz.gw, gh = sz.gh;
  // roter Hauch (2400 ms, Deckung 0 → 1 → 1 → 0, sehr schwach: Mitte 12 %), dünn gedithert
  const wo = ppKf(t / 2400, [[0, [0]], [0.3, [1]], [0.7, [1]], [1, [0]]], PP_FX2_E.eio)[0];
  if (wo > 0.02) {
    const col = ppHex('#8f0000'), wf = T.wf, thr = T.thr[0], N = gw * gh;
    for (let p = 0; p < N; p++) if (wf[p] * wo > thr[p]) { const q = p << 2; buf[q] = col[0]; buf[q + 1] = col[1]; buf[q + 2] = col[2]; buf[q + 3] = 255; }
  }
  T.sporen.forEach((s) => {
    const k = (t - s.delay) / s.dur;
    if (k < 0 || k > 1) return;
    const [dx, dy] = ppKf(k, [[0, [0, 0]], [0.5, [s.xEnd * 0.5 + s.wobble, s.yEnd * 0.5]], [1, [s.xEnd, s.yEnd]]], true), op = ppKf(k, [[0, [0]], [0.1, [s.opacity]], [0.9, [s.opacity]], [1, [0]]], true)[0];
    const x = Math.round(cx + (s.x0 + dx) / S), y = Math.round(cy + (s.y0 + dy) / S);
    if (s.size < 5) g.put(x, y, s.farbe, op);
    else {
      g.block(x - 1, y, 3, 1, s.farbe, op); g.block(x, y - 1, 1, 3, s.farbe, op);
      if (s.size >= 7.5) { g.put(x - 1, y - 1, s.farbe, op); g.put(x + 1, y + 1, s.farbe, op); }
    }
    const rr = s.size >= 7.5 ? 2 : 1;
    g.put(x - rr - 1, y, s.farbe, op * 0.3); g.put(x + rr + 1, y, s.farbe, op * 0.3); g.put(x, y - rr - 1, s.farbe, op * 0.3); g.put(x, y + rr + 1, s.farbe, op * 0.3);
  });
}, 3500, (p) => { const W = Math.max(p.w || window.innerWidth, 480), H = Math.max(p.h || window.innerHeight, 320); return { breite: W, hoehe: H }; }, {
  z: 10090,
  vorbereiten: (sz) => {
    const W = Math.max(sz.props.w || window.innerWidth, 480), H = Math.max(sz.props.h || window.innerHeight, 320);
    const farben = ['#7ce9dc', '#4e82cb', '#0351c9', '#b21a29', '#710122'];
    const gw = sz.gw, gh = sz.gh, wf = new Float32Array(gw * gh), hx = gw / 2, hy = gh / 2, gx = hx * 1.414, gy = hy * 1.414;
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
      const f = Math.hypot((i - hx) / gx, (j - hy) / gy);
      wf[j * gw + i] = f >= 0.85 ? 0 : (f < 0.55 ? 0.12 - 0.07 * (f / 0.55) : 0.05 * (1 - (f - 0.55) / 0.3)) * 0.9;
    }
    return {
      wf, thr: ppFx2Schwellen(gw, gh),
      sporen: Array.from({ length: ppFxN(180) }, () => ({ x0: Math.random() * W - W / 2, y0: -H / 2 - 40, xEnd: ppFx2Z(-60, 60), yEnd: H / 2 + 40, wobble: ppFx2Z(-30, 30), delay: Math.random() * 1400, dur: ppFx2Z(1300, 2000), size: ppFx2Z(3, 10), farbe: ppHex(ppFx2Wahl(farben)), opacity: ppFx2Z(0.55, 0.95) })),
    };
  },
});

// ═════════════════════════════════════════════════════════════════
//  13. Deepsea Summon Whirlpool (`deepsea_summon_whirlpool`) — dunkler Tintenschein, sechs ineinander schrumpfende schwarze Wasserringe, 28 Tintentropfen, die nach innen spiralen, 16 aufsteigende Blasen.
// ═════════════════════════════════════════════════════════════════
const ppFx2Whirlpool = ppR1Leinwand((g, t, sz, T) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, E = PP_FX2_E, cw = T.cw, ch = T.ch;
  // Tintenschein (1500 ms ease-in-out): Größe .5 → 1 → 1,05 → 1,1; Deckung 0 → 1 → .9 → 0
  if (t < 1500) {
    const [sc, op] = ppKf(t / 1500, [[0, [0.5, 0]], [0.3, [1, 1]], [0.8, [1.05, 0.9]], [1, [1.1, 0]]], E.eio), rx = (cw * sc) / S, ry = (ch * sc) / S, G = Math.hypot(cw, ch) * sc / S;
    ppFx2Verlauf(g, cx, cy, rx, ry, G, G, ppFx2R('whirlink', [[0, [18, 16, 31], 0.7], [0.45, [26, 26, 46], 0.45], [0.75, [0, 33, 63], 0.2], [1, [0, 33, 63], 0]]), op);
  }
  // sechs Ringe (Radius 90 − 10·i, Verzug i·70 ms, 1300 − 60·i ms): Größe 1,6 → 1,05 → .6 → .04; Deckung 0 → 1 → .9 → 0
  T.ringe.forEach((r) => {
    const k = (t - r.delay) / r.dur;
    if (k < 0 || k > 1) return;
    const [sc, op] = ppKf(k, [[0, [1.6, 0]], [0.25, [1.05, 1]], [0.6, [0.6, 0.9]], [1, [0.04, 0]]], E.ein), R = (r.radius * sc) / S, th = Math.max(1, Math.round((r.width * sc) / S));
    if (R < 1) return;
    ppFx2Ring(g, cx, cy, R + 3, 3, ppHex('#2d4362'), op * r.opacity * 0.4);       // harter Schein außen
    ppFx2Ring(g, cx, cy, R, th, ppHex('#12101f'), op * Math.min(1, r.opacity + 0.15));
    ppFx2Ring(g, cx, cy, R - th, 1, ppHex('#2d4362'), op * r.opacity * 0.55);      // innerer Rand
  });
  // Tintentropfen: spiralen zur Mitte (1000–1320 ms ab 0–380 ms)
  T.tropfen.forEach((d) => {
    const k = (t - d.delay) / d.dur;
    if (k < 0 || k > 1) return;
    const [f, sc] = ppKf(k, [[0, [0, 1]], [0.5, [0.4275, 0.85]], [1, [0.95, 0.06]]], E.ein), op = ppKf(k, [[0, [0]], [0.15, [0.95]], [0.5, [0.9]], [1, [0]]], E.ein)[0];
    const x = cx + (d.sx * (1 - f)) / S, y = cy + (d.sy * (1 - f)) / S, r = Math.max(1, Math.round((d.size * sc) / S));
    if (sc < 0.15) return;
    g.block(Math.round(x - r / 2) - 1, Math.round(y - r / 2), r + 2, r, ppHex('#1a1a2e'), op * 0.4);
    g.block(Math.round(x - r / 2), Math.round(y - r / 2) - 1, r, r + 2, ppHex('#1a1a2e'), op * 0.4);
    g.block(Math.round(x - r / 2), Math.round(y - r / 2), r, r, ppHex('#12101f'), op);
    if (r >= 2) g.put(Math.round(x - r / 2), Math.round(y - r / 2), ppHex('#405f8c'), op);
  });
  // Blasen steigen von unten auf (200–800 ms ab, 900–1400 ms)
  T.blasen.forEach((b) => {
    const k = (t - b.delay) / b.dur;
    if (k < 0 || k > 1) return;
    const [dx, dy, sc, op] = ppKf(k, [[0, [0, 0, 0.4, 0]], [0.2, [b.wobble * 0.4, b.dy * 0.2, 1, 1]], [0.6, [b.wobble, b.dy * 0.6, 1.05, 0.9]], [1, [b.wobble * 0.5, b.dy, 0.7, 0]]], E.aus);
    ppFx2Blase(g, cx + (b.x0 + b.size / 2 + dx) / S, cy + (b.y0 + b.size / 2 + dy) / S, (b.size * sc) / S, op, T.pal);
  });
}, 2250, (p) => {
  const cw = p.w || 100, ch = p.h || 140, hx = Math.ceil(Math.max(165, cw * 1.2 + 20)), oben = Math.ceil(Math.max(ch * 1.2 + 110, ch * 1.1 + 12, 170)), unten = Math.ceil(Math.max(ch * 1.1 + 12, ch * 0.6 + 70, 170));
  return { breite: hx * 2, hoehe: oben + unten, ankerY: oben };
}, {
  z: 10100,
  vorbereiten: (sz) => {
    const cw = sz.props.w || 100, ch = sz.props.h || 140, nT = ppFxN(28);
    return {
      cw, ch,
      pal: { rand: ppHex('#bddcef'), fuell: ppHex('#89abdc'), glanz: ppHex('#ffffff'), fa: 0.45 },
      ringe: Array.from({ length: ppFxN(6) }, (_, i) => ({ radius: 90 - i * 10, delay: i * 70, dur: 1300 - i * 60, opacity: 0.85 - i * 0.08, width: 5 - i * 0.4 })),
      tropfen: Array.from({ length: nT }, (_, i) => {
        const w = ((i / nT) * 360 + Math.random() * 12) * Math.PI / 180, d = ppFx2Z(95, 120);
        return { sx: Math.cos(w) * d, sy: Math.sin(w) * d, delay: Math.random() * 380, dur: ppFx2Z(1000, 1320), size: ppFx2Z(6, 15) };
      }),
      blasen: Array.from({ length: ppFxN(16) }, () => {
        const y0 = ch * 0.6 + Math.random() * 30;
        return { x0: -cw / 2 + Math.random() * cw, y0, dy: -ch * 1.2 - Math.random() * 60 - y0, size: ppFx2Z(6, 20), delay: ppFx2Z(200, 800), dur: ppFx2Z(900, 1400), wobble: ppFx2Z(-16, 16) };
      }),
    };
  },
});

// ═════════════════════════════════════════════════════════════════
//  Eintragen
// ═════════════════════════════════════════════════════════════════
ppFxUeberschreiben('cold_coffin_encase', ppFx2ColdCoffin);
ppFxUeberschreiben('concert_revival', ppFx2Konzert);
ppFxUeberschreiben('coolness_summon', ppFx2Coolness);
ppFxUeberschreiben('core_explosion', ppFx2Core);
ppFxUeberschreiben('corpse_explosion', ppFx2Corpse);
ppFxUeberschreiben('cute_hearts', ppFx2Hearts);
ppFxUeberschreiben('dark_blast', ppFx2DarkBlast);
ppFxUeberschreiben('decapitation', ppFx2Deka);
ppFxUeberschreiben('deep_sea_bubbles', ppFx2Bubbles);
ppFxUeberschreiben('deepsea_idol_negate', ppFx2IdolNegate);
ppFxUeberschreiben('deepsea_spores_growth', ppFx2SporenWachstum);
ppFxUeberschreiben('deepsea_spores_rain', ppFx2SporenRegen);
ppFxUeberschreiben('deepsea_summon_whirlpool', ppFx2Whirlpool);
