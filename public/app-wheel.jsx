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
  'ui_click', 'critical_strike', 'booster_ready', 'victory', 'shop_purchase', 'pull_swell', 'pull_reveal'];
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
  smile: ['..KKKK..', '.KYYYYK.', 'KYKYYKYK', 'KYYYYYYK', 'KYKYYKYK', 'KYYKKYYK', '.KYYYYK.', '..KKKK..'],
  scroll: ['KKKKKKK.', 'KLLLLLLK', '.KLKKLLK', '.KLLLLLK', '.KLKKKLK', '.KLLLLLK', 'KKLLLLKK', '..KKKKK.'],
  x: ['........', '.R....R.', '..R..R..', '...RR...', '...RR...', '..R..R..', '.R....R.', '........'],
};
function WhIcon({ name, px, grid, pal }) {
  const g = grid || WH_ICONS[name]; if (!g) return null;
  const P = pal ? { ...WH_PAL, ...pal } : WH_PAL;
  const rects = [];
  g.forEach((row, y) => { let x = 0; while (x < row.length) { const c = row[x]; if (c === '.') { x++; continue; } let e = x; while (e < row.length && row[e] === c) e++; rects.push(<rect key={x + ':' + y} x={x} y={y} width={e - x} height={1} fill={P[c]} />); x = e; } });
  return <svg className="wh-icon" width={g[0].length * px} height={g.length * px} viewBox={'0 0 ' + g[0].length + ' ' + g.length} shapeRendering="crispEdges" aria-hidden="true">{rects}</svg>;
}

// Ticket-Sprite (20 × 11 Zellen): goldenes Billett, links die Farbe der Ausgangs-Rarity, rechts die der neuen, in der Mitte ein Stern, Perforation dazwischen
function whTicketGrid() {
  const W = 20, H = 11, g = Array.from({ length: H }, () => Array(W).fill('.'));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const corner = (y === 0 || y === H - 1) && (x === 0 || x === W - 1);
    if (corner) continue;
    g[y][x] = (y === 0 || y === H - 1 || x === 0 || x === W - 1) ? 'K' : 'Y';
  }
  for (let y = 2; y <= 8; y++) { for (let x = 2; x <= 5; x++) g[y][x] = 'A'; for (let x = 14; x <= 17; x++) g[y][x] = 'B'; }
  for (let y = 1; y <= 9; y++) { g[y][6] = y % 2 ? 'O' : 'Y'; g[y][13] = y % 2 ? 'O' : 'Y'; }
  const star = ['..W..', '.WWW.', 'WWWWW', '.WWW.', '.W.W.'];
  star.forEach((row, j) => [...row].forEach((c, i) => { if (c === 'W') g[3 + j][7 + i] = 'W'; }));
  for (let x = 1; x < W - 1; x++) if (g[9][x] === 'Y') g[9][x] = 'O';   // Schattenkante unten
  return g.map(r => r.join(''));
}
const WH_TICKET_GRID = whTicketGrid();
/** Ticket von `from` auf die nächsthöhere Rarity (Farben der beiden Hälften). */
function WhTicket({ from, px }) {
  const next = window.PpRarities.ORDER[window.PpRarities.rank(from) + 1];
  return <WhIcon grid={WH_TICKET_GRID} px={px} pal={{ A: WH_RCOL[from] || '#a5b0c0', B: WH_RCOL[next] || '#ffffff' }} />;
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
  if (sc[kind]) return base({ cls: 'coin', label: sc[kind], icon: 'coin', shape: 'coin', desc: 'Smug Coins.' });
  switch (kind) {
    case 'booster': return base({ cls: 'pack', label: whT('Booster Pack'), shape: 'pack', desc: 'A random Booster Pack.' });
    case 'golden': return base({ cls: 'golden', label: whT('Golden Pack'), icon: 'star', shape: 'pack', desc: 'A Booster Pack from the whole card pool, every card 1 to 2 rarities higher.' });
    case 'jackpot': return base({ cls: 'jackpot', label: whT('JACKPOT'), icon: 'star', shape: 'burst', desc: 'A pack of nine Umbra cards!' });
    case 'avatar': return base({ cls: 'cos', label: whT('Avatar'), icon: 'head', shape: 'tag', desc: 'A random avatar. A duplicate upgrades its frame.' });
    case 'sleeve': return base({ cls: 'cos', label: whT('Sleeve'), icon: 'back', shape: 'tag', desc: 'A random card sleeve. A duplicate upgrades its frame.' });
    case 'skin': return base({ cls: 'cos', label: whT('Skin'), icon: 'sword', shape: 'tag', desc: 'A random hero skin. A duplicate upgrades its frame.' });
    case 'emote': return base({ cls: 'cos', label: whT('Emote'), icon: 'smile', shape: 'tag', desc: 'A random emote for use in duels.' });
    case 'title': return base({ cls: 'cos', label: whT('Title'), icon: 'scroll', shape: 'tag', desc: 'A random title shown next to your name.' });
    case 'spin3': return base({ cls: 'spin', label: whT('+3 Darts'), icon: 'dart', shape: 'arrow', desc: 'Three extra darts, thrown right after your paid ones.' });
    default: return base({ cls: 'none', label: kind, shape: 'none', desc: '' });
  }
}
const whPct = (p) => (p >= 10 ? p.toFixed(0) : p >= 1 ? p.toFixed(1) : p.toFixed(2)) + '%';
const WH_FCOL = { none: '#3e3e51', card: '#1ca9fd', ticket: '#f7e0b5', coin: '#fad54a', pack: '#4580f6', golden: '#fad54a', jackpot: '#e73b41', cos: '#c98aff', spin: '#f29a3e', boost: '#68fdc1' };
const whColorOf = (kind) => { const f = whFieldInfo(kind); return f.rar ? WH_RCOL[f.rar] : (WH_FCOL[f.cls] || '#ffffff'); };

// ── Layout: Treemap (quadratische Streifen) auf das Raster, mit Zufall ─────
const WH_HEAD = 12;   // Kopfleiste des Boards (Wimpelkette · Kreide-Titel · Zeltdach), die Preisfelder liegen darunter
const WH_FR = 5;      // Rahmenstärke in Rasterzellen
const WH_BW0 = 160, WH_BW_MAX = 300;   // Boardbreite in Zellen: mindestens 160, bei viel Platz bis 300 (Breite = Bildschirm)
const WH_BH = 100, WH_BARH = 30, WH_GAP = 7, WH_M = 8;   // Board, Preis-Leiste, Abstand, Leinwand-Rand (Rasterzellen)
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
function whLayout(table, seed, BW) {
  const rnd = whRng(seed);
  const keys = Object.keys(table).filter(k => table[k] > 0);
  // Fläche ∝ Wahrscheinlichkeit^0,8 (milde Stauchung, damit auch seltene Zettel lesbar bleiben); die genauen Chancen stehen in der Liste
  let items = keys.map(k => { const a = Math.pow(Math.max(table[k], 0.16), 0.8); return { k, id: k, a, o: a * (0.55 + 0.9 * rnd()) }; });
  // „Nichts“ darf höchstens ~35 % der Fläche belegen und ist auf mehrere TASCHEN zwischen den Zetteln verteilt (die größte heißt 'none', die übrigen 'none#1' …)
  const none = items.find(i => i.k === 'none');
  if (none) {
    const others = items.reduce((a, i) => a + (i === none ? 0 : i.a), 0), total = Math.min(none.a, others * 0.55);
    const n = BW >= 230 ? 7 : BW >= 190 ? 6 : 5, w = Array.from({ length: n }, (_, i) => (i === 0 ? 2.2 : 0.6 + rnd() * 0.9)), ws = w.reduce((a, b) => a + b, 0);
    items = items.filter(i => i !== none).concat(w.map((x, i) => { const a = Math.max(0.5, total * x / ws); return { k: 'none', id: i === 0 ? 'none' : 'none#' + i, a, o: a * (0.7 + 0.8 * rnd()) }; }));
  }
  items.sort((a, b) => b.o - a.o);
  const raw = {};
  const RH = WH_BH - WH_HEAD;
  whSquarify(items.map(i => ({ ...i, k: i.id })), 0, 0, BW, RH, raw, rnd);
  const flipX = rnd() < 0.5, flipY = rnd() < 0.5;
  const out = {};
  for (const it of items) {
    const r = raw[it.id]; if (!r) continue;
    let x = Math.round(r.x), y = Math.round(r.y), x2 = Math.round(r.x + r.w), y2 = Math.round(r.y + r.h);
    if (flipX) { const nx = BW - x2, nx2 = BW - x; x = nx; x2 = nx2; }
    if (flipY) { const ny = RH - y2, ny2 = RH - y; y = ny; y2 = ny2; }
    // Chaos: jedes Feld füllt seine Zelle nur zu 78–100 %, sitzt versetzt darin, ragt manchmal über den Nachbarn und hängt leicht schief (Neigung nur bei Zetteln, nicht bei „Nichts“)
    const isNone = it.k === 'none', cw = Math.max(4, x2 - x - 2), ch = Math.max(4, y2 - y - 2);
    let w2 = Math.max(4, Math.floor(cw * (isNone ? 1 : 0.78 + 0.22 * rnd()))), h2 = Math.max(4, Math.floor(ch * (isNone ? 1 : 0.78 + 0.22 * rnd())));
    let ox = Math.floor((cw - w2) * rnd()), oy = Math.floor((ch - h2) * rnd());
    if (!isNone && rnd() < 0.2) { const g = 2 + Math.floor(rnd() * 3); w2 += g; h2 += Math.floor(g / 2); ox -= Math.floor(g / 2); }
    const small = w2 * h2 < 320;
    out[it.id] = { x: x + 1 + ox, y: y + 1 + oy + WH_HEAD, w: w2, h: h2, rot: isNone ? 0 : Math.round((rnd() - 0.5) * (small ? 16 : 7) * 10) / 10, z: 1 + Math.floor(rnd() * 3) };
  }
  return out;
}
const whIsNone = (id) => id === 'none' || id.startsWith('none#');

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
  const ref = useRef(null);
  const [h, setH] = useState(0);
  useLayoutEffect(() => { if (ref.current) { const nh = ref.current.offsetHeight; if (nh !== h) setH(nh); } });
  if (!tip) return null;
  const Wd = 300, Ht = h || (tip.card ? Wd * 1.4 + 120 : 440);
  let x = tip.x + 24; if (x + Wd > window.innerWidth - 8) x = tip.x - Wd - 24;
  const y = Math.max(8, Math.min(window.innerHeight - Ht - 8, tip.y - Ht * 0.35));
  const f = tip.info;
  const isTicket = f.cls === 'ticket' && tip.ticketFrom;
  return (
    <div className="wh-tip" ref={ref} style={{ left: Math.max(8, x), top: y, '--whc': f.rarColor || '#fad54a' }}>
      {tip.card ? <WhBigCard name={tip.card.name} rarity={tip.card.rarity} /> : tip.titleId ? (
        <div className="wh-tip-art wh-tip-title">{window.PpTitle && <window.PpTitle id={tip.titleId} />}</div>
      ) : isTicket ? (
        <div className="wh-tip-art"><WhTicket from={tip.ticketFrom} px={12} /></div>
      ) : (
        <div className="wh-tip-art">{tip.art && tip.art.startsWith('emote:') ? <PpEmote id={tip.art.slice(6)} box={240} title="" /> : tip.art && tip.frame && window.FramedImg ? <window.FramedImg src={tip.art} kind={tip.frame.kind} dupes={tip.frame.dupes} alt="" draggable={false} data-pp-px="aus" /> : tip.art ? <img src={tip.art} alt="" draggable={false} data-pp-px="aus" /> : <WhIcon name={f.icon || 'x'} px={10} />}</div>
      )}
      {!tip.titleId && !(tip.art && tip.art.indexOf('/cards/skins/') >= 0) && <div className="wh-tip-name">{tip.card && tip.card.name ? whCardName(tip.card.name) : (tip.name || f.label)}</div>}
      <div className="wh-tip-sub">{tip.card ? whT(whRarityLabel(tip.card.rarity)) + (tip.sample ? ' · ' + whT('example') : '') : (tip.sub || f.sub || '')}</div>
      {f.desc && <div className="wh-tip-desc">{whT(f.desc)}</div>}
      {tip.pct != null && <div className="wh-tip-pct">{whT('Chance per dart') + ': ' + whPct(tip.pct)}</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  Board (Felder, Deko, Leinwand, Preis-Leiste); `play` startet den Wurf
// ═══════════════════════════════════════════════════════════════════════════
// Zufällige Beispiele für die Felder „Avatar/Sleeve/Skin“ (beim Betreten des Boards gewürfelt, siehe WheelShop)
function whRollCos(pools) {
  const pick = (a) => (a && a.length ? a[Math.floor(Math.random() * a.length)] : null);
  if (!pools) return {};
  const sk = pick(pools.skins);
  const D = window.ppEmData || {}, em = pick(D.emotes), ti = pick(D.titles);
  return { avatar: pick(pools.avatars), sleeve: pick(pools.sleeves), skin: sk ? { id: sk.id, hero: sk.hero, src: '/cards/skins/' + encodeURIComponent(sk.id) + '.png', name: sk.id } : null,
    emote: em ? { id: em.id, name: window.ppEmName ? window.ppEmName(em) : em.en } : null, title: ti ? { id: ti.id } : null };
}
/** Rang-Rahmen (Duplikat) eines gewonnenen Avatars/Sleeves/Skins: { kind, dupes } oder null – der Rahmen wird ums Bild gezeichnet (FramedImg), nicht als Text genannt. */
function whFrameOf(kind, p) { return p && p.dupes > 0 && (kind === 'avatar' || kind === 'sleeve' || kind === 'skin') ? { kind, dupes: p.dupes } : null; }
function whFrameName(d) { const i = window.ppRankFrames ? window.ppRankFrames.rankOf(d) : null; return i == null ? 'Frame ' + d : window.ppRankFrames.RANKS[i].name + ' Frame'; }
function whArtFor(kind, art, seed) {
  // Bildmaterial je Feld: Booster-Kunst, Kartenrücken, Beispielkarte, zufälliger Avatar/Sleeve/Skin
  if (!art) return null;
  if (kind === 'avatar' || kind === 'sleeve' || kind === 'skin') { const c = art.cos && art.cos[kind]; return c ? c.src : (kind === 'sleeve' ? '/cardback.png' : null); }
  if (kind === 'emote') { const c = art.cos && art.cos.emote; return c ? 'emote:' + c.id : null; }   // wird als PpEmote gezeichnet
  if (kind === 'golden') return art.golden && art.golden.length ? art.golden[seed % art.golden.length] : null;
  if (kind === 'jackpot') return art.umbra && art.umbra.length ? art.umbra[seed % art.umbra.length] : null;
  if (kind === 'booster') return art.packs && art.packs.length ? art.packs[seed % art.packs.length] : null;
  if (kind.startsWith('card:') && art.samples && art.samples[kind.slice(5)]) return bpCardUrl(art.samples[kind.slice(5)], kind.slice(5));
  return null;
}
// Boost-Überdeckungen: je Boost ein Zettel über dem größten niedrigeren Feld (Größe ∝ umgeschichtete Wahrscheinlichkeit)
function whSpecsUpTo(arrows, uptoI) {
  const specs = [];
  for (const a of arrows) { if (a.i > uptoI) break; if (a.kind.startsWith('boost:') && a.spec) specs.push(a.spec); }
  return specs;
}
function whOverlayRects(specs, table, layout, W, BW) {
  const out = []; if (!specs.length) return out;
  let t = table;
  const hostKey = layout.none ? 'none' : Object.keys(layout).sort((a, b) => layout[b].w * layout[b].h - layout[a].w * layout[a].h)[0];   // die größte Nichts-Tasche
  const host = layout[hostKey]; let slot = 0;
  for (const spec of specs) {
    const eff = W.applyBoosts(t, [spec]);
    const moved = Math.max(0.05, (eff[spec.make] || 0) - (t[spec.make] || 0));
    const area = Math.max(20, Math.round(moved / 100 * BW * WH_BH));
    const w = Math.max(10, Math.min(host.w - 4, Math.round(Math.sqrt(area * 1.8)))), h = Math.max(7, Math.min(host.h - 4, Math.round(area / w)));
    const x = host.x + 2 + ((slot * 11) % Math.max(1, host.w - w - 3)), y = host.y + 2 + ((slot * 7) % Math.max(1, host.h - h - 3));
    out.push({ make: spec.make, x, y, w, h }); slot++; t = eff;
  }
  return out;
}
function whTargetRect(a, layout, overlayRects, BW) {
  if (a.boosted && overlayRects && overlayRects.length) {
    for (let i = overlayRects.length - 1; i >= 0; i--) if (overlayRects[i].make === a.kind) return overlayRects[i];
  }
  if (a.kind === 'none') { const ids = Object.keys(layout).filter(whIsNone); if (ids.length) return layout[ids[Math.floor(whRng(a.i * 31 + 5)() * ids.length)]]; }
  return layout[a.kind] || layout.none || { x: 0, y: 0, w: BW, h: WH_BH };
}

// ── Board-Optik: Materialtextur, Kopfleiste, Deko; eigene Szene im „Nichts“-Bereich (alles Rasterzellen, feste Palette, Bayer-Dither statt Alpha) ───────────
const WH_PIN_COL = ['#e73b41', '#6d9bf8', '#fad54a', '#4bcd7c', '#c98aff'];
const WH_F35 = {   // 3×5-Pixelschrift (nur die gebrauchten Zeichen)
  L: ['X..', 'X..', 'X..', 'X..', 'XXX'], U: ['X.X', 'X.X', 'X.X', 'X.X', 'XXX'], C: ['XXX', 'X..', 'X..', 'X..', 'XXX'], K: ['X.X', 'X.X', 'XX.', 'X.X', 'X.X'],
  Y: ['X.X', 'X.X', '.X.', '.X.', '.X.'], D: ['XX.', 'X.X', 'X.X', 'X.X', 'XX.'], R: ['XX.', 'X.X', 'XX.', 'X.X', 'X.X'], A: ['.X.', 'X.X', 'XXX', 'X.X', 'X.X'],
  W: ['X.X', 'X.X', 'X.X', 'XXX', 'X.X'], '?': ['XXX', '..X', '.X.', '...', '.X.'], ' ': ['...', '...', '...', '...', '...'],
};
function whPainter(ctx, S, bw, bh) {
  const cell = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || (bw && x >= bw) || (bh && y >= bh)) return; ctx.fillStyle = c; ctx.fillRect(x * S, y * S, S, S); };
  const rect = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) cell(x + i, y + j, c); };
  const line = (x0, y0, x1, y1, c) => { x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1); const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx - dy; for (let n = 0; n < 4000; n++) { cell(x0, y0, c); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 > -dy) { e -= dy; x0 += sx; } if (e2 < dx) { e += dx; y0 += sy; } } };
  const ring = (cx, cy, r, c) => { for (let a = 0; a < 360; a += 3) cell(cx + Math.cos(a * Math.PI / 180) * r, cy + Math.sin(a * Math.PI / 180) * r, c); };
  const text = (str, x, y, c, k) => { k = k || 1; for (const ch of str) { const g = WH_F35[ch] || WH_F35[' ']; g.forEach((row, j) => [...row].forEach((v, i) => { if (v === 'X') rect(x + i * k, y + j * k, k, k, c); })); x += 4 * k; } return x; };
  return { cell, rect, line, ring, text };
}
const whIh = (i, j, s) => { let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(s, 2147483647)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function whNoise(x, y, sc, s) {
  const gx = x / sc, gy = y / sc, x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = whIh(x0, y0, s), b = whIh(x0 + 1, y0, s), c = whIh(x0, y0 + 1, s), d = whIh(x0 + 1, y0 + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const WH_BAY = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];

function whDrawBoardBg(ctx, S, id, layout, seed, BW) {
  const BH = WH_BH, HD = WH_HEAD, P = whPainter(ctx, S, BW, BH), rnd = whRng(seed ^ 0x5bd1e995);
  ctx.clearRect(0, 0, BW * S, BH * S);
  // ── Material ──
  if (id === 'C') {   // Zeltwand: breite Streifen, nach unten dunkler
    for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) {
      const st = Math.floor(x / 10) % 2, shade = y > BH * 0.55 && ((x + y) & 1) === 0 && WH_BAY[y & 3][x & 3] / 16 < (y / BH - 0.55) * 1.5;
      P.cell(x, y, shade ? '#1a0a3a' : (st ? '#401a66' : '#2b0b47'));
    }
  } else {            // Kork bzw. Kreidetafel: geglättetes Rauschen in drei Tönen, dazwischen Bayer-Dither
    const T = id === 'A' ? { dark: '#9d612f', base: '#9d612f', light: '#ca874e', speck: '#6e4421' } : { dark: '#0f2412', base: '#1a4128', light: '#1a4128', speck: '#686868' };
    for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) {
      const n = 0.6 * whNoise(x, y, 9, seed) + 0.4 * whNoise(x, y, 3.5, seed + 7), v = n + (WH_BAY[y & 3][x & 3] / 16 - 0.5) * 0.16;
      let c = v < 0.38 ? T.dark : v > 0.64 ? T.light : T.base;
      if (whIh(x, y, seed + 3) < (id === 'A' ? 0.035 : 0.012)) c = T.speck;
      P.cell(x, y, c);
    }
  }
  // ── Kopfleiste ──
  if (id === 'A') {
    for (let x = 0; x < BW; x++) { P.cell(x, 0, '#9d612f'); P.cell(x, 1, '#9d612f'); P.cell(x, 2, '#6e4421'); P.cell(x, 3, '#4a2a10'); if (x % 9 === 4) { P.cell(x, 1, '#6e4421'); P.cell(x + 1, 2, '#4a2a10'); } }
    for (let x = 10; x < BW; x += 30) { P.rect(x, 1, 3, 2, '#fad54a'); P.cell(x + 1, 1, '#f7f7ad'); }   // Messingnägel am Balken
    const sag = (x) => 4 + Math.round(Math.sin((x / BW) * Math.PI * 6) * 1.4 + 1.4), fc = ['#e73b41', '#fad54a', '#6d9bf8', '#4bcd7c', '#fc69c6', '#f29a3e'];
    for (let x = 1; x < BW - 1; x++) P.cell(x, sag(x), '#ebdcc1');
    for (let i = 0, x0 = 5; x0 < BW - 10; i++, x0 += 13) {
      const ys = sag(x0 + 4) + 1;
      for (let r = 0; r < 6; r++) for (let x = x0 + r; x <= x0 + 8 - r; x++) P.cell(x, ys + r, r === 5 ? '#12101f' : (r === 0 ? '#ffffff' : fc[i % fc.length]));
      if (i % 2) { const sx = x0 + 11; P.cell(sx, ys, '#fad54a'); P.cell(sx - 1, ys + 1, '#fad54a'); P.cell(sx, ys + 1, '#f7f7ad'); P.cell(sx + 1, ys + 1, '#fad54a'); P.cell(sx, ys + 2, '#fad54a'); }   // Sternchen zwischen den Wimpeln
    }
  } else if (id === 'B') {
    P.rect(0, 0, BW, HD, '#0f2412');
    for (let x = 0; x < BW; x += 2) { P.cell(x, HD - 1, '#1a4128'); P.cell(x + 1, 0, '#1a4128'); }
    const word = 'LUCKY DRAW', k = 2, ww = word.length * 4 * k - k, wx = Math.floor((BW - ww) / 2);
    P.text(word, wx + 1, 2, '#66a1a1', k); P.text(word, wx, 1, '#e6e6e6', k);    // Kreideschrift mit leichtem Schatten
    P.line(wx - 12, 6, wx - 3, 6, '#e6e6e6'); P.line(wx + ww + 3, 6, wx + ww + 12, 6, '#e6e6e6');
    for (const sx of [wx - 18, wx + ww + 18]) { for (let d = -2; d <= 2; d++) { P.cell(sx + d, 6, '#fad54a'); P.cell(sx, 6 + d, '#fad54a'); } P.cell(sx, 6, '#f7f7ad'); }
    for (let x = 6; x < BW - 6; x += 5) if (whIh(x, 9, seed) < 0.5) P.cell(x, HD - 3, '#e6e6e6');
  } else {
    for (let y = 0; y < HD; y++) for (let x = 0; x < BW; x++) { const st = Math.floor(x / 8) % 2, sc = y >= HD - 3 ? Math.abs((x % 8) - 3.5) > (HD - y) * 1.3 + 0.4 : false; if (!sc) P.cell(x, y, st ? '#b21a29' : '#f7e0b5'); }
    for (let x = 0; x < BW; x += 8) { P.cell(x, HD - 4, '#fad54a'); P.cell(x, HD - 5, '#f7f7ad'); P.cell(x, HD - 3, '#9d612f'); }
    for (let x = 4; x < BW; x += 16) { P.cell(x, 1, '#fad54a'); P.cell(x - 1, 2, '#fad54a'); P.cell(x + 1, 2, '#fad54a'); P.cell(x, 3, '#fad54a'); }   // Sternchen im Dach
  }
  // ── Details auf freien Stellen (Abstand zu allen Feldern) ──
  const rects = Object.keys(layout).map(k => layout[k]);
  const free = (x, y, w, h) => x >= 1 && y >= HD + 1 && x + w < BW - 1 && y + h < BH - 1 && !rects.some(r => x < r.x + r.w + 2 && x + w > r.x - 2 && y < r.y + r.h + 2 && y + h > r.y - 2);
  const spot = (w, h) => { for (let t = 0; t < 40; t++) { const x = 2 + Math.floor(rnd() * (BW - w - 4)), y = HD + 2 + Math.floor(rnd() * (BH - HD - h - 4)); if (free(x, y, w, h)) { rects.push({ x, y, w, h }); return [x, y]; } } return null; };
  const bal = ['#e73b41', '#fad54a', '#6d9bf8', '#4bcd7c', '#fc69c6', '#f29a3e'];
  const n = Math.round(BW / 20);
  for (let i = 0; i < n; i++) {
    if (id === 'A') {
      const t = i % 3;
      if (t === 0) { const p = spot(9, 11); if (p) { const [x, y] = p; P.rect(x, y, 9, 11, '#fff8e8'); P.rect(x + 1, y + 1, 7, 7, '#6d9bf8'); P.rect(x + 1, y + 5, 7, 3, '#4bcd7c'); P.cell(x + 6, y + 2, '#fad54a'); P.cell(x + 5, y + 2, '#fad54a'); P.rect(x, y + 10, 9, 1, '#ebdcc1'); P.cell(x + 4, y - 1, WH_PIN_COL[i % 5]); } }     // Polaroid
      else if (t === 1) { const p = spot(11, 9); if (p) { const [x, y] = p; P.rect(x, y, 11, 9, '#ebdcc1'); P.rect(x + 1, y + 1, 9, 2, '#323232'); for (let r = 4; r < 8; r += 2) P.rect(x + 1, y + r, 9, 1, '#a89370'); P.rect(x + 1, y + 4, 3, 3, '#a89370'); P.cell(x + 5, y - 1, WH_PIN_COL[(i + 2) % 5]); } }   // Zeitungsausschnitt
      else { const p = spot(7, 7); if (p) { const [x, y] = p; P.line(x, y + 6, x + 6, y, '#6e4421'); P.line(x + 4, y, x + 6, y, '#e73b41'); P.line(x + 6, y, x + 6, y + 2, '#e73b41'); P.cell(x, y + 6, '#12101f'); P.cell(x + 1, y + 6, '#12101f'); } }   // Dartskizze
    } else if (id === 'B') {
      const t = i % 5, c = i % 2 ? '#e6e6e6' : '#e6e6e6';
      if (t === 0) { const p = spot(9, 8); if (p) { const [x, y] = p; P.cell(x + 2, y, c); P.cell(x + 3, y, c); P.cell(x + 5, y, c); P.cell(x + 6, y, c); P.rect(x + 1, y + 1, 7, 2, c); P.rect(x + 2, y + 3, 5, 1, c); P.rect(x + 3, y + 4, 3, 1, c); P.cell(x + 4, y + 5, c); } }       // Herz
      else if (t === 1) { const p = spot(7, 7); if (p) { const [x, y] = p; P.ring(x + 3, y + 3, 3, c); P.cell(x + 2, y + 2, c); P.cell(x + 4, y + 2, c); P.cell(x + 2, y + 4, c); P.cell(x + 3, y + 5, c); P.cell(x + 4, y + 4, c); } }                               // Smiley
      else if (t === 2) { const p = spot(8, 5); if (p) { const [x, y] = p; for (let k = 0; k < 4; k++) P.line(x + k * 2, y, x + k * 2, y + 4, c); P.line(x - 1, y + 4, x + 7, y, c); } }                                                                              // Strichliste
      else if (t === 3) { const p = spot(8, 8); if (p) { const [x, y] = p; P.line(x + 4, y, x + 1, y + 4, '#fad54a'); P.line(x + 1, y + 4, x + 5, y + 4, '#fad54a'); P.line(x + 5, y + 4, x + 2, y + 7, '#fad54a'); } }                                                  // Blitz
      else { const p = spot(10, 6); if (p) { const [x, y] = p; P.line(x, y + 5, x + 8, y + 1, c); P.line(x + 8, y + 1, x + 5, y + 1, c); P.line(x + 8, y + 1, x + 8, y + 4, c); } }                                                                                   // Pfeil
    } else {
      const t = i % 4;
      if (t === 0) { const p = spot(7, 12); if (p) { const [x, y] = p, c = bal[i % bal.length]; P.rect(x + 1, y, 5, 6, c); P.rect(x, y + 1, 7, 4, c); P.cell(x + 1, y + 1, '#ffffff'); P.cell(x + 3, y + 6, c); P.line(x + 3, y + 7, x + 3, y + 11, '#e6e6e6'); } }          // Luftballon
      else if (t === 1) { const p = spot(8, 7); if (p) { const [x, y] = p, c = bal[(i + 1) % bal.length]; for (let r = 0; r < 6; r++) for (let q = 0; q <= 7 - r; q++) P.cell(x + q, y + r, c); P.line(x, y - 1, x + 7, y - 1, '#e6e6e6'); } }                       // Wimpel
      else if (t === 2) { const p = spot(10, 5); if (p) { const [x, y] = p; P.rect(x, y, 10, 5, '#f7e0b5'); P.rect(x + 1, y + 1, 3, 3, '#b21a29'); for (let r = 0; r < 5; r += 2) P.cell(x + 6, y + r, '#9d612f'); P.cell(x + 7, y + 2, '#9d612f'); P.cell(x + 8, y + 2, '#9d612f'); } }  // Eintrittskarte
      else { const p = spot(7, 7); if (p) { const [x, y] = p; for (let d = -3; d <= 3; d++) { P.cell(x + 3 + d, y + 3, '#fad54a'); P.cell(x + 3, y + 3 + d, '#fad54a'); } P.cell(x + 1, y + 1, '#f7f7ad'); P.cell(x + 5, y + 5, '#f7f7ad'); P.cell(x + 3, y + 3, '#ffffff'); } }                 // Stern
    }
  }
  if (id === 'A') {
    for (let i = 0; i < 40; i++) P.cell(2 + Math.floor(rnd() * (BW - 4)), HD + 1 + Math.floor(rnd() * (BH - HD - 3)), '#5a341a');
  } else if (id === 'B') {
    for (let k = 0; k < 8; k++) { const cx = Math.floor(rnd() * BW), cy = HD + Math.floor(rnd() * (BH - HD)), rx = 10 + rnd() * 18, ry = 5 + rnd() * 9; for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) if ((x * x) / (rx * rx) + (y * y) / (ry * ry) < 1 && WH_BAY[(cy + y) & 3][(cx + x) & 3] / 16 < 0.35 && ((x + y) & 1) === 0) P.cell(cx + x, cy + y, '#1a4128'); }
    for (let i = 0; i < 110; i++) P.cell(Math.floor(rnd() * BW), BH - 1 - Math.floor(rnd() * 7), '#66a1a1');
  } else {
    for (let i = 0; i < 70; i++) { const x = 2 + Math.floor(rnd() * (BW - 5)), y = HD + 2 + Math.floor(rnd() * (BH - HD - 5)), c = i % 3 ? '#f8b4df' : '#f7f7ad'; P.cell(x, y, c); if (i % 4 === 0) { P.cell(x - 1, y, c); P.cell(x + 1, y, c); P.cell(x, y - 1, c); P.cell(x, y + 1, c); } }
  }
  // Roter Faden: jeder Zettel hängt an seinem nächsten (und manchmal übernächsten) Nachbarn, mit Durchhang und Knoten an den Nadeln
  const ids = Object.keys(layout).filter(k => !whIsNone(k)), pin = (k) => { const r = layout[k]; return [r.x + Math.floor(r.w / 2), r.y + 1]; };
  const edges = new Set(), ekey = (a, b) => (a < b ? a + '|' + b : b + '|' + a);
  for (const a of ids) {
    const pa = pin(a), near = ids.filter(b => b !== a).map(b => ({ b, d: Math.hypot(pin(b)[0] - pa[0], pin(b)[1] - pa[1]) })).sort((x, y) => x.d - y.d);
    if (near[0] && rnd() < 0.9) edges.add(ekey(a, near[0].b));
    if (near[1] && rnd() < 0.45) edges.add(ekey(a, near[1].b));
  }
  for (const e of edges) {
    const [ka, kb] = e.split('|'), a = pin(ka), b = pin(kb), m = Math.max(6, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1])));
    for (let t = 0; t <= m; t++) { const u = t / m; P.cell(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u + Math.sin(u * Math.PI) * Math.min(5, m / 6), '#b5171c'); }
    P.rect(a[0] - 1, a[1], 2, 2, '#780014'); P.rect(b[0] - 1, b[1], 2, 2, '#780014');
  }
}

// Rahmen (Leinwand hinter dem Board, Stärke WH_FR): Holzmaserung, Fase, Zierecken, Nieten; Kreidestücke bzw. Streifen je Board
function whDrawFrame(ctx, S, id, BW, BH, seed) {
  const F = WH_FR, W = BW + 2 * F, H = BH + 2 * F, P = whPainter(ctx, S, W, H);
  ctx.clearRect(0, 0, W * S, H * S);
  const tone = id === 'A' ? ['#6e4421', '#9d612f', '#9d612f'] : id === 'B' ? ['#9d612f', '#886c44', '#b29466'] : ['#780014', '#b21a29', '#e94e53'];
  const band = (x, y) => x < F || y < F || x >= W - F || y >= H - F;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!band(x, y)) continue;
    if (id === 'C') { const horiz = y < F || y >= H - F, st = Math.floor((horiz ? x : y) / 4) % 2; P.cell(x, y, st ? '#b21a29' : '#f7e0b5'); continue; }
    const g = whNoise(x * 0.18, y * 4, 5, seed + 11) + (WH_BAY[y & 3][x & 3] / 16 - 0.5) * 0.18;
    P.cell(x, y, g < 0.4 ? tone[0] : g > 0.62 ? tone[2] : tone[1]);
  }
  // Fase: außen dunkel, oben/links hell, innen Schattenkante
  for (let x = 0; x < W; x++) { P.cell(x, 0, '#12101f'); P.cell(x, H - 1, '#12101f'); if (x > 0 && x < W - 1) { P.cell(x, 1, id === 'C' ? '#ffffff' : '#e0c085'); P.cell(x, H - 2, '#27180c'); } }
  for (let y = 0; y < H; y++) { P.cell(0, y, '#12101f'); P.cell(W - 1, y, '#12101f'); if (y > 0 && y < H - 1) { P.cell(1, y, id === 'C' ? '#ffffff' : '#e0c085'); P.cell(W - 2, y, '#27180c'); } }
  for (let x = F - 1; x < W - F + 1; x++) { P.cell(x, F - 1, '#12101f'); P.cell(x, H - F, '#12101f'); }
  for (let y = F - 1; y < H - F + 1; y++) { P.cell(F - 1, y, '#12101f'); P.cell(W - F, y, '#12101f'); }
  // Nieten entlang des Rahmens (Messing)
  const stud = (x, y) => { P.rect(x, y, 2, 2, '#fad54a'); P.cell(x, y, '#f7f7ad'); P.cell(x + 1, y + 1, '#8b5b04'); };
  if (id !== 'C') { for (let x = 16; x < W - 14; x += 14) { stud(x, 2); stud(x, H - 4); } for (let y = 16; y < H - 14; y += 14) { stud(2, y); stud(W - 4, y); } }
  // Zierecken: Messingplatte mit Raute und vier Nieten
  const corner = (cx, cy) => {
    P.rect(cx, cy, 9, 9, '#c68206'); P.rect(cx + 1, cy + 1, 7, 7, '#fad54a');
    for (let i = 0; i < 4; i++) { P.cell(cx + 4 - i, cy + 4 - 0, '#8b5b04'); }
    P.cell(cx + 4, cy + 2, '#8b5b04'); P.cell(cx + 3, cy + 3, '#8b5b04'); P.cell(cx + 5, cy + 3, '#8b5b04'); P.cell(cx + 2, cy + 4, '#8b5b04'); P.cell(cx + 6, cy + 4, '#8b5b04'); P.cell(cx + 3, cy + 5, '#8b5b04'); P.cell(cx + 5, cy + 5, '#8b5b04'); P.cell(cx + 4, cy + 6, '#8b5b04'); P.cell(cx + 4, cy + 4, '#f7f7ad');
    for (const [dx, dy] of [[1, 1], [7, 1], [1, 7], [7, 7]]) P.cell(cx + dx, cy + dy, '#f8f8bd');
    P.rect(cx, cy, 9, 1, '#f7f7ad'); P.rect(cx, cy + 8, 9, 1, '#8b5b04'); P.rect(cx, cy, 1, 9, '#f7f7ad'); P.rect(cx + 8, cy, 1, 9, '#8b5b04');
  };
  corner(0, 0); corner(W - 9, 0); corner(0, H - 9); corner(W - 9, H - 9);
  // Typenschild oben in der Mitte
  const pw = 34, px = Math.floor((W - pw) / 2);
  P.rect(px, 1, pw, F - 2, '#c68206'); P.rect(px + 1, 2, pw - 2, F - 4, '#fad54a'); P.rect(px, 1, pw, 1, '#f7f7ad');
  for (let i = 0; i < 5; i++) { const x = px + 5 + i * 6; P.cell(x, 2 + Math.floor((F - 4) / 2) - 0, '#8b5b04'); P.cell(x - 1, 2 + 1, '#8b5b04'); P.cell(x + 1, 2 + 1, '#8b5b04'); }
  if (id === 'B') for (const [c, x] of [['#e6e6e6', 14], ['#fad54a', 22], ['#fc69c6', 29]]) { P.rect(x + 12, H - F + 1, 6, 2, c); P.rect(x + 12, H - F + 1, 6, 1, '#ffffff'); }   // Kreidestücke auf der unteren Leiste
}

// ── Szenen im „Nichts“ (je Tasche): große Tasche mit voller Szene, kleine mit einem Detail ──
function whDrawNothing(ctx, S, w, h, id, seed, variant) {
  ctx.clearRect(0, 0, w * S, h * S);
  const P = whPainter(ctx, S, w, h), rnd = whRng(seed ^ (0xA5A5A5 + variant * 977)), cx = Math.floor(w / 2);
  const big = variant === 0 && w >= 24 && h >= 20;
  if (!big) {
    const v = variant % 3, cy = Math.floor(h * 0.45);
    if (id === 'A') {
      if (v === 0) { const L = Math.min(w, h) * 0.7; for (let a = 0; a <= 3; a++) { const ang = (a / 3) * Math.PI / 2; P.line(0, 0, Math.cos(ang) * L, Math.sin(ang) * L, '#e6e6e6'); } for (const r of [0.4, 0.75]) for (let a = 0; a < 3; a++) { const a0 = (a / 3) * Math.PI / 2, a1 = ((a + 1) / 3) * Math.PI / 2; P.line(Math.cos(a0) * L * r, Math.sin(a0) * L * r, Math.cos(a1) * L * r, Math.sin(a1) * L * r, '#d2d2db'); } for (let i = 0; i < 4; i++) P.cell(rnd() * w, rnd() * h, '#5a341a'); }
      else if (v === 1) { for (let i = 0; i < 2; i++) { const x = rnd() * (w - 5), y = h - 4 - rnd() * 2; P.rect(x, y, 3, 2, '#b9b9b9'); P.cell(x - 1, y + 1, '#929292'); P.cell(x + 3, y, '#929292'); } P.rect(2, 2, 5, 2, '#f7e0b5'); }
      else { P.line(cx - 2, cy - 2, cx + 2, cy + 2, '#6e4421'); P.line(cx + 2, cy - 2, cx - 2, cy + 2, '#6e4421'); for (const [dx, dy] of [[-5, -4], [5, -4], [-5, 4], [5, 4]]) P.cell(cx + dx, cy + dy, '#5a341a'); }
    } else if (id === 'B') {
      if (v === 0) { P.line(cx - 4, cy - 1, cx + 4, cy - 1, '#e6e6e6'); P.line(cx - 4, cy + 2, cx + 4, cy + 2, '#e6e6e6'); P.line(cx - 1, cy - 4, cx - 1, cy + 5, '#e6e6e6'); P.line(cx + 2, cy - 4, cx + 2, cy + 5, '#e6e6e6'); P.ring(cx + 4, cy - 3, 1, '#b4cff8'); }
      else if (v === 1) { const r = Math.max(2, Math.floor(Math.min(w, h) * 0.3)); P.ring(cx, cy, r, '#e6e6e6'); P.cell(cx - 1, cy - 1, '#e6e6e6'); P.cell(cx + 1, cy - 1, '#e6e6e6'); for (let t = -1; t <= 1.001; t += 0.25) P.cell(cx + t * r * 0.5, cy + r * 0.5 - (1 - t * t) * 1.2, '#e6e6e6'); }
      else { for (let k = 0; k < 4; k++) P.line(cx - 4 + k * 2, cy - 2, cx - 4 + k * 2, cy + 2, '#e6e6e6'); P.line(cx - 5, cy + 2, cx + 3, cy - 2, '#e6e6e6'); for (let i = 0; i < 14; i++) P.cell(rnd() * w, h * 0.6 + rnd() * h * 0.4, '#b9b9b9'); }
    } else {
      if (v === 0) { for (let y = 0; y < h; y++) { const wd = 2 + (y / h) * w * 0.8; for (let x = Math.floor(cx - wd / 2); x <= cx + wd / 2; x++) if (((x + y) & 1) === 0) P.cell(x, y, '#f7f7ad'); } P.cell(cx, 1, '#12101f'); }
      else if (v === 1) { const cols = ['#f8b4df', '#fad54a', '#68fdc1', '#6d9bf8']; for (let i = 0; i < Math.round(w * h / 18); i++) { const x = rnd() * w, y = h * 0.5 + rnd() * h * 0.5; P.cell(x, y, cols[i % 4]); P.cell(x + 1, y, cols[i % 4]); } }
      else { P.rect(cx - 5, cy - 2, 10, 5, '#f7e0b5'); P.rect(cx - 4, cy - 1, 3, 3, '#780014'); P.cell(cx + 1, cy - 2, '#1a0a3a'); P.cell(cx + 1, cy, '#1a0a3a'); P.cell(cx + 1, cy + 2, '#1a0a3a'); P.cell(cx + 2, cy - 1, '#1a0a3a'); }
    }
    return;
  }
  if (id === 'A') {            // Kork: Geist eines abgenommenen Plakats (Klebebandreste, helle Fläche), Spinnennetz, Staubmäuse
    const pw = Math.max(10, Math.floor(w * 0.6)), ph = Math.max(10, Math.floor(h * 0.5)), px = Math.floor((w - pw) / 2), py = Math.floor(h * 0.1);
    for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) { const edge = x === 0 || y === 0 || x === pw - 1 || y === ph - 1; if (edge ? (x + y) % 2 === 0 : (x + y) % 2 === 1) P.cell(px + x, py + y, edge ? '#6e4421' : '#b29466'); }
    P.rect(px - 1, py - 1, 5, 2, '#f7e0b5'); P.rect(px + pw - 4, py - 1, 5, 2, '#f7e0b5'); P.rect(px - 1, py + ph - 1, 5, 2, '#f7e0b5'); P.rect(px + pw - 4, py + ph - 1, 5, 2, '#f7e0b5');
    const k = Math.max(1, Math.floor(ph / 9)), gx = px + Math.floor((pw - 3 * k) / 2), gy = py + Math.floor((ph - 5 * k) / 2); P.text('?', gx, gy, '#6e4421', k);
    const L = Math.min(w, h) * 0.45;
    for (let a = 0; a <= 4; a++) { const ang = (a / 4) * Math.PI / 2; P.line(0, 0, Math.cos(ang) * L, Math.sin(ang) * L, '#e6e6e6'); }
    for (const r of [0.35, 0.6, 0.85]) for (let a = 0; a < 4; a++) { const a0 = (a / 4) * Math.PI / 2, a1 = ((a + 1) / 4) * Math.PI / 2; P.line(Math.cos(a0) * L * r, Math.sin(a0) * L * r, Math.cos(a1) * L * r, Math.sin(a1) * L * r, '#d2d2db'); }
    for (let i = 0; i < 3; i++) { const x = Math.floor(w * (0.55 + rnd() * 0.4)), y = h - 3 - Math.floor(rnd() * 3); P.rect(x, y, 3, 2, '#b9b9b9'); P.cell(x - 1, y + 1, '#929292'); P.cell(x + 3, y, '#929292'); P.cell(x + 1, y - 1, '#d2d2db'); }
  } else if (id === 'B') {     // Kreide: trauriges Gesicht mit Träne, verwischter Fleck, Staub
    const r = Math.max(4, Math.floor(Math.min(w, h) * 0.28)), cy = Math.floor(h * 0.4);
    for (let i = 0; i < 90; i++) { const a = rnd() * Math.PI * 2, d = rnd() * r * 1.5; P.cell(cx + Math.cos(a) * d * 1.2, cy + Math.sin(a) * d, '#686868'); }
    P.ring(cx, cy, r, '#e6e6e6'); P.ring(cx, cy, r - 1, '#e6e6e6');
    const ex = Math.max(2, Math.floor(r * 0.42)); P.rect(cx - ex - 1, cy - Math.floor(r * 0.3), 2, 2, '#e6e6e6'); P.rect(cx + ex - 1, cy - Math.floor(r * 0.3), 2, 2, '#e6e6e6');
    for (let t = -1; t <= 1.001; t += 0.1) P.cell(cx + t * r * 0.5, cy + r * 0.55 - (1 - t * t) * r * 0.22, '#e6e6e6');
    P.cell(cx - ex, cy - Math.floor(r * 0.3) + 2, '#b4cff8'); P.cell(cx - ex, cy - Math.floor(r * 0.3) + 3, '#b4cff8'); P.cell(cx - ex, cy - Math.floor(r * 0.3) + 4, '#b4dff8');
    for (let i = 0; i < 50; i++) P.cell(rnd() * w, h * 0.55 + rnd() * h * 0.45, '#b9b9b9');
  } else {                      // Zelt: leerer Sockel im Scheinwerfer, Vorhänge, Netz
    const bandW = Math.max(3, Math.floor(w * 0.1));
    for (let y = 0; y < h; y++) { const wd = 3 + (y / h) * w * 0.7; for (let x = Math.floor(cx - wd / 2); x <= cx + wd / 2; x++) if (((x + y) & 1) === 0 && ((x >> 1) + y) % 3 !== 0) P.cell(x, y, '#f7f7ad'); }
    for (let y = 0; y < h; y++) for (let i = 0; i < bandW; i++) { const col = Math.floor(i / 3) % 2 ? '#f7e0b5' : '#b21a29'; P.cell(i, y, col); P.cell(w - 1 - i, y, col); }
    const pw = Math.max(10, Math.floor(w * 0.42)), px = Math.floor((w - pw) / 2), py = h - 9;
    P.rect(px, py, pw, 2, '#ca874e'); P.rect(px, py + 2, pw, 2, '#9d612f'); P.rect(px + 2, py + 4, pw - 4, 5, '#6e4421'); P.rect(px + 2, py + 4, 1, 5, '#9d612f');
    for (let i = 0; i < 5; i++) P.cell(px + 2 + Math.floor(rnd() * (pw - 4)), py - 1, '#d2d2db');
    const L = Math.min(w, h) * 0.3; for (let a = 0; a <= 4; a++) { const ang = Math.PI / 2 + (a / 4) * Math.PI / 2; P.line(w - 1, 0, w - 1 + Math.cos(ang) * L, Math.sin(ang) * L, '#e6e6e6'); }
  }
}
function WhNothing({ w, h, S, id, seed, variant }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) { const ctx = ref.current.getContext('2d'); ctx.imageSmoothingEnabled = false; whDrawNothing(ctx, S, w, h, id, seed, variant); } }, [w, h, S, id, seed, variant]);
  return <canvas ref={ref} className="wh-nothing-cv" width={w * S} height={h * S} />;
}

// Reihenfolge der Preis-Leiste: Packs → Kosmetik (Skin, Avatar, Sleeve, Emote, Titel) → Tickets → Karten (Rarity absteigend, dann Name) → SC → Sonstiges
const WH_RAIL_ORDER = ['jackpot', 'golden', 'booster', 'skin', 'avatar', 'sleeve', 'emote', 'title', 'ticket', 'card', 'sc50', 'sc20', 'sc10', 'spin3', 'boost'];
function whRailCmp(a, b) {
  const g = (sl) => { const i = WH_RAIL_ORDER.indexOf(sl.kind.split(':')[0]); return i < 0 ? 99 : i; };
  if (g(a) !== g(b)) return g(a) - g(b);
  const rk = (sl) => (sl.kind.startsWith('card:') ? window.PpRarities.rank(sl.kind.slice(5)) : sl.kind.startsWith('ticket:') ? window.PpRarities.rank(sl.kind.slice(7)) : 0);
  if (rk(a) !== rk(b)) return rk(b) - rk(a);
  return String((a.prize && (a.prize.name || a.prize.id)) || a.key).localeCompare(String((b.prize && (b.prize.name || b.prize.id)) || b.key));
}

function WhBoard({ rarity, boardData, play, small, art, onTip, claimed }) {
  const stageRef = useRef(null), fxRef = useRef(null), decoRef = useRef(null), frameRef = useRef(null), fieldRefs = useRef({});
  const [S, setS] = useState(3);
  const [BW, setBW] = useState(WH_BW0);   // Boardbreite in Zellen: bei viel Platz (große Anzeige) bis WH_BW_MAX
  const table = boardData.table;
  const seed = useMemo(() => whHash(rarity + ':' + boardData.id), [rarity, boardData.id]);
  const layout = useMemo(() => whLayout(table, seed, BW), [table, seed, BW]);
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
      const byH = play ? Math.floor((window.innerHeight - 250) / (WH_BH + 2 * WH_FR + WH_GAP + WH_BARH)) : 99;
      const sNew = Math.max(2, Math.min(cap, Math.floor((w - 12) / (WH_BW0 + 2 * WH_FR)), byH));
      setS(sNew);
      // Breite: soviel Platz wie da ist (Rahmen eingerechnet), mindestens 160, höchstens 300 Zellen
      setBW(small ? WH_BW0 : Math.max(WH_BW0, Math.min(WH_BW_MAX, Math.floor((w - 12) / sNew) - 2 * WH_FR)));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [small, !!play]);

  // Geöffnete Gewinn-Packs: das Pack verschwindet aus der Preis-Leiste, an seine Stelle treten die enthaltenen Karten
  useEffect(() => {
    if (!claimed || !claimed.length) return;
    setRail(prev => {
      const list = prev.filter(sl => sl.kind !== 'booster' && sl.kind !== 'golden' && sl.kind !== 'jackpot').map(sl => ({ ...sl }));
      for (const c of claimed) {
        const key = 'c:' + c.name + '|' + c.rarity; let sl = list.find(x => x.key === key);
        if (!sl) { sl = { key, kind: 'card:' + c.rarity, prize: { name: c.name, rarity: c.rarity }, n: 0 }; list.push(sl); }
        sl.n++;
      }
      return list;
    });
  }, [claimed]);

  // Hintergrund-Ebene (einmal gezeichnet): Material, Kopfleiste, Deko
  useEffect(() => {
    const cv = decoRef.current; if (!cv) return;
    const ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
    whDrawBoardBg(ctx, S, boardData.id, layout, seed, BW);
  }, [S, layout, seed, boardData.id, BW]);
  useEffect(() => {
    const cv = frameRef.current; if (!cv) return;
    const ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
    whDrawFrame(ctx, S, boardData.id, BW, WH_BH, seed);
  }, [S, seed, boardData.id, BW]);

  // ── Wurf-Animation ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!play || !fxRef.current) return undefined;
    whWarm();
    const cv = fxRef.current, ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const M = WH_M, CWc = BW + 2 * M, CHc = M + WH_BH + WH_GAP + WH_BARH + M;
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
      const rect = whTargetRect(a, layout, ovNow, BW);
      if (a.kind.startsWith('boost:') && a.spec) { specsSoFar.push(a.spec); ovNow = whOverlayRects(specsSoFar, table, layout, Wz, BW); }
      const h1 = whRng(i * 7919 + 13)(), h2 = whRng(i * 104729 + 7)();
      const tx = rect.x + 1 + Math.floor(h1 * Math.max(1, rect.w - 3)), ty = rect.y + 2 + Math.floor(h2 * Math.max(1, rect.h - 5));
      const side = i % 3, sx = side === 0 ? -6 : side === 1 ? BW + 6 : Math.floor(BW / 2 + (h2 - 0.5) * 40), sy = WH_BH + 2 + Math.floor(h1 * 3);
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
    const slotKey = (s) => { const p = s.a.prize; if (s.kind.startsWith('card:') && p) return 'c:' + p.name + '|' + p.rarity; if ((s.kind === 'avatar' || s.kind === 'sleeve' || s.kind === 'skin' || s.kind === 'emote' || s.kind === 'title') && p && p.id) return s.kind + ':' + p.id; return s.kind; };

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
      if (s.kind.startsWith('boost:') && s.a.spec) setOverlays(whOverlayRects(whSpecsUpTo(arrows, s.a.i), table, layout, Wz, BW));
      // Chip fliegt in die Preis-Leiste (begrenzt, sonst kommt er sofort an)
      if (chips.length < 70) chips.push({ s, t0: frame + 3, dur: 13 + Math.floor(rnd() * 4), x0: s.tx, y0: s.ty, key: slotKey(s) });
      else arrive({ s, key: slotKey(s) });
    };
    const slotTarget = (key) => {
      const host = stageRef.current;
      const n = railOrder.length, per = Math.max(1, Math.floor((BW - 4) / 11));
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
      setOverlays(whOverlayRects(whSpecsUpTo(arrows, Infinity), table, layout, Wz, BW));
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
        for (let x = -3; x <= BW + 2; x += 4) for (const y of [-3, WH_BH + 1]) { ctx.fillStyle = ((x >> 2) & 1) === ph ? '#f7f7ad' : '#8b5b04'; ctx.fillRect((x + M) * S, (y + M) * S, S * 2, S * 2); }
        for (let y = 1; y <= WH_BH - 2; y += 4) for (const x of [-3, BW + 1]) { ctx.fillStyle = ((y >> 2) & 1) === ph ? '#f7f7ad' : '#8b5b04'; ctx.fillRect((x + M) * S, (y + M) * S, S * 2, S * 2); }
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
      if (flashT > 0) { ctx.fillStyle = '#ffffff'; for (let y = 0; y < WH_BH; y++) for (let x = (y + frame) & 1; x < BW; x += 2) ctx.fillRect((x + M) * S, (y + M) * S, S, S); }
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
  }, [play, S, layout, BW]);   // eslint-disable-line

  const fields = Object.keys(layout);
  const sz = (n) => n * S;
  const showTip = (e, kind, extra) => {
    if (!onTip) return;
    const f = whFieldInfo(kind), sample = kind.startsWith('card:') && art && art.samples ? art.samples[kind.slice(5)] : null;
    const cs = (kind === 'avatar' || kind === 'sleeve' || kind === 'skin' || kind === 'emote') && art && art.cos ? art.cos[kind] : null;
    const tsamp = kind === 'title' && art && art.cos && art.cos.title ? art.cos.title.id : null;
    onTip({ x: e.clientX, y: e.clientY, info: { ...f, rarColor: f.rar ? WH_RCOL[f.rar] : null }, pct: table[kind], card: sample ? { name: sample, rarity: kind.slice(5) } : null, sample: !!sample,
      ...(kind.startsWith('ticket:') ? { ticketFrom: kind.slice(7) } : {}),
      art: whArtFor(kind, art, seed), ...(cs ? { name: cs.name, sub: whT('example') } : {}), ...(tsamp ? { titleId: tsamp, sub: whT('example') } : {}), ...(extra || {}) });
  };
  const stageStyle = { width: sz(BW), '--whs': S + 'px', transform: shake[0] || shake[1] ? 'translate(' + shake[0] + 'px,' + shake[1] + 'px)' : undefined, height: play ? sz(WH_BH + WH_GAP + WH_BARH) : sz(WH_BH) };
  return (
    <div className={'wh-stage' + (small ? ' wh-stage-small' : '')} ref={stageRef} style={stageStyle}>
      <canvas ref={frameRef} className="wh-framecv" width={sz(BW + 2 * WH_FR)} height={sz(WH_BH + 2 * WH_FR)} style={{ left: -sz(WH_FR), top: -sz(WH_FR) }} />
      <div className={'wh-board wh-theme-' + boardData.id} style={{ width: sz(BW), height: sz(WH_BH) }}>
        <canvas ref={decoRef} className="wh-deco" width={sz(BW)} height={sz(WH_BH)} />
        {fields.map(fid => {
          const k = fid.split('#')[0], r = layout[fid], f = whFieldInfo(k), artUrl = whArtFor(k, art, seed), rar = f.rar ? WH_RCOL[f.rar] : null;
          const clip = whClip(f.shape, r.w - 2, r.h - 2, S);
          const lblFs = Math.min(2.8, (r.w - 4) / (Math.max(...f.label.split(' ').map(w => w.length)) * 1.0));
          const showLbl = lblFs >= 1.5 && r.h >= 7;
          const isTk = k.startsWith('ticket:');
          const showIcon = !artUrl && f.icon && (isTk ? (r.w >= 22 && r.h >= 15) : (r.w >= 9 && r.h >= (showLbl ? 13 : 9))), px = Math.max(1, Math.min(4, Math.floor(Math.min(r.w - 4, r.h - (showLbl ? 8 : 4)) / 9)));
          return (
            <div key={fid} ref={el => { fieldRefs.current[fid] = el; }} className={'wh-note wh-n-' + f.cls + ' wh-sh-' + f.shape} style={{ left: sz(r.x + 1), top: sz(r.y + 1), width: sz(r.w - 2), height: sz(r.h - 2), zIndex: r.z || 1, ...(r.rot ? { transform: 'rotate(' + r.rot + 'deg)' } : {}), ...(rar ? { '--whc': rar } : {}) }}
                 onMouseEnter={(e) => showTip(e, k)} onMouseMove={(e) => showTip(e, k)} onMouseLeave={() => onTip && onTip(null)}>
              <div className="wh-body" style={clip ? { clipPath: clip } : undefined}>
                {k === 'none' && <WhNothing w={r.w - 2} h={r.h - 2} S={S} id={boardData.id} seed={seed} variant={fid === 'none' ? 0 : parseInt(fid.slice(5), 10) || 1} />}
                {artUrl && artUrl.startsWith('emote:') ? <div className="wh-art wh-art-emote"><PpEmote id={artUrl.slice(6)} box={Math.max(8, Math.min(r.w - 4, r.h - 8)) * S} title="" /></div> : artUrl && <img className={'wh-art wh-art-' + f.cls} src={artUrl} alt="" draggable={false} data-pp-px="aus" />}
                {(f.cls === 'golden' || f.cls === 'jackpot') && !artUrl && <span className="wh-dither" />}
                {showIcon && (k.startsWith('ticket:') ? <WhTicket from={k.slice(7)} px={Math.max(1, Math.min(4, Math.floor((r.w - 4) / 20), Math.floor((r.h - (showLbl ? 9 : 4)) / 11)))} /> : <WhIcon name={f.icon} px={px} />)}
                {showLbl && (k !== 'none' || fid === 'none') && <span className="wh-lbl" style={{ fontSize: 'calc(var(--whs) * ' + lblFs.toFixed(2) + ')' }}>{f.label}</span>}
                {showLbl && f.sub && r.h >= 12 && r.w >= 16 && <span className="wh-sub">{f.sub}</span>}
                {fid === 'none' && r.h >= 14 && r.w >= 22 && <span className="wh-sub wh-none-sub">{whT('Better luck next time!')}</span>}
                {k === 'title' && art && art.cos && art.cos.title && r.h >= 12 && r.w >= 16 && window.ppTitleInfo && <span className="wh-sub wh-titlesample">{(window.ppTitleInfo(art.cos.title.id) || {}).text}</span>}
              </div>
              {k !== 'none' && (whHash(k + 't') % 3 === 0 && r.w >= 14 ? <React.Fragment><i className="wh-tape wh-tape-l" /><i className="wh-tape wh-tape-r" /></React.Fragment> : <span className="wh-pin" style={{ '--pin': WH_PIN_COL[whHash(k) % WH_PIN_COL.length] }} />)}
              {fid === k && counts[k] > 0 && <span className="wh-cnt">{'×' + counts[k]}</span>}
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
        <div className="wh-rail" style={{ top: sz(WH_BH + WH_GAP), height: sz(WH_BARH), width: sz(BW) }}>
          {rail.length === 0 && <span className="wh-rail-empty">{whT('Your prizes land here')}</span>}
          {[...rail].sort(whRailCmp).map(sl => {
            const f = whFieldInfo(sl.kind), p = sl.prize;
            const isCard = sl.kind.startsWith('card:') && p;
            const img = isCard ? bpCardUrl(p.name, p.rarity) : (p && p.src) || (p && sl.kind === 'skin' && p.id ? '/cards/skins/' + encodeURIComponent(p.id) + '.png' : null) || whArtFor(sl.kind, art, seed);
            const text = isCard ? whCardName(p.name) : (sl.kind === 'skin' && p && p.id ? p.id : (p && p.label) || f.label);
            const extra = isCard ? { card: { name: p.name, rarity: p.rarity }, sample: false, pct: null } : { pct: null, art: img, name: text, sub: p && p.id !== undefined && p.isNew ? whT('New!') : undefined, ...(whFrameOf(sl.kind, p) ? { frame: whFrameOf(sl.kind, p) } : {}) };
            if (sl.kind === 'emote' && p) extra.art = 'emote:' + p.id; if (sl.kind === 'title' && p) { extra.titleId = p.id; extra.sub = whT('New!'); }
            return (
              <div key={sl.key} className={'wh-slot wh-slot-' + f.cls + (sl.kind === 'emote' ? ' wh-slot-emote' : '') + (sl.kind === 'title' ? ' wh-slot-title' : '')} data-slot={sl.key} style={{ '--whc': f.rar ? WH_RCOL[f.rar] : (isCard ? WH_RCOL[p.rarity] : WH_FCOL[f.cls]) }}
                   onMouseEnter={(e) => showTip(e, sl.kind, extra)} onMouseMove={(e) => showTip(e, sl.kind, extra)} onMouseLeave={() => onTip && onTip(null)}>
                {sl.kind === 'emote' || sl.kind === 'title' ? <span className="wh-slot-tag">{sl.kind === 'emote' ? 'EMOTE' : 'TITLE'}</span> : null}
                {sl.kind === 'title' && p && p.id && window.PpTitle ? <div className="wh-slot-titlebody"><window.PpTitle id={p.id} /></div> : sl.kind.startsWith('ticket:') ? <WhTicket from={sl.kind.slice(7)} px={Math.max(1, Math.floor(S * 0.5))} /> : sl.kind === 'emote' && p && p.id ? <PpEmote id={p.id} box={9 * S} title="" /> : img && whFrameOf(sl.kind, p) && window.FramedImg ? <window.FramedImg src={img} kind={whFrameOf(sl.kind, p).kind} dupes={whFrameOf(sl.kind, p).dupes} alt="" draggable={false} data-pp-px="aus" /> : img ? <img src={img} alt="" draggable={false} data-pp-px="aus" /> : <WhIcon name={f.icon || 'x'} px={3} />}
                {sl.kind !== 'title' && <span className="wh-slot-lbl">{sl.kind.startsWith('ticket:') ? f.sub : text}</span>}
                <b key={sl.n} className="wh-slot-n">{'×' + sl.n}</b>
              </div>
            );
          })}
        </div>
      )}
      {play && <canvas ref={fxRef} className="wh-fx" width={sz(BW + 2 * WH_M)} height={sz(WH_M + WH_BH + WH_GAP + WH_BARH + WH_M)} style={{ left: -sz(WH_M), top: -sz(WH_M) }} />}
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
          <p className="wh-hint">A ticket upgrades one free card to the next rarity. Click a ticket to choose the card.</p>
          <div className="wh-ticket-row">
            {tix.map(r => {
              const f = whFieldInfo('ticket:' + r);
              return (
                <button key={r} className="wh-ticket" style={{ '--whc': WH_RCOL[f.rar] }} onClick={() => onTicket(r)}>
                  <WhTicket from={r} px={5} />
                  <span className="wh-ticket-txt"><span className="wh-ticket-n">{'×' + state.tickets[r]}</span><span>{f.sub}</span></span>
                  <span className="wh-ticket-use">Use</span>
                </button>
              );
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
const WhTile = React.memo(function WhTile({ k, name, rarity, locked, selected, noUp }) {
  return (
    <button className={'wh-tile' + (selected ? ' wh-tile-sel' : '') + (locked ? ' wh-tile-lock' : '')} data-k={k} data-locked={locked ? '1' : ''}>
      <img src={bpCardUrl(name, rarity)} alt={name} loading="lazy" decoding="async" draggable={false} />
      {selected && <span className="wh-tick">✓</span>}
      {locked && <span className="wh-lock">{noUp ? 'N/A' : 'DECK'}</span>}
    </button>
  );
});
function WhGallery({ rarity, mode, tickets, onBack, onGo, notify }) {
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
    for (const c of cards || []) for (let k = 0; k < c.total; k++) out.push({ key: c.name + '#' + k, name: c.name, locked: k >= c.free || (single && c.up === false), noUp: single && c.up === false && k < c.free, ql: (c.name + ' ' + whCardName(c.name)).toLowerCase(), type: (CB[c.name] || {}).cardType, sub: (CB[c.name] || {}).subtype });
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
          {single ? <WhTicket from={rarity} px={3} /> : null}
          <h3 className="wh-title" style={{ color: WH_RCOL[rarity] }}>{single ? whFieldInfo('ticket:' + rarity).sub : whRarityLabel(rarity)}</h3>
          <div style={{ flex: 1 }} />
          {single && <span className="wh-selcount">{window.ppT('Tickets: {0}').replace('{0}', tickets || 0)}</span>}
          {single ? <span className="wh-hint">{sel.size ? whT('Ready: press Upgrade!') : whT('Click the card to upgrade.')}</span> : <span className="wh-selcount">{window.ppT('Selected: {0}').replace('{0}', sel.size)}</span>}
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
          {shown.map(t => <WhTile key={t.key} k={t.key} name={t.name} rarity={rarity} locked={t.locked} noUp={t.noUp} selected={sel.has(t.key)} />)}
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
  const [force, setForce] = useState([]);              // Debug (nur mit PP_DEBUG_TOOLS=1): Preisarten der ersten Pfeile
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
      {state.debug && chosen && (
        <div className="wh-debug">
          <h4>Debug: guarantee the first darts</h4>
          <div className="wh-debug-row">
            {Object.keys(chosen.table).filter(k => k !== 'none').sort((a, b) => whFieldInfo(b).tier - whFieldInfo(a).tier || a.localeCompare(b)).map(k => {
              const f = whFieldInfo(k), at = force.indexOf(k);
              return <button key={k} className={'btn wh-chip' + (at >= 0 ? ' wh-chip-on' : '')} onClick={() => setForce(fo => (fo.includes(k) ? fo.filter(x => x !== k) : fo.concat(k)))}>
                {(at >= 0 ? (at + 1) + '. ' : '') + f.label + (f.sub && f.cls !== 'boost' ? ' (' + f.sub + ')' : '')}</button>;
            })}
          </div>
        </div>
      )}
      <div className="wh-confirm">
        <button className="btn btn-primary wh-go" disabled={!pick || busy} onClick={() => onThrow(pick, force)}>
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
function WhResult({ result, claimed, locked, onAgain, onMore, onPacks, onTip }) {
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
    else if (p && (k === 'avatar' || k === 'sleeve' || k === 'skin' || k === 'emote' || k === 'title')) { if (p.maxed) sc += p.amount; else cos.push({ ...p, kind: p.kind || k }); }
  }
  const frameName = whFrameName;
  if (claimed) { cardsN += claimed.length; packs.length = 0; }   // geöffnete Packs sind durch ihre Karten ersetzt
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
          {cos.map((c, i) => {
            const isEmote = c.kind === 'emote', isTitle = c.kind === 'title';
            const img = c.kind === 'skin' ? '/cards/skins/' + encodeURIComponent(c.id) + '.png' : c.src, name = c.kind === 'skin' ? c.id : (c.label || c.id);
            const fr = whFrameOf(c.kind, c);
            const tip = (e) => onTip && onTip({ x: e.clientX, y: e.clientY, info: whFieldInfo(c.kind), art: isEmote ? 'emote:' + c.id : img, ...(isTitle ? { titleId: c.id } : {}), name, sub: c.isNew ? whT('New!') : undefined, ...(fr ? { frame: fr } : {}), pct: null });
            return (
              <div key={i} className="wh-cos" onMouseEnter={tip} onMouseMove={tip} onMouseLeave={() => onTip && onTip(null)}>
                {isEmote ? <PpEmote id={c.id} box={96} title="" /> : isTitle ? <div className="wh-cos-title">{window.PpTitle && <window.PpTitle id={c.id} />}</div> : fr && window.FramedImg ? <window.FramedImg src={img} kind={fr.kind} dupes={fr.dupes} alt="" draggable={false} data-pp-px="aus" /> : <img src={img} alt="" draggable={false} data-pp-px="aus" />}
                {!isTitle && <span>{name}</span>}
                {c.isNew && <span className="wh-gold">New!</span>}
              </div>
            );
          })}
        </div>
      )}
      <div className="wh-confirm">
        <button className="btn btn-primary wh-go" disabled={locked} onClick={onMore}>Throw more!</button>
        <button className="btn" disabled={locked} onClick={onAgain}>Back to rarities</button>
        {locked && <span className="wh-hint">{whT('Open your packs first.')}</span>}
      </div>
    </div>
  );
}

function WhPlay({ rarity, board, result, art, claimed, locked, onAgain, onMore, onPacks, onTip }) {
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
      <div className="wh-board-wrap"><WhBoard rarity={rarity} boardData={board} play={play} art={art} onTip={onTip} claimed={claimed} /></div>
      {finished && <WhResult result={result} claimed={claimed} locked={locked} onAgain={onAgain} onMore={onMore} onPacks={onPacks} onTip={onTip} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  Ticket eingelöst: Vollbild-Animation (Leinwand 30 Hz, Rasterzelle 4): das Ticket schlägt in die Karte ein, die Karte lädt sich in der Farbe der neuen
//  Rarity auf (Strahlen, Funken, Zittern), Schachbrett-Blitz, dann erscheint die neue Karte groß mit ihren Effekten. Danach „Nice!“.
// ═══════════════════════════════════════════════════════════════════════════
function WhUpgrade({ up, onClose }) {
  const bgRef = useRef(null), fgRef = useRef(null), cardsRef = useRef(null);
  const [stage, setStage] = useState(0);              // 0 Anflug · 1 Aufladen · 2 neue Karte
  const [ready, setReady] = useState(false);
  const [shake, setShake] = useState([0, 0]);
  const col = WH_RCOL[up.to] || '#fad54a';
  useEffect(() => {
    whWarm();
    const bg = bgRef.current, fg = fgRef.current; if (!bg || !fg) return undefined;
    const S = 4, CW = Math.ceil(window.innerWidth / S), CH = Math.ceil(window.innerHeight / S);
    bg.width = fg.width = CW * S; bg.height = fg.height = CH * S;
    const b = bg.getContext('2d'), f = fg.getContext('2d'); b.imageSmoothingEnabled = f.imageSmoothingEnabled = false;
    const cx = Math.floor(CW / 2), cy = Math.floor(CH / 2) - 4;
    const rnd = whRng(Date.now() & 0xffffff);
    const cell = (c, x, y, color) => { c.fillStyle = color; c.fillRect(Math.round(x) * S, Math.round(y) * S, S, S); };
    const stars = Array.from({ length: 160 }, () => ({ x: Math.floor(rnd() * CW), y: Math.floor(rnd() * CH), p: Math.floor(rnd() * 20) }));
    const parts = []; let frame = 0, raf = 0, done = false, flash = 0, shakeT = 0, popped = false;
    const rings = [];
    const addParts = (n, fromCard) => { for (let i = 0; i < n && parts.length < 320; i++) { const a = rnd() * Math.PI * 2, r = fromCard ? 16 + rnd() * 14 : 2; parts.push({ x: cx + Math.cos(a) * r * 1.1, y: cy + Math.sin(a) * r * 1.5, vx: (rnd() - 0.5) * 0.5, vy: -(0.5 + rnd() * 1.1), life: 22 + Math.floor(rnd() * 22), c: i % 3 === 0 ? '#ffffff' : (i % 3 === 1 ? col : '#fad54a') }); } };
    const T_HIT = 14, T_FLASH = 48;
    const tick = () => {
      if (done) return;
      // Hintergrund: dunkel, Sternenfeld (flackernd), ab dem Aufladen Strahlen
      b.fillStyle = '#08060c'; b.fillRect(0, 0, bg.width, bg.height);
      for (const st of stars) if (((frame + st.p) >> 3) & 1) cell(b, st.x, st.y, (st.x + st.y) % 5 === 0 ? '#ffffff' : '#7e7d9b');
      if (frame >= T_HIT) {
        const t = frame - T_HIT, L = Math.min(Math.hypot(CW, CH) / 2 + 8, t * 3.2), ph = frame * 0.035;
        for (let k = 0; k < 28; k++) {
          const a = k * Math.PI * 2 / 28 + ph * (k % 2 ? 1 : -1), dx = Math.cos(a), dy = Math.sin(a), c = k % 2 ? col : '#ffffff';
          for (let r = 10; r < L; r += 1) if ((r + k + (frame >> 1)) % 4) { cell(b, cx + dx * r * 1.0, cy + dy * r * 0.9, c); if (k % 2 === 0) cell(b, cx + dx * r * 1.0 + 1, cy + dy * r * 0.9, c); }
        }
      }
      // Vordergrund: Ticket, Funken, Ringe, Blitz
      f.clearRect(0, 0, fg.width, fg.height);
      if (frame < T_HIT) {
        const p = frame / T_HIT, e = p * p, x = Math.round(cx - 70 + 70 * e), y = Math.round(cy - 60 + 60 * e);
        WH_TICKET_GRID.forEach((row, j) => [...row].forEach((ch, i) => { if (ch === '.') return; const pc = { K: '#12101f', Y: '#fad54a', O: '#c68206', W: '#ffffff', A: WH_RCOL[up.from], B: col }[ch]; f.fillStyle = pc; f.fillRect((x - 20 + i * 2) * S, (y - 11 + j * 2) * S, S * 2, S * 2); }));
        // Schweif
        for (let k = 1; k <= 6; k++) if ((k + frame) % 2) { cell(f, x - 22 - k * 4, y - 12 - k * 3, '#ffffff'); cell(f, x - 20 - k * 4, y - 6 - k * 3, col); }
      }
      if (frame === T_HIT) { whPlay('heavy_impact', { volume: 1 }); whPlay('critical_strike', { volume: 0.7 }); rings.push({ r: 2, max: 30, c: '#ffffff', t: 0 }); shakeT = 10; flash = 2; addParts(40, true); setStage(1); setTimeout(() => whPlay('pull_swell', { volume: 0.8 }), 120); }
      if (frame > T_HIT && frame < T_FLASH && frame % 2 === 0) addParts(5, true);
      if (frame > T_HIT && frame < T_FLASH) shakeT = Math.max(shakeT, 2);
      if (frame === T_FLASH - 6) whPlay('ascension', { volume: 0.9 });
      if (frame === T_FLASH) { flash = 4; shakeT = 14; rings.push({ r: 2, max: 46, c: col, t: 0 }, { r: 8, max: 54, c: '#ffffff', t: 0 }); addParts(120, true); setStage(2); whPlay('pull_sparkle', { volume: 0.9 }); whPlay('pull_reveal', { volume: 0.8 }); whPlay('heavy_impact', { volume: 0.8 }); }
      if (frame === T_FLASH + 14 && !popped) { popped = true; whPlay('victory', { volume: 0.55 }); }
      if (frame === T_FLASH + 16) setReady(true);
      if (frame > T_FLASH && frame % 3 === 0) addParts(3, true);
      for (let i = parts.length - 1; i >= 0; i--) { const q = parts[i]; q.x += q.vx; q.y += q.vy; q.vy += 0.03; q.life--; if (q.life <= 0) { parts.splice(i, 1); continue; } cell(f, q.x, q.y, q.life % 3 === 0 ? '#ffffff' : q.c); cell(f, q.x + 1, q.y, q.c); }
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i]; r.r += 1.6; r.t++; if (r.r > r.max) { rings.splice(i, 1); continue; }
        const R = Math.round(r.r);
        for (let a = 0; a < 64; a++) { const ang = a * Math.PI * 2 / 64; if (((a + r.t) & 1) === 0) cell(f, cx + Math.cos(ang) * R * 1.0, cy + Math.sin(ang) * R * 0.85, r.c); }
      }
      if (flash > 0) { f.fillStyle = '#ffffff'; for (let y = 0; y < CH; y++) for (let x = (y + frame) & 1; x < CW; x += (flash > 2 ? 1 : 2)) f.fillRect(x * S, y * S, S, S); flash--; }
      if (shakeT > 0) { shakeT--; setShake([Math.round((rnd() - 0.5) * 6) * S / 2, Math.round((rnd() - 0.5) * 6) * S / 2]); if (shakeT === 0) setShake([0, 0]); }
      frame++;
      raf = whRaf(tick);
    };
    raf = whRaf(tick);
    return () => { done = true; try { window.cancelAnimationFrame(raf); } catch (e) { /* ohne */ } };
  }, []);   // eslint-disable-line
  return (
    <div className="wh-up" style={shake[0] || shake[1] ? { transform: 'translate(' + shake[0] + 'px,' + shake[1] + 'px)' } : undefined} onClick={() => { if (ready) onClose(); }}>
      <canvas ref={bgRef} className="wh-up-cv wh-up-bg" />
      <div className="wh-up-center" ref={cardsRef}>
        {stage < 2 ? (
          <div className={'wh-up-card wh-up-from' + (stage === 1 ? ' wh-up-charge' : '')}><div className="bp-sc-face"><img src={bpCardUrl(up.name, up.from)} alt="" draggable={false} /></div></div>
        ) : (
          <div className="wh-up-card wh-up-to wh-up-pop"><WhBigCard name={up.name} rarity={up.to} /></div>
        )}
        {stage === 2 && <div className="wh-up-title" style={{ color: col }}>UPGRADE!</div>}
        {stage === 2 && <div className="wh-up-name">{whCardName(up.name)}<span style={{ color: WH_RCOL[up.from] }}>{' ' + whT(whRarityLabel(up.from))}</span>{' → '}<span style={{ color: col }}>{whT(whRarityLabel(up.to))}</span></div>}
        {ready && <button className="btn btn-primary wh-go wh-up-ok" onClick={onClose}>{up.left > 0 ? window.ppT('Next ticket ({0} left)').replace('{0}', up.left) : 'Nice!'}</button>}
      </div>
      <canvas ref={fgRef} className="wh-up-cv wh-up-fg" />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  Reiter
// ═══════════════════════════════════════════════════════════════════════════
function WheelShop({ sc, onSc, notify, onPacks, onLock }) {
  const [state, setState] = useState(null);
  const [view, setView] = useState('rarity');          // rarity | gallery | board | play
  const [rarity, setRarity] = useState(null);
  const [mode, setMode] = useState('throw');           // throw | ticket
  const [stake, setStake] = useState(null);            // { cards: {name: n}, n }
  const [busy, setBusy] = useState(false);
  const [played, setPlayed] = useState(null);          // { id, board, result }
  const [packArt, setPackArt] = useState({ packs: [], golden: [], umbra: [] });
  const [upgrade, setUpgrade] = useState(null);       // { name, from, to, left } nach einem Ticket
  const [galleryKey, setGalleryKey] = useState(0);
  const [pools, setPools] = useState(null);
  const [cos, setCos] = useState({});                // zufällige Beispiele (Avatar/Sleeve/Skin), neu gewürfelt beim Betreten des Boards
  const [tip, setTip] = useState(null);
  const load = () => window.ppWheelApi.state().then(r => { if (r.ok) setState(r.data); else notify(r.data.error || whT('Failed to load wheel'), 'error'); });
  useEffect(() => {
    load(); whWarm();
    fetch('/api/wheel/pools', { headers: window.AUTH_TOKEN ? { 'x-auth-token': window.AUTH_TOKEN } : {} }).then(r => r.ok ? r.json() : null).then(setPools).catch(() => {});
    window.ppBoosterApi.list().then(r => { if (r.ok && r.data && r.data.packs) {
      const o = { packs: [], golden: [], umbra: [] };
      r.data.packs.forEach(pk => (pk.variants || []).forEach((v, i) => { const u = bpAsset(v.base); if (v.special === 'golden') o.golden.push(u); else if (v.special === 'umbra') o.umbra.push(u); else if (i === 0) o.packs.push(u); }));
      setPackArt(o);
    } });
  }, []);   // eslint-disable-line
  // Ergebnis-Menü sperren, solange gewonnene Packs ungeöffnet sind (Rad-Knöpfe, andere Shop-Reiter, Shop verlassen)
  const packsOpen = !!(played && !played.claimed && (played.result.arrows || []).some(a => a.kind === 'booster' || a.kind === 'golden' || a.kind === 'jackpot'));
  useEffect(() => { if (onLock) onLock(packsOpen); }, [packsOpen]);   // eslint-disable-line
  useEffect(() => () => { if (onLock) onLock(false); }, []);   // eslint-disable-line
  // Escape verlässt den Shop sonst über den globalen Handler (app-main): solange Packs offen sind, schlucken wir es (capture, vor dem globalen Handler)
  useEffect(() => {
    if (!packsOpen) return undefined;
    const block = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); } };
    window.addEventListener('keydown', block, true);
    return () => window.removeEventListener('keydown', block, true);
  }, [packsOpen]);
  if (!state) return <div className="wh-hint" style={{ padding: 40 }}>Loading…</div>;
  const art = { samples: state.samples || {}, packs: packArt.packs, golden: packArt.golden, umbra: packArt.umbra, cos };

  const toRarities = () => { setView('rarity'); setStake(null); setPlayed(null); setMode('throw'); setTip(null); load(); };
  const toMore = () => { setStake(null); setPlayed(null); setMode('throw'); setTip(null); load(); setView('gallery'); };
  const throwIt = async (boardId, force) => {
    if (busy) return; setBusy(true);
    try {
      const r = await window.ppWheelApi.throw({ rarity, board: boardId, cards: stake.cards, ...(force && force.length ? { force } : {}) });
      if (!r.ok) { notify((r.data && r.data.error) || whT('Throw failed'), 'error'); setBusy(false); return; }
      if (r.data.sc != null) onSc(r.data.sc);
      // Emote-/Titel-Preise: Anzeigename, Bild und Text auflösen
      (r.data.arrows || []).forEach(a => {
        if (!a.prize || !a.prize.id) return;
        if (a.kind === 'emote') { a.prize.src = window.ppEmUrl(a.prize.id); a.prize.label = window.ppEmName((window.ppEmData.eById || {})[a.prize.id]); }
        else if (a.kind === 'title') { const ti = window.ppTitleInfo(a.prize.id); a.prize.label = ti ? ti.text : a.prize.id; }
      });
      whPlay('shop_purchase', { volume: 0.5 });
      setPlayed({ id: Date.now(), board: state.boards[rarity].find(b => b.id === boardId), result: r.data });
      setView('play');
    } catch (e) { notify(e.message, 'error'); }
    setBusy(false);
  };
  const openPacks = async () => {
    const r = await window.ppBoosterApi.pending();
    const list = r.ok && r.data && (r.data.packs && r.data.packs.length ? r.data.packs : (r.data.pending ? [r.data.pending] : null));
    if (list && onPacks) onPacks(list, (data) => setPlayed(p => (p ? { ...p, claimed: (data && data.added) || [] } : p))); else notify(whT('No packs to open.'), 'error');
  };
  const useTicket = async (cards) => {
    const name = Object.keys(cards)[0];
    const r = await window.ppWheelApi.ticket(rarity, name);
    if (!r.ok) { notify((r.data && r.data.error) || whT('Ticket failed'), 'error'); return; }
    setUpgrade({ name, from: rarity, to: r.data.to, left: (r.data.tickets || {})[rarity] || 0 });
  };

  return (
    <div className="wh-root">
      {view === 'rarity' && <WhRarityPick state={state} onPick={(r) => { setRarity(r); setMode('throw'); setView('gallery'); }} onTicket={(r) => { setRarity(r); setMode('ticket'); setView('gallery'); }} />}
      {view === 'gallery' && <WhGallery key={rarity + mode + galleryKey} rarity={rarity} mode={mode} tickets={(state.tickets || {})[rarity]} notify={notify} onBack={toRarities}
        onGo={(cards, n) => { if (mode === 'ticket') useTicket(cards); else { setStake({ cards, n }); setCos(whRollCos(pools)); setView('board'); } }} />}
      {view === 'board' && stake && <WhBoardPick rarity={rarity} stakeN={stake.n} state={state} art={art} busy={busy} onBack={() => setView('gallery')} onThrow={throwIt} />}
      {view === 'play' && played && <WhPlay key={played.id} rarity={rarity} board={played.board} result={played.result} art={art} claimed={played.claimed} locked={packsOpen} onAgain={toRarities} onMore={toMore} onPacks={openPacks} onTip={setTip} />}
      {upgrade && <WhUpgrade up={upgrade} onClose={() => { const left = upgrade.left; setUpgrade(null); if (left > 0) { setGalleryKey(k => k + 1); load(); } else toRarities(); }} />}
      <WhTip tip={tip} />
    </div>
  );
}
window.WheelShop = WheelShop;
