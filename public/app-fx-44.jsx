// app-fx-44: Mischen (Kartenrücken), Einschlag-Funken der Zonen und gestufte Größen des Tutorial-Highlights — ohne Laufzeit-Backen
//
// ═════════════════════════════════════════════════════════════════
//  Hintergrund: `public/pixel-anim.js` backt jede startende CSS-Animation zur Laufzeit (Probe, Abtasten, Quantisieren). Bei den hier ersetzten Animationen kostete das je Start 1–6 ms Hauptfaden
//  (Mischen: gedrehte Kartenrücken, ~75 ms am Rechner beim ersten Mal, am Handy ein Vielfaches) — und das bei jedem Mulligan, Elana-Effekt, Leadership …
//
//  1. MISCHEN (`deck_shuffle_fx`, vorher CSS `deckShuffleCard`): EINE Leinwand je Mischvorgang, drei Kartenrücken fächern aus dem Stapel und schnappen zurück (gleiche Zeiten, Wege und Drehwinkel wie
//     die DOM-Fassung: 420 ms je Blatt, Versatz 0/90/180 ms, Verschiebung bis 0,55 Kartenbreite, Drehung −14°/11°/−6°, ease-in-out; Deckkraft 0 → 0,95 → 0 als Bayer-Dither). Die Drehung ist eine
//     GERASTERTE Drehung: jede Rasterzelle (3 px) fragt das Rückenbild an ihrem zurückgedrehten Ort (nächster Nachbar) — nie ein gedrehtes Bild. Das Rückenbild (`cardbackUrl`, der WIRKLICH gewählte Rücken) wird
//     einmal je (Bild, Maß) auf das Zellgitter verkleinert und auf die Palette eingerastet (`ppFx44Ruecken`, im Leerlauf vorgeladen: `ppFx44Vorladen`, ersetzt das Vorwärmen des alten Backers). Die alte Fassung
//     zeigte nach dem Backen nur den Umriss der Blätter (das Bild fehlte im Sprite); jetzt ist der Rücken zu sehen, wie im Kommentar der CSS-Klasse gewollt. Rand: eine Zelle in Hellblau/Dunkelblau.
//  2. EINSCHLAG-FUNKEN (`zoneLandSpark`, vorher 10–15 `<i class="zone-land-spark">` je Einschlag mit Verlauf und Leuchten): `spawnZoneLandFx` (app-shared.jsx) übergibt die Zufallswerte (Weite, Dauer, Verzug,
//     Winkel, Länge, Dicke) an `ppFx44Funken`; EINE Leinwand je Einschlag (im Anker `.zone-land-fx`), gleiche Bahn wie die Keyframes (cubic-bezier(.12,.75,.3,1), 12 %-Knick, Größe .35 → 1 → .55,
//     Deckkraft 0 → 1 → .9 → 0 als Dither). Funke = Strich aus Rasterzellen: Schweif (Farbe, gedithert) → Kern (Farbe) → Kopf (Weiß); gerasterte Linie im Winkel der Flugbahn.
//  3. TUTORIAL-HIGHLIGHT (`tbHandGross`, `tbPhaseGross`): die Schlüsselbilder wechseln nur Hilfsvariablen (`--tbs`, `--tbt`), `ppFx44Stufen` rechnet Größe/Versatz je der vier Stufen vor (Größe so, dass die
//     gezeichnete Breite ein Vielfaches des Kunstpixels ist — dieselbe Rechnung wie der Backer, `snapScaleGroesse`).
//  Kosten: keine DOM-Teilchen, keine CSS-Animation, ein Takt (`ppTaktRaf`, 30 Hz) je Leinwand, nur bei neuem Bild zeichnen; Leinwände leben < 1,1 s.
// ═════════════════════════════════════════════════════════════════

const PP_FX44_C = { rand1: ppHex('#b3d8f9'), rand2: ppHex('#405f8c'), tinte: ppHex('#12101f'), blau: ppHex('#2d4362'), weiss: ppHex('#ffffff') };
const PP_FX44_S = 3;                                  // Bildschirmpixel je Rasterzelle
const PP_FX44_TAKT = 1000 / 30;

/** cubic-bezier(x1, y1, x2, y2) → f(t) (t, Ergebnis 0..1). */
function ppFx44Bez(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = (s) => ((ax * s + bx) * s + cx) * s, Y = (s) => ((ay * s + by) * s + cy) * s;
  return (x) => {
    if (x <= 0) return 0; if (x >= 1) return 1;
    let lo = 0, hi = 1, s = x;
    for (let i = 0; i < 24; i++) { const v = X(s); if (Math.abs(v - x) < 1e-5) break; if (v < x) lo = s; else hi = s; s = (lo + hi) / 2; }
    return Y(s);
  };
}
const PP_FX44_EASE_IO = ppFx44Bez(0.42, 0, 0.58, 1);          // ease-in-out
const PP_FX44_EASE_FUNKE = ppFx44Bez(0.12, 0.75, 0.3, 1);     // Funkenflug
const ppFx44Kl = (v, a, b) => Math.max(a, Math.min(b, v));

// ───────────────────────── 3. gestufte Größen (Tutorial-Highlight) ─────────────────────────
/** Inline-Variablen für `tbHandGross`/`tbPhaseGross`: Größe (--tbs1..3) und Versatz nach oben (--tbt1..3) der Stufen 1/4, 2/4, 3/4 von 1 → 1,5. `hoch` = Endversatz in px (≤ 0). */
function ppFx44Stufen(breite, hoch) {
  const r = {};
  const rein = window.PPPixelAnim && window.PPPixelAnim.rein;
  for (let k = 1; k <= 3; k++) {
    const roh = 1 + 0.5 * k / 4;
    const s = (rein && rein.snapScaleGroesse && breite >= 4) ? rein.snapScaleGroesse(roh, breite, 2) : roh;
    r['--tbs' + k] = String(Math.round(s * 10000) / 10000);
    r['--tbt' + k] = (Math.round((hoch || 0) * k / 4 / 2) * 2) + 'px';
  }
  return r;
}
window.ppFx44Stufen = ppFx44Stufen;

// ───────────────────────── 1. Mischen ─────────────────────────
const PP_FX44_RUECKEN = new Map();                  // Schlüssel → { grid: Uint8Array(W·H·3) | null, W, H, laedt }
/** Rückenbild als Zellgitter (RGB, auf die Palette eingerastet). Gibt das Gitter zurück oder null, solange das Bild lädt / nicht lesbar ist. */
function ppFx44Ruecken(url, W, H) {
  const k = url + '|' + W + 'x' + H;
  let e = PP_FX44_RUECKEN.get(k);
  if (e) return e.grid;
  e = { grid: null, W, H, laedt: true };
  PP_FX44_RUECKEN.set(k, e);
  try {
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement('canvas'); c.width = W; c.height = H;
        const g = c.getContext('2d', { willReadFrequently: true });
        g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
        g.drawImage(img, 0, 0, W, H);
        const d = g.getImageData(0, 0, W, H).data, out = new Uint8Array(W * H * 3);
        const snap = window.ppSnapRgb;
        for (let i = 0, j = 0; i < d.length; i += 4, j += 3) {
          const q = snap ? snap(d[i], d[i + 1], d[i + 2]) : [d[i], d[i + 1], d[i + 2]];
          out[j] = q[0]; out[j + 1] = q[1]; out[j + 2] = q[2];
        }
        e.grid = out;
      } catch (err) { /* nicht lesbar (fremde Herkunft): Rückfall-Farben */ }
      e.laedt = false;
    };
    img.onerror = () => { e.laedt = false; };
    img.src = url;
  } catch (err) { e.laedt = false; }
  return null;
}
/** Vorladen im Leerlauf (Stapelmaß wie beim echten Mischen), damit das Bild beim ersten Mischen schon im Zwischenspeicher liegt. */
window.ppFx44Vorladen = function (url, w, h) {
  try {
    const breite = Math.max(w || 44, 30), hoehe = Math.max(h || 62, 40);
    { const Sv = typeof ppFxZelle === 'function' ? ppFxZelle(null) : PP_FX44_S; ppFx44Ruecken(url || '/cardback.png', Math.max(4, Math.round(breite / Sv)), Math.max(4, Math.round(hoehe / Sv))); }
  } catch (e) { /* optional */ }
};

const PP_FX44_BLAETTER = (b) => ([
  { dx: -b * 0.55, rot: -14, delay: 0 },
  { dx: b * 0.5, rot: 11, delay: 90 },
  { dx: -b * 0.28, rot: -6, delay: 180 },
]);
const PP_FX44_BLATT_MS = 420;

const ppFx44Mischen = ppR1Leinwand((g, t, sz, teile) => {
  const { W, H, bl } = teile, S = sz.S;
  const grid = ppFx44Ruecken(teile.url, W, H) || null;
  for (let i = 0; i < bl.length; i++) {
    const b = bl[i], age = t - b.delay;
    if (age < 0 || age > PP_FX44_BLATT_MS) continue;
    const u = age / PP_FX44_BLATT_MS;
    // Weg: 0 → 55 % → 100 % (ease-in-out je Abschnitt), Deckkraft: 0 → 95 % bei 25 % → 95 % bis 55 % → 0
    const w = u < 0.55 ? PP_FX44_EASE_IO(u / 0.55) : 1 - PP_FX44_EASE_IO((u - 0.55) / 0.45);
    const a = u < 0.25 ? 0.95 * PP_FX44_EASE_IO(u / 0.25) : u < 0.55 ? 0.95 : 0.95 * (1 - PP_FX44_EASE_IO((u - 0.55) / 0.45));
    if (a < 0.06) continue;
    const ang = b.rot * w * Math.PI / 180, cs = Math.cos(ang), sn = Math.sin(ang);
    const mx = sz.cx + (b.dx * w) / S, my = sz.cy;
    const ext = Math.ceil((W * Math.abs(cs) + H * Math.abs(sn)) / 2) + 1, exth = Math.ceil((W * Math.abs(sn) + H * Math.abs(cs)) / 2) + 1;
    for (let Y = Math.floor(my - exth); Y <= Math.ceil(my + exth); Y++) {
      for (let X = Math.floor(mx - ext); X <= Math.ceil(mx + ext); X++) {
        const ox = X + 0.5 - mx, oy = Y + 0.5 - my;
        const px = ox * cs + oy * sn + W / 2, py = -ox * sn + oy * cs + H / 2;       // zurückgedreht ins Blatt
        if (px < 0 || py < 0 || px >= W || py >= H) continue;
        const ix = px | 0, iy = py | 0;
        let c;
        if (ix === 0 || iy === 0 || ix === W - 1 || iy === H - 1) c = ((ix + iy) & 1) ? PP_FX44_C.rand1 : PP_FX44_C.rand2;           // Rand: eine Zelle
        else if (grid) { const j = (iy * W + ix) * 3; c = [grid[j], grid[j + 1], grid[j + 2]]; }
        else c = ((ix + iy * 2 + (ix >> 2)) & 3) < (ix + iy > (W + H) * 0.55 ? 3 : 1) ? PP_FX44_C.tinte : PP_FX44_C.blau;             // Rückfall: dunkler Verlauf (gedithert)
        g.put(X, Y, c, a);
      }
    }
  }
}, 640, (p) => {
  const breite = Math.max(p.w || 44, 30), hoehe = Math.max(p.h || 62, 40);
  const rx = Math.ceil(breite * 0.55 + breite * 0.52 + hoehe * 0.12 + 6), ry = Math.ceil(hoehe * 0.52 + breite * 0.12 + 6);   // in Bildschirmpixeln (ppR1Leinwand rundet auf ganze Zellen)
  return { breite: rx * 2, hoehe: ry * 2 };
}, {
  z: 10100,
  vorbereiten: (sz) => {
    const p = sz.props, breite = Math.max(p.w || 44, 30), hoehe = Math.max(p.h || 62, 40);
    const W = Math.max(4, Math.round(breite / sz.S)), H = Math.max(4, Math.round(hoehe / sz.S));   // Zelle = Hero-Pixel (sz.S)
    const url = p.cardbackUrl || '/cardback.png';
    ppFx44Ruecken(url, W, H);
    return { W, H, url, bl: PP_FX44_BLAETTER(breite) };
  },
});
if (typeof ppFxUeberschreiben === 'function') ppFxUeberschreiben('deck_shuffle_fx', ppFx44Mischen);

// ───────────────────────── 2. Einschlag-Funken ─────────────────────────
/** Farbe (CSS-Text) → [r,g,b] der nächsten Palettenfarbe. */
function ppFx44Farbe(c) {
  try {
    const h = /#([0-9a-f]{6})/i.exec(String(c || ''));
    if (h) return ppHex(window.ppSnap ? window.ppSnap('#' + h[1]) : '#' + h[1]);
  } catch (e) { /* Standard */ }
  return ppHex('#fbe181');
}
/**
 * Funken eines Einschlags auf einer Leinwand im Anker `box` (`.zone-land-fx`, Mitte der Zone).
 * `liste`: [{ dx, dy (Endlage in px), dur, delay (ms), ang (Grad), len, dick (px) }]. Gibt true zurück, wenn die Leinwand läuft.
 * `zusatz` (optional, app-fx-49 `ppFx49Einschlag`): { R (px), ende (ms), malen(put, c0, gw, gh, t) } — Schockringe und Aufleuchten werden VOR den Funken auf dieselbe Leinwand gemalt.
 */
window.ppFx44Funken = function (box, liste, farbe, zusatz) {
  try {
    if (!box || !liste || !liste.length || window._playAnimations === false || window.__ppFxAlt) return false;
    const S = (zusatz && zusatz.S > 0) ? zusatz.S : (typeof ppFxZelle === 'function' ? ppFxZelle(box) : PP_FX44_S), TAKT = PP_FX44_TAKT;   // Zelle = Hero-Pixel
    let R = 0, ende = 0;
    for (const f of liste) { R = Math.max(R, Math.abs(f.dx), Math.abs(f.dy), 0); ende = Math.max(ende, f.delay + f.dur); }
    R = Math.ceil((R + 20) / S) * S;
    if (zusatz) { R = Math.max(R, zusatz.R || 0); ende = Math.max(ende, zusatz.ende || 0); }
    const gw = (R * 2) / S, gh = gw;
    if (gw < 4 || gw > 400) return false;
    const wurzel = document.createElement('div');
    wurzel.setAttribute('aria-hidden', 'true'); wurzel.setAttribute('data-pp-px', 'aus');
    wurzel.style.cssText = `position:absolute;left:${-R}px;top:${-R}px;width:${R * 2}px;height:${R * 2}px;pointer-events:none;`;
    const cv = document.createElement('canvas');
    cv.width = gw; cv.height = gh;
    cv.style.cssText = `width:${R * 2}px;height:${R * 2}px;image-rendering:pixelated;display:block;`;
    wurzel.appendChild(cv); box.appendChild(wurzel);
    const ctx = cv.getContext('2d'), img = ctx.createImageData(gw, gh), buf = img.data;
    const kern = ppFx44Farbe(farbe), weiss = PP_FX44_C.weiss, c0 = gw / 2;
    const put = (X, Y, c, a) => {
      if (X < 0 || Y < 0 || X >= gw || Y >= gh) return;
      if (a < 1 && ppBayer(X, Y) >= a) return;
      const i = (Y * gw + X) * 4; buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = 255;
    };
    // Teilwerte: Weg 0 → 12 % → 100 % (Bahn, Größe), Deckkraft 0 → 1 (12 %) → .9 (70 %) → 0
    const malen = (t) => {
      buf.fill(0);
      if (zusatz) zusatz.malen(put, c0, gw, gh, t);
      for (const f of liste) {
        const age = t - f.delay;
        if (age < 0 || age > f.dur) continue;
        const u = age / f.dur;
        let pos, sk, op;
        if (u < 0.12) { const e = PP_FX44_EASE_FUNKE(u / 0.12); pos = 0.22 * e; sk = 0.35 + 0.65 * e; op = e; }
        else {
          const e = PP_FX44_EASE_FUNKE((u - 0.12) / 0.88); pos = 0.22 + 0.78 * e; sk = 1 - 0.45 * e;
          op = u < 0.7 ? 1 - 0.1 * PP_FX44_EASE_FUNKE((u - 0.12) / 0.58) : 0.9 * (1 - PP_FX44_EASE_FUNKE((u - 0.7) / 0.3));
        }
        if (op < 0.06) continue;
        const rad = f.ang * Math.PI / 180, ux = Math.cos(rad), uy = Math.sin(rad);
        const hx = c0 + (f.dx * pos) / S, hy = c0 + (f.dy * pos) / S;
        const L = Math.max(2, f.len * sk / S), n = Math.max(2, Math.round(L));
        const dick = f.dick * sk / S;
        for (let i = 0; i < n; i++) {
          const q = (i + 0.5) / n;                                                  // 0 Schweif … 1 Kopf
          const X = Math.round(hx + ux * (q - 0.5) * L), Y = Math.round(hy + uy * (q - 0.5) * L);
          const col = q > 0.75 ? weiss : kern;
          const a = op * (q < 0.35 ? (0.25 + 0.75 * q / 0.35) : 1);                // Schweif läuft gedithert aus
          put(X, Y, col, a);
          if (dick >= 1.5) { put(X + (Math.abs(uy) > Math.abs(ux) ? 1 : 0), Y + (Math.abs(uy) > Math.abs(ux) ? 0 : 1), col, a); }
        }
      }
      ctx.putImageData(img, 0, 0);
    };
    const takt = window.ppTaktRaf || window.requestAnimationFrame;
    const t0 = performance.now();
    let raf = 0, letzte = -1, aus = false;
    const stopp = () => { if (aus) return; aus = true; try { cancelAnimationFrame(raf); } catch (e) { /* weg */ } wurzel.remove(); };
    const schritt = (jetzt) => {
      if (aus) return;
      if (typeof jetzt !== 'number') jetzt = performance.now();
      const t = jetzt - t0;
      if (t >= ende + 40 || !box.isConnected) { stopp(); return; }
      const fr = Math.floor(jetzt / TAKT);
      if (fr !== letzte) {
        letzte = fr;
        const mess = window.__ppFx49Messen ? performance.now() : 0;          // Messung (nur Tests), s. app-fx-49
        malen(Math.max(0, t));
        if (mess) (window.__ppFx49Zeiten || (window.__ppFx49Zeiten = [])).push([zusatz ? 'einschlag' : 'funken', +(performance.now() - mess).toFixed(3)]);
      }
      raf = takt(schritt);
    };
    raf = takt(schritt);
    setTimeout(stopp, ende + 1500);
    return true;
  } catch (e) { try { console.warn('ppFx44Funken', e); } catch (e2) { /* still */ } return false; }
};
