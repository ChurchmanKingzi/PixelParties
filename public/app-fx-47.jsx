// app-fx-47: Tutorial 3 — „ATK 9999“-Zähler (atkWowStart in app-shared.jsx): Ringe, Funken und Bildschirmblitz als EINE Pixelart-Leinwand
//
// ═════════════════════════════════════════════════════════════════
//  Vorher: je Ring/Funke/Blitz ein DOM-Element mit eigener CSS-Animation (Radialverlauf, Glüh-Schatten, border-radius 50 %, Alpha) — 28 + 40 Funken + 5 Ringe + 2 Blitze starteten im dramatischsten Moment
//  des Tutorials gleichzeitig und wurden von `pixel-anim.js` einzeln gebacken (68 Starts, ~205 ms Hauptfaden-Blockade bei Antonias Boost auf 9999).
//  Jetzt: eine Vollbild-Leinwand (Rasterzelle 3 Bildschirmpixel, 30 Bilder/s auf `ppTaktRaf`, Schmutzrechteck-Upload), Zeiten und Wege wie die CSS-Fassung:
//    Ring     Radius 5 → Größe/2 in 1,1 s (ease-out), Deckkraft 0 → 0,95 (bei 12 %) → 0; zwei Ringe (Gold außen, Orange innen), Deckkraft als Dither-Stufe (kein Alpha)
//    Funke    1 s, ease-out, Verzug bis 120 ms, 2×2 Zellen → 1×1, Farben Gold/Orange/Rot/Weiß/Creme, ab 60 % Blinken
//    Blitz    Bildschirmrand-Vignette (Ellipse um 50 % / 55 %): Bayer-Dither in Orange (schwach) bzw. Weiß → Gold → Rot (stark), Hüllkurve 0 → 1 (22 %) → 0 in 0,9 s / 1 s
//  Der Zähler selbst (Text) bleibt DOM; er liegt über der Leinwand. Aufruf: `ppFx47Wow(cx, cy)` → { ring(verzug, größe), funken(anzahl, weit), blitz(stark), stop() } oder null (alter Pfad).
// ═════════════════════════════════════════════════════════════════
const PP_FX47_C = {
  gold: ppHex('#fad54a'), org: ppHex('#ff9a1a'), rot: ppHex('#ff491a'), weiss: ppHex('#ffffff'), creme: ppHex('#f9ecb3'), amber: ppHex('#ffb91a'),
};
const PP_FX47_BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
const ppFx47Aus = (t) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);      // ease-out

function ppFx47Wow(cx, cy) {
  try {
    if (window._playAnimations === false || window.__ppFxAlt) return null;
    const S = 3, W = Math.ceil(window.innerWidth / S), H = Math.ceil(window.innerHeight / S);
    if (W < 8 || H < 8) return null;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    cv.setAttribute('aria-hidden', 'true'); cv.setAttribute('data-pp-px', 'aus');
    cv.style.cssText = `position:fixed;left:0;top:0;width:${W * S}px;height:${H * S}px;z-index:90499;pointer-events:none;image-rendering:pixelated;`;
    const ctx = cv.getContext('2d'), img = ctx.createImageData(W, H), buf = img.data;
    const m = ppFx30Maler(buf, W, H);
    const CX = Math.round(cx / S), CY = Math.round(cy / S);
    const ringe = [], funken = [], blitze = [];
    let t0 = performance.now(), aus = false, raf = 0, vor = null, letzte = -1;
    const jetzt = () => performance.now() - t0;
    // Vignette: Wurzelabstand je Zelle (Ellipse um 50 % / 55 %, 1 = fernste Ecke) einmal vorrechnen
    const ex = W * 0.5, ey = H * 0.55, rx = Math.max(ex, W - ex), ry = Math.max(ey, H - ey), maxd = Math.hypot(1, 1);
    let vign = null;
    const vignette = () => {
      if (vign) return vign;
      vign = new Uint8Array(W * H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) vign[y * W + x] = Math.min(255, Math.round(Math.hypot((x - ex) / rx, (y - ey) / ry) / maxd * 255));
      return vign;
    };
    const api = {
      ring(verzug, groesse) { ringe.push({ t: jetzt() + verzug, r: groesse / 2 / S }); anwerfen(); },
      funken(anzahl, weit) {
        const F = [PP_FX47_C.gold, PP_FX47_C.org, PP_FX47_C.rot, PP_FX47_C.weiss, PP_FX47_C.creme], t = jetzt();
        for (let i = 0; i < anzahl; i++) { const w = Math.random() * Math.PI * 2, d = weit * (0.45 + Math.random() * 0.55) / S; funken.push({ t: t + Math.round(Math.random() * 120), dx: Math.cos(w) * d, dy: Math.sin(w) * d, c: F[i % F.length], id: i * 31 + ((Math.random() * 1000) | 0) }); }
        anwerfen();
      },
      blitz(stark) { blitze.push({ t: jetzt(), stark: !!stark, dauer: stark ? 1000 : 900 }); anwerfen(); },
      stop() { if (aus) return; aus = true; try { cancelAnimationFrame(raf); } catch (e) { /* weg */ } cv.remove(); },
    };
    const malen = (T) => {
      // Blitze zuerst (Hintergrund)
      for (const b of blitze) {
        const u = (T - b.t) / b.dauer; if (u < 0 || u > 1) continue;
        const env = u < 0.22 ? u / 0.22 : 1 - (u - 0.22) / 0.78;                    // 0 → 1 (22 %) → 0
        if (env <= 0.02) continue;
        const v = vignette();
        for (let y = 0; y < H; y++) {
          const bz = PP_FX47_BAYER[y & 3], o = y * W;
          for (let x = 0; x < W; x++) {
            const d = v[o + x] / 255;                                                // 0 Mitte … 1 Ecke
            let a, c;
            if (!b.stark) { a = d <= 0.38 ? 0 : Math.min(1, (d - 0.38) / 0.62) * 0.5; c = PP_FX47_C.org; }
            else if (d < 0.4) { a = 0.55 - d / 0.4 * 0.15; c = PP_FX47_C.weiss; }
            else { a = 0.4 + (d - 0.4) / 0.6 * 0.25; c = d < 0.7 ? PP_FX47_C.amber : PP_FX47_C.rot; }
            const lvl = a * env * 16;
            if (lvl <= 0.5 || bz[x & 3] >= lvl) continue;
            m.rect(x, y, 1, 1, c);
          }
        }
      }
      for (const r of ringe) {
        const u = (T - r.t) / 1100; if (u < 0 || u > 1) continue;
        const e = ppFx47Aus(u), rad = Math.round(5 / S + (r.r - 5 / S) * e);
        const op = u < 0.12 ? 0.95 * u / 0.12 : 0.95 * (1 - (u - 0.12) / 0.88);
        if (op < 0.08) continue;
        const dith = op < 0.5;
        m.ring(CX, CY, rad, 1, PP_FX47_C.gold, dith);
        if (rad > 3) m.ring(CX, CY, rad - 1, 1, PP_FX47_C.org, true);
      }
      for (const f of funken) {
        const u = (T - f.t) / 1000; if (u < 0 || u > 1) continue;
        if (u > 0.6 && (Math.floor(T / 33) & 1)) continue;                            // Ausklang: Blinken statt Alpha
        const e = ppFx47Aus(u), g = u < 0.5 ? 2 : 1;
        m.rect(Math.round(CX + f.dx * e - g / 2), Math.round(CY + f.dy * e - g / 2), g, g, f.c);
      }
    };
    const aktiv = (T) => blitze.some((b) => T - b.t < b.dauer + 40) || ringe.some((r) => T - r.t < 1140) || funken.some((f) => T - f.t < 1040);
    function schritt(jetztMs) {
      raf = 0;
      if (aus) return;
      const T = jetzt();
      const fr = Math.floor((typeof jetztMs === 'number' ? jetztMs : performance.now()) / (1000 / 30));
      if (fr !== letzte) {
        letzte = fr;
        const d = m.d;
        if (vor) for (let j = vor.y0; j < vor.y1; j++) buf.fill(0, (j * W + vor.x0) * 4, (j * W + vor.x1) * 4);
        d.x0 = W; d.y0 = H; d.x1 = 0; d.y1 = 0;
        malen(T);
        const ux0 = Math.min(vor ? vor.x0 : W, d.x0), uy0 = Math.min(vor ? vor.y0 : H, d.y0), ux1 = Math.max(vor ? vor.x1 : 0, d.x1), uy1 = Math.max(vor ? vor.y1 : 0, d.y1);
        if (ux1 > ux0 && uy1 > uy0) ctx.putImageData(img, 0, 0, ux0, uy0, ux1 - ux0, uy1 - uy0);
        vor = d.x1 > d.x0 ? { x0: d.x0, y0: d.y0, x1: d.x1, y1: d.y1 } : null;
      }
      if (aktiv(T)) raf = (window.ppTaktRaf || window.requestAnimationFrame)(schritt);
    }
    function anwerfen() { if (!raf && !aus) raf = (window.ppTaktRaf || window.requestAnimationFrame)(schritt); }
    document.body.appendChild(cv);
    anwerfen();
    api.anwerfen = anwerfen;
    return api;
  } catch (e) { try { console.warn('ppFx47Wow', e); } catch (er) { /* weg */ } return null; }
}
window.ppFx47Wow = ppFx47Wow;
