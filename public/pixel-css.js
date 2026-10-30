'use strict';
// ═══════════════════════════════════════════════════════════════════════════════════════════
//  PIXEL-CSS (W86u2) — Weichzeichner in den Stylesheets werden harte Pixelringe
//
//  Al: ALLE Animationen im Spiel sind Pixelart. `public/pixel-anim.js` backt Bewegung und wandelt Schein-Schatten NUR in Keyframes um, die es
//  beim Abspielen sieht. Die Stylesheets selbst enthalten aber hunderte weiche Scheine (`box-shadow: 0 0 12px …`, `text-shadow`, `filter:
//  drop-shadow()/blur()`, `backdrop-filter: blur()`) — im Ruhezustand, in :hover-/:focus-Regeln und in Keyframes, die ein anderer Weg erreicht
//  (Pseudo-Elemente, Klassenwechsel, Inline-<style> der Komponenten). Dieses Modul schreibt sie EINMAL beim Laden im CSSOM um:
//
//    box-shadow     0 0 12px C            →  0 0 0 2px C, 0 0 0 4px C(gedaempft)      gestufter Schein aus harten, deckenden Ringen
//                   0 4px 18px #000/.45   →  0 4px 0 2px #000/.45                      dunkle Schlagschatten: hart, gleicher Versatz
//    text-shadow    0 0 8px C             →  2-px-Kreuz in C(gedaempft)                 harte Kontur statt Schein
//    filter         drop-shadow(0 0 4px C) → vier harte drop-shadow(±2px … C(gedaempft)); blur() faellt weg
//    backdrop-filter  blur()              →  none
//
//  Gedaempfte Ringfarben sind KEINE Alpha-Mischung, sondern die Farbe gemischt mit dem dunklen Oberflaechengrund (#08060c) — deckend, auf die
//  256er-Palette gerastet (`ppSnap`); Farben, die erst zur Laufzeit feststehen (`var(--x)`, `currentColor`), gehen als `color-mix(…, #08060c)`
//  durch. Zu schwache Scheine (Alpha < 0,3) fallen weg (wie in der Bewegungs-Pipeline). Nicht angefasst: Retro-Modus (eigene Pipeline),
//  Inline-`style`-Attribute (die baut die Komponente selbst pixelkonform), Regeln ohne Unschaerfe.
//
//  Neue Stylesheets (Komponenten haengen `<style>`-Bloecke ein) werden nachgezogen (kurze Verzoegerung, ein Pruefen je Bild bei neuen Knoten).
//  Reine Funktionen stehen unter `PPPixelCss.rein` (test/pixel-css.test.js).
// ═══════════════════════════════════════════════════════════════════════════════════════════
(function (root) {
  const KONFIG = { aktiv: true, grund: '#08060c', ring: 2, maxRinge: 3, minAlpha: 0.3 };
  const GRUND_RGB = [8, 6, 12];

  // ── Hilfen ──────────────────────────────────────────────────────────────
  /** Oberste Ebene (Klammern beachten) an `trenner` (Zeichen) trennen. */
  function teilen(s, trenner) {
    const out = []; let d = 0, cur = '';
    for (const ch of String(s)) {
      if (ch === '(') d++; else if (ch === ')') d--;
      if (d === 0 && (trenner === ' ' ? /\s/.test(ch) : ch === trenner)) { if (cur) out.push(cur); cur = ''; } else cur += ch;
    }
    if (cur) out.push(cur);
    return out;
  }
  const HEX2 = (v) => { v = Math.max(0, Math.min(255, Math.round(v))); return (v < 16 ? '0' : '') + v.toString(16); };
  const snap = (hex) => (root.ppSnap ? root.ppSnap(hex) : hex);
  const zk = (v) => (Math.abs(v) < 1e-9 ? '0' : (Math.round(v * 100) / 100) + 'px');

  /** CSS-Farbe → { rgb:[r,g,b], a } oder { ausdruck, a } (var/currentColor/color-mix mit Unbekannten; a = bekannter Alpha-Anteil). */
  function farbeLesen(t) {
    t = String(t).trim();
    let m = /^#([0-9a-f]{3,8})$/i.exec(t);
    if (m) {
      let h = m[1]; if (h.length === 3 || h.length === 4) h = [...h].map(c => c + c).join('');
      return { rgb: [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)], a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1 };
    }
    m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i.exec(t);
    if (m) return { rgb: [+m[1], +m[2], +m[3]], a: m[4] == null ? 1 : (m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4])) };
    m = /^color\(\s*srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\s*\)$/i.exec(t);
    if (m) return { rgb: [+m[1] * 255, +m[2] * 255, +m[3] * 255], a: m[4] == null ? 1 : (m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4])) };
    m = /^hsla?\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i.exec(t);
    if (m) {
      const h = (+m[1] % 360) / 360, s = +m[2] / 100, l = +m[3] / 100;
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
      const f = (tt) => { tt = (tt + 1) % 1; return tt < 1 / 6 ? p + (q - p) * 6 * tt : tt < 0.5 ? q : tt < 2 / 3 ? p + (q - p) * (2 / 3 - tt) * 6 : p; };
      return { rgb: [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255], a: m[4] == null ? 1 : (m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4])) };
    }
    if (/^white$/i.test(t)) return { rgb: [255, 255, 255], a: 1 };
    if (/^black$/i.test(t)) return { rgb: [0, 0, 0], a: 1 };
    if (/^transparent$/i.test(t)) return { rgb: [0, 0, 0], a: 0 };
    // color-mix(in srgb, X p%, transparent) → Alpha p · a(X)
    m = /^color-mix\(\s*in\s+\w+(?:\s+\w+\s+hue)?\s*,\s*(.+?)\s+([\d.]+)%\s*,\s*transparent\s*\)$/i.exec(t);
    if (m) {
      const inner = farbeLesen(m[1]); const p = parseFloat(m[2]) / 100;
      if (inner.rgb) return { rgb: inner.rgb, a: inner.a * p };
      return { ausdruck: m[1], a: inner.a * p };
    }
    return { ausdruck: t, a: 1 };
  }
  const istDunkel = (f) => !!f.rgb && Math.max(f.rgb[0], f.rgb[1], f.rgb[2]) < 70;

  /** Farbe `f` mit Anteil `anteil` (0..1) auf den Oberflaechengrund gemischt → deckende CSS-Farbe. */
  function ton(f, anteil) {
    anteil = Math.max(0, Math.min(1, anteil));
    if (f.rgb) {
      const m = f.rgb.map((v, i) => GRUND_RGB[i] + (v - GRUND_RGB[i]) * anteil);
      return snap('#' + HEX2(m[0]) + HEX2(m[1]) + HEX2(m[2]));
    }
    return anteil >= 0.97 ? f.ausdruck : 'color-mix(in srgb, ' + f.ausdruck + ' ' + Math.round(anteil * 100) + '%, ' + KONFIG.grund + ')';
  }

  const ZAHL = /^(-?\d*\.?\d+)(px)?$/;
  /** Einen Schatten-Term zerlegen: { inset, x, y, blur, spread, farbe(Text), laengenUnklar }. Ohne Laengen (z. B. `var(--s)`) → null. */
  function schattenLesen(term) {
    const tok = teilen(term, ' ');
    let inset = false; const laengen = []; let farbe = null;
    for (const t of tok) {
      if (/^inset$/i.test(t)) { inset = true; continue; }
      const z = ZAHL.exec(t);
      if (z) { laengen.push(parseFloat(z[1])); continue; }
      if (/^(calc|min|max|clamp)\(/i.test(t) || /^-?[\d.]+(em|rem|%|vw|vh)$/.test(t)) { laengen.push(NaN); continue; }
      farbe = farbe ? farbe + ' ' + t : t;
    }
    if (laengen.length < 2 || !farbe) return null;
    return { inset, x: laengen[0], y: laengen[1], blur: laengen.length > 2 ? laengen[2] : 0, spread: laengen.length > 3 ? laengen[3] : 0, farbe };
  }
  const hatBlur = (sh) => sh && (Number.isNaN(sh.blur) || sh.blur > 0);

  /** Gibt es in `wert` (box-/text-shadow-Liste) einen Schein mit Unschaerfe? */
  function hatUnschaerfe(wert) {
    if (!wert || wert === 'none') return false;
    return teilen(wert, ',').some(t => hatBlur(schattenLesen(t)));
  }

  /** `box-shadow`-Liste mit Unschaerfe → harte Ringe (siehe Kopf). */
  function boxHart(wert) {
    if (!hatUnschaerfe(wert)) return wert;
    const teile = teilen(wert, ',').map(t => t.trim());
    const posten = []; const gruppen = new Map();
    for (const t of teile) {
      const sh = schattenLesen(t);
      if (!sh || !hatBlur(sh)) { posten.push({ roh: t }); continue; }
      const f = farbeLesen(sh.farbe);
      const blur = Number.isNaN(sh.blur) ? 8 : sh.blur;
      const spread = Number.isNaN(sh.spread) ? 0 : sh.spread;
      if (istDunkel(f)) {                                                   // Schlagschatten: hart, Versatz bleibt
        const sp = Math.max(0, spread + 2 * Math.round(blur / 16));
        posten.push({ roh: (sh.inset ? 'inset ' : '') + zk(sh.x) + ' ' + zk(sh.y) + ' 0 ' + zk(sp) + ' ' + sh.farbe });
        continue;
      }
      if (f.a < KONFIG.minAlpha) continue;                                  // zu schwach: faellt weg
      const key = (sh.inset ? 'i' : 'o') + sh.x + ',' + sh.y;
      if (!gruppen.has(key)) { gruppen.set(key, []); posten.push({ gruppe: key, inset: sh.inset, x: sh.x, y: sh.y }); }
      gruppen.get(key).push({ reichweite: Math.max(2, spread + blur * 0.4), f });
    }
    const out = [];
    for (const p of posten) {
      if (p.roh != null) { out.push(p.roh); continue; }
      let bisher = 0;
      for (const g of gruppen.get(p.gruppe).sort((a, b) => a.reichweite - b.reichweite)) {
        const k = Math.max(1, Math.min(KONFIG.maxRinge, Math.round(g.reichweite / KONFIG.ring)));
        const ende = Math.max(k, bisher + 1);
        for (let i = bisher + 1; i <= ende; i++) {
          const j = i - bisher;
          const anteil = Math.max(0.3, Math.min(1, Math.max(0.4, g.f.a) * (1 - (j - 1) * 0.28)));
          out.push((p.inset ? 'inset ' : '') + zk(p.x) + ' ' + zk(p.y) + ' 0 ' + zk(KONFIG.ring * i) + ' ' + ton(g.f, anteil));
        }
        bisher = ende;
      }
    }
    return out.length ? out.join(', ') : 'none';
  }

  /** `text-shadow`-Liste mit Unschaerfe → harte 2-px-Kontur in gedaempfter Farbe (dunkle Schatten: hart mit gleichem Versatz). */
  function textHart(wert) {
    if (!hatUnschaerfe(wert)) return wert;
    const out = [];
    for (const t of teilen(wert, ',').map(x => x.trim())) {
      const sh = schattenLesen(t);
      if (!sh || !hatBlur(sh)) { out.push(t); continue; }
      const f = farbeLesen(sh.farbe);
      if (istDunkel(f)) { out.push(zk(sh.x) + ' ' + zk(sh.y) + ' 0 ' + sh.farbe); continue; }
      if (f.a < KONFIG.minAlpha) continue;
      const c = ton(f, Math.max(0.35, Math.min(1, f.a * 0.8)));
      for (const k of ['2px 0 0 ', '-2px 0 0 ', '0 2px 0 ', '0 -2px 0 ']) { const z = k + c; if (!out.includes(z)) out.push(z); }
    }
    return out.length ? out.join(', ') : 'none';
  }

  /** `filter`-Liste: `blur()` weg, `drop-shadow()` mit Unschaerfe → vier harte drop-shadow (±2 px), dunkle → ein harter. */
  function filterHart(wert) {
    if (!wert || wert === 'none' || !/blur\(|drop-shadow\(/.test(wert)) return wert;
    const out = [];
    for (const fn of teilen(wert, ' ')) {
      if (/^blur\(/i.test(fn)) continue;
      const m = /^drop-shadow\((.*)\)$/i.exec(fn);
      if (!m) { out.push(fn); continue; }
      const sh = schattenLesen(m[1]);
      if (!sh || !hatBlur(sh)) { out.push(fn); continue; }
      const f = farbeLesen(sh.farbe);
      if (istDunkel(f)) { out.push('drop-shadow(' + zk(sh.x) + ' ' + zk(sh.y) + ' 0 ' + sh.farbe + ')'); continue; }
      if (f.a < KONFIG.minAlpha) continue;
      const c = ton(f, Math.max(0.4, Math.min(1, f.a * 0.85)));
      for (const k of ['2px 0 0 ', '-2px 0 0 ', '0 2px 0 ', '0 -2px 0 ']) { const z = 'drop-shadow(' + k + c + ')'; if (!out.includes(z)) out.push(z); }
    }
    return out.length ? out.join(' ') : 'none';
  }

  /** Eine Eigenschaft umschreiben (ohne CSSOM, fuer Tests): → neuer Wert oder derselbe. */
  function umschreiben(prop, wert) {
    switch (prop) {
      case 'box-shadow': return boxHart(wert);
      case 'text-shadow': return textHart(wert);
      case 'filter': case '-webkit-filter': return filterHart(wert);
      case 'backdrop-filter': case '-webkit-backdrop-filter': return /blur\(/.test(wert) ? 'none' : wert;
      default: return wert;
    }
  }

  // ── CSSOM ───────────────────────────────────────────────────────────────
  const PROPS = ['box-shadow', 'text-shadow', 'filter', 'backdrop-filter'];      // (die -webkit-Schreibweisen liefert Chrome unter denselben Namen)
  const stat = { regeln: 0, geaendert: 0, sheets: 0, ms: 0 };
  function stilBehandeln(st) {
    if (!st || typeof st.getPropertyValue !== 'function') return;
    stat.regeln++;
    for (const p of PROPS) {
      let v; try { v = st.getPropertyValue(p); } catch (e) { continue; }
      if (!v || v === 'none' || !/(blur\(|drop-shadow\(|\d)/.test(v)) continue;
      let neu; try { neu = umschreiben(p, v); } catch (e) { continue; }
      if (neu !== v) { try { st.setProperty(p, neu, st.getPropertyPriority(p)); stat.geaendert++; } catch (e) { /* Wert abgelehnt: bleibt */ } }
    }
  }
  function regelnBehandeln(liste) {
    if (!liste) return;
    for (let i = 0; i < liste.length; i++) {
      const r = liste[i];
      if (r.style) stilBehandeln(r.style);          // CSSStyleRule, CSSKeyframeRule, @font-face … (ohne Treffer: nichts)
      if (r.cssRules && r.cssRules.length) regelnBehandeln(r.cssRules);   // @media, @supports, @container, @keyframes
    }
  }
  const gesehen = new WeakSet();
  function durchsehen() {
    if (!KONFIG.aktiv) return;
    const t0 = (root.performance || Date).now();
    for (const sh of Array.from(document.styleSheets)) {
      if (gesehen.has(sh)) continue;
      let regeln; try { regeln = sh.cssRules; } catch (e) { continue; }    // fremde Herkunft: nicht lesbar
      if (!regeln) continue;
      gesehen.add(sh); stat.sheets++;
      regelnBehandeln(regeln);
    }
    stat.ms += (root.performance || Date).now() - t0;
  }
  function beobachten() {
    let wartet = false;
    const pruefen = () => { wartet = false; durchsehen(); };
    const mo = new MutationObserver((liste) => {
      if (wartet) return;
      for (const m of liste) for (const n of m.addedNodes) {
        if (n.nodeType === 1 && (n.tagName === 'STYLE' || n.tagName === 'LINK' || (n.firstElementChild && n.querySelector && n.querySelector('style')))) { wartet = true; break; }
      }
      if (wartet) root.requestAnimationFrame(pruefen);
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }

  const api = {
    KONFIG, stat, durchsehen,
    rein: { teilen, farbeLesen, ton, schattenLesen, hatUnschaerfe, boxHart, textHart, filterHart, umschreiben },
  };
  root.PPPixelCss = api;
  if (root.PP_RETRO) KONFIG.aktiv = false;          // Retro-Modus: eigene Pipeline, Look bleibt
  if (typeof document !== 'undefined' && KONFIG.aktiv) {
    durchsehen();
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { durchsehen(); beobachten(); }, { once: true });
    else beobachten();
    window.addEventListener('load', durchsehen, { once: true });
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
