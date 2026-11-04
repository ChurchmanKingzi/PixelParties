// app-fx-36: Menü-/Titel-Partikel (PixelParticles: Hintergrund, Logo, SC-Glitzer) als Canvas
//
// ═════════════════════════════════════════════════════════════════
//  Vorher: `PixelParticles` (app-screens.jsx) setzte je Teilchen ein <span> mit Endlos-CSS-Animation (`pp-particle-float` / `pp-glitzer-flug`):
//  160 im Hintergrund, 150 am Logo, 22 je SC-Plakette. `pixel-anim.js` bäckt jede Animation ≤ 8 s in gestufte Web-Animationen und hängt bei
//  Skalierung eine wirkungslose Eigenschaft an, die sie auf den Hauptthread zwingt: jedes Teilchen löst bei jedem Bildwechsel einen Style-Neuaufbau
//  aus (Menü: 167 Animationen, 637–676 ms Style-Neuaufbau je 4 s, ~90 % der Menü-Style-Last). Die Hintergrund-Teilchen mit Dauer > 8 s (5–14 s,
//  gut die Hälfte) wurden gar nicht gebacken und liefen als weiche Alpha-/Skalier-Animation im Compositor (Halbalpha, Bruchpixel).
//
//  Jetzt: EINE Leinwand je Schicht, im 30-Hz-Takt (`ppTaktRaf`) gezeichnet, nur solange sie sichtbar ist (IntersectionObserver; `display: none`
//  — z. B. `body:has(.ui-noscale) .pp-bg-particles` im Kampf — heißt unsichtbar, also kein Takt, kein Zeichnen). Kein Layout-Lesen im Takt:
//  Größe/Zoom nur im ResizeObserver bzw. nach `resize`. Das erste Zeichnen läuft im Leerlauf (requestIdleCallback).
//
//  AUSSEHEN — Entscheidung: die regelkonforme Pixelart-Variante (Dithering/Ein-aus statt Alpha, Palette), und zwar ÜBERALL, auch für die Hintergrund-
//  Teilchen > 8 s. Das ist das Verhalten, das `pixel-anim.js` für alle Teilchen ≤ 8 s ohnehin erzeugt (Logo, Glitzer, ~40 % der Hintergrund-Teilchen);
//  nachgebaut Schritt für Schritt (Quelle `backenProbeVorbereiten` / `frameBauen` / `transformQuantisieren`):
//    • Dauer und Verzögerung auf ganze Takte (1/30 s); Teilchen ≤ 8 s halten je Durchlauf höchstens 40 Bilder (`globalMaxBilder`), Schritt =
//      ceil(Bilder/40) Takte (langsame Teilchen „treppen“ also mit 5–30 Hz) — genau wie heute;
//    • Teilchen > 8 s (nur Hintergrund) laufen mit jedem Takt (30 Hz) statt mit 60-Hz-Weichlauf; Verschiebung auf gerade Pixel (`snapPx`),
//      Kantenlänge auf gerade Pixel (`snapScaleGroesse`: n·2 px, mindestens 2) statt stufenlos skaliert;
//    • Deckkraft: Stufe wie `ditherStufe` mit Schritt 2, Schwelle 8 von 16 → ein/aus (Teilchen sind < 400 px², `ditherMin`); die weiche Alpha-
//      Überblendung der Hintergrund-Teilchen > 8 s entfällt (sie erscheinen/verschwinden bei ~40 % der Deckkraft statt zu überblenden);
//    • Farbe: Spielerfarbe (CSS-Variable `--player-color`, gelesen bei Start/Sichtbarwerden/Änderung) bzw. Weiß, auf die Palette gerastet;
//    • Glitzer: Pixel-Kreuz (zwei Balken, Dicke 2 px · Skalierung), Flug mit `ease-out` je Teilstück (0–15 % / 15–100 %), Deckkraft 0→max (15 %),
//      max (bis 60 %), →0 (100 %) — wie `pp-glitzer-flug`.
//  Abweichungen zum heutigen Bild: nur die Hintergrund-Teilchen > 8 s (kein weiches Alpha mehr; 30-Hz-Treppen statt 60-Hz-Weichlauf); es sind
//  kleine Teilchen (2–8 px), der Unterschied ist im Bildvergleich kaum zu sehen.
//
//  Zoom: Menü-Bildschirme laufen unter CSS-`zoom` (`--ui-scale`); die Leinwand rechnet in Layout-Pixeln und legt ihre Bitmap auf die tatsächlichen
//  Bildschirmpixel (Faktor = gezeichnete Breite / Layout-Breite · devicePixelRatio), jede Kante auf ganze Bildschirmpixel gerundet.
//  Reduzierte Bewegung: die Teilchen stehen still (einmal gezeichnet), wie die CSS-Regel (Glitzer: nichts).
//  Test/Vergleich: `window.__ppFxAlt = true` (vor dem Aufbau) lässt die alten DOM-Spans stehen.
//
//  Aufruf:  <window.PpFx36Teilchen art="hintergrund"|"logo"|"glitzer" teilchen={…} />   (React.memo; `teilchen` einmal gewürfelt, siehe app-screens.jsx)
// ═════════════════════════════════════════════════════════════════
const PP_FX36_TAKT = 1000 / 30;
const PP_FX36_MAX_BILDER = 40;          // pixel-anim.js KONFIG.globalMaxBilder
const PP_FX36_MAX_DAUER = 8;            // s — pixel-anim.js KONFIG.globalMaxDauer: länger wird nicht gebacken

// cubic-bezier als Nachschlagetabelle (1024 Stufen): `ease-in-out` (.42,0,.58,1) und `ease-out` (0,0,.58,1)
let ppFx36LutCache = null;
function ppFx36Lut() {
  if (ppFx36LutCache) return ppFx36LutCache;
  const N = 1024;
  const bau = (x1, x2) => {
    const a = new Float32Array(N + 1);
    for (let i = 0; i <= N; i++) {
      const x = i / N;
      let lo = 0, hi = 1, t = x;
      for (let j = 0; j < 30; j++) {
        t = (lo + hi) / 2;
        const bx = 3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t;
        if (bx < x) lo = t; else hi = t;
      }
      a[i] = 3 * (1 - t) * t * t + t * t * t;       // y1 = 0, y2 = 1
    }
    return a;
  };
  ppFx36LutCache = { io: bau(0.42, 0.58), out: bau(0, 0.58) };
  return ppFx36LutCache;
}
function ppFx36Ease(lut, x) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const p = x * 1024, i = p | 0;
  return lut[i] + (lut[i + 1] - lut[i]) * (p - i);
}
const ppFx36SnapPx = (v) => (v < 0 ? -1 : 1) * Math.round(Math.abs(v) / 2) * 2 || 0;     // pixel-anim.js snapPx (Raster 2)

// Deckkraft → an/aus nach `frameBauen` (ditherStufe, Schritt 2, Schwelle 8)
function ppFx36Sichtbar(a) {
  let st;
  if (!(a > 0) || a < 1 / 32) st = 0;
  else if (a >= 1 || a > 31 / 32) st = 16;
  else st = Math.max(1, Math.min(15, Math.round(a * 16)));
  if (st > 0 && st < 16) st = Math.max(2, Math.min(14, Math.round(st / 2) * 2));
  return st >= 8;
}

/** Teilchen → Rechenmodell (einmal): Takte, Schritt, Ziele. `p` = Wert aus PixelParticles (top, left, size, dur, delay, dx, dy, max, color). */
function ppFx36Modell(p, glitzer) {
  const T = PP_FX36_TAKT;
  const D2 = Math.max(T, Math.round(p.dur * 1000 / T) * T);
  const delay2 = Math.round(p.delay * 1000 / T) * T;
  const takte = Math.round(D2 / T);
  const stride = p.dur <= PP_FX36_MAX_DAUER ? Math.max(1, Math.ceil(takte / PP_FX36_MAX_BILDER)) : 1;     // > 8 s: nicht gebacken → jeder Takt
  const schritt = stride * T;
  return {
    L: p.left, T: p.top, S: p.size, dx: p.dx, dy: p.dy, dx2: p.dx * 1.7, dy2: p.dy * 1.9, max: p.max, color: p.color,
    D2, delay2, schritt, K: Math.max(1, Math.ceil((D2 - 1e-6) / schritt)), glitzer: !!glitzer,
  };
}

/** Zustand eines Teilchens zur Laufzeit `lauf` (ms): schreibt in `o` { an, x, y, s, d } — Mitte (x, y) relativ zum Ursprung (L %, T %) der Schicht. */
function ppFx36Zustand(m, lauf, o) {
  let l = lauf - m.delay2;
  l -= Math.floor(l / m.D2) * m.D2;
  let k = (l / m.schritt) | 0; if (k >= m.K) k = m.K - 1;
  const u = k * m.schritt / m.D2;
  const lut = ppFx36Lut();
  let a, x, y, sk, e;
  if (m.glitzer) {
    const O = lut.out;
    if (u < 0.15) { e = ppFx36Ease(O, u / 0.15); a = m.max * e; x = m.dx * 0.25 * e; y = m.dy * 0.25 * e; sk = 0.5 + e; }
    else {
      a = u < 0.6 ? m.max : m.max * (1 - ppFx36Ease(O, (u - 0.6) / 0.4));
      e = ppFx36Ease(O, (u - 0.15) / 0.85); x = m.dx * (0.25 + 0.75 * e); y = m.dy * (0.25 + 0.75 * e); sk = 1.5 - e;
    }
  } else {
    const I = lut.io;
    a = u < 0.2 ? m.max * ppFx36Ease(I, u / 0.2) : u < 0.8 ? m.max : m.max * (1 - ppFx36Ease(I, (u - 0.8) / 0.2));
    if (u < 0.5) { e = ppFx36Ease(I, u / 0.5); x = m.dx * e; y = m.dy * e; sk = 0.55 + 0.45 * e; }
    else { e = ppFx36Ease(I, (u - 0.5) / 0.5); x = m.dx + (m.dx2 - m.dx) * e; y = m.dy + (m.dy2 - m.dy) * e; sk = 1 - 0.45 * e; }
  }
  o.an = ppFx36Sichtbar(a); o.sk = sk;
  if (!o.an) return o;
  // Kantenlänge wie `snapScaleGroesse` (Teilchen ≥ 4 px: ganze Kunstpixel, n · 2 px) bzw. `snapScale` (2-px-Teilchen: 1 oder 2 px)
  o.s = m.S < 4 ? Math.max(1, Math.round(sk * 2)) * m.S / 2 : Math.max(1, Math.round(m.S * sk / 2)) * 2;
  o.d = 2 * (o.s / m.S);                                          // Glitzer: Balkendicke = 2 px · Skalierung
  const mid = m.glitzer ? 0 : m.S / 2;                            // Glitzer: Ursprung = Mitte (margin −S/2), sonst obere linke Ecke
  o.x = mid + ppFx36SnapPx(x);
  o.y = mid + ppFx36SnapPx(y);
  return o;
}

/** CSS-Farbe → [r, g, b]. */
let ppFx36ProbeCtx = null;
function ppFx36Hex(c) {
  c = String(c || '').trim();
  let m = /^#([0-9a-f]{6})$/i.exec(c);
  if (!m) { const k = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(c); if (k) m = [0, k[1] + k[1] + k[2] + k[2] + k[3] + k[3]]; }
  if (!m) {
    try {
      if (!ppFx36ProbeCtx) ppFx36ProbeCtx = document.createElement('canvas').getContext('2d');
      ppFx36ProbeCtx.fillStyle = '#ffffff'; ppFx36ProbeCtx.fillStyle = c;
      m = /^#([0-9a-f]{6})$/i.exec(ppFx36ProbeCtx.fillStyle);
    } catch (e) { /* weiß */ }
  }
  const hex = '#' + (m ? m[1] : 'ffffff').toLowerCase();
  return window.ppSnap ? window.ppSnap(hex) : hex;
}

function ppFx36Start(cv, o) {
  const ctx = cv.getContext('2d');
  const glitzer = o.art === 'glitzer';
  let ruhig = false;
  try { ruhig = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { /* bewegt */ }
  const ruhigFaktor = o.art === 'logo' ? 0.6 : 0.45;               // wie die CSS-Regeln (opacity: max · Faktor)
  const raf = window.ppTaktRaf || window.requestAnimationFrame;
  const M = o.teilchen.map((p, i) => ({ m: ppFx36Modell(p, glitzer), spieler: /^var\(/.test(p.color), hex: '', i }));
  // Telefon-Profil (style.css, battle-lite): die Spans ab Nr. 61 (Logo) / 19 (Hintergrund) / 11 (Glitzer) sind `display: none` → dieselbe Obergrenze
  let mql = null;
  try { mql = window.matchMedia('(pointer: coarse) and (max-height: 600px)'); } catch (e) { /* ohne */ }
  const GRENZE = { logo: 60, hintergrund: 18, glitzer: 10 }[o.art] || 1e9;
  const grenze = () => (mql && mql.matches ? GRENZE : 1e9);
  let spielerHex = '#66b6ff';
  const farbeLesen = () => {
    let v = '';
    try { v = getComputedStyle(cv).getPropertyValue('--player-color'); } catch (e) { /* Vorgabe */ }
    spielerHex = ppFx36Hex(v || '#66b6ff');
    M.forEach((q) => { q.hex = q.spieler ? spielerHex : ppFx36Hex(q.m.color); });
    // Gruppen je Farbe (eine Füllfarbe je Gruppe)
    const byHex = new Map(); gruppen.length = 0;
    const gr = grenze();
    M.forEach((q) => { if (q.i >= gr) return; let g = byHex.get(q.hex); if (!g) { g = { hex: q.hex, q: [] }; byHex.set(q.hex, g); gruppen.push(g); } g.q.push(q); });
  };
  const gruppen = [];
  let W = 0, H = 0, f = window.devicePixelRatio || 1, gestoppt = false, sichtbar = false, bereit = false, id = 0, t0 = -1, idleId = 0, neuMessen = false, farbeAlt = false, letzterTakt = -1;
  const OX = o.ml || 0, OY = o.mt || 0;     // Ursprung der Schicht innerhalb der Leinwand (Logo/Glitzer: Leinwand ragt über die Schicht hinaus)
  const z = { an: false, x: 0, y: 0, s: 0, d: 0 };

  function groesse(layoutB, layoutH) {          // nur bei Größenänderung (ResizeObserver) / resize — nie im Takt
    let zoom = 1;
    if (layoutB > 0) { try { const r = cv.getBoundingClientRect().width / layoutB; if (r > 0.2 && r < 5) zoom = r; } catch (e) { /* 1 */ } }
    const nf = zoom * (window.devicePixelRatio || 1);
    W = layoutB - (o.ml || 0) - (o.mr || 0); H = layoutH - (o.mt || 0) - (o.mb || 0);
    const bw = Math.max(1, Math.round(layoutB * nf)), bh = Math.max(1, Math.round(layoutH * nf));
    if (bw === cv.width && bh === cv.height && nf === f) return;
    f = nf; cv.width = bw; cv.height = bh;     // setzt die Leinwand zurück → neu zeichnen
    if (bereit) zeichnen(performance.now());
  }
  function zeichnen(t) {
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (!(W > 0 && H > 0)) return;
    if (t0 < 0) t0 = t;
    const lauf = t - t0;
    for (let gi = 0; gi < gruppen.length; gi++) {
      const g = gruppen[gi];
      ctx.fillStyle = g.hex;
      for (let i = 0; i < g.q.length; i++) {
        const m = g.q[i].m;
        const bx = OX + m.L * W / 100, by = OY + m.T * H / 100;
        if (ruhig) {
          if (glitzer || !ppFx36Sichtbar(m.max * ruhigFaktor)) continue;
          const x0 = Math.round(bx * f), y0 = Math.round(by * f);
          ctx.fillRect(x0, y0, Math.max(1, Math.round((bx + m.S) * f) - x0), Math.max(1, Math.round((by + m.S) * f) - y0));
          continue;
        }
        ppFx36Zustand(m, lauf, z);
        if (!z.an) continue;
        if (glitzer) {
          const cx = bx + z.x, cy = by + z.y, h = z.s / 2;
          const x0 = Math.round((cx - h) * f), x1 = Math.round((cx + h) * f), y0 = Math.round((cy - h) * f), y1 = Math.round((cy + h) * f);
          const dk = Math.max(1, Math.round(z.d * f)), mx = Math.round(cx * f) - (dk >> 1), my = Math.round(cy * f) - (dk >> 1);
          ctx.fillRect(x0, my, Math.max(1, x1 - x0), dk);               // waagerechter Balken
          ctx.fillRect(mx, y0, dk, Math.max(1, y1 - y0));              // senkrechter Balken
        } else {
          const x = bx + z.x - z.s / 2, y = by + z.y - z.s / 2;
          const x0 = Math.round(x * f), y0 = Math.round(y * f);
          ctx.fillRect(x0, y0, Math.max(1, Math.round((x + z.s) * f) - x0), Math.max(1, Math.round((y + z.s) * f) - y0));
        }
      }
    }
  }
  function tick(t) {
    id = 0;
    if (gestoppt || !sichtbar) return;
    const fr = Math.floor(t / PP_FX36_TAKT);                          // Retro/ohne Takt-Schleife: rAF kommt mit 60+ Hz → nur bei neuem 30-Hz-Bild zeichnen
    if (fr === letzterTakt) { id = raf(tick); return; }
    letzterTakt = fr;
    if (farbeAlt) { farbeAlt = false; farbeLesen(); }
    if (neuMessen) { neuMessen = false; groesse(cv.clientWidth, cv.clientHeight); }
    const zm = window.__ppFx36Zeit;                                   // nur Tests: Kosten je Bild sammeln
    if (zm) { const a = performance.now(); zeichnen(t); zm.push(performance.now() - a); } else zeichnen(t);
    id = raf(tick);
  }
  function anwerfen() { if (!id && bereit && sichtbar && !gestoppt && !ruhig) id = raf(tick); }

  let ro = null, io = null, mo = null;
  try {
    ro = new ResizeObserver((es) => { const r = es[es.length - 1].contentRect; groesse(r.width, r.height); });
    ro.observe(cv);
  } catch (e) { /* ohne */ }
  try {
    io = new IntersectionObserver((es) => {
      const s = es[es.length - 1].isIntersecting;
      if (s && !sichtbar) farbeAlt = true;                           // beim Sichtbarwerden Spielerfarbe neu lesen (Menü kann sie überschreiben)
      sichtbar = s; if (sichtbar) anwerfen();
    });
    io.observe(cv);
  } catch (e) { sichtbar = true; }
  try {                                                               // Spielerfarbe ändert sich (Profil) → im nächsten Takt neu lesen
    mo = new MutationObserver(() => { farbeAlt = true; if (ruhig && bereit) { farbeLesen(); farbeAlt = false; zeichnen(performance.now()); } });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
  } catch (e) { /* ohne */ }
  const aufMedium = () => { farbeAlt = true; if (bereit && (ruhig || !sichtbar)) { farbeLesen(); farbeAlt = false; zeichnen(performance.now()); } };
  try { if (mql) mql.addEventListener('change', aufMedium); } catch (e) { /* ohne */ }
  const aufResize = () => { neuMessen = true; if (ruhig && bereit) { groesse(cv.clientWidth, cv.clientHeight); neuMessen = false; } };
  window.addEventListener('resize', aufResize);
  // Erstes Zeichnen im Leerlauf: legt die Leinwand-Ressourcen an, bevor sie im Takt gebraucht werden
  const los = () => {
    idleId = 0; if (gestoppt) return;
    if (!(W > 0)) groesse(cv.clientWidth, cv.clientHeight);
    farbeLesen(); farbeAlt = false;                                   // Spielerfarbe erst hier lesen (Leerlauf), nicht beim Einhängen
    bereit = true;
    const zm = window.__ppFx36Zeit;                                   // nur Tests: auch das erste (Leerlauf-)Zeichnen messen
    if (zm) { const a = performance.now(); zeichnen(a); zm.push(performance.now() - a); } else zeichnen(performance.now());
    anwerfen();
  };
  if (window.requestIdleCallback) idleId = window.requestIdleCallback(los, { timeout: 400 }); else idleId = setTimeout(los, 60);
  const stopp = () => {
    gestoppt = true;
    if (id) { try { cancelAnimationFrame(id); } catch (e) { /* weg */ } id = 0; }
    if (idleId) { try { window.cancelIdleCallback ? window.cancelIdleCallback(idleId) : clearTimeout(idleId); } catch (e) { /* weg */ } }
    window.removeEventListener('resize', aufResize);
    try { if (mql) mql.removeEventListener('change', aufMedium); } catch (e) { /* weg */ }
    if (ro) ro.disconnect();
    if (io) io.disconnect();
    if (mo) mo.disconnect();
  };
  stopp.pruef = {                                                      // Pruefhaken fuer Bildvergleiche (Testskripte)
    zeichnen, halt: (v) => { gestoppt = v; }, t0: (v) => { t0 = v; },
    modell: () => M.map((q) => q.m), info: () => ({ W, H, f, gruppen: gruppen.length, teilchen: gruppen.reduce((n, g) => n + g.q.length, 0), ox: OX, oy: OY, sichtbar, ruhig, laeuft: !!id }),
  };
  return stopp;
}

/** Rand der Leinwand um die Schicht (Layout-px): Logo/Glitzer treiben über die Schicht hinaus (die Schicht schneidet nicht); Hintergrund: Schicht schneidet. */
function ppFx36Rand(art, teilchen) {
  if (art === 'hintergrund') return { ml: 0, mr: 0, mt: 0, mb: 0 };
  const gl = art === 'glitzer';
  let ml = 0, mr = 0, mt = 0, mb = 0;
  for (const p of teilchen) {
    const x = [0, p.dx, gl ? p.dx : p.dx * 1.7], y = [0, p.dy, gl ? p.dy : p.dy * 1.9];
    ml = Math.max(ml, -Math.min(...x)); mr = Math.max(mr, Math.max(...x));
    mt = Math.max(mt, -Math.min(...y)); mb = Math.max(mb, Math.max(...y));
  }
  const g = gl ? 8 : 10;      // Kantenlänge/Kreuz + Rundung
  return { ml: Math.ceil(ml) + g, mr: Math.ceil(mr) + g, mt: Math.ceil(mt) + g, mb: Math.ceil(mb) + g };
}

function PpFx36TeilchenInnen({ art, teilchen }) {
  const ref = React.useRef(null);
  const rand = React.useMemo(() => ppFx36Rand(art, teilchen), [art, teilchen]);
  React.useEffect(() => {
    if (!ref.current) return undefined;
    const stopp = ppFx36Start(ref.current, { art, teilchen, ...rand });
    if (Array.isArray(window.__ppFx36Probe)) window.__ppFx36Probe.push({ art, teilchen, canvas: ref.current, stopp });   // nur Tests
    return stopp;
  }, [art, teilchen, rand]);
  const stil = art === 'hintergrund'
    ? { left: 0, top: 0, width: '100%', height: '100%' }
    : { left: -rand.ml, top: -rand.mt, width: `calc(100% + ${rand.ml + rand.mr}px)`, height: `calc(100% + ${rand.mt + rand.mb}px)` };
  return <canvas ref={ref} className="pp-fx36-leinwand" aria-hidden="true" style={stil} />;
}
window.PpFx36Teilchen = React.memo(PpFx36TeilchenInnen);
window.ppFx36 = { modell: ppFx36Modell, zustand: ppFx36Zustand, start: ppFx36Start, rand: ppFx36Rand };      // nur Tests (Modell gegen die alten Spans prüfen)
