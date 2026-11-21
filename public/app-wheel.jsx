// ═══════════════════════════════════════════════════════════════════════════
//  GLÜCKSRAD (Shop-Reiter „Wheel“): überzählige Karten einer Rarity einsetzen, je Karte fliegt ein Dartpfeil auf ein Board mit Gewinnfeldern.
//
//    window.WheelShop    Reiter: Rarity wählen → Galerie (Karten markieren) → Board wählen (3 je Rarity) → Bestätigung → Wurf → Ergebnis
//    window.ppWheelApi   { state(), cards(rarity), throw(body), ticket(rarity, card) } → { ok, status, data }
//
//  Server-Vertrag: wheel-api.js (alles Zufällige passiert dort). Tabellen/Quoten: wheel.js (window.PpWheel; hier nur die Vorschau).
//  Grafik: alles Pixelart. Die Felder sind DOM (Text bleibt scharf und übersetzbar), die Pfeile eine EINZIGE Leinwand (30 Hz, ganzzahlige
//  Rasterzelle S, feste Palette, keine Verläufe/Schatten-Unschärfe). Alle Namen tragen das Präfix `wh` (alle Bundles teilen einen globalen Gültigkeitsbereich).
// ═══════════════════════════════════════════════════════════════════════════

const whRaf = (cb) => (window.ppTaktRaf || window.requestAnimationFrame)(cb);
const whT = (s) => (window.ppT ? window.ppT(s) : s);
const whRarityLabel = (r) => (window.PpRarities && window.PpRarities.LABEL && window.PpRarities.LABEL[r]) || r;
const whCardName = (n) => (window.PP_I18N && window.PP_I18N.names && window.PP_I18N.names[n]) || n;

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

// Rarity-Farben der Kacheln (Palette wird beim Zeichnen eingerastet)
const WH_RCOL = {
  uncommon: '#80bf59', rare: '#1ca9fd', prismatic: '#fc69c6', super: '#fad54a', storm: '#7fdfff', spectral: '#ac87de', stained: '#ff8566', umbra: '#b4cff8',
};

// ── Felder: Anzeige je Preisart ─────────────────────────────────────────────
function whFieldInfo(kind) {
  // Texte kommen schon übersetzt zurück (whT); `cls`/`rar` steuern nur die Optik
  if (kind === 'none') return { cls: 'none', label: whT('Nothing') };
  if (kind.startsWith('card:')) { const r = kind.slice(5); return { cls: 'card', rar: r, label: whT(whRarityLabel(r)), sub: whT('Card') }; }
  if (kind.startsWith('ticket:')) { const r = kind.slice(7), n = window.PpRarities.ORDER[window.PpRarities.rank(r) + 1]; return { cls: 'ticket', rar: n, label: whT('Ticket'), sub: whT(whRarityLabel(r)) + ' → ' + whT(whRarityLabel(n)) }; }
  if (kind.startsWith('boost:')) return { cls: 'boost', label: whT('Luck Boost'), sub: kind.slice(6) === '1' ? 'S' : kind.slice(6) === '2' ? 'M' : 'L' };
  const sc = { sc10: '10 SC', sc20: '20 SC', sc50: '50 SC' };
  if (sc[kind]) return { cls: 'coin', label: sc[kind] };
  switch (kind) {
    case 'booster': return { cls: 'pack', label: whT('Booster Pack') };
    case 'golden': return { cls: 'golden', label: whT('Golden Pack') };
    case 'jackpot': return { cls: 'jackpot', label: whT('JACKPOT') };
    case 'avatar': return { cls: 'cos', label: whT('Avatar') };
    case 'sleeve': return { cls: 'cos', label: whT('Sleeve') };
    case 'skin': return { cls: 'cos', label: whT('Skin') };
    case 'spin3': return { cls: 'spin', label: whT('+3 Darts') };
    default: return { cls: 'none', label: kind };
  }
}
const whPct = (p) => (p >= 10 ? p.toFixed(0) : p >= 1 ? p.toFixed(1) : p >= 0.1 ? p.toFixed(2) : p.toFixed(2)) + '%';

// ── Layout: Treemap (quadratische Streifen) auf das Raster ─────────────────
const WH_BW = 160, WH_BH = 100;       // Board in Rasterzellen
function whSquarify(items, x, y, w, h, out) {
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
    if (w >= h) {          // Spalte links
      const cw = rs / h; let cy = y;
      for (const i of row) { const ch = i.s / cw; out[i.k] = { x, y: cy, w: cw, h: ch }; cy += ch; }
      x += cw; w -= cw;
    } else {               // Zeile oben
      const rh = rs / w; let cx = x;
      for (const i of row) { const cw2 = i.s / rh; out[i.k] = { x: cx, y, w: cw2, h: rh }; cx += cw2; }
      y += rh; h -= rh;
    }
  }
}
function whLayout(table) {
  const keys = Object.keys(table).filter(k => table[k] > 0);
  // Fläche ∝ Wahrscheinlichkeit^0,8 (milde Stauchung, damit auch seltene Zettel lesbar bleiben); die genauen Chancen stehen in der Liste darunter
  const items = keys.map(k => ({ k, a: Math.pow(Math.max(table[k], 0.16), 0.8) })).sort((a, b) => b.a - a.a);
  const raw = {};
  whSquarify(items, 0, 0, WH_BW, WH_BH, raw);
  const out = {};
  for (const k of keys) {
    const r = raw[k]; if (!r) continue;
    const x = Math.round(r.x), y = Math.round(r.y), x2 = Math.round(r.x + r.w), y2 = Math.round(r.y + r.h);
    out[k] = { x, y, w: Math.max(3, x2 - x), h: Math.max(3, y2 - y) };
  }
  return out;
}

// Pfeil (Rasterzellen, Spitze oben): 1 Zelle Spitze, 3 Schaft, 2 Federn
const WH_DART = [[0, 0, 'tip'], [0, 1, 'shaft'], [0, 2, 'shaft'], [0, 3, 'shaft'], [-1, 4, 'fea'], [0, 4, 'fea'], [1, 4, 'fea'], [-1, 5, 'fea2'], [1, 5, 'fea2']];
const WH_DCOL = { tip: '#e6e6e6', shaft: '#9d612f', fea: '#e94e53', fea2: '#9d342f' };

// ═══════════════════════════════════════════════════════════════════════════
//  Board-Ansicht (Felder + Pfeil-Leinwand); `play` = { arrows, onFinish } startet die Wurf-Animation
// ═══════════════════════════════════════════════════════════════════════════
function WhBoard({ rarity, boardData, play, small }) {
  const wrapRef = useRef(null), cvRef = useRef(null);
  const [S, setS] = useState(3);
  const table = boardData.table;
  const layout = useMemo(() => whLayout(table), [table]);
  const [counts, setCounts] = useState({});
  const [overlays, setOverlays] = useState([]);
  const [bonusBanner, setBonusBanner] = useState(false);
  const finishRef = useRef(null);
  finishRef.current = play && play.onFinish;

  useEffect(() => {
    const fit = () => {
      const el = wrapRef.current && wrapRef.current.parentNode; if (!el) return;
      const w = el.clientWidth || 640;
      const cap = small ? 3 : 8;
      setS(Math.max(2, Math.min(cap, Math.floor(w / WH_BW))));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [small]);

  // Wurf-Animation
  useEffect(() => {
    if (!play || !cvRef.current) return undefined;
    const cv = cvRef.current, ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const W = WH_BW * S, H = WH_BH * S;
    const stuck = document.createElement('canvas'); stuck.width = W; stuck.height = H;
    const sctx = stuck.getContext('2d'); sctx.imageSmoothingEnabled = false;
    const arrows = play.arrows;
    const paid = arrows.filter(a => !a.bonus), bonus = arrows.filter(a => a.bonus);
    // Zeitplan (Bilder à 33 ms): bezahlte Pfeile in ~2,3 s, Bonus-Pfeile danach als zweite Welle
    const FLY = 9, PAID_SPAN = Math.min(90, 20 + Math.round(paid.length / 4)), BONUS_AT = PAID_SPAN + FLY + 14, BONUS_SPAN = Math.min(60, 12 + Math.round(bonus.length / 4));
    const specsSoFar = []; let ovNow = [];
    const sched = arrows.map((a, i) => {
      const inPaid = !a.bonus, idx = inPaid ? paid.indexOf(a) : bonus.indexOf(a);
      const n = inPaid ? paid.length : bonus.length, span = inPaid ? PAID_SPAN : BONUS_SPAN;
      const start = (inPaid ? 0 : BONUS_AT) + Math.floor(idx * span / Math.max(1, n));
      // Zielpunkt im Feld (deterministisch gestreut); Überdeckungen gelten für Pfeile NACH dem Boost-Treffer
      const rect = whTargetRect(a, layout, ovNow);
      if (a.kind.startsWith('boost:') && a.spec) { specsSoFar.push(a.spec); ovNow = whOverlayRects(specsSoFar, table, layout, window.PpWheel); }
      const h1 = ((i * 2654435761) >>> 0) / 4294967296, h2 = ((i * 40503 + 7) >>> 0) % 997 / 997;
      const tx = rect.x + 1 + Math.floor(h1 * Math.max(1, rect.w - 3)), ty = rect.y + 1 + Math.floor(h2 * Math.max(1, rect.h - 7));
      const sx = Math.floor(WH_BW / 2 + (h1 - 0.5) * 30), sy = WH_BH + 8;
      return { a, start, land: start + FLY, tx, ty, sx, sy, kind: a.kind };
    });
    const lastLand = sched.reduce((m, s) => Math.max(m, s.land), 0);
    const cnt = {}; let frame = 0, raf = 0, done = false, ov = [];
    const cell = (c, x, y, col) => { c.fillStyle = col; c.fillRect(x * S, y * S, S, S); };
    const drawDart = (c, x, y) => { for (const [dx, dy, t] of WH_DART) cell(c, x + dx, y + dy, WH_DCOL[t]); };
    const finish = () => {
      if (done) return; done = true;
      // alle noch nicht gelandeten Pfeile sofort landen lassen
      for (const s of sched) if (s.land >= frame) { drawDart(sctx, s.tx, s.ty); cnt[s.kind] = (cnt[s.kind] || 0) + 1; }
      setCounts({ ...cnt });
      ov = whOverlaysFinal(arrows, table, layout); setOverlays(ov);
      draw();
      if (finishRef.current) finishRef.current();
    };
    play.skipRef && (play.skipRef.current = finish);
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(stuck, 0, 0);
      for (const s of sched) {
        if (frame < s.start || frame > s.land) continue;
        const p = (frame - s.start) / FLY, e = 1 - (1 - p) * (1 - p);
        drawDart(ctx, Math.round(s.sx + (s.tx - s.sx) * e), Math.round(s.sy + (s.ty - s.sy) * e));
      }
    };
    const tick = () => {
      if (done) return;
      let changed = false;
      for (const s of sched) {
        if (s.land === frame) {
          drawDart(sctx, s.tx, s.ty); cnt[s.kind] = (cnt[s.kind] || 0) + 1; changed = true;
          if (s.kind.startsWith('boost:')) { ov = whOverlaysUpTo(arrows, s.a.i, table, layout); setOverlays(ov); }
        }
      }
      if (frame === BONUS_AT - 6 && bonus.length) setBonusBanner(true);
      if (frame === BONUS_AT + 14) setBonusBanner(false);
      if (changed) setCounts({ ...cnt });
      draw();
      if (frame > lastLand + 12) { finish(); return; }
      frame++;
      raf = whRaf(tick);
    };
    raf = whRaf(tick);
    return () => { done = true; try { window.cancelAnimationFrame(raf); } catch (e) { /* ohne */ } };
  }, [play, S, layout]);   // eslint-disable-line

  const fields = Object.keys(layout);
  const sz = (n) => n * S;
  return (
    <div className={'wh-board wh-theme-' + boardData.id + (small ? ' wh-board-small' : '')} ref={wrapRef}
         style={{ width: sz(WH_BW), height: sz(WH_BH), '--whs': S + 'px' }}>
      {fields.map(k => {
        const r = layout[k], f = whFieldInfo(k);
        // Schriftgröße (in Rasterzellen) passt sich der Zettelbreite an; zu schmal → keine Beschriftung (Tooltip + Liste zeigen sie)
        const fs = Math.min(2.8, (r.w - 2) / (Math.max(...f.label.split(' ').map(w => w.length)) * 1.0)), showLbl = fs >= 1.5 && r.h >= 5, big = showLbl && r.h >= 9 && r.w >= 16;
        const rar = f.rar ? WH_RCOL[f.rar] : null;
        return (
          <div key={k} className={'wh-note wh-n-' + f.cls + (k === 'none' ? ' wh-n-nothing' : '')} title={f.label + (f.sub ? ' (' + f.sub + ')' : '') + ' — ' + whPct(table[k])}
               style={{ left: sz(r.x + 1), top: sz(r.y + 1), width: sz(r.w - 2), height: sz(r.h - 2), ...(rar ? { '--whc': rar } : {}) }}>
            <span className="wh-pin" />
            {showLbl && <span className="wh-lbl" style={{ fontSize: 'calc(var(--whs) * ' + fs.toFixed(2) + ')' }}>{f.label}</span>}
            {big && f.sub && <span className="wh-sub">{f.sub}</span>}
            {counts[k] > 0 && <span className="wh-cnt">{'×' + counts[k]}</span>}
          </div>
        );
      })}
      {overlays.map((o, i) => (
        <div key={'o' + i} className={'wh-note wh-n-boost-cover wh-n-' + whFieldInfo(o.make).cls} style={{ left: sz(o.x), top: sz(o.y), width: sz(o.w), height: sz(o.h) }}>
          <span className="wh-lbl">{whFieldInfo(o.make).label}</span>
        </div>
      ))}
      <canvas ref={cvRef} className="wh-cv" width={sz(WH_BW)} height={sz(WH_BH)} />
      {bonusBanner && <div className="wh-bonus">{whT('BONUS DARTS!')}</div>}
    </div>
  );
}

// Boost-Überdeckungen: je Boost ein Zettel über dem größten niedrigeren Feld (Größe ∝ umgeschichtete Wahrscheinlichkeit)
function whOverlaysUpTo(arrows, uptoI, table, layout) {
  const specs = [];
  for (const a of arrows) { if (a.i > uptoI) break; if (a.kind.startsWith('boost:') && a.spec) specs.push(a.spec); }
  return whOverlayRects(specs, table, layout, window.PpWheel);
}
function whOverlaysFinal(arrows, table, layout) { return whOverlaysUpTo(arrows, Infinity, table, layout); }
function whOverlayRects(specs, table, layout, W) {
  const out = []; if (!specs.length) return out;
  let t = table;
  const hostKey = layout.none ? 'none' : Object.keys(layout).sort((a, b) => layout[b].w * layout[b].h - layout[a].w * layout[a].h)[0];
  const host = layout[hostKey]; let slot = 0;
  for (const spec of specs) {
    const eff = W.applyBoosts(t, [spec]);
    const moved = Math.max(0.05, (eff[spec.make] || 0) - (t[spec.make] || 0));
    const area = Math.max(12, Math.round(moved / 100 * WH_BW * WH_BH));
    const w = Math.max(8, Math.min(host.w - 4, Math.round(Math.sqrt(area * 1.8)))), h = Math.max(5, Math.min(host.h - 4, Math.round(area / w)));
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

// ═══════════════════════════════════════════════════════════════════════════
//  Schritt 1: Rarity wählen
// ═══════════════════════════════════════════════════════════════════════════
function WhRarityPick({ state, onPick, onTicket }) {
  const tix = Object.keys(state.tickets || {}).filter(r => state.tickets[r] > 0);
  return (
    <div className="wh-step">
      <p className="wh-intro">Trade in cards you do not need: every card you stake is one dart on the board. Pick a rarity.</p>
      <div className="wh-rar-grid">
        {state.ticketRarities && window.PpWheel.INPUT_RARITIES.map(r => {
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
//  Schritt 2: Galerie (jede Kopie ein Bild; markieren/abwählen)
// ═══════════════════════════════════════════════════════════════════════════
function WhGallery({ rarity, mode, state, onBack, onGo, notify }) {
  const [cards, setCards] = useState(null);
  const [sel, setSel] = useState(() => new Set());     // Schlüssel "<Name>#<k>"
  const [typeF, setTypeF] = useState(''), [subF, setSubF] = useState(''), [q, setQ] = useState('');
  const single = mode === 'ticket';
  useEffect(() => {
    let live = true;
    window.ppWheelApi.cards(rarity).then(r => { if (!live) return; if (r.ok) setCards(r.data.cards || []); else { notify(r.data.error || whT('Failed to load cards'), 'error'); setCards([]); } });
    return () => { live = false; };
  }, [rarity]);
  const CB = window.CARDS_BY_NAME || {};
  const tiles = useMemo(() => {
    const out = [];
    for (const c of cards || []) for (let k = 0; k < c.total; k++) out.push({ key: c.name + '#' + k, name: c.name, locked: k >= c.free });
    out.sort((a, b) => whCardName(a.name).localeCompare(whCardName(b.name)) || (a.locked - b.locked) || a.key.localeCompare(b.key));
    return out;
  }, [cards]);
  const types = useMemo(() => [...new Set(tiles.map(t => (CB[t.name] || {}).cardType).filter(Boolean))].sort(), [tiles]);
  const subs = useMemo(() => [...new Set(tiles.filter(t => !typeF || (CB[t.name] || {}).cardType === typeF).map(t => (CB[t.name] || {}).subtype).filter(Boolean))].sort(), [tiles, typeF]);
  const shown = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return tiles.filter(t => {
      const c = CB[t.name] || {};
      if (typeF && c.cardType !== typeF) return false;
      if (subF && c.subtype !== subF) return false;
      if (ql && !(t.name.toLowerCase().includes(ql) || whCardName(t.name).toLowerCase().includes(ql))) return false;
      return true;
    });
  }, [tiles, typeF, subF, q]);
  const max = single ? 1 : window.PpWheel.MAX_STAKE;
  const toggle = (t) => {
    if (t.locked) return;
    setSel(prev => {
      const n = new Set(prev);
      if (n.has(t.key)) n.delete(t.key);
      else { if (single) n.clear(); if (n.size >= max) { notify(window.ppT('You can stake at most {0} cards at once.').replace('{0}', max), 'error'); return prev; } n.add(t.key); }
      return n;
    });
  };
  const selectShown = () => setSel(prev => { const n = new Set(prev); for (const t of shown) { if (n.size >= max) break; if (!t.locked) n.add(t.key); } return n; });
  const go = () => {
    const m = {}; for (const k of sel) { const name = k.slice(0, k.lastIndexOf('#')); m[name] = (m[name] || 0) + 1; }
    onGo(m, sel.size);
  };
  return (
    <div className="wh-step wh-gallery">
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
        {sel.size > 0 && <button className="btn" onClick={() => setSel(new Set())}>Clear</button>}
      </div>
      {cards === null ? <div className="wh-hint">Loading…</div> : (
        <div className="wh-tiles">
          {shown.map(t => (
            <button key={t.key} className={'wh-tile' + (sel.has(t.key) ? ' wh-tile-sel' : '') + (t.locked ? ' wh-tile-lock' : '')} onClick={() => toggle(t)}
                    title={t.locked ? whT('In use in a deck') : whCardName(t.name)}>
              <img src={bpCardUrl(t.name, rarity)} alt={t.name} loading="lazy" draggable={false} />
              {sel.has(t.key) && <span className="wh-tick">✓</span>}
              {t.locked && <span className="wh-lock">DECK</span>}
            </button>
          ))}
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
function WhBoardPick({ rarity, stakeN, state, onBack, onThrow, busy }) {
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
              <div className="wh-pick-prev"><WhBoard rarity={rarity} boardData={b} small /></div>
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
function WhResult({ result, rarity, onAgain, onPacks }) {
  const cardsWon = {}, cos = [], packs = [];
  let sc = 0, nothing = 0, spins = 0; const tix = {};
  for (const a of result.arrows) {
    const k = a.kind, p = a.prize;
    if (k === 'none') nothing++;
    else if (k === 'spin3') spins++;
    else if (k.startsWith('card:') && p) { const id = p.name + '|' + p.rarity; (cardsWon[id] || (cardsWon[id] = { ...p, n: 0 })).n++; }
    else if (k.startsWith('ticket:')) tix[k.slice(7)] = (tix[k.slice(7)] || 0) + 1;
    else if (W_SC(k)) sc += W_SC(k);
    else if (k === 'booster' || k === 'golden' || k === 'jackpot') packs.push(k);
    else if (p && (k === 'avatar' || k === 'sleeve' || k === 'skin')) { if (p.maxed) sc += p.amount; else cos.push(p); }
  }
  const list = Object.values(cardsWon).sort((a, b) => window.PpRarities.rank(b.rarity) - window.PpRarities.rank(a.rarity) || a.name.localeCompare(b.name));
  const frameName = (d) => { const i = window.ppRankFrames ? window.ppRankFrames.rankOf(d) : null; return i == null ? 'Frame ' + d : window.ppRankFrames.RANKS[i].name + ' Frame'; };
  return (
    <div className="wh-result">
      <h3>Results</h3>
      <div className="wh-res-stats">
        <span>{window.ppT('Darts: {0}').replace('{0}', result.arrows.length)}</span>
        <span>{window.ppT('Nothing: {0}').replace('{0}', nothing)}</span>
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
      {list.length > 0 && (
        <div className="wh-res-cards">
          {list.map(c => (
            <div key={c.name + c.rarity} className="wh-rc" title={whCardName(c.name)}>
              <img src={bpCardUrl(c.name, c.rarity)} alt={c.name} loading="lazy" draggable={false} />
              {c.n > 1 && <span className="wh-cnt">{'×' + c.n}</span>}
            </div>
          ))}
        </div>
      )}
      <div className="wh-confirm"><button className="btn btn-primary" onClick={onAgain}>Back to rarities</button></div>
    </div>
  );
}
function W_SC(k) { return window.PpWheel.SC_AMOUNT[k] || 0; }

function WhPlay({ rarity, board, result, onAgain, onPacks }) {
  const [finished, setFinished] = useState(false);
  const skipRef = useRef(null);
  const play = useMemo(() => {
    // Boost-Treffern ihre Spezifikation mitgeben (Größe/Preis des Überdeckungs-Zettels)
    const specs = {}; (board.boosts ? Object.keys(board.boosts) : []).forEach(k => { specs[k] = board.boosts[k]; });
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
      <div className="wh-board-wrap"><WhBoard rarity={rarity} boardData={board} play={play} /></div>
      {finished && <WhResult result={result} rarity={rarity} onAgain={onAgain} onPacks={onPacks} />}
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
  const [played, setPlayed] = useState(null);          // { board, result }
  const load = () => window.ppWheelApi.state().then(r => { if (r.ok) setState(r.data); else notify(r.data.error || whT('Failed to load wheel'), 'error'); });
  useEffect(() => { load(); }, []);   // eslint-disable-line
  if (!state) return <div className="wh-hint" style={{ padding: 40 }}>Loading…</div>;

  const toRarities = () => { setView('rarity'); setStake(null); setPlayed(null); setMode('throw'); load(); };
  const throwIt = async (boardId) => {
    if (busy) return; setBusy(true);
    try {
      const r = await window.ppWheelApi.throw({ rarity, board: boardId, cards: stake.cards });
      if (!r.ok) { notify((r.data && r.data.error) || whT('Throw failed'), 'error'); setBusy(false); return; }
      if (r.data.sc != null) onSc(r.data.sc);
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
      {view === 'gallery' && <WhGallery key={rarity + mode} rarity={rarity} mode={mode} state={state} notify={notify} onBack={toRarities}
        onGo={(cards, n) => { if (mode === 'ticket') useTicket(cards); else { setStake({ cards, n }); setView('board'); } }} />}
      {view === 'board' && stake && <WhBoardPick rarity={rarity} stakeN={stake.n} state={state} busy={busy} onBack={() => setView('gallery')} onThrow={throwIt} />}
      {view === 'play' && played && <WhPlay key={played.id} rarity={rarity} board={played.board} result={played.result} onAgain={toRarities} onPacks={openPacks} />}
    </div>
  );
}
window.WheelShop = WheelShop;
