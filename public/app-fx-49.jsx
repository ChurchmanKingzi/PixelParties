// app-fx-49: Kartenschweif (Kometenschweif), Abheb-Funken beim Zug und Schockringe beim Einschlag — Pixelart-Leinwand im Trailer-Look
//
// ═════════════════════════════════════════════════════════════════
//  Vorlage: Trailer-Renderer (shot01.js): „Kometenschweif hinter den fliegenden Karten", „Aufprall: Schockringe", „Zugbeginn: Funken beim Abheben und Schweif der gezogenen Karte".
//  Alles auf Rasterzellen zu 3 Bildschirmpixeln, 30 Bilder/s auf dem globalen Takt (`ppTaktRaf`), nur bei neuem Bild zeichnen, Schmutzrechteck (`ppFx30Maler`), feste Palettenfarben,
//  kein Alpha (Ausblenden = Blinken im Zweiertakt wie im Trailer), kein Weichzeichner. Die Karte selbst bleibt ein DOM-Element (zeigt das echte Kartenbild); hier entsteht nur, was um sie herum glüht.
//
//  1. SCHWEIF — `window.ppFx49Schweif({ von:{x,y}, nach:{x,y}, dauer, bogen, ease, farbe, art, w, h, welt, folge, verzug, funken })` → Abbruchfunktion (oder null: Animationen aus / Notbremse).
//     Koordinaten = Mitte der Karte in den Koordinaten der Schicht, in die die Leinwand kommt: Fenster (`welt: false`, Standard: <body>) bzw. Welt-Schicht (`welt: true`, `ppFxWeltSchicht()`,
//     Fenster + `ppFxScrollOffset()`; so liegen auch `hand-to-board-fly`-Karten). Der Weg ist rein zeitabhängig (kein Layout im Takt): Linie von → nach mit `ease` ('aus' = cubic-bezier(0,0,.58,1) wie
//     `ease-out` in CSS, 'komet' = easeOutCubic, 'ein', 'inout', 'linear' oder eine Funktion u → 0..1) und leichtem Bogen nach oben (`bogen` px). Bewegt sich das Ziel im Flug (Kamerafahrt,
//     `ppFlugVerfolgen`), meldet der Flug seine Lage mit `stopp.punkt(x, y)` (mit `folge: true`), dann zeichnet der Schweif exakt den gesehenen Weg.
//       art 'zug'   (Standard): je Bild ein Quadrat (Creme/Grau) hinter der Karte, 0,22–0,37 s sichtbar; dazu `funken` (Standard: wahr) 14 Funken beim Abheben (Quadrate und Kreuze, Creme/Grau).
//       art 'komet'            : Flanken-Schweif wie im Trailer: 10 Bilder zurück, links und rechts je ein Teilchen (Creme im Wechsel mit `farbe`), die ersten drei Bilder 2×2 Zellen.
//     Gebündelter Einstieg für den Kartenzug: `ppFx49Zug(el, {von, nach, dauer, w, h})`.
//  2. EINSCHLAG — `window.ppFx49Einschlag(w, h, farbe)` liefert den Zusatz für die Funken-Leinwand der Zonen (`ppFx44Funken(box, liste, farbe, zusatz)`, app-fx-44): zwei Schockringe (Creme, dann
//     Kartenfarbe; Radius easeOutCubic 0 → 26 bzw. 18 Zellen je 40 Zellen Kartenbreite, 0,34 s, Dicke 2 → 1) und ein gedithertes Aufleuchten in der Kartenfarbe (ersetzt `zoneLandGlow`).
//     Vorher: CSS-Animationen `zoneLandRing` (Rahmen mit Schein) und `zoneLandGlow` (Verlauf), beide vom Laufzeit-Backer abgetastet; jetzt zeichnet dieselbe Leinwand, die schon die Funken trägt.
//  Kosten: eine Leinwand je Effekt, rein zeitabhängige Teilchen (keine Zustände, ≤ 24 Rechtecke je Bild), Leinwand lebt < 1 s; Aufwärmen im Leerlauf wie bei den Projektilen.
// ═════════════════════════════════════════════════════════════════
const PP_FX49_C = { creme: ppHex('#fffbd2'), grau: ppHex('#9aa3b6'), weiss: ppHex('#ffffff') };
// ★ Ability-Blau: Landet/fliegt eine Fähigkeit (Kartenfarbe #4580f6, `zoneLandStyle` in app-shared.jsx), werden Creme und Grau der Ringe/Schweife zu hellem Blau (Palette), sonst unverändert.
const PP_FX49_ABIL = { creme: ppHex('#b4cff8'), grau: ppHex('#6d9bf8') };
const ppFx49IstAbility = (farbe) => /#4580f6/i.test(String(farbe || ''));
const PP_FX49_S = 3;                                   // Bildschirmpixel je Rasterzelle
const PP_FX49_TAKT = 1000 / 30;
const ppFx49Kl = (v, a, b) => Math.max(a, Math.min(b, v));
const ppFx49EaseOutCubic = (u) => 1 - Math.pow(1 - ppFx49Kl(u, 0, 1), 3);

/** cubic-bezier(x1, y1, x2, y2) → f(u) (u, Ergebnis 0..1). */
function ppFx49Bez(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = (s) => ((ax * s + bx) * s + cx) * s, Y = (s) => ((ay * s + by) * s + cy) * s;
  return (x) => {
    if (x <= 0) return 0; if (x >= 1) return 1;
    let lo = 0, hi = 1, s = x;
    for (let i = 0; i < 20; i++) { const v = X(s); if (Math.abs(v - x) < 1e-4) break; if (v < x) lo = s; else hi = s; s = (lo + hi) / 2; }
    return Y(s);
  };
}
const PP_FX49_EASE = {
  aus: ppFx49Bez(0, 0, 0.58, 1), ein: ppFx49Bez(0.42, 0, 1, 1), inout: ppFx49Bez(0.42, 0, 0.58, 1),
  komet: ppFx49EaseOutCubic, linear: (u) => ppFx49Kl(u, 0, 1),
};

/** CSS-Farbtext → [r,g,b] der nächsten Palettenfarbe; sonst Standard. */
function ppFx49Farbe(c, std) {
  try {
    if (Array.isArray(c)) return c;
    const h = /#([0-9a-f]{6})/i.exec(String(c || ''));
    if (h) return ppHex(window.ppSnap ? window.ppSnap('#' + h[1]) : '#' + h[1]);
  } catch (e) { /* Standard */ }
  return std || ppHex('#fbe181');
}

function ppFx49Teil(m, X, Y, kreuz, sz, c) {
  if (kreuz) { m.rect(X - 1, Y, 3, 1, c); m.rect(X, Y - 1, 1, 3, c); } else m.rect(X, Y, sz, sz, c);
}

// ───────────────────────── 1. Schweif ─────────────────────────
function ppFx49Schweif(o) {
  try {
    if (!o || window._playAnimations === false || window.__ppFxAlt) return null;
    const von = o.von, nach = o.nach;
    if (!von || !nach || ![von.x, von.y, nach.x, nach.y].every(isFinite)) return null;
    const S = PP_FX49_S, TAKT = PP_FX49_TAKT, rd = Math.round, H = ppFx30H;
    const art = o.art === 'komet' ? 'komet' : 'zug';
    const dauer = Math.max(120, o.dauer > 0 ? o.dauer : 400), verzug = o.verzug > 0 ? o.verzug : 0;
    const bw = o.w > 0 ? o.w : 64, bh = o.h > 0 ? o.h : 90;
    const f = ppFx49Kl(bw / 120, 0.3, 1.25), fz = Math.max(f, 0.55);   // Trailer-Karte: 120 px breit; alle Maße darauf bezogen (fz: Mindestmaß für Streuung kleiner Karten)
    const bogen = o.bogen || 0, folge = !!o.folge, funken = o.funken !== false && art === 'zug';
    const ease = typeof o.ease === 'function' ? o.ease : (PP_FX49_EASE[o.ease] || (art === 'komet' ? PP_FX49_EASE.komet : PP_FX49_EASE.aus));
    const akzent = ppFx49Farbe(o.farbe), C = ppFx49IstAbility(o.farbe) ? { ...PP_FX49_C, ...PP_FX49_ABIL } : PP_FX49_C;
    const salz = Math.floor(Math.random() * 1e6) % 9973;
    const ende = verzug + (art === 'komet' ? dauer + 420 : Math.max(dauer * 0.8 + 420, 520));

    // Fläche der Leinwand: Weg + Rand (Teilchen streuen bis ~1 Kartenbreite seitlich; Funken bis ~0,45 s · 210 px/s · f)
    const span = Math.hypot(nach.x - von.x, nach.y - von.y);
    const M = rd((bw + bh) * 0.5 + 110 * f + 30 + (folge ? 0.3 * span + 30 : 0));
    const lx = Math.floor((Math.min(von.x, nach.x) - M) / S) * S, ly = Math.floor((Math.min(von.y, nach.y) - M - Math.max(0, bogen)) / S) * S;
    const gw = Math.min(900, Math.ceil((Math.max(von.x, nach.x) + M - lx) / S)), gh = Math.min(700, Math.ceil((Math.max(von.y, nach.y) + M - ly + Math.max(0, -bogen)) / S));
    if (gw < 8 || gh < 8) return null;

    const wurzel = document.createElement('div');
    wurzel.setAttribute('aria-hidden', 'true'); wurzel.setAttribute('data-pp-px', 'aus');
    wurzel.style.cssText = `position:fixed;left:${lx}px;top:${ly}px;pointer-events:none;z-index:${o.z || 10049};`;
    const cv = document.createElement('canvas');
    cv.width = gw; cv.height = gh;
    cv.style.cssText = `width:${gw * S}px;height:${gh * S}px;image-rendering:pixelated;display:block;`;
    wurzel.appendChild(cv);
    const ctx = cv.getContext('2d'), img = ctx.createImageData(gw, gh), m = ppFx30Maler(img.data, gw, gh);

    // ── Weg: Zeit (absolut, performance.now) → Mitte der Karte ──
    const t0 = performance.now() + verzug;
    const hist = [];                                                // folge: gemeldete Lagen [t, x, y]
    const weg = folge
      ? (ta) => {
          const n = hist.length;
          if (!n) return { x: von.x, y: von.y };
          if (ta <= hist[0][0]) return { x: hist[0][1], y: hist[0][2] };
          for (let i = n - 1; i > 0; i--) {
            const a = hist[i - 1], b = hist[i];
            if (ta >= a[0] && ta <= b[0]) { const q = (ta - a[0]) / Math.max(1, b[0] - a[0]); return { x: a[1] + (b[1] - a[1]) * q, y: a[2] + (b[2] - a[2]) * q }; }
          }
          return { x: hist[n - 1][1], y: hist[n - 1][2] };
        }
      : (ta) => {
          const u = ppFx49Kl((ta - t0) / dauer, 0, 1), e = ease(u);
          return { x: von.x + (nach.x - von.x) * e, y: von.y + (nach.y - von.y) * e - bogen * Math.sin(Math.PI * e) };
        };
    const fx0 = span > 0.5 ? (nach.x - von.x) / span : 0, fy0 = span > 0.5 ? (nach.y - von.y) / span : 1;
    const richtung = (ta) => {
      const a = weg(ta - 40), b = weg(ta), dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy);
      return l < 0.6 ? [fx0, fy0] : [dx / l, dy / l];
    };
    const cx = (x) => Math.floor((x - lx) / S), cy = (y) => Math.floor((y - ly) / S);

    // ── ein Bild (ms seit Start, ganze Bilder) ──
    const malen = (ms) => {
      const fr = Math.floor(ms / TAKT + 1e-4), tq = fr * TAKT;
      if (art === 'zug') {
        const letzteSchlitz = Math.floor(dauer * 0.8 / TAKT);
        for (let s = Math.max(0, fr - 12); s <= Math.min(fr, letzteSchlitz); s++) {
          const ts = s * TAKT, alter = tq - ts;
          for (let p = 0; p < 2; p++) {                             // zwei Teilchen je Bild (kleine Handkarten: sonst kaum zu sehen)
            const id = s * 2 + p, leben = (0.22 + 0.15 * H(id, salz + 1)) * 1000;
            if (alter >= leben) continue;
            if (alter > leben * 0.72 && ((fr - s) & 1)) continue;   // Ausblinken statt Alpha
            const ta = t0 + ts, q = weg(ta), [ux, uy] = richtung(ta);
            const hinten = (-30 + (H(id, salz + 2) - 0.5) * 40) * fz, quer = (H(id, salz + 3) - 0.5) * 70 * fz;
            const px = q.x + ux * hinten - uy * quer, py = q.y + uy * hinten + ux * quer;
            const c = H(id, salz + 4) < 0.5 ? C.creme : (o.farbe && H(id, salz + 5) < 0.4 ? akzent : C.grau), sz = alter < leben * 0.5 ? 2 : 1;
            m.rect(cx(px), cy(py), sz, sz, c);
          }
        }
        if (funken) {                                               // Funken beim Abheben vom Stapel
          const n = typeof ppFxN === 'function' ? ppFxN(14) : 14, sk = Math.max(f, 0.55);
          for (let i = 0; i < n; i++) {
            const w = H(i, salz + 11) * Math.PI * 2, sp = (60 + H(i, salz + 12) * 150) * sk, leben = 0.25 + 0.2 * H(i, salz + 13), alter = tq / 1000;
            if (alter >= leben) continue;
            if (alter > leben * 0.72 && (fr & 1)) continue;
            const kreuz = H(i, salz + 14) < 0.3;
            ppFx49Teil(m, cx(von.x + Math.cos(w) * sp * alter), cy(von.y + Math.sin(w) * sp * alter), kreuz, 1, (i & 1) ? C.creme : C.grau);
          }
        }
      } else {
        for (let k = 1; k <= 10; k++) {                             // Kometenschweif: die letzten zehn Bilder, links und rechts der Karte
          const tt = tq - k * TAKT;
          if (tt < 0) break;
          const ta = t0 + tt, q = weg(ta), [ux, uy] = richtung(ta), sz = k < 4 ? 2 : 1, c = (k & 1) ? C.creme : akzent;
          for (const seite of [-1, 1]) {
            const quer = seite * (30 + (H(k + salz, seite + 2) - 0.5) * 50) * f, laengs = (H(k + salz, seite + 9) - 0.5) * 120 * f;
            m.rect(cx(q.x + ux * laengs - uy * quer), cy(q.y + uy * laengs + ux * quer), sz, sz, c);
          }
        }
      }
    };
    if (o.trocken) return [0.02, 0.2, 0.45, 0.8].map((q) => () => { m.d.x0 = gw; m.d.y0 = gh; m.d.x1 = 0; m.d.y1 = 0; img.data.fill(0); malen(q * dauer); });

    (o.welt && window.ppFxWeltSchicht ? window.ppFxWeltSchicht() : document.body).appendChild(wurzel);
    const takt = window.ppTaktRaf || window.requestAnimationFrame;
    let raf = 0, letzte = -1, aus = false, vor = null;
    const stopp = () => { if (aus) return; aus = true; try { cancelAnimationFrame(raf); } catch (e) { /* weg */ } wurzel.remove(); };
    const schritt = (jetzt) => {
      if (aus) return;
      if (typeof jetzt !== 'number') jetzt = performance.now();
      const ms = jetzt - t0;
      if (ms >= ende - verzug) { stopp(); return; }
      if (ms >= 0) {
        const fr = Math.floor(jetzt / TAKT);
        if (fr !== letzte) {
          letzte = fr;
          const mess = window.__ppFx49Messen ? performance.now() : 0;      // Messung (nur Tests): Zeichenkosten je Bild in `window.__ppFx49Zeiten`
          const d = m.d, buf = img.data;
          if (vor) { for (let j = vor.y0; j < vor.y1; j++) buf.fill(0, (j * gw + vor.x0) * 4, (j * gw + vor.x1) * 4); }
          d.x0 = gw; d.y0 = gh; d.x1 = 0; d.y1 = 0;
          malen(Math.max(0, ms));
          const ux0 = Math.min(vor ? vor.x0 : gw, d.x0), uy0 = Math.min(vor ? vor.y0 : gh, d.y0), ux1 = Math.max(vor ? vor.x1 : 0, d.x1), uy1 = Math.max(vor ? vor.y1 : 0, d.y1);
          if (ux1 > ux0 && uy1 > uy0) ctx.putImageData(img, 0, 0, ux0, uy0, ux1 - ux0, uy1 - uy0);
          vor = d.x1 > d.x0 ? { x0: d.x0, y0: d.y0, x1: d.x1, y1: d.y1 } : null;
          if (mess) (window.__ppFx49Zeiten || (window.__ppFx49Zeiten = [])).push([art, +(performance.now() - mess).toFixed(3)]);
        }
      }
      raf = takt(schritt);
    };
    raf = takt(schritt);
    setTimeout(stopp, ende + 1500);                                 // Notnagel (Tab im Hintergrund: rAF ruht)
    stopp.punkt = (x, y) => { if (folge && isFinite(x) && isFinite(y)) { hist.push([performance.now(), x, y]); if (hist.length > 90) hist.shift(); } };
    return stopp;
  } catch (e) { try { console.warn('ppFx49Schweif', e); } catch (e2) { /* still */ } return null; }
}
window.ppFx49Schweif = ppFx49Schweif;

/** Kartenzug (`.draw-anim-card`): Schweif + Abheb-Funken von der Mitte des Stapels bis zur Mitte des Handplatzes. `o` = { von:{x,y}, nach:{x,y}, w, h, dauer }, Fensterkoordinaten. */
window.ppFx49Zug = function (el, o) {
  try {
    if (!o || !o.von || !o.nach) return null;
    const stopp = ppFx49Schweif({ art: 'zug', von: o.von, nach: o.nach, dauer: o.dauer || 400, w: o.w || (el && el.offsetWidth) || 64, h: o.h || (el && el.offsetHeight) || 90, ease: 'aus', farbe: o.farbe, funken: true });
    return stopp;
  } catch (e) { return null; }
};

// Aufwärmen im Leerlauf (vier Bilder je Art, ein Bild je Leerlauf-Slot): der erste echte Zug startet nicht im JIT-kalten Code
(function ppFx49Aufwaermen() {
  const los = () => {
    try {
      const schritte = [];
      for (const art of ['zug', 'komet']) {
        const s = ppFx49Schweif({ art, von: { x: 100, y: 300 }, nach: { x: 300, y: 100 }, dauer: 400, w: 64, h: 90, farbe: '#fbe181', trocken: true });
        if (Array.isArray(s)) schritte.push(...s);
      }
      if (!schritte.length) return;
      const ric = window.requestIdleCallback || ((fn) => setTimeout(fn, 60));
      const weiter = () => { const fn = schritte.shift(); if (!fn) return; try { fn(); } catch (e) { /* weg */ } ric(weiter, { timeout: 2500 }); };
      ric(weiter, { timeout: 2500 });
    } catch (e) { /* weg */ }
  };
  setTimeout(() => (window.requestIdleCallback ? window.requestIdleCallback(los, { timeout: 4000 }) : los()), 3000);
})();

// ───────────────────────── 2. Einschlag: Schockringe + Aufleuchten ─────────────────────────
/** Zusatz für `ppFx44Funken(box, liste, farbe, zusatz)`: { R (px, halbe Leinwand), ende (ms), malen(put, c0, gw, gh, t ms) }. */
window.ppFx49Einschlag = function (w, h, farbe) {
  try {
    const S = PP_FX49_S, C = ppFx49IstAbility(farbe) ? { ...PP_FX49_C, ...PP_FX49_ABIL } : PP_FX49_C;
    if (!(w > 0) || !(h > 0)) return null;
    const kern = ppFx49Farbe(farbe);
    const wz = w / S, hz = h / S, k = ppFx49Kl(wz / 40, 0.45, 1.8);   // Trailer: Radien 26 und 18 Zellen bei 40 Zellen Kartenbreite
    const dicke = k >= 1.3 ? 1 : 0;                                    // große Zonen: eine Zelle dicker
    const R = Math.ceil(Math.max(0.86 * Math.max(w, h), 26 * k * S + 20) / S) * S;
    // Ring wie im Trailer (`drawRing`): Mittelpunkt-Kreis, th × th Zellen je Punkt
    const ring = (put, c0, cxz, cyz, r, th, c) => {
      let x = r, y = 0, err = 1 - r;
      const p = (a, b) => { for (let j = 0; j < th; j++) for (let i = 0; i < th; i++) put(cxz + a + i, cyz + b + j, c, 1); };
      while (x >= y) {
        p(x, y); p(y, x); p(-y, x); p(-x, y); p(-x, -y); p(-y, -x); p(y, -x); p(x, -y);
        y++;
        if (err < 0) err += 2 * y + 1; else { x--; err += 2 * (y - x) + 1; }
      }
    };
    return {
      R, ende: 680,
      malen: (put, c0, gw, gh, t) => {
        const u = t / 620;
        if (u > 0 && u < 1) {                                          // Aufleuchten (vorher radialer Verlauf): gedithertes Oval, innen dichter, Maß .35 → 1,05, Spitze bei 18 %
          const sk = 0.35 + 0.7 * (1 - Math.pow(1 - u, 2.5)), peak = u < 0.18 ? 0.55 * u / 0.18 : 0.55 * (1 - (u - 0.18) / 0.82);
          const rx = 0.8 * wz * sk, ry = 0.8 * hz * sk;
          if (peak > 0.04 && rx >= 1 && ry >= 1) {
            const y0 = Math.max(0, Math.floor(c0 - ry)), y1 = Math.min(gh - 1, Math.ceil(c0 + ry)), x0 = Math.max(0, Math.floor(c0 - rx)), x1 = Math.min(gw - 1, Math.ceil(c0 + rx));
            for (let Y = y0; Y <= y1; Y++) {
              const dy = (Y + 0.5 - c0) / ry;
              for (let X = x0; X <= x1; X++) {
                const dx = (X + 0.5 - c0) / rx, q = dx * dx + dy * dy;
                if (q >= 1) continue;
                put(X, Y, kern, peak * (1 - Math.sqrt(q)));
              }
            }
          }
        }
        const dt = t / 1000;                                           // Schockringe (Trailer: 0,34 s; Creme 2 → 1 dick, Kartenfarbe ab 0,04 s)
        const cxz = Math.round(c0), cyz = Math.round(c0);
        if (dt >= 0 && dt <= 0.34) ring(put, c0, cxz, cyz, Math.max(1, Math.round(ppFx49EaseOutCubic(dt / 0.34) * 26 * k)), (dt < 0.1 ? 2 : 1) + dicke, C.creme);
        if (dt > 0.04 && dt <= 0.34) ring(put, c0, cxz, cyz, Math.max(1, Math.round(ppFx49EaseOutCubic((dt - 0.04) / 0.3) * 18 * k)), 1 + dicke, kern);
      },
    };
  } catch (e) { return null; }
};
