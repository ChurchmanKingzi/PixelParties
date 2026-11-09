// ═══════════════════════════════════════════════════════════════════════════
//  BOOSTERPACKS (Shop-Reiter „Boosterpacks“, Öffnung, Aufdecken)
//
//    window.ppBoosterApi          { list(), pending(), buy(packId), claim(id), ripMore(id), sell(id, index), display(), displayBuy(body) } → { ok, status, data }
//    window.BoosterShop           Reiter: die 9 Packs (Bild + Schimmerstreifen aus boosters.json, Name, Tagline, Preis, Kaufen) + rechts die Auslage (BpShowcase)
//    window.BoosterOpening        Vollbild: vorgerenderte Öffnungsanimation (opening.json) → 9 verdeckte Karten → aufdecken → „Sell Back!“ (eine Karte je Pack)
//                                 → „Add Cards To Collection“ oder „Add and rip one more!“ (löst ein und öffnet sofort ein Pack derselben Art)
//
//  Server-Vertrag (server.js):
//    GET  /api/boosters           → { price, packs: [{ id, name, tagline, variants: [{ id, theme, base, shimmer }] }] }
//    POST /api/boosters/buy       { packId } → { pending: { id, packId, variantId, cards: [{ name, rarity }] }, sc }   (bei offenem Pack: dessen pending)
//    GET  /api/boosters/pending   → { pending | null }
//    POST /api/boosters/claim     { id } → { added, … }            (die zurückverkaufte Karte wird nicht eingelöst)
//    POST /api/boosters/rip-more  { id } → { added, pending, sc }   (402/5xx mit claimed: true: das alte Pack ist trotzdem eingelöst)
//    POST /api/boosters/sell      { id, index } → { sold, amount, sc }   (409: aus diesem Pack wurde schon eine Karte verkauft)
//    GET  /api/boosters/display   → { hour, msLeft, nextAt, serverTime, cards: [{ rarity, name, price, owned, special?, fullPrice? }] }  (9 Plätze, der letzte = Sonderangebot)
//    POST /api/boosters/display/buy { slot, hour, name, rarity, price, special } → { card, owned, sc, display }   (409: Auslage hat gewechselt)
//
//  Grafik: alles Pixelart. Die Öffnung ist vorgerendert (data/shop/Boosterpacks/opening/, scripts/booster/build_opening.py): Bühne 320x416 Bildpunkte,
//  `<pack>.back.png` (hinter dem Pack) und `<pack>.front.png` (davor, samt den neun Karten) als Raster (9 Spalten), das Pack selbst (Bild + Schimmer
//  + gezackte Reißkante cut-top/cut-body) wird nach der Zeitleiste in GANZEN Bildpunkten verschoben. Die Bühne wird ganzzahlig vergrößert (Z).
//  Die Aufdeck-Effekte (je Rarity eskalierend) laufen in EINER Vollbild-Leinwand mit Rasterzelle S = max(2, Z) (Hero-Pixel-Regel aus CLAUDE.md,
//  ganzzahlig), 30 Hz (`ppTaktRaf`), feste Palette, Bayer-Dithering statt Alpha, keine Verläufe, kein Schein. Alle Namen hier tragen das Präfix `bp`
//  (alle Bundles teilen einen globalen Gültigkeitsbereich).
// ═══════════════════════════════════════════════════════════════════════════

const BP_DIR = '/data/shop/Boosterpacks/';
const BP_TAKT = 1000 / 30;
const bpRaf = (cb) => (window.ppTaktRaf || window.requestAnimationFrame)(cb);
const bpCancel = (id) => { try { window.cancelAnimationFrame(id); } catch (e) { /* ohne */ } };

const BP_RARITY_LABEL = {
  common: 'Common', uncommon: 'Uncommon', rare: 'Rare', prismatic: 'Prismatic', super: 'Super Rare',
  diamond: 'Diamond', spectral: 'Spectral', umbra: 'Umbra', stained: 'Stained Rare',
};
const bpRarityLabel = (r) => (window.PpRarities && window.PpRarities.LABEL && window.PpRarities.LABEL[r]) || BP_RARITY_LABEL[r] || r;
// ── Netz ────────────────────────────────────────────────────────────────────
window.ppBoosterApi = (() => {
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
    list: () => call('/boosters'),
    pending: () => call('/boosters/pending'),
    buy: (packId) => call('/boosters/buy', { method: 'POST', body: JSON.stringify({ packId }) }),
    claim: (id) => call('/boosters/claim', { method: 'POST', body: JSON.stringify({ id }) }),
    ripMore: (id) => call('/boosters/rip-more', { method: 'POST', body: JSON.stringify({ id }) }),
    sell: (id, index) => call('/boosters/sell', { method: 'POST', body: JSON.stringify({ id, index }) }),
    display: () => call('/boosters/display'),
    displayBuy: (body) => call('/boosters/display/buy', { method: 'POST', body: JSON.stringify(body) }),
  };
})();

// ── Bilder (zwischengespeichert) ────────────────────────────────────────────
const _bpImgs = new Map();
function bpImg(url) {
  let p = _bpImgs.get(url);
  if (!p) {
    p = new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => { _bpImgs.delete(url); rej(new Error('image ' + url)); };
      im.src = url;
    });
    _bpImgs.set(url, p);
  }
  return p;
}
const bpAsset = (rel) => BP_DIR + rel.split('/').map(encodeURIComponent).join('/');

// Klänge vorladen (playSFX holt unbekannte Namen beim ersten Aufruf, spielt ihn aber noch nicht): leiser Aufruf beim Betreten des Reiters
const BP_SOUNDS = ['booster_slide', 'booster_buildup', 'booster_rip', 'booster_strip', 'booster_burst', 'booster_glitter', 'booster_card_whoosh', 'booster_card_land', 'booster_ready', 'booster_umpf', 'shop_purchase',
  'draw', 'pull_sparkle', 'pull_note', 'gold_gain', 'elem_lightning', 'pull_shatter', 'laser', 'negate', 'elem_dark', 'heavy_impact', 'pull_crack', 'ascension', 'pull_reveal'];
let _bpWarm = false;
function bpWarmSounds() {
  if (_bpWarm || !window.playSFX) return;
  _bpWarm = true;
  BP_SOUNDS.forEach(n => { try { window.playSFX(n, { volume: 0, dedupe: 0 }); } catch (e) { /* ohne */ } });
}
const bpPlay = (name, opt) => { try { if (window.playSFX) window.playSFX(name, { dedupe: 0, ...(opt || {}) }); } catch (e) { /* stumm */ } };

// Kartenbild in der Basis der Rarity (Stempel, Rahmen, Namensfarbe): `?rar=<id>` an die Karten-URL (card-image-shim.js); die Effektebene legt PpRarityFx darüber
function bpCardUrl(name, rarity) {
  const base = (window.cardImageUrl && window.cardImageUrl(name)) || '/cardback.png';
  const F = window.PpRarityFx, r = F && F.imageRarity ? F.imageRarity(rarity) : '';
  return r ? base + (base.indexOf('?') >= 0 ? '&' : '?') + 'rar=' + r : base;
}

// Ganzzahliger Vergrößerungsfaktor für das Bühnenbild (320x416) bzw. das Packbild (192x320)
function bpStageScale(vw, vh) { return Math.max(1, Math.floor(Math.min(vw / 320, vh / 416))); }

// ═══════════════════════════════════════════════════════════════════════════
//  SHOP-REITER
// ═══════════════════════════════════════════════════════════════════════════
// Eine Kachel: Packbild + Schimmerstreifen (16 Bilder à 60 ms) in einer Leinwand; die Cover-Varianten wechseln alle paar Sekunden (harter Schnitt).
// Läuft nur, solange die Kachel sichtbar ist (IntersectionObserver), im 30-Hz-Takt, zeichnet nur bei Bildwechsel.
function BpPackCanvas({ pack, zoom }) {
  const cvRef = useRef(null);
  const [vi, setVi] = useState(0);
  const variants = pack.variants || [];
  const v = variants[vi % Math.max(1, variants.length)] || null;
  useEffect(() => {
    const cv = cvRef.current;
    if (!cv || !v) return undefined;
    let dead = false, raf = 0, sicht = true, base = null, shim = null, letzt = -1;
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    const io = (typeof IntersectionObserver !== 'undefined') ? new IntersectionObserver(es => { sicht = es[es.length - 1].isIntersecting; if (sicht && !raf && !dead) raf = bpRaf(tick); }, { threshold: 0 }) : null;
    if (io) io.observe(cv);
    const t0 = performance.now();
    function tick(t) {
      raf = 0;
      if (dead || !base) return;
      if (!sicht) return;
      const f = Math.floor((t - t0) / 60) % 16;
      if (f !== letzt) {
        letzt = f;
        g.clearRect(0, 0, 192, 320);
        g.drawImage(base, 0, 0);
        if (shim) g.drawImage(shim, f * 192, 0, 192, 320, 0, 0, 192, 320);
      }
      raf = bpRaf(tick);
    }
    Promise.all([bpImg(bpAsset(v.base)), v.shimmer ? bpImg(bpAsset(v.shimmer)).catch(() => null) : Promise.resolve(null)]).then(([b, s]) => {
      if (dead) return;
      base = b; shim = s;
      if (sicht && !raf) raf = bpRaf(tick);
    }).catch(() => {});
    return () => { dead = true; if (raf) bpCancel(raf); if (io) io.disconnect(); };
  }, [v && v.id]);
  // Cover-Wechsel: alle ~3 s die nächste Variante (je Kachel versetzt)
  useEffect(() => {
    if (variants.length < 2) return undefined;
    const iv = setInterval(() => { if (!document.hidden) setVi(i => (i + 1) % variants.length); }, 3200 + (pack.id.length % 5) * 170);
    return () => clearInterval(iv);
  }, [variants.length]);
  return (
    <div className="bp-pack-wrap" data-pp-px="aus">
      <canvas ref={cvRef} className="bp-pack-cv" width={192} height={320} style={{ width: 192 * zoom, height: 320 * zoom }} />
      {v && <div className="bp-pack-theme">{v.theme}</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  AUSLAGE (Showcase): 9 Plätze, je Rarity eine Karte (Uncommon … Stained Rare), der letzte Platz ist das Sonderangebot zum halben Preis.
//  Wechselt jede volle Stunde (UTC) für alle Spieler gleich; der Server würfelt (rarities.js rollDisplay) und prüft Kauf, Stunde und Preis.
// ═══════════════════════════════════════════════════════════════════════════
const bpClock = (ms) => { const t = Math.max(0, Math.ceil(ms / 1000)), m = Math.floor(t / 60), s = t % 60; return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s; };

// Eine Karte der Auslage: Kartenbild in der Basis der Rarity + animierte Effektebene (PpRarityFx), nur solange sichtbar (das Modul beobachtet das selbst).
function BpShowCard({ card }) {
  const hostRef = useRef(null);
  useEffect(() => {
    const F = window.PpRarityFx;
    if (!hostRef.current || !F || (F.available && !F.available(card.rarity))) return undefined;
    let h = null;
    try { h = F.attach(hostRef.current, { card: (window.CARDS_BY_NAME && window.CARDS_BY_NAME[card.name]) || { name: card.name }, rarity: card.rarity, animated: true }); } catch (e) { h = null; }
    return () => { try { h && h.destroy && h.destroy(); } catch (e) { /* ohne */ } };
  }, [card.name, card.rarity]);
  return (
    <div className="bp-sc-face" ref={hostRef} data-pp-px="aus">
      <img src={bpCardUrl(card.name, card.rarity)} alt={bpRarityLabel(card.rarity) + ' ' + card.name} draggable={false} />
    </div>
  );
}

function BpShowcase({ sc, onSc, notify }) {
  const [disp, setDisp] = useState(null);       // { hour, nextAt, cards }
  const [left, setLeft] = useState(0);          // ms bis zum Wechsel
  const [busy, setBusy] = useState(-1);         // Platz, dessen Kauf gerade läuft
  const [added, setAdded] = useState({ slot: -1, n: 0 });   // kurze Bestätigung „Added!“ am Knopf
  const offRef = useRef(0), dispRef = useRef(null), loadingRef = useRef(false), addedTimer = useRef(0);
  dispRef.current = disp;

  const apply = (d) => {
    if (!d || !d.cards) return;
    offRef.current = (d.serverTime || Date.now()) - Date.now();
    setDisp(d);
    setLeft(Math.max(0, d.nextAt - (Date.now() + offRef.current)));
  };
  const load = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try { const r = await window.ppBoosterApi.display(); if (r.ok) apply(r.data); } catch (e) { /* nächster Takt versucht es wieder */ }
    loadingRef.current = false;
  }, []);
  useEffect(() => { load(); return () => { clearTimeout(addedTimer.current); }; }, []);

  // Countdown im Sekundentakt; ist er abgelaufen (Stundenwechsel), wird die neue Auslage geholt (und bei Misserfolg im nächsten Takt wieder)
  useEffect(() => {
    const iv = setInterval(() => {
      const d = dispRef.current;
      if (!d) return;
      const ms = d.nextAt - (Date.now() + offRef.current);
      setLeft(Math.max(0, ms));
      if (ms <= 0 && !document.hidden) load();
    }, 1000);
    const vis = () => { const d = dispRef.current; if (!document.hidden && d && d.nextAt - (Date.now() + offRef.current) <= 0) load(); };
    document.addEventListener('visibilitychange', vis);
    return () => { clearInterval(iv); document.removeEventListener('visibilitychange', vis); };
  }, []);

  const buy = async (i) => {
    const d = dispRef.current, c = d && d.cards[i];
    if (!c || busy >= 0) return;
    if (!((sc || 0) >= c.price)) { notify && notify('Not enough 🪙!', 'error'); return; }
    setBusy(i);
    try {
      const r = await window.ppBoosterApi.displayBuy({ slot: i, hour: d.hour, name: c.name, rarity: c.rarity, price: c.price, special: !!c.special });
      if (r.ok) {
        if (r.data.sc != null && onSc) onSc(r.data.sc);
        if (r.data.display) apply(r.data.display);
        bpPlay('shop_purchase', { volume: 0.8 });
        setAdded(a => ({ slot: i, n: a.n + 1 }));
        clearTimeout(addedTimer.current);
        addedTimer.current = setTimeout(() => setAdded({ slot: -1, n: 0 }), 1500);
      } else if (r.status === 409 && r.data.display) {
        apply(r.data.display);
        notify && notify((r.data.error) || 'The showcase just changed.', 'error');
      } else if (r.status === 402) {
        if (r.data.sc != null && onSc) onSc(r.data.sc);
        notify && notify('Not enough 🪙!', 'error');
      } else notify && notify((r.data && r.data.error) || 'Purchase failed', 'error');
    } catch (e) { notify && notify(e.message, 'error'); }
    setBusy(-1);
  };

  const cards = (disp && disp.cards) || [];
  return (
    <aside className="bp-showcase" aria-label="Showcase">
      <div className="bp-sc-head">
        <div className="bp-sc-title">SHOWCASE</div>
        <div className="bp-sc-sub">One card of each rarity. Fresh picks every hour.</div>
        <div className="bp-sc-clock">Next rotation in <b>{disp ? bpClock(left) : '--:--'}</b></div>
      </div>
      {!disp && <div className="bp-sc-empty">Loading…</div>}
      <div className="bp-sc-grid">
        {cards.map((c, i) => {
          const can = (sc || 0) >= c.price && busy < 0;
          const just = added.slot === i;
          return (
            <div key={disp.hour + ':' + i + ':' + c.name} className={'bp-sc-cell bp-sc-r-' + c.rarity + (c.special ? ' bp-sc-special' : '')}>
              {c.special && <div className="bp-sc-flag">HALF PRICE</div>}
              <BpShowCard card={c} />
              <div className="bp-sc-name" title={c.name}>{c.name}</div>
              <div className="bp-sc-rar">{bpRarityLabel(c.rarity)}{c.owned > 0 ? <span className="bp-sc-own" title="Copies you own"> ×{c.owned}</span> : null}</div>
              <div className="bp-sc-buyrow">
                <div className="bp-sc-price" title={c.special ? 'Special offer: half price (normally ' + c.fullPrice + ' SC)' : c.price + ' SC'}>
                  <img src="/data/sc.png" className="bp-coin" alt="" />
                  {c.special && <s className="bp-sc-old">{c.fullPrice}</s>}
                  <b>{c.price}</b>
                </div>
                <button type="button" className={'btn bp-sc-buy' + (just ? ' bp-sc-added' : '')} disabled={!can && !just} onClick={() => buy(i)}
                  title={(sc || 0) < c.price ? 'Not enough Smug Coins' : 'Buy this card (' + bpRarityLabel(c.rarity) + ')'}>
                  {just ? 'ADDED!' : 'BUY'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function BoosterShop({ boosters, sc, busy, onBuy, onSc, notify }) {
  useEffect(() => { bpWarmSounds(); }, []);
  const packs = (boosters && boosters.packs) || [];
  const price = boosters && boosters.price != null ? boosters.price : 20;
  const zoom = 1;
  if (!packs.length) return <div className="shop-empty">Boosterpacks are not available right now</div>;
  const canBuy = !busy && sc >= price;
  return (
    <div className="bp-shop">
      <div className="bp-intro">
        <div className="bp-intro-title">BOOSTERPACKS</div>
        <div className="bp-intro-text">Every pack holds <b>9 Rarity Skins</b> for your cards: Uncommon, Rare, Prismatic, Super Rare, Diamond, Spectral, Umbra and, very rarely, Stained Rare.
          The last three cards of a pack are the luckiest. Don't like one? <b>Sell Back</b> a card from the pack you just opened.</div>
      </div>
      <div className="bp-layout">
        <div className="bp-layout-aside"><BpShowcase sc={sc} onSc={onSc} notify={notify} /></div>
        <div className="bp-grid">
          {packs.map(p => (
            <div key={p.id} className={'bp-tile' + (canBuy ? '' : ' bp-tile-off')}>
              <BpPackCanvas pack={p} zoom={zoom} />
              <div className="bp-name">{p.name}</div>
              <div className="bp-tagline">{p.tagline}</div>
              <button className="btn bp-buy" disabled={!canBuy} onClick={() => onBuy(p.id)}
                title={sc < price ? 'Not enough Smug Coins' : 'Buy and open this pack'}>
                BUY — <img src="/data/sc.png" className="shop-sc-icon" /> {price}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
window.BoosterShop = BoosterShop;

// ═══════════════════════════════════════════════════════════════════════════
//  AUFDECK-EFFEKTE (Pixelart-Leinwand über dem ganzen Bildschirm)
//  Koordinaten in Rasterzellen (S Bildschirmpixel). Jeder Effekt: { kind, cx, cy, t0 (Takt), seed, … }, `bpFxDraw` malt das Bild zur Taktnummer.
// ═══════════════════════════════════════════════════════════════════════════
const BPC = {
  white: '#ffffff', silver: '#d2d2db', grey: '#a8a8a8',
  goldL: '#f7f7ad', gold: '#fad54a', goldO: '#f29a3e', goldD: '#ee6428',
  cyan: '#1aedff', cyanL: '#b2eeee', sky: '#66d9ff', blue: '#1ca9fd', blueD: '#2f539d',
  pink: '#fa6bed', magenta: '#fb1ea9', purple: '#a040ff', purpleL: '#c98aff', violet: '#751ff9', plum: '#2b0b47', night: '#12101f', black: '#08060c',
  green: '#66ffa2', greenD: '#3ddc57', red: '#ef2929', redD: '#c80000', yellow: '#feff66', orange: '#ff9a1a',
};
const BP_RAINBOW = ['#ff1a1a', '#ff9a1a', '#ffe23d', '#3ddc57', '#1ac6ff', '#751ff9', '#fb1ea9'];

function bpRng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const BP_BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
const bpBay = (x, y) => (BP_BAYER[y & 3][x & 3] + 0.5) / 16;

// Pinsel auf einer Leinwand mit Rasterzellen: schreibt in einen Pixelspeicher (ein Zug je Bild), Palettenfarben als Hex-Texte
const _bpU32 = {};
function bpU32(c) {
  let v = _bpU32[c];
  if (v === undefined) { v = ((255 << 24) | (parseInt(c.slice(5, 7), 16) << 16) | (parseInt(c.slice(3, 5), 16) << 8) | parseInt(c.slice(1, 3), 16)) >>> 0; _bpU32[c] = v; }
  return v;
}
function bpPen(g, W, H) {
  const buf = new Uint32Array(W * H), img = new ImageData(new Uint8ClampedArray(buf.buffer), W, H);
  const pen = {
    W, H,
    clear() { buf.fill(0); },
    erase(x, y, w, h) { x = Math.floor(x); y = Math.floor(y); const x1 = Math.min(W, x + Math.floor(w)), y1 = Math.min(H, y + Math.floor(h)); x = Math.max(0, x); for (let j = Math.max(0, y); j < y1; j++) if (x1 > x) buf.fill(0, j * W + x, j * W + x1); },
    flush() { g.putImageData(img, 0, 0); },
    put(x, y, c) { x = Math.floor(x); y = Math.floor(y); if (x < 0 || y < 0 || x >= W || y >= H) return; buf[y * W + x] = bpU32(c); },
    rect(x, y, w, h, c) {
      x = Math.floor(x); y = Math.floor(y); w = Math.floor(w); h = Math.floor(h);
      const x1 = Math.min(W, x + w), y1 = Math.min(H, y + h); x = Math.max(0, x); y = Math.max(0, y);
      if (x1 <= x || y1 <= y) return;
      const v = bpU32(c);
      for (let j = y; j < y1; j++) buf.fill(v, j * W + x, j * W + x1);
    },
    // Rechteck mit Dichte d (0..1) als Bayer-Raster
    dither(x, y, w, h, d, c) {
      if (d <= 0) return;
      if (d >= 1) { pen.rect(x, y, w, h, c); return; }
      x = Math.floor(x); y = Math.floor(y); w = Math.floor(w); h = Math.floor(h);
      const v = bpU32(c), x1 = Math.min(W, x + w), y1 = Math.min(H, y + h);
      for (let j = Math.max(0, y); j < y1; j++) for (let i = Math.max(0, x); i < x1; i++) if (bpBay(i, j) < d) buf[j * W + i] = v;
    },
    // Funkelstern: Mitte + Arme der Länge r (r=0: nur Mitte)
    star(x, y, r, c, core) {
      x = Math.floor(x); y = Math.floor(y);
      pen.put(x, y, core || c);
      for (let k = 1; k <= r; k++) { pen.put(x + k, y, c); pen.put(x - k, y, c); pen.put(x, y + k, c); pen.put(x, y - k, c); }
    },
    // Ring der Dicke th um (cx, cy), Radius r, Dichte d (Zeile für Zeile)
    ring(cx, cy, r, c, d, th) {
      th = th || 1; const R1 = r + th / 2, R0 = Math.max(0, r - th / 2), v = bpU32(c);
      cx = Math.floor(cx); cy = Math.floor(cy);
      for (let dy = -Math.ceil(R1); dy <= Math.ceil(R1); dy++) {
        const y = cy + dy; if (y < 0 || y >= H) continue;
        const xo = Math.round(Math.sqrt(Math.max(0, R1 * R1 - dy * dy))), xi = Math.abs(dy) < R0 ? Math.round(Math.sqrt(R0 * R0 - dy * dy)) : 0;
        if (Math.abs(dy) > R1) continue;
        for (let side = -1; side <= 1; side += 2) {
          const a = side < 0 ? cx - xo : cx + xi, bnd = side < 0 ? cx - xi : cx + xo;
          for (let x = Math.max(0, a); x <= Math.min(W - 1, bnd); x++) { if (xi === 0 && side > 0 && x < cx) continue; if (d >= 1 || bpBay(x, y) < d) buf[y * W + x] = v; }
        }
      }
    },
    // Strecke in ganzen Zellen (Bresenham), Dicke th, Dichte d; bei dicken Strichen nur jeder k-te Punkt (Quadrate überlappen)
    line(x0, y0, x1, y1, c, th, d) {
      x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let err = dx + dy, guard = 0, n = 0;
      th = th || 1;
      const k = Math.max(1, th >> 1);
      for (;;) {
        if (n++ % k === 0 && (d == null || d >= 1 || bpBay(x0, y0) < d)) pen.rect(x0 - (th >> 1), y0 - (th >> 1), th, th, c);
        if ((x0 === x1 && y0 === y1) || ++guard > 4000) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
      }
    },
  };
  return pen;
}

// Splitter-Sprites (Diamond): vier Drehphasen eines Kristalls, Zellen relativ zur Mitte
const BP_KITE = [[0, -2], [-1, -1], [0, -1], [1, -1], [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0], [-1, 1], [0, 1], [1, 1], [0, 2]];
const BP_TALL = [[0, -3], [-1, -2], [0, -2], [1, -2], [-1, -1], [0, -1], [1, -1], [-1, 0], [0, 0], [1, 0], [-1, 1], [0, 1], [1, 1], [-1, 2], [0, 2], [1, 2], [0, 3]];
const BP_SHARD = [BP_KITE, BP_TALL, BP_KITE, BP_TALL.map(([x, y]) => [y, x])];

// Dauer der Effekte in Takten (30 Hz) und Verzögerung bis die Karte sichtbar wird (ms)
const BP_FX_LEN = { rare: 30, prismatic: 40, super: 44, diamond: 44, spectral: 48, umbra: 64, stained: 130 };
const BP_FACE_DELAY = { uncommon: 0, rare: 0, prismatic: 60, super: 120, diamond: 180, spectral: 120, umbra: 330, stained: 700 };

// Sammelstelle für die laufenden Effekte einer Leinwand
function bpFxCreate(cv, S, shakeEl) {
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  const W = Math.ceil(window.innerWidth / S) + 1, H = Math.ceil(window.innerHeight / S) + 1;
  cv.width = W; cv.height = H;
  cv.style.width = W * S + 'px'; cv.style.height = H * S + 'px';
  const pen = bpPen(g, W, H);
  const list = [];
  let raf = 0, tak = 0, last = -1, dead = false, shake = null;
  const api = { W, H, S };

  function spawn(kind, cx, cy, cw, ch, mix) {
    const seed = (Math.random() * 1e9) | 0, rnd = bpRng(seed);
    const e = { kind, cx, cy, cw, ch, t: 0, rnd, seed, P: [], mix: mix > 1 ? mix : 1 };
    init(e);
    list.push(e);
    if (kind === 'stained') shake = { t: 0, amp: mix > 1 ? 3 : 4 };
    if (!raf && !dead) raf = bpRaf(loop);
  }

  // ── Anfangszustände (Teilchen) ───────────────────────────────────────────
  function init(e) {
    const r = e.rnd, P = e.P;
    const edge = () => {   // Punkt auf dem Kartenrand + Richtung nach außen
      const side = r() * 2 * (e.cw + e.ch), hw = e.cw / 2, hh = e.ch / 2;
      let x, y, nx = 0, ny = 0;
      if (side < e.cw) { x = -hw + side; y = -hh; ny = -1; }
      else if (side < e.cw + e.ch) { x = hw; y = -hh + (side - e.cw); nx = 1; }
      else if (side < 2 * e.cw + e.ch) { x = hw - (side - e.cw - e.ch); y = hh; ny = 1; }
      else { x = -hw; y = hh - (side - 2 * e.cw - e.ch); nx = -1; }
      return { x, y, nx, ny };
    };
    const u = e.cw / 75;   // Größe der Karte in Zellen relativ zu 75 (Z = S: 1, Z = 1 bei S = 2: 0,5)
    e.u = Math.max(0.5, u);
    if (e.kind === 'rare') {
      const cols = [BPC.white, BPC.silver, BPC.white, BPC.silver, BPC.silver, BPC.cyan, BPC.pink, BPC.yellow, BPC.green];
      for (let i = 0; i < 30; i++) {
        const p = edge(), v = (0.4 + r() * 1.0) * e.u;
        P.push({ x: p.x, y: p.y, vx: p.nx * v + (r() - 0.5) * 0.6, vy: p.ny * v + (r() - 0.5) * 0.6 - 0.1, life: 14 + (r() * 14) | 0, ph: (r() * 4) | 0, c: cols[i % cols.length], big: r() < 0.45 });
      }
    } else if (e.kind === 'prismatic') {
      for (let i = 0; i < 42; i++) {
        const a = r() * Math.PI * 2, v = (0.8 + r() * 1.8) * e.u;
        P.push({ x: (r() - 0.5) * e.cw * 0.7, y: (r() - 0.5) * e.ch * 0.7, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 18 + (r() * 18) | 0, ci: i % 7, ph: (r() * 4) | 0 });
      }
    } else if (e.kind === 'super') {
      const cols = [BPC.goldL, BPC.gold, BPC.goldO, BPC.white, BPC.gold];
      for (let i = 0; i < 60; i++) {
        P.push({ x: (r() - 0.5) * e.cw, y: e.ch * 0.1 + r() * e.ch * 0.4, vx: (r() - 0.5) * 1.4 * e.u, vy: -(0.9 + r() * 2.4) * e.u, life: 18 + (r() * 24) | 0, c: cols[i % cols.length], ph: (r() * 4) | 0, big: r() < 0.4 });
      }
    } else if (e.kind === 'diamond') {
      const cols = [BPC.cyanL, BPC.sky, BPC.white, BPC.blue, BPC.cyanL];
      for (let i = 0; i < 26; i++) {
        const a = r() * Math.PI * 2, v = (0.9 + r() * 2.0) * e.u;
        P.push({ x: (r() - 0.5) * e.cw * 0.5, y: (r() - 0.5) * e.ch * 0.5, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.6, life: 22 + (r() * 18) | 0, c: cols[i % cols.length], s: (r() * 4) | 0, big: i % 3 === 0 });
      }
    } else if (e.kind === 'umbra') {
      const cols = [BPC.purple, BPC.violet, BPC.purpleL, BPC.purple, BPC.magenta];
      for (let i = 0; i < 46; i++) {
        const a = r() * Math.PI * 2, d = (6 + r() * 26) * e.u;
        P.push({ x: Math.cos(a) * d * 0.9, y: Math.sin(a) * d, vx: (r() - 0.5) * 0.3, vy: -(0.1 + r() * 0.5), life: 30 + (r() * 30) | 0, c: cols[i % cols.length], ph: (r() * 6) | 0, d: 4 + (r() * 12) | 0 });
      }
    } else if (e.kind === 'stained') {
      e.rays = e.mix > 1 ? 10 : 18; e.rot = (r() * 4) | 0;   // mehrere Effekte gleichzeitig (Flip All): weniger Strahlen, damit alle Karten sichtbar bleiben
    }
  }

  // ── Malen ────────────────────────────────────────────────────────────────
  function drawOne(e) {
    const t = e.t, X = e.cx, Y = e.cy, hw = e.cw / 2, hh = e.ch / 2, u = e.u;
    if (e.kind === 'rare') {
      for (const p of e.P) {
        if (t > p.life) continue;
        const x = X + p.x + p.vx * t, y = Y + p.y + p.vy * t;
        if (((t + p.ph) & 3) === 3) continue;                       // Funkeln: jeder vierte Takt aus
        const r = p.big && t < p.life - 5 ? 2 : (t > p.life - 4 ? 0 : 1);
        pen.star(x, y, r, p.c, BPC.white);
      }
      if (t < 5) pen.ring(X, Y, Math.max(hw, hh) * (0.55 + t * 0.12), BPC.silver, 0.6, 2);   // kurzer silberner Ring um die Karte
      return;
    }
    if (e.kind === 'prismatic') {
      // Regenbogen-Rahmen um die Karte, weitet sich in Stufen, vier Zellen dick
      if (t < 18) {
        const grow = 1 + Math.floor(t / 2), dens = t < 9 ? 1 : 1 - (t - 9) / 10;
        for (let s = 0; s < 4; s++) {
          const ox = hw + grow + s, oy = hh + grow + s;
          const per = 2 * (2 * ox + 2 * oy);
          for (let i = 0; i < per; i++) {
            let x, y;
            if (i < 2 * ox) { x = -ox + i; y = -oy; } else if (i < 2 * ox + 2 * oy) { x = ox; y = -oy + (i - 2 * ox); }
            else if (i < 4 * ox + 2 * oy) { x = ox - (i - 2 * ox - 2 * oy); y = oy; } else { x = -ox; y = oy - (i - 4 * ox - 2 * oy); }
            const gx = Math.floor(X + x), gy = Math.floor(Y + y);
            if (bpBay(gx, gy) < dens) pen.put(gx, gy, BP_RAINBOW[((i >> 2) + (t >> 1) + s) % 7]);
          }
        }
      }
      // Regenbogenband quer über die Karte (schräg, läuft von links nach rechts)
      if (t >= 6 && t < 26) {
        const k = (t - 6) / 20, bandW = Math.max(4, Math.round(7 * u)), dens = 0.9 - k * 0.5;
        for (let j = -Math.floor(hh); j < Math.floor(hh); j++) {
          const bx = -hw - 6 + (e.cw + 12) * k + j * 0.35;
          for (let i = 0; i < bandW; i++) {
            const gx = Math.floor(X + bx + i), gy = Math.floor(Y + j);
            if (gx < X - hw || gx >= X + hw) continue;
            if (bpBay(gx, gy) < dens) pen.put(gx, gy, BP_RAINBOW[(i + (j >> 2) + 70) % 7]);
          }
        }
      }
      for (const p of e.P) {
        if (t > p.life) continue;
        const x = X + p.x + p.vx * t, y = Y + p.y + p.vy * t;
        if (((t + p.ph) & 3) === 3) continue;
        for (let k = 5; k >= 0; k--) {   // Schweif: sechs Zellen, Farbe wandert den Regenbogen entlang
          const tx = x - p.vx * k * 0.9, ty = y - p.vy * k * 0.9;
          pen.put(tx, ty, BP_RAINBOW[(p.ci + (t >> 1) + k) % 7]);
        }
        pen.star(x, y, t < p.life - 6 ? 1 : 0, BPC.white, BPC.white);
      }
      return;
    }
    if (e.kind === 'super') {
      if (t < 6) pen.dither(X - hw, Y - hh, e.cw, e.ch, [0.85, 0.7, 0.5, 0.35, 0.2, 0.1][t], BPC.goldL);   // goldenes Aufleuchten der Karte
      // Lichtstreif: senkrechter Balken von der Kartenmitte zum oberen Bildrand, Breite pulsiert in Stufen
      if (t >= 1 && t < 24) {
        const w = Math.round(([4, 8, 12, 14, 14, 12, 14, 12, 10, 8, 8, 6, 6, 4, 4, 4, 4, 2, 2, 2, 2, 2, 2][Math.min(22, t - 1)] || 2) * Math.max(0.7, u));
        const dens = t < 15 ? 1 : 1 - (t - 15) / 9;
        const x0 = Math.floor(X - w / 2);
        pen.dither(x0 - 4, 0, w + 8, Y, dens * 0.3, BPC.gold);
        pen.dither(x0 - 2, 0, w + 4, Y, dens * 0.55, BPC.goldL);
        pen.dither(x0, 0, w, Y, dens, BPC.goldL);
        pen.dither(x0 + 2, 0, Math.max(1, w - 4), Y, dens * 0.9, BPC.white);
      }
      if (t < 8) pen.ring(X, Y, Math.max(hw, hh) * (0.6 + t * 0.16), BPC.gold, 1, 3);
      for (const p of e.P) {
        if (t > p.life) continue;
        const x = X + p.x + p.vx * t, y = Y + p.y + p.vy * t + 0.1 * t * t;
        if (((t + p.ph) & 3) === 3) continue;
        pen.star(x, y, p.big && t < p.life - 6 ? 2 : (t > p.life - 5 ? 0 : 1), p.c, BPC.white);
      }
      return;
    }
    if (e.kind === 'diamond') {
      // Blitz: Zickzack vom oberen Bildrand zur Karte (mit Abzweig), alle zwei Takte neu gewürfelt, Kern weiß, Rand türkis
      if (t < 10) {
        const rr = bpRng(e.seed + 977 * (t >> 1) + 13);
        let x = X + (rr() - 0.5) * 8, y = 0;
        const segs = 14, dy = Y / segs, pts = [[x, y]];
        for (let i = 1; i <= segs; i++) { x = i === segs ? X : x + (rr() - 0.5) * 20 + (X - x) * 0.2; y = i * dy; pts.push([x, y]); }
        const th = Math.max(3, Math.round(4 * u) + 2);
        for (let i = 1; i < pts.length; i++) pen.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], BPC.cyan, th);
        for (let i = 1; i < pts.length; i++) pen.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], BPC.white, Math.max(1, th - 3));
        const bi = 5 + ((rr() * 4) | 0), sx = rr() < 0.5 ? -1 : 1;   // Abzweig
        let bx = pts[bi][0], by = pts[bi][1];
        for (let i = 0; i < 4; i++) { const nx = bx + sx * (6 + rr() * 8), ny = by + 6 + rr() * 10; pen.line(bx, by, nx, ny, BPC.cyanL, 2); bx = nx; by = ny; }
      }
      if (t >= 2 && t < 10) pen.dither(X - hw - 4, Y - hh - 4, e.cw + 8, e.ch + 8, [0.9, 0.7, 0.5, 0.35, 0.2, 0.12, 0.06, 0.03][t - 2] || 0, BPC.white);   // Blitzlicht
      if (t >= 3 && t < 7) pen.dither(0, 0, pen.W, pen.H, [0.22, 0.14, 0.08, 0.04][t - 3], BPC.cyanL);                                                      // ganzer Schirm zuckt
      for (const p of e.P) {
        if (t > p.life || t < 2) continue;
        const k = t - 2, x = X + p.x + p.vx * k, y = Y + p.y + p.vy * k + 0.06 * k * k;
        const sp = BP_SHARD[(p.s + (k >> 1)) & 3];
        if (t > p.life - 6 && (t & 1)) continue;
        const sc = p.big ? 2 : 1;
        for (const [dx, dy] of sp) pen.rect(x + dx * sc, y + dy * sc, sc, sc, (dx === 0 && dy <= 0 && dy >= -1) || (dy === 0 && dx === -1) ? BPC.white : p.c);
      }
      return;
    }
    if (e.kind === 'spectral') {
      // Glitch-Wellen: Ringe in Treppen (jede Zeile um ±n verschoben), dazu Balken in Geisterfarben und Zeilenrauschen über der Karte; Takt der Störung 15 Hz
      const step = t >> 1, dens = t < 30 ? 1 : 1 - (t - 30) / 14;
      const R0 = 5 + t * 2.0;
      for (let k = 0; k < 3; k++) {
        const R = R0 - k * 10; if (R < 3) continue;
        const col = [BPC.cyan, BPC.magenta, BPC.green][k];
        for (let y = -R; y <= R; y += 1) {
          const half = Math.round(Math.sqrt(Math.max(0, R * R - y * y)));
          const off = Math.round((bpRng(e.seed + step * 131 + (y >> 1) * 7 + k)() - 0.5) * 8);
          if (bpBay(y + Y, k) < dens) { pen.rect(X - half + off, Y + y, 2, 1, col); pen.rect(X + half + off, Y + y, 2, 1, col); }
        }
      }
      const rb = bpRng(e.seed + step * 7919 + 17), nb = Math.round(16 * dens);
      for (let i = 0; i < nb; i++) {
        const y = Y - hh - 8 + rb() * (e.ch + 16), w = 10 + rb() * 70, x = X - hw - 24 + rb() * (e.cw + 48 - w * 0.4), h = 1 + (rb() * 3 | 0);
        const c = [BPC.cyan, BPC.magenta, BPC.green, BPC.white, BPC.night][(rb() * 5) | 0];
        pen.dither(x, y, w, h, c === BPC.night ? 1 : 0.9, c);
      }
      if (t < 24) {   // Zeilenrauschen: schmale Streifen quer über der Karte
        const rl = bpRng(e.seed + step * 31 + 5);
        for (let j = 0; j < 14; j++) {
          const y = Y - hh + rl() * e.ch, w = e.cw * (0.3 + rl() * 0.7), x = X - hw + rl() * (e.cw - w);
          pen.dither(x, y, w, 1, 0.8 * dens, rl() < 0.5 ? BPC.cyan : BPC.magenta);
        }
      }
      return;
    }
    if (e.kind === 'umbra') {
      // Dunkle Welle: dicker Ring läuft nach außen, verdunkelt dabei die Nachbarkarten (Dither) und trägt einen violetten Saum; lila Glut steigt auf und glimmt
      const maxR = Math.hypot(pen.W, pen.H) * 0.55, R = 3 + t * 2.6, dens = t < 38 ? 1 : Math.max(0, 1 - (t - 38) / 22);
      const th = Math.max(5, Math.round(14 * u) - (t >> 3));
      if (R < maxR && dens > 0) {
        pen.ring(X, Y, R, BPC.black, 0.95 * dens, th);
        pen.ring(X, Y, R - th * 0.5, BPC.plum, 0.7 * dens, Math.max(2, th * 0.4));
        pen.ring(X, Y, R + th * 0.5, BPC.violet, 0.8 * dens, 2);
        pen.ring(X, Y, R + th * 0.5 + 2, BPC.purpleL, 0.35 * dens, 1);
      }
      if (t < 12) pen.dither(X - hw - 3, Y - hh - 3, e.cw + 6, e.ch + 6, Math.max(0, 0.95 - t * 0.08), BPC.black);   // Verdunkelung bis die Karte erscheint
      for (const p of e.P) {
        if (t > p.life) continue;
        const x = X + p.x + p.vx * t, y = Y + p.y + p.vy * t - t * 0.35;
        const glow = ((t + p.ph) % 6) < 3;
        pen.put(x, y, glow ? p.c : BPC.violet);
        pen.put(x + 1, y, glow ? p.c : BPC.plum);
        if (glow && t < p.life - 8) { pen.put(x, y - 1, BPC.purpleL); pen.put(x + 1, y - 1, p.c); }
        if (p.d > 8 && t < p.life - 10) { pen.put(x, y + 1, BPC.plum); pen.put(x + 1, y + 1, BPC.plum); }
      }
      return;
    }
    if (e.kind === 'stained') {
      // Blitz über den ganzen Bildschirm (Weiß, dann Gold) in sechs Stufen
      const fl = [1, 0.85, 0.55, 0.3, 0.16, 0.08];
      if (t < fl.length) pen.dither(0, 0, pen.W, pen.H, fl[t] * (e.mix > 1 ? 0.5 : 1), t < 2 ? BPC.white : BPC.goldL);
      // Strahlen: 18 Strahlen mit Stained-Glass-Farben, drehen in Stufen, wachsen in 10 Takten, verlöschen per Dither
      const grow = Math.min(1, t / 10), dens = t < 44 ? 1 : Math.max(0, 1 - (t - 44) / 64);
      if (dens > 0) {
        const L = (Math.hypot(pen.W, pen.H) * (e.mix > 1 ? 0.4 : 0.62)) * grow, rot = (e.rot + (t >> 2)) * 0.07;
        const cols = [BPC.gold, BPC.red, BPC.purple, BPC.cyan, BPC.goldL, BPC.magenta];
        for (let i = 0; i < e.rays; i++) {
          const a = rot + (i / e.rays) * Math.PI * 2, c = cols[i % cols.length], ca = Math.cos(a), sa = Math.sin(a);
          const x0 = X + ca * 6, y0 = Y + sa * 6, x1 = X + ca * L, y1 = Y + sa * L;
          pen.line(x0, y0, x1, y1, c, 7, dens * 0.45);       // Keil: breiter Saum …
          pen.line(x0, y0, x1, y1, c, 4, dens * 0.7);
          pen.line(x0, y0, x1, y1, BPC.white, 2, dens * 0.5); // … weißer Kern
        }
        if (t > 3) pen.dither(X - 6, Y - 6, 12, 12, dens, BPC.white);
      }
      // Druckwellen
      for (let k = 0; k < 3; k++) { const tt = t - k * 6; if (tt > 0 && tt < 44) pen.ring(X, Y, tt * 3.4, [BPC.white, BPC.gold, BPC.red][k], 1 - tt / 44, 3); }
      // Funkenregen vom oberen Bildrand
      if (t >= 6 && t < 100) {
        const cols = [BPC.goldL, BPC.gold, BPC.red, BPC.purple, BPC.cyan, BPC.white, BPC.green, BPC.magenta];
        for (let i = 0; i < 90; i++) {
          const s = bpRng((e.seed + i * 2654435761) % 4294967296);
          const born = 6 + (s() * 84) | 0, x = s() * pen.W, v = 1.1 + s() * 1.9;
          if (t < born || t > born + 70) continue;
          const y = (t - born) * v;
          if (y > pen.H + 6) continue;
          const c = cols[(i * 5) % cols.length];
          pen.rect(x, y, 2, 2, BPC.white);
          pen.rect(x, y - 2, 2, 2, c); pen.rect(x, y - 4, 2, 2, c);
          if (v > 2) pen.rect(x, y - 6, 2, 2, c);
        }
      }
      return;
    }
  }

  function loop(now) {
    raf = 0;
    if (dead) return;
    const k = Math.floor(now / BP_TAKT);
    if (k === last) { raf = bpRaf(loop); return; }
    const dt = last < 0 ? 1 : Math.min(3, k - last);
    last = k;
    pen.clear();
    for (let i = list.length - 1; i >= 0; i--) {
      const e = list[i];
      e.S = S;
      drawOne(e);
      e.t += dt;
      if (e.t > (BP_FX_LEN[e.kind] || 40)) list.splice(i, 1);
    }
    // die enthüllten Stained-Karten bleiben frei von Strahlen und fremden Effekten (auch von denen gleichzeitig gespielter Karten)
    for (const e of list) if (e.kind === 'stained' && e.t >= 16) pen.erase(e.cx - e.cw / 2 - 1, e.cy - e.ch / 2 - 1, e.cw + 2, e.ch + 2);
    pen.flush();
    // Bildschirmzucken (Stained): Versatz der Bühne in ganzen Rasterzellen, verklingt in Stufen
    if (shake && shakeEl) {
      const a = shake.t < 8 ? shake.amp : shake.t < 16 ? 3 : shake.t < 24 ? 2 : shake.t < 32 ? 1 : 0;
      const q = bpRng(shake.t * 31 + 7);
      const dx = a ? Math.round((q() - 0.5) * 2 * a) * S : 0, dy = a ? Math.round((q() - 0.5) * 2 * a) * S : 0;
      shakeEl.style.transform = a ? 'translate(' + dx + 'px,' + dy + 'px)' : '';
      shake.t += dt;
      if (shake.t > 34) { shake = null; shakeEl.style.transform = ''; }
    }
    if (list.length || shake) raf = bpRaf(loop);
    else g.clearRect(0, 0, W, H);
  }

  api.spawn = spawn;
  api.destroy = () => { dead = true; if (raf) bpCancel(raf); if (shakeEl) shakeEl.style.transform = ''; list.length = 0; };
  api.busy = () => list.length > 0;
  return api;
}

// Klänge je Rarity beim Aufdecken [name, Optionen]
const BP_FLIP_SOUNDS = {
  uncommon: [['draw', { volume: 0.5 }]],
  rare: [['draw', { volume: 0.5 }], ['pull_sparkle', { volume: 0.5, delay: 60 }]],
  prismatic: [['pull_sparkle', { volume: 0.7 }], ['pull_note', { rate: 1.26, volume: 0.55, delay: 90 }], ['pull_note', { rate: 1.5, volume: 0.5, delay: 190 }]],
  super: [['gold_gain', { volume: 0.8 }], ['pull_sparkle', { volume: 0.7, delay: 100 }]],
  diamond: [['elem_lightning', { volume: 0.9 }], ['pull_shatter', { volume: 0.7, rate: 1.2, delay: 160 }]],
  spectral: [['laser', { volume: 0.6, rate: 1.9 }], ['negate', { volume: 0.7, rate: 1.4, delay: 110 }], ['pull_crack', { volume: 0.5, rate: 1.7, delay: 220 }]],
  umbra: [['elem_dark', { volume: 0.95 }], ['heavy_impact', { volume: 0.55, rate: 0.6, delay: 90 }], ['pull_swell', { volume: 0.6, rate: 0.7, delay: 200 }]],
  stained: [['heavy_impact', { volume: 1, rate: 0.4 }], ['pull_crack', { volume: 0.9, rate: 0.55, delay: 40 }], ['pull_shatter', { volume: 0.9, rate: 0.7, delay: 150 }],
    ['ascension', { volume: 0.9, delay: 300 }], ['pull_reveal', { volume: 0.9, rate: 0.8, delay: 650 }], ['heavy_impact', { volume: 0.7, rate: 0.3, delay: 700 }]],
};

// ═══════════════════════════════════════════════════════════════════════════
//  FLIP-ANIMATION (aus Rücken UND Vorderseite zusammengesetzt)
//  Die Karte dreht sich um die senkrechte Achse (Winkel a: 0 = Rücken liegt flach, 90 = Kante, 180 = Vorderseite liegt flach). Je Bildspalte wird
//  rückwärts abgetastet (nächster Nachbar, ganze Bildpunkte): Spalte → Quellspalte, Zeilen je Spalte nach der Perspektive (näher am Betrachter
//  höher: Ober-/Unterkante trapezförmig). Kanten-Schatten: Bayer-Dithering in Schwarz (zur abgewandten Seite dichter), harte dunkle Randspalte.
//  Keine Verläufe, kein Alpha: die Leinwand bekommt nur Palettenfarben und volle Deckkraft. Takt: 30 Hz, nur bei Winkelwechsel gezeichnet.
// ═══════════════════════════════════════════════════════════════════════════
const BP_FLIP_ANG = [0, 7, 18, 33, 52, 72, 90, 108, 128, 147, 162, 173, 180];   // Grad je Bild; Index 6 = Kante (Aufschlagen der Vorderseite folgt)
const BP_FLIP_EDGE = 6, BP_FLIP_LAST = BP_FLIP_ANG.length - 1;
const BP_EDGE_C = [bpU32('#d2d2db'), bpU32('#a8a8a8')], BP_DARK = bpU32('#08060c');

// Rand für die Perspektive (Bildpunkte), mit der die Leinwand größer ist als die Karte
const bpFlipPad = (ch) => Math.ceil(ch * 0.07) + 2;

// buf: Uint32Array CW×CH (wird gelöscht und neu gemalt); back/face: Uint32Array cw×ch (Quellbilder in Kartengröße)
function bpFlipDraw(buf, CW, CH, cw, ch, deg, back, face, E) {
  buf.fill(0);
  const a = deg * Math.PI / 180, sn = Math.sin(a), cs = Math.cos(a), D = cw * 5, cx = CW / 2, cy = CH / 2;
  const hf = cw / 2;
  const sAt = (x) => 1 / (1 - x * sn / D);
  if (Math.abs(cs) < 0.04) {
    // Kante: schmaler Streifen (E Bildpunkte breit), links abgewandt (kürzer), rechts zugewandt (länger)
    const x0 = Math.round(cx - E / 2);
    for (let k = 0; k < E; k++) {
      const X = x0 + k, s = sAt(-hf + (k + 0.5) / E * cw), h = Math.round(ch * s), top = Math.round(cy - h / 2);
      const col = BP_EDGE_C[k < E / 2 ? 1 : 0];
      for (let Y = Math.max(0, top); Y < Math.min(CH, top + h); Y++) buf[Y * CW + X] = ((Y + X) & 1) && k === 0 ? BP_DARK : col;
    }
    return;
  }
  const front = cs < 0, src = front ? face : back;
  const xpOf = (x) => x * cs / (1 - x * sn / D);
  const p0 = xpOf(-hf), p1 = xpOf(hf), lo = Math.min(p0, p1), hi = Math.max(p0, p1);
  const X0 = Math.max(0, Math.floor(cx + lo)), X1 = Math.min(CW - 1, Math.ceil(cx + hi));
  const sh = Math.abs(sn);
  let first = -1, last = -1;
  for (let X = X0; X <= X1; X++) {
    const xp = X + 0.5 - cx, x = xp / (cs + xp * sn / D);
    if (!(x >= -hf && x <= hf)) continue;
    if (first < 0) first = X; last = X;
    const s = sAt(x), h = ch * s, top = cy - h / 2;
    let u = front ? hf - x : x + hf; u = u < 0 ? 0 : u >= cw ? cw - 1 : Math.floor(u);
    // Schatten: je näher an der Kante und je weiter abgewandt, desto dichter; bei flacher Karte (0°/180°) keiner
    const far = (1 - x / hf) / 2, dens = sh * sh * (0.04 + 0.4 * far);
    const Y0 = Math.max(0, Math.ceil(top)), Y1 = Math.min(CH, Math.ceil(top + h));
    for (let Y = Y0; Y < Y1; Y++) {
      let r = Math.floor((Y + 0.5 - top) / h * ch); r = r < 0 ? 0 : r >= ch ? ch - 1 : r;
      let c = src[r * cw + u];
      if (dens > 0 && (BP_BAYER[Y & 3][X & 3] + 0.5) / 16 < dens) c = BP_DARK;
      buf[Y * CW + X] = c;
    }
  }
  // harte Randspalten (nur solange die Karte merklich schräg steht)
  if (sh > 0.25 && first >= 0) {
    for (const X of [first, last]) {
      const xp = X + 0.5 - cx, x = xp / (cs + xp * sn / D), h = ch * sAt(x), top = Math.round(cy - h / 2);
      for (let Y = Math.max(0, top); Y < Math.min(CH, top + Math.round(h)); Y++) buf[Y * CW + X] = BP_DARK;
    }
  }
}

// Quellbilder in Kartengröße (ganze Bildpunkte, nächster Nachbar): Rücken aus dem 75x105-Sprite der Öffnung, Vorderseite aus dem Kartenbild
const _bpPix = new Map();
function bpPixels(url, cw, ch) {
  const key = url + '|' + cw + 'x' + ch;
  let p = _bpPix.get(key);
  if (!p) {
    p = bpImg(url).then(im => {
      const c = document.createElement('canvas'); c.width = cw; c.height = ch;
      const g = c.getContext('2d', { willReadFrequently: true }); g.imageSmoothingEnabled = false;
      g.drawImage(im, 0, 0, im.naturalWidth || im.width, im.naturalHeight || im.height, 0, 0, cw, ch);
      const d = g.getImageData(0, 0, cw, ch).data, out = new Uint32Array(cw * ch);
      for (let i = 0; i < out.length; i++) out[i] = ((255 << 24) | (d[i * 4 + 2] << 16) | (d[i * 4 + 1] << 8) | d[i * 4]) >>> 0;
      return out;
    });
    _bpPix.set(key, p);
    p.catch(() => _bpPix.delete(key));
    if (_bpPix.size > 40) _bpPix.delete(_bpPix.keys().next().value);
  }
  return p;
}

// ═══════════════════════════════════════════════════════════════════════════
//  EINE KARTE IM PACK
// ═══════════════════════════════════════════════════════════════════════════
// Zustand `ph`: 0 verdeckt · 1 dreht sich (Leinwand mit der Flip-Animation) · 2 fertig (Kartenbild + Rarity-Ebene).
// `hold` = Bilder, die die Karte auf der Kante stehen bleibt (hohe Rarities: der Effekt baut sich auf, bevor die Vorderseite aufschlägt).
// `sold`: diese Karte wurde zurückverkauft (ausgegraut, „Sold“); `sellOff`: Sell Back ist für dieses Pack schon verbraucht/gesperrt; `sellValue`: SC-Gutschrift
function BpCard({ idx, card, geom, open, hold, onEdge, onDone, onClick, onHover, hot, sold, sellOff, sellValue, onSell }) {
  const [ph, setPh] = useState(0);
  const hostRef = useRef(null), cvRef = useRef(null);
  const cbRef = useRef({}); cbRef.current = { onEdge, onDone };
  const Z = geom.Z, cw = geom.cw, ch = geom.ch, pad = bpFlipPad(ch);
  const url = bpCardUrl(card.name, card.rarity);
  useEffect(() => {
    if (!open) { setPh(0); return undefined; }
    let dead = false, raf = 0, t0 = performance.now(), lastIdx = -1, edged = false, backPix = null, facePix = null;
    const CW = cw + 2 * pad, CH = ch + 2 * pad, E = Math.max(4, Z * 2);
    setPh(1);
    const cv = cvRef.current;
    if (!cv) return undefined;
    const g = cv.getContext('2d');
    const buf = new Uint32Array(CW * CH), img = new ImageData(new Uint8ClampedArray(buf.buffer), CW, CH);
    Promise.all([bpPixels(BP_DIR + 'opening/cardback.png', cw, ch), bpPixels(url, cw, ch)]).then(([b, f]) => { backPix = b; facePix = f; }).catch(() => { backPix = backPix || new Uint32Array(cw * ch).fill(BP_DARK); facePix = facePix || backPix; });
    const tick = (now) => {
      raf = 0;
      if (dead) return;
      if (!backPix) { t0 = now; raf = bpRaf(tick); return; }              // Quellbilder noch nicht da: noch nichts zeichnen
      let f = Math.floor((now - t0) / BP_TAKT), i;
      if (f <= BP_FLIP_EDGE) i = f;
      else if (f < BP_FLIP_EDGE + hold || !facePix) { i = BP_FLIP_EDGE; if (!facePix) t0 = now - (BP_FLIP_EDGE + hold) * BP_TAKT; }
      else i = Math.min(BP_FLIP_LAST, f - hold);
      if (i >= BP_FLIP_EDGE && !edged) { edged = true; try { cbRef.current.onEdge && cbRef.current.onEdge(idx); } catch (e) { /* ohne */ } }
      if (i !== lastIdx) {
        lastIdx = i;
        if (i >= BP_FLIP_LAST) { setPh(2); try { cbRef.current.onDone && cbRef.current.onDone(idx); } catch (e) { /* ohne */ } return; }
        bpFlipDraw(buf, CW, CH, cw, ch, BP_FLIP_ANG[i], backPix, facePix || backPix, E);
        g.putImageData(img, 0, 0);
      }
      raf = bpRaf(tick);
    };
    raf = bpRaf(tick);
    return () => { dead = true; if (raf) bpCancel(raf); };
  }, [open, cw, ch, url]);
  const done = ph >= 2;
  // Rarity-Ebene (Agent B, public/rarity-fx.js): animiert, sobald die Karte offen ist; ohne Modul/ohne Ebene bleibt es beim Kartenbild
  useEffect(() => {
    if (!done || !hostRef.current || sold) return undefined;     // zurückverkaufte Karte: keine Effektebene mehr
    const F = window.PpRarityFx;
    if (!F || card.rarity === 'common' || (F.available && !F.available(card.rarity))) return undefined;
    let h = null;
    try { h = F.attach(hostRef.current, { card: (window.CARDS_BY_NAME && window.CARDS_BY_NAME[card.name]) || { name: card.name }, rarity: card.rarity, animated: true, size: cw }); } catch (e) { h = null; }
    return () => { try { h && h.destroy && h.destroy(); } catch (e) { /* ohne */ } };
  }, [done, card.rarity, card.name, !!sold]);
  const [sx, sy] = geom.slots[idx];
  const style = { left: geom.left + sx * Z, top: geom.top + sy * Z, width: cw, height: ch, '--bpz': Z };
  return (
    <div className={'bp-card' + (open ? ' bp-card-open' : ' bp-card-shut') + (open && !done ? ' bp-card-flip' : '') + (done ? ' bp-card-done' : '') + (hot ? ' bp-card-hot' : '') + (sold ? ' bp-card-sold' : '')} style={style}
      onClick={() => { if (!open) onClick(idx); }}
      onMouseEnter={() => onHover(idx, true)} onMouseLeave={() => onHover(idx, false)}
      role="button" tabIndex={open ? -1 : 0} aria-label={open ? bpRarityLabel(card.rarity) + ' ' + card.name : 'Card ' + (idx + 1) + ', face down'}
      onKeyDown={(e) => { if (!open && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick(idx); } }}>
      {open && <div className="bp-card-ground" />}
      {open && (
        <div className="bp-card-face" ref={hostRef} style={{ visibility: done ? 'visible' : 'hidden' }}>
          <img src={url} alt="" draggable={false} />
        </div>
      )}
      {done && sold && <div className="bp-sold-dim" />}
      {done && sold && <div className="bp-sold-tag">SOLD</div>}
      {done && sellValue > 0 && (
        <button type="button" className={'bp-sell' + (sold ? ' bp-sell-sold' : '')} disabled={sellOff || sold}
          title={sold ? 'Sold back' : sellOff ? 'You can sell back one card per pack' : 'Sell this card back for ' + sellValue + ' SC (one card per pack)'}
          onClick={(e) => { e.stopPropagation(); if (!sellOff && !sold) onSell(idx); }}>
          {sold ? 'Sold' : <React.Fragment>Sell Back! <span className="bp-sell-val">+{sellValue}</span></React.Fragment>}
        </button>
      )}
      {open && !done && (
        <canvas ref={cvRef} className="bp-card-flipcv" width={cw + 2 * pad} height={ch + 2 * pad} style={{ left: -pad, top: -pad, width: cw + 2 * pad, height: ch + 2 * pad }} />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  ÖFFNUNG (Vollbild)
// ═══════════════════════════════════════════════════════════════════════════
// Props: pending { id, packId, variantId, cards, sold }, boosters (GET /api/boosters: price, sellback), sc (Kontostand), onSc(n), onClaimed(data, info), onRipMore(data)
function BoosterOpening({ pending, boosters, sc, onSc, onClaimed, onRipMore }) {
  const cards = pending.cards || [];
  const pack = ((boosters && boosters.packs) || []).find(p => p.id === pending.packId) || { id: pending.packId, name: pending.packId, variants: [] };
  const variant = (pack.variants || []).find(v => v.id === pending.variantId) || (pack.variants || [])[0] || null;

  const [phase, setPhase] = useState('load');         // 'load' | 'play' | 'cards'
  const [err, setErr] = useState('');
  const [flipped, setFlipped] = useState(() => cards.map(() => false));
  const flippedRef = useRef(flipped); flippedRef.current = flipped;
  const [doneN, setDoneN] = useState(0);              // Karten, deren Flip-Animation fertig ist
  const [claiming, setClaiming] = useState(false);
  const [sold, setSold] = useState(() => (Number.isInteger(pending.sold) ? pending.sold : -1));   // Index der zurückverkauften Karte (-1: keine); überlebt Neuladen (Server)
  const [selling, setSelling] = useState(false);
  const [note, setNote] = useState('');                // kurze Meldung im HUD (Sell Back / Add and rip one more)
  const [hover, setHover] = useState(-1);
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [op, setOp] = useState(null);                  // opening.json

  const stageRef = useRef(null), fxRef = useRef(null), worldRef = useRef(null);
  const fx = useRef(null), playRef = useRef(null), mixRef = useRef(1);
  const skipRef = useRef(false);

  useEffect(() => {
    const on = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  useEffect(() => { bpWarmSounds(); }, []);
  useEffect(() => () => {
    if (fx.current) fx.current.destroy();
    // die beiden großen Raster (je ~57 MB entpackt) nicht im Zwischenspeicher halten
    const R = playRef.current; if (R) { _bpImgs.delete(R.backUrl); _bpImgs.delete(R.frontUrl); playRef.current = null; }
  }, []);

  // Geometrie: Bühne mittig, ganzzahliger Faktor Z, Ursprung auf Rasterzellen (S) ausgerichtet
  const Z = bpStageScale(vp.w, vp.h), S = Math.max(2, Z);
  const geom = useMemo(() => {
    const stage = op ? op.stage : [320, 416];
    const left = Math.max(0, Math.round((vp.w - stage[0] * Z) / 2 / S) * S), top = Math.max(0, Math.round((vp.h - stage[1] * Z) / 2 / S) * S);
    const size = op ? op.cardSize : [75, 105];
    return { Z, S, stage, left, top, slots: op ? op.cardSlots : cards.map(() => [0, 0]), cw: size[0] * Z, ch: size[1] * Z };
  }, [vp.w, vp.h, op]);

  // Laden: opening.json, Schichten des Packs, Packbild (+ Reißmasken); dann die Animation starten
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const o = await fetch(BP_DIR + 'opening/opening.json').then(r => { if (!r.ok) throw new Error('opening.json'); return r.json(); });
        if (dead) return;
        const [back, front, base, top, body] = await Promise.all([
          bpImg(BP_DIR + 'opening/' + o.layers.back.replace('<pack>', pending.packId)),
          bpImg(BP_DIR + 'opening/' + o.layers.front.replace('<pack>', pending.packId)),
          variant ? bpImg(bpAsset(variant.base)) : Promise.reject(new Error('variant')),
          bpImg(BP_DIR + 'opening/' + o.cut.top), bpImg(BP_DIR + 'opening/' + o.cut.body),
        ]);
        const shim = variant && variant.shimmer ? await bpImg(bpAsset(variant.shimmer)).catch(() => null) : null;
        if (dead) return;
        // Siegelstreifen / Rest als eigene Bilder (Packbild mal Maske, harte Alphawerte)
        const cut = (mask) => { const c = document.createElement('canvas'); c.width = 192; c.height = 320; const g = c.getContext('2d'); g.drawImage(base, 0, 0); g.globalCompositeOperation = 'destination-in'; g.drawImage(mask, 0, 0); return c; };
        playRef.current = { o, back, front, base, shim, topC: cut(top), bodyC: cut(body), backUrl: BP_DIR + 'opening/' + o.layers.back.replace('<pack>', pending.packId), frontUrl: BP_DIR + 'opening/' + o.layers.front.replace('<pack>', pending.packId) };
        setOp(o);
        setPhase('play');
      } catch (e) { if (!dead) setErr('Could not load the pack animation (' + e.message + ')'); }
    })();
    return () => { dead = true; };
  }, [pending.id]);

  // Wiedergabe der Zeitleiste
  useEffect(() => {
    if (phase !== 'play' && phase !== 'cards') return undefined;
    const R = playRef.current; if (!R || !stageRef.current) return undefined;
    const { o } = R, cv = stageRef.current, g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    const SW = o.stage[0], SH = o.stage[1], [PX, PY] = o.packOrigin, ready = o.events.cardLanding[o.events.cardLanding.length - 1] + 1;
    const loopA = o.ambientLoop[0], loopB = o.ambientLoop[1];
    // Weicher Rand der Bühne ohne Alpha: Bayer-Raster in der Farbe des Grundes (#08060c) zu den vier Kanten hin, damit die vorgerenderten Strahlen nicht als Rechteck enden
    const fade = (() => {
      const c = document.createElement('canvas'); c.width = SW; c.height = SH;
      const x = c.getContext('2d'), id = x.createImageData(SW, SH), u = new Uint32Array(id.data.buffer), F = 30, dark = bpU32('#08060c');
      for (let j = 0; j < SH; j++) for (let i = 0; i < SW; i++) { const d = Math.min(i, SW - 1 - i, j, SH - 1 - j); if (d < F && bpBay(i, j) < 1 - d / F) u[j * SW + i] = dark; }
      x.putImageData(id, 0, 0);
      return c;
    })();
    let raf = 0, dead = false, lastF = -1, nextSound = 0, t0 = performance.now(), arrived = phase === 'cards';
    if (arrived) { t0 = performance.now() - (ready + 2) * (1000 / o.fps); nextSound = o.sounds.length; }
    const draw = (f) => {
      const col = f % o.columns, row = Math.floor(f / o.columns);
      g.clearRect(0, 0, SW, SH);
      g.drawImage(R.back, col * SW, row * SH, SW, SH, 0, 0, SW, SH);
      const e = o.timeline[Math.min(f, o.timeline.length - 1)];
      if (e.mode === 'whole') {
        g.drawImage(R.base, PX + e.x, PY + e.y);
        if (e.shimmer != null && R.shim) g.drawImage(R.shim, e.shimmer * 192, 0, 192, 320, PX + e.x, PY + e.y, 192, 320);
      } else if (e.mode === 'rip') {
        if (e.body) g.drawImage(R.bodyC, PX + e.body.x, PY + e.body.y);
        const sl = o.rip.slice;
        for (let s = 0; s < e.strip.dy.length; s++) {
          const dy = e.strip.dy[s];
          if (dy < -(PY + 40)) continue;               // schon aus dem Bild
          g.drawImage(R.topC, s * sl, 0, sl, 40, PX + s * sl + e.strip.dx[s], PY + dy, sl, 40);
        }
      }
      g.drawImage(R.front, col * SW, row * SH, SW, SH, 0, 0, SW, SH);
      g.drawImage(fade, 0, 0);
    };
    const tick = (now) => {
      raf = 0;
      if (dead) return;
      let f = Math.floor((now - t0) * o.fps / 1000);
      if (skipRef.current) {
        skipRef.current = false; f = Math.max(f, ready + 1); t0 = now - f * 1000 / o.fps;
        // Klänge, die beim Überspringen nicht verloren gehen sollen (opening.json: skipPlay — der „Umpf“ beim Aufgehen des Packs), genau einmal:
        // nur die, die noch NICHT gelaufen sind (nextSound = Zahl der schon gespielten Einträge)
        for (let k = nextSound; k < o.sounds.length; k++) { const s = o.sounds[k]; if (s.skipPlay) bpPlay(s.name, { volume: s.volume, rate: s.rate }); }
        nextSound = o.sounds.length; bpPlay('booster_ready', { volume: 0.85 });
      }
      while (nextSound < o.sounds.length && o.sounds[nextSound].f <= f) { const s = o.sounds[nextSound++]; bpPlay(s.name, { volume: s.volume, rate: s.rate }); }
      if (!arrived && f >= ready) { arrived = true; setPhase('cards'); }
      const fd = f > loopB ? loopA + ((f - loopA) % (loopB - loopA + 1)) : f;
      if (fd !== lastF) { lastF = fd; draw(fd); }
      raf = bpRaf(tick);
    };
    raf = bpRaf(tick);
    return () => { dead = true; if (raf) bpCancel(raf); };
  }, [phase === 'load' ? 'load' : 'run', op]);

  // Effekt-Leinwand (Größe folgt dem Fenster)
  useEffect(() => {
    if (!fxRef.current) return undefined;
    if (fx.current) fx.current.destroy();
    fx.current = bpFxCreate(fxRef.current, S, worldRef.current);
    return () => { if (fx.current) { fx.current.destroy(); fx.current = null; } };
  }, [vp.w, vp.h, S, phase === 'load']);

  // Karte aufdecken: die Flip-Animation der Karte (BpCard) läuft sofort; auf der Kante (Aufschlagen der Vorderseite) kommen Klänge und der Rarity-Effekt
  const flip = useCallback((i, opt) => {
    if (flippedRef.current[i]) return;
    setFlipped(f => { const n = f.slice(); n[i] = true; flippedRef.current = n; return n; });
    if (opt && opt.mix) mixRef.current = opt.mix;
  }, []);
  const onEdge = useCallback((i) => {
    const r = cards[i].rarity, mix = mixRef.current, vol = mix > 1 ? Math.min(1, 1.3 / Math.sqrt(mix)) : 1;
    (BP_FLIP_SOUNDS[r] || [['draw', { volume: 0.5 }]]).forEach(([n, o]) => bpPlay(n, { ...o, volume: (o.volume != null ? o.volume : 1) * vol }));
    if (BP_FX_LEN[r] && fx.current && geom) {
      const [sx, sy] = geom.slots[i], cw = geom.cw / S, ch = geom.ch / S;
      fx.current.spawn(r, (geom.left + sx * Z) / S + cw / 2, (geom.top + sy * Z) / S + ch / 2, cw, ch, mix);
    }
  }, [cards, geom, Z, S]);
  const onCardDone = useCallback(() => setDoneN(n => n + 1), []);

  // „Flip All“: ALLE noch verdeckten Karten drehen sich gleichzeitig (jede mit eigener Flip-Animation und ihrem Effekt)
  const flipAll = () => {
    const rest = cards.map((c, i) => i).filter(i => !flippedRef.current[i]);
    if (!rest.length) return;
    mixRef.current = rest.length;
    rest.forEach(i => flip(i, { mix: rest.length }));
  };

  const allOpen = flipped.every(Boolean);
  const allDone = allOpen && doneN >= cards.length;

  // Tastatur: Leertaste/Esc überspringt die Öffnungsanimation
  useEffect(() => {
    const onKey = (e) => {
      if ((e.key === 'Escape' || e.key === ' ') && phase === 'play') { e.preventDefault(); e.stopImmediatePropagation(); skipRef.current = true; }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [phase]);

  const packPrice = boosters && boosters.price != null ? boosters.price : 20;
  const sellTable = (boosters && boosters.sellback) || (window.PpRarities && window.PpRarities.SELLBACK) || {};
  const canRip = (sc || 0) >= packPrice;

  const claim = async () => {
    if (claiming) return;
    setClaiming(true); setErr(''); setNote('');
    try {
      const r = await window.ppBoosterApi.claim(pending.id);
      if (!r.ok) throw new Error((r.data && r.data.error) || 'Could not add the cards');
      bpPlay('shop_purchase', { volume: 0.8 });
      onClaimed(r.data);
    } catch (e) { setErr(e.message); setClaiming(false); }
  };

  // „Add and rip one more!“: Pack einlösen + sofort ein Pack derselben Art kaufen und öffnen (eine Anfrage; der Server prüft SC und löst das alte Pack
  // in jedem Fall ein). Gelingt der Neukauf nicht (zu wenig SC), ist das Pack trotzdem eingelöst: die Ansicht schließt mit einer Meldung.
  const ripMore = async () => {
    if (claiming || selling || !canRip) return;
    setClaiming(true); setErr(''); setNote('');
    try {
      const r = await window.ppBoosterApi.ripMore(pending.id);
      if (r.ok && r.data.pending) { bpPlay('shop_purchase', { volume: 0.8 }); onRipMore && onRipMore(r.data); return; }
      if (r.data && r.data.claimed) { onClaimed(r.data, { ripFailed: r.data.error || 'Could not buy another pack' }); return; }
      throw new Error((r.data && r.data.error) || 'Could not open another pack');
    } catch (e) { setNote(e.message); setClaiming(false); }
  };

  // „Sell Back!“: EINE Karte je Pack gegen SC zurückgeben (Server: 409 beim zweiten Mal). Erst nach dem Aufdecken der Karte anklickbar.
  const sell = async (i) => {
    if (sold >= 0 || selling || claiming) return;
    setSelling(true); setNote('');
    try {
      const r = await window.ppBoosterApi.sell(pending.id, i);
      if (r.ok) {
        setSold(i);
        bpPlay('gold_gain', { volume: 0.8 });
        if (onSc && r.data.sc != null) onSc(r.data.sc);
      } else if (r.status === 409 && Number.isInteger(r.data.sold) && r.data.sold >= 0) setSold(r.data.sold);
      else setNote((r.data && r.data.error) || 'Could not sell the card');
    } catch (e) { setNote(e.message); }
    setSelling(false);
  };

  const hoverCard = hover >= 0 && flipped[hover] ? cards[hover] : null;
  const Tooltip = window.CardTooltipContent;
  const stageW = geom.stage[0] * Z, stageH = geom.stage[1] * Z;
  const cardsBottom = geom.top + (geom.slots[6] ? (geom.slots[6][1] + (op ? op.cardSize[1] : 105)) * Z : stageH);
  const hudTop = cardsBottom + 6 * Z + 10;     // + Platz für die Sell-Back-Knöpfe, die über der Unterkante der untersten Karten sitzen
  const tight = vp.h - cardsBottom < 56;      // niedriger Bildschirm (Handy quer): Knöpfe an den rechten Rand statt unter die Karten

  // Die Shop-Seite läuft unter CSS-`zoom` (--ui-scale): die Vollbild-Ansicht hängt deshalb direkt an <body>, damit Fenster- und Bildpunkte übereinstimmen
  // (ganzzahliger Bühnenfaktor Z in echten Bildschirmpunkten, nicht ein mitgezoomtes Mischmaß).
  const tree = (
    <div className="bp-open" data-pp-px="aus">
      <div className="bp-world" ref={worldRef}>
        <canvas ref={stageRef} className="bp-stage" width={geom.stage[0]} height={geom.stage[1]}
          style={{ left: geom.left, top: geom.top, width: stageW, height: stageH, visibility: phase === 'load' ? 'hidden' : 'visible' }} />
        {phase === 'cards' && cards.map((c, i) => (
          <BpCard key={i} idx={i} card={c} geom={geom} open={flipped[i]} hold={Math.round((BP_FACE_DELAY[c.rarity] || 0) / BP_TAKT)} hot={hover === i}
            sold={sold === i} sellOff={sold >= 0 || selling || claiming} sellValue={sellTable[c.rarity] || 0} onSell={sell}
            onEdge={onEdge} onDone={onCardDone} onClick={(k) => { mixRef.current = 1; flip(k); }} onHover={(k, on) => setHover(on ? k : (h => (h === k ? -1 : h)))} />
        ))}
      </div>
      <canvas ref={fxRef} className="bp-fx" />
      {phase === 'load' && !err && <div className="bp-msg">Opening {pack.name}…</div>}
      {err && <div className="bp-msg bp-msg-err">{err}</div>}
      {phase === 'play' && (
        <button className="btn bp-skip" onClick={() => { skipRef.current = true; }}>SKIP ▸</button>
      )}
      {phase === 'cards' && (
        <div className={'bp-hud' + (tight ? ' bp-hud-tight' : '')} style={tight ? undefined : { left: Math.max(0, geom.left - 60 * Z), width: stageW + 120 * Z, top: Math.max(0, Math.min(hudTop, vp.h - (allDone ? 124 : 52))) }}>
          {!allDone && (
            <button className="btn bp-btn" disabled={allOpen} onClick={flipAll}>FLIP ALL</button>
          )}
          {allDone && (
            <div className="bp-hud-row">
              <button className="btn bp-btn bp-btn-go" disabled={claiming} onClick={claim}>
                {claiming ? 'ADDING…' : 'ADD CARDS TO COLLECTION'}
              </button>
              <button className="btn bp-btn bp-btn-more" disabled={claiming || !canRip} onClick={ripMore}
                title={canRip ? 'Add these cards to your collection and open another pack of the same kind' : 'Not enough Smug Coins for another pack'}>
                ADD AND RIP ONE MORE! <img src="/data/sc.png" className="bp-coin" alt="" /> {packPrice}
              </button>
            </div>
          )}
          {allDone && !canRip && <div className="bp-hint bp-hint-warn">Not enough SC for another pack ({packPrice} SC needed)</div>}
          {!allOpen && <div className="bp-hint">Click a card to flip it</div>}
          {note && <div className="bp-hint bp-hint-warn">{note}</div>}
        </div>
      )}
      {phase === 'cards' && <div className="bp-sc" title="Your Smug Coins"><img src="/data/sc.png" className="bp-coin" alt="" /> {sc || 0}</div>}
      {hoverCard && Tooltip && window.CARDS_BY_NAME && window.CARDS_BY_NAME[hoverCard.name] && (
        <div className="tooltip card-tooltip bp-tooltip">
          <Tooltip card={{ ...window.CARDS_BY_NAME[hoverCard.name], rarity: hoverCard.rarity }} rarity={hoverCard.rarity} />
        </div>
      )}
    </div>
  );
  return (typeof ReactDOM !== 'undefined' && ReactDOM.createPortal && document.body) ? ReactDOM.createPortal(tree, document.body) : tree;
}
window.BoosterOpening = BoosterOpening;
