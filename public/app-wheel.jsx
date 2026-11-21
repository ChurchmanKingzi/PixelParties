// ═══════════════════════════════════════════════════════════════════════════
//  GLÜCKSRAD (Shop-Reiter „Wheel“): überzählige Karten einer Rarity einsetzen, je Karte fliegt ein Dartpfeil auf ein Board mit Gewinnfeldern.
//
//    window.WheelShop    Reiter: Rarity wählen → Galerie (Karten markieren) → Board wählen (3 je Rarity) → Bestätigung → Wurf → Ergebnis
//    window.ppWheelApi   { state(), cards(rarity), throw(body), ticket(rarity, card) } → { ok, status, data }
//
//  Server-Vertrag: wheel-api.js (alles Zufällige passiert dort). Tabellen/Quoten: wheel.js (window.PpWheel; hier nur Vorschau und Darstellung).
//
//  Grafik: alles Pixelart. Die Felder sind DOM (Text bleibt scharf und übersetzbar) mit abgetreppten Umrissen (clip-path in ganzen Rasterzellen),
//  kleinen Pixel-Symbolen (SVG, crispEdges) und – wo es passt – echter Kunst (Boosterpack, Kartenrücken, Beispielkarte).
//  Der Wurf läuft in EINER Leinwand (30 Hz über ppTaktRaf, ganzzahlige Rasterzelle S, feste Palette, Bayer-/Schachbrett-Dither statt Alpha,
//  keine Verläufe): Pfeile in Flugrichtung, Einschlag-Funken, Druckwelle, Board-Wackeln, Preis-Chips, die in die Preis-Leiste fliegen.
//  Alle Namen tragen das Präfix `wh` (alle Bundles teilen einen globalen Gültigkeitsbereich).
// ═══════════════════════════════════════════════════════════════════════════

const whRaf = (cb) => (window.ppTaktRaf || window.requestAnimationFrame)(cb);
const whT = (s) => (window.ppT ? window.ppT(s) : s);
const whRarityLabel = (r) => (window.PpRarities && window.PpRarities.LABEL && window.PpRarities.LABEL[r]) || r;
const whCardName = (n) => (window.PP_I18N && window.PP_I18N.names && window.PP_I18N.names[n]) || n;
const whRng = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const whHash = (str) => { let h = 0x811C9DC5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; };

window.ppWheelApi = (() => {
  async function call(path, opts) {
    const headers = { 'Content-Type': 'application/json' };
    try { if (window.ppFunnel) Object.assign(headers, window.ppFunnel.headers()); } catch (e) { /* ohne */ }
    if (window.AUTH_TOKEN) headers['x-auth-token'] = window.AUTH_TOKEN;
    const res = await fetch('/api' + path, { ...(opts || {}), headers });
    let data = null;
    try { data = await res.json(); } catch (e) { /* leer */ }
    return { ok: res.ok, status: res.status, data: data || {} };
  }
  return {
    state: () => call('/wheel/state'),
    cards: (rarity) => call('/wheel/cards?rarity=' + encodeURIComponent(rarity)),
    throw: (body) => call('/wheel/throw', { method: 'POST', body: JSON.stringify(body) }),
    ticket: (rarity, card) => call('/wheel/ticket', { method: 'POST', body: JSON.stringify({ rarity, card }) }),
  };
})();

// Rarity-Farben (Palette wird beim Zeichnen eingerastet)
const WH_RCOL = {
  uncommon: '#80bf59', rare: '#1ca9fd', prismatic: '#fc69c6', super: '#fad54a', storm: '#7fdfff', spectral: '#ac87de', stained: '#ff8566', umbra: '#b4cff8',
};

// ── Klänge ──────────────────────────────────────────────────────────────────
const WH_SOUNDS = ['projectile', 'placement', 'heavy_impact', 'pull_note', 'pull_sparkle', 'gold_gain', 'ascension', 'pull_shatter', 'elem_lightning', 'booster_burst',
  'ui_click', 'critical_strike', 'booster_ready', 'victory', 'shop_purchase'];
let _whWarm = false;
function whWarm() {
  if (_whWarm || !window.playSFX) return; _whWarm = true;
  WH_SOUNDS.forEach(n => { try { window.playSFX(n, { volume: 0, dedupe: 0 }); } catch (e) { /* ohne */ } });
}
const whPlay = (name, opt) => { try { if (window.playSFX) window.playSFX(name, { dedupe: 0, ...(opt || {}) }); } catch (e) { /* stumm */ } };

// ── Pixel-Symbole (Rasterbilder, Zeichenschlüssel s. WH_PAL) ─────────────────
const WH_PAL = { K: '#12101f', Y: '#fad54a', O: '#f29a3e', W: '#ffffff', R: '#e73b41', B: '#6d9bf8', G: '#4bcd7c', P: '#a159e9', S: '#a5b0c0', L: '#f7e0b5', N: '#9d612f', D: '#167927', C: '#7fdfff' };
const WH_ICONS = {
  coin: ['..KKKK..', '.KYYYYK.', 'KYYWWYOK', 'KYWYYYOK', 'KYWYYYOK', 'KYYYYOOK', '.KOOOOK.', '..KKKK..'],
  star: ['...KK...', '..KYYK..', 'KKKYWYKK', 'KYYYYYYK', '.KYYYYK.', '.KYYYYK.', 'KYYKKYYK', 'KKK..KKK'],
  dart: ['......KK', '.....KWK', '....KSK.', '...KSK..', '..KNK...', '.KRRK...', 'KRRK....', 'KK......'],
  clover: ['.KK..KK.', 'KGGKKGGK', 'KGWGGGGK', '.KGGGGK.', 'KGGGGGGK', 'KGGKKGGK', '.KK.KDK.', '.....KK.'],
  ticket: ['KKKKKKKK', 'KYYYYYYK', 'KYKKKKYK', 'KYKYYKYK', 'KYKYYKYK', 'KYKKKKYK', 'KYYYYYYK', 'KKKKKKKK'],
  head: ['..KKKK..', '.KLLLLK.', 'KLKLLKLK', 'KLLLLLLK', '.KLLLLK.', '..KBBK..', '.KBBBBK.', 'KBBBBBBK'],
  back: ['KKKKKKK.', 'KPPPPPK.', 'KPWPWPK.', 'KPPWPPK.', 'KPWPWPK.', 'KPPPPPK.', 'KKKKKKK.', '........'],
  sword: ['......KK', '.....KSK', '....KSK.', 'K..KSK..', 'KKKSK...', '.KKK....', 'KNK.....', 'KK......'],
  card: ['KKKKKK..', 'KWWWWK..', 'KWBBWK..', 'KWBYWK..', 'KWBBWK..', 'KWWWWK..', 'KKKKKK..', '........'],
  x: ['........', '.R....R.', '..R..R..', '...RR...', '...RR...', '..R..R..', '.R....R.', '........'],
};
function WhIcon({ name, px }) {
  const g = WH_ICONS[name]; if (!g) return null;
  const rects = [];
  g.forEach((row, y) => { let x = 0; while (x < row.length) { const c = row[x]; if (c === '.') { x++; continue; } let e = x; while (e < row.length && row[e] === c) e++; rects.push(<rect key={x + ':' + y} x={x} y={y} width={e - x} height={1} fill={WH_PAL[c]} />); x = e; } });
  return <svg className="wh-icon" width={g[0].length * px} height={g.length * px} viewBox={'0 0 ' + g[0].length + ' ' + g.length} shapeRendering="crispEdges" aria-hidden="true">{rects}</svg>;
}

// ── Felder: Anzeige je Preisart ─────────────────────────────────────────────
//  cls: Optik · rar: Rarity-Farbe · shape: Umriss · icon: Pixel-Symbol · tier: Wucht beim Einschlag (0 Nichts … 4 Jackpot)
function whFieldInfo(kind) {
  const W = window.PpWheel, v = W.valueOf(kind);
  const tier = kind === 'jackpot' ? 4 : v >= 30 ? 3 : v >= 8 ? 2 : v > 0 ? 1 : 0;
  const base = (o) => ({ tier, ...o });
  if (kind === 'none') return base({ cls: 'none', label: whT('Nothing'), icon: 'x', shape: 'none', desc: 'Nothing this time.' });
  if (kind.startsWith('card:')) { const r = kind.slice(5); return base({ cls: 'card', rar: r, label: whT(whRarityLabel(r)), sub: whT('Card'), icon: 'card', shape: 'tag', desc: 'A random card of this rarity.' }); }
  if (kind.startsWith('ticket:')) { const r = kind.slice(7), n = window.PpRarities.ORDER[window.PpRarities.rank(r) + 1]; return base({ cls: 'ticket', rar: n, label: whT('Ticket'), sub: whT(whRarityLabel(r)) + ' → ' + whT(whRarityLabel(n)), icon: 'ticket', shape: 'ticket', desc: 'Upgrades one free card to the next rarity.' }); }
  if (kind.startsWith('boost:')) return base({ cls: 'boost', label: whT('Luck Boost'), sub: kind.slice(6) === '1' ? 'S' : kind.slice(6) === '2' ? 'M' : 'L', icon: 'clover', shape: 'burst', desc: 'Covers lower prizes on the board with a better one for all remaining darts.' });
  const sc = { sc10: '10 SC', sc20: '20 SC', sc50: '50 SC' };
  if (sc[kind]) return base({ cls: 'coin', label: sc[kind], icon: 'coin', shape: 'coin', desc: 'Shop Coins.' });
  switch (kind) {
    case 'booster': return base({ cls: 'pack', label: whT('Booster Pack'), shape: 'pack', desc: 'A random Booster Pack.' });
    case 'golden': return base({ cls: 'golden', label: whT('Golden Pack'), icon: 'star', shape: 'pack', desc: 'A Booster Pack from the whole card pool, every card 1 to 2 rarities higher.' });
    case 'jackpot': return base({ cls: 'jackpot', label: whT('JACKPOT'), icon: 'star', shape: 'burst', desc: 'A pack of nine Umbra cards!' });
    case 'avatar': return base({ cls: 'cos', label: whT('Avatar'), icon: 'head', shape: 'tag', desc: 'A random avatar. A duplicate upgrades its frame.' });
    case 'sleeve': return base({ cls: 'cos', label: whT('Sleeve'), icon: 'back', shape: 'tag', desc: 'A random card sleeve. A duplicate upgrades its frame.' });
    case 'skin': return base({ cls: 'cos', label: whT('Skin'), icon: 'sword', shape: 'tag', desc: 'A random hero skin. A duplicate upgrades its frame.' });
    case 'spin3': return base({ cls: 'spin', label: whT('+3 Darts'), icon: 'dart', shape: 'arrow', desc: 'Three extra darts, thrown right after your paid ones.' });
    default: return base({ cls: 'none', label: kind, shape: 'none', desc: '' });
  }
}
const whPct = (p) => (p >= 10 ? p.toFixed(0) : p >= 1 ? p.toFixed(1) : p.toFixed(2)) + '%';
const WH_FCOL = { none: '#3e3e51', card: '#1ca9fd', ticket: '#f7e0b5', coin: '#fad54a', pack: '#4580f6', golden: '#fad54a', jackpot: '#e73b41', cos: '#c98aff', spin: '#f29a3e', boost: '#68fdc1' };
const whColorOf = (kind) => { const f = whFieldInfo(kind); return f.rar ? WH_RCOL[f.rar] : (WH_FCOL[f.cls] || '#ffffff'); };

// ── Layout: Treemap (quadratische Streifen) auf das Raster, mit Zufall ─────
const WH_BW = 160, WH_BH = 100, WH_BARH = 34, WH_GAP = 5, WH_M = 6;   // Board, Preis-Leiste, Abstand, Leinwand-Rand (Rasterzellen)
function whSquarify(items, x, y, w, h, out, rnd) {
  items = items.slice();
  const total = items.reduce((s, i) => s + i.a, 0);
  if (!items.length || total <= 0) return;
  const scale = (w * h) / total;
  items.forEach(i => { i.s = i.a * scale; });
  const worst = (row, side) => {
    const s = row.reduce((a, i) => a + i.s, 0);
    let mx = 0, mn = Infinity;
    for (const i of row) { mx = Math.max(mx, i.s); mn = Math.min(mn, i.s); }
    return Math.max((side * side * mx) / (s * s), (s * s) / (side * side * mn));
  };
  while (items.length) {
    const side = Math.min(w, h);
    const row = [items.shift()];
    while (items.length && worst(row.concat(items[0]), side) <= worst(row, side)) row.push(items.shift());
    const rs = row.reduce((a, i) => a + i.s, 0);
    const vertical = w > h * 1.15 ? true : h > w * 1.15 ? false : rnd() < 0.5;   // fast quadratisch: Richtung würfeln (chaotischer)
    if (vertical) {
      const cw = rs / h; let cy = y;
      for (const i of row) { const ch = i.s / cw; out[i.k] = { x, y: cy, w: cw, h: ch }; cy += ch; }
      x += cw; w -= cw;
    } else {
      const rh = rs / w; let cx = x;
      for (const i of row) { const cw2 = i.s / rh; out[i.k] = { x: cx, y, w: cw2, h: rh }; cx += cw2; }
      y += rh; h -= rh;
    }
  }
}
function whLayout(table, seed) {
  const rnd = whRng(seed);
  const keys = Object.keys(table).filter(k => table[k] > 0);
  // Fläche ∝ Wahrscheinlichkeit^0,8 (milde Stauchung, damit auch seltene Zettel lesbar bleiben); die genauen Chancen stehen in der Liste
  const items = keys.map(k => { const a = Math.pow(Math.max(table[k], 0.16), 0.8); return { k, a, o: a * (0.55 + 0.9 * rnd()) }; }).sort((a, b) => b.o - a.o);
  // „Nichts“ darf höchstens ~35 % der Fläche belegen (sonst wirkt das Board leer; die echte Chance steht in der Liste und im Tooltip)
  const none = items.find(i => i.k === 'none');
  if (none) { const others = items.reduce((a, i) => a + (i === none ? 0 : i.a), 0); none.a = Math.min(none.a, others * 0.55); none.o = Math.min(none.o, none.a * 1.45); items.sort((a, b) => b.o - a.o); }
  const raw = {};
  whSquarify(items, 0, 0, WH_BW, WH_BH, raw, rnd);
  const flipX = rnd() < 0.5, flipY = rnd() < 0.5;
  const out = {};
  for (const k of keys) {
    const r = raw[k]; if (!r) continue;
    let x = Math.round(r.x), y = Math.round(r.y), x2 = Math.round(r.x + r.w), y2 = Math.round(r.y + r.h);
    if (flipX) { const nx = WH_BW - x2, nx2 = WH_BW - x; x = nx; x2 = nx2; }
    if (flipY) { const ny = WH_BH - y2, ny2 = WH_BH - y; y = ny; y2 = ny2; }
    out[k] = { x, y, w: Math.max(4, x2 - x), h: Math.max(4, y2 - y) };
  }
  return out;
}

// Umrisse in ganzen Rasterzellen (S = Zellgröße in px, w/h in Zellen); liefert eine clip-path-Polygonliste
function whClip(shape, w, h, S) {
  const W = w * S, H = h * S, P = (pts) => 'polygon(' + pts.map(p => p[0] + 'px ' + p[1] + 'px').join(',') + ')';
  const s = S;
  switch (shape) {
    case 'tag': return P([[s, 0], [W - s, 0], [W, s], [W, H - s], [W - s, H], [s, H], [0, H - s], [0, s]]);
    case 'coin': { const c = Math.min(3, Math.floor(Math.min(w, h) / 3)) * s; return P([[c, 0], [W - c, 0], [W, c], [W, H - c], [W - c, H], [c, H], [0, H - c], [0, c]]); }
    case 'ticket': { const n = Math.min(3, Math.floor(h / 4)) * s, m1 = Math.floor(H / 3 / s) * s, m2 = Math.floor(2 * H / 3 / s) * s; return P([[0, 0], [W, 0], [W, m1], [W - n, m1], [W - n, m2], [W, m2], [W, H], [0, H], [0, m2], [n, m2], [n, m1], [0, m1]]); }
    case 'arrow': { const t = Math.min(w - 2, Math.floor(h / 2)) * s; return P([[0, 0], [W - t, 0], [W, H / 2], [W - t, H], [0, H]]); }
    case 'pack': {   // gezackte Siegelkanten oben und unten
      const pts = [], step = 2 * s, tooth = s;
      const n = Math.max(2, Math.floor(W / step));
      for (let i = 0; i <= n; i++) pts.push([Math.round(i * W / n), i % 2 ? 0 : tooth]);
      for (let i = n; i >= 0; i--) pts.push([Math.round(i * W / n), H - (i % 2 ? 0 : tooth)]);
      return P(pts);
    }
    case 'burst': {   // gezackter Stern-Rand (abgetreppt)
      const pts = [], n = Math.max(6, Math.floor((w + h) / 3)), t = Math.max(1, Math.min(2, Math.floor(Math.min(w, h) / 6))) * s;
      for (let i = 0; i < n; i++) pts.push([Math.round(i * W / n / s) * s, i % 2 ? 0 : t]);
      for (let i = 0; i < n; i++) pts.push([i % 2 ? W : W - t, Math.round(i * H / n / s) * s]);
      for (let i = n; i > 0; i--) pts.push([Math.round(i * W / n / s) * s, H - (i % 2 ? 0 : t)]);
      for (let i = n; i > 0; i--) pts.push([i % 2 ? 0 : t, Math.round(i * H / n / s) * s]);
      return P(pts);
    }
    default: return null;
  }
}

// Dart-Pixel entlang einer Richtung (dx, dy) – ganzzahlig: 0 Spitze, 1–3 Schaft, 4–6 Federn (3 breit)
const WH_DCOL = { tip: '#ffffff', shaft: '#9d612f', fea: '#e94e53', fea2: '#9d342f' };
function whDartCells(dx, dy) {
  const l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l, px = -uy, py = ux, out = [];
  for (let j = 0; j <= 6; j++) {
    const x = Math.round(-ux * j), y = Math.round(-uy * j);
    if (j === 0) out.push([x, y, 'tip']); else if (j <= 3) out.push([x, y, 'shaft']);
    else { out.push([x, y, 'fea']); out.push([x + Math.round(px), y + Math.round(py), 'fea2']); out.push([x - Math.round(px), y - Math.round(py), 'fea2']); }
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
//  Tooltip (große Vorschau): Karten-Rarity als Karte in groß, sonst Symbol + Beschreibung
// ═══════════════════════════════════════════════════════════════════════════
function WhBigCard({ name, rarity }) {
  const hostRef = useRef(null);
  useEffect(() => {
    const F = window.PpRarityFx;
    if (!hostRef.current || !F || (F.available && !F.available(rarity))) return undefined;
    let h = null;
    try { h = F.attach(hostRef.current, { card: (window.CARDS_BY_NAME && window.CARDS_BY_NAME[name]) || { name }, rarity, animated: true }); } catch (e) { h = null; }
    return () => { try { h && h.destroy && h.destroy(); } catch (e) { /* ohne */ } };
  }, [name, rarity]);
  return (
    <div className="bp-sc-face wh-bigface" ref={hostRef} data-pp-px="aus">
      <img src={bpCardUrl(name, rarity)} alt={name} draggable={false} />
    </div>
  );
}
function WhTip({ tip }) {
  if (!tip) return null;
  // Höhe grob schätzen (große Karte 5:7 + Text) und so setzen, dass der Tooltip neben dem Zeiger sitzt und im Fenster bleibt
  const Wd = 300, Ht = tip.card ? Wd * 1.4 + 120 : 290;
  let x = tip.x + 24; if (x + Wd > window.innerWidth - 8) x = tip.x - Wd - 24;
  const y = Math.max(8, Math.min(window.innerHeight - Ht - 8, tip.y - Ht * 0.35));
  const f = tip.info;
  return (
    <div className="wh-tip" style={{ left: Math.max(8, x), top: y, '--whc': f.rarColor || '#fad54a' }}>
      {tip.card ? <WhBigCard name={tip.card.name} rarity={tip.card.rarity} /> : (
        <div className="wh-tip-art">{tip.art ? <img src={tip.art} alt="" draggable={false} data-pp-px="aus" /> : <WhIcon name={f.icon || 'x'} px={10} />}</div>
      )}
      <div className="wh-tip-name">{tip.card && tip.card.name ? whCardName(tip.card.name) : f.label}</div>
      <div className="wh-tip-sub">{tip.card ? whT(whRarityLabel(tip.card.rarity)) + (tip.sample ? ' · ' + whT('example') : '') : (f.sub || '')}</div>
      {f.desc && <div className="wh-tip-desc">{whT(f.desc)}</div>}
      {tip.pct != null && <div className="wh-tip-pct">{whT('Chance per dart') + ': ' + whPct(tip.pct)}</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  Board (Felder, Deko, Leinwand, Preis-Leiste); `play` startet den Wurf
// ═══════════════════════════════════════════════════════════════════════════
function whArtFor(kind, art, seed) {
  // Bildmaterial je Feld: Booster-Kunst, Kartenrücken, Beispielkarte
  if (!art) return null;
  if (kind === 'booster' || kind === 'golden' || kind === 'jackpot') return art.packs && art.packs.length ? art.packs[(seed + (kind === 'booster' ? 0 : kind === 'golden' ? 1 : 2)) % art.packs.length] : null;
  if (kind === 'sleeve') return '/cardback.png';
  if (kind.startsWith('card:') && art.samples && art.samples[kind.slice(5)]) return bpCardUrl(art.samples[kind.slice(5)], kind.slice(5));
  return null;
}
// Boost-Überdeckungen: je Boost ein Zettel über dem größten niedrigeren Feld (Größe ∝ umgeschichtete Wahrscheinlichkeit)
function whSpecsUpTo(arrows, uptoI) {
  const specs = [];
  for (const a of arrows) { if (a.i > uptoI) break; if (a.kind.startsWith('boost:') && a.spec) specs.push(a.spec); }
  return specs;
}
function whOverlayRects(specs, table, layout, W) {
  const out = []; if (!specs.length) return out;
  let t = table;
  const hostKey = layout.none ? 'none' : Object.keys(layout).sort((a, b) => layout[b].w * layout[b].h - layout[a].w * layout[a].h)[0];
  const host = layout[hostKey]; let slot = 0;
  for (const spec of specs) {
    const eff = W.applyBoosts(t, [spec]);
    const moved = Math.max(0.05, (eff[spec.make] || 0) - (t[spec.make] || 0));
    const area = Math.max(20, Math.round(moved / 100 * WH_BW * WH_BH));
    const w = Math.max(10, Math.min(host.w - 4, Math.round(Math.sqrt(area * 1.8)))), h = Math.max(7, Math.min(host.h - 4, Math.round(area / w)));
    const x = host.x + 2 + ((slot * 11) % Math.max(1, host.w - w - 3)), y = host.y + 2 + ((slot * 7) % Math.max(1, host.h - h - 3));
    out.push({ make: spec.make, x, y, w, h }); slot++; t = eff;
  }
  return out;
}
function whTargetRect(a, layout, overlayRects) {
  if (a.boosted && overlayRects && overlayRects.length) {
    for (let i = overlayRects.length - 1; i >= 0; i--) if (overlayRects[i].make === a.kind) return overlayRects[i];
  }
  return layout[a.kind] || layout.none || { x: 0, y: 0, w: WH_BW, h: WH_BH };
}

function WhBoard({ rarity, boardData, play, small, art, onTip }) {
  const stageRef = useRef(null), fxRef = useRef(null), decoRef = useRef(null), fieldRefs = useRef({});
  const [S, setS] = useState(3);
  const table = boardData.table;
  const seed = useMemo(() => whHash(rarity + ':' + boardData.id), [rarity, boardData.id]);
  const layout = useMemo(() => whLayout(table, seed), [table, seed]);
  const [counts, setCounts] = useState({});
  const [overlays, setOverlays] = useState([]);
  const [rail, setRail] = useState([]);
  const [pops, setPops] = useState([]);
  const [banner, setBanner] = useState(null);
  const [shake, setShake] = useState([0, 0]);
  const finishRef = useRef(null);
  finishRef.current = play && play.onFinish;

  useEffect(() => {
    const fit = () => {
      const el = stageRef.current && stageRef.current.parentNode; if (!el) return;
      const w = el.clientWidth || 640;
      const cap = small ? 3 : 8;
      // beim Wurf soll das ganze Bild (Board + Preis-Leiste) auf den Bildschirm passen: Höhe begrenzt die Rasterzelle ebenfalls
      const byH = play ? Math.floor((window.innerHeight - 250) / (WH_BH + WH_GAP + WH_BARH)) : 99;
      setS(Math.max(2, Math.min(cap, Math.floor((w - 24) / WH_BW), byH)));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [small, !!play]);

  // Deko-Ebene (einmal gezeichnet): Kork-Sprenkel + roter Faden · Kreide-Kritzeleien · Konfetti
  useEffect(() => {
    const cv = decoRef.current; if (!cv) return;
    const ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false; ctx.clearRect(0, 0, cv.width, cv.height);
    const rnd = whRng(seed ^ 0x5bd1e995), id = boardData.id;
    const cell = (x, y, c) => { ctx.fillStyle = c; ctx.fillRect(x * S, y * S, S, S); };
    const line = (x0, y0, x1, y1, c) => { const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx - dy; for (;;) { cell(x0, y0, c); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 > -dy) { e -= dy; x0 += sx; } if (e2 < dx) { e += dx; y0 += sy; } } };
    const speck = id === 'A' ? ['#6e4421', '#ca874e', '#5a341a'] : id === 'B' ? ['#1a4128', '#0f2412', '#686868'] : ['#58238c', '#1a0a3a', '#f8b4df'];
    for (let i = 0; i < 700; i++) cell(Math.floor(rnd() * WH_BW), Math.floor(rnd() * WH_BH), speck[i % speck.length]);
    const keys = Object.keys(layout);
    const pin = (k) => { const r = layout[k]; return [r.x + Math.floor(r.w / 2), r.y]; };
    if (id === 'A') {         // roter Faden zwischen zufälligen Pins
      for (let i = 0; i < 5; i++) { const a = pin(keys[Math.floor(rnd() * keys.length)]), b = pin(keys[Math.floor(rnd() * keys.length)]); line(a[0], a[1], b[0], b[1], '#b21a29'); }
    } else if (id === 'B') {  // Kreide: Sterne, Pfeile, Kreuze
      for (let i = 0; i < 22; i++) { const x = 2 + Math.floor(rnd() * (WH_BW - 6)), y = 2 + Math.floor(rnd() * (WH_BH - 6)), c = '#e6e6e6'; const t = i % 3; if (t === 0) { cell(x, y, c); cell(x - 1, y, c); cell(x + 1, y, c); cell(x, y - 1, c); cell(x, y + 1, c); } else if (t === 1) { line(x, y, x + 4, y, c); line(x + 4, y, x + 2, y - 2, c); line(x + 4, y, x + 2, y + 2, c); } else { line(x, y, x + 3, y + 3, c); line(x + 3, y, x, y + 3, c); } }
    } else {                  // Konfetti
      const cols = ['#fe5154', '#fad54a', '#1ca9fd', '#68fdc1', '#fc69c6'];
      for (let i = 0; i < 110; i++) { const x = Math.floor(rnd() * (WH_BW - 2)), y = Math.floor(rnd() * (WH_BH - 2)), c = cols[i % cols.length]; cell(x, y, c); if (i % 3 === 0) cell(x + 1, y, c); }
    }
  }, [S, layout, seed, boardData.id]);

  // ── Wurf-Animation ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!play || !fxRef.current) return undefined;
    whWarm();
    const cv = fxRef.current, ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const M = WH_M, CWc = WH_BW + 2 * M, CHc = M + WH_BH + WH_GAP + WH_BARH + M;
    const arrows = play.arrows, Wz = window.PpWheel;
    const paid = arrows.filter(a => !a.bonus), bonus = arrows.filter(a => a.bonus);
    const rnd = whRng(Date.now() & 0xffffff);
    const stuck = document.createElement('canvas'); stuck.width = CWc * S; stuck.height = CHc * S;
    const sctx = stuck.getContext('2d'); sctx.imageSmoothingEnabled = false;
    const cell = (c, x, y, col) => { c.fillStyle = col; c.fillRect((x + M) * S, (y + M) * S, S, S); };

    // Zeitplan (Bilder à 33 ms): erst gemächlich (jeder Pfeil bekommt seinen Auftritt), dann schneller; bei großen Einsätzen mehrere Pfeile je Bild
    const FLY = 11, gapOf = (i, base) => Math.max(0.3, base * Math.pow(0.955, i));
    const specsSoFar = []; let ovNow = [];
    const starts = new Array(arrows.length);
    let t = 6;
    paid.forEach((a, i) => { starts[a.i] = Math.round(t); t += gapOf(i, 6); });
    const bonusAt = Math.round(t) + FLY + 18;
    t = bonusAt;
    bonus.forEach((a, i) => { starts[a.i] = Math.round(t); t += gapOf(i, 5); });
    const sched = arrows.map((a, i) => {
      const rect = whTargetRect(a, layout, ovNow);
      if (a.kind.startsWith('boost:') && a.spec) { specsSoFar.push(a.spec); ovNow = whOverlayRects(specsSoFar, table, layout, Wz); }
      const h1 = whRng(i * 7919 + 13)(), h2 = whRng(i * 104729 + 7)();
      const tx = rect.x + 1 + Math.floor(h1 * Math.max(1, rect.w - 3)), ty = rect.y + 2 + Math.floor(h2 * Math.max(1, rect.h - 5));
      const side = i % 3, sx = side === 0 ? -6 : side === 1 ? WH_BW + 6 : Math.floor(WH_BW / 2 + (h2 - 0.5) * 40), sy = WH_BH + 2 + Math.floor(h1 * 3);
      const info = whFieldInfo(a.kind);
      return { a, i, start: starts[i], land: starts[i] + FLY, tx, ty, sx, sy, kind: a.kind, info, tier: info.tier, col: whColorOf(a.kind) };
    });
    const lastLand = sched.reduce((m, s) => Math.max(m, s.land), 0);
    const byStart = {}, byLand = {};
    sched.forEach(s => { (byStart[s.start] = byStart[s.start] || []).push(s); (byLand[s.land] = byLand[s.land] || []).push(s); });

    const cnt = {}, railMap = {}, railOrder = [];
    let frame = 0, raf = 0, done = false, combo = 0, lastHit = -99, shakeT = 0, shakeA = 0, flashT = 0, bestTier = 0, popId = 0, dirty = false, railDirty = false;
    const parts = [], rings = [], chips = [];
    let sfxBudget = 0;
    const sfx = (name, o) => { if (sfxBudget > 5) return; sfxBudget++; whPlay(name, o); };
    let lastPop = -99;
    const addPop = (x, y, text, col, big) => { if (!big && frame - lastPop < 7) return; lastPop = frame; const id = ++popId; setPops(p => p.slice(-4).concat({ id, x, y, text, col })); setTimeout(() => setPops(p => p.filter(q => q.id !== id)), 1000); };
    const slotKey = (s) => { const p = s.a.prize; if (s.kind.startsWith('card:') && p) return 'c:' + p.name + '|' + p.rarity; if ((s.kind === 'avatar' || s.kind === 'sleeve' || s.kind === 'skin') && p && p.id) return s.kind + ':' + p.id; return s.kind; };

    const burst = (s, n, speed) => {
      for (let k = 0; k < n && parts.length < 420; k++) {
        const ang = rnd() * Math.PI * 2, sp = (0.4 + rnd() * speed);
        parts.push({ x: s.tx, y: s.ty, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 0.5 * speed * 0.5, life: 8 + Math.floor(rnd() * 10), c: rnd() < 0.5 ? s.col : '#ffffff' });
      }
    };
    const stickDart = (s) => { for (const [dx, dy, tp] of whDartCells(s.tx - s.sx, s.ty - s.sy)) if (tp !== 'tip') cell(sctx, s.tx + dx, s.ty + dy, WH_DCOL[tp]); };
    const arrive = (ch) => {
      const key = ch.key; let slot = railMap[key];
      if (!slot) { slot = railMap[key] = { key, kind: ch.s.kind, prize: ch.s.a.prize || null, n: 0 }; railOrder.push(key); }
      slot.n++; railDirty = true;
      if (ch.t0 != null) sfx('ui_click', { volume: 0.28, rate: Math.min(2, 1 + Math.min(14, railOrder.length) * 0.04 + rnd() * 0.1), dedupe: 40 });
    };
    const land = (s) => {
      stickDart(s);
      cnt[s.kind] = (cnt[s.kind] || 0) + 1; dirty = true;
      const el = fieldRefs.current[s.kind];
      if (s.tier >= 1 && el && (arrows.length <= 80 || s.tier >= 2)) { el.classList.remove('wh-flash'); void el.offsetWidth; el.classList.add('wh-flash'); setTimeout(() => el.classList.remove('wh-flash'), 260); }
      if (s.tier === 0) { burst(s, 3, 0.6); sfx('placement', { volume: 0.32, rate: 0.85 + rnd() * 0.3, dedupe: 35 }); return; }
      // Treffer: schnelle Folgetreffer erhöhen die Tonhöhe (Combo)
      combo = frame - lastHit <= 22 ? Math.min(combo + 1, 14) : 0; lastHit = frame;
      bestTier = Math.max(bestTier, s.tier);
      const rate = Math.min(1.9, 0.9 + combo * 0.07);
      burst(s, 6 + s.tier * 6, 1.1 + s.tier * 0.5);
      rings.push({ x: s.tx, y: s.ty, r: 1, max: 4 + s.tier * 4, c: s.col, t: 0 });
      if (s.tier >= 2 || arrows.length <= 40) addPop(s.tx, s.ty, (s.kind.startsWith('sc') ? '+' : '') + s.info.label + (s.tier >= 3 ? '!' : ''), s.col, s.tier === 4);
      if (s.kind === 'spin3') sfx('booster_burst', { volume: 0.7, rate: 1.1 });
      else if (s.kind.startsWith('boost:')) { sfx('elem_lightning', { volume: 0.7 }); flashT = Math.max(flashT, 2); }
      else if (s.kind === 'jackpot') { sfx('pull_shatter', { volume: 1 }); sfx('ascension', { volume: 1 }); sfx('heavy_impact', { volume: 1 }); }
      else if (s.kind.startsWith('sc')) sfx('gold_gain', { volume: 0.55, rate });
      else { sfx('pull_note', { volume: 0.5, rate, dedupe: 30 }); if (s.tier >= 2) sfx('pull_sparkle', { volume: 0.55, rate: 0.9 + s.tier * 0.1, dedupe: 90 }); }
      if (s.tier >= 3) { sfx('heavy_impact', { volume: 0.7, dedupe: 120 }); sfx('critical_strike', { volume: 0.45, dedupe: 200 }); if (s.tier === 3) sfx('ascension', { volume: 0.5, dedupe: 800 }); }
      if (s.tier >= 3) { shakeT = Math.max(shakeT, 5 + s.tier * 2); shakeA = Math.max(shakeA, s.tier === 4 ? 3 : 2); }
      else if (s.tier === 2) { shakeT = Math.max(shakeT, 3); shakeA = Math.max(shakeA, 1); }
      if (s.tier === 4) flashT = 4;
      if (s.kind.startsWith('boost:') && s.a.spec) setOverlays(whOverlayRects(whSpecsUpTo(arrows, s.a.i), table, layout, Wz));
      // Chip fliegt in die Preis-Leiste (begrenzt, sonst kommt er sofort an)
      if (chips.length < 70) chips.push({ s, t0: frame + 3, dur: 13 + Math.floor(rnd() * 4), x0: s.tx, y0: s.ty, key: slotKey(s) });
      else arrive({ s, key: slotKey(s) });
    };
    const slotTarget = (key) => {
      const host = stageRef.current;
      const n = railOrder.length, per = Math.max(1, Math.floor((WH_BW - 4) / 11));
      const fallback = [4 + (n % per) * 11 + 5, WH_BH + WH_GAP + 4 + Math.floor(n / per) * 15 + 6];
      if (!host) return fallback;
      let el = null;
      try { el = host.querySelector('[data-slot="' + key.replace(/(["\\])/g, '\\$1') + '"]'); } catch (e) { el = null; }
      if (!el) return fallback;
      const r = el.getBoundingClientRect(), hr = host.getBoundingClientRect();
      return [(r.left + r.width / 2 - hr.left) / S, (r.top + r.height / 2 - hr.top) / S];
    };

    const finish = () => {
      if (done) return; done = true;
      for (const s of sched) if (s.land >= frame) {
        stickDart(s);
        cnt[s.kind] = (cnt[s.kind] || 0) + 1;
        if (s.tier >= 1) arrive({ s, key: slotKey(s) });
        bestTier = Math.max(bestTier, s.tier);
      }
      for (const ch of chips) arrive({ s: ch.s, key: ch.key });   // unterwegs befindliche Chips zählen sofort
      chips.length = 0;
      setCounts({ ...cnt }); setRail(railOrder.map(k => railMap[k]));
      setOverlays(whOverlayRects(whSpecsUpTo(arrows, Infinity), table, layout, Wz));
      draw(true); setShake([0, 0]);
      setBanner(bestTier >= 4 ? 'JACKPOT!!!' : bestTier === 3 ? 'BIG WIN!' : bestTier === 2 ? 'NICE!' : null);
      if (bestTier >= 3) whPlay('victory', { volume: 0.6 }); else if (bestTier === 2) whPlay('booster_ready', { volume: 0.6 });
      setTimeout(() => setBanner(null), 2200);
      if (finishRef.current) finishRef.current();
    };
    play.skipRef && (play.skipRef.current = finish);

    const draw = (final) => {
      ctx.clearRect(0, 0, cv.width, cv.height);
      // Rahmen-Lampen (nur Jahrmarkt-Board): abwechselnd im Takt
      if (boardData.id === 'C') {
        const ph = (frame >> 3) & 1;
        for (let x = -3; x <= WH_BW + 2; x += 4) for (const y of [-3, WH_BH + 2]) { ctx.fillStyle = ((x >> 2) & 1) === ph ? '#f7f7ad' : '#8b5b04'; ctx.fillRect((x + M) * S, (y + M) * S, S * 2, S * 2); }
        for (let y = 1; y <= WH_BH - 2; y += 4) for (const x of [-3, WH_BW + 2]) { ctx.fillStyle = ((y >> 2) & 1) === ph ? '#f7f7ad' : '#8b5b04'; ctx.fillRect((x + M) * S, (y + M) * S, S * 2, S * 2); }
      }
      ctx.drawImage(stuck, 0, 0);
      if (final) return;
      // fliegende Pfeile (in Flugrichtung) mit Schweif
      for (const s of sched) {
        if (frame < s.start || frame > s.land) continue;
        const p = (frame - s.start) / FLY, e = 1 - Math.pow(1 - p, 2.2);
        const x = Math.round(s.sx + (s.tx - s.sx) * e), y = Math.round(s.sy + (s.ty - s.sy) * e - Math.sin(Math.PI * p) * 7);
        const p2 = Math.max(0, p - 0.12), e2 = 1 - Math.pow(1 - p2, 2.2), x2 = s.sx + (s.tx - s.sx) * e2, y2 = s.sy + (s.ty - s.sy) * e2 - Math.sin(Math.PI * p2) * 7;
        const dx = x - x2, dy = y - y2;
        for (let k = 1; k <= 3; k++) { if ((k + frame) % 2) continue; cell(ctx, Math.round(x - dx * k * 1.6), Math.round(y - dy * k * 1.6) + 4, '#e5edfa'); }
        for (const [ox, oy, tp] of whDartCells(dx || 0.01, dy || -1)) cell(ctx, x + ox, y + oy, WH_DCOL[tp]);
      }
      for (const q of parts) cell(ctx, Math.round(q.x), Math.round(q.y), q.life % 3 === 0 ? '#ffffff' : q.c);
      // Druckwellen (Rahmen aus Zellen im Schachbrett-Dither)
      for (const r of rings) {
        const R = Math.round(r.r);
        for (let k = -R; k <= R; k++) for (const [x, y] of [[k, -R], [k, R], [-R, k], [R, k]]) if (((x + y + r.t) & 1) === 0) cell(ctx, Math.round(r.x + x), Math.round(r.y + y), r.c);
      }
      // Preis-Chips
      for (const ch of chips) {
        if (frame < ch.t0) continue;
        const p = Math.min(1, (frame - ch.t0) / ch.dur), e = p * p * (3 - 2 * p), tgt = ch.tgt || (ch.tgt = slotTarget(ch.key));
        const x = Math.round(ch.x0 + (tgt[0] - ch.x0) * e), y = Math.round(ch.y0 + (tgt[1] - ch.y0) * e - Math.sin(Math.PI * p) * 10);
        for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) cell(ctx, x + a, y + b, (a === -1 && b === -1) || (a === 0 && b === 0) ? '#ffffff' : ch.s.col);
        for (const [a, b] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) cell(ctx, x + a, y + b, '#12101f');
      }
      // Vollbild-Blitz (Jackpot/Boost): Schachbrett aus Weiß
      if (flashT > 0) { ctx.fillStyle = '#ffffff'; for (let y = 0; y < WH_BH; y++) for (let x = (y + frame) & 1; x < WH_BW; x += 2) ctx.fillRect((x + M) * S, (y + M) * S, S, S); }
    };

    const tick = () => {
      if (done) return;
      sfxBudget = 0;
      for (const s of byStart[frame] || []) if (paid.length <= 60 || (s.i % 3) === 0) whPlay('projectile', { volume: 0.3, rate: 0.9 + rnd() * 0.4, dedupe: 28 });
      for (const s of byLand[frame] || []) land(s);
      for (let i = parts.length - 1; i >= 0; i--) { const q = parts[i]; q.x += q.vx; q.y += q.vy; q.vy += 0.16; q.life--; if (q.life <= 0) parts.splice(i, 1); }
      for (let i = rings.length - 1; i >= 0; i--) { const r = rings[i]; r.r += 0.9; r.t++; if (r.r > r.max) rings.splice(i, 1); }
      for (let i = chips.length - 1; i >= 0; i--) { const ch = chips[i]; if (frame >= ch.t0 + ch.dur) { chips.splice(i, 1); arrive(ch); } }
      if (shakeT > 0) { shakeT--; setShake([Math.round((rnd() - 0.5) * 2 * shakeA) * S, Math.round((rnd() - 0.5) * 2 * shakeA) * S]); if (shakeT === 0) { shakeA = 0; setShake([0, 0]); } }
      if (flashT > 0) flashT--;
      if (dirty) { dirty = false; setCounts({ ...cnt }); }
      if (railDirty) { railDirty = false; setRail(railOrder.map(k => railMap[k])); }
      draw(false);
      if (frame > lastLand + 24 && !chips.length && !parts.length) { finish(); return; }
      frame++;
      raf = whRaf(tick);
    };
    raf = whRaf(tick);
    return () => { done = true; try { window.cancelAnimationFrame(raf); } catch (e) { /* ohne */ } };
  }, [play, S, layout]);   // eslint-disable-line

  const fields = Object.keys(layout);
  const sz = (n) => n * S;
  const showTip = (e, kind, extra) => {
    if (!onTip) return;
    const f = whFieldInfo(kind), sample = kind.startsWith('card:') && art && art.samples ? art.samples[kind.slice(5)] : null;
    onTip({ x: e.clientX, y: e.clientY, info: { ...f, rarColor: f.rar ? WH_RCOL[f.rar] : null }, pct: table[kind], card: sample ? { name: sample, rarity: kind.slice(5) } : null, sample: !!sample, art: whArtFor(kind, art, seed), ...(extra || {}) });
  };
  const stageStyle = { width: sz(WH_BW), '--whs': S + 'px', transform: shake[0] || shake[1] ? 'translate(' + shake[0] + 'px,' + shake[1] + 'px)' : undefined, height: play ? sz(WH_BH + WH_GAP + WH_BARH) : sz(WH_BH) };
  return (
    <div className={'wh-stage' + (small ? ' wh-stage-small' : '')} ref={stageRef} style={stageStyle}>
      <div className={'wh-board wh-theme-' + boardData.id} style={{ width: sz(WH_BW), height: sz(WH_BH) }}>
        <canvas ref={decoRef} className="wh-deco" width={sz(WH_BW)} height={sz(WH_BH)} />
        {fields.map(k => {
          const r = layout[k], f = whFieldInfo(k), artUrl = whArtFor(k, art, seed), rar = f.rar ? WH_RCOL[f.rar] : null;
          const clip = whClip(f.shape, r.w - 2, r.h - 2, S);
          const lblFs = Math.min(2.8, (r.w - 4) / (Math.max(...f.label.split(' ').map(w => w.length)) * 1.0));
          const showLbl = lblFs >= 1.5 && r.h >= 7;
          const showIcon = !artUrl && f.icon && r.w >= 9 && r.h >= (showLbl ? 13 : 9), px = Math.max(1, Math.min(4, Math.floor(Math.min(r.w - 4, r.h - (showLbl ? 8 : 4)) / 9)));
          return (
            <div key={k} ref={el => { fieldRefs.current[k] = el; }} className={'wh-note wh-n-' + f.cls + ' wh-sh-' + f.shape} style={{ left: sz(r.x + 1), top: sz(r.y + 1), width: sz(r.w - 2), height: sz(r.h - 2), ...(rar ? { '--whc': rar } : {}) }}
                 onMouseEnter={(e) => showTip(e, k)} onMouseMove={(e) => showTip(e, k)} onMouseLeave={() => onTip && onTip(null)}>
              <div className="wh-body" style={clip ? { clipPath: clip } : undefined}>
                {artUrl && <img className={'wh-art wh-art-' + f.cls} src={artUrl} alt="" draggable={false} data-pp-px="aus" />}
                {(f.cls === 'golden' || f.cls === 'jackpot') && <span className="wh-dither" />}
                {showIcon && <WhIcon name={f.icon} px={px} />}
                {showLbl && <span className="wh-lbl" style={{ fontSize: 'calc(var(--whs) * ' + lblFs.toFixed(2) + ')' }}>{f.label}</span>}
                {showLbl && f.sub && r.h >= 12 && r.w >= 16 && <span className="wh-sub">{f.sub}</span>}
              </div>
              {k !== 'none' && <span className="wh-pin" />}
              {counts[k] > 0 && <span className="wh-cnt">{'×' + counts[k]}</span>}
            </div>
          );
        })}
        {overlays.map((o, i) => (
          <div key={'o' + i} className="wh-note wh-n-boost-cover wh-sh-tag" style={{ left: sz(o.x), top: sz(o.y), width: sz(o.w), height: sz(o.h), ...(whFieldInfo(o.make).rar ? { '--whc': WH_RCOL[whFieldInfo(o.make).rar] } : {}) }}>
            <div className={'wh-body wh-n-' + whFieldInfo(o.make).cls} style={{ clipPath: whClip('tag', o.w, o.h, S) }}>
              <span className="wh-lbl" style={{ fontSize: 'calc(var(--whs) * 2.2)' }}>{whFieldInfo(o.make).label}</span>
            </div>
          </div>
        ))}
      </div>
      {play && (
        <div className="wh-rail" style={{ top: sz(WH_BH + WH_GAP), height: sz(WH_BARH), width: sz(WH_BW) }}>
          {rail.length === 0 && <span className="wh-rail-empty">{whT('Your prizes land here')}</span>}
          {rail.map(sl => {
            const f = whFieldInfo(sl.kind), p = sl.prize;
            const isCard = sl.kind.startsWith('card:') && p;
            const img = isCard ? bpCardUrl(p.name, p.rarity) : (p && p.src) || (p && sl.kind === 'skin' && p.id ? '/cards/skins/' + encodeURIComponent(p.id) + '.png' : null) || whArtFor(sl.kind, art, seed);
            const extra = isCard ? { card: { name: p.name, rarity: p.rarity }, sample: false, pct: null } : { pct: null };
            const text = isCard ? whCardName(p.name) : (sl.kind === 'skin' && p && p.id ? p.id : (p && p.label) || f.label);
            return (
              <div key={sl.key} className={'wh-slot wh-slot-' + f.cls} data-slot={sl.key} style={{ '--whc': f.rar ? WH_RCOL[f.rar] : (isCard ? WH_RCOL[p.rarity] : WH_FCOL[f.cls]) }}
                   onMouseEnter={(e) => showTip(e, sl.kind, extra)} onMouseMove={(e) => showTip(e, sl.kind, extra)} onMouseLeave={() => onTip && onTip(null)}>
                {img ? <img src={img} alt="" draggable={false} data-pp-px="aus" /> : <WhIcon name={f.icon || 'x'} px={3} />}
                <span className="wh-slot-lbl">{text}</span>
                <b key={sl.n} className="wh-slot-n">{'×' + sl.n}</b>
              </div>
            );
          })}
        </div>
      )}
      {play && <canvas ref={fxRef} className="wh-fx" width={sz(WH_BW + 2 * WH_M)} height={sz(WH_M + WH_BH + WH_GAP + WH_BARH + WH_M)} style={{ left: -sz(WH_M), top: -sz(WH_M) }} />}
      {pops.map(q => <span key={q.id} className="wh-pop" style={{ left: sz(q.x), top: sz(q.y), color: q.col }}>{q.text}</span>)}
      {banner && <div className="wh-banner">{whT(banner)}</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  Schritt 1: Rarity wählen
// ═══════════════════════════════════════════════════════════════════════════
function WhRarityPick({ state, onPick, onTicket }) {
  const tix = Object.keys(state.tickets || {}).filter(r => state.tickets[r] > 0);
  return (
    <div className="wh-step">
      <p className="wh-intro">Trade in cards you do not need: every card you stake is one dart on the board. Pick a rarity.</p>
      <div className="wh-rar-grid">
        {window.PpWheel.INPUT_RARITIES.map(r => {
          const info = state.rarities[r] || { total: 0, free: 0 }, off = info.free < 1;
          return (
            <button key={r} className={'wh-rar' + (off ? ' wh-rar-off' : '')} disabled={off} onClick={() => onPick(r)} style={{ '--whc': WH_RCOL[r] }}>
              <span className="wh-rar-name">{whRarityLabel(r)}</span>
              <span className="wh-rar-count">{info.free}</span>
              <span className="wh-rar-sub">{info.total > info.free ? window.ppT('{0} free · {1} in decks').replace('{0}', info.free).replace('{1}', info.total - info.free) : whT('cards owned')}</span>
            </button>
          );
        })}
      </div>
      {tix.length > 0 && (
        <div className="wh-tickets">
          <h3>Your tickets</h3>
          <p className="wh-hint">A ticket upgrades one free card to the next rarity.</p>
          <div className="wh-ticket-row">
            {tix.map(r => {
              const f = whFieldInfo('ticket:' + r);
              return <button key={r} className="wh-ticket" style={{ '--whc': WH_RCOL[f.rar] }} onClick={() => onTicket(r)}>
                <span className="wh-ticket-n">{'×' + state.tickets[r]}</span><span>{f.sub}</span><span className="wh-ticket-use">Use</span></button>;
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  Schritt 2: Galerie (jede Kopie ein Bild; markieren/abwählen). Beide Leisten bleiben beim Scrollen oben angepinnt.
//  Leistung: Kacheln sind React.memo (nur die geklickte zeichnet neu), ein Klick-Handler am Container (Ereignis-Delegation).
// ═══════════════════════════════════════════════════════════════════════════
const WhTile = React.memo(function WhTile({ k, name, rarity, locked, selected }) {
  return (
    <button className={'wh-tile' + (selected ? ' wh-tile-sel' : '') + (locked ? ' wh-tile-lock' : '')} data-k={k} data-locked={locked ? '1' : ''}>
      <img src={bpCardUrl(name, rarity)} alt={name} loading="lazy" decoding="async" draggable={false} />
      {selected && <span className="wh-tick">✓</span>}
      {locked && <span className="wh-lock">DECK</span>}
    </button>
  );
});
function WhGallery({ rarity, mode, onBack, onGo, notify }) {
  const [cards, setCards] = useState(null);
  const [sel, setSel] = useState(() => new Set());     // Schlüssel "<Name>#<k>"
  const [typeF, setTypeF] = useState(''), [subF, setSubF] = useState(''), [q, setQ] = useState('');
  const single = mode === 'ticket';
  useEffect(() => {
    let live = true;
    window.ppWheelApi.cards(rarity).then(r => { if (!live) return; if (r.ok) setCards(r.data.cards || []); else { notify(r.data.error || whT('Failed to load cards'), 'error'); setCards([]); } });
    return () => { live = false; };
  }, [rarity]);   // eslint-disable-line
  const CB = window.CARDS_BY_NAME || {};
  const tiles = useMemo(() => {
    const out = [];
    for (const c of cards || []) for (let k = 0; k < c.total; k++) out.push({ key: c.name + '#' + k, name: c.name, locked: k >= c.free, ql: (c.name + ' ' + whCardName(c.name)).toLowerCase(), type: (CB[c.name] || {}).cardType, sub: (CB[c.name] || {}).subtype });
    out.sort((a, b) => whCardName(a.name).localeCompare(whCardName(b.name)) || (a.locked - b.locked) || a.key.localeCompare(b.key));
    return out;
  }, [cards]);   // eslint-disable-line
  const types = useMemo(() => [...new Set(tiles.map(t => t.type).filter(Boolean))].sort(), [tiles]);
  const subs = useMemo(() => [...new Set(tiles.filter(t => !typeF || t.type === typeF).map(t => t.sub).filter(Boolean))].sort(), [tiles, typeF]);
  const shown = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return tiles.filter(t => (!typeF || t.type === typeF) && (!subF || t.sub === subF) && (!ql || t.ql.includes(ql)));
  }, [tiles, typeF, subF, q]);
  const max = single ? 1 : window.PpWheel.MAX_STAKE;
  const toggle = useCallback((key) => {
    setSel(prev => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key);
      else { if (single) n.clear(); if (n.size >= max) { notify(window.ppT('You can stake at most {0} cards at once.').replace('{0}', max), 'error'); return prev; } n.add(key); }
      return n;
    });
  }, [single, max]);   // eslint-disable-line
  const onGridClick = useCallback((e) => {
    const b = e.target.closest && e.target.closest('.wh-tile'); if (!b || b.dataset.locked) return;
    toggle(b.dataset.k);
  }, [toggle]);
  // Alle Duplikate: je Karte so viele freie Kopien, dass genau eine übrig bleibt (Kopien in Decks zählen als übrig)
  const selectDupes = () => {
    const keys = [];
    for (const c of cards || []) { const from = c.total - c.free >= 1 ? 0 : 1; for (let k = from; k < c.free; k++) keys.push(c.name + '#' + k); }
    if (!keys.length) { notify(whT('No duplicates to select.'), 'error'); return; }
    if (keys.length > max) notify(window.ppT('You can stake at most {0} cards at once.').replace('{0}', max), 'error');
    setSel(new Set(keys.slice(0, max)));
  };
  const selectShown = () => setSel(prev => { const n = new Set(prev); for (const t of shown) { if (n.size >= max) break; if (!t.locked) n.add(t.key); } return n; });
  const go = () => {
    const m = {}; for (const k of sel) { const name = k.slice(0, k.lastIndexOf('#')); m[name] = (m[name] || 0) + 1; }
    onGo(m, sel.size);
  };
  return (
    <div className="wh-step wh-gallery">
      <div className="wh-sticky">
        <div className="wh-bar">
          <button className="btn" onClick={onBack}>← Back</button>
          <h3 className="wh-title" style={{ color: WH_RCOL[rarity] }}>{whRarityLabel(rarity)}</h3>
          <div style={{ flex: 1 }} />
          <span className="wh-selcount">{window.ppT('Selected: {0}').replace('{0}', sel.size)}</span>
          <button className="btn btn-primary wh-go" disabled={sel.size < 1} onClick={go}>{single ? 'Upgrade!' : 'Go!'}</button>
        </div>
        <div className="wh-filters">
          <select value={typeF} onChange={e => { setTypeF(e.target.value); setSubF(''); }}>
            <option value="">All types</option>
            {types.map(t => <option key={t} value={t}>{whT(t)}</option>)}
          </select>
          <select value={subF} onChange={e => setSubF(e.target.value)}>
            <option value="">All subtypes</option>
            {subs.map(t => <option key={t} value={t}>{whT(t)}</option>)}
          </select>
          <input type="text" value={q} placeholder={whT('Search name…')} onChange={e => setQ(e.target.value)} />
          {!single && <button className="btn" onClick={selectShown}>Select shown</button>}
          {!single && <button className="btn" onClick={selectDupes} title={whT('Selects every duplicate so that exactly one copy of each card stays.')}>Select all duplicates</button>}
          {sel.size > 0 && <button className="btn" onClick={() => setSel(new Set())}>Clear</button>}
        </div>
      </div>
      {cards === null ? <div className="wh-hint">Loading…</div> : (
        <div className="wh-tiles" onClick={onGridClick}>
          {shown.map(t => <WhTile key={t.key} k={t.key} name={t.name} rarity={rarity} locked={t.locked} selected={sel.has(t.key)} />)}
          {!shown.length && <div className="wh-hint">No cards match.</div>}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  Schritt 3: Board wählen + Bestätigung
// ═══════════════════════════════════════════════════════════════════════════
const WH_BOARD_TEXT = {
  A: { name: 'Cork Board', desc: 'Balanced: a little of everything.' },
  B: { name: 'Chalk Board', desc: 'More cards, less coins and cosmetics.' },
  C: { name: 'Carnival Board', desc: 'More cosmetics and coins, fewer cards.' },
};
function WhBoardPick({ rarity, stakeN, state, art, onBack, onThrow, busy }) {
  const [pick, setPick] = useState(null);
  const boards = state.boards[rarity];
  const chosen = boards.find(b => b.id === pick);
  return (
    <div className="wh-step">
      <div className="wh-bar">
        <button className="btn" onClick={onBack} disabled={busy}>← Back</button>
        <h3 className="wh-title" style={{ color: WH_RCOL[rarity] }}>{whRarityLabel(rarity)}</h3>
        <span className="wh-selcount">{window.ppT(stakeN === 1 ? '{0} dart' : '{0} darts').replace('{0}', stakeN)}</span>
      </div>
      <p className="wh-intro">Choose a board. All three are fair: the prizes are the same, only the odds are shaped differently.</p>
      <div className="wh-pick-grid">
        {boards.map(b => {
          const none = b.table.none || 0;
          return (
            <button key={b.id} className={'wh-pick' + (pick === b.id ? ' wh-pick-sel' : '')} onClick={() => setPick(b.id)}>
              <div className="wh-pick-prev"><WhBoard rarity={rarity} boardData={b} small art={art} /></div>
              <div className="wh-pick-name">{whT(WH_BOARD_TEXT[b.id].name)}</div>
              <div className="wh-pick-desc">{whT(WH_BOARD_TEXT[b.id].desc)}</div>
              <div className="wh-pick-odds">{window.ppT('Nothing {0}').replace('{0}', whPct(none))}</div>
            </button>
          );
        })}
      </div>
      {chosen && (
        <div className="wh-odds">
          <h4>{window.ppT('{0} — odds per dart').replace('{0}', whT(WH_BOARD_TEXT[chosen.id].name))}</h4>
          <div className="wh-odds-list">
            {Object.keys(chosen.table).sort((a, b) => chosen.table[b] - chosen.table[a]).map(k => {
              const f = whFieldInfo(k);
              return <div key={k} className="wh-odds-row"><span>{f.label + (f.sub && f.cls !== 'boost' ? ' (' + f.sub + ')' : '')}</span><span>{whPct(chosen.table[k])}</span></div>;
            })}
          </div>
        </div>
      )}
      <div className="wh-confirm">
        <button className="btn btn-primary wh-go" disabled={!pick || busy} onClick={() => onThrow(pick)}>
          {busy ? 'Throwing…' : window.ppT(stakeN === 1 ? 'Throw {0} dart!' : 'Throw {0} darts!').replace('{0}', stakeN)}
        </button>
        {!pick && <span className="wh-hint">Pick a board first.</span>}
        {pick && <span className="wh-hint">The staked cards leave your collection for good.</span>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  Schritt 4: Wurf + Ergebnis
// ═══════════════════════════════════════════════════════════════════════════
function whSc(k) { return window.PpWheel.SC_AMOUNT[k] || 0; }
function WhResult({ result, onAgain, onMore, onPacks }) {
  const cos = [], packs = [];
  let sc = 0, nothing = 0, spins = 0, cardsN = 0; const tix = {};
  for (const a of result.arrows) {
    const k = a.kind, p = a.prize;
    if (k === 'none') nothing++;
    else if (k === 'spin3') spins++;
    else if (k.startsWith('card:')) cardsN++;
    else if (k.startsWith('ticket:')) tix[k.slice(7)] = (tix[k.slice(7)] || 0) + 1;
    else if (whSc(k)) sc += whSc(k);
    else if (k === 'booster' || k === 'golden' || k === 'jackpot') packs.push(k);
    else if (p && (k === 'avatar' || k === 'sleeve' || k === 'skin')) { if (p.maxed) sc += p.amount; else cos.push(p); }
  }
  const frameName = (d) => { const i = window.ppRankFrames ? window.ppRankFrames.rankOf(d) : null; return i == null ? 'Frame ' + d : window.ppRankFrames.RANKS[i].name + ' Frame'; };
  return (
    <div className="wh-result">
      <h3>Results</h3>
      <div className="wh-res-stats">
        <span>{window.ppT('Darts: {0}').replace('{0}', result.arrows.length)}</span>
        <span>{window.ppT('Nothing: {0}').replace('{0}', nothing)}</span>
        {cardsN > 0 && <span>{window.ppT('Cards: {0}').replace('{0}', cardsN)}</span>}
        {sc > 0 && <span className="wh-gold">{'+' + sc + ' SC'}</span>}
        {spins > 0 && <span>{whT('+3 Darts') + ' ×' + spins}</span>}
        {Object.keys(tix).map(r => <span key={r}>{whFieldInfo('ticket:' + r).label + ' ' + whFieldInfo('ticket:' + r).sub + ' ×' + tix[r]}</span>)}
      </div>
      {packs.length > 0 && (
        <div className="wh-res-packs">
          <span>{[
            packs.filter(p => p === 'booster').length > 0 ? window.ppT('{0} Booster Pack(s)').replace('{0}', packs.filter(p => p === 'booster').length) : '',
            packs.filter(p => p === 'golden').length > 0 ? window.ppT('{0} Golden Pack(s)').replace('{0}', packs.filter(p => p === 'golden').length) : '',
            packs.filter(p => p === 'jackpot').length > 0 ? whT('JACKPOT PACK!') : '',
          ].filter(Boolean).join(' · ')}</span>
          <button className="btn btn-primary" onClick={onPacks}>Open packs</button>
        </div>
      )}
      {cos.length > 0 && (
        <div className="wh-res-cos">
          {cos.map((c, i) => (
            <div key={i} className="wh-cos">
              <img src={c.kind === 'skin' ? '/cards/skins/' + encodeURIComponent(c.id) + '.png' : c.src} alt="" draggable={false} data-pp-px="aus" />
              <span>{c.kind === 'skin' ? c.id : (c.label || c.id)}</span>
              <span className="wh-gold">{c.isNew ? 'New!' : frameName(c.dupes)}</span>
            </div>
          ))}
        </div>
      )}
      <div className="wh-confirm">
        <button className="btn btn-primary wh-go" onClick={onMore}>Throw more!</button>
        <button className="btn" onClick={onAgain}>Back to rarities</button>
      </div>
    </div>
  );
}

function WhPlay({ rarity, board, result, art, onAgain, onMore, onPacks, onTip }) {
  const [finished, setFinished] = useState(false);
  const skipRef = useRef(null);
  const play = useMemo(() => {
    // Boost-Treffern ihre Spezifikation mitgeben (Größe/Preis des Überdeckungs-Zettels)
    const specs = board.boosts || {};
    const arrows = result.arrows.map(a => (a.kind.startsWith('boost:') ? { ...a, spec: specs[a.kind] } : a));
    return { arrows, onFinish: () => setFinished(true), skipRef };
  }, [result]);   // eslint-disable-line
  return (
    <div className="wh-step wh-play">
      <div className="wh-bar">
        <h3 className="wh-title" style={{ color: WH_RCOL[rarity] }}>{whT(WH_BOARD_TEXT[board.id].name)}</h3>
        <div style={{ flex: 1 }} />
        {!finished && <button className="btn" onClick={() => skipRef.current && skipRef.current()}>Skip</button>}
      </div>
      <div className="wh-board-wrap"><WhBoard rarity={rarity} boardData={board} play={play} art={art} onTip={onTip} /></div>
      {finished && <WhResult result={result} onAgain={onAgain} onMore={onMore} onPacks={onPacks} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  Reiter
// ═══════════════════════════════════════════════════════════════════════════
function WheelShop({ sc, onSc, notify, onPacks }) {
  const [state, setState] = useState(null);
  const [view, setView] = useState('rarity');          // rarity | gallery | board | play
  const [rarity, setRarity] = useState(null);
  const [mode, setMode] = useState('throw');           // throw | ticket
  const [stake, setStake] = useState(null);            // { cards: {name: n}, n }
  const [busy, setBusy] = useState(false);
  const [played, setPlayed] = useState(null);          // { id, board, result }
  const [packArt, setPackArt] = useState([]);
  const [tip, setTip] = useState(null);
  const load = () => window.ppWheelApi.state().then(r => { if (r.ok) setState(r.data); else notify(r.data.error || whT('Failed to load wheel'), 'error'); });
  useEffect(() => {
    load(); whWarm();
    window.ppBoosterApi.list().then(r => { if (r.ok && r.data && r.data.packs) setPackArt(r.data.packs.map(p => (p.variants && p.variants[0] ? bpAsset(p.variants[0].base) : null)).filter(Boolean)); });
  }, []);   // eslint-disable-line
  if (!state) return <div className="wh-hint" style={{ padding: 40 }}>Loading…</div>;
  const art = { samples: state.samples || {}, packs: packArt };

  const toRarities = () => { setView('rarity'); setStake(null); setPlayed(null); setMode('throw'); setTip(null); load(); };
  const toMore = () => { setStake(null); setPlayed(null); setMode('throw'); setTip(null); load(); setView('gallery'); };
  const throwIt = async (boardId) => {
    if (busy) return; setBusy(true);
    try {
      const r = await window.ppWheelApi.throw({ rarity, board: boardId, cards: stake.cards });
      if (!r.ok) { notify((r.data && r.data.error) || whT('Throw failed'), 'error'); setBusy(false); return; }
      if (r.data.sc != null) onSc(r.data.sc);
      whPlay('shop_purchase', { volume: 0.5 });
      setPlayed({ id: Date.now(), board: state.boards[rarity].find(b => b.id === boardId), result: r.data });
      setView('play');
    } catch (e) { notify(e.message, 'error'); }
    setBusy(false);
  };
  const openPacks = async () => {
    const r = await window.ppBoosterApi.pending();
    const list = r.ok && r.data && (r.data.packs && r.data.packs.length ? r.data.packs : (r.data.pending ? [r.data.pending] : null));
    if (list && onPacks) onPacks(list); else notify(whT('No packs to open.'), 'error');
  };
  const useTicket = async (cards) => {
    const name = Object.keys(cards)[0];
    const r = await window.ppWheelApi.ticket(rarity, name);
    if (!r.ok) { notify((r.data && r.data.error) || whT('Ticket failed'), 'error'); return; }
    notify(whCardName(name) + ' → ' + whRarityLabel(r.data.to) + '!', 'success');
    toRarities();
  };

  return (
    <div className="wh-root">
      {view === 'rarity' && <WhRarityPick state={state} onPick={(r) => { setRarity(r); setMode('throw'); setView('gallery'); }} onTicket={(r) => { setRarity(r); setMode('ticket'); setView('gallery'); }} />}
      {view === 'gallery' && <WhGallery key={rarity + mode} rarity={rarity} mode={mode} notify={notify} onBack={toRarities}
        onGo={(cards, n) => { if (mode === 'ticket') useTicket(cards); else { setStake({ cards, n }); setView('board'); } }} />}
      {view === 'board' && stake && <WhBoardPick rarity={rarity} stakeN={stake.n} state={state} art={art} busy={busy} onBack={() => setView('gallery')} onThrow={throwIt} />}
      {view === 'play' && played && <WhPlay key={played.id} rarity={rarity} board={played.board} result={played.result} art={art} onAgain={toRarities} onMore={toMore} onPacks={openPacks} onTip={setTip} />}
      <WhTip tip={tip} />
    </div>
  );
}
window.WheelShop = WheelShop;
