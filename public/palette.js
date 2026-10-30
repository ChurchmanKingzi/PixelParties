'use strict';
// ═══════════════════════════════════════════════════════════════════════════════════════════
//  SPIEL-PALETTE (256 Farben) — Laufzeit-Teil.   Quelle der Farben: data/palette.json, erzeugt von scripts/palette/build_palette.py
//
//  Alle Farb-Literale der Oberflaeche stehen schon in der Palette (scripts/palette/anwenden.js). Dieses Skript faengt die Farben ab, die ERST ZUR LAUFZEIT
//  entstehen (Spielerfarbe, Partikel mit Zufallsfarben, Farben aus Kartenskripten, hsl(${hue}) …): jede Farbe, die in einen Stil, ein Canvas oder
//  einen Verlauf geschrieben wird, rastet auf die naechste Palettenfarbe ein (CIE-Lab-Abstand, Alpha bleibt).
//    window.ppSnap('#12ab34')   → '#xxxxxx'   naechste Palettenfarbe
//    window.ppSnapCss(text)     → Text, in dem jedes Farb-Literal (#hex, rgb(), rgba(), hsl(), hsla()) ersetzt ist
//    window.ppSnapRgb(r, g, b)  → [r, g, b] der naechsten Palettenfarbe (Pixelbilder des Pixelierers, W86z)
//  Eingehaengt wird in: element.style.* / setProperty / cssText, Canvas-2D (fillStyle, strokeStyle, shadowColor, addColorStop), SVG-Attribute fill/stroke/stop-color.
//  Nicht erfasst (Browser rechnet selbst): Verlaufs-Zwischentoene, Alpha-Mischung, `color-mix()` — sie entstehen aus Palettenfarben.
// ═══════════════════════════════════════════════════════════════════════════════════════════
(function () {
  if (window.ppSnap) return;
  // PALETTE:BEGIN — erzeugt, nicht von Hand aendern
  const PALETTE = ["#000000", "#141414", "#222222", "#323232", "#535353", "#59606e", "#686868", "#7f7f7f", "#808898", "#929292", "#a8a8a8", "#b9b9b9", "#d2d2db", "#e6e6e6", "#ffffff", "#2a0404", "#270d0c", "#3a0000", "#5b0102", "#520a0c", "#780000", "#6a1c14", "#8f0000", "#8b0d0d", "#c80000", "#b21a29", "#b5171c", "#9d342f", "#be0e0e", "#c0141c", "#ef2929", "#e92f38", "#ff1a1a", "#f03232", "#e73b41", "#e94e53", "#fe5154", "#ff6666", "#ec7f79", "#fe7476", "#f9b3b3", "#f0bfbc", "#7a1900", "#7d3911", "#68332a", "#784437", "#b62600", "#8e503a", "#cc2b00", "#bd440f", "#b06746", "#ee6428", "#e37435", "#ff491a", "#ff8566", "#1f0f04", "#27180c", "#311402", "#3a2412", "#4a2a10", "#5a3c14", "#5a341a", "#6e4421", "#6b4a2a", "#aa5300", "#ad6100", "#886c44", "#9d612f", "#be680e", "#cf5f00", "#ff7d00", "#f87420", "#b29466", "#ca874e", "#a89370", "#ff8b1a", "#ff9a1a", "#c7855b", "#f29a3e", "#ff9b3a", "#f4ae64", "#ccb799", "#c5b7a0", "#e2d8cb", "#332300", "#393123", "#72541d", "#8b5b04", "#a87c00", "#c68206", "#c79e05", "#ffdd00", "#f9ac20", "#ffd61a", "#d1a148", "#ffb91a", "#f8ca21", "#ffc61c", "#ffe23d", "#fad54a", "#ffd066", "#e0c085", "#fbc86a", "#ffd966", "#ffe469", "#fbe181", "#fff196", "#f9ecb3", "#ebdcc1", "#f7e0b5", "#fff8e8", "#e3ce36", "#ffeb1a", "#feff66", "#f0f075", "#f7f7ad", "#f8f8bd", "#fffbd2", "#87cc00", "#b1ff1a", "#cbff66", "#3a5a25", "#5b9438", "#80bf59", "#0a1a04", "#18300a", "#2f4e1d", "#66ff71", "#b3f9b8", "#e5fae7", "#0f2412", "#1a4128", "#167927", "#29663f", "#20ac37", "#3b9159", "#5bbd7e", "#3ddc57", "#4ceb70", "#92d3a9", "#75f091", "#2ca058", "#00cc50", "#4bcd7c", "#1aff73", "#66ffa2", "#68fdc1", "#b3f9cf", "#07aec5", "#08d3ef", "#66a1a1", "#1aedff", "#3adfcb", "#74b8b8", "#7ce9dc", "#6be9fa", "#91e6e6", "#b2eeee", "#b6eff7", "#1788bd", "#1ca9fd", "#1ac6ff", "#68c6fd", "#77c8ee", "#66d9ff", "#7fdfff", "#b3e8f9", "#b4dff8", "#e5f5fa", "#00213f", "#02398c", "#2d4362", "#0351c9", "#405f8c", "#399edf", "#4e82cb", "#66b6ff", "#89abdc", "#7bbeea", "#a5b0c0", "#b3d8f9", "#b4cff8", "#bddcef", "#e5edfa", "#14285a", "#223962", "#2b457e", "#2f539d", "#4e77ca", "#3866f0", "#4580f6", "#9aa3b6", "#6d9bf8", "#9ba3ca", "#1a1a2e", "#282834", "#3e3e51", "#7e7d9b", "#08060c", "#12101f", "#1a0a3a", "#291f3d", "#8066b2", "#19062d", "#170b28", "#2b0b47", "#2e0a51", "#401a66", "#50008c", "#47117e", "#58238c", "#6618b4", "#6e00cc", "#702db3", "#7e41ba", "#7a2bd0", "#751ff9", "#9544d5", "#903ae6", "#a040ff", "#a159e9", "#a952ff", "#b866ff", "#ac87de", "#b278ed", "#b38ed7", "#a36afb", "#ba74ff", "#c98aff", "#d6b3f9", "#d6bbf1", "#d9c0ec", "#f1e5fa", "#f821e3", "#fa6bed", "#5a023a", "#c80480", "#fb1ea9", "#fc69c6", "#f8b4df", "#ea2f80", "#f174ab", "#f3bad3", "#55011a", "#4b1021", "#710122", "#780014", "#8c0014", "#a60f39", "#ae264c", "#fc1c5f", "#ec2d62", "#e58092", "#fe6794", "#f8b4c8", "#fae5eb"];
  // PALETTE:END

  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  function lab(r, g, b) {
    r = lin(r); g = lin(g); b = lin(b);
    let x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, y = 0.2126 * r + 0.7152 * g + 0.0722 * b, z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
    const f = (t) => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
    x = f(x); y = f(y); z = f(z);
    return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
  }
  const P_RGB = PALETTE.map(h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
  const P_LAB = P_RGB.map(c => lab(c[0], c[1], c[2]));
  const P_HEX = new Set(PALETTE);
  const hex2 = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  const cache = new Map();
  function naechsteRgb(r, g, b) {
    r = Math.max(0, Math.min(255, Math.round(r))); g = Math.max(0, Math.min(255, Math.round(g))); b = Math.max(0, Math.min(255, Math.round(b)));
    const key = (r << 16) | (g << 8) | b;
    let res = cache.get(key);
    if (res) return res;
    if (P_HEX.has('#' + hex2(r) + hex2(g) + hex2(b))) res = [r, g, b];
    else {
      const l = lab(r, g, b); let bi = 0, bd = 1e9;
      for (let i = 0; i < P_LAB.length; i++) { const p = P_LAB[i], d = (l[0] - p[0]) ** 2 + (l[1] - p[1]) ** 2 + (l[2] - p[2]) ** 2; if (d < bd) { bd = d; bi = i; } }
      res = P_RGB[bi];
    }
    if (cache.size > 20000) cache.clear();
    cache.set(key, res);
    return res;
  }
  function hsl2rgb(h, s, l) {
    h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
    const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [f(0) * 255, f(8) * 255, f(4) * 255];
  }
  const RE = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![0-9a-zA-Z_-])|rgba?\(\s*(-?\d*\.?\d+)\s*[, ]\s*(-?\d*\.?\d+)\s*[, ]\s*(-?\d*\.?\d+)\s*(?:[,/]\s*(\d*\.?\d+%?)\s*)?\)|hsla?\(\s*(-?\d*\.?\d+)(?:deg)?\s*[, ]\s*(\d*\.?\d+)%\s*[, ]\s*(\d*\.?\d+)%\s*(?:[,/]\s*(\d*\.?\d+%?)\s*)?\)/g;
  const textCache = new Map();
  function ppSnapCss(text) {
    if (typeof text !== 'string' || text.length < 4) return text;
    if (textCache.has(text)) return textCache.get(text);
    const out = text.replace(RE, (m, r, g, b, a1, h, s, l, a2) => {
      if (m[0] === '#') {
        let x = m.slice(1); if (x.length <= 4) x = [...x].map(c => c + c).join('');
        const p = naechsteRgb(parseInt(x.slice(0, 2), 16), parseInt(x.slice(2, 4), 16), parseInt(x.slice(4, 6), 16));
        return '#' + hex2(p[0]) + hex2(p[1]) + hex2(p[2]) + (x.length === 8 ? x.slice(6, 8) : '');
      }
      if (r !== undefined) { const p = naechsteRgb(+r, +g, +b); return (a1 != null ? 'rgba(' : (m.startsWith('rgba') ? 'rgba(' : 'rgb(')) + p[0] + ',' + p[1] + ',' + p[2] + (a1 != null ? ',' + a1 : '') + ')'; }
      const q = hsl2rgb(+h, +s, +l), p = naechsteRgb(q[0], q[1], q[2]);
      return a2 != null ? 'rgba(' + p[0] + ',' + p[1] + ',' + p[2] + ',' + a2 + ')' : '#' + hex2(p[0]) + hex2(p[1]) + hex2(p[2]);
    });
    if (textCache.size > 8000) textCache.clear();
    textCache.set(text, out);
    return out;
  }
  const FARBTEXT = /#[0-9a-fA-F]{3}|rgb|hsl/;
  const snapWert = (v) => (typeof v === 'string' && FARBTEXT.test(v) ? ppSnapCss(v) : v);
  window.ppSnapCss = ppSnapCss;
  window.ppSnap = (hex) => { const m = /^#?([0-9a-fA-F]{6})$/.exec(String(hex || '').trim()); if (!m) return hex; const p = naechsteRgb(parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)); return '#' + hex2(p[0]) + hex2(p[1]) + hex2(p[2]); };
  /** [r, g, b] → naechste Palettenfarbe als [r, g, b] (fuer Pixelbilder, `public/pixel-anim.js` und den Pixelierer in app-shared.jsx). */
  window.ppSnapRgb = (r, g, b) => naechsteRgb(r, g, b);
  window.PP_PALETTE = PALETTE.slice();

  // ── Einhaengen: Stile ──
  // Chromium legt die CSS-Eigenschaften nicht als Zugriffsmethoden auf den Prototyp, sondern bedient `el.style.color = …` ueber benannte Eigenschaften der
  // Instanz — also faengt ein Proxy um `el.style` jede Zuweisung (und `setProperty` / `cssText`) ab.
  try {
    const proxies = new WeakMap();
    // Retro-Modus (public/retro-core.js, nur mit ?retro=1): Inline-Stile laufen durch denselben Umwandler wie style.css — harte Schatten, Farbbaender,
    // Dithering statt Alpha, steps() statt weicher Uebergaenge, Retro-Palette.
    const RC = window.PP_RETRO && window.PPRetroCore;
    const kebab = (k) => k.replace(/^webkit/i, '-webkit').replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
    function retroSchreiben(t, name, v, pr) {
      const r = RC.deklaration(name, v, { hatHintergrund: !!t.backgroundImage && t.backgroundImage !== 'none' });
      t.setProperty(name, r.wert, pr || '');
      for (const [ep, ev] of r.extra) t.setProperty(ep, ev, pr || '');
    }
    // W86u1: weiche Schatten/Filter in Inline-Stilen → harte Pixelkanten (public/pixel-hart.js, laedt nach diesem Skript → Aufruf erst zur Laufzeit)
    const hartE = (n, v) => { const h = window.PPPixelHart; return h && typeof v === 'string' ? h.eigenschaft(n, v) : v; };
    const hartSetzen = (t, n, v) => { const h = window.PPPixelHart; return !!(h && h.setzen && typeof v === 'string' && v.indexOf('gradient(') >= 0 && h.setzen(t, n, v)); };
    const hartText = (v) => { const h = window.PPPixelHart; return h && typeof v === 'string' ? h.cssText(v) : v; };
    const huelle = (decl) => {
      let px = proxies.get(decl);
      if (px) return px;
      px = new Proxy(decl, {
        get(t, k) {
          if (k === 'setProperty') return (n, v, pr) => (RC && typeof v === 'string' && v ? retroSchreiben(t, n, v, pr) : (hartSetzen(t, n, v) || t.setProperty(n, snapWert(hartE(n, v)), pr)));
          const v = Reflect.get(t, k, t);
          return typeof v === 'function' ? v.bind(t) : v;
        },
        set(t, k, v) {
          if (RC && typeof v === 'string') {
            if (k === 'cssText') { t.cssText = RC.deklarationen(v); return true; }
            if (v && typeof k === 'string' && k in t && typeof t[k] === 'string' && k !== 'cssFloat') { retroSchreiben(t, kebab(k), v, ''); return true; }
          }
          if (k !== 'cssText' && hartSetzen(t, k, v)) return true;
          t[k] = (k === 'cssText') ? ppSnapCss(hartText(v)) : snapWert(hartE(k, v)); return true;
        },
      });
      proxies.set(decl, px);
      return px;
    };
    for (const C of [HTMLElement, SVGElement]) {
      const d = Object.getOwnPropertyDescriptor(C.prototype, 'style');
      if (d && d.get) Object.defineProperty(C.prototype, 'style', { configurable: true, enumerable: d.enumerable, get() { return huelle(d.get.call(this)); }, set(v) { d.set ? d.set.call(this, v) : (huelle(d.get.call(this)).cssText = v); } });
    }
  } catch (e) { console.warn('[palette] Stile nicht eingehaengt:', e && e.message); }
  // ── Canvas ──
  if (window.PP_RETRO && window.PPRetroCore) try {
    const RC = window.PPRetroCore, c2d = CanvasRenderingContext2D.prototype;
    const snapA = (v) => (typeof v === 'string' && FARBTEXT.test(v) ? RC.snapAlpha(v) : v);
    for (const name of ['fillStyle', 'strokeStyle']) {
      const d = Object.getOwnPropertyDescriptor(c2d, name);
      if (d && d.set) Object.defineProperty(c2d, name, { configurable: true, enumerable: d.enumerable, get: d.get, set(v) { d.set.call(this, snapA(v)); } });
    }
    const sb = Object.getOwnPropertyDescriptor(c2d, 'shadowBlur');
    if (sb && sb.set) Object.defineProperty(c2d, 'shadowBlur', { configurable: true, enumerable: sb.enumerable, get: sb.get, set() { sb.set.call(this, 0); } });
    const acs0 = CanvasGradient.prototype.addColorStop;
    CanvasGradient.prototype.addColorStop = function (o, c) { return acs0.call(this, o, snapA(c)); };
  } catch (e) { console.warn('[retro] Canvas nicht eingehaengt:', e && e.message); }
  else try {
    const c2d = CanvasRenderingContext2D.prototype;
    for (const name of ['fillStyle', 'strokeStyle', 'shadowColor']) {
      const d = Object.getOwnPropertyDescriptor(c2d, name);
      if (d && d.set) Object.defineProperty(c2d, name, { configurable: true, enumerable: d.enumerable, get: d.get, set(v) { d.set.call(this, snapWert(v)); } });
    }
    const acs = CanvasGradient.prototype.addColorStop;
    CanvasGradient.prototype.addColorStop = function (o, c) { return acs.call(this, o, snapWert(c)); };
  } catch (e) { console.warn('[palette] Canvas nicht eingehaengt:', e && e.message); }
  // ── SVG-Attribute ──
  try {
    const sa = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function (n, v) { return sa.call(this, n, (n === 'fill' || n === 'stroke' || n === 'stop-color' || n === 'style' || n === 'color') ? snapWert(n === 'style' && window.PPPixelHart ? window.PPPixelHart.cssText(v) : v) : v); };
  } catch (e) { /* ohne */ }
})();
