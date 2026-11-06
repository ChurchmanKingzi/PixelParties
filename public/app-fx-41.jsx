// app-fx-41: Zielpfad (Zielmarken-Ebene) als Pixelart-Leinwand statt SVG-Linie mit Pfeilspitze-Marker
//
// ═════════════════════════════════════════════════════════════════
//  Vorher (app-board.jsx, `ZielMarkenEbene`): je Pfadsegment (#1 → #2 → #3 …) zwei SVG-<line> (runde Linie, halbtransparent) + <marker> mit weich gezeichneter Pfeilspitze, die
//  Striche liefen per CSS-Animation (`zielPfadLauf`, stroke-dashoffset) — Vektor, Alpha, Dauer-Animation.
//  Jetzt: EINE Leinwand (Rastermaß = Hero-Pixel (`ppFxZelle`; vorher 3 px), `image-rendering: pixelated`, Fensterhülle der Zielmarken-Ebene) für ALLE Segmente. Linie = Treppenlinie in ganzen Zellen (1 Zelle dick), Striche 3 an / 3 aus
//  wie die alten 10/8 px, wandern in ganzen Zellen vorwärts (6 Schritte je 0,9 s wie `zielPfadLauf`); Schatten = Schachbrett-Raster (Dithering statt Alpha) um die Linie; Spitze = gefülltes
//  Pixel-Dreieck (7 Zellen lang und breit, Spitze 2 Zellen über dem Ziel-Endpunkt hinaus) mit Dither-Rand.
//  Kosten: gezeichnet wird nur, wenn sich Segmente ODER der Strich-Versatz (≈ 7 ×/s) ändern; dazwischen tut der 30-Hz-Takt nichts außer einem Zahlenvergleich. Ohne Segmente: Leinwand
//  leer, kein Takt. Kein Layout-Lesen im Takt (Größe: nur bei Fenstergröße). Rückfall: fehlt `window.PpZielPfad`, nimmt app-board.jsx den alten SVG-Pfad.
// ═════════════════════════════════════════════════════════════════
const PP_FX41_S = 3;                       // Rückfall der Zellgröße (CSS-px); gezeichnet wird mit der Hero-Pixel-Zelle (`ppFx41Zelle`, Phase 2)
/** Rasterzelle der Fenster-Ebenen dieser Datei = Hero-Pixel der eigenen Reihe (`ppFxZelle`, app-board.jsx); nur beim Aufbau/bei Größen- und Segmentwechsel gelesen, nie im Takt. */
function ppFx41Zelle() {
  try { if (typeof ppFxZelle === 'function') return ppFxZelle(null); } catch (e) { /* Rückfall */ }
  return PP_FX41_S;
}
/** Zelle am Ziel-Element (Zone/Hero-Kind): Hero-Pixel der Reihe, in der es liegt. */
function ppFx41ZelleFuer(el) {
  try { if (typeof ppFxZelle === 'function') return ppFxZelle(el); } catch (e) { /* Rückfall */ }
  return PP_FX41_S;
}
const PP_FX41_TAKT = 1000 / 30;
const PP_FX41_LAUF = 900;                  // ms je Strich-Periode (wie zielPfadLauf)
const PP_FX41_PERIODE = 6;                 // Zellen je Strich + Lücke
const PP_FX41_STRICH = 3;
const PP_FX41_KOPF = 7;                    // Länge/Breite der Pfeilspitze in Zellen
const PP_FX41_ROT = '#fe5154';
const PP_FX41_SCHATTEN = '#2a0404';

function ppFx41Zeichne(ctx, gw, gh, segs, versatz, schattenMuster, S) {
  ctx.clearRect(0, 0, gw, gh);
  S = S || PP_FX41_S;
  const sch = [];
  // 1) Schatten (Schachbrett) entlang jeder Linie und um die Spitze
  ctx.fillStyle = schattenMuster || PP_FX41_SCHATTEN;
  for (const sg of segs) {
    const ax = sg.ax / S, ay = sg.ay / S, bx = sg.bx / S, by = sg.by / S;
    const d = Math.hypot(bx - ax, by - ay);
    if (!(d >= 1)) continue;
    const ux = (bx - ax) / d, uy = (by - ay) / d;
    const L = PP_FX41_KOPF, hw = PP_FX41_KOPF / 2;
    const tx = bx + ux * 2, ty = by + uy * 2;             // Spitze
    const lang = Math.max(0, d - (L - 2));                // Linie reicht bis zur Basis der Spitze
    let lx = -1e9, ly = -1e9;
    for (let n = 0; n <= lang * 2; n++) {
      const p = Math.min(n * 0.5, lang);
      const cx = Math.floor(ax + ux * p), cy = Math.floor(ay + uy * p);
      if (cx === lx && cy === ly) continue;
      lx = cx; ly = cy;
      ctx.fillRect(cx - 1, cy - 1, 3, 3);
    }
    // Spitzen-Rand: Zellen im um 1 aufgeweiteten Dreieck
    const nx = -uy, ny = ux;
    const x0 = Math.floor(tx - L - 2), x1 = Math.ceil(tx + L + 2), y0 = Math.floor(ty - L - 2), y1 = Math.ceil(ty + L + 2);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const rx = x + 0.5 - tx, ry = y + 0.5 - ty;
      const a = -(rx * ux + ry * uy), c = rx * nx + ry * ny;
      if (a >= -1 && a <= L + 1 && Math.abs(c) <= (Math.max(a, 0) / L) * hw + 1) ctx.fillRect(x, y, 1, 1);
    }
    sch.push({ ax, ay, ux, uy, d, tx, ty, nx, ny, lang });
  }
  // 2) Striche (wandern vorwärts)
  ctx.fillStyle = PP_FX41_ROT;
  for (const s of sch) {
    let lx = -1e9, ly = -1e9;
    for (let n = 0; n <= s.lang * 2; n++) {
      const p = Math.min(n * 0.5, s.lang);
      const cx = Math.floor(s.ax + s.ux * p), cy = Math.floor(s.ay + s.uy * p);
      if (cx === lx && cy === ly) continue;
      lx = cx; ly = cy;
      const ph = (((Math.floor(p) - versatz) % PP_FX41_PERIODE) + PP_FX41_PERIODE) % PP_FX41_PERIODE;
      if (ph < PP_FX41_STRICH) ctx.fillRect(cx, cy, 1, 1);
    }
    // 3) Spitze (voll)
    const L = PP_FX41_KOPF, hw = PP_FX41_KOPF / 2;
    const x0 = Math.floor(s.tx - L - 1), x1 = Math.ceil(s.tx + L + 1), y0 = Math.floor(s.ty - L - 1), y1 = Math.ceil(s.ty + L + 1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const rx = x + 0.5 - s.tx, ry = y + 0.5 - s.ty;
      const a = -(rx * s.ux + ry * s.uy), c = rx * s.nx + ry * s.ny;
      if (a >= 0 && a <= L && Math.abs(c) <= (a / L) * hw) ctx.fillRect(x, y, 1, 1);
    }
  }
}

function PpZielPfadInnen({ segmente }) {
  const ref = React.useRef(null);
  const segRef = React.useRef(segmente);
  const stoss = React.useRef(null);                       // Aufwecker des Takts
  segRef.current = segmente;
  const sig = segmente.map((s) => Math.round(s.ax) + ',' + Math.round(s.ay) + ',' + Math.round(s.bx) + ',' + Math.round(s.by)).join('|');
  const sigRef = React.useRef(sig);
  sigRef.current = sig;

  React.useEffect(() => {
    const cv = ref.current;
    if (!cv) return undefined;
    const raf = window.ppTaktRaf || window.requestAnimationFrame;
    const ctx = cv.getContext('2d');
    let ruhig = false;
    try { ruhig = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { /* bewegt */ }
    let muster = null;
    try {
      const m = document.createElement('canvas'); m.width = 2; m.height = 2;
      const g = m.getContext('2d'); g.fillStyle = PP_FX41_SCHATTEN; g.fillRect(0, 0, 1, 1); g.fillRect(1, 1, 1, 1);
      muster = ctx.createPattern(m, 'repeat');
    } catch (e) { muster = null; }
    let gw = 0, gh = 0, id = 0, tot = false, letzte = '', zS = 0;
    const groesse = () => {
      const S = ppFx41Zelle();
      const w = Math.ceil((window.innerWidth || 1280) / S), h = Math.ceil((window.innerHeight || 720) / S);
      if (w !== gw || h !== gh || S !== zS) {
        zS = S; gw = w; gh = h; cv.width = w; cv.height = h;
        cv.style.width = (w * S) + 'px'; cv.style.height = (h * S) + 'px';
        letzte = '';
      }
    };
    const tick = (t) => {
      id = 0;
      if (tot) return;
      const segs = segRef.current;
      if (!segs.length) { if (letzte !== 'leer') { ctx.clearRect(0, 0, gw, gh); letzte = 'leer'; } return; }
      const versatz = ruhig ? 0 : Math.floor(((t % PP_FX41_LAUF) / PP_FX41_LAUF) * PP_FX41_PERIODE);
      const schl = versatz + '#' + sigRef.current;
      if (schl !== letzte) {
        letzte = schl;
        const zm = window.__ppFx41Zeit;                    // nur Tests: Kosten je Bild sammeln
        if (zm) { const a = performance.now(); ppFx41Zeichne(ctx, gw, gh, segs, versatz, muster, zS); zm.push(performance.now() - a); }
        else ppFx41Zeichne(ctx, gw, gh, segs, versatz, muster, zS);
      }
      if (!ruhig) id = raf(tick);
    };
    const wecke = () => { if (!id && !tot) id = raf(tick); };
    stoss.current = () => { groesse(); wecke(); };           // Segmentwechsel: Zelle neu lesen (Tutorial-Zoom), dann zeichnen
    groesse();
    const beiGroesse = () => { groesse(); wecke(); };
    window.addEventListener('resize', beiGroesse);
    wecke();
    return () => {
      tot = true; stoss.current = null;
      if (id) { try { cancelAnimationFrame(id); } catch (e) { /* weg */ } id = 0; }
      window.removeEventListener('resize', beiGroesse);
    };
  }, []);

  // Segmente geändert → Takt (neu) anwerfen; ohne Segmente läuft er nach dem Leeren aus
  React.useEffect(() => { if (stoss.current) stoss.current(); }, [sig]);

  return <canvas ref={ref} className="ziel-pfad-pixel" data-pp-px="aus" aria-hidden="true"
    style={{ position: 'fixed', left: 0, top: 0, imageRendering: 'pixelated', pointerEvents: 'none' }} />;
}
window.PpZielPfad = React.memo(PpZielPfadInnen);

// ═════════════════════════════════════════════════════════════════
//  Gemeinsame Bausteine (Präfix ppFx41 / PP_FX41)
// ═════════════════════════════════════════════════════════════════
const ppFx41Pal = (c) => (window.ppSnapRgb ? window.ppSnapRgb(c[0], c[1], c[2]) : c);
const ppFx41Farbe = (css, standard) => ppFx41Pal(ppFx29Lies(css) || ppHex(standard));
const ppFx41Mix = (a, b, f) => ppFx41Pal([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]);
const ppFx41Ease = ppFx7Bez(0, 0, 0.58, 1);                    // CSS ease-out
const ppFx41K = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
/** Punkte entlang einer Quadratkurve (Raster), Schritt ≈ `schritt` Zellen; liefert { p: [[x, y, s]…], L }. */
function ppFx41Kurve(x0, y0, cx, cy, x1, y1, schritt) {
  const grob = Math.hypot(cx - x0, cy - y0) + Math.hypot(x1 - cx, y1 - cy);
  const n = Math.max(2, Math.ceil(grob / schritt)), p = [];
  let L = 0, lx = x0, ly = y0;
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t;
    const x = a * x0 + b * cx + c * x1, y = a * y0 + b * cy + c * y1;
    L += Math.hypot(x - lx, y - ly); lx = x; ly = y;
    p.push([x, y, L]);
  }
  return { p, L };
}

// ═════════════════════════════════════════════════════════════════
//  Magische Fäden (`play_tether_animation`, Soul Transmigration Ritual) — PIXELART statt SVG-Pfade mit Weichzeichner/drop-shadow.
//  Ablauf wie `.tether-*` (style.css): je Faden (40 ms versetzt) wächst die Kurve in 35 % der Dauer von der Quelle zum Ziel (ease-out), pulsiert (Kern 1 ↔ 2 Zellen im Fünftel-Takt),
//  helle Strichfolge fließt zum Ziel (30–80 %), Quelle = wachsende Scheibe mit Dither-Schein, drei Funken laufen je zweimal über die Kurve, am Ziel pulsiert ein Ring (.4 → 1 → 1,5),
//  ab 80 % blendet alles per Bayer-Dither aus. Schleier = gedithertes Band (statt blur), Schein = Dither-Ring. EINE Leinwand je Ereignis (ppR1Leinwand, 30 Hz).
//  Eigenschaften: x, y = Ziel (Feld-Koordinaten), faeden [{ sx, sy, cx, cy }], dur, color, glow.
// ═════════════════════════════════════════════════════════════════
const PP_FX41_FLUSS = ppHex('#d9c0ec'), PP_FX41_FUNKE = ppHex('#f1e5fa');
const PpFx41Faeden = ppR1Leinwand((g, t, sz, te) => {
  const S = sz.S, dur = te.dur, C = te.C;
  te.faeden.forEach((f, i) => {
    const lt = t - i * 40, u = lt / dur;
    if (u < 0 || u > 1) return;
    const aus = u > 0.8 ? 1 - (u - 0.8) / 0.2 : 1;
    if (aus <= 0.02) return;
    const gr = ppFx41Ease(ppFx41K(u / 0.35)), bis = f.L * gr;
    const pt = f.p;
    // Schleier (breites, gedithertes Band) und Kern
    const th = 1 + (Math.floor(lt / (dur / 5)) & 1);
    for (let k = 0; k < pt.length; k += 2) {
      if (pt[k][2] > bis) break;
      g.block(pt[k][0] - 2, pt[k][1] - 2, 5, 5, C.glow, 0.4 * aus);
    }
    for (const q of pt) {
      if (q[2] > bis) break;
      g.block(q[0] - (th > 1 ? 1 : 0), q[1] - (th > 1 ? 1 : 0), th, th, C.farbe, aus);
    }
    // fließende helle Striche (30–80 %)
    if (u > 0.3 && u < 0.8) {
      const a = u < 0.4 ? (u - 0.3) / 0.1 : 1, off = Math.floor(((lt / (dur / 3)) % 1) * 8);
      for (const q of pt) {
        if (q[2] > bis) break;
        if ((((Math.floor(q[2]) - off) % 8) + 8) % 8 < 2) g.put(q[0], q[1], PP_FX41_FLUSS, a * aus);
      }
    }
    // Quelle: Scheibe mit Dither-Schein (.2 → 3 Zellen)
    const [qa, qr] = ppKf(u, [[0, [0, 0.7]], [0.2, [1, 3]], [0.8, [0.9, 2.3]], [1, [0, 1]]]);
    if (qa > 0.02) { g.disc(f.p[0][0], f.p[0][1], qr + 1.6, C.glow, 0.35 * qa); g.disc(f.p[0][0], f.p[0][1], qr, C.farbe, qa); }
    // drei Funken, je zweimal über die Kurve (0,45 der Dauer je Lauf)
    if (u > 0.2 && u < 0.88) for (let k = 0; k < 3; k++) {
      const beg = dur * 0.22 + k * dur * 0.12, lauf = dur * 0.45, w = (lt - beg) / lauf;
      if (w < 0 || w >= 2) continue;
      const s = (w % 1) * f.L;
      let j = 0; while (j < pt.length - 1 && pt[j][2] < s) j++;
      const x = pt[j][0], y = pt[j][1];
      g.disc(x, y, k === 0 ? 2.4 : 1.8, C.farbe, 0.6 * aus);
      g.block(x - 1, y - 1, k === 0 ? 3 : 2, k === 0 ? 3 : 2, PP_FX41_FUNKE, aus);
    }
  });
  // Ziel-Ring (30 → 100 %)
  const u = t / dur;
  if (u > 0.3 && u <= 1) {
    const [a, sc] = ppKf(u, [[0.3, [0, 0.4]], [0.55, [1, 1]], [0.85, [0.8, 1.25]], [1, [0, 1.5]]], true);
    if (a > 0.02) {
      const r = 26 * sc / S, cx = sz.cx, cy = sz.cy;
      g.ring(cx, cy, r + 1, r + 4, C.glow, 0.35 * a);
      g.ring(cx, cy, r - 1, r + 1, C.farbe, a);
    }
  }
}, 5000, (p) => {
  let x0 = p.x, x1 = p.x, y0 = p.y, y1 = p.y;
  for (const f of p.faeden) { x0 = Math.min(x0, f.sx, f.cx); x1 = Math.max(x1, f.sx, f.cx); y0 = Math.min(y0, f.sy, f.cy); y1 = Math.max(y1, f.sy, f.cy); }
  const m = 70;
  return { breite: x1 - x0 + 2 * m, hoehe: y1 - y0 + 2 * m, ankerX: p.x - x0 + m, ankerY: p.y - y0 + m };
}, {
  z: 10195,
  vorbereiten: (sz) => {
    const p = sz.props, S = sz.S;
    const farbe = ppFx41Farbe(p.color, '#b866ff'), glow = ppFx41Farbe(p.glow, '#50008c');
    const zu = (wx, wy) => [sz.cx + (wx - p.x) / S, sz.cy + (wy - p.y) / S];
    const faeden = p.faeden.map((f) => {
      const a = zu(f.sx, f.sy), c = zu(f.cx, f.cy), b = zu(p.x, p.y), k = ppFx41Kurve(a[0], a[1], c[0], c[1], b[0], b[1], 0.6);
      return k;
    });
    return { dur: p.dur || 1400, faeden, C: { farbe, glow: ppFx41Mix(glow, [10, 6, 16], 0.25) } };
  },
});
window.PpFx41Faeden = PpFx41Faeden;

// ═════════════════════════════════════════════════════════════════
//  Tharxian Horse (`play_tharxian_charge`) — PIXELART statt Bézier-SVG mit Schatten, Dreh- und Skaliersprüngen.
//  Das Holzpferd ist ein Pixelbild (je 3 px eine Zelle, einmal aus denselben Formen wie das alte SVG gerastert: Körper, Hals, Kopf, Mähne, Ohren, Augenglut, Beine, Räder, Schweif), Galopp-Wippen
//  1 Zelle im 220-ms-Takt, Spiegelung bei Fahrt nach links. Zeitplan wie `tharxianHorseRoll` (Einrollen 0–8 %, Fahrt bis 78 % auf dem Ziel, Einschlag-Zittern 84–90 % als Zellen-Ruck, dann
//  ausblinken); Staubwölkchen = Dither-Scheiben im Wirbel hinter dem Pferd; Einschlag bei 78 % der Fahrtdauer: Doppelring, Blitz, 12 Holzsplitter (Pixelstriche), 6 Holzklötze, Bodenstaub.
//  Eigenschaften: x, y = Start (Feld-Koordinaten), tx, ty = Ziel, dur, nachRechts.
// ═════════════════════════════════════════════════════════════════
const PP_FX41_HOLZ = { b: '#6e4421', o: '#3a2412', k: '#4a2a10', d: '#27180c', l: '#5a341a', a: '#ff8b1a', r: '#1f0f04', m: '#5a341a' };
let _ppFx41PferdBild = null;
/** Das Pferd als Zeichenzeilen (Zelle = 3 SVG-Einheiten, Ausschnitt −10 … 135 × −4 … 104). */
function ppFx41PferdBild() {
  if (_ppFx41PferdBild) return _ppFx41PferdBild;
  const U = 3, W = 49, H = 37, gr = Array.from({ length: H }, () => Array(W).fill('.'));
  const zx = (i) => -10 + i * U + U / 2, zy = (j) => -4 + j * U + U / 2;
  const quad = (a, c, b, n = 14) => Array.from({ length: n + 1 }, (_, i) => { const t = i / n; return [(1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0], (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1]]; });
  const inPoly = (pts, x, y) => { let in_ = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) if ((pts[i][1] > y) !== (pts[j][1] > y) && x < ((pts[j][0] - pts[i][0]) * (y - pts[i][1])) / (pts[j][1] - pts[i][1]) + pts[i][0]) in_ = !in_; return in_; };
  const fuell = (inside, fill, rand) => {                       // Form füllen, Randzellen in `rand`
    const m = Array.from({ length: H }, (_, j) => Array.from({ length: W }, (_, i) => inside(zx(i), zy(j))));
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      if (!m[j][i]) continue;
      const kante = !(m[j - 1] && m[j - 1][i]) || !(m[j + 1] && m[j + 1][i]) || !m[j][i - 1] || !m[j][i + 1];
      gr[j][i] = (kante && rand) ? rand : fill;
    }
  };
  const strich = (pts, c) => { for (const [x, y] of pts) { const i = Math.floor((x + 10) / U), j = Math.floor((y + 4) / U); if (gr[j] && i >= 0 && i < W) gr[j][i] = c; } };
  const gerade = (x0, y0, x1, y1) => Array.from({ length: 30 }, (_, i) => [x0 + (x1 - x0) * i / 29, y0 + (y1 - y0) * i / 29]);
  const ell = (cx, cy, rx, ry) => (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
  strich(quad([12, 46], [0, 50], [-2, 64]).concat(quad([-2, 64], [4, 58], [8, 60]), quad([8, 60], [4, 68], [10, 70]), quad([10, 70], [6, 76], [14, 74])), 'o');   // Schweif
  fuell(ell(48, 48, 38, 17), 'b', 'o');                                                                                                                       // Körper
  const koerper = ell(48, 48, 38, 17);
  for (const y of [44, 50, 55]) for (const [x, yy] of gerade(14, y, 84, y)) if (koerper(x, yy)) strich([[x, yy]], 'k');                                       // Maserung
  for (const x of [24, 40, 56, 72]) strich([[x, 48]], 'd');                                                                                                   // Bolzen
  const hals = [[78, 38]].concat(quad([78, 38], [85, 22], [100, 14]), [[110, 22]], quad([110, 22], [100, 30], [88, 50]));
  fuell((x, y) => inPoly(hals, x, y), 'b', 'o');                                                                                                              // Hals
  strich(quad([82, 40], [90, 26], [102, 18]), 'k');
  const mahne = [[82, 34], [84, 26], [87, 33], [90, 22], [94, 30], [97, 18], [100, 26], [103, 14]];
  fuell((x, y) => inPoly(mahne, x, y), 'k', null);                                                                                                            // Mähne
  const kopf = quad([100, 10], [120, 8], [124, 18]).concat(quad([124, 18], [126, 28], [116, 32]), [[105, 30]], quad([105, 30], [99, 22], [102, 12]));
  fuell((x, y) => inPoly(kopf, x, y), 'b', 'o');                                                                                                              // Kopf
  strich(gerade(105, 22, 120, 20), 'k');
  fuell((x, y) => inPoly([[106, 10], [108, 2], [111, 11]], x, y), 'l', 'o');                                                                                  // Ohren
  fuell((x, y) => inPoly([[100, 12], [102, 4], [105, 13]], x, y), 'k', 'o');
  strich([[116, 20]], 'a'); strich([[121, 25]], 'd'); strich(gerade(116, 29, 122, 29), 'd');                                                                  // Auge, Nüstern, Maul
  for (const x of [18, 34, 56, 72]) fuell((px, py) => px >= x && px <= x + 9 && py >= 63 && py <= 85, 'l', 'o');                                              // Beine
  for (const cx of [24, 76]) {                                                                                                                                // Räder
    fuell(ell(cx, 86, 7, 7), 'o', 'r');
    strich(gerade(cx, 79, cx, 93), 'r'); strich(gerade(cx - 7, 86, cx + 7, 86), 'r');
    fuell(ell(cx, 86, 2.5, 2.5), 'b', null);
  }
  _ppFx41PferdBild = gr.map((r) => r.join(''));
  return _ppFx41PferdBild;
}
const PP_FX41_PFERD_PAL = (() => { const o = {}; for (const k of Object.keys(PP_FX41_HOLZ)) o[k] = ppHex(PP_FX41_HOLZ[k]); return o; })();
const PP_FX41_STAUB = ['#886c44', '#b29466'].map(ppHex);
const PP_FX41_RING_B = ppFx7Bez(0.15, 0.8, 0.3, 1), PP_FX41_SPL_B = ppFx7Bez(0.3, 0.65, 0.4, 1), PP_FX41_CK_B = ppFx7Bez(0.3, 0.55, 0.5, 1), PP_FX41_ROLL_B = ppFx7Bez(0.22, 0.8, 0.38, 1);
const PpFx41Pferd = ppR1Leinwand((g, t, sz, te) => {
  const S = sz.S, dur = te.dur, cx = sz.cx, cy = sz.cy, dx = te.dx / S, dy = te.dy / S;
  // ── Pferd ──
  const u = t / dur;
  if (u <= 1) {
    const f = ppFx7Kf(u, [[0, 0], [0.08, 0], [0.18, 0.2], [0.62, 0.85], [0.78, 1], [1, 1]], PP_FX41_ROLL_B);
    const hx = cx + 7.5 / S + dx * f, hy = cy + 4 / S + dy * f;
    const bob = (Math.floor(t / 220) & 1) ? 1 : 0, ruck = (u > 0.84 && u < 0.9) ? -1 : (u >= 0.9 && u < 0.96 ? 1 : 0), setz = (u > 0.78 && u < 0.84) ? 1 : 0;
    let a = u < 0.04 ? 0.5 : 1;
    if (u > 0.9) a = 1 - (u - 0.9) / 0.1;
    if (a > 0.02) {
      // Staubwölkchen hinter dem Pferd (5 Stück, Takt 700 ms, je 120 ms versetzt)
      for (let i = 0; i < 5; i++) {
        const w = (((t - i * 120) % 700) + 700) % 700 / 700;
        if (t < i * 120 || u < 0.08) continue;
        const [pa, ps] = ppKf(w, [[0, [0, 0.4]], [0.2, [0.85, 1]], [1, [0, 1.6]]]);
        const px0 = (te.rechts ? -32 - i * 6 : 32 + i * 6), py0 = 50 + (i % 2) * 8, r = (14 + i * 3) * ps / 2 / S;
        ppFx7Glow(g, hx + (px0 * (0.4 + 1.2 * w)) / S, hy + (py0 - 12 * w) / S, Math.max(1.2, r), Math.max(1.2, r), PP_FX41_STAUB, pa * a * 0.9, 1);
      }
      g.spr(te.bild, PP_FX41_PFERD_PAL, hx + ruck, hy + 1 + setz - bob - 0, a, !te.rechts);
    }
  }
  // ── Einschlag ──
  const ex = cx + dx, ey = cy + dy, t0 = dur * 0.78, w = t - t0;
  if (w < 0) return;
  const fe = ppFx41K(w / 650);
  if (fe < 1) {                                                              // Blitz (Scheibe 80 px · 0 → 2,6 → 3,8)
    const sc = ppFx7Kf(fe, [[0, 0], [0.2, 2.6], [1, 3.8]], ppFx41Ease), a = fe < 0.2 ? fe / 0.2 : 1 - (fe - 0.2) / 0.8;
    const r = 40 * sc / S;
    if (r > 1) ppFx7Glow(g, ex, ey, r, r, [ppHex('#ff9b3a'), ppHex('#fbe181'), ppHex('#fff8e8')], a * 0.9, 1.8);
  }
  const ring = (verz, ms, farbe, glow) => {
    const k = (w - (verz - t0)) / ms;
    if (k < 0 || k > 1) return;
    const e = PP_FX41_RING_B(k), r = (20 + 260 * e) / 2 / S, th = Math.max(1, Math.round((8 - 7 * e) / S * 1.3)), a = k < 0.5 ? 1 - k * 0.3 : 0.85 * (1 - (k - 0.5) / 0.5);
    g.ring(ex, ey, r, r + 1.5 + th, glow, 0.35 * a);
    g.ring(ex, ey, r - th, r + 0.5, farbe, a);
  };
  ring(t0, 750, ppHex('#fbe181'), ppHex('#ffd066'));
  ring(dur * 0.82, 600, ppHex('#f9ac20'), ppHex('#ffd066'));
  te.splitter.forEach((s, i) => {                                            // 12 Splitter (Striche in Flugrichtung)
    const k = (w - i * 15) / 900;
    if (k < 0 || k > 1) return;
    const e = PP_FX41_SPL_B(k), a = k < 0.1 ? k / 0.1 : 1 - (k - 0.1) / 0.9, x = ex + s.dx * e / S, y = ey + s.dy * e / S, ux = Math.cos(s.an) * 3, uy = Math.sin(s.an) * 3;
    g.line(x - ux / 2, y - uy / 2, x + ux / 2, y + uy / 2, PP_FX41_PFERD_PAL.k, a, 2);
    g.put(x + ux / 2, y + uy / 2, PP_FX41_PFERD_PAL.l, a);
  });
  te.kloetze.forEach((c, i) => {                                             // 6 Klötze (4 × 4 Zellen mit Rand)
    const k = (w - i * 25) / 1000;
    if (k < 0 || k > 1) return;
    const e = PP_FX41_CK_B(k), a = k < 0.08 ? k / 0.08 : 1 - (k - 0.08) / 0.92, x = Math.round(ex + c.dx * e / S), y = Math.round(ey + c.dy * e / S);
    g.block(x - 2, y - 2, 4, 4, PP_FX41_PFERD_PAL.r, a); g.block(x - 1, y - 1, 2, 2, PP_FX41_PFERD_PAL.b, a);
  });
  const fd = (w - dur * 0.02) / 800;                                         // Bodenstaub (140 × 60 px, .3 → 1,1 → 2), 20 ms nach dem Blitz
  if (fd >= 0 && fd <= 1) {
    const [a, sc] = ppKf(fd, [[0, [0, 0.3]], [0.25, [1, 1.1]], [1, [0, 2]]]);
    ppFx7Glow(g, ex, ey, 70 * sc / S, 30 * sc / S, PP_FX41_STAUB, a * 0.8, 1);
  }
}, 5000, (p) => {
  const m = 190;
  const x0 = Math.min(0, p.tx) - m, x1 = Math.max(0, p.tx) + m, y0 = Math.min(0, p.ty) - m, y1 = Math.max(0, p.ty) + m;
  return { breite: x1 - x0, hoehe: y1 - y0, ankerX: -x0, ankerY: -y0 };
}, {
  z: 10131,
  vorbereiten: (sz) => {
    const p = sz.props;
    return {
      dur: p.dur || 1100, dx: p.tx, dy: p.ty, rechts: p.nachRechts !== false, bild: ppFx41PferdBild(),
      splitter: Array.from({ length: ppFxN(12) }, (_, i) => { const an = (i / 12) * Math.PI * 2 + (Math.random() - 0.5) * 0.3, d = 90 + Math.random() * 50; return { an, dx: Math.cos(an) * d, dy: Math.sin(an) * d }; }),
      kloetze: Array.from({ length: ppFxN(6) }, (_, i) => { const an = (i / 6) * Math.PI * 2 + Math.PI / 12, d = 60 + Math.random() * 30; return { dx: Math.cos(an) * d, dy: Math.sin(an) * d - 20 }; }),
    };
  },
});
window.PpFx41Pferd = PpFx41Pferd;

// ═════════════════════════════════════════════════════════════════
//  Gathering Storm (Dauer-Überlagerung des Brettes) — PIXELART auf EINER Leinwand statt 22 animierter, weichgezeichneter Wolken-Divs und einer SVG mit feGaussianBlur.
//  Himmel: dunkelrotes Schachbrett-Raster (Dither statt multiply-Verlauf). Wolken: vier Pixel-Wolkenbilder (aus den vier Ellipsen der alten Wolke, Rand ausgedithert, einmal gebacken), die in
//  ganzen Zellen im 30-Hz-Takt über das Brett ziehen (8–15 s je Durchzug, ein Viertel gegenläufig, Start über den Zyklus verteilt). Blitze: sechs gezackte Pfade (Hauptlinie + Abzweig, wie
//  im alten SVG in Prozent des Brettes), je Schlag 450–850 ms, im Wechsel mit 380–1130 ms Pause; Rand rot (gedithert), Kern rosa-weiß; flackert 0 → 1 → .7 → 1 → 0 durch Blinken. Ton wie vorher.
//  Kosten: ein Takt, nur sichtbar (IntersectionObserver); Wolken = drawImage ganzer Bilder, Himmel = ein Bild; kein Layout-Lesen im Takt.
// ═════════════════════════════════════════════════════════════════
const PP_FX41_WOLKE = [   // [Mitte x, y (px, Skala 1), rx, ry, Farbe, Randdeckung]
  [0, 0, 65, 18, '#5b0102'], [7, -14, 39, 18, '#780014'], [37.5, -11, 32.5, 15, '#5b0102'], [2.5, 11, 47.5, 7, '#3a0000'],
];
function ppFx41WolkenBild(skala, S) {
  const ell = PP_FX41_WOLKE.map(([x, y, rx, ry, c]) => ({ x: x * skala / S, y: y * skala / S, rx: rx * skala / S, ry: ry * skala / S, c: ppHex(c) }));
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const e of ell) { x0 = Math.min(x0, e.x - e.rx); x1 = Math.max(x1, e.x + e.rx); y0 = Math.min(y0, e.y - e.ry); y1 = Math.max(y1, e.y + e.ry); }
  const ox = Math.floor(x0) - 1, oy = Math.floor(y0) - 1, w = Math.ceil(x1) - ox + 2, h = Math.ceil(y1) - oy + 2;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(w, h), d = img.data;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const X = i + ox + 0.5, Y = j + oy + 0.5;
    let best = null, bd = 2;
    for (const e of ell) {                                      // oberste Ellipse, deren Dither-Deckung an dieser Zelle trifft (Rand läuft aus, Mitte voll)
      const dd = Math.sqrt(((X - e.x) / e.rx) ** 2 + ((Y - e.y) / e.ry) ** 2);
      if (dd >= 0.95) continue;
      const a = dd < 0.55 ? 0.92 - dd * 0.4 : 0.7 * (1 - (dd - 0.55) / 0.4);
      if (a > ppBayer(i, j)) { best = e; bd = dd; }
    }
    if (best) { const q = ppFx41Pal(best.c); const k = (j * w + i) * 4; d[k] = q[0]; d[k + 1] = q[1]; d[k + 2] = q[2]; d[k + 3] = 255; }
  }
  ctx.putImageData(img, 0, 0);
  return { cv, ox, oy, w, h };
}
const PP_FX41_SKALEN = [1.5, 2.0, 2.5, 3.0];
function PpFx41SturmInnen() {
  const wurzel = React.useRef(null), leinwand = React.useRef(null), himmelRef = React.useRef(null);
  React.useEffect(() => {
    const wz = wurzel.current, cv = leinwand.current, hv = himmelRef.current;
    if (!wz || !cv || !hv) return undefined;
    let S = ppFx41Zelle();                                    // Rasterzelle = Hero-Pixel (Phase 2; vorher fest 3); bei Fenstergröße neu gelesen
    const raf = window.ppTaktRaf || window.requestAnimationFrame, ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const wolken = Array.from({ length: ppFxN(22) }, () => ({
      y: -8 + Math.random() * 116, b: Math.floor(Math.random() * PP_FX41_SKALEN.length), dur: 8 + Math.random() * 7,
      ph: Math.random() * 14, rev: Math.random() < 0.25,
    }));
    const blitze = Array.from({ length: ppFxN(6) }, () => {
      const x1 = 12 + Math.random() * 76, y1 = 8 + Math.random() * 30, x2 = x1 + (-25 + Math.random() * 50), y2 = 35 + Math.random() * 50;
      const mx = (x1 + x2) / 2 + (-8 + Math.random() * 16), my = (y1 + y2) / 2 + (-5 + Math.random() * 10);
      return { p: [[x1, y1], [mx, my], [x2, y2]], fork: [[mx, my], [mx + (-12 + Math.random() * 24), my + (4 + Math.random() * 14)]], dur: 450 + Math.random() * 400 };
    });
    let bilder = null, himmel = null, gw = 0, gh = 0, tot = false, sichtbar = true, id = 0, letzter = -1, schlag = null, timer = 0;
    const rot = ppHex('#ef2929'), kern = ppHex('#f0bfbc');
    const css = (c) => 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
    const groesse = (w, h) => {
      const S2 = ppFx41Zelle();
      if (S2 !== S) { S = S2; if (bilder) bilder = PP_FX41_SKALEN.map((s) => ppFx41WolkenBild(s, S)); gw = 0; gh = 0; }
      const nw = Math.max(8, Math.ceil(w / S)), nh = Math.max(8, Math.ceil(h / S));
      if (nw === gw && nh === gh) return;
      gw = nw; gh = nh; cv.width = nw; cv.height = nh; cv.style.width = nw * S + 'px'; cv.style.height = nh * S + 'px';
      himmel = hv; himmel.width = nw; himmel.height = nh; himmel.style.width = nw * S + 'px'; himmel.style.height = nh * S + 'px';   // dunkelrotes Schachbrett (Dither statt multiply-Verlauf): eigene, ruhende Leinwand unter den Wolken — wird nur bei Größenänderung gemalt, nicht mehr in jedem Bild über die ganze Fläche kopiert (Zelle = Hero-Pixel → mehr Zellen)
      const hc = himmel.getContext('2d'), im = hc.createImageData(nw, nh), c = ppFx41Pal(ppHex('#2a0404'));
      for (let j = 0; j < nh; j++) for (let i = 0; i < nw; i++) {
        const dx = (i / nw - 0.5) * 2, dy = (j / nh - 0.5) * 2, r = Math.min(1, Math.sqrt(dx * dx + dy * dy) / 1.2);
        if (0.12 + 0.18 * r > ppBayer(i, j)) { const k = (j * nw + i) * 4; im.data[k] = c[0]; im.data[k + 1] = c[1]; im.data[k + 2] = c[2]; im.data[k + 3] = 255; }
      }
      hc.putImageData(im, 0, 0);
    };
    const bolzen = (pts, fr, glow) => {
      const kette = ppR1Kette(pts.map(([x, y]) => [x / 100 * gw, y / 100 * gh]));
      if (glow) { ctx.fillStyle = css(rot); for (const [x, y] of kette) for (let k = 0; k < 9; k++) { const ox = (k % 3) - 1, oy = Math.floor(k / 3) - 1; if (((x + y + ox + oy + fr) & 1) === 0 && (ox || oy)) ctx.fillRect(x + ox, y + oy, 1, 1); } }
      else { ctx.fillStyle = css(kern); for (const [x, y] of kette) ctx.fillRect(x, y, 1, 1); }
    };
    const zeichnen = (jetzt) => {
      if (!(gw > 0)) return;
      ctx.clearRect(0, 0, gw, gh);
      if (bilder) for (const c of wolken) {
        const f = ((((jetzt / 1000 + c.ph) / c.dur) % 1) + 1) % 1, p = c.rev ? 1 - f : f, b = bilder[c.b];
        const x = Math.round((-0.25 + 1.5 * p) * gw + b.ox), y = Math.round(c.y / 100 * gh + b.oy);
        ctx.drawImage(b.cv, x, y);
      }
      if (schlag) {
        const u = (jetzt - schlag.t0) / schlag.b.dur;
        if (u >= 1) schlag = null;
        else {
          const v = u < 0.12 ? u / 0.12 : u < 0.25 ? 1 - 0.3 * (u - 0.12) / 0.13 : u < 0.4 ? 0.7 + 0.3 * (u - 0.25) / 0.15 : 1 - (u - 0.4) / 0.6, fr = Math.floor(jetzt / (1000 / 30));
          if (v > 0.08 && !(v < 0.6 && (fr & 1))) {
            if (v > 0.5) { bolzen(schlag.b.p, fr, true); bolzen(schlag.b.fork, fr, true); }
            bolzen(schlag.b.p, fr, false); bolzen(schlag.b.fork, fr, false);
          }
        }
      }
    };
    const tick = (jetzt) => {
      id = 0;
      if (tot || !sichtbar) return;
      const fr = Math.floor(jetzt / (1000 / 30));
      if (fr !== letzter) { letzter = fr; const zm = window.__ppFx41SturmZeit; if (zm) { const a = performance.now(); zeichnen(jetzt); zm.push(performance.now() - a); } else zeichnen(jetzt); }
      id = raf(tick);
    };
    const an = () => { if (!id && !tot && sichtbar && bilder) id = raf(tick); };
    const feuer = () => {
      if (tot) return;
      schlag = { b: blitze[Math.floor(Math.random() * blitze.length)], t0: performance.now() };
      if (window.playSFX) window.playSFX('elem_lightning', { volume: 0.12, dedupe: 250, category: 'effect' });
      timer = setTimeout(feuer, 380 + Math.random() * 750);
    };
    let ro = null, io = null;
    try { ro = new ResizeObserver((es) => { const r = es[es.length - 1].contentRect; if (r.width > 0) { groesse(r.width, r.height); if (!id) zeichnen(performance.now()); } }); ro.observe(wz); } catch (e) { groesse(wz.clientWidth || 600, wz.clientHeight || 400); }
    try { io = new IntersectionObserver((es) => { sichtbar = es[es.length - 1].isIntersecting; if (sichtbar) an(); }); io.observe(wz); } catch (e) { /* immer */ }
    const los = () => {
      if (tot) return;
      bilder = PP_FX41_SKALEN.map((s) => ppFx41WolkenBild(s, S));
      if (!(gw > 0)) groesse(wz.clientWidth || 600, wz.clientHeight || 400);
      zeichnen(performance.now());
      an();
    };
    const idle = window.requestIdleCallback ? window.requestIdleCallback(los, { timeout: 300 }) : setTimeout(los, 30);
    const erst = setTimeout(feuer, 250 + Math.random() * 600);
    return () => {
      tot = true; clearTimeout(erst); clearTimeout(timer);
      if (id) { try { cancelAnimationFrame(id); } catch (e) { /* weg */ } }
      try { window.cancelIdleCallback ? window.cancelIdleCallback(idle) : clearTimeout(idle); } catch (e) { /* weg */ }
      if (ro) ro.disconnect(); if (io) io.disconnect();
    };
  }, []);
  return (
    <div ref={wurzel} className="gathering-storm-overlay" data-pp-px="aus" aria-hidden="true"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      <canvas ref={himmelRef} style={{ position: 'absolute', left: 0, top: 0, imageRendering: 'pixelated' }} />
      <canvas ref={leinwand} style={{ position: 'absolute', left: 0, top: 0, imageRendering: 'pixelated' }} />
    </div>
  );
}
window.PpFx41Sturm = React.memo(PpFx41SturmInnen);

// ═════════════════════════════════════════════════════════════════
//  Kamerablitz-Zeichen (`cameraFlash`, Mittelpunkt des Fotos) — Pixelbild statt SVG mit Rundungen und gedrehten Ellipsen: 20 × 20 Zellen (je 6 px), nur <rect> mit crispEdges, ganzzahlig.
// ═════════════════════════════════════════════════════════════════
const PP_FX41_KAMERA = (() => {
  const W = 20, rosa = '#fc69c6', weiss = '#ffffff', dunkel = '#222222', blau = '#1ca9fd';
  const raster = Array.from({ length: W }, () => Array(W).fill(null));
  const setze = (i, j, c) => { if (i >= 0 && j >= 0 && i < W && j < W) raster[j][i] = c; };
  const U = 5;                                                           // SVG-Einheiten je Zelle
  const rrect = (x, y, w, h, r) => (px, py) => px >= x && px <= x + w && py >= y && py <= y + h && !((px < x + r && py < y + r && Math.hypot(px - x - r, py - y - r) > r) || (px > x + w - r && py < y + r && Math.hypot(px - x - w + r, py - y - r) > r) || (px < x + r && py > y + h - r && Math.hypot(px - x - r, py - y - h + r) > r) || (px > x + w - r && py > y + h - r && Math.hypot(px - x - w + r, py - y - h + r) > r));
  const fuell = (inside, fill, rand) => {
    const m = Array.from({ length: W }, (_, j) => Array.from({ length: W }, (_, i) => inside(i * U + U / 2, j * U + U / 2)));
    for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) {
      if (!m[j][i]) continue;
      const kante = !(m[j - 1] && m[j - 1][i]) || !(m[j + 1] && m[j + 1][i]) || !m[j][i - 1] || !m[j][i + 1];
      setze(i, j, kante && rand ? rand : fill);
    }
  };
  // Blitz-Bögen (die beiden gedrehten Ellipsen, nur Linie): je ein Viertelbogen als Stufenlinie
  const bogen = (cx, cy, rx, ry, w) => { for (let a = 0; a < 6.3; a += 0.12) { const x = Math.cos(a) * rx, y = Math.sin(a) * ry, X = cx + x * Math.cos(w) - y * Math.sin(w), Y = cy + x * Math.sin(w) + y * Math.cos(w); setze(Math.floor(X / U), Math.floor(Y / U), rosa); } };
  bogen(28, 22, 10, 16, -Math.PI / 6); bogen(72, 22, 10, 16, Math.PI / 6);
  fuell(rrect(20, 30, 60, 45, 8), rosa, weiss);
  fuell(rrect(38, 24, 24, 10, 3), rosa, weiss);
  fuell((x, y) => Math.hypot(x - 50, y - 52) <= 14, dunkel, weiss);
  fuell((x, y) => Math.hypot(x - 50, y - 52) <= 8, blau, null);
  let rects = '';
  for (let j = 0; j < W; j++) {
    let i = 0;
    while (i < W) {
      const c = raster[j][i];
      if (!c) { i++; continue; }
      let k = i; while (k < W && raster[j][k] === c) k++;
      rects += `<rect x="${i}" y="${j}" width="${k - i}" height="1" fill="${c}"/>`;
      i = k;
    }
  }
  return rects;
})();
function PpFx41Kamera() {
  return <svg viewBox="0 0 20 20" width="120" height="120" shapeRendering="crispEdges" data-pp-px="aus" dangerouslySetInnerHTML={{ __html: PP_FX41_KAMERA }} />;
}
window.PpFx41Kamera = PpFx41Kamera;

// ═════════════════════════════════════════════════════════════════
//  Crimson Web — das bleibende Netz auf dem gefesselten Helden (`CrimsonWebOverlay`) — PIXELART auf einer Leinwand statt SVG-Pfade mit drop-shadow, Verlauf und Farb-Animation.
//  Gleiche Geometrie wie `ppR1CrimsonWeb` (12 Speichen, 6 durchhängende Ringe, in das Kartenrechteck gestreckt), Netz als Pixelketten in Karmesinrot; rötliches Dither-Raster als Tönung;
//  Schimmer (2,6 s: #b21a29 ↔ #e73b41) in vier Stufen; Einblenden 450–870 ms und 1-s-Ausblenden per Bayer-Dither. Gezeichnet wird nur bei Änderung (Stufe/Deckung), sonst nur ein Zahlenvergleich.
// ═════════════════════════════════════════════════════════════════
let _ppFx41Netz = null;
function PpFx41NetzLeinwand({ weg }) {
  const wurzel = React.useRef(null), leinwand = React.useRef(null), wegRef = React.useRef(weg), tWeg = React.useRef(0);
  if (weg && !wegRef.current) tWeg.current = performance.now();
  wegRef.current = weg;
  React.useEffect(() => {
    const wz = wurzel.current, cv = leinwand.current;
    if (!wz || !cv) return undefined;
    let S = ppFx41ZelleFuer(wz);                              // Rasterzelle = Hero-Pixel des Helden, auf dem das Netz liegt (Phase 2; vorher fest 3)
    const raf = window.ppTaktRaf || window.requestAnimationFrame, ctx = cv.getContext('2d'), t0 = performance.now();
    if (!_ppFx41Netz) _ppFx41Netz = ppR1NetzEcken(52, 72, 12, 6);
    const netz = _ppFx41Netz, TON = ppFx41Pal(ppHex('#3a0000'));
    const stufen = [ppHex('#b21a29'), ppFx41Mix(ppHex('#b21a29'), ppHex('#e73b41'), 0.33), ppFx41Mix(ppHex('#b21a29'), ppHex('#e73b41'), 0.66), ppHex('#e73b41')].map(ppFx41Pal);
    const css = (c) => 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
    let gw = 0, gh = 0, tot = false, id = 0, letzte = '', zS = 0;
    const groesse = (w, h) => {
      S = ppFx41ZelleFuer(wz);
      const nw = Math.max(4, Math.ceil(w / S)), nh = Math.max(4, Math.ceil(h / S));
      if (nw === gw && nh === gh && S === zS) return;
      zS = S;
      gw = nw; gh = nh; cv.width = nw; cv.height = nh; cv.style.width = nw * S + 'px'; cv.style.height = nh * S + 'px'; letzte = '';
    };
    const zeichne = (farbe, a) => {
      ctx.clearRect(0, 0, gw, gh);
      if (a <= 0) return;
      const dp = (x, y, dichte) => { if (dichte > ppBayer(x, y)) ctx.fillRect(x, y, 1, 1); };
      ctx.fillStyle = css(TON);
      for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) { const dx = (i / gw - 0.5) * 2, dy = (j / gh - 0.5) * 2, r = Math.min(1, Math.hypot(dx, dy) / 1.2); dp(i, j, (0.12 + 0.12 * r) * a); }
      ctx.fillStyle = css(farbe);
      const sx = gw / 100, sy = gh / 140, cx = gw / 2, cy = gh / 2;
      const kette = (pts) => { for (const [x, y] of ppR1Kette(pts.map(([px, py]) => [cx + px * sx, cy + py * sy]))) if (x >= 0 && y >= 0 && x < gw && y < gh) dp(x, y, a); };
      for (const e of netz.speichen) kette(e);
      for (const e of netz.ringe) kette(e);
    };
    const tick = (jetzt) => {
      id = 0;
      if (tot) return;
      let a = ppFx41K((jetzt - t0 - 450) / 420);
      if (wegRef.current) a = Math.min(a, 1 - ppFx41K((jetzt - tWeg.current) / 1000));
      a = Math.round(a * 8) / 8;
      const ph = Math.floor((((jetzt - t0) % 2600) / 2600) * 6), farbe = [0, 1, 2, 3, 2, 1][ph];
      const schl = a + '|' + farbe + '|' + gw + 'x' + gh;
      if (schl !== letzte) { letzte = schl; zeichne(stufen[farbe], a); }
      id = raf(tick);
    };
    let ro = null;
    try { ro = new ResizeObserver((es) => { const r = es[es.length - 1].contentRect; if (r.width > 0) groesse(r.width, r.height); }); ro.observe(wz); } catch (e) { groesse(wz.clientWidth || 68, wz.clientHeight || 95); }
    groesse(wz.clientWidth || 68, wz.clientHeight || 95);
    id = raf(tick);
    return () => { tot = true; if (id) { try { cancelAnimationFrame(id); } catch (e) { /* weg */ } } if (ro) ro.disconnect(); };
  }, []);
  return (
    <div ref={wurzel} className="crimson-web-px" data-pp-px="aus" aria-hidden="true"
      style={{ position: 'absolute', inset: 0, zIndex: 5, pointerEvents: 'none', overflow: 'hidden' }}>
      <canvas ref={leinwand} style={{ position: 'absolute', left: 0, top: 0, imageRendering: 'pixelated' }} />
    </div>
  );
}
function PpFx41NetzInnen({ aktiv }) {
  const [phase, setPhase] = React.useState(aktiv ? 'an' : 'aus');
  const phaseRef = React.useRef(phase);
  phaseRef.current = phase;
  React.useEffect(() => {
    if (aktiv) { setPhase('an'); return undefined; }
    if (phaseRef.current !== 'an') return undefined;
    setPhase('weg');
    const t = setTimeout(() => setPhase('aus'), 1000);
    return () => clearTimeout(t);
  }, [aktiv]);
  if (phase === 'aus') return null;
  return <PpFx41NetzLeinwand weg={phase === 'weg'} />;
}
window.PpFx41Netz = PpFx41NetzInnen;

// ═════════════════════════════════════════════════════════════════
//  Surefire Shot (`projectileShape: 'surefire'`, `WeissPfeil`) — PIXELART statt SVG-Pfeil (Polygone), drop-shadow-Schein, Verlaufs-Schweif und gedrehter Funken.
//  Pfeil: 8-Zellen-Spitze + Schaft (32 Zellen) als Pixelkette in Flugrichtung, weiße Leuchtspur (1–2 Zellen mit gedithertem Schein-Band), die dem Pfeil nachwächst und nach der Landung
//  320 ms ausdithert; Mündungsblitz an der Quelle, Einschlag (Blitz, Ring, zehn Funkenstriche) bei der Ankunft. Eigenschaften: x, y = Quelle, tx, ty = Ziel (relativ), dur.
// ═════════════════════════════════════════════════════════════════
const PpFx41Surefire = ppR1Leinwand((g, t, sz, te) => {
  const S = sz.S, d = te.dur, W = ppHex('#ffffff'), B = ppHex('#bddcef'), M = ppHex('#e5f5fa');
  const ax = sz.cx, ay = sz.cy, bx = sz.cx + te.dx / S, by = sz.cy + te.dy / S, L = Math.hypot(bx - ax, by - ay) || 1, ux = (bx - ax) / L, uy = (by - ay) / L, nx = -uy, ny = ux;
  // Mündungsblitz (46 px · .2 → 1,5, Deckung 0 → 1 → 0, 260 ms)
  if (t < 260) { const k = t / 260, a = k < 0.3 ? k / 0.3 : 1 - (k - 0.3) / 0.7, r = 23 * (0.2 + 1.3 * k) / S; if (r > 1) ppFx7Glow(g, ax, ay, r, r, [B, M, W], a, 1); }
  const kopf = ppFx41K(t / d), hx = ax + (bx - ax) * kopf, hy = ay + (by - ay) * kopf;
  // Leuchtspur: wächst mit dem Pfeil, nach der Landung 320 ms ausblenden
  const aus = t <= d ? 1 : 1 - ppFx41K((t - d) / 320);
  if (aus > 0.02) {
    ppR1Band(g, ax, ay, hx, hy, () => ({ w: 6, c: B }), 0.3 * aus);
    ppR1Band(g, ax, ay, hx, hy, (u) => ({ w: 2, c: u < 0.3 ? M : W }), aus);
  }
  // Pfeil (verschwindet in 110 ms nach der Landung)
  const pa = t <= d ? 1 : 1 - ppFx41K((t - d) / 110);
  if (pa > 0.02) {
    const tl = Math.min(32, kopf * L + 4);
    g.line(hx - ux * tl, hy - uy * tl, hx - ux * 8, hy - uy * 8, W, pa, 1);
    for (let k = 0; k <= 8; k++) { const w = Math.round((k / 8) * 2); for (let q = -w; q <= w; q++) g.put(hx - ux * (8 - k) + nx * q, hy - uy * (8 - k) + ny * q, k < 3 ? M : W, pa); }
    g.put(hx + ux, hy + uy, W, pa);
  }
  // Einschlag
  const w = t - d;
  if (w >= 0) {
    if (w < 340) { const k = w / 340, a = k < 0.3 ? k / 0.3 : 1 - (k - 0.3) / 0.7, r = 45 * (0.2 + 1.3 * k) / S; if (r > 1) ppFx7Glow(g, bx, by, r, r, [B, M, W], a, 1); }
    if (w < 380) { const k = w / 380, e = ppFx41Ease(k), r = 28 * (0.3 + 2.1 * e) / S, a = 1 - k; g.ring(bx, by, r, r + 1.2, W, a); g.ring(bx, by, r + 1.2, r + 2.6, B, a * 0.4); }
    if (w < 340) te.funken.forEach((f) => {
      const k = w / 340, e = ppFx41Ease(k), a = 1 - k, a0 = 6 + 40 * e, l = f.l * (0.4 + 0.6 * e) / S * 1.2, c = Math.cos(f.w), s = Math.sin(f.w);
      g.line(bx + c * a0 / S, by + s * a0 / S, bx + c * (a0 / S + l), by + s * (a0 / S + l), W, a, 1);
    });
  }
}, 2000, (p) => {
  const m = 90, x0 = Math.min(0, p.tx) - m, x1 = Math.max(0, p.tx) + m, y0 = Math.min(0, p.ty) - m, y1 = Math.max(0, p.ty) + m;
  return { breite: x1 - x0, hoehe: y1 - y0, ankerX: -x0, ankerY: -y0 };
}, {
  z: 10097,
  vorbereiten: (sz) => ({ dur: sz.props.dur || 170, dx: sz.props.tx, dy: sz.props.ty, funken: Array.from({ length: 10 }, (_, i) => ({ w: (i * 36 + ((i * 17) % 13)) * Math.PI / 180, l: 16 + ((i * 29) % 22) })) }),
});
window.PpFx41Surefire = PpFx41Surefire;

// ═════════════════════════════════════════════════════════════════
//  Blutiger Schnitt (`bloody_cut`, Doctor Fester / Ghoul Guard; Bleed) — PIXELART statt SVG-Pfaden mit drop-shadow. Wie `.anim-cut-*`: heller Blitz (350 ms), Wundlippen (rosa Gewebe mit
//  dunkelrotem Rand, öffnen sich in 30 %, 0,9 s ab 80 ms), nasse Innenkante (1 s ab 120 ms), dunkle Schnittlinie (zieht sich in 0,28 s, blendet ab 75 % von 1,2 s aus), zehn Blutspritzer
//  und sechs Tropfen, die über die untere Lippe laufen. Dichte/Deckung per Bayer-Dither, Öffnen als Zeilen-Stauchung in ganzen Zellen.
// ═════════════════════════════════════════════════════════════════
const PP_FX41_SCHNITT = {
  fleisch: [[-46, -2], [-30, -8], [-14, -3], [2, -9], [18, -2], [34, -7], [46, 0], [34, 9], [18, 4], [2, 11], [-14, 5], [-30, 10]],
  nass: [[-44, 0], [-30, -5], [-14, -1], [2, -6], [18, 0], [34, -4], [44, 1], [34, 6], [18, 2], [2, 8], [-14, 3], [-30, 7]],
  linie: [[-46, 0], [-30, -4], [-14, 0], [2, -5], [18, 1], [34, -3], [46, 1]],
};
const ppFx41Bloody = ppR1Leinwand((g, t, sz, te) => {
  const S = sz.S, cx = sz.cx, cy = sz.cy, C = te.C;
  const fk = t / 350;                                                       // Blitz: scaleX .1 → 1,2, Deckung 1 → 0
  if (fk >= 0 && fk <= 1) { const sc = 0.1 + 1.1 * ppFx41Ease(fk); ppFx7Glow(g, cx, cy, 70 * sc / S, 25 / S, [C.dunkel, C.rosa, C.weiss], 0.8 * (1 - fk), 1); }
  const oeffnen = (verz, ms) => { const u = (t - verz) / ms; if (u < 0 || u > 1) return null; return { sy: 0.1 + 0.9 * ppFx41Ease(ppFx41K(u / 0.3)), a: u > 0.8 ? 1 - (u - 0.8) / 0.2 : 1 }; };
  const poly = (pts, sy, c, a) => ppFx7Poly(g, pts.map(([x, y]) => [cx + x / S, cy + y * sy / S]), c, a);
  const fl = oeffnen(80, 900);
  if (fl && fl.a > 0.02) {
    poly(te.fleisch.rand, fl.sy, C.rand, fl.a); poly(te.fleisch.innen, fl.sy, C.rosa, fl.a);
  }
  const nn = oeffnen(120, 1000);
  if (nn && nn.a > 0.02) poly(PP_FX41_SCHNITT.nass, nn.sy, C.blut, nn.a);
  // dunkle Schnittlinie: zieht sich in 280 ms von links nach rechts, hält bis 75 % von 1,2 s, blendet aus
  const lk = t / 1200;
  if (lk >= 0 && lk <= 1) {
    const f = ppFx41K(t / 280) * (te.linie.length - 1), a = lk < 0.75 ? 1 : 1 - (lk - 0.75) / 0.25, pts = te.linie;
    for (let i = 1; i < pts.length; i++) {
      const e = ppFx41K(f - (i - 1));
      if (e <= 0) break;
      g.line(cx + pts[i - 1][0] / S, cy + pts[i - 1][1] / S, cx + (pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * e) / S, cy + (pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * e) / S, C.dunkelrot, a, 1);
    }
  }
  te.spritzer.forEach((s) => {                                              // bloodDrop 0,6 s: 0 → 35 % hin, dann fallen und ausblenden
    const k = (t - s.delay) / 600;
    if (k < 0 || k > 1) return;
    const e = ppFx7Kf(k, [[0, 0], [0.35, 1], [1, 1]], ppFx41Ease), fall = k > 0.35 ? (k - 0.35) / 0.65 * 30 : 0, a = k < 0.35 ? 1 : 1 - (k - 0.35) / 0.65;
    const x = cx + s.dx * e / S, y = cy + (s.dy * e + fall) / S, w = Math.max(1, Math.round(s.size / S)), h = Math.max(2, Math.round(s.size * 1.6 / S));
    g.block(x - w / 2, y - h / 2, w, h, C.blut, a);
    if (w > 1) g.put(x, y - h / 2, C.hell, a);
  });
  te.tropfen.forEach((d) => {                                               // cutDrip: wächst (scaleY .2 → 1), fällt 30 px, Deckung 0 → 1 (25 %) → 0
    const k = (t - d.delay) / d.dur;
    if (k < 0 || k > 1) return;
    const sy = 0.2 + 0.8 * ppFx41K(k / 0.4), a = k < 0.25 ? k / 0.25 : 1 - (k - 0.25) / 0.75, y0 = cy + (4 + 30 * k * k) / S, len = Math.max(2, Math.round(d.len * sy / S));
    for (let j = 0; j < len; j++) g.block(cx + d.ox / S - 0.5, y0 + j, 1 + (len > 5 && j < len - 2 ? 0 : 0), 1, j < len * 0.35 ? C.hell : j < len * 0.8 ? C.blut : C.dunkelrot, a);
  });
}, 1500, { breite: 260, hoehe: 170 }, {
  z: 10100,
  vorbereiten: (sz) => {
    const S = sz.S, C = { dunkel: ppHex('#8c0014'), rosa: ppHex('#f9b3b3'), weiss: ppHex('#ffffff'), rand: ppHex('#710122'), blut: ppHex('#c0141c'), dunkelrot: ppHex('#3a0000'), hell: ppHex('#e92f38') };
    return {
      C,
      fleisch: { rand: PP_FX41_SCHNITT.fleisch, innen: PP_FX41_SCHNITT.fleisch.map(([x, y]) => [x * 0.93, y * 0.8]) },
      linie: PP_FX41_SCHNITT.linie,
      spritzer: Array.from({ length: ppFxN(10) }, () => { const an = -Math.PI / 2 + (Math.random() - 0.5) * 1.6, sp = 18 + Math.random() * 30; return { dx: Math.cos(an) * sp, dy: Math.sin(an) * sp, size: 3 + Math.random() * 5, delay: 120 + Math.random() * 120 }; }),
      tropfen: Array.from({ length: ppFxN(6) }, (_, i) => ({ ox: -34 + i * 14 + (Math.random() - 0.5) * 8, len: 14 + Math.random() * 22, delay: 260 + Math.random() * 260, dur: 520 + Math.random() * 300 })),
    };
  },
});
ppFxUeberschreiben('bloody_cut', ppFx41Bloody);
