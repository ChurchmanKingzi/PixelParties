// app-fx-45: Titel-/Login-Kulisse (Figuren, Explosionskern, Glut, fliegende Katzen) per JS-Takt statt CSS-Dauerläufen
//
// ═════════════════════════════════════════════════════════════════
//  Vorher: `AnimatedTitleBackdrop` / `AnimatedTitleCatsOverlay` (app-screens.jsx) legten ~9 Figuren-Ebenen als DOM-Hintergrundbilder mit CSS-Dauerläufen (`ab-floaty`, `ab-jiggleTether`,
//  `ab-broghanTether`, `ab-coreTether`) und 46 Glut-Quadrate mit `ab-emberrise` übereinander. `pixel-anim.js` buk jede davon bei jedem Bildschirmstart (Probe, Abtasten, Quantisieren: ~60 ms je
//  Titelbild) und jede laufende gebackene Animation kostete im Takt einen Style-Neuaufbau (~55 Animationen).
//  Jetzt: `PpFx45Szene` = je Schicht (Figuren hinten, Figuren vorn + Glut, Katzen über dem Anmeldekasten) die Figuren-Ebenen als DOM-Kästen mit Hintergrundbild (wie vorher, vom Compositor verschoben), deren
//  `transform` nur beim Wechsel der ganzzahligen 2-px-Stufe per 30-Hz-Takt (`ppTaktRaf`) gesetzt wird — keine CSS-Animation, nichts wird zur Laufzeit gebacken —, plus EINE Glut-Leinwand (Kunstpixel, Dither). Dieselben Bewegungen wie die Keyframes:
//    · `ab-floaty` (Schweben): hin und zurück zwischen 0 und (mx, my) in Prozent der Fenstermaße, Dauer/Verzögerung je Figur, `ease-in-out` je Hälfte (cubic-bezier .42/0/.58/1);
//    · `ab-jiggleTether` / `ab-broghanTether` (Kämpfer an der Laserkette): ±0,469 vw / 0,37 vh in 4,8 s; `ab-coreTether` (Explosionskern): 0,37 vh nach unten und 2,1 % kleiner (Größe auf ganze Pixel);
//    · `ab-emberrise` (Glut): linearer Aufstieg um 112 vh mit Drift, Deckkraft 0 → .95 (8 %) → .7 (78 %) → 0 — als Bayer-Dither im Quadrat statt Alpha.
//  Versätze rasten auf das 2-px-Kunstpixelraster (wie die gebackenen Animationen). `prefers-reduced-motion`: ein ruhiges Bild ohne Glut (wie vorher `animation: none` → Glut unsichtbar).
//  Messung (Login-Bildschirm 1280x720, Headless/Software, 10 s, Thread-CPU): Style 460 → 200 ms, Commit 185 → 250 ms, Summe 844 → 700 ms; laufende Animationen 68 → 11; Backzeit je Titelbild ~60 ms → 0.
// ═════════════════════════════════════════════════════════════════
const PP_FX45_TAKT = 1000 / 30;
const PP_FX45_RASTER = 2;     // Kunstpixel in CSS-px (== PP_PX_GROESSE)
const PP_FX45_BUEHNE_B = 1920, PP_FX45_BUEHNE_H = 1080;

// Ebenen der Kulisse. rahmen: Alpha-Kasten in Bühnenpixeln (ANIM_SPRITE_RAHMEN, app-screens.jsx).
//  schwebe: [Dauer s, Verzögerung s, mx (vw), my (vh)] = ab-floaty;  kette: [tH (vw), tV (vh), Vorzeichen] = ab-*Tether;  kern: Explosionskern (ab-coreTether)
//  wx / wy: fester Versatz der Hülle in vw / vh (wie die umgebenden Divs im JSX), `links`: fester Versatz in vw
const PP_FX45_EBENEN = {
  hammer:     { datei: 'hammer.png',     schwebe: [4.2, -0.6, 0.469, -1.389] },
  explosion:  { datei: 'explosion.png',  kern: { dauer: 4.8, tV: 0.37, skala: 0.021, ox: 0.52, oy: 0.42 } },
  golem:      { datei: 'golem.png',      kette: { dauer: 4.8, tH: -0.469, tV: 0.37 }, wx: 5.781, wy: 0.278 },
  horned:     { datei: 'horned.png',     schwebe: [6, -2, -0.573, -1.389], wy: 14.907 },
  angel:      { datei: 'angel.png',      schwebe: [5, 0, 0, -1.111] },
  blonde:     { datei: 'blonde.png',     schwebe: [6.5, -1.5, 0.208, -0.833] },
  rabbit:     { datei: 'rabbit.png',     kette: { dauer: 4.8, tH: 0.469, tV: 0.37 } },
  ninja:      { datei: 'ninja.png',      schwebe: [5.5, -2.5, 0.417, -1.296], wy: 19.907 },
  cat_top:    { datei: 'cat_top.png',    schwebe: [3.4, -0.5, 0.729, -0.833] },
  cat_mid:    { datei: 'cat_mid.png',    schwebe: [2.9, -0.8, -0.573, 0.833], wx: -8 },   // KATZE_LINKS (app-screens.jsx): 8 vw nach links, damit der Anmeldekasten frei bleibt
  cat_bottom: { datei: 'cat_bottom.png', schwebe: [3.0, -1.7, 0.833, -1.111] },
};
const PP_FX45_GLUT_FARBEN = ['#ffd066', '#e37435', '#fe5154', '#f9ecb3', '#ffffff'];

// cubic-bezier(.42, 0, .58, 1) = CSS `ease-in-out`
function ppFx45Ease(x) {
  if (x <= 0) return 0; if (x >= 1) return 1;
  const X1 = 0.42, Y1 = 0, X2 = 0.58, Y2 = 1;
  const bx = (t) => 3 * (1 - t) * (1 - t) * t * X1 + 3 * (1 - t) * t * t * X2 + t * t * t;
  const by = (t) => 3 * (1 - t) * (1 - t) * t * Y1 + 3 * (1 - t) * t * t * Y2 + t * t * t;
  let lo = 0, hi = 1, t = x;
  for (let i = 0; i < 20; i++) { const v = bx(t); if (Math.abs(v - x) < 1e-5) break; if (v < x) lo = t; else hi = t; t = (lo + hi) / 2; }
  return by(t);
}
// 0 → 1 → 0 über eine Schleife (Keyframes 0 %, 50 %, 100 %, je Hälfte ease-in-out), `verz` negativ = schon im Lauf
function ppFx45Hin(tau, dauer, verz) {
  const c = (((tau - verz) / dauer) % 1 + 1) % 1;
  return ppFx45Ease(c < 0.5 ? c * 2 : (1 - c) * 2);
}
function ppFx45Ruhig() {
  try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
}
function ppFx45Handy() {
  try { return !!(window.matchMedia && window.matchMedia('(pointer: coarse) and (max-height: 600px)').matches); } catch (e) { return false; }
}

// gemeinsame Uhr der Schichten (alle Leinwände/Ebenen der Kulisse starten zusammen, wie die früheren Animationen mit gleichem Beginn)
const ppFx45Uhr = { bezug: 0, t0: 0 };
function ppFx45Binden() { if (ppFx45Uhr.bezug++ === 0) ppFx45Uhr.t0 = performance.now(); }
function ppFx45Loesen() { ppFx45Uhr.bezug = Math.max(0, ppFx45Uhr.bezug - 1); }

/**
 * Stil einer Figuren-Ebene: auf den sichtbaren Kasten (`rahmen`, Bühnenpixel + 2 px Luft) zugeschnitten, das ganze Bühnenbild als Hintergrund an die richtige Stelle gelegt (wie die DOM-Ebenen
 * vorher: `100% 100%`-Streckung, auf Nicht-16:9-Fenstern gestaucht). Lage in Prozent der Bühne → unabhängig vom CSS-`zoom` der Oberfläche.
 */
function ppFx45Stil(datei, dir, rahmen) {
  const r = rahmen && rahmen[datei];
  const url = "url('" + dir + datei + "')";
  if (!r) return { position: 'absolute', inset: 0, willChange: 'transform', background: url + ' center / 100% 100% no-repeat' };
  const x0 = Math.max(0, r[0] - 2), y0 = Math.max(0, r[1] - 2), x1 = Math.min(PP_FX45_BUEHNE_B, r[2] + 2), y1 = Math.min(PP_FX45_BUEHNE_H, r[3] + 2);
  const l = x0 / PP_FX45_BUEHNE_B, t = y0 / PP_FX45_BUEHNE_H, w = (x1 - x0) / PP_FX45_BUEHNE_B, h = (y1 - y0) / PP_FX45_BUEHNE_H;
  const pct = (v) => (v * 100).toFixed(4) + '%';
  return {
    position: 'absolute', left: pct(l), top: pct(t), width: pct(w), height: pct(h), willChange: 'transform',
    backgroundImage: url, backgroundRepeat: 'no-repeat', backgroundSize: pct(1 / w) + ' ' + pct(1 / h),
    // Prozent-Position: Punkt p des Bildes liegt auf Punkt p des Kastens — für den Versatz −l·Bühne gilt p = l / (1 − w).
    backgroundPosition: (w < 1 ? pct(l / (1 - w)) : '0%') + ' ' + (h < 1 ? pct(t / (1 - h)) : '0%'),
  };
}

// Glut-Quadrat: Deckkraft als Bayer-Dither im Quadrat (kleine Sprites je Farbe/Größe/Stufe, gemerkt)
const ppFx45GlutSprites = new Map();
function ppFx45GlutSprite(farbe, zellen, stufe) {          // zellen: Kantenlänge in Kunstpixeln (1 Zelle = 1 Leinwandpixel der Glutleinwand)
  const k = farbe + zellen + ':' + stufe; let c = ppFx45GlutSprites.get(k);
  if (c) return c;
  c = document.createElement('canvas'); c.width = zellen; c.height = zellen;
  const g = c.getContext('2d'); g.fillStyle = farbe;
  for (let j = 0; j < zellen; j++) for (let i = 0; i < zellen; i++) if (stufe >= 16 || window.ppBayer(i, j) < stufe / 16) g.fillRect(i, j, 1, 1);
  ppFx45GlutSprites.set(k, c);
  return c;
}
function ppFx45Zufall(n) { let a = 5000 + n * 7919; a = (a ^ 61) ^ (a >>> 16); a = (a + (a << 3)) | 0; a ^= a >>> 4; a = Math.imul(a, 0x27d4eb2d); a ^= a >>> 15; return (a >>> 0) / 4294967296; }

function ppFx45SzeneStart(host, gv, cfg) {
  const raf = window.ppTaktRaf || window.requestAnimationFrame;
  const ruhig = ppFx45Ruhig();
  const nGlut = gv && !ruhig ? (ppFx45Handy() ? 15 : 46) : 0;
  const glut = Array.from({ length: nGlut }, () => {
    const gr = 2 + Math.random() * 5;
    return {
      px: Math.max(PP_FX45_RASTER, Math.round(gr / 2) * 2),
      dauer: 7 + Math.random() * 9, verz: -Math.random() * 16, links: Math.random() * 100,
      drift: (Math.random() * 2 - 1) * 2.604,                       // vw
      farbe: PP_FX45_GLUT_FARBEN[Math.floor(Math.random() * PP_FX45_GLUT_FARBEN.length)], sp: [],
    };
  });
  // Figuren: die Ebenen (DOM-Kästen mit Hintergrundbild, vom Compositor als fertige Ebenen verschoben) werden NICHT neu gezeichnet; nur beim Wechsel der ganzzahligen 2-px-Stufe (~3–8 × je s und Figur)
  // wird ihr `transform` gesetzt. Das ist billiger als CSS-Dauerläufe (die Pixel-Pipeline backt sie bei jedem Start und baut je Takt Stile neu) und als Leinwände (jede Leinwand kostet im Software-
  // Rendering je Commit, gemessen: ~1 ms je Bild für acht Stück). Verschiebung in Prozent der eigenen Größe: unabhängig vom CSS-`zoom` (`--ui-scale`).
  const el = [...host.querySelectorAll('.pp-fx45-figur')].map((cv) => {
    const n = cv.getAttribute('data-n'), d = PP_FX45_EBENEN[n], r = cfg.rahmen && cfg.rahmen[d.datei];
    return { cv, d, tkey: '', key: '', rahmen: r ? [Math.max(0, r[0] - 2), Math.max(0, r[1] - 2), Math.min(PP_FX45_BUEHNE_B, r[2] + 2), Math.min(PP_FX45_BUEHNE_H, r[3] + 2)] : [0, 0, PP_FX45_BUEHNE_B, PP_FX45_BUEHNE_H] };
  }).filter((o) => o.d);
  let W = 0, H = 0, gctx = null, gW = 0, gH = 0, gestoppt = false, id = 0, letzter = -1;
  ppFx45Binden();

  const mass = () => {
    const w = Math.max(1, Math.round(window.innerWidth)), h = Math.max(1, Math.round(window.innerHeight));
    if (w === W && h === H) return;
    W = w; H = h;
    for (const o of el) { o.key = ''; o.tkey = ''; }
    if (gv) { gW = Math.ceil(W / PP_FX45_RASTER); gH = Math.ceil(H / PP_FX45_RASTER); gv.width = gW; gv.height = gH; gctx = gv.getContext('2d'); gctx.imageSmoothingEnabled = false; }  // Glut in Kunstpixeln (1 Leinwandpixel = 2 CSS-px)
  };
  const raster = (v) => Math.round(v / PP_FX45_RASTER) * PP_FX45_RASTER;
  const pct = (v) => (v * 100).toFixed(4) + '%';

  function zeichnen(t) {
    const tau = ruhig ? 0 : t;
    for (const o of el) {
      const d = o.d, R = o.rahmen;
      const bw = (R[2] - R[0]) * W / PP_FX45_BUEHNE_B, bh = (R[3] - R[1]) * H / PP_FX45_BUEHNE_H;       // Kasten in Fensterpixeln
      let dx = 0, dy = 0, sk = 1;
      if (d.schwebe) { const f = ppFx45Hin(tau, d.schwebe[0], d.schwebe[1]); dx = d.schwebe[2] * W / 100 * f; dy = d.schwebe[3] * H / 100 * f; }
      else if (d.kette) { const f = ppFx45Hin(tau, d.kette.dauer, 0); dx = d.kette.tH * W / 100 * f; dy = d.kette.tV * H / 100 * f; }
      else if (d.kern) { const f = ppFx45Hin(tau, d.kern.dauer, 0); dy = d.kern.tV * H / 100 * f; sk = 1 - d.kern.skala * f; }
      if (d.wx) dx += d.wx * W / 100;
      if (d.wy) dy += d.wy * H / 100;
      dx = raster(dx); dy = raster(dy);
      let hh = bh, ww = bw;
      if (d.kern) {
        // Explosionskern: Breite in ganzen Kunstpixeln (gerade), Kasten um den Drehpunkt verkleinert; Größe/Lage setzen nur beim Wechsel der Breite, der Versatz nach unten läuft über `transform`
        const w = Math.max(2, Math.round(bw * sk / PP_FX45_RASTER) * PP_FX45_RASTER), s = w / bw, px = d.kern.ox * W, py = d.kern.oy * H;
        const bl = R[0] * W / PP_FX45_BUEHNE_B, bt = R[1] * H / PP_FX45_BUEHNE_H;
        hh = Math.round(bh * s); ww = w;
        const key = w + ',' + hh;
        if (key !== o.key) {
          o.key = key;
          const st = o.cv.style;
          st.left = pct(Math.round(px + (bl - px) * s) / W); st.top = pct(Math.round(py + (bt - py) * s) / H); st.width = pct(w / W); st.height = pct(hh / H);
        }
      }
      const key = dx + ',' + dy;
      if (key === o.tkey) continue;
      o.tkey = key;
      o.cv.style.transform = (dx || dy) ? 'translate(' + (dx / ww * 100).toFixed(4) + '%,' + (dy / hh * 100).toFixed(4) + '%)' : '';
    }
    if (gctx) {
      gctx.clearRect(0, 0, gW, gH);
      const R = PP_FX45_RASTER;
      for (const e of glut) {
        const c = (((tau - e.verz) / e.dauer) % 1 + 1) % 1;
        const op = c < 0.08 ? 0.95 * c / 0.08 : (c < 0.78 ? 0.95 + (0.7 - 0.95) * (c - 0.08) / 0.7 : 0.7 * (1 - (c - 0.78) / 0.22));
        const stufe = Math.round(op * 16);
        if (stufe < 1) continue;
        const x = raster(e.links / 100 * W + e.drift * W / 100 * c), y = raster(H * 1.01296 - e.px + H * (0.01852 + (-1.12 - 0.01852) * c));
        if (y < -e.px || y > H) continue;
        gctx.drawImage((e.sp[stufe] || (e.sp[stufe] = ppFx45GlutSprite(e.farbe, e.px / R, stufe))), x / R, y / R);
      }
    }
  }

  function tick(now) {
    id = 0;
    if (gestoppt) return;
    if (!document.hidden) {
      const fr = Math.floor(now / PP_FX45_TAKT);
      if (fr !== letzter) {
        letzter = fr;
        const zm = window.__ppFx45Zeit;                    // nur Tests: Kosten je Bild sammeln
        const a = zm ? performance.now() : 0;
        zeichnen((now - ppFx45Uhr.t0) / 1000);
        if (zm) zm.push(performance.now() - a);
        if (ruhig) return;                                 // ruhig: ein einziges Bild
      }
    }
    id = raf(tick);
  }
  let rt = 0;
  const onSize = () => { clearTimeout(rt); rt = setTimeout(() => { mass(); letzter = -1; if (!id && !gestoppt) id = raf(tick); }, 120); };
  window.addEventListener('resize', onSize);
  mass(); id = raf(tick);
  return () => {
    gestoppt = true;
    if (id) { try { cancelAnimationFrame(id); } catch (e) { /* weg */ } id = 0; }
    clearTimeout(rt);
    window.removeEventListener('resize', onSize);
    ppFx45Loesen();
  };
}

/** Eine Schicht der Titelkulisse (Figuren-Ebenen + optional Glut-Leinwand). `ebenen`: Namen aus PP_FX45_EBENEN (von hinten nach vorn), `glut`: Glutfunken mitzeichnen, `dir`/`rahmen`: Bildordner und Sichtkästen (app-screens.jsx). */
function PpFx45Szene({ ebenen, glut, dir, rahmen }) {
  const host = React.useRef(null), gv = React.useRef(null);
  const stile = React.useMemo(() => ebenen.map((n) => ppFx45Stil(PP_FX45_EBENEN[n].datei, dir, rahmen)), []);
  React.useEffect(() => (host.current ? ppFx45SzeneStart(host.current, gv.current, { rahmen }) : undefined), []);
  return (
    <div ref={host} className="pp-fx45-szene" data-pp-px="aus" aria-hidden="true">
      {ebenen.map((n, i) => <div key={n} className="pp-fx45-figur" data-n={n} style={stile[i]} />)}
      {glut ? <canvas ref={gv} className="pp-fx45-glut" /> : null}
    </div>
  );
}
window.PpFx45Szene = PpFx45Szene;
