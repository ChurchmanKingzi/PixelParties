'use strict';
// ════════════════════════════════════════════════════════════════════════════
//  RETRO-MODUS — Umwandlungs-Kern.   Wird vom Build (scripts/retro/build-css.js: style.css → style.retro.css) UND zur Laufzeit
//  (public/palette.js: Inline-Stile aus React) benutzt, damit beide dasselbe Ergebnis liefern.
//
//  Was „Retro" hier bedeutet (alles harte Pixelkanten, kein weicher Look):
//    • Farben:      nur die reduzierte Retro-Palette (data/palette-retro.json, Teilmenge der 256 Spielfarben, in Familien mit Schattierungen)
//    • Transparenz: Hintergrundfarben mit Alpha → 2×2-Pixel-Dithering (25 / 50 / 75 %); sonstige Alpha-Farben → deckend gemischt
//    • Verläufe:    weiche Übergänge → harte Farbbänder (posterisiert), Zwischenfarben nur aus der Palette
//    • Schatten:    Weichzeichner-Schatten/-Scheine → harte Versatz-Schatten bzw. 1–3 px Ringe; Text-/Sprite-Scheine → Pixel-Kontur
//    • Kanten:      border-radius → 0, backdrop-filter / blur() entfallen
//    • Bewegung:    weiche Übergänge/Animationen → steps() im Bildtakt (≤ 24 Bilder/s)
//  Die Eingabe ist normales CSS; unbekannte oder zu komplexe Werte bleiben unverändert (nur die Farben werden gerastet).
// ════════════════════════════════════════════════════════════════════════════
(function (root) {
  // RETRO:BEGIN — erzeugt, nicht von Hand aendern
  const RETRO = ["#000000", "#08060c", "#12101f", "#1a1a2e", "#291f3d", "#3e3e51", "#59606e", "#7e7d9b", "#9aa3b6", "#d2d2db", "#e5edfa", "#ffffff", "#07aec5", "#1aedff", "#6be9fa", "#14285a", "#2f539d", "#66b6ff", "#bddcef", "#2b0b47", "#58238c", "#903ae6", "#ba74ff", "#d6bbf1", "#5a023a", "#c80480", "#fb1ea9", "#f174ab", "#55011a", "#8c0014", "#e92f38", "#fe5154", "#f9b3b3", "#7d3911", "#aa5300", "#ff8b1a", "#72541d", "#a87c00", "#f9ac20", "#ffd61a", "#fff196", "#1a4128", "#167927", "#4ceb70", "#b1ff1a", "#3a2412", "#6e4421", "#c7855b", "#e0c085"];
  // RETRO:END

  // ── Farben ──
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  function lab(r, g, b) {
    r = lin(r); g = lin(g); b = lin(b);
    let x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, y = 0.2126 * r + 0.7152 * g + 0.0722 * b, z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
    const f = (t) => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
    x = f(x); y = f(y); z = f(z);
    return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
  }
  const RGB = RETRO.map(h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
  const LAB = RGB.map(c => lab(c[0], c[1], c[2]));
  const hex2 = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  const toHex = (c) => '#' + hex2(c[0]) + hex2(c[1]) + hex2(c[2]);
  const TINTE = [8, 6, 12];        // Untergrund, gegen den Alpha-Farben „deckend gemischt" werden
  const snapCache = new Map();
  function snap(r, g, b) {
    r = Math.max(0, Math.min(255, Math.round(r))); g = Math.max(0, Math.min(255, Math.round(g))); b = Math.max(0, Math.min(255, Math.round(b)));
    const key = (r << 16) | (g << 8) | b;
    let hit = snapCache.get(key);
    if (hit) return hit;
    const l = lab(r, g, b); let bi = 0, bd = 1e9;
    for (let i = 0; i < LAB.length; i++) {
      const p = LAB[i], d = (l[0] - p[0]) ** 2 + (l[1] - p[1]) ** 2 + (l[2] - p[2]) ** 2;
      if (d < bd) { bd = d; bi = i; }
    }
    hit = RGB[bi];
    if (snapCache.size > 20000) snapCache.clear();
    snapCache.set(key, hit);
    return hit;
  }
  const mischen = (c, a, bg) => [c[0] * a + bg[0] * (1 - a), c[1] * a + bg[1] * (1 - a), c[2] * a + bg[2] * (1 - a)];
  /** Farbe mit Alpha → deckende Palettenfarbe (gegen die Tinte gemischt). */
  const deckend = (f, bg) => toHex(snap(...mischen([f.r, f.g, f.b], f.a, bg || TINTE)));
  const rein = (f) => toHex(snap(f.r, f.g, f.b));

  const RE_FARBE = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![0-9a-zA-Z_-])|rgba?\(\s*(-?\d*\.?\d+)\s*[, ]\s*(-?\d*\.?\d+)\s*[, ]\s*(-?\d*\.?\d+)\s*(?:[,/]\s*(\d*\.?\d+%?)\s*)?\)|hsla?\(\s*(-?\d*\.?\d+)(?:deg)?\s*[, ]\s*(\d*\.?\d+)%\s*[, ]\s*(\d*\.?\d+)%\s*(?:[,/]\s*(\d*\.?\d+%?)\s*)?\)|(?<![\w-])transparent(?![\w-])/g;
  function hsl2rgb(h, s, l) {
    h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
    const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [f(0) * 255, f(8) * 255, f(4) * 255];
  }
  const alphaWert = (s) => s == null ? 1 : (String(s).endsWith('%') ? parseFloat(s) / 100 : parseFloat(s));
  function farbeAusTreffer(m) {
    const t = m[0];
    if (t === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
    if (t[0] === '#') {
      let x = t.slice(1); if (x.length <= 4) x = [...x].map(c => c + c).join('');
      return { r: parseInt(x.slice(0, 2), 16), g: parseInt(x.slice(2, 4), 16), b: parseInt(x.slice(4, 6), 16), a: x.length === 8 ? parseInt(x.slice(6, 8), 16) / 255 : 1 };
    }
    if (m[1] !== undefined) return { r: +m[1], g: +m[2], b: +m[3], a: alphaWert(m[4]) };
    const q = hsl2rgb(+m[5], +m[6], +m[7]);
    return { r: q[0], g: q[1], b: q[2], a: alphaWert(m[8]) };
  }
  function ersetzeFarben(text, fn) {
    return text.replace(RE_FARBE, (...a) => {
      const gruppen = a.slice(0, a.findIndex(v => typeof v === 'number'));
      return fn(farbeAusTreffer(gruppen), gruppen[0]);
    });
  }
  function ersteFarbe(text) { RE_FARBE.lastIndex = 0; const m = RE_FARBE.exec(text); RE_FARBE.lastIndex = 0; return m ? { f: farbeAusTreffer(m), text: m[0], index: m.index } : null; }

  // ── kleine Textwerkzeuge ──
  /** Teilt an `sep` auf oberster Klammerebene (Klammern und Anführungszeichen werden respektiert). */
  function teile(text, sep) {
    const out = []; let depth = 0, q = '', cur = '';
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { cur += c; if (c === q && text[i - 1] !== '\\') q = ''; continue; }
      if (c === '"' || c === "'") { q = c; cur += c; continue; }
      if (c === '(') depth++; else if (c === ')') depth--;
      if (depth === 0 && (sep === ' ' ? /\s/.test(c) : c === sep)) { if (sep !== ' ' || cur) out.push(cur); cur = ''; continue; }
      cur += c;
    }
    if (cur.trim() !== '' || sep !== ' ') out.push(cur);
    return out;
  }
  function klammerEnde(text, open) {   // Index der passenden ')' zur '(' bei `open`
    let depth = 0, q = '';
    for (let i = open; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === q && text[i - 1] !== '\\') q = ''; continue; }
      if (c === '"' || c === "'") q = c; else if (c === '(') depth++; else if (c === ')') { depth--; if (depth === 0) return i; }
    }
    return -1;
  }
  const zahl = (n) => String(Math.round(n * 100) / 100);
  const px = (n) => (n === 0 ? '0' : zahl(n) + 'px');

  // ── Dithering ──
  /** Alpha-Stufe → 0 (weglassen), 1/2/3 (25/50/75 % Raster) oder 4 (deckend). */
  const alphaStufe = (a) => a < 0.12 ? 0 : a < 0.37 ? 1 : a < 0.62 ? 2 : a < 0.88 ? 3 : 4;
  /** 4×4-Pixel-Kachel aus 2×2-Zellen als SVG (scharfkantig). */
  function rasterBild(hexFarbe, stufe) {
    const c = encodeURIComponent(hexFarbe);
    const cells = { 1: [[2, 0]], 2: [[2, 0], [0, 2]], 3: [[0, 0], [2, 0], [0, 2]] }[stufe];
    const rects = cells.map(([x, y]) => `%3Crect x='${x}' y='${y}' width='2' height='2' fill='${c}'/%3E`).join('');
    return `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='4' shape-rendering='crispEdges'%3E${rects}%3C/svg%3E")`;
  }
  const RASTER_GROESSE = '4px 4px';

  // ── Verläufe → harte Bänder ──
  const VERLAUF = /(repeating-)?(linear|radial|conic)-gradient\(/g;
  const POS = /^(-?\d*\.?\d+)(%|px|em|rem|vw|vh|deg|turn)?$/;
  function interp(a, b, t) {      // vormultipliziert
    const al = a.a + (b.a - a.a) * t;
    if (al <= 0) return { r: b.r, g: b.g, b: b.b, a: 0 };
    const m = (x, y) => ((x * a.a + (y * b.a - x * a.a) * t) / al);
    return { r: m(a.r, b.r), g: m(a.g, b.g), b: m(a.b, b.b), a: al };
  }
  function farbDist(a, b) {
    const la = lab(...mischen([a.r, a.g, a.b], a.a, TINTE)), lb = lab(...mischen([b.r, b.g, b.b], b.a, TINTE));
    return Math.hypot(la[0] - lb[0], la[1] - lb[1], la[2] - lb[2]) + Math.abs(a.a - b.a) * 40;
  }
  const bandFarbe = (f) => f.a < 0.6 ? 'transparent' : rein({ r: f.r, g: f.g, b: f.b });    // Alpha in Bändern: ganz oder gar nicht
  /** Posterisiert die Argumente eines linear-/radial-gradient. Gibt null zurück, wenn der Verlauf zu ungewöhnlich ist. */
  function verlaufBaender(args) {
    const tl = teile(args, ',').map(s => s.trim());
    let config = null, st = tl;
    if (!ersteFarbe(tl[0])) { config = tl[0]; st = tl.slice(1); }
    if (st.length < 2) return null;
    const stops = [];
    let einheit = null;
    for (const t of st) {
      if (/var\(|calc\(|env\(|min\(|max\(|clamp\(/.test(t)) return null;
      const c = ersteFarbe(t); if (!c) return null;
      const rest = (t.slice(0, c.index) + ' ' + t.slice(c.index + c.text.length)).trim();
      const ps = rest ? rest.split(/\s+/) : [];
      const pos = [];
      for (const p of ps) { const m = POS.exec(p); if (!m) return null; const u = m[2] || (m[1] === '0' ? null : ''); if (u) { if (einheit && einheit !== u) return null; einheit = u; } pos.push(parseFloat(m[1])); }
      if (pos.length > 2) return null;
      stops.push({ f: c.f, p: pos });
    }
    if (!einheit) einheit = '%';
    // Positionen auffüllen (CSS-Regeln)
    const P = [];
    for (const s of stops) { P.push(s.p.length ? s.p[0] : null); if (s.p.length === 2) P.push(s.p[1]); }
    // Stops mit zwei Positionen werden zu zwei Stops mit gleicher Farbe
    const flach = [];
    for (const s of stops) { if (s.p.length === 2) { flach.push({ f: s.f, p: s.p[0] }, { f: s.f, p: s.p[1] }); } else flach.push({ f: s.f, p: s.p.length ? s.p[0] : null }); }
    if (flach[0].p == null) flach[0].p = 0;
    if (flach[flach.length - 1].p == null) { if (einheit !== '%') return null; flach[flach.length - 1].p = 100; }
    let max = flach[0].p;
    for (const s of flach) { if (s.p != null) { if (s.p < max) s.p = max; max = s.p; } }
    for (let i = 0; i < flach.length; i++) {
      if (flach[i].p != null) continue;
      let j = i; while (flach[j].p == null) j++;
      const a = flach[i - 1].p, b = flach[j].p;
      for (let k = i; k < j; k++) flach[k].p = a + (b - a) * (k - i + 1) / (j - i + 1);
      i = j;
    }
    // Bänder erzeugen
    const bands = [];      // { f:Farbe, von, bis }
    const add = (f, von, bis) => { if (bis < von) bis = von; const hx = bandFarbe(f); const l = bands[bands.length - 1]; if (l && l.hx === hx && Math.abs(l.bis - von) < 1e-6) l.bis = bis; else bands.push({ hx, von, bis }); };
    add(flach[0].f, flach[0].p, flach[0].p);
    for (let i = 0; i < flach.length - 1; i++) {
      const a = flach[i], b = flach[i + 1];
      if (b.p - a.p < 1e-6) continue;     // harter Stopp: das Band endet, das nächste beginnt
      const d = farbDist(a.f, b.f);
      const n = Math.max(1, Math.min(6, Math.round(d / 14)));
      if (n === 1) { add(interp(a.f, b.f, 0.5), a.p, b.p); continue; }
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n;            // Bandmitte
        add(interp(a.f, b.f, t), a.p + (b.p - a.p) * k / n, a.p + (b.p - a.p) * (k + 1) / n);
      }
    }
    // erste/letzte Farbe auch vor/hinter dem Bereich (CSS füllt dort mit der Randfarbe)
    const teileOut = bands.map(b => `${b.hx} ${zahl(b.von)}${einheit} ${zahl(b.bis)}${einheit}`);
    if (teileOut.length === 0) return null;
    return (config ? config + ', ' : '') + teileOut.join(', ');
  }
  function verlaeufe(wert) {
    let out = '', i = 0;
    VERLAUF.lastIndex = 0;
    let m;
    while ((m = VERLAUF.exec(wert))) {
      const open = m.index + m[0].length - 1;
      const close = klammerEnde(wert, open);
      if (close < 0) break;
      out += wert.slice(i, m.index);
      const args = wert.slice(open + 1, close);
      let neu = null;
      if (!m[1] && m[2] !== 'conic') neu = verlaufBaender(args);
      out += neu != null ? `${m[0]}${neu})` : wert.slice(m.index, close + 1);
      i = close + 1; VERLAUF.lastIndex = close + 1;
    }
    return out + wert.slice(i);
  }

  // ── Schatten ──
  const LEN = /^(-?\d*\.?\d+)(px|em|rem)?$/;
  // color-mix(in srgb, <Farbe oder var(--x, #fallback)> N%, transparent) = die Farbe mit Alpha N %. Die var()-Form bleibt dynamisch (Spielerfarbe).
  const COLORMIX = /^color-mix\(\s*in\s+[\w-]+\s*,\s*(var\([^()]*\)|#[0-9a-fA-F]{3,8}|rgba?\([^()]*\))\s+(\d*\.?\d+)%\s*,\s*transparent\s*\)$/;
  function farbeAusMix(t) {
    const m = COLORMIX.exec(t); if (!m) return null;
    let inner = m[1], v = null;
    if (inner.startsWith('var(')) { v = inner; const fb = ersteFarbe(inner); if (!fb) return null; return { r: fb.f.r, g: fb.f.g, b: fb.f.b, a: parseFloat(m[2]) / 100, v }; }
    const c = ersteFarbe(inner); if (!c) return null;
    return { r: c.f.r, g: c.f.g, b: c.f.b, a: c.f.a * parseFloat(m[2]) / 100, v: null };
  }
  /** Farbe für harte Ränder/Schatten: dynamische Farben (var) bleiben, sobald sie kräftig genug sind. */
  const schattenFarbe = (f, boost) => (f.v && f.a * (boost || 1) >= 0.3 ? f.v : deckend({ r: f.r, g: f.g, b: f.b, a: Math.min(1, f.a * (boost || 1)) }));
  function schattenTeile(item) {
    const tok = teile(item.trim(), ' ');
    let inset = false, farbe = null; const nums = [];
    for (const t of tok) {
      if (t === 'inset') { inset = true; continue; }
      const cm = farbeAusMix(t);
      if (cm) { farbe = cm; continue; }
      if (/^var\(/.test(t)) { const fb = ersteFarbe(t); farbe = { r: fb ? fb.f.r : 26, g: fb ? fb.f.g : 237, b: fb ? fb.f.b : 255, a: 1, v: t }; continue; }
      const c = ersteFarbe(t);
      if (c && c.text.length === t.length) { farbe = c.f; continue; }
      const m = LEN.exec(t); if (!m) return null;
      nums.push(parseFloat(m[1]) * (m[2] === 'em' || m[2] === 'rem' ? 16 : 1));
    }
    if (nums.length < 2 || nums.length > 4) return null;
    return { inset, x: nums[0], y: nums[1], blur: nums[2] || 0, spread: nums[3] || 0, f: farbe || { r: 255, g: 255, b: 255, a: 1 } };
  }
  const dunkel = (f) => lab(f.r, f.g, f.b)[0] < 28;
  const versatz = (v) => { const m = Math.abs(v); return m === 0 ? 0 : Math.sign(v) * Math.min(4, Math.max(1, Math.round(m / 2))); };
  function boxSchatten(wert) {
    if (/calc\(/.test(wert) || /^\s*(none|inherit|initial|unset)\s*$/.test(wert)) return recolor(wert);
    const eintraege = [];       // { str } oder { ring:true, n, hx, a, inset }
    for (const item of teile(wert, ',')) {
      const p = schattenTeile(item);
      if (!p) { eintraege.push({ str: recolor(item.trim()) }); continue; }
      const a = p.f.a;
      if (p.blur === 0) {      // schon hart: nur deckend färben
        eintraege.push({ str: `${p.inset ? 'inset ' : ''}${px(p.x)} ${px(p.y)} 0 ${px(p.spread)} ${schattenFarbe(p.f)}` });
        continue;
      }
      if (a < 0.2) continue;                                            // zarter Dunst: fällt weg
      if (!p.inset && (p.x !== 0 || p.y !== 0)) {                       // Fall-Schatten → harter Versatz
        eintraege.push({ str: `${px(versatz(p.x))} ${px(versatz(p.y))} 0 ${px(Math.max(0, Math.min(2, p.spread)))} ${dunkel(p.f) ? '#000000' : schattenFarbe(p.f)}` });
        continue;
      }
      const n = p.blur >= 24 ? 3 : p.blur >= 8 ? 2 : 1;                 // Schein → Ring
      eintraege.push({ ring: true, inset: p.inset, n: n + Math.max(0, Math.round(p.spread / 2)), hx: schattenFarbe(p.f, 1.5), a });
    }
    // Ringe: gleiche Farbe zusammenfassen, höchstens zwei, dünner zuerst (liegt oben)
    const beste = new Map();
    for (const e of eintraege) if (e.ring) { const k = e.inset + e.hx; const o = beste.get(k); if (!o || e.n > o.n) beste.set(k, e); }
    const behalten = [...beste.values()].sort((x, y) => y.a - x.a).slice(0, 2).sort((x, y) => x.n - y.n);
    let r = 0;
    const out = [];
    for (const e of eintraege) {
      if (!e.ring) { out.push(e.str); continue; }
      if (beste.get(e.inset + e.hx) !== e || !behalten.includes(e)) continue;
      const q = behalten[r++]; out.push(`${q.inset ? 'inset ' : ''}0 0 0 ${q.n}px ${q.hx}`);
    }
    return out.length ? out.join(', ') : 'none';
  }
  function textSchatten(wert) {
    if (/calc\(/.test(wert) || /^\s*(none|inherit|initial|unset)\s*$/.test(wert)) return recolor(wert);
    const out = [];
    for (const item of teile(wert, ',')) {
      const p = schattenTeile(item);
      if (!p) { out.push(recolor(item.trim())); continue; }
      if (p.blur === 0) { out.push(`${px(p.x)} ${px(p.y)} 0 ${schattenFarbe(p.f)}`); continue; }
      if (p.f.a < 0.3) continue;
      if (p.x === 0 && p.y === 0) {      // Schein → 1-px-Schlagschatten in dunklem Ton der Farbe
        const d = toHex(snap(p.f.r * 0.22, p.f.g * 0.22, p.f.b * 0.22));
        out.push(`1px 1px 0 ${d}`);
      } else out.push(`${px(Math.sign(p.x) * Math.min(3, Math.max(1, Math.round(Math.abs(p.x))))) } ${px(Math.sign(p.y) * Math.min(3, Math.max(1, Math.round(Math.abs(p.y)))))} 0 ${dunkel(p.f) ? '#000000' : schattenFarbe(p.f)}`);
    }
    const uniq = [...new Set(out)];
    return uniq.length ? uniq.slice(0, 2).join(', ') : 'none';
  }
  function filterWert(wert) {
    if (/calc\(/.test(wert) || /^\s*(none|inherit|initial|unset)\s*$/.test(wert)) return recolor(wert);
    let out = '', i = 0; const re = /(drop-shadow|blur)\(/g; let m;
    while ((m = re.exec(wert))) {
      const open = m.index + m[0].length - 1, close = klammerEnde(wert, open); if (close < 0) break;
      out += wert.slice(i, m.index);
      if (m[1] === 'blur') { /* entfällt */ }
      else {
        const p = schattenTeile(wert.slice(open + 1, close));
        if (!p) out += wert.slice(m.index, close + 1);
        else if (p.f.a < 0.25) { /* Dunst: weg */ }
        else if (p.blur > 0 && p.x === 0 && p.y === 0) {    // Schein → 1-px-Pixelkontur
          const hx = schattenFarbe(p.f);
          out += `drop-shadow(1px 0 0 ${hx}) drop-shadow(-1px 0 0 ${hx}) drop-shadow(0 1px 0 ${hx}) drop-shadow(0 -1px 0 ${hx})`;
        } else out += `drop-shadow(${px(Math.round(p.x / 2) * 2 || Math.sign(p.x))} ${px(Math.round(p.y / 2) * 2 || Math.sign(p.y))} 0 ${dunkel(p.f) ? '#000000' : schattenFarbe(p.f)})`;
      }
      i = close + 1; re.lastIndex = close + 1;
    }
    out += wert.slice(i);
    out = recolor(out).replace(/\s+/g, ' ').trim();
    return out === '' ? 'none' : out;
  }

  // ── Bewegung ──
  const takte = (sek) => Math.max(2, Math.min(24, Math.round(sek * 24)));
  function dauern(text) { const out = []; const re = /(-?\d*\.?\d+)(ms|s)(?![\w-])/g; let m; while ((m = re.exec(text))) out.push(parseFloat(m[1]) / (m[2] === 'ms' ? 1000 : 1)); return out; }
  function bewegung(prop, wert) {
    if (/var\(|steps\(|step-/.test(wert)) return wert;
    const items = teile(wert, ',');
    const neu = items.map(it => {
      const d = dauern(it)[0];
      const n = takte(d == null ? 0.2 : d);
      const s = `steps(${n}, end)`;
      let t = it.replace(/cubic-bezier\([^)]*\)/g, s).replace(/(^|\s)(ease-in-out|ease-in|ease-out|ease|linear)(?=\s|$)/g, `$1${s}`);
      if (!/steps\(/.test(t) && (prop === 'transition' || prop === 'animation') && !/(^|\s)(none)(\s|$)/.test(t) && d != null) t = t.trim() + ' ' + s;
      return t;
    });
    return neu.join(',');
  }
  function bewegungTiming(wert) {
    if (/var\(|steps\(|step-/.test(wert)) return wert;
    return teile(wert, ',').map(() => 'steps(6, end)').join(',');
  }

  // ── Wert-Umwandlung je Eigenschaft ──
  /** Alle Farben deckend (Alpha gegen die Tinte gemischt). */
  function recolor(text) { return ersetzeFarben(text, (f) => (f.a === 0 ? 'transparent' : deckend(f))); }
  /** Farben mit Alpha in Hintergründen: ganz oder gar nicht. */
  function recolorBinaer(text) { return ersetzeFarben(text, (f) => (f.a < 0.5 ? 'transparent' : rein(f))); }
  const istRadius = (p) => /^(-webkit-|-moz-)?border(-[a-z]+)*-radius$/.test(p);
  /**
   * Wandelt eine CSS-Deklaration um.
   * @param ctx  { hatHintergrund: bool }  Block-Wissen: gibt es neben einer Hintergrundfarbe schon ein Hintergrundbild?
   * @returns { wert, extra:[[prop, wert]…] }
   */
  function deklaration(prop, wert, ctx) {
    const extra = [];
    ctx = ctx || {};
    const p = prop.toLowerCase();
    let v = wert;
    if (istRadius(p)) return { wert: '0', extra };
    if (p === 'backdrop-filter' || p === '-webkit-backdrop-filter') return { wert: 'none', extra };
    if (p === 'box-shadow' || (p.startsWith('--') && /schatten|shadow|glow|schein/.test(p))) return { wert: boxSchatten(v), extra };
    if (p === 'text-shadow') return { wert: textSchatten(v), extra };
    if (p === 'filter' || p === '-webkit-filter') return { wert: filterWert(v), extra };
    if (p === 'transition' || p === 'animation') return { wert: bewegung(p, v), extra };
    if (p === 'transition-timing-function' || p === 'animation-timing-function') return { wert: bewegungTiming(v), extra };
    if (p === 'background' || p === 'background-image') {
      v = verlaeufe(v);
      // reine Farbe mit Alpha → Raster
      const lone = ersteFarbe(v.trim());
      if (p === 'background' && lone && lone.text.length === v.trim().length && lone.f.a > 0 && lone.f.a < 0.88) {
        const st = alphaStufe(lone.f.a);
        if (st === 0) return { wert: 'transparent', extra };
        if (st < 4) return { wert: `${rasterBild(rein(lone.f), st)} 0 0 / ${RASTER_GROESSE}`, extra };
      }
      return { wert: recolorBinaer(v), extra };
    }
    if (p === 'background-color') {
      const lone = ersteFarbe(v.trim());
      if (lone && lone.text.length === v.trim().length && lone.f.a > 0 && lone.f.a < 0.88) {
        const st = alphaStufe(lone.f.a);
        if (st === 0) return { wert: 'transparent', extra };
        if (st < 4 && !ctx.hatHintergrund) {
          extra.push(['background-image', rasterBild(rein(lone.f), st)], ['background-size', RASTER_GROESSE]);
          return { wert: 'transparent', extra };
        }
        return { wert: st === 4 || lone.f.a >= 0.5 ? rein(lone.f) : 'transparent', extra };
      }
      return { wert: recolor(v), extra };
    }
    if (/^(color|border(-[a-z]+)*(-color)?|outline(-color)?|fill|stroke|stop-color|flood-color|caret-color|text-decoration(-color)?|accent-color|column-rule(-color)?|--.*)$/.test(p) || RE_TEST.test(v)) {
      RE_FARBE.lastIndex = 0;
      return { wert: recolor(v), extra };
    }
    return { wert: v, extra };
  }
  const RE_TEST = /#[0-9a-fA-F]{3}|rgb|hsl/;

  // ── Ganze Stylesheets ──
  /** Deklarationsliste („a: b; c: d") umwandeln; gibt den neuen Text zurück. */
  function deklarationen(body) {
    const teilen = teile(body, ';');
    const pars = teilen.map(raw => {
      const s = raw.trim(); if (!s) return null;
      const k = s.indexOf(':'); if (k < 0) return { raw };
      const prop = s.slice(0, k).trim();
      let wert = s.slice(k + 1).trim(); let imp = '';
      const m = /\s*!\s*important\s*$/i.exec(wert); if (m) { imp = ' !important'; wert = wert.slice(0, m.index); }
      return { prop, wert, imp };
    });
    const hatHintergrund = pars.some(d => d && d.prop && /^background(-image)?$/i.test(d.prop) && !/^\s*(none|transparent)\s*$/i.test(d.wert));
    const out = [];
    for (const d of pars) {
      if (!d) continue;
      if (!d.prop) { out.push(d.raw.trim()); continue; }
      const r = deklaration(d.prop, d.wert, { hatHintergrund });
      out.push(`${d.prop}: ${r.wert}${d.imp}`);
      for (const [ep, ev] of r.extra) out.push(`${ep}: ${ev}${d.imp}`);
    }
    return out.join('; ') + (out.length ? ';' : '');
  }
  /** Ein Stylesheet (CSS-Text) umwandeln. */
  function css(text) {
    let i = 0; const n = text.length;
    function liste(ende) {   // Regelliste bis zur schließenden '}' (oder Textende)
      let out = '', start = i;
      while (i < n) {
        const c = text[i];
        if (c === '/' && text[i + 1] === '*') { const e = text.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; continue; }
        if (c === '"' || c === "'") { i++; while (i < n && text[i] !== c) { if (text[i] === '\\') i++; i++; } i++; continue; }
        if (c === '(') { const e = klammerEnde(text, i); i = e < 0 ? n : e + 1; continue; }
        if (c === ';') { i++; out += text.slice(start, i); start = i; continue; }          // @import … ;
        if (c === '}') { if (ende) { out += text.slice(start, i); return out; } i++; continue; }
        if (c === '{') {
          const prelude = text.slice(start, i); out += prelude;
          i++;
          const at = /^\s*(?:\/\*[\s\S]*?\*\/\s*)*@([\w-]+)/.exec(prelude);
          const art = at ? at[1].toLowerCase() : '';
          if (art && /^(media|supports|layer|container|document|-moz-document|scope|starting-style)$/.test(art) || /keyframes$/.test(art)) {
            out += '{' + liste(true) + '}'; i++;                          // Regelliste (Kind-Regeln)
          } else if (art === 'font-face' || art === 'page' || art === 'property' || art === 'counter-style') {
            const e = i; let d = 1; while (i < n && d) { if (text[i] === '{') d++; else if (text[i] === '}') d--; i++; }
            out += '{' + text.slice(e, i - 1) + '}';
          } else {
            // Stil-Regel: Deklarationen (mit Rücksicht auf eventuell verschachtelte Regeln)
            const e = i; let d = 1, q = '';
            while (i < n && d) {
              const ch = text[i];
              if (q) { if (ch === q && text[i - 1] !== '\\') q = ''; i++; continue; }
              if (ch === '/' && text[i + 1] === '*') { const x = text.indexOf('*/', i + 2); i = x < 0 ? n : x + 2; continue; }
              if (ch === '"' || ch === "'") { q = ch; i++; continue; }
              if (ch === '(') { const x = klammerEnde(text, i); i = x < 0 ? n : x + 1; continue; }
              if (ch === '{') d++; else if (ch === '}') d--;
              i++;
            }
            const body = text.slice(e, i - 1);
            out += '{ ' + (body.includes('{') ? css(body) : deklarationen(stripKommentare(body))) + ' }';
          }
          start = i; continue;
        }
        i++;
      }
      return out + text.slice(start);
    }
    return liste(false);
  }
  const stripKommentare = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');

  /** Farben im Text auf die Retro-Palette rasten, Alpha bleibt (Canvas, Partikel). */
  const snapAlpha = (text) => ersetzeFarben(text, (f) => { const c = snap(f.r, f.g, f.b); return f.a >= 1 ? toHex(c) : `rgba(${c[0]},${c[1]},${c[2]},${zahl(f.a)})`; });

  const api = { RETRO, snapAlpha, recolor, snap, toHex, deckend, rein, css, deklaration, deklarationen, ersetzeFarben, rasterBild, RASTER_GROESSE, alphaStufe };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.PPRetroCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
