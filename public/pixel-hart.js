'use strict';
// ═══════════════════════════════════════════════════════════════════════════════════════════
//  PIXEL-HART (W86u1) — harte Kanten statt Weichzeichner, fuer alles AUSSERHALB gebackener Animationen
//
//  Al: ALLE Animationen und Highlights im Spiel sind Pixelart.  `pixel-anim.js` (W86z) backt Bewegung; dieses Modul faengt die ruhenden Stile ab,
//  die es nicht anfasst und die der Browser weich malt:
//
//    box-shadow    mit Unschaerfe  → harte Ringe (`0 0 0 Npx`): Schein = 1–2 gestufte Ringe (innen kraeftig, aussen abgedunkelt),
//                                    Fall-Schatten = harter Versatz, Innenschein = harter Innenring, zarter Dunst faellt weg
//    text-shadow   mit Unschaerfe  → harte Pixelkontur (8 Richtungen) bzw. harter Versatz
//    filter        blur()/drop-shadow() mit Unschaerfe → weg bzw. harter drop-shadow(x y 0) / Kontur aus vier harten drop-shadows
//    backdrop-filter               → none
//    mix-blend-mode                → normal (Farbmischung mit dem Hintergrund ist nie Pixelart; Foil-Glanz der Karten bleibt)
//
//  WO:  (1) Stylesheets: jede Regel (auch @media/@supports) beim Laden und fuer spaeter eingehaengte <style>/<link>;  (2) Inline-Stile:
//  palette.js haengt `el.style.*` / `setProperty` / `cssText` / `setAttribute('style')` an `PPPixelHart.eigenschaft` / `.cssText`; (3) die gebackenen
//  Keyframes (pixel-anim.js ruft `box` / `text`).  @keyframes-Regeln selbst bleiben unberuehrt (backt pixel-anim.js; die Quellen stehen im Waechter).
//  Ausgenommen: Retro-Modus (`PP_RETRO`: eigene Pipeline), `foil`-Regeln (Kartenglanz gehoert dem Kartengestalter).
//
//  Reine Funktionen (kein DOM) stehen unter `PPPixelHart.rein` (Tests: test/pixel-hart.test.js).
// ═══════════════════════════════════════════════════════════════════════════════════════════
(function (root) {
  const KONFIG = { aktiv: true, maxRing: 6, cache: 4000 };

  // ── Zerlegen ──
  /** Oberste Ebene an `sep` trennen (Klammern/Anfuehrungszeichen beachten). */
  function teile(s, sep) {
    const out = []; let d = 0, q = '', cur = '';
    for (const ch of s) {
      if (q) { cur += ch; if (ch === q) q = ''; continue; }
      if (ch === '"' || ch === "'") { q = ch; cur += ch; continue; }
      if (ch === '(') d++; else if (ch === ')') d--;
      if (d === 0 && (sep === ' ' ? /\s/.test(ch) : ch === sep)) { if (cur.trim()) out.push(cur.trim()); cur = ''; } else cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  }
  const hsl2rgb = (h, s, l) => {
    h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
    const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [f(0) * 255, f(8) * 255, f(4) * 255];
  };
  const NAMEN = { black: [0, 0, 0], white: [255, 255, 255], red: [255, 0, 0], transparent: [0, 0, 0, 0] };
  /** Farbtoken → { r, g, b, a, v? } (`v` = dynamische Farbe wie var(--x) / color-mix(): bleibt Text); null = keine Farbe. */
  function farbe(tok) {
    tok = tok.trim();
    let m = /^#([0-9a-fA-F]{3,8})$/.exec(tok);
    if (m) {
      let x = m[1]; if (x.length === 3 || x.length === 4) x = [...x].map(c => c + c).join('');
      if (x.length !== 6 && x.length !== 8) return null;
      return { r: parseInt(x.slice(0, 2), 16), g: parseInt(x.slice(2, 4), 16), b: parseInt(x.slice(4, 6), 16), a: x.length === 8 ? parseInt(x.slice(6, 8), 16) / 255 : 1 };
    }
    m = /^rgba?\(\s*(-?[\d.]+)(%?)\s*[, ]\s*(-?[\d.]+)(%?)\s*[, ]\s*(-?[\d.]+)(%?)\s*(?:[,/]\s*([\d.]+)(%?)\s*)?\)$/.exec(tok);
    if (m) {
      const c = (v, p) => (p ? parseFloat(v) * 2.55 : parseFloat(v));
      return { r: c(m[1], m[2]), g: c(m[3], m[4]), b: c(m[5], m[6]), a: m[7] === undefined ? 1 : (m[8] ? parseFloat(m[7]) / 100 : parseFloat(m[7])) };
    }
    m = /^hsla?\(\s*(-?[\d.]+)(?:deg)?\s*[, ]\s*([\d.]+)%\s*[, ]\s*([\d.]+)%\s*(?:[,/]\s*([\d.]+)(%?)\s*)?\)$/.exec(tok);
    if (m) { const c = hsl2rgb(+m[1], +m[2], +m[3]); return { r: c[0], g: c[1], b: c[2], a: m[4] === undefined ? 1 : (m[5] ? parseFloat(m[4]) / 100 : parseFloat(m[4])) }; }
    if (NAMEN[tok.toLowerCase()]) { const n = NAMEN[tok.toLowerCase()]; return { r: n[0], g: n[1], b: n[2], a: n.length > 3 ? n[3] : 1 }; }
    if (/^(var|color-mix)\(/.test(tok)) return { r: 255, g: 255, b: 255, a: 1, v: tok };
    if (/^currentcolor$/i.test(tok)) return { r: 255, g: 255, b: 255, a: 1, v: 'currentcolor' };
    return null;
  }
  const LEN = /^(-?\d*\.?\d+)(px)?$/;
  const DYN = /^(?:calc|min|max|clamp)\(/;
  /** Ein Schatten (`inset? x y blur? spread? farbe`) → { inset, x, y, xr, yr, blur, spread, f } oder null (unbekannte Schreibweise → Wert bleibt).
   *  Laengen mit calc()/min()/max() sind dynamisch: x/y bleiben als Text (`xr`/`yr`) erhalten, eine dynamische Unschaerfe zaehlt als 12 px. */
  function schicht(item) {
    const nums = []; let inset = false, f = null;
    for (const t of teile(item, ' ')) {
      if (t === 'inset') { inset = true; continue; }
      const m = LEN.exec(t);
      if (m) { nums.push({ v: parseFloat(m[1]), raw: t }); continue; }
      if (DYN.test(t)) { nums.push({ v: NaN, raw: t }); continue; }
      const c = farbe(t);
      if (c && !f) { f = c; continue; }
      if (/^var\(/.test(t) && f) { nums.push({ v: NaN, raw: t }); continue; }
      return null;
    }
    if (nums.length < 2 || nums.length > 4) return null;
    const num = (i, d) => (nums[i] === undefined ? d : (Number.isNaN(nums[i].v) ? d : nums[i].v));
    return { inset, x: num(0, 0), y: num(1, 0), xr: nums[0].raw, yr: nums[1].raw, xd: Number.isNaN(nums[0].v), yd: Number.isNaN(nums[1].v),
      blur: nums[2] === undefined ? 0 : (Number.isNaN(nums[2].v) ? 12 : nums[2].v), spread: num(3, 0), f: f || { r: 255, g: 255, b: 255, a: 1, v: 'currentcolor' } };
  }

  // ── Farben ──
  const hex2 = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  const dunkel = (f) => !f.v && (0.2126 * f.r + 0.7152 * f.g + 0.0722 * f.b) < 46;
  /** Farbe `f` (deckend) mit Faktor k (0..1 gegen Schwarz = Deckkraft ueber dunklem Grund) als Text, auf die Palette gerastet. */
  function farbText(f, k) {
    if (f.v) {
      if (k >= 0.85) return f.v;
      return /^currentcolor$/i.test(f.v) ? f.v : `color-mix(in srgb, ${f.v} ${Math.round(k * 100)}%, #000)`;
    }
    let r = f.r * k, g = f.g * k, b = f.b * k;
    if (root.ppSnapRgb) { const p = root.ppSnapRgb(r, g, b); r = p[0]; g = p[1]; b = p[2]; }
    return '#' + hex2(r) + hex2(g) + hex2(b);
  }
  const gerade = (n) => Math.round(n / 2) * 2;
  const versatz = (v) => { const m = Math.abs(v); return m === 0 ? 0 : Math.sign(v) * Math.max(2, gerade(m)); };
  const ringBreite = (blur) => Math.max(2, Math.min(KONFIG.maxRing, 2 * Math.round(blur / 9)));
  const zk = (n) => String(Math.round(n * 100) / 100);
  // Dynamische Versatz-Laengen (calc/var): wenn der Browser CSS `round()` kennt, auf gerade Pixel runden (sonst malt der Browser die Schattenkante weich)
  let _rund = null;
  const dynLen = (raw) => {
    if (_rund === null) { try { _rund = !!(root.CSS && root.CSS.supports && root.CSS.supports('width', 'round(1.5px, 2px)')); } catch (e) { _rund = false; } }
    return _rund ? `round(${raw}, 2px)` : raw;
  };

  // ── box-shadow ──
  function boxHartUngecacht(wert) {
    const items = teile(wert, ',');
    const L = [];
    for (const it of items) { const p = schicht(it); if (!p) return wert; L.push(p); }
    if (!L.some(p => p.blur > 0)) return wert;
    const aussen = [];                                   // harte Schichten + Fall-Schatten in Originalreihenfolge
    const ringe = [], innen = [];
    for (let li = 0; li < L.length; li++) {
      const p = L[li];
      if (p.blur <= 0) { aussen.push(items[li]); continue; }                  // schon hart: unveraendert
      const a = p.f.a;
      if (a < 0.25) continue;                                      // zarter Dunst: weg
      const dk = dunkel(p.f);
      if (p.inset) { if (!dk) innen.push({ w: Math.min(4, ringBreite(p.blur)), f: p.f, k: Math.min(1, a * 1.25) }); continue; }
      if (p.x !== 0 || p.y !== 0 || p.xd || p.yd) {                // Fall-Schatten → harter Versatz
        if (a < 0.35) continue;
        aussen.push(`${p.xd ? dynLen(p.xr) : zk(versatz(p.x)) + 'px'} ${p.yd ? dynLen(p.yr) : zk(versatz(p.y)) + 'px'} 0 ${zk(Math.max(0, gerade(p.spread)))}px ${dk ? '#000000' : farbText(p.f, Math.min(1, a * 1.25))}`);
        continue;
      }
      if (dk) { if (a >= 0.6 && p.blur <= 6) ringe.push({ w: 2 + Math.max(0, gerade(p.spread)), f: p.f, k: 1 }); continue; }   // dunkle Umgebungsschatten: weg
      ringe.push({ w: ringBreite(p.blur) + Math.max(0, gerade(p.spread)), f: p.f, k: Math.min(1, a * 1.25) * (p.blur <= 8 ? 0.55 : 1), blur: p.blur });   // enge Scheine (Teilchen, Zeichen): gedaempfter Rand
    }
    ringe.sort((x, y) => x.w - y.w);
    let r = ringe.filter(e => e.k >= 0.3);                          // zu dunkle Ringe sind auf dem dunklen Brett unsichtbar
    if (r.length > 2) r = [r[0], r[r.length - 1]];
    const out = aussen.slice();
    r.forEach((e, i) => {
      let w = e.w;
      if (i === 1) w = Math.max(r[0].w + 2, Math.min(KONFIG.maxRing + 2, w));
      out.push(`0 0 0 ${zk(w)}px ${farbText(e.f, i === 1 ? e.k * 0.6 : e.k)}`);
    });
    for (const e of innen.slice(0, 1)) out.push(`inset 0 0 0 ${zk(e.w)}px ${farbText(e.f, e.k * 0.7)}`);
    return out.length ? out.join(', ') : 'none';
  }

  // ── text-shadow ──
  const RICHTUNGEN = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]];
  function textHartUngecacht(wert) {
    const items = teile(wert, ',');
    const L = [];
    for (const it of items) { const p = schicht(it); if (!p || p.inset) return wert; L.push(p); }
    if (!L.some(p => p.blur > 0)) return wert;
    const out = []; let kontur = false;
    for (let li = 0; li < L.length; li++) {
      const p = L[li];
      if (p.blur <= 0) { out.push(items[li]); continue; }
      const a = p.f.a;
      if (a < 0.3) continue;
      const dk = dunkel(p.f);
      if (p.x !== 0 || p.y !== 0 || p.xd || p.yd) { out.push(`${p.xd ? dynLen(p.xr) : zk(Math.sign(p.x) * Math.max(1, Math.round(Math.abs(p.x)))) + 'px'} ${p.yd ? dynLen(p.yr) : zk(Math.sign(p.y) * Math.max(1, Math.round(Math.abs(p.y)))) + 'px'} 0 ${dk ? '#000000' : farbText(p.f, Math.min(1, a * 1.25))}`); continue; }
      if (kontur) continue;                                        // nur EINE Kontur (die engste Schicht)
      kontur = true;
      if (dk && a < 0.5) continue;
      const w = p.blur <= 4 ? 1 : 2;
      const c = dk ? '#000000' : farbText(p.f, Math.min(1, a * 1.25) * 0.45);                // Leuchtkontur: dunkler Ton der Farbe (gleiche Farbe wie die Schrift verklumpt die Buchstaben)
      for (const [dx, dy] of RICHTUNGEN) out.push(`${dx * w}px ${dy * w}px 0 ${c}`);
    }
    return out.length ? out.slice(0, 12).join(', ') : 'none';
  }

  // ── filter ──
  function filterHartUngecacht(wert) {
    if (!/blur\(|drop-shadow\(/.test(wert)) return wert;
    let out = '', i = 0; const re = /(drop-shadow|blur)\(/g; let m;
    while ((m = re.exec(wert))) {
      const open = m.index + m[0].length - 1;
      let d = 0, close = -1;
      for (let j = open; j < wert.length; j++) { if (wert[j] === '(') d++; else if (wert[j] === ')') { d--; if (d === 0) { close = j; break; } } }
      if (close < 0) break;
      out += wert.slice(i, m.index);
      if (m[1] === 'drop-shadow') {
        const p = schicht(wert.slice(open + 1, close));
        if (!p) out += wert.slice(m.index, close + 1);
        else if (p.blur <= 0) out += wert.slice(m.index, close + 1);
        else if (p.f.a < 0.25) { /* Dunst: weg */ }
        else {
          const dk = dunkel(p.f), c = dk ? '#000000' : farbText(p.f, Math.min(1, p.f.a * 1.25));
          if (p.x !== 0 || p.y !== 0 || p.xd || p.yd) out += `drop-shadow(${p.xd ? dynLen(p.xr) : zk(versatz(p.x)) + 'px'} ${p.yd ? dynLen(p.yr) : zk(versatz(p.y)) + 'px'} 0 ${c})`;
          else if (!(dk && (p.f.a < 0.5 || p.blur > 8))) { const w = p.blur <= 3 ? 1 : (p.blur <= 9 ? 2 : 4); out += `drop-shadow(${w}px 0 0 ${c}) drop-shadow(${-w}px 0 0 ${c}) drop-shadow(0 ${w}px 0 ${c}) drop-shadow(0 ${-w}px 0 ${c})`; }
        }
      }                                                              // blur(): weg
      i = close + 1; re.lastIndex = close + 1;
    }
    out += wert.slice(i);
    out = out.replace(/\s+/g, ' ').trim();
    return out === '' ? 'none' : out;
  }

  // ── Zwischenspeicher ──
  const _c = { box: new Map(), text: new Map(), filter: new Map() };
  const cached = (art, fn) => (wert) => {
    if (typeof wert !== 'string' || wert.length < 4) return wert;
    const m = _c[art];
    let r = m.get(wert);
    if (r === undefined) { try { r = fn(wert); } catch (e) { r = wert; } if (m.size > KONFIG.cache) m.clear(); m.set(wert, r); }
    return r;
  };
  const box = cached('box', boxHartUngecacht);
  const text = cached('text', textHartUngecacht);
  const filter = cached('filter', filterHartUngecacht);

  /** Wert einer Eigenschaft umwandeln (Name camelCase oder kebab). Alles andere bleibt unveraendert. */
  function eigenschaft(name, wert) {
    if (!KONFIG.aktiv || typeof wert !== 'string' || !wert) return wert;
    switch (name) {
      case 'boxShadow': case 'box-shadow': return box(wert);
      case 'textShadow': case 'text-shadow': return text(wert);
      case 'filter': case '-webkit-filter': case 'webkitFilter': return /blur\(|drop-shadow\(/.test(wert) ? filter(wert) : wert;
      case 'backdropFilter': case 'backdrop-filter': case '-webkit-backdrop-filter': case 'webkitBackdropFilter': return /\(/.test(wert) ? 'none' : wert;
      case 'mixBlendMode': case 'mix-blend-mode': return wert === 'normal' || /^(inherit|initial|unset|revert)/.test(wert) ? wert : 'normal';
      default:
        if (name.charCodeAt(0) === 45 && name.charCodeAt(1) === 45 && /(schatten|shadow|glow|schein)/i.test(name) && /\d/.test(wert)) {   // --foo-shadow
          return box(wert);
        }
        return wert;
    }
  }
  /** `style.cssText` / `style`-Attribut: die betroffenen Deklarationen umwandeln. */
  const RE_ZEIT = /box-shadow|text-shadow|filter|blend-mode|(?:--[\w-]*(?:schatten|shadow|glow|schein))/i;
  function cssText(t) {
    if (!KONFIG.aktiv || typeof t !== 'string' || !RE_ZEIT.test(t)) return t;
    const teileDekl = teile(t, ';');
    let geaendert = false;
    const neu = teileDekl.map((d) => {
      const i = d.indexOf(':'); if (i < 0) return d;
      const n = d.slice(0, i).trim(), v = d.slice(i + 1).trim();
      const imp = /\s*!important\s*$/i.test(v);
      const w = eigenschaft(n.toLowerCase().startsWith('--') ? n : n.toLowerCase(), imp ? v.replace(/\s*!important\s*$/i, '') : v);
      if (w === (imp ? v.replace(/\s*!important\s*$/i, '') : v)) return d;
      geaendert = true;
      return n + ': ' + w + (imp ? ' !important' : '');
    });
    return geaendert ? neu.join('; ') + ';' : t;
  }

  // ═════════════════ Stylesheets ═════════════════
  const REGEL_AUS = /foil|pp-glanz/;                    // Kartenglanz (Kartengestalter): unberuehrt
  const EIGENSCHAFTEN = ['box-shadow', 'text-shadow', 'filter', '-webkit-filter', 'backdrop-filter', '-webkit-backdrop-filter', 'mix-blend-mode'];
  let stat = { regeln: 0, geaendert: 0, blaetter: 0, ms: 0 };
  const gesehen = new WeakSet();
  function styleRegel(r, ausName) {
    const st = r.style; if (!st) return;
    stat.regeln++;
    const aus = ausName || (r.selectorText && REGEL_AUS.test(r.selectorText));
    for (const n of EIGENSCHAFTEN) {
      if (aus && n === 'mix-blend-mode') continue;
      const v = st.getPropertyValue(n);
      if (!v) continue;
      const w = eigenschaft(n, v);
      if (w !== v) { st.setProperty(n, w, st.getPropertyPriority(n)); stat.geaendert++; }
    }
    // Eigene Eigenschaften (--x-shadow / --x-glow): Name enthaelt shadow/glow/schein
    for (let i = 0, n = st.length; i < n; i++) {
      const name = st[i];
      if (name.charCodeAt(0) !== 45 || name.charCodeAt(1) !== 45 || !/(schatten|shadow|glow|schein)/i.test(name)) continue;
      const v = st.getPropertyValue(name), w = eigenschaft(name, v.trim());
      if (w !== v.trim()) { st.setProperty(name, w, st.getPropertyPriority(name)); stat.geaendert++; }
    }
  }
  function regeln(liste) {
    for (const r of liste) {
      if (r.type === 1) styleRegel(r);                    // CSSStyleRule
      else if (r.type === 7) {                            // @keyframes: auch hier harte Werte — bis pixel-anim.js die Animation gebacken hat (Zeitscheiben), laeuft sie sonst weich
        const aus = REGEL_AUS.test(r.name || '');
        for (const k of r.cssRules) styleRegel(k, aus);
      }
      else if (r.type === 8 || r.type === 5) continue;    // @font-face
      else if (r.cssRules) regeln(r.cssRules);            // @media / @supports / @layer …
    }
  }
  function blatt(sh) {
    if (!sh || gesehen.has(sh)) return;
    let rl; try { rl = sh.cssRules; } catch (e) { return; }         // fremder Ursprung
    if (!rl) return;
    gesehen.add(sh); stat.blaetter++;
    const t0 = (root.performance || Date).now();
    try { regeln(rl); } catch (e) { /* bleibt */ }
    stat.ms += (root.performance || Date).now() - t0;
  }
  function alleBlaetter() { try { for (const sh of document.styleSheets) blatt(sh); } catch (e) { /* ohne */ } }

  function starten() {
    if (!root.document || root.PP_RETRO) { KONFIG.aktiv = false; return; }
    try { if (/[?&]hart=0\b/.test(root.location.search)) { KONFIG.aktiv = false; root.PPPixelHart = undefined; return; } } catch (e) { /* ohne */ }   // Messung: ?hart=0 = Vorher-Zustand
    alleBlaetter();
    // Blaetter, die erst spaeter fertig werden (<link>) bzw. neu eingehaengt werden (<style> aus Komponenten)
    document.addEventListener('load', (e) => { const t = e.target; if (t && t.tagName === 'LINK' && t.sheet) blatt(t.sheet); }, true);
    document.addEventListener('DOMContentLoaded', alleBlaetter);
    try {
      const mo = new MutationObserver((liste) => {
        for (const m of liste) {
          if (m.target && m.target.nodeName === 'STYLE' && m.target.sheet) { gesehen.delete(m.target.sheet); blatt(m.target.sheet); }
          for (const n of m.addedNodes) {
            if (n.nodeType !== 1) continue;
            if (n.nodeName === 'STYLE' || n.nodeName === 'LINK') { if (n.sheet) blatt(n.sheet); }
            else if (n.firstElementChild && n.querySelectorAll) for (const s of n.querySelectorAll('style')) if (s.sheet) blatt(s.sheet);
          }
        }
      });
      mo.observe(document.documentElement, { childList: true, subtree: true });
    } catch (e) { /* ohne */ }
  }

  const rein = { teile, farbe, schicht, box, text, filter, eigenschaft, cssText, boxHartUngecacht, textHartUngecacht, filterHartUngecacht, ringBreite };
  const api = { KONFIG, stat: () => stat, rein, box, text, filter, eigenschaft, cssText, blatt, alleBlaetter, starten };
  root.PPPixelHart = api;
  if (typeof document !== 'undefined') starten();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
