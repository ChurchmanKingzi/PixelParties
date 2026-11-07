// app-fx-35: Foil-Funken und -Staub als EINE Leinwand je Foil-Karte (statt ~18 DOM-Elementen mit Endlos-Animation je Karte)
//
// ═════════════════════════════════════════════════════════════════
//  Vorher: `FoilOverlay` (app-shared.jsx) hängte je Foil-Karte 10–12 `.foil-sparkle` und 6 `.foil-mote` ein, jedes mit Endlos-CSS-Animation und
//  `will-change` (eigene Compositing-Ebene). `pixel-anim.js` bäckt jede dieser Animationen in gestufte Web-Animationen und hängt bei Skalierung eine
//  wirkungslose Eigenschaft (`scrollMarginTop`) an, um sie auf den Hauptthread zu zwingen (der Compositor würde bilinear skalieren → Mischfarben).
//  Folge im Leerlauf (Tutorial-7-Brett, 2 Foil-Karten): 22 Funken = ~3/4 der Foil-Kosten (Style-Neuaufbau + Paint + Layerize je Taktwechsel).
//
//  Jetzt: EINE `<canvas>` je Foil-Karte (im selben Overlay, gleiche Ebene/Beschneidung wie die alten Elemente), im 30-Hz-Takt (`ppTaktRaf`) von EINER
//  gemeinsamen Schleife gezeichnet — und nur, wenn sich im Takt wirklich ein Bild ändert (Funken stehen ~45 % des Zyklus unsichtbar).
//  Das Aussehen ist das der gebackenen Animation, Schritt für Schritt nachgebaut (Quelle: `pixel-anim.js`, `backenProbeVorbereiten`/`frameBauen`):
//    • Funke (`@keyframes sparkle`, `ease-in-out` je Teilstück): Dauer/Delay auf ganze Takte, je Durchlauf höchstens 40 gehaltene Bilder (Schritt = ceil(Bilder/40)
//      Takte), Skalierung auf ganze Kunstpixel-Kantenlängen (`snapScaleGroesse`: n = round(s·B/2), s' = 2n/B; B = ganzzahlige Boxbreite), Drehung entfällt
//      (4-zählige Symmetrie: Viertelschritte sehen gleich aus), Deckkraft: Boxen unter 400 px² nur ein/aus (Stufe ≥ 8 von 16), größere als 4×4-Bayer-Dither
//      (Zellen 2 px, 8 Stufen). Dither hier in Bildschirmzellen (nicht mit der Funkenskalierung mitskaliert — nur in 1–2 Bildern je Zyklus zu sehen).
//    • Aufbau eines Funkens (style.css `.foil-sparkle`): Box 5·S (S = Funkengröße, Diamond S+1) mit Kern-Verlauf (weiß → Farbe → durchsichtig) über einem
//      stufig auslaufenden Hof (Radius 2,4·S) und zwei dünnen Spitzen (1 bzw. 1,4 px breit, 4,4·S bzw. 5,2·S lang), Mitte = (x % + S/2, y % + S/2).
//    • Staub (`@keyframes foilMote`, linear): bis 8 s Laufzeit gebacken (Verschiebung auf 2-px-Raster, Skalierung 0,5/1, ein/aus); längere Läufe
//      (> `globalMaxDauer`, 8 s) laufen im Original UNgebacken und gleiten — so auch hier (Bruchpixel, Deckkraft stufenlos). Ring = Farbe des Original-Rings
//      (aus dem berechneten `box-shadow` einer Probe-Mote gelesen, damit er immer zur Stylesheet-Pipeline passt).
//  Phase: wie die alten Animationen auf der gemeinsamen Foil-Uhr (`foilUhrStellen`): lokale Zeit = Uhr + foilVersatz(Karten-Schlüssel) − Delay.
//
//  Kosten: Größenänderung nur per ResizeObserver (nie Layout im Takt), gezeichnet wird nur, solange die Leinwand sichtbar ist (IntersectionObserver),
//  nicht hinter einem offenen Dialog (wie `body.pp-dialog-offen` die CSS-Animationen anhält) und nicht bei „Play Animations: aus“. Das erste Zeichnen
//  läuft im Leerlauf (requestIdleCallback). Telefon-Profil (`pointer: coarse` + `max-height: 600px`, battle-lite): keine Leinwand, die Funken/Staub bleiben
//  per CSS aus wie bisher. Kleinansicht (`.foil-klein`, Piles/Galerien) und Retro/Ohne-Pipeline: unverändert die DOM-Funken.
//  Test/Vergleich: `window.__ppFx35Alt = true` (vor dem Aufbau der Karte) lässt die alten DOM-Funken stehen; `window.ppFx35Stellen(t)` zeichnet alle Leinwände
//  zur festen Zeit `t` (ms, ohne Karten-Versatz) und hält die Schleife an; `window.ppFx35Stellen(null)` gibt sie wieder frei.
//
//  Aufruf (FoilOverlay):  window.ppFx35FoilAn() → true: <window.PpFx35Foil posn sparkles motes nFunken nStaub diamond fkey /> statt der DOM-Funken/-Staubkörner.
// ═════════════════════════════════════════════════════════════════
const PP_FX35_TAKT = 1000 / 30;
const PP_FX35_MAX_BILDER = 40;                    // pixel-anim.js KONFIG.globalMaxBilder
const PP_FX35_MAX_DAUER = 8000;                   // pixel-anim.js KONFIG.globalMaxDauer (längere Läufe bleiben ungebacken)
const PP_FX35_BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];

// cubic-bezier(.42, 0, .58, 1) = CSS `ease-in-out`
function ppFx35Ease(x) {
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
const ppFx35SnapPx = (v) => (v < 0 ? -1 : 1) * Math.round(Math.abs(v) / 2) * 2 || 0;   // pixel-anim.js snapPx (Raster 2)

/** Deckkraft 0..1 → Dither-Stufe 0..16 nach `frameBauen` (ditherStufe, Schritt 2: Zwischenstufen auf 2…14). */
function ppFx35Stufe(a) {
  let st;
  if (!(a > 0) || a < 1 / 32) st = 0;
  else if (a >= 1 || a > 31 / 32) st = 16;
  else st = Math.max(1, Math.min(15, Math.round(a * 16)));
  if (st > 0 && st < 16) st = Math.max(2, Math.min(14, Math.round(st / 2) * 2));
  return st;
}

// @keyframes sparkle (style.css): [Anteil, Skalierung, Deckkraft]; Drehung entfällt (siehe Kopf)
const PP_FX35_FUNKE_KF = [[0, 0, 0], [0.12, 1.35, 1], [0.26, 0.75, 0.65], [0.42, 1.05, 0.95], [0.58, 0, 0], [1, 0, 0]];
function ppFx35FunkeWert(p) {
  const K = PP_FX35_FUNKE_KF;
  let i = 0; while (i < K.length - 2 && p >= K[i + 1][0]) i++;
  const a = K[i], b = K[i + 1], e = ppFx35Ease((p - a[0]) / (b[0] - a[0]));
  return [a[1] + (b[1] - a[1]) * e, a[2] + (b[2] - a[2]) * e];
}

/** Bildfolge eines Funkens (einmal gerechnet): gehaltene Schritte mit Skalierungsfaktor und Maskenstufe (0 = unsichtbar … 16 = voll). */
function ppFx35FunkenTafel(dur, delay, S) {
  const T = PP_FX35_TAKT;
  const B = Math.max(1, Math.round(5 * S));                       // offsetWidth der Box (5·S)
  const D2 = Math.max(T, Math.round(dur * 1000 / T) * T);
  const delay2 = Math.round(delay * 1000 / T) * T;
  const stride = Math.max(1, Math.ceil(Math.round(D2 / T) / PP_FX35_MAX_BILDER));
  const schritt = stride * T;
  const K = Math.max(1, Math.ceil((D2 - 1e-6) / schritt));
  const roh = [];
  for (let k = 0; k < K; k++) roh.push(ppFx35FunkeWert(k * schritt / D2));
  const stufen = roh.map((w) => ppFx35Stufe(w[1]));
  const maske = B * B >= 400 && stufen.some((s) => s > 0 && s < 16);   // `ditherMin`: kleine Boxen blenden nur ein/aus
  const sc = new Float32Array(K), m = new Uint8Array(K), code = new Int32Array(K);
  for (let k = 0; k < K; k++) {
    const a = roh[k][0];
    const n = a >= 0.02 ? Math.max(1, Math.round(a * B / 2)) : 0;           // snapScaleGroesse (Raster 2)
    const st = maske ? stufen[k] : (stufen[k] >= 8 ? 16 : 0);
    if (n === 0 || st === 0) { sc[k] = 0; m[k] = 0; code[k] = 0; continue; }
    sc[k] = n * 2 / B; m[k] = st; code[k] = n * 32 + st;
  }
  return { D2, delay2, schritt, K, sc, m, code };
}

/** Bildfolge eines Staubkorns: gebacken (gehaltene Schritte, ganze Kunstpixel) oder — bei Läufen über 8 s — ungebacken (null → gleitet). */
function ppFx35StaubTafel(p) {
  const T = PP_FX35_TAKT;
  const D2 = Math.max(T, Math.round(p.dur * 1000 / T) * T);
  const delay2 = Math.round(p.delay * 1000 / T) * T;
  if (p.dur * 1000 > PP_FX35_MAX_DAUER) return { glatt: true, D2: p.dur * 1000, delay2: p.delay * 1000 };
  const stride = Math.max(1, Math.ceil(Math.round(D2 / T) / PP_FX35_MAX_BILDER));
  const schritt = stride * T;
  const K = Math.max(1, Math.ceil((D2 - 1e-6) / schritt));
  const W = Math.max(1, Math.round(p.size));                      // offsetWidth (< 4 px → snapScale, Raster 2)
  const tx = new Int16Array(K), ty = new Int16Array(K), sc = new Float32Array(K), code = new Int32Array(K);
  for (let k = 0; k < K; k++) {
    const u = k * schritt / D2;
    const o = u < 0.15 ? p.o * u / 0.15 : u < 0.7 ? p.o : p.o * (1 - (u - 0.7) / 0.3);
    if (ppFx35Stufe(o) < 8) { code[k] = 0; continue; }
    const a = 0.6 + 0.5 * u;
    const n = W >= 4 ? Math.max(1, Math.round(a * W / 2)) * 2 / W : (a >= 0.25 ? Math.max(1, Math.round(a * 2)) / 2 : 0);
    if (!(n > 0)) { code[k] = 0; continue; }
    tx[k] = ppFx35SnapPx(p.dx * u); ty[k] = ppFx35SnapPx(p.dy * u); sc[k] = n;
    code[k] = 1 + k;                                              // eigener Code je Schritt (Lage ändert sich fast immer)
  }
  return { glatt: false, D2, delay2, schritt, K, tx, ty, sc, code };
}

// ── Farben ──
let ppFx35ProbeCtx = null;
function ppFx35Rgb(c) {
  let m = /^#([0-9a-f]{6})$/i.exec(c || '');
  if (!m) { const k = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(c || ''); if (k) m = [0, k[1] + k[1] + k[2] + k[2] + k[3] + k[3]]; }
  if (!m) {
    try {
      if (!ppFx35ProbeCtx) ppFx35ProbeCtx = document.createElement('canvas').getContext('2d');
      ppFx35ProbeCtx.fillStyle = '#ffffff'; ppFx35ProbeCtx.fillStyle = c;
      m = /^#([0-9a-f]{6})$/i.exec(ppFx35ProbeCtx.fillStyle);
    } catch (e) { /* weiß */ }
  }
  const n = parseInt(m ? m[1] : 'ffffff', 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const ppFx35Rgba = (rgb, a) => 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + a + ')';
/** Ring-Farbe der Staubkörner: Original-Stylesheet (`.foil-mote { box-shadow: 0 0 4px currentColor }` → harter Ring) an einer Probe-Mote gelesen. */
const ppFx35RingCache = new Map();
function ppFx35RingFarbe(hex, rgb) {
  let r = ppFx35RingCache.get(hex);
  if (r) return r;
  r = [rgb[0] * 0.55, rgb[1] * 0.55, rgb[2] * 0.55];             // Rückfall: Farbe · 0,55 (so rechnet pixel-hart.js den Ring heute)
  try {
    const p = document.createElement('div');
    p.className = 'foil-mote'; p.setAttribute('data-pp-px', 'aus');
    p.style.cssText = 'position:fixed;left:-99px;top:-99px;animation:none;color:' + hex;
    document.body.appendChild(p);
    const bs = getComputedStyle(p).boxShadow || '';
    document.body.removeChild(p);
    let m = /color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(bs);
    if (m) r = [Math.round(m[1] * 255), Math.round(m[2] * 255), Math.round(m[3] * 255)];
    else if ((m = /rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/.exec(bs))) r = [+m[1], +m[2], +m[3]];
  } catch (e) { /* Rückfall */ }
  ppFx35RingCache.set(hex, r);
  return r;
}

// ── Dither (Bayer 4×4, Zellen 2 CSS-px) als Muster ──
const ppFx35Muster = new Map();
function ppFx35DitherMuster(stufe, zelle) {
  const k = stufe + ':' + zelle;
  let p = ppFx35Muster.get(k);
  if (p) return p;
  const c = document.createElement('canvas'); c.width = c.height = 4 * zelle;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if (PP_FX35_BAYER[y][x] < stufe) g.fillRect(x * zelle, y * zelle, zelle, zelle);
  p = g.createPattern(c, 'repeat');
  ppFx35Muster.set(k, p);
  return p;
}
let ppFx35Kratzer = null;          // Hilfsleinwand für maskierte (gedither­te) Funken
function ppFx35KratzerHolen(w, h) {
  if (!ppFx35Kratzer) ppFx35Kratzer = document.createElement('canvas');
  if (ppFx35Kratzer.width < w || ppFx35Kratzer.height < h) { ppFx35Kratzer.width = Math.max(ppFx35Kratzer.width, w); ppFx35Kratzer.height = Math.max(ppFx35Kratzer.height, h); }
  return ppFx35Kratzer;
}

// ── Modell einer Leinwand: Funken + Staub mit Tafeln (einmal gerechnet; Geometrie in CSS-px kommt erst mit der Größe) ──
function ppFx35Modell(o) {
  const diamond = !!o.diamond;
  const funken = [];
  for (let i = 0; i < o.posn.length; i++) {
    if (!(o.behalten ? o.behalten(i) : true)) continue;
    const sp = o.posn[i], f = (o.sparkles && o.sparkles[i]) || null;
    const S0 = f ? f.size : 4.5, S = diamond ? S0 + 1 : S0;
    funken.push({ x: sp.x, y: sp.y, rgb: ppFx35Rgb(sp.color), S, diamond, t: ppFx35FunkenTafel(sp.dur, f ? f.delay : sp.delay, S), gr: new Map(), cx: 0, cy: 0 });
  }
  const staub = [];
  const motes = o.motes || [];
  for (let i = 0; i < motes.length && i < o.nStaub; i++) {
    const m = motes[i];
    const p = { dur: +m.dur.toFixed(1), delay: +m.delay.toFixed(1), size: +m.size.toFixed(1), dx: +m.dx.toFixed(0), dy: +m.dy.toFixed(0), o: +m.o.toFixed(2) };
    staub.push({ x: m.x, y: m.y, hex: m.color, rgb: ppFx35Rgb(m.color), ring: null, M: p.size, p, t: ppFx35StaubTafel(p), cx: 0, cy: 0 });
  }
  return { funken, staub, versatz: o.versatz, fkey: o.fkey, diamond };
}

// ── Zeichnen eines Funkens (Gradienten je Skalierungsstufe gemerkt: Mitte ist je Leinwandgröße fest) ──
function ppFx35FunkeGradienten(f, sc) {
  const key = Math.round(sc * 1000);
  let g = f.gr.get(key);
  if (g) return g;
  const S = f.S, c = f.rgb, cx = f.cx, cy = f.cy;
  const R1 = 2.4 * S * sc, R0 = 0.7071 * S * sc;
  const hofG = ppFx35Ctx0.createRadialGradient(cx, cy, 0, cx, cy, R1);
  hofG.addColorStop(0, ppFx35Rgba(c, 0.8)); hofG.addColorStop(0.3, ppFx35Rgba(c, 0.4)); hofG.addColorStop(0.6, ppFx35Rgba(c, 0.2));
  hofG.addColorStop(0.85, ppFx35Rgba(c, 0.05)); hofG.addColorStop(1, ppFx35Rgba(c, 0));
  const kernG = ppFx35Ctx0.createRadialGradient(cx, cy, 0, cx, cy, R0);
  kernG.addColorStop(0, '#ffffff'); kernG.addColorStop(0.4, ppFx35Rgba(c, 1)); kernG.addColorStop(0.72, ppFx35Rgba(c, 0)); kernG.addColorStop(1, ppFx35Rgba(c, 0));
  const len = (f.diamond ? 5.2 : 4.4) * S * sc, w = (f.diamond ? 1.4 : 1) * sc;
  const vG = ppFx35Ctx0.createLinearGradient(0, cy - len / 2, 0, cy + len / 2), hG = ppFx35Ctx0.createLinearGradient(cx - len / 2, 0, cx + len / 2, 0);
  for (const sg of [vG, hG]) {
    sg.addColorStop(0, ppFx35Rgba(c, 0)); sg.addColorStop(0.32, ppFx35Rgba(c, 1)); sg.addColorStop(0.5, '#ffffff'); sg.addColorStop(0.68, ppFx35Rgba(c, 1)); sg.addColorStop(1, ppFx35Rgba(c, 0));
  }
  g = { hof: hofG, kern: kernG, v: vG, h: hG, R1, R0, len, w };
  if (f.gr.size > 40) f.gr.clear();
  f.gr.set(key, g);
  return g;
}
let ppFx35Ctx0 = null;   // Kontext, an dem Gradienten angelegt werden (sie sind kontextunabhängig)

function ppFx35MaleFunke(g, f, sc) {
  const G = ppFx35FunkeGradienten(f, sc), cx = f.cx, cy = f.cy;
  g.fillStyle = G.hof; g.fillRect(cx - G.R1, cy - G.R1, 2 * G.R1, 2 * G.R1);
  g.fillStyle = G.kern; g.fillRect(cx - G.R0, cy - G.R0, 2 * G.R0, 2 * G.R0);
  g.fillStyle = G.v; g.fillRect(cx - G.w / 2, cy - G.len / 2, G.w, G.len);
  g.fillStyle = G.h; g.fillRect(cx - G.len / 2, cy - G.w / 2, G.len, G.w);
}

function ppFx35MaleStaub(g, s, glatt, tx, ty, sc, alpha) {
  const r = s.M / 2 * sc, cx = s.cx + tx, cy = s.cy + ty;
  if (alpha < 1) g.globalAlpha = alpha;
  g.fillStyle = s.ringFarbe; g.beginPath(); g.arc(cx, cy, r + 2 * sc, 0, 6.283185307179586); g.fill();
  g.fillStyle = s.farbe; g.beginPath(); g.arc(cx, cy, r, 0, 6.283185307179586); g.fill();
  if (alpha < 1) g.globalAlpha = 1;
}
const ppFx35Hex = (rgb) => '#' + [0, 1, 2].map((i) => ('0' + Math.round(rgb[i]).toString(16)).slice(-2)).join('');

// ── Verwaltung: eine gemeinsame Schleife, gemeinsame Beobachter ──
const PP_FX35 = { liste: new Set(), id: 0, ro: null, io: null, halt: false, zeit: null, lite: false, lq: null, warm: false };

function ppFx35Lite() {
  try { return window.matchMedia('(pointer: coarse) and (max-height: 600px)').matches; } catch (e) { return false; }
}
/** Dürfen Funken/Staub als Leinwand laufen? (sonst: unveränderte DOM-Funken) */
function ppFx35FoilAn() {
  try {
    if (window.__ppFx35Alt || window.PP_RETRO) return false;
    const P = window.PPPixelAnim;
    if (!P || !P.KONFIG || !P.KONFIG.aktiv) return false;               // ohne Pipeline laufen die CSS-Funken ungebacken (weich) — das bildet die Leinwand nicht nach
    if (ppFx35Lite()) return false;                                     // Telefon: battle-lite blendet Funken/Staub per CSS aus
    if (typeof CSS === 'undefined' || !CSS.supports || !CSS.supports('color: color-mix(in srgb, red, blue)')) return false;   // sonst gilt der kleine Funke mit Schatten
    return true;
  } catch (e) { return false; }
}
window.ppFx35FoilAn = ppFx35FoilAn;

function ppFx35Warm() {
  if (PP_FX35.warm) return;
  PP_FX35.warm = true;
  try {
    const c = ppFx35KratzerHolen(64, 64);
    const g = c.getContext('2d');
    ppFx35Ctx0 = ppFx35Ctx0 || g;
    const gr = g.createRadialGradient(8, 8, 0, 8, 8, 8); gr.addColorStop(0, '#fff'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 16, 16);
    g.globalCompositeOperation = 'destination-in'; g.fillStyle = ppFx35DitherMuster(8, 2); g.fillRect(0, 0, 16, 16);
    g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, 64, 64);
  } catch (e) { /* weg */ }
}
function ppFx35Ctx() {
  if (!ppFx35Ctx0) { ppFx35Warm(); }
  return ppFx35Ctx0;
}

// ── Atlas der gedithe­rten Funken-Bilder: je (Schlüssel, Größe, dpr) EINE Leinwand mit allen Stufen, die einen Dither brauchen ──
const PP_FX35_ATLAS = new Map();
const PP_FX35_ATLAS_BREITE = 1024, PP_FX35_ATLAS_MAXH = 4096;
function ppFx35AtlasPlan(L) {
  const d = L.dpr, M = L.modell, slots = new Map();
  let x = 0, y = 0, zeile = 0;
  for (let i = 0; i < M.funken.length; i++) {
    const F = M.funken[i], t = F.t;
    for (let k = 0; k < t.K; k++) {
      if (!t.code[k] || t.m[k] >= 16) continue;
      const key = i * 4096 + t.code[k];
      if (slots.has(key)) continue;
      const R = 2.4 * F.S * t.sc[k];
      const bx = Math.floor((F.cx - R) * d) - 1, by = Math.floor((F.cy - R) * d) - 1, w = Math.ceil(2 * R * d) + 3;
      if (x + w > PP_FX35_ATLAS_BREITE) { x = 0; y += zeile; zeile = 0; }
      slots.set(key, { sx: x, sy: y, w, h: w, bx, by, k, fertig: false });
      x += w; zeile = Math.max(zeile, w);
    }
  }
  return { slots, hoehe: y + zeile };
}
function ppFx35AtlasHolen(L) {
  const key = L.modell.fkey + '|' + L.W + 'x' + L.H + '|' + L.dpr + '|' + L.modell.funken.length + '|' + L.modell.diamond;
  let A = PP_FX35_ATLAS.get(key);
  if (A) { if (L.atlas !== A) { A.n++; L.atlas = A; } return A; }
  const plan = ppFx35AtlasPlan(L);
  if (!plan.slots.size) return null;
  if (plan.hoehe > PP_FX35_ATLAS_MAXH) return null;
  const cv = document.createElement('canvas'); cv.width = PP_FX35_ATLAS_BREITE; cv.height = Math.max(1, plan.hoehe);
  A = { key, cv, g: cv.getContext('2d'), slots: plan.slots, n: 1 };
  if (PP_FX35_ATLAS.size > 24) { const k0 = PP_FX35_ATLAS.keys().next().value; PP_FX35_ATLAS.delete(k0); }
  PP_FX35_ATLAS.set(key, A); L.atlas = A;
  return A;
}
function ppFx35SpriteMalen(L, i, sl) {
  const A = L.atlas, g = A.g, F = L.modell.funken[i], t = F.t, k = sl.k, d = L.dpr, sc = t.sc[k], m = t.m[k];
  g.save();
  g.beginPath(); g.rect(sl.sx, sl.sy, sl.w, sl.h); g.clip();
  g.setTransform(d, 0, 0, d, sl.sx - sl.bx, sl.sy - sl.by);
  ppFx35MaleFunke(g, F, sc);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'destination-in';
  const pat = ppFx35DitherMuster(m, Math.max(1, Math.round(2 * d)));
  if (pat.setTransform) pat.setTransform(new DOMMatrix().translate(sl.sx - sl.bx, sl.sy - sl.by));
  g.fillStyle = pat; g.fillRect(sl.sx, sl.sy, sl.w, sl.h);
  g.restore();
  sl.fertig = true;
}
function ppFx35Sprite(L, i, k) {
  let A = L.atlas;
  if (!A) { A = ppFx35AtlasHolen(L); if (!A) return null; }
  const sl = A.slots.get(i * 4096 + L.modell.funken[i].t.code[k]);
  if (!sl) return null;
  if (!sl.fertig) ppFx35SpriteMalen(L, i, sl);
  return sl;
}
/** Im Leerlauf alle Stufen vormalen (höchstens ~3 ms je Aufruf), damit der Takt nie malen + ausstanzen muss. */
function ppFx35Aufwaermen(L) {
  L.warmId = 0; if (L.tot) return;
  const A = ppFx35AtlasHolen(L); if (!A) return;
  const t0 = performance.now();
  for (const [key, sl] of A.slots) {
    if (sl.fertig) continue;
    ppFx35SpriteMalen(L, (key / 4096) | 0, sl);
    if (performance.now() - t0 > 3) break;
  }
  for (const sl of A.slots.values()) if (!sl.fertig) { L.warmId = window.requestIdleCallback ? window.requestIdleCallback(() => ppFx35Aufwaermen(L), { timeout: 500 }) : setTimeout(() => ppFx35Aufwaermen(L), 30); return; }
}

/** Lokale Animationszeit (ms) eines Funkens/Staubs zum Zeitpunkt `jetzt`. */
const ppFx35Lokal = (jetzt, versatz, delay2, D2) => { const l = jetzt + versatz - delay2; return l - Math.floor(l / D2) * D2; };

/** Zeichnen einer Leinwand zum Zeitpunkt `jetzt` (ms); `erzwingen`: auch ohne Änderung. Gibt true zurück, wenn gemalt wurde. */
function ppFx35Zeichnen(L, jetzt, erzwingen) {
  const M = L.modell, W = L.W, H = L.H;
  if (!(W > 0 && H > 0) || !L.ctx) return false;
  const frei = PP_FX35.zeit !== null;
  const versatz = frei ? 0 : M.versatz;
  const f = M.funken, s = M.staub;
  // Zustand dieses Takts (Codes) — nur malen, wenn er sich gegenüber dem letzten Bild geändert hat
  let neu = erzwingen || L.dirty;
  const codes = L.codes;
  for (let i = 0; i < f.length; i++) {
    const t = f[i].t, l = ppFx35Lokal(jetzt, versatz, t.delay2, t.D2);
    let k = (l / t.schritt) | 0; if (k >= t.K) k = t.K - 1;
    const c = t.code[k];
    if (codes[i] !== c) { codes[i] = c; neu = true; }
    f[i].k = k;
  }
  for (let i = 0; i < s.length; i++) {
    const t = s[i].t, o = f.length + i;
    let c;
    if (t.glatt) {
      const u = ppFx35Lokal(jetzt, versatz, t.delay2, t.D2) / t.D2;
      s[i].u = u; c = 1 + ((u * 2000) | 0);                          // gleitend: ändert sich je Takt (~ 4 s Lauf = 30 Hz → eigener Code je Zehntelpromille)
    } else {
      const l = ppFx35Lokal(jetzt, versatz, t.delay2, t.D2);
      let k = (l / t.schritt) | 0; if (k >= t.K) k = t.K - 1;
      s[i].k = k; c = t.code[k];
    }
    if (codes[o] !== c) { codes[o] = c; neu = true; }
  }
  if (!neu) return false;
  L.dirty = false;
  const g = L.ctx, d = L.dpr;
  g.setTransform(d, 0, 0, d, 0, 0);
  g.clearRect(0, 0, W, H);
  for (let i = 0; i < f.length; i++) {
    const F = f[i], t = F.t, k = F.k;
    if (!t.code[k]) continue;
    const sc = t.sc[k], m = t.m[k];
    if (m >= 16) { ppFx35MaleFunke(g, F, sc); continue; }
    // Dither: fertiges, ausgestanztes Bild aus dem Atlas (je Karte/Größe einmal gemalt, siehe ppFx35Atlas) — kein Malen + Ausstanzen im Takt
    const sp = ppFx35Sprite(L, i, k);
    if (sp) { g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(L.atlas.cv, sp.sx, sp.sy, sp.w, sp.h, sp.bx, sp.by, sp.w, sp.h); g.setTransform(d, 0, 0, d, 0, 0); }
  }
  for (let i = 0; i < s.length; i++) {
    const S = s[i], t = S.t;
    if (t.glatt) {
      const u = S.u, o = u < 0.15 ? S.p.o * u / 0.15 : u < 0.7 ? S.p.o : S.p.o * (1 - (u - 0.7) / 0.3);
      if (o <= 0.01) continue;
      ppFx35MaleStaub(g, S, true, S.p.dx * u, S.p.dy * u, 0.6 + 0.5 * u, o);
    } else {
      const k = S.k;
      if (!t.code[k]) continue;
      ppFx35MaleStaub(g, S, false, t.tx[k], t.ty[k], t.sc[k], 1);
    }
  }
  return true;
}

/** Geometrie (Mitten in CSS-px) neu rechnen — nur bei Größenänderung. */
function ppFx35Geometrie(L) {
  const M = L.modell, W = L.W, H = L.H;
  for (const F of M.funken) { F.cx = F.x * W / 100 + F.S / 2; F.cy = F.y * H / 100 + F.S / 2; F.gr.clear(); }
  for (const S of M.staub) {
    S.cx = S.x * W / 100 + S.M / 2; S.cy = S.y * H / 100 + S.M / 2;
    if (!S.ring) { S.ring = ppFx35RingFarbe(S.hex, S.rgb); S.farbe = ppFx35Hex(S.rgb); S.ringFarbe = ppFx35Hex(S.ring); }
  }
  L.codes.fill(-1); L.atlas = null;
}

function ppFx35Groesse(L, w, h) {
  const d = window.devicePixelRatio || 1;
  if (w === L.W && h === L.H && d === L.dpr) return;
  L.W = w; L.H = h; L.dpr = d;
  const bw = Math.max(1, Math.round(w * d)), bh = Math.max(1, Math.round(h * d));
  if (L.cv.width !== bw || L.cv.height !== bh) { L.cv.width = bw; L.cv.height = bh; }       // setzt die Leinwand zurück
  ppFx35Geometrie(L);
  L.dirty = true;
}

function ppFx35Tick(t) {
  PP_FX35.id = 0;
  if (PP_FX35.halt) return;
  const aus = window._playAnimations === false || document.documentElement.classList.contains('no-animations');
  const dialog = document.body.classList.contains('pp-dialog-offen');
  const jetzt = PP_FX35.zeit !== null ? PP_FX35.zeit : t;
  let aktiv = 0;
  for (const L of PP_FX35.liste) {
    if (!L.sichtbar || !L.bereit) continue;
    if (aus) { if (L.gemalt) { L.ctx.setTransform(1, 0, 0, 1, 0, 0); L.ctx.clearRect(0, 0, L.cv.width, L.cv.height); L.gemalt = false; L.codes.fill(-1); } continue; }
    aktiv++;
    if (dialog && !L.imDialog) continue;                                // hinter einem offenen Dialog stehen die CSS-Animationen still — hier auch
    try { if (ppFx35Zeichnen(L, jetzt, false)) L.gemalt = true; } catch (e) { console.error(e); }
  }
  if (aktiv) PP_FX35.id = (window.ppTaktRaf || requestAnimationFrame)(ppFx35Tick);
}
function ppFx35Anwerfen() {
  if (PP_FX35.id || PP_FX35.halt) return;
  PP_FX35.id = (window.ppTaktRaf || requestAnimationFrame)(ppFx35Tick);
}

function ppFx35Beobachter() {
  if (!PP_FX35.ro && typeof ResizeObserver === 'function') {
    PP_FX35.ro = new ResizeObserver((es) => {
      for (const e of es) { const L = PP_FX35.byCv && PP_FX35.byCv.get(e.target); if (L) { const r = e.contentRect; ppFx35Groesse(L, r.width, r.height); if (L.sichtbar && L.bereit) ppFx35Anwerfen(); } }
    });
  }
  if (!PP_FX35.io && typeof IntersectionObserver === 'function') {
    PP_FX35.io = new IntersectionObserver((es) => {
      for (const e of es) { const L = PP_FX35.byCv && PP_FX35.byCv.get(e.target); if (L) { L.sichtbar = e.isIntersecting; if (L.sichtbar) { L.dirty = true; if (L.bereit) ppFx35Anwerfen(); } } }
    }, { rootMargin: '60px' });
  }
  if (!PP_FX35.byCv) PP_FX35.byCv = new WeakMap();
  if (!PP_FX35.lq && window.matchMedia) {
    try {
      PP_FX35.lq = window.matchMedia('(pointer: coarse) and (max-height: 600px)');
      const f = () => { const lite = PP_FX35.lq.matches; for (const L of PP_FX35.liste) L.cv.style.display = lite ? 'none' : ''; };
      (PP_FX35.lq.addEventListener ? PP_FX35.lq.addEventListener('change', f) : PP_FX35.lq.addListener(f));
    } catch (e) { /* ohne */ }
  }
}

/** Leinwand anmelden; gibt die Abmeldung zurück. */
function ppFx35Anmelden(cv, modell) {
  ppFx35Beobachter();
  const L = { cv, ctx: null, modell, W: 0, H: 0, dpr: 1, sichtbar: false, bereit: false, dirty: true, gemalt: false, codes: new Int32Array(modell.funken.length + modell.staub.length).fill(-1), imDialog: false, idle: 0, tot: false };
  try { L.imDialog = !!cv.closest('.modal-overlay, .card-tooltip, .board-tooltip'); } catch (e) { /* nein */ }
  PP_FX35.byCv.set(cv, L);
  PP_FX35.liste.add(L);
  if (PP_FX35.ro) PP_FX35.ro.observe(cv);
  if (PP_FX35.io) PP_FX35.io.observe(cv); else L.sichtbar = true;
  // Erstes Zeichnen im Leerlauf: legt die Leinwand-Ressourcen an, bevor sie im Takt gebraucht werden
  const los = () => {
    L.idle = 0; if (L.tot) return;
    L.ctx = cv.getContext('2d');
    ppFx35Warm(); if (!ppFx35Ctx0) ppFx35Ctx0 = L.ctx;
    if (!L.W && cv.clientWidth) ppFx35Groesse(L, cv.clientWidth, cv.clientHeight);
    ppFx35Geometrie(L);
    ppFx35Aufwaermen(L);                                   // Atlas anlegen + erste Stufen vormalen, bevor der Takt zeichnet
    L.bereit = true;
    if (L.sichtbar) { L.dirty = true; ppFx35Anwerfen(); }
  };
  if (window.requestIdleCallback) L.idle = window.requestIdleCallback(los, { timeout: 300 }); else L.idle = setTimeout(los, 40);
  return () => {
    L.tot = true;
    if (L.warmId) { try { window.cancelIdleCallback ? window.cancelIdleCallback(L.warmId) : clearTimeout(L.warmId); } catch (e) { /* weg */ } }
    PP_FX35.liste.delete(L);
    if (PP_FX35.ro) PP_FX35.ro.unobserve(cv);
    if (PP_FX35.io) PP_FX35.io.unobserve(cv);
    if (L.idle) { try { window.cancelIdleCallback ? window.cancelIdleCallback(L.idle) : clearTimeout(L.idle); } catch (e) { /* weg */ } }
  };
}

/** Testhaken: alle Leinwände zur festen Zeit `t` (ms) zeichnen und die Schleife anhalten (null: freigeben). */
window.ppFx35Stellen = (t) => {
  if (t === null || t === undefined) { PP_FX35.zeit = null; PP_FX35.halt = false; ppFx35Anwerfen(); return 0; }
  PP_FX35.zeit = t; PP_FX35.halt = true;
  let n = 0;
  for (const L of PP_FX35.liste) {
    if (!L.ctx) { L.ctx = L.cv.getContext('2d'); ppFx35Warm(); if (!ppFx35Ctx0) ppFx35Ctx0 = L.ctx; }
    if (!L.W && L.cv.clientWidth) ppFx35Groesse(L, L.cv.clientWidth, L.cv.clientHeight);
    if (!L.bereit) { ppFx35Geometrie(L); L.bereit = true; }
    if (ppFx35Zeichnen(L, t, true)) n++;
  }
  return n;
};
window.__ppFx35 = PP_FX35;

// ── React-Baustein ──
function PpFx35FoilInnen({ posn, sparkles, motes, nFunken, nStaub, diamond, fkey }) {
  const ref = React.useRef(null);
  const modell = React.useMemo(() => {
    const versatz = typeof foilVersatz === 'function' ? foilVersatz(fkey) : 0;
    return ppFx35Modell({ posn, sparkles, motes, nStaub, diamond, fkey, versatz, behalten: (i) => (typeof foilBehalten === 'function' ? foilBehalten(i, posn.length, nFunken) : true) });
  }, [posn, sparkles, motes, nFunken, nStaub, diamond, fkey]);
  React.useEffect(() => {
    if (!ref.current) return undefined;
    return ppFx35Anmelden(ref.current, modell);
  }, [modell]);
  return <canvas ref={ref} className="pp-fx35-foil" data-pp-px="aus" aria-hidden="true"
    style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />;
}
window.PpFx35Foil = React.memo(PpFx35FoilInnen);
