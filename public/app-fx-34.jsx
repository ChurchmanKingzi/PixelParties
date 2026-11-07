// app-fx-34: Ambient-Motes (Hand/Brett) als EINE Canvas-Leinwand je Ebene
//
// ═════════════════════════════════════════════════════════════════
//  Vorher: HandAmbiance (80 `.hand-mote`) und BoardAmbiance (56 `.board-mote`) waren je ein DOM-Element mit Endlos-CSS-Animation. `pixel-anim.js`
//  bäckt jede davon in gestufte Web-Animationen und hängt bei Skalierung eine wirkungslose Eigenschaft (`scrollMarginTop`) an, um sie auf den
//  Hauptthread zu zwingen — jede der 136 Animationen löst so bei jedem Wechsel einen Style-Neuaufbau aus (Leerlauf: ~60 Neuaufbauten/s,
//  zusammen ~80 % der Style-Grundlast des Bretts).
//
//  Jetzt: EINE Leinwand je Ebene, im 30-Hz-Takt (`ppTaktRaf`) gezeichnet. Das Aussehen ist das der gebackenen Animation, Schritt für Schritt
//  nachgebaut (Quelle: `pixel-anim.js`, `backenProbeVorbereiten` / `frameBauen`; gegen echte Mote per Bildvergleich geprüft):
//    • Dauer und Verzögerung auf ganze Takte (1/30 s); je Durchlauf höchstens 40 gehaltene Bilder (`globalMaxBilder`), also Schritt = ceil(Bilder/40) Takte
//    • (Phase 2: Kantenlänge und Verschiebung in Zellen = Hero-Pixel statt 2 px, siehe `ppFx34Zelle`.)
//    • Bewegung = `hand-mote-float`: translate(0,0) scale(.5) → bei 50 % translate(dx,dy) scale(1) → bei 100 % translate(dx2,dy2) scale(.5),
//      je Teilstück ease-in-out (cubic-bezier(.42,0,.58,1)); Verschiebung auf gerade Pixel (`snapPx`), Skalierung auf Vielfache von 1/2 (Kantenlänge 2/4 px → 1/2 oder 2/4 px)
//    • Deckkraft 0 → 1 (bis 18 %), 1 (bis 82 %), → 0 (bis 100 %), kleine Teilchen nur ein/aus (Dither-Stufe ≥ 8 von 16, wie `frameBauen`)
//    • Farbe = deckende Mischung `color-mix(in srgb, Farbe max%, #08060c)`, auf die Palette gerastet (palette.js rastet `fillStyle` ein)
//  Leinwand: gleiche Ebene wie die alten Spans (Hand: in `.hand-particles`, z-index 7; Brett: erstes Kind von `.board-center`, z-index 0). Die Hand-Leinwand
//  ragt nach oben und zur Seite über die Handleiste hinaus (die Motes steigen aus der Hand heraus, `.hand-particles` schneidet nicht).
//
//  Kosten: Größenänderung nur per ResizeObserver (nie Layout im Takt lesen), gezeichnet wird nur, solange die Leinwand sichtbar ist (IntersectionObserver;
//  `display: none` unter `battle-lite` heißt: unsichtbar → keine Arbeit), im Hintergrund-Tab ruht der Takt von selbst. Das erste Zeichnen läuft im Leerlauf
//  (requestIdleCallback), nicht mitten in einem Bild. `prefers-reduced-motion`: Motes stehen still (einmal gezeichnet), wie die CSS-Regel.
//  Test/Vergleich: `window.__ppFxAlt = true` (vor dem Aufbau des Bretts) lässt die alten DOM-Spans stehen.
//
//  Aufruf:  <window.PpFx34Ambiente art="hand"|"brett" motes={…} farbeMe={…} farbeOpp={…} />   (React.memo; `motes` einmal gewürfelt, siehe app-board.jsx)
// ═════════════════════════════════════════════════════════════════
const PP_FX34_TAKT = 1000 / 30;
const PP_FX34_HINTERGRUND = [8, 6, 12];          // #08060c
const PP_FX34_MAX_BILDER = 40;                   // pixel-anim.js KONFIG.globalMaxBilder

// cubic-bezier(.42, 0, .58, 1) = CSS `ease-in-out`
function ppFx34Ease(x) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  let lo = 0, hi = 1, t = x;
  for (let i = 0; i < 40; i++) {
    t = (lo + hi) / 2;
    const bx = 3 * (1 - t) * (1 - t) * t * 0.42 + 3 * (1 - t) * t * t * 0.58 + t * t * t;
    if (bx < x) lo = t; else hi = t;
  }
  return 3 * (1 - t) * t * t + t * t * t;
}
// Rasterzelle der Motes = Hero-Pixel der eigenen Reihe (`ppFxZelle`, app-board.jsx; Phase 2). Vorher fest 2 (Kunstpixel von pixel-anim.js). Kantenlänge 1 oder 2 Zellen, Verschiebung in ganzen Zellen.
// Anzahl der Motes und Zeichenaufrufe bleiben gleich (136 × fillRect je Bild): die Dauerlast steigt nicht. Bei 720p und auf dem Handy (Hero-Pixel 2) ist das Bild unverändert bis auf die kleinste Stufe (1 px → 1 Zelle).
const ppFx34Zelle = () => { try { if (typeof ppFxZelle === 'function') return ppFxZelle(null); } catch (e) { /* Rückfall */ } return 2; };
const ppFx34SnapPx = (v, Z) => (v < 0 ? -1 : 1) * Math.round(Math.abs(v) / (Z || 2)) * (Z || 2) || 0;   // pixel-anim.js snapPx, hier mit Raster Z
const ppFx34Gerade = (v, Z) => Math.round(v / (Z || 2)) * (Z || 2);                                      // wie ppAmbGerade (app-board.jsx), mit Raster Z

// Deckkraft → an/aus nach `frameBauen` (ditherStufe, Schritt 2, Schwelle 8)
function ppFx34Sichtbar(a) {
  let st;
  if (!(a > 0) || a < 1 / 32) st = 0;
  else if (a >= 1 || a > 31 / 32) st = 16;
  else st = Math.max(1, Math.min(15, Math.round(a * 16)));
  if (st > 0 && st < 16) st = Math.max(2, Math.min(14, Math.round(st / 2) * 2));
  return st >= 8;
}

/** Bildfolge einer Mote: gehaltene Schritte (Verschiebung, Kantenlänge, an/aus) — einmal gerechnet. */
function ppFx34Tafel(p, Z) {
  Z = Z || 2;
  const T = PP_FX34_TAKT;
  const D2 = Math.max(T, Math.round(p.dur * 1000 / T) * T);
  const delay2 = Math.round(p.delay * 1000 / T) * T;
  const stride = Math.max(1, Math.ceil(Math.round(D2 / T) / PP_FX34_MAX_BILDER));
  const schritt = stride * T;
  const K = Math.max(1, Math.ceil((D2 - 1e-6) / schritt));
  const dx = p.dx, dy = p.dy, dx2 = ppFx34Gerade(p.dx * 1.6, Z), dy2 = ppFx34Gerade(p.dy * 1.8, Z);
  const tx = new Int16Array(K), ty = new Int16Array(K), px = new Uint8Array(K), an = new Uint8Array(K);
  for (let k = 0; k < K; k++) {
    const u = k * schritt / D2;
    const a = u < 0.18 ? ppFx34Ease(u / 0.18) : u < 0.82 ? 1 : 1 - ppFx34Ease((u - 0.82) / 0.18);
    let x, y, s;
    if (u < 0.5) { const e = ppFx34Ease(u / 0.5); x = dx * e; y = dy * e; s = 0.5 + 0.5 * e; }
    else { const e = ppFx34Ease((u - 0.5) / 0.5); x = dx + (dx2 - dx) * e; y = dy + (dy2 - dy) * e; s = 1 - 0.5 * e; }
    tx[k] = ppFx34SnapPx(x, Z); ty[k] = ppFx34SnapPx(y, Z);
    px[k] = Math.max(1, Math.round(Math.max(1, Math.round(s * 2)) * p.size / 4)) * Z;       // Kantenlänge in CSS-px: 1 oder 2 Zellen (kleine Motes immer 1, große 1 → 2)
    an[k] = ppFx34Sichtbar(a) ? 1 : 0;
  }
  return { D2, delay2, schritt, K, tx, ty, px, an };
}

/** CSS-Farbe → [r, g, b] (0..255). */
let ppFx34ProbeCtx = null;
function ppFx34Rgb(c) {
  let m = /^#([0-9a-f]{6})$/i.exec(c || '');
  if (!m) { const k = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(c || ''); if (k) m = [0, k[1] + k[1] + k[2] + k[2] + k[3] + k[3]]; }
  if (!m) {
    try {
      if (!ppFx34ProbeCtx) ppFx34ProbeCtx = document.createElement('canvas').getContext('2d');
      ppFx34ProbeCtx.fillStyle = '#ffffff'; ppFx34ProbeCtx.fillStyle = c;
      m = /^#([0-9a-f]{6})$/i.exec(ppFx34ProbeCtx.fillStyle);
    } catch (e) { /* weiß */ }
  }
  const n = parseInt(m ? m[1] : 'ffffff', 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
/** Deckende Mischung `color-mix(in srgb, farbe anteil, #08060c)` als Hex (auf die Palette gerastet, wenn palette.js da ist). */
function ppFx34Misch(rgb, anteil) {
  const h = (i) => ('0' + Math.round(rgb[i] * anteil + PP_FX34_HINTERGRUND[i] * (1 - anteil)).toString(16)).slice(-2);
  const hex = '#' + h(0) + h(1) + h(2);
  return window.ppSnap ? window.ppSnap(hex) : hex;
}

function ppFx34Start(cv, o) {
  const T = PP_FX34_TAKT;
  const ctx = cv.getContext('2d');
  const farbe = { me: ppFx34Rgb(o.farbeMe), opp: ppFx34Rgb(o.farbeOpp), weiss: [255, 255, 255] };
  let ruhig = false;
  try { ruhig = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { /* bewegt */ }
  const raf = window.ppTaktRaf || window.requestAnimationFrame;
  // Motes + Farbgruppen (eine Füllfarbe je Gruppe; Zeichenreihenfolge innerhalb der Gruppe wie im DOM)
  let Z = ppFx34Zelle();                                              // Rasterzelle (CSS-px); bei Fenstergröße neu gelesen
  const M = o.motes.map((p) => {
    const schl = /--amb-board-opp/.test(p.color) ? 'opp' : /var\(/.test(p.color) ? 'me' : 'weiss';
    const rgb = schl === 'weiss' ? ppFx34Rgb(p.color) : farbe[schl];
    const hex = ruhig ? ppFx34Misch(rgb, p.max * p.max * 0.5) : ppFx34Misch(rgb, p.max);   // ruhig: deckend gemischt, dann mit Deckkraft max·0,5 über dem dunklen Grund
    return { L: p.left, T: p.top, S: p.size, hex, p, t: ruhig ? null : ppFx34Tafel(p, Z) };
  });
  const gruppen = [];
  { const byHex = new Map(); M.forEach((m) => { let g = byHex.get(m.hex); if (!g) { g = { hex: m.hex, m: [] }; byHex.set(m.hex, g); gruppen.push(g); } g.m.push(m); }); }
  let W = 0, H = 0, dpr = 1, gestoppt = false, sichtbar = false, bereit = false, id = 0, t0 = -1, idleId = 0;
  const OX = o.ox || 0, OY = o.oy || 0;     // Ursprung der Ebene innerhalb der Leinwand (Hand: Leinwand ragt über die Leiste hinaus)

  function zelleNeu() {            // Zelle geändert (Fenstergröße, Brettskala) → Bildfolgen neu rechnen
    const z = ppFx34Zelle();
    if (z === Z) return false;
    Z = z; if (!ruhig) for (const m of M) m.t = ppFx34Tafel(m.p, Z);
    return true;
  }
  function groesse(w, h) {          // nur bei Größenänderung (ResizeObserver) — nie im Takt
    const zn = zelleNeu();
    const d = window.devicePixelRatio || 1;
    W = w - 2 * OX; H = h - OY - (o.unten || 0);
    const bw = Math.max(1, Math.round(w * d)), bh = Math.max(1, Math.round(h * d));
    if (bw === cv.width && bh === cv.height && d === dpr) { if (zn && bereit) zeichnen(performance.now()); return; }
    dpr = d; cv.width = bw; cv.height = bh;     // setzt die Leinwand zurück → neu zeichnen
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
      for (let i = 0; i < g.m.length; i++) {
        const m = g.m[i], ta = m.t;
        let x, y, s;
        if (ta) {
          let l = lauf - ta.delay2;
          l -= Math.floor(l / ta.D2) * ta.D2;
          let k = (l / ta.schritt) | 0; if (k >= ta.K) k = ta.K - 1;
          if (!ta.an[k]) continue;
          s = ta.px[k];
          x = OX + Math.round(m.L * W / 100 / Z) * Z + ta.tx[k];
          y = OY + Math.round(m.T * H / 100 / Z) * Z + ta.ty[k];
        } else { s = Math.max(1, Math.round(m.S / 2)) * Z; x = OX + Math.round(m.L * W / 100 / Z) * Z; y = OY + Math.round(m.T * H / 100 / Z) * Z; }
        const px = Math.round(x * dpr), py = Math.round(y * dpr), ps = Math.max(1, Math.round(s * dpr));
        ctx.fillRect(px, py, ps, ps);
      }
    }
  }
  function tick(t) {
    id = 0;
    if (gestoppt || !sichtbar) return;
    const zm = window.__ppFx34Zeit;                                   // nur Tests: Kosten je Bild sammeln
    if (zm) { const a = performance.now(); zeichnen(t); zm.push(performance.now() - a); } else zeichnen(t);
    id = raf(tick);
  }
  function anwerfen() { if (!id && bereit && sichtbar && !gestoppt && !ruhig) id = raf(tick); }

  let ro = null, io = null;
  try {
    ro = new ResizeObserver((es) => { const r = es[es.length - 1].contentRect; groesse(r.width, r.height); });
    ro.observe(cv);
  } catch (e) { /* ohne */ }
  try {
    io = new IntersectionObserver((es) => { sichtbar = es[es.length - 1].isIntersecting; if (sichtbar) anwerfen(); });
    io.observe(cv);
  } catch (e) { sichtbar = true; }
  const aufResize = () => { const d = window.devicePixelRatio || 1; if ((d !== dpr || ppFx34Zelle() !== Z) && cv.isConnected) groesse(cv.clientWidth, cv.clientHeight); };
  window.addEventListener('resize', aufResize);
  // Erstes Zeichnen im Leerlauf: legt die Leinwand-Ressourcen an, bevor sie im Takt gebraucht werden
  const los = () => {
    idleId = 0; if (gestoppt) return;
    if (!(W > 0)) groesse(cv.clientWidth, cv.clientHeight);
    bereit = true;
    const zm = window.__ppFx34Zeit;                                   // nur Tests: auch das erste (Leerlauf-)Zeichnen messen
    if (zm) { const a = performance.now(); zeichnen(a); zm.push(performance.now() - a); } else zeichnen(performance.now());
    anwerfen();
  };
  if (window.requestIdleCallback) idleId = window.requestIdleCallback(los, { timeout: 400 }); else idleId = setTimeout(los, 60);
  const stopp = () => {
    gestoppt = true;
    if (id) { try { cancelAnimationFrame(id); } catch (e) { /* weg */ } id = 0; }
    if (idleId) { try { window.cancelIdleCallback ? window.cancelIdleCallback(idleId) : clearTimeout(idleId); } catch (e) { /* weg */ } }
    window.removeEventListener('resize', aufResize);
    if (ro) ro.disconnect();
    if (io) io.disconnect();
  };
  const modell = (lauf) => M.map((m) => {
    const ta = m.t; let l = lauf - ta.delay2; l -= Math.floor(l / ta.D2) * ta.D2;
    let k = (l / ta.schritt) | 0; if (k >= ta.K) k = ta.K - 1;
    const sz = ta.px[k];
    return { an: ta.an[k], k, x: OX + Math.round(m.L * W / 100 / Z) * Z + ta.tx[k], y: OY + Math.round(m.T * H / 100 / Z) * Z + ta.ty[k], s: sz };
  });
  stopp.pruef = { modell, zeichnen, halt: (v) => { gestoppt = v; }, t0: (v) => { t0 = v; }, info: () => ({ W, H, dpr, gruppen: gruppen.length }) };   // Pruefhaken fuer Bildvergleiche (Testskripte)
  return stopp;
}

function PpFx34AmbienteInnen({ art, motes, farbeMe, farbeOpp }) {
  const ref = React.useRef(null);
  // Hand: Die Leinwand ragt über die Leiste hinaus (Motes steigen heraus): Rand = größte Drift + Teilchengröße
  const rand = React.useMemo(() => {
    if (art !== 'hand') return { ox: 0, oy: 0, unten: 0 };
    let ox = 0, oy = 0;
    for (const p of motes) {
      ox = Math.max(ox, Math.abs(p.dx), Math.abs(ppFx34Gerade(p.dx * 1.6, 3)));
      oy = Math.max(oy, -p.dy, -ppFx34Gerade(p.dy * 1.8, 3));
    }
    return { ox: Math.ceil(ox) + 9, oy: Math.ceil(oy) + 9, unten: 9 };   // Rand: Drift + 2 Zellen (bis Zelle 3 → 6 px) + Rundung
  }, [art, motes]);
  React.useEffect(() => {
    if (!ref.current) return undefined;
    const stopp = ppFx34Start(ref.current, { motes, farbeMe, farbeOpp, ox: rand.ox, oy: rand.oy, unten: rand.unten });
    if (Array.isArray(window.__ppFx34Probe)) window.__ppFx34Probe.push({ art, motes, canvas: ref.current, stopp });   // nur Tests
    return stopp;
  }, [motes, farbeMe, farbeOpp, rand]);
  const stil = art === 'hand'
    ? { left: -rand.ox, top: -rand.oy, width: `calc(100% + ${2 * rand.ox}px)`, height: `calc(100% + ${rand.oy + rand.unten}px)` }
    : { left: 0, top: 0, width: '100%', height: '100%' };
  return <canvas ref={ref} className="pp-fx34-leinwand" aria-hidden="true" style={stil} />;
}
window.PpFx34Ambiente = React.memo(PpFx34AmbienteInnen);
