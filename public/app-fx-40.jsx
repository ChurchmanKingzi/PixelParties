// app-fx-40: Titelbildschirm-Blitze und Area-Naht als Pixelart-Leinwand
//
// ═════════════════════════════════════════════════════════════════
//  Vorher: drei SVG-Blitze (`.anim-bolt`, Vektor-Polylinien, Deckkraft per CSS-Animation `ab-strike`) im Titel-/Login-Bildschirm und eine SVG-Polylinie mit `blur` als Naht zwischen zwei
//  Area-Hintergründen (`op-seam`, app-areas.jsx). Jetzt: je EINE Leinwand, Rasterzelle = 3 CSS-Pixel (`image-rendering: pixelated`), feste Palettenfarben, kein Alpha, kein Weichzeichner.
//
//  PpFx40Blitze (in `.anim-lightning` der Kulisse): dieselben drei Zickzack-Linien (Punkte, Lage und Breite wie die alten SVGs: 15 % / 73 % / 53 % links, 9 % / 8 % / 8 % breit, oben −2 %, 62 %
//    hoch), Bresenham-Linien auf dem Zellgitter, aussen blau (3 Zellen), Kern hell (1 Zelle). Deckkraft-Verlauf `ab-strike` (10 s, auf den beiden Beben-Schlägen) bzw. `ab-strike-ambient` (13 s)
//    als Schlüsselbild-Tabelle; die Zwischenstufen werden mit Bayer-Dithering (4×4) statt Alpha gezeigt. Takt: Phase wird einmal aus der laufenden Beben-Animation (`.anim-shake`)
//    abgelesen, damit die Blitze mit Beben und Blitz-Flächen im Gleichtakt bleiben (sonst ab dem Einhängen).
//    Kosten: die Zellenlisten werden nur bei Größenänderung gebaut; je 30-Hz-Bild drei Schlüsselbild-Nachschläge, gezeichnet wird nur, wenn sich die Dither-Stufen ändern (nicht in den ~95 % ohne
//    Blitz). Läuft nur, solange die Leinwand sichtbar ist (IntersectionObserver); `prefers-reduced-motion`: nichts (wie vorher `animation: none` → Deckkraft 0).
//  PpFx40Naht (in app-areas.jsx): die Naht ist statisch; sie wird bei Größenänderung einmal gezeichnet — dunkles Band (3 Zellen, Dither 9/16) und gestrichelte helle Linie (1 Zelle, Dither 8/16)
//    entlang derselben gezackten Diagonale (Prozentpunkte). Kein Takt, keine Animation.
// ═════════════════════════════════════════════════════════════════
const PP_FX40_ZELLE = 3;                 // CSS-Pixel je Rasterzelle
const PP_FX40_TAKT = 1000 / 30;
const PP_FX40_KF_SCHLAG = [[0, 0], [0.6, 0], [1, 1], [1.8, 0.12], [2.6, 0.85], [4, 0], [49.5, 0], [50, 1], [50.8, 0.18], [51.6, 0.8], [53, 0], [100, 0]];   // = @keyframes ab-strike (style.css)
const PP_FX40_KF_AMBIENT = [[0, 0], [29.6, 0], [30, 0.9], [30.7, 0.12], [31.5, 0.72], [32.6, 0], [70.8, 0], [71.2, 0.68], [72.2, 0], [100, 0]];   // = @keyframes ab-strike-ambient
// Blitze: [links %, Breite %, Art (S = Einschlag 10 s, A = Ambient 13 s), Punkte im Kasten 100 × 400]
const PP_FX40_BLITZE = [
  [15, 9, 'S', [[52, 0], [40, 70], [62, 80], [38, 150], [60, 165], [34, 240], [58, 255], [30, 340], [50, 360], [42, 400]]],
  [73, 8, 'S', [[48, 0], [62, 75], [38, 88], [60, 160], [36, 175], [58, 250], [34, 265], [56, 345], [40, 375], [50, 400]]],
  [53, 8, 'A', [[50, 0], [58, 80], [40, 92], [60, 175], [38, 190], [56, 270], [36, 285], [52, 370], [46, 400]]],
];
const ppFx40Kf = (pts, x) => {
  for (let i = 0; i + 1 < pts.length; i++) {
    if (x >= pts[i][0] && x <= pts[i + 1][0]) { const u = (x - pts[i][0]) / ((pts[i + 1][0] - pts[i][0]) || 1); return pts[i][1] + (pts[i + 1][1] - pts[i][1]) * u; }
  }
  return 0;
};

/** Bresenham-Linie zwischen zwei Zellen; ruft `f(x, y, n)` je Zelle (n = laufende Nummer). */
function ppFx40Linie(x0, y0, x1, y1, f) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy, n = 0;
  for (;;) {
    f(x0, y0, n++);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

function ppFx40Ruhig() {
  try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
}

// Alle Zellen einer Linienfolge mit Strichstärke `dick` (Zellen), ohne Doppelte, als [x0, y0, x1, y1, …]
function ppFx40Zellen(punkte, dick, cw, ch) {
  const seen = new Set(), out = [];
  const setze = (x, y) => {
    for (let j = 0; j < dick; j++) for (let i = 0; i < dick; i++) {
      const xx = x - (dick >> 1) + i, yy = y - (dick >> 1) + j;
      if (xx < 0 || yy < 0 || xx >= cw || yy >= ch) continue;
      const k = yy * cw + xx;
      if (!seen.has(k)) { seen.add(k); out.push(xx, yy); }
    }
  };
  for (let i = 0; i + 1 < punkte.length; i++) ppFx40Linie(punkte[i][0], punkte[i][1], punkte[i + 1][0], punkte[i + 1][1], setze);
  return out;
}

function ppFx40BlitzeStart(cv) {
  const raf = window.ppTaktRaf || window.requestAnimationFrame;
  if (ppFx40Ruhig()) return undefined;
  const ctx = cv.getContext('2d');
  let cw = 0, ch = 0, form = null, gestoppt = false, sichtbar = false, id = 0, letzter = -1, schluessel = '', t0 = -1;

  const phaseLesen = () => {            // Beginn der Beben-Animation (gleiche Uhr wie die Blitz-Flächen daneben), sonst Einhängezeit
    try {
      const sh = cv.closest('.anim-shake');
      const an = sh && sh.getAnimations && sh.getAnimations().find((a) => a.animationName === 'ab-shake');
      if (an && an.currentTime != null) return performance.now() - Number(an.currentTime);
    } catch (e) { /* Rückfall */ }
    return performance.now();
  };

  function bauen(w, h) {                // nur bei Größenänderung
    const z = PP_FX40_ZELLE;
    const ncw = Math.max(1, Math.ceil(w / z)), nch = Math.max(1, Math.ceil(h / z));
    if (ncw !== cv.width || nch !== cv.height) { cv.width = ncw; cv.height = nch; }
    cw = ncw; ch = nch;
    form = PP_FX40_BLITZE.map(([links, breit, art, pts]) => {
      const P = pts.map(([px, py]) => [(links + px / 100 * breit) / 100 * cw, (-2 + py / 400 * 62) / 100 * ch]);
      return { art, aussen: ppFx40Zellen(P, 3, cw, ch), kern: ppFx40Zellen(P, 1, cw, ch) };
    });
    schluessel = '';
  }

  function zeichnen(t) {
    if (!form) return;
    if (t0 < 0) t0 = phaseLesen();
    const lauf = window.__ppFx40Lauf != null ? window.__ppFx40Lauf : Math.max(0, t - t0);   // nur Tests: Phase festhalten
    const pS = (lauf % 10000) / 100, pA = (lauf % 13000) / 130;
    const st = [ppFx40Kf(PP_FX40_KF_SCHLAG, pS), ppFx40Kf(PP_FX40_KF_AMBIENT, pA)];
    const stufen = form.map((f) => { const a = f.art === 'S' ? st[0] : st[1]; return a < 0.1 ? 0 : Math.max(1, Math.round(a * 16)); });
    const key = stufen.join(',');
    if (key === schluessel) return;                       // nichts geändert (auch der Dauerzustand „kein Blitz“)
    schluessel = key;
    ctx.clearRect(0, 0, cw, ch);
    const bay = window.ppBayer;
    const fuell = (zellen, stufe, farbe) => {
      ctx.fillStyle = farbe;
      ctx.beginPath();
      for (let i = 0; i < zellen.length; i += 2) {
        const x = zellen[i], y = zellen[i + 1];
        if (stufe >= 16 || bay(x, y) < stufe / 16) ctx.rect(x, y, 1, 1);
      }
      ctx.fill();
    };
    form.forEach((f, i) => { if (stufen[i]) fuell(f.aussen, stufen[i], '#66b6ff'); });
    form.forEach((f, i) => { if (stufen[i]) fuell(f.kern, stufen[i], '#e5f5fa'); });
  }

  function tick(t) {
    id = 0;
    if (gestoppt || !sichtbar) return;
    const fr = Math.floor(t / PP_FX40_TAKT);
    if (fr !== letzter) {                                  // nur bei neuem 30-Hz-Bild
      letzter = fr;
      const zm = window.__ppFx40Zeit;                      // nur Tests: Kosten je Bild sammeln
      if (zm) { const a = performance.now(); zeichnen(performance.now()); zm.push(performance.now() - a); } else zeichnen(performance.now());
    }
    id = raf(tick);
  }
  function anwerfen() { if (!id && form && sichtbar && !gestoppt) id = raf(tick); }

  let ro = null, io = null;
  try { ro = new ResizeObserver((es) => { const r = es[es.length - 1].contentRect; if (r.width > 0 && r.height > 0) { bauen(r.width, r.height); anwerfen(); } }); ro.observe(cv); } catch (e) { /* ohne */ }
  try { io = new IntersectionObserver((es) => { sichtbar = es[es.length - 1].isIntersecting; if (sichtbar) anwerfen(); }); io.observe(cv); } catch (e) { sichtbar = true; }
  if (!ro) { bauen(cv.clientWidth || 1, cv.clientHeight || 1); anwerfen(); }
  return () => {
    gestoppt = true;
    if (id) { try { cancelAnimationFrame(id); } catch (e) { /* weg */ } id = 0; }
    if (ro) ro.disconnect();
    if (io) io.disconnect();
  };
}

function PpFx40Blitze() {
  const ref = React.useRef(null);
  React.useEffect(() => (ref.current ? ppFx40BlitzeStart(ref.current) : undefined), []);
  return <canvas ref={ref} className="pp-fx40-blitze" data-pp-px="aus" aria-hidden="true" />;
}
window.PpFx40Blitze = PpFx40Blitze;

function ppFx40NahtZeichnen(cv, seam) {
  const w = cv.clientWidth, h = cv.clientHeight;
  if (!(w > 0 && h > 0)) return;
  const z = PP_FX40_ZELLE, cw = Math.max(1, Math.ceil(w / z)), ch = Math.max(1, Math.ceil(h / z));
  if (cw !== cv.width || ch !== cv.height) { cv.width = cw; cv.height = ch; }
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cw, ch);
  const P = seam.map((p) => [p.x / 100 * cw, p.y / 100 * ch]);
  const bay = window.ppBayer;
  const band = ppFx40Zellen(P, 3, cw, ch);
  // gestrichelte Kernlinie: 3 an, 2 aus, 1 an, 2 aus (Zellen entlang der Linie)
  const MUSTER = [1, 1, 1, 0, 0, 1, 0, 0], kern = [], seen = new Set();
  let n = 0;
  for (let i = 0; i + 1 < P.length; i++) {
    ppFx40Linie(P[i][0], P[i][1], P[i + 1][0], P[i + 1][1], (x, y) => {
      const k = y * cw + x;
      if (MUSTER[(n++) % MUSTER.length] && x >= 0 && y >= 0 && x < cw && y < ch && !seen.has(k)) { seen.add(k); kern.push(x, y); }
    });
  }
  const fuell = (zellen, stufe, farbe) => {
    ctx.fillStyle = farbe; ctx.beginPath();
    for (let i = 0; i < zellen.length; i += 2) if (bay(zellen[i], zellen[i + 1]) < stufe / 16) ctx.rect(zellen[i], zellen[i + 1], 1, 1);
    ctx.fill();
  };
  fuell(band, 9, '#08060c');
  fuell(kern, 8, '#fff8e8');
}

function PpFx40Naht({ seam }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const cv = ref.current; if (!cv) return undefined;
    let ro = null;
    const los = () => ppFx40NahtZeichnen(cv, seam);
    try { ro = new ResizeObserver(los); ro.observe(cv); } catch (e) { los(); }
    return () => { if (ro) ro.disconnect(); };
  }, [seam]);
  return <canvas ref={ref} className="pp-fx40-naht" data-pp-px="aus" aria-hidden="true" />;
}
window.PpFx40Naht = PpFx40Naht;
