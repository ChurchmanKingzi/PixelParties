// ═══════════════════════════════════════════════════════════════════════════
//  BOOSTERPACKS (Shop-Reiter „Boosterpacks“, Öffnung, Aufdecken)
//
//    window.ppBoosterApi          { list(), pending(), buy(packId, count), claim(ids), ripMore(ids), sell(id, index), display(), displayBuy(body) } → { ok, status, data }
//    window.BoosterShop           Reiter: die 9 Packs (Bild + Schimmerstreifen aus boosters.json, Name, Tagline, Mengenfeld „− n +“, Kaufen) + rechts die Auslage (BpShowcase)
//    window.BoosterOpening        Vollbild: vorgerenderte Öffnungsanimation (opening.json) → 9 verdeckte Karten → aufdecken → „Sell Back!“ (eine Karte je Pack)
//                                 → „Add Cards To Collection“ oder „Add and rip one more!“ (löst ein und öffnet sofort ein Pack derselben Art).
//                                 Mehrere Packs (Mengenkauf, bis maxCount): die Animation läuft einmal, danach liegen alle Packs als 3×3-Blöcke untereinander in einem
//                                 vertikal scrollbaren Bereich (verdeckt), die Knopfleiste bleibt fest darunter (BpMultiView-Layout in BoosterOpening).
//
//  Server-Vertrag (server.js):
//    GET  /api/boosters           → { price, packs: [{ id, name, tagline, variants: [{ id, theme, base, shimmer }] }] }
//    POST /api/boosters/buy       { packId, count = 1 } → { pending (erstes Pack), packs: [{ id, packId, variantId, cards: [{ name, rarity }], sold }], sc }   (count 1 … maxCount; bei offenen Packs 409 mit deren packs)
//    GET  /api/boosters/pending   → { pending (erstes | null), packs: [alle offenen, Kaufreihenfolge] }
//    POST /api/boosters/claim     { ids } → { added, packs, … }     (alle offenen Packs; die je Pack zurückverkaufte Karte wird nicht eingelöst)
//    POST /api/boosters/rip-more  { ids } → { added, pending, packs, sc }   (löst ALLE offenen Packs ein, kauft gleich viele derselben Art; 402/5xx mit claimed: true: die alten sind trotzdem eingelöst)
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
  storm: 'Storm Rare', spectral: 'Spectral', umbra: 'Umbra', stained: 'Stained Rare',
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
    buy: (packId, count) => call('/boosters/buy', { method: 'POST', body: JSON.stringify({ packId, count: count || 1 }) }),
    claim: (ids) => call('/boosters/claim', { method: 'POST', body: JSON.stringify({ ids: [].concat(ids) }) }),
    ripMore: (ids) => call('/boosters/rip-more', { method: 'POST', body: JSON.stringify({ ids: [].concat(ids) }) }),
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
  'draw', 'pull_sparkle', 'pull_note', 'gold_gain', 'elem_lightning', 'pull_shatter', 'laser', 'negate', 'elem_dark', 'heavy_impact', 'pull_crack', 'ascension', 'pull_reveal', 'pull_swell', 'doom_tick'];
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
function BpShowCard({ card, size }) {
  const hostRef = useRef(null);
  useEffect(() => {
    const F = window.PpRarityFx;
    if (!hostRef.current || !F || (F.available && !F.available(card.rarity))) return undefined;
    let h = null;
    try { h = F.attach(hostRef.current, { card: (window.CARDS_BY_NAME && window.CARDS_BY_NAME[card.name]) || { name: card.name }, rarity: card.rarity, animated: true, ...(size ? { size } : {}) }); } catch (e) { h = null; }
    return () => { try { h && h.destroy && h.destroy(); } catch (e) { /* ohne */ } };
  }, [card.name, card.rarity, size]);
  return (
    <div className="bp-sc-face" ref={hostRef} data-pp-px="aus">
      <img src={bpCardUrl(card.name, card.rarity)} alt={bpRarityLabel(card.rarity) + ' ' + card.name} draggable={false} />
    </div>
  );
}

function BpShowcase({ sc, onSc, notify, onHoverCard }) {
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
  const gotten = (disp && disp.bought) || [];     // Plätze, die ich in dieser Stunde schon gekauft habe (ausgegraut bis zum Wechsel)
  return (
    <aside className="bp-showcase" aria-label="Showcase" onMouseLeave={() => onHoverCard && onHoverCard(null)}>
      <div className="bp-sc-head">
        <div className="bp-sc-title">SHOWCASE</div>
        <div className="bp-sc-sub">One card of each rarity. Fresh picks every hour.</div>
        <div className="bp-sc-clock">Next rotation in <b>{disp ? bpClock(left) : '--:--'}</b></div>
      </div>
      {!disp && <div className="bp-sc-empty">Loading…</div>}
      <div className="bp-sc-grid">
        {cards.map((c, i) => {
          const got = gotten.indexOf(i) >= 0;
          const can = (sc || 0) >= c.price && busy < 0 && !got;
          const just = added.slot === i;
          return (
            <div key={disp.hour + ':' + i + ':' + c.name} className={'bp-sc-cell bp-sc-r-' + c.rarity + (c.special ? ' bp-sc-special' : '') + (got ? ' bp-sc-got' : '')}
              onMouseEnter={() => onHoverCard && onHoverCard(c)}>
              {c.special && <div className="bp-sc-flagrow"><div className="bp-sc-flag">HALF PRICE!</div></div>}
              <BpShowCard card={c} />
              {got && <div className="bp-sc-dim" />}
              <div className="bp-sc-name" title={bpRarityLabel(c.rarity) + ' · ' + c.name}>{c.name}{c.owned > 0 ? <span className="bp-sc-own" title="Copies you own"> ×{c.owned}</span> : null}</div>
              <div className="bp-sc-buyrow">
                <div className="bp-sc-price" title={c.special ? 'Special offer: half price (normally ' + c.fullPrice + ' SC)' : c.price + ' SC'}>
                  <img src="/data/sc.png" className="bp-coin" alt="" />
                  {c.special && <s className="bp-sc-old">{c.fullPrice}</s>}
                  <b>{c.price}</b>
                </div>
                <button type="button" className={'btn bp-sc-buy' + (just ? ' bp-sc-added' : '')} disabled={!can && !just} onClick={() => buy(i)}
                  title={got ? 'Already bought. New cards arrive with the next rotation.' : (sc || 0) < c.price ? 'Not enough Smug Coins' : 'Buy this card (' + bpRarityLabel(c.rarity) + ')'}>
                  {just ? 'ADDED!' : got ? 'BOUGHT' : 'BUY'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

// Mengenfeld einer Pack-Kachel: „− [n] +“ und MAX. Nur Ziffern; jede Eingabe wird auf 1 … max geklemmt (max = leistbare Packs, höchstens maxCount).
// `value`: Zahl oder '' (Feld gerade leer beim Tippen; beim Verlassen wird daraus 1).
function BpQty({ name, value, max, off, onChange }) {
  const hi = Math.max(1, max), cur = value === '' ? 1 : Math.min(hi, Math.max(1, value));
  const dead = off || max < 1;
  const step = (d) => onChange(Math.min(hi, Math.max(1, cur + d)));
  return (
    <div className={'bp-qty' + (dead ? ' bp-qty-off' : '')} role="group" aria-label={'Number of ' + name + ' packs'}>
      <button type="button" className="bp-qty-btn" disabled={dead || cur <= 1} aria-label="One pack less" onClick={() => step(-1)}>−</button>
      <input className="bp-qty-in" type="text" inputMode="numeric" pattern="[0-9]*" maxLength={3} autoComplete="off" spellCheck={false} disabled={dead}
        aria-label={'How many ' + name + ' packs (1 to ' + hi + ')'} value={value === '' ? '' : String(cur)}
        onChange={(e) => { const t = e.target.value.replace(/\D/g, '').slice(0, 3); onChange(t === '' ? '' : Math.min(hi, Math.max(1, parseInt(t, 10) || 1))); }}
        onFocus={(e) => { try { e.target.select(); } catch (er) { /* ohne */ } }}
        onBlur={() => { if (value === '') onChange(1); }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp') { e.preventDefault(); step(1); }
          else if (e.key === 'ArrowDown') { e.preventDefault(); step(-1); }
          else if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
        }} />
      <button type="button" className="bp-qty-btn" disabled={dead || cur >= hi} aria-label="One pack more" onClick={() => step(1)}>+</button>
      <button type="button" className="bp-qty-btn bp-qty-max" disabled={dead || cur >= hi} aria-label={'Maximum: ' + hi + ' packs'} title={'As many as you can afford (max ' + hi + ')'} onClick={() => onChange(hi)}>MAX</button>
    </div>
  );
}

function BoosterShop({ boosters, sc, busy, onBuy, onSc, notify }) {
  useEffect(() => { bpWarmSounds(); }, []);
  const [tipCard, setTipCard] = useState(null);     // Karte der Auslage unter der Maus → Tooltip links (über Shopkeeper und Sprechblase)
  const [qty, setQty] = useState({});               // Menge je Pack-Art (Standard immer 1); '' = Feld beim Tippen leer
  const packs = (boosters && boosters.packs) || [];
  const price = boosters && boosters.price != null ? boosters.price : 20;
  const maxCount = boosters && boosters.maxCount > 0 ? boosters.maxCount : 20;
  const zoom = 1;
  if (!packs.length) return <div className="shop-empty">Boosterpacks are not available right now</div>;
  // leistbar: floor(SC / Preis), höchstens maxCount. Ändert sich der Kontostand (Auslage, Verkauf), klemmt die Anzeige sofort nach (Werte werden beim Lesen geklemmt).
  const afford = Math.max(0, Math.min(maxCount, Math.floor((sc || 0) / price)));
  const hi = Math.max(1, afford);
  const eff = (id) => { const r = qty[id]; return r === '' || r == null ? 1 : Math.min(hi, Math.max(1, r)); };
  const canBuy = !busy && afford >= 1;
  const buy = (id) => { const n = eff(id); setQty({}); onBuy(id, n); };   // nach dem Kauf zurück auf 1
  return (
    <div className="bp-shop">
      <div className="bp-layout">
        <div className="bp-layout-aside"><BpShowcase sc={sc} onSc={onSc} notify={notify} onHoverCard={setTipCard} /></div>
        <div className="bp-grid">
          {packs.map(p => {
            const n = eff(p.id);
            return (
              <div key={p.id} className={'bp-tile' + (canBuy ? '' : ' bp-tile-off')}>
                <BpPackCanvas pack={p} zoom={zoom} />
                <div className="bp-name">{p.name}</div>
                <div className="bp-tagline">{p.tagline}</div>
                <BpQty name={p.name} value={qty[p.id] == null ? 1 : qty[p.id]} max={afford} off={busy} onChange={(v) => setQty(q => ({ ...q, [p.id]: v }))} />
                <button className="btn bp-buy" disabled={!canBuy} onClick={() => buy(p.id)}
                  title={afford < 1 ? 'Not enough Smug Coins' : n > 1 ? 'Buy ' + n + ' packs and open them all at once' : 'Buy and open this pack'}>
                  {n > 1 ? 'BUY ×' + n : 'BUY'} — <img src="/data/sc.png" className="shop-sc-icon" /> {price * n}
                </button>
              </div>
            );
          })}
        </div>
      </div>
      {tipCard && <BpShopTip card={tipCard} />}
    </div>
  );
}

// Tooltip der Auslage: NUR das Kartenbild, groß und mit laufendem Rarity-Effekt, links über Shopkeeper-Sprite und Sprechblase (hängt am Shop-Bildschirm,
// z-index über .shop-antonia). Ganzzahlige Vergrößerung der 150×210-Karte (3× auf großen, sonst 2×), damit das Raster scharf bleibt.
function BpShopTip({ card }) {
  const K = (window.innerWidth >= 1700 && window.innerHeight >= 900) ? 3 : 2;
  const tree = (
    <div className="bp-shop-tip" style={{ width: 150 * K, height: 210 * K }}>
      <BpShowCard key={card.name + ':' + card.rarity + ':' + K} card={card} size={150 * K} />
    </div>
  );
  const host = typeof document !== 'undefined' && document.querySelector('.shop-screen');
  return (host && typeof ReactDOM !== 'undefined' && ReactDOM.createPortal) ? ReactDOM.createPortal(tree, host) : tree;
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
const BP_BAY16 = BP_BAYER.flat();   // flach, für die schnellen Pinsel (Schwelle: Zelle gesetzt, wenn BP_BAY16[...] < Dichte * 16 - 0.5)

// Pinsel auf einer Leinwand mit Rasterzellen: schreibt in einen Pixelspeicher (ein Zug je Bild), Palettenfarben als Hex-Texte
const _bpU32 = {}, _bpRows = {};   // _bpRows: fertige Rasterzeilen der Pinsel (je Stufe/Farbe/Phase), von bpPen gefüllt
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
      if (x === 0 && x1 === W) { buf.fill(v, y * W, y1 * W); return; }
      if (x1 - x <= 6) { for (let j = y; j < y1; j++) for (let i = j * W + x, e = j * W + x1; i < e; i++) buf[i] = v; return; }   // kleine Quadrate: Schleife statt fill-Aufrufen
      for (let j = y; j < y1; j++) buf.fill(v, j * W + x, j * W + x1);
    },
    // Rechteck mit Dichte d (0..1) als Bayer-Raster (gleiches Ergebnis wie bpBay(x, y) < d, aber ganzzahlig und ohne Funktionsaufruf je Zelle)
    dither(x, y, w, h, d, c) {
      if (d <= 0) return;
      if (d >= 1) { pen.rect(x, y, w, h, c); return; }
      x = Math.floor(x); y = Math.floor(y); w = Math.floor(w); h = Math.floor(h);
      const v = bpU32(c), x1 = Math.min(W, x + w), y1 = Math.min(H, y + h), lv = d * 16 - 0.5, x0 = Math.max(0, x);
      for (let j = Math.max(0, y); j < y1; j++) {
        const br = (j & 3) << 2, o = j * W;
        for (let i = x0; i < x1; i++) if (BP_BAY16[br + (i & 3)] < lv) buf[o + i] = v;
      }
    },
    // Kreisring zwischen den Radien rin und rout (rout = Infinity: bis zum Bildrand) um (cx, cy) mit Dichte d als Bayer-Raster. Jede Zelle des Rings wird
    // genau einmal GESCHRIEBEN (auch die Lücken des Rasters als 0): nur auf einer leeren Fläche oder mit d = 1 benutzen, nicht über anderes Gemaltes.
    // Zeilen kommen als fertige Rasterzeilen (Uint32Array je Stufe/Farbe/Zeilenphase, einmal angelegt) per set(): schnell auch bei Vollbild.
    band(cx, cy, rin, rout, d, c) {
      const L = Math.max(0, Math.min(16, Math.ceil(d * 16 - 0.5)));
      if (L <= 0) return;
      cx = Math.floor(cx); cy = Math.floor(cy);
      const ri2 = rin * rin, ro2 = rout * rout, open = rout === Infinity;
      const pat = [0, 1, 2, 3].map(ph => {
        const key = L + c + ph; let row = _bpRows[key];
        if (!row || row.length !== W) { row = _bpRows[key] = new Uint32Array(W); const v = bpU32(c), br = ph << 2; for (let x = 0; x < W; x++) row[x] = BP_BAY16[br + (x & 3)] < L ? v : 0; }
        return row;
      });
      const span = (o, row, a, b) => { a = Math.max(0, a); b = Math.min(W - 1, b); if (b >= a) buf.set(row.subarray(a, b + 1), o + a); };
      for (let y = 0; y < H; y++) {
        const dy = y - cy, dy2 = dy * dy;
        if (!open && dy2 >= ro2) continue;
        const xo = open ? W : Math.round(Math.sqrt(ro2 - dy2)), xi = dy2 < ri2 ? Math.round(Math.sqrt(ri2 - dy2)) : 0;
        const row = pat[y & 3], o = y * W;
        if (xi > 0) { span(o, row, cx - xo, cx - xi - 1); span(o, row, cx + xi + 1, cx + xo); } else span(o, row, cx - xo, cx + xo);
      }
    },
    // Bild (Uint32Array w×h, 0 = durchsichtig) mit der linken oberen Ecke bei (x, y) aufsetzen
    blit(src, w, h, x, y) {
      for (let j = 0; j < h; j++) {
        const yy = y + j; if (yy < 0 || yy >= H) continue;
        for (let i = 0, o = yy * W + x, q = j * w; i < w; i++) { const v = src[q + i], xx = x + i; if (v !== 0 && xx >= 0 && xx < W) buf[o + i] = v; }
      }
    },
    // Pixelspeicher sichern / laden
    snap(dst) { dst.set(buf); },
    load(src) { buf.set(src); },
    // Scheibe (löscht Zellen innerhalb des Radius r)
    eraseDisc(cx, cy, r) {
      cx = Math.floor(cx); cy = Math.floor(cy);
      for (let y = Math.max(0, cy - r); y <= Math.min(H - 1, cy + r); y++) {
        const dx = Math.round(Math.sqrt(Math.max(0, r * r - (y - cy) * (y - cy)))), x0 = Math.max(0, cx - dx), x1 = Math.min(W - 1, cx + dx);
        if (x1 >= x0) buf.fill(0, y * W + x0, y * W + x1 + 1);
      }
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
      if ((x0 < -th && x1 < -th) || (y0 < -th && y1 < -th) || (x0 > W + th && x1 > W + th) || (y0 > H + th && y1 > H + th)) return;   // ganz außerhalb
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

// Dauer der Effekte in Takten (30 Hz) und Verzögerung bis die Karte sichtbar wird (ms)
// Die Inszenierung folgt dem RANG: …Spectral < Stained Rare < Umbra (höchste Rarity: längster Aufbau, längste Kantenpause, meiste Klangschichten, stärkster Rückstoß).
// Storm Rare = Gewitter (Blitz in die Karte, Regenschleier, Funkenregen), Stained Rare = Kirche/Buntglas (Licht, Splitter), Umbra = Finsternis (Sonnenfinsternis, Schattenrisse, Verdunkelung).
const BP_FX_LEN = { rare: 30, prismatic: 40, super: 44, storm: 44, spectral: 48, stained: 96, umbra: 150 };
const BP_FACE_DELAY = { uncommon: 0, rare: 0, prismatic: 60, super: 120, storm: 180, spectral: 120, stained: 480, umbra: 1200 };
const BP_HERZSCHLAG = [7, 19, 27, 32];   // Umbra: Takte (ab Kante) der vier Herzschläge vor dem Aufschlag, deckungsgleich mit den doom_tick-Klängen (BP_FLIP_SOUNDS)

// Sammelstelle für die laufenden Effekte einer Leinwand
function bpFxCreate(cv, S, shakeEl) {
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  const W = Math.ceil(window.innerWidth / S) + 1, H = Math.ceil(window.innerHeight / S) + 1;
  cv.width = W; cv.height = H;
  cv.style.width = W * S + 'px'; cv.style.height = H * S + 'px';
  const pen = bpPen(g, W, H);
  const vigBuf = new Uint32Array(W * H);   // zuletzt gemalte Dunkelheits-Ebene (Umbra), einmal je Leinwand angelegt, nicht erst beim Aufdecken
  let vigKey = '';
  const list = [];
  let raf = 0, tak = 0, last = -1, dead = false, shake = null, vigFresh = false;   // vigFresh: der Stift hält gerade die frisch gemalte Dunkelheits-Ebene
  const api = { W, H, S };
  // Bildschirmzucken: Stärke in Rasterzellen, fällt über `dur` Takte stufenweise auf 0; ein stärkeres Zucken ersetzt ein schwächeres, nie umgekehrt
  const shakeAmp = (k) => Math.max(0, Math.round(k.amp * (1 - k.t / k.dur)));
  const kick = (amp, dur) => { if (!shake || amp >= shakeAmp(shake)) shake = { t: 0, amp, dur }; };

  function spawn(kind, cx, cy, cw, ch, mix) {
    const seed = (Math.random() * 1e9) | 0, rnd = bpRng(seed);
    const e = { kind, cx, cy, cw, ch, t: 0, rnd, seed, P: [], mix: mix > 1 ? mix : 1 };
    init(e);
    list.push(e);
    if (kind === 'stained') kick(2, 14);
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
    } else if (e.kind === 'storm') {
      // Funkenregen nach dem Einschlag: Funken aus der Kartenmitte, fallen mit Schwerkraft (Gelb/Weiß/Hellcyan)
      const cols = [BPC.yellow, BPC.white, BPC.cyanL, BPC.sky, BPC.white, BPC.yellow];
      for (let i = 0; i < 34; i++) {
        const a = r() * Math.PI * 2, v = (0.7 + r() * 2.1) * e.u;
        P.push({ x: (r() - 0.5) * e.cw * 0.5, y: (r() - 0.5) * e.ch * 0.5, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.9, life: 22 + (r() * 18) | 0, c: cols[i % cols.length], big: i % 4 === 0 });
      }
    } else if (e.kind === 'umbra') {
      // Umbra: schwarze Scheibe („Mond“) vor der Karte, Korona aus Strahlen, Schattenrisse bis zum Bildrand, Sog ins Zentrum, nach dem Aufschlag Splitter und Glut.
      // Alles Zufällige wird hier einmal gewürfelt (e.seed), das Malen je Takt rechnet nur noch.
      const m = e.mix > 1 ? 0.6 : 1;                                // mehrere Effekte gleichzeitig (Flip All): weniger Teile
      e.imp = Math.round(BP_FACE_DELAY.umbra / BP_TAKT) + 1;        // Takt des Aufschlags (die Vorderseite wird sichtbar)
      e.rd = Math.round(e.ch / 2 * 1.15 + 2);                       // Radius der Scheibe
      e.maxR = Math.ceil(Math.hypot(pen.W, pen.H));
      e.rays = [];
      for (let i = 0, n = Math.round(44 * m); i < n; i++) e.rays.push({ a: (i + r() * 0.8) / n * Math.PI * 2, len: (0.35 + r() * 0.65) * e.rd * 1.0, c: i % 3 === 0 ? BPC.white : (i & 1 ? BPC.purpleL : BPC.violet), tip: i % 3 === 1, th: i % 2 ? 3 : 2 });
      e.cracks = [];
      const crack = (x, y, a0, steps, t0, stepLen) => {
        const pts = [[x, y]]; let a = a0, branchAt = [];
        for (let k = 0; k < steps; k++) {
          a += (r() - 0.5) * 0.8; x += Math.cos(a) * stepLen * (0.7 + r() * 0.6); y += Math.sin(a) * stepLen * (0.7 + r() * 0.6); pts.push([x, y]);
          if (k > 2 && k % 4 === 1 && r() < 0.55) branchAt.push([k, a]);
        }
        return { pts, t0, branchAt };
      };
      const nc = Math.round(10 * m), L = Math.round(e.maxR * 0.55 / (10 * e.u));
      for (let i = 0; i < nc; i++) {
        const a = (i + r() * 0.7) / nc * Math.PI * 2, c = crack(Math.cos(a) * (e.rd + 2), Math.sin(a) * (e.rd + 2), a, L, 8 + (i % 5) * 1.5 + r() * 3, 10 * e.u);
        e.cracks.push(c);
        for (const [k, ba] of c.branchAt) { const q = c.pts[k], d = r() < 0.5 ? 1 : -1; e.cracks.push(crack(q[0], q[1], ba + d * (0.7 + r() * 0.5), 4 + ((r() * 4) | 0), c.t0 + k / 1.5, 8 * e.u)); }
      }
      e.suck = [];
      for (let i = 0, n = Math.round(80 * m); i < n; i++) e.suck.push({ a: r() * Math.PI * 2, r0: (0.22 + r() * 0.3) * e.maxR, born: 2 + ((r() * 14) | 0), dur: 18 + ((r() * 14) | 0), c: [BPC.purpleL, BPC.violet, BPC.purple, BPC.white][(r() * 4) | 0] });
      e.shards = [];
      // Splitter tragen die Dither-Farben der Scheibe: Grundfarbe + zweite Farbe im Schachbrett, dazu wenige helle Randstücke
      const shc = [[BPC.night, BPC.plum], [BPC.plum, BPC.violet], [BPC.black, BPC.plum], [BPC.plum, BPC.purple], [BPC.violet, BPC.purpleL], [BPC.night, BPC.violet], [BPC.white, BPC.purpleL]];
      for (let i = 0, n = Math.round(70 * m); i < n; i++) { const a = r() * Math.PI * 2, v = (2.5 + r() * 4.5) * e.u; const c2 = shc[i % shc.length]; e.shards.push({ a, v, s: r() < 0.4 ? 4 : 3, life: 36 + ((r() * 28) | 0), c: c2[0], c2: c2[1] }); }
      e.embers = [];
      for (let i = 0, n = Math.round(46 * m); i < n; i++) { const p = edge(); e.embers.push({ x: p.x * 1.05, y: p.y * 1.05, vx: (r() - 0.5) * 0.4, vy: -(0.3 + r() * 0.8) * e.u, born: 4 + ((r() * 40) | 0), life: 40 + ((r() * 50) | 0), ph: (r() * 6) | 0, c: [BPC.violet, BPC.purpleL, BPC.white, BPC.purple][(r() * 4) | 0] }); }
    } else if (e.kind === 'stained') {
      e.rays = e.mix > 1 ? 8 : 12; e.rot = (r() * 4) | 0;   // mehrere Effekte gleichzeitig (Flip All): weniger Strahlen, damit alle Karten sichtbar bleiben
    }
  }

  // ── Umbra ────────────────────────────────────────────────────────────────
  // Ablauf (Takte ab der Kante, 30 Hz; Aufschlag der Vorderseite bei e.imp = 37, die Karte steht 1,2 s auf der Kante):
  //   0–12   Verdunkelung: Dither-Vignette (Kreise aus Bayer-Rastern, dichter nach außen) schließt sich um die Karte, schwarze Scheibe („Mond“) wächst vor ihr
  //   6–36   Korona aus Strahlen um die Scheibe, Schattenrisse laufen bis zum Bildrand, Sog: violette Funken stürzen ins Zentrum, vier Herzschläge (7/19/27/32)
  //   32–37  Totalität: Korona weiß und länger, Scheibenrand weiß, vor dem Aufschlag zuckt der Schirm
  //   37     Aufschlag: Schirm weiß (zwei Takte voll), Scheibe zerbricht in Splitter, drei Druckwellen, Rückstoß (Bildschirmzucken 7 Zellen, 48 Takte), Risse blitzen
  //   37–150 Nachglühen: violetter Rahmenschein um die Karte, Glut steigt, die Dunkelheit weicht in Stufen (Dither wird dünner)
  const UMB_BANDS = [0.1, 0.26, 0.44, 0.62, 0.78, 0.88, 0.94];
  // ── Textur der Scheibe ────────────────────────────────────────────────────
  // Innenleben in Palettenstufen (Schwarz, Nacht, Plum, selten Violett), per Bayer-Raster gemischt: Spiralarme wirbeln langsam (Drehung in Stufen alle drei Takte),
  // Schattenschwaden wandern in ganzen Zellen, zur Mitte hin dunkler; ein Randlicht-Saum in Stufen (Weiß/Hellviolett → Violett → Plum) und ein paar Sterne.
  // Die Textur wird nur alle drei Takte (10 Hz, und beim Wachsen) neu berechnet und dazwischen aufgesetzt.
  const discGeo = {};   // je Radius: Abstand und Winkel jeder Zelle (einmal berechnet)
  const DK = { b: bpU32(BPC.black), n: bpU32(BPC.night), p: bpU32(BPC.plum), v: bpU32(BPC.violet), pl: bpU32(BPC.purpleL), w: bpU32(BPC.white) };
  const DNOISE = (() => { const a = new Float32Array(1024); for (let j = 0; j < 32; j++) for (let i = 0; i < 32; i++) a[j * 32 + i] = 0.5 + 0.25 * Math.sin(i * Math.PI / 16 + j * Math.PI / 8) + 0.25 * Math.sin(j * Math.PI * 3 / 16 - i * Math.PI / 16); return a; })();
  function umbraDisc(e, R, X, Y) {
    const rd = e.rd, D = 2 * rd + 3, c = rd + 1;
    let G = discGeo[rd];
    if (!G) {
      G = discGeo[rd] = { r: new Float32Array(D * D), a: new Float32Array(D * D) };
      for (let j = 0; j < D; j++) for (let i = 0; i < D; i++) { const dx = i - c, dy = j - c; G.r[j * D + i] = Math.sqrt(dx * dx + dy * dy); G.a[j * D + i] = Math.atan2(dy, dx) / (2 * Math.PI) + 0.5; }
    }
    const step = (e.t / 3) | 0, key = R * 4096 + step;
    if (e.texKey !== key) {
      if (!e.tex) { e.tex = new Uint32Array(D * D); e.stars = []; const q = bpRng(e.seed + 5); for (let i = 0; i < 16; i++) { const a = q() * Math.PI * 2, rr = Math.sqrt(q()) * rd * 0.85; e.stars.push([Math.round(Math.cos(a) * rr), Math.round(Math.sin(a) * rr), (q() * 6) | 0]); } }
      const tex = e.tex, gr = G.r, ga = G.a, Rr = R + 0.5;
      tex.fill(0);
      const rot = step * 0.03, lo = Math.max(0, c - R - 1), hi = Math.min(D - 1, c + R + 1);
      for (let j = lo; j <= hi; j++) {
        const yb = ((Y + j - c) & 3) << 2;
        for (let i = lo; i <= hi; i++) {
          const k = j * D + i, r = gr[k];
          if (r > Rr) continue;
          const bay = (BP_BAY16[yb + ((X + i - c) & 3)] + 0.5) / 16, d = Rr - r;
          let v;
          if (d < 1.5) v = bay < 0.6 ? DK.w : DK.pl;                     // Randlicht
          else if (d < 3) v = bay < 0.55 ? DK.pl : DK.v;
          else if (d < 5) v = bay < 0.6 ? DK.v : DK.p;
          else if (d < 8 && bay < 0.5) v = DK.p;
          else {
            const rho = r / rd, a = (ga[k] * 3 + r * 0.045 - rot) % 1, arm = a < 0 ? a + 1 : a;
            const nz = DNOISE[(((j - c) + step) & 31) * 32 + (((i - c) - (step >> 1)) & 31)];
            const lv = 0.4 * rho * rho + (arm < 0.34 ? (1 - arm / 0.34) * 0.5 * (0.35 + 0.65 * rho) : 0) + nz * 0.2 * rho;
            const L = Math.floor(lv * 4 + bay);
            v = L <= 0 ? DK.b : L === 1 ? DK.n : L === 2 ? DK.p : DK.v;
          }
          tex[k] = v;
        }
      }
      for (const st of e.stars) {   // Sterne: blinken in Stufen
        const ph = (step + st[2]) % 6, k = (c + st[1]) * D + c + st[0];
        if (gr[k] < R - 6 && ph < 2) tex[k] = ph === 0 ? DK.w : DK.pl;
      }
      e.texKey = key;
    }
    pen.blit(e.tex, D, D, X - c, Y - c);
  }
  // Dunkelheit der Umbra-Karte: Radius des hellen Kreises Rc und Dichte-Faktor f (null: keine Dunkelheit mehr)
  function umbraDark(e) {
    const t = e.t, tt = t - e.imp, u = e.u, near = e.rd + Math.round(18 * u);
    let Rc, f = 1;
    if (t < e.imp) {
      const k = Math.min(1, (t & ~1) / 12);   // Schließen im 15-Hz-Takt (halb so viele Neuberechnungen)
      Rc = Math.round(e.maxR + (near - e.maxR) * (1 - (1 - k) * (1 - k)));
      for (const b of BP_HERZSCHLAG) if (t >= b && t < b + 3) Rc -= Math.round((3 - (t - b)) * 2 * u);   // kurzes Zusammenziehen im Herzschlag
    } else {
      Rc = near + Math.round(Math.min(1, tt / 14) * 24 * u);
      f = tt < 24 ? 1 : Math.max(0, 1 - (tt - 24) / 70);
    }
    return (f <= 0 || Rc >= e.maxR) ? null : { Rc, f };
  }
  // Ebene in Bildgröße (Pixelspeicher), nur neu gemalt, wenn sich Radius oder Dichtestufen ändern (sonst ein Kopierzug)
  function umbraLayer(e, d) {
    const bw = Math.max(6, Math.round(14 * e.u)), m = (e.mix > 1 ? 0.8 : 1) * d.f;
    const lv = UMB_BANDS.map(q => Math.max(0, Math.min(16, Math.ceil(q * m * 16 - 0.5))));   // Dichtestufen (Bayer 4x4 kennt nur 16)
    const key = Math.floor(e.cx) + ',' + Math.floor(e.cy) + ',' + d.Rc + ':' + lv.join(',');
    if (vigKey !== key) {
      pen.clear();
      let R = d.Rc;
      for (let k = 0; k < UMB_BANDS.length; k++, R += bw) pen.band(Math.floor(e.cx), Math.floor(e.cy), R, k === UMB_BANDS.length - 1 ? Infinity : R + bw, UMB_BANDS[k] * m, k < 3 ? BPC.plum : BPC.black);
      pen.snap(vigBuf); vigKey = key; vigFresh = true;   // der Pixelspeicher des Stifts enthält jetzt genau diese Ebene
    }
    return vigBuf;
  }
  function drawUmbra(e) {
    const t = e.t, imp = e.imp, tt = t - imp, u = e.u, X = Math.floor(e.cx), Y = Math.floor(e.cy), hw = e.cw / 2, hh = e.ch / 2, rd = e.rd, m = e.mix > 1 ? 0.6 : 1;
    if (t < imp) {
      const toti = t >= imp - 5;                                       // Totalität
      // Scheibe wächst in Stufen vor der Karte, innen ein dunkler Violettsaum
      const R = Math.round(rd * (1 - Math.pow(1 - Math.min(1, t / 10), 2)));
      if (R > 0) umbraDisc(e, R, X, Y);
      // Korona
      if (t >= 6) {
        const grow = Math.min(1, (t - 6) / 10) * (toti ? 1.7 : 1), stp = t >> 1;
        const rg = e.rays;
        for (let i = 0; i < rg.length; i++) {
          const q = rg[i], fl = 0.75 + 0.25 * bpRng(e.seed + stp * 977 + i)(), L = Math.max(2, Math.round(q.len * grow * fl)), a = q.a + (t >> 2) * 0.03;
          const ca = Math.cos(a), sa = Math.sin(a), r0 = R + 2;
          pen.line(X + ca * r0, Y + sa * r0, X + ca * (r0 + L), Y + sa * (r0 + L), toti ? (i & 1 ? BPC.white : BPC.purpleL) : q.c, q.th);
          if (toti || q.tip) pen.put(X + ca * (r0 + L + 1), Y + sa * (r0 + L + 1), BPC.white);
        }
        pen.ring(X, Y, R + 4, BPC.violet, 1, 3);
        pen.ring(X, Y, R + 9, BPC.purple, 0.6, 4);
        pen.ring(X, Y, R + 15, BPC.plum, 0.5, 5);
      }
      // Rand der Scheibe: Aureole, in der Totalität weiß und dick
      if (R > 0) { pen.ring(X, Y, R + 1, BPC.white, 1, toti ? 3 : 1); if (!toti) pen.ring(X, Y, R + 2, BPC.purpleL, 0.6, 1); }
      // Herzschläge: Ring dehnt sich vom Rand
      for (const b of BP_HERZSCHLAG) { const k = t - b; if (k >= 0 && k < 6) pen.ring(X, Y, R + 3 + k * 4 * u, k < 2 ? BPC.white : BPC.purpleL, 1 - k / 6, 2); }
      // Schattenrisse
      for (const c of e.cracks) {
        const n = Math.min(c.pts.length - 1, Math.floor((t - c.t0) * 1.5));
        if (n < 1) continue;
        const col = ((t >> 1) & 1) ? BPC.violet : BPC.purple;
        for (let k = 1; k <= n; k++) pen.line(c.pts[k - 1][0] + X, c.pts[k - 1][1] + Y, c.pts[k][0] + X, c.pts[k][1] + Y, col, 3);
        for (let k = Math.max(1, n - 3); k <= n; k++) pen.line(c.pts[k - 1][0] + X, c.pts[k - 1][1] + Y, c.pts[k][0] + X, c.pts[k][1] + Y, BPC.white, 1);   // Spitze glüht
      }
      // Sog
      for (const p of e.suck) {
        const k = (t - p.born) / p.dur; if (k < 0 || k >= 1) continue;
        for (let j = 0; j < 4; j++) {
          const kk = Math.max(0, k - j * 0.03), rr = p.r0 * (1 - kk * kk) + R * kk * kk;
          pen.put(X + Math.cos(p.a) * rr, Y + Math.sin(p.a) * rr, j === 0 ? BPC.white : (j < 3 ? p.c : BPC.plum));
          if (j === 0) pen.put(X + Math.cos(p.a) * rr + 1, Y + Math.sin(p.a) * rr, p.c);
        }
      }
      // Zucken des Schirms kurz vor dem Aufschlag; zwei volle Weißbilder beim Aufschlag selbst (verdecken die Kante der Karte)
      if (!e.noFlash) {
        if (t === imp - 2) pen.dither(0, 0, pen.W, pen.H, 0.16 * (m > 0.7 ? 1 : 0.6), BPC.violet);
        if (t >= imp - 1) pen.rect(0, 0, pen.W, pen.H, BPC.white);
      }
      return;
    }
    // ── Aufschlag und Nachglühen ───────────────────────────────────────────
    if (e.noFlash) { /* der Blitz einer gleichzeitig aufschlagenden Karte genügt */ }
    else if (tt <= 2) pen.rect(0, 0, pen.W, pen.H, BPC.white);           // fünf volle Weißbilder (Takt -1 bis 2): die Vorderseite schlägt in dieser Zeit auf
    else if (tt < 11) pen.dither(0, 0, pen.W, pen.H, [0.8, 0.6, 0.42, 0.3, 0.2, 0.12, 0.07, 0.03][tt - 3] * (e.mix > 1 ? 0.6 : 1), tt < 6 ? BPC.white : BPC.purpleL);
    // Druckwellen: drei dicke Ringe, dahinter ein dunkler Saum
    for (let k = 0; k < 3; k++) {
      const q = tt - k * 4; if (q <= 0) continue;
      const R = Math.round(q * 7.5 * u), dn = 1 - q / 55; if (dn <= 0 || R > e.maxR * 0.7) continue;
      const th = Math.max(2, Math.round((8 - k * 2) * u));
      if (k === 0) pen.ring(X, Y, R - th * 1.6, BPC.black, 0.9 * dn, Math.round(th * 1.5));
      pen.ring(X, Y, R, [BPC.white, BPC.purpleL, BPC.violet][k], dn > 0.4 ? 1 : dn * 2.4, th);
    }
    // Risse: erst weiß, dann violett, verblassen
    if (tt < 56) {
      const dn = tt < 8 ? 1 : 1 - (tt - 8) / 48, col = tt < 6 ? BPC.white : (((tt >> 1) & 1) ? BPC.violet : BPC.purple);
      for (const c of e.cracks) {
        const n = Math.min(c.pts.length - 1, Math.floor((imp - c.t0) * 1.5 + tt * 3));
        if (n < 1) continue;
        for (let k = 1; k <= n; k++) { const gx = c.pts[k][0] + X, gy = c.pts[k][1] + Y; if (bpBay(Math.floor(gx), Math.floor(gy)) < dn) pen.line(c.pts[k - 1][0] + X, c.pts[k - 1][1] + Y, gx, gy, col, tt < 6 ? 4 : 3, dn); }
      }
    }
    // Korona fällt in sich zusammen
    if (tt < 10) {
      const rg = e.rays, R0 = rd + 2;
      for (let i = 0; i < rg.length; i++) {
        const q = rg[i], L = Math.round(q.len * 1.7 * (1 - tt / 10)); if (L < 1) continue;
        const ca = Math.cos(q.a), sa = Math.sin(q.a);
        pen.line(X + ca * R0, Y + sa * R0, X + ca * (R0 + L), Y + sa * (R0 + L), tt < 4 ? BPC.white : BPC.purpleL, 2);
      }
    }
    // Splitter der Scheibe
    for (const p of e.shards) {
      if (tt > p.life) continue;
      const x = X + Math.cos(p.a) * (rd + p.v * tt), y = Y + Math.sin(p.a) * (rd + p.v * tt) + 0.12 * tt * tt * 0.5;
      if (tt > p.life - 8 && (tt & 1)) continue;
      pen.rect(x, y, p.s, p.s, p.c);
      pen.dither(x, y, p.s, p.s, 0.5, p.c2);
      pen.rect(x - 1, y - 1, 1, p.s + 1, BPC.violet);   // Randlicht an der linken Kante
    }
    // Rahmenschein um die Karte (violett, pulsiert zwischen Violett und Weiß), Dither nach außen dünner
    if (tt < 100) {
      const dn = tt < 50 ? 1 : 1 - (tt - 50) / 50, x0 = X - hw, y0 = Y - hh, x1 = X + hw, y1 = Y + hh, hot = (tt >> 2) & 1;
      const fr = (o, th, d, c) => {
        pen.dither(x0 - o - th, y0 - o - th, e.cw + 2 * (o + th), th, d, c); pen.dither(x0 - o - th, y1 + o, e.cw + 2 * (o + th), th, d, c);
        pen.dither(x0 - o - th, y0 - o, th, e.ch + 2 * o, d, c); pen.dither(x1 + o, y0 - o, th, e.ch + 2 * o, d, c);
      };
      fr(2, 2, dn, hot && tt < 40 ? BPC.purpleL : BPC.purple);
      fr(4, 3, 0.7 * dn, BPC.violet);
      fr(7, 3, 0.4 * dn, BPC.plum);
    }
    // Glut steigt vom Kartenrand auf
    for (const p of e.embers) {
      const k = tt - p.born; if (k < 0 || k > p.life) continue;
      const x = X + p.x + p.vx * k + Math.sin((k + p.ph) * 0.3) * 1.5, y = Y + p.y + p.vy * k;
      const glow = ((k + p.ph) % 6) < 3;
      if (k > p.life - 10 && (k & 1)) continue;
      pen.put(x, y, glow ? p.c : BPC.violet); pen.put(x + 1, y, glow ? p.c : BPC.plum);
      if (glow && k < p.life - 10) { pen.put(x, y - 1, BPC.purpleL); pen.put(x + 1, y - 1, p.c); }
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
    if (e.kind === 'storm') {
      // Gewitter: ein Blitz schlägt vom oberen Bildrand in die Karte (Zickzack mit Abzweig, alle zwei Takte neu gewürfelt, Kern weiß, Rand türkis), kurz darauf ein
      // zweiter, dünnerer Schlag etwas weiter weg; Blitzlicht auf der Karte, der ganze Schirm zuckt in Dither-Stufen, schräger Regenschleier und Funkenregen.
      const bolt = (seed, bx, th, t0) => {
        const rr = bpRng(seed);
        let x = bx + (rr() - 0.5) * 8, y = 0;
        const segs = 14, dy = Y / segs, pts = [[x, y]];
        for (let i = 1; i <= segs; i++) { x = i === segs ? bx : x + (rr() - 0.5) * 20 + (bx - x) * 0.2; y = i * dy; pts.push([x, y]); }
        for (let i = 1; i < pts.length; i++) pen.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], BPC.cyan, th);
        for (let i = 1; i < pts.length; i++) pen.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], BPC.white, Math.max(1, th - 3));
        const bi = 5 + ((rr() * 4) | 0), sx = rr() < 0.5 ? -1 : 1;   // Abzweig
        let qx = pts[bi][0], qy = pts[bi][1];
        for (let i = 0; i < 4; i++) { const nx = qx + sx * (6 + rr() * 8), ny = qy + 6 + rr() * 10; pen.line(qx, qy, nx, ny, BPC.cyanL, 2); qx = nx; qy = ny; }
      };
      const th = Math.max(3, Math.round(4 * u) + 2);
      if (t < 10) bolt(e.seed + 977 * (t >> 1) + 13, X, th, 0);
      if (t >= 8 && t < 14) bolt(e.seed + 733 * (t >> 1) + 29, X + (e.seed & 1 ? 1 : -1) * (hw + 14 + (e.seed % 17)), Math.max(2, th - 2), 8);
      if (t >= 2 && t < 10) pen.dither(X - hw - 4, Y - hh - 4, e.cw + 8, e.ch + 8, [0.9, 0.7, 0.5, 0.35, 0.2, 0.12, 0.06, 0.03][t - 2] || 0, BPC.white);   // Blitzlicht
      if (t >= 3 && t < 7) pen.dither(0, 0, pen.W, pen.H, [0.22, 0.14, 0.08, 0.04][t - 3], BPC.cyanL);                                                      // ganzer Schirm zuckt
      if (t >= 8 && t < 11) pen.dither(0, 0, pen.W, pen.H, [0.12, 0.07, 0.03][t - 8], BPC.cyanL);
      if (t < 22) {   // Regenschleier: schräge Streifen (je 5 Zellen), fallen in ganzen Zellen
        const dens = t < 14 ? 1 : 1 - (t - 14) / 8, rl = bpRng(e.seed + 5);
        for (let i = 0; i < 46; i++) {
          const x0 = rl() * (pen.W + 40) - 20, y0 = rl() * (pen.H + 20), v = 3 + rl() * 2;
          if (rl() > dens) continue;
          const yy = (y0 + t * v) % (pen.H + 20) - 10, xx = x0 + yy * 0.34;
          for (let k = 0; k < 5; k++) pen.rect(xx - k * 0.34, yy - k, 1, 1, k < 2 ? BPC.cyanL : BPC.blueD);
        }
      }
      for (const p of e.P) {
        if (t > p.life || t < 2) continue;
        const k = t - 2, x = X + p.x + p.vx * k, y = Y + p.y + p.vy * k + 0.09 * k * k;
        if (t > p.life - 6 && (t & 1)) continue;
        const sc = p.big ? 2 : 1;
        pen.rect(x, y, sc, sc, p.c);
        if (p.big && t < p.life - 8) pen.rect(x - sc, y, sc, sc, BPC.white);
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
    if (e.kind === 'umbra') { drawUmbra(e); return; }
    if (e.kind === 'stained') {
      // Kirchenfenster: Licht fällt ein, Glas zerspringt. Zweithöchste Rarity: kürzer, weniger Strahlen/Funken/Wellen und kaum Zucken (Umbra ist größer).
      // Blitz über den ganzen Bildschirm (Weiß, dann Gold) in vier Stufen
      const fl = [1, 0.7, 0.4, 0.18];
      if (t < fl.length && !e.noFlash) pen.dither(0, 0, pen.W, pen.H, fl[t] * (e.mix > 1 ? 0.5 : 1), t < 2 ? BPC.white : BPC.goldL);
      // Strahlen: 12 Strahlen mit Buntglasfarben, drehen in Stufen, wachsen in 8 Takten, verlöschen per Dither
      const grow = Math.min(1, t / 8), dens = t < 30 ? 1 : Math.max(0, 1 - (t - 30) / 50);
      if (dens > 0) {
        const L = (Math.hypot(pen.W, pen.H) * (e.mix > 1 ? 0.34 : 0.5)) * grow, rot = (e.rot + (t >> 2)) * 0.07;
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
      for (let k = 0; k < 2; k++) { const tt = t - k * 6; if (tt > 0 && tt < 36) pen.ring(X, Y, tt * 3.4, [BPC.white, BPC.gold][k], 1 - tt / 36, 3); }
      // Funkenregen vom oberen Bildrand
      if (t >= 6 && t < 96) {
        const cols = [BPC.goldL, BPC.gold, BPC.red, BPC.purple, BPC.cyan, BPC.white, BPC.green, BPC.magenta];
        for (let i = 0, n = e.mix > 1 ? 36 : 60; i < n; i++) {
          const s = bpRng((e.seed + i * 2654435761) % 4294967296);
          const born = 6 + (s() * 40) | 0, x = s() * pen.W, v = 1.1 + s() * 1.9;
          if (t < born || t > born + 50) continue;
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
    // Dunkelheit der Umbra-Karten zuerst (darunter liegt sonst alles Helle verdeckt). Die erste Umbra-Karte malt die Vignette; weitere gleichzeitige Umbra-Karten
    // (Flip All) bekommen nur ihren Lichtkreis ausgeschnitten, das spart je Karte einen Vollbild-Durchlauf
    let base = null; vigFresh = false; const holes = [];
    for (const e of list) if (e.kind === 'umbra') { const d = umbraDark(e); if (d) { if (!base) base = umbraLayer(e, d); else holes.push([e, d.Rc]); } }
    if (!base) pen.clear();
    else {
      if (!vigFresh) pen.load(base);
      for (const [e, R] of holes) pen.eraseDisc(e.cx, e.cy, R);
    }
    for (let i = list.length - 1; i >= 0; i--) {
      const e = list[i];
      e.S = S;
      // Vollbild-Blitz nur einmal, wenn gleich viele Karten derselben Art gleichzeitig aufschlagen (Flip All): spart je Karte einen Vollbild-Durchlauf
      e.noFlash = false;
      for (let j = 0; j < i; j++) { const o = list[j]; if (o.kind === e.kind && Math.abs(o.t - e.t) <= 1) { e.noFlash = true; break; } }
      drawOne(e);
      if (e.kind === 'umbra' && !e.hit && e.t >= e.imp) { e.hit = true; kick(e.mix > 1 ? 5 : 7, 48); }   // Rückstoß beim Aufschlag
      e.t += dt;
      if (e.t > (BP_FX_LEN[e.kind] || 40)) list.splice(i, 1);
    }
    // die enthüllten Karten bleiben frei von Strahlen, Dunkelheit und fremden Effekten (auch von denen gleichzeitig gespielter Karten);
    // vor dem Aufschlag zeigt Umbra nur einen schmalen Schlitz: die Kante der Karte im Schatten
    for (const e of list) {
      if (e.kind === 'stained' && e.t >= Math.round(BP_FACE_DELAY.stained / BP_TAKT) + 4) pen.erase(e.cx - e.cw / 2 - 1, e.cy - e.ch / 2 - 1, e.cw + 2, e.ch + 2);
      else if (e.kind === 'umbra') {
        if (e.t >= e.imp + 3) pen.erase(e.cx - e.cw / 2 - 1, e.cy - e.ch / 2 - 1, e.cw + 2, e.ch + 2);
      }
    }
    pen.flush();
    // Bildschirmzucken (Stained): Versatz der Bühne in ganzen Rasterzellen, verklingt in Stufen
    if (shake && shakeEl) {
      const a = shakeAmp(shake);
      const q = bpRng(shake.t * 31 + 7);
      const dx = a ? Math.round((q() - 0.5) * 2 * a) * S : 0, dy = a ? Math.round((q() - 0.5) * 2 * a) * S : 0;
      shakeEl.style.transform = a ? 'translate(' + dx + 'px,' + dy + 'px)' : '';
      shake.t += dt;
      if (shake.t >= shake.dur) { shake = null; shakeEl.style.transform = ''; }
    }
    if (list.length || shake) raf = bpRaf(loop);
    else g.clearRect(0, 0, W, H);
  }

  api.spawn = spawn;
  api.shift = (dy) => { for (const e of list) e.cy += dy; };   // Öffnung mit mehreren Packs: die Karten scrollen, laufende Effekte wandern mit (dy in Rasterzellen)
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
  // Storm Rare (Gewitter): Donner/Blitz, Nachschlag, Funkenregen
  storm: [['elem_lightning', { volume: 0.9 }], ['elem_lightning', { volume: 0.55, rate: 1.3, delay: 140 }], ['pull_shatter', { volume: 0.6, rate: 1.4, delay: 200 }]],
  spectral: [['laser', { volume: 0.6, rate: 1.9 }], ['negate', { volume: 0.7, rate: 1.4, delay: 110 }], ['pull_crack', { volume: 0.5, rate: 1.7, delay: 220 }]],
  // Stained Rare (Kirche): 4 Schichten – tiefer Schlag, splitterndes Glas, Aufstieg, Akkord
  stained: [['heavy_impact', { volume: 0.8, rate: 0.45 }], ['pull_shatter', { volume: 0.7, rate: 0.8, delay: 110 }],
    ['ascension', { volume: 0.7, delay: 220 }], ['pull_reveal', { volume: 0.7, rate: 0.9, delay: 470 }]],
  // Umbra (höchste Rarity): 11 Schichten über 2,5 s – Sog der Finsternis, steigender Ton, vier Herzschläge (Takte 7/19/27/32 = 240/640/900/1060 ms, siehe BP_HERZSCHLAG),
  // Aufschlag bei 1,2 s (tiefer Schlag, Sub-Bass, Glas, Riss), danach ein tiefer Akkord
  umbra: [['elem_dark', { volume: 1, rate: 0.6 }], ['pull_swell', { volume: 0.7, rate: 0.68, delay: 60 }],
    ['doom_tick', { volume: 0.8, rate: 0.55, delay: 240 }], ['doom_tick', { volume: 0.85, rate: 0.55, delay: 640 }], ['doom_tick', { volume: 0.9, rate: 0.55, delay: 900 }], ['doom_tick', { volume: 0.95, rate: 0.55, delay: 1060 }],
    ['heavy_impact', { volume: 1, rate: 0.3, delay: 1190 }], ['booster_umpf', { volume: 0.9, rate: 0.8, delay: 1195 }], ['pull_shatter', { volume: 0.8, rate: 0.55, delay: 1200 }],
    ['pull_crack', { volume: 0.7, rate: 0.4, delay: 1200 }], ['pull_reveal', { volume: 0.6, rate: 0.55, delay: 1500 }]],
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
// Mehrere Packs (`multi`, Karten liegen in einem scrollbaren Bereich `scrollRef`): `slot` = Platz im Pack-Block, verdeckte Karten zeigen den Kartenrücken selbst
// (bei einem Pack steckt er im Bühnenbild); `quick`: ohne Flip-Animation aufgedeckt (Flip All für Karten außerhalb des Bildes); Bild und Rarity-Ebene nur in
// der Nähe des Sichtbereichs (`near`); `onSeen`: eine schnell aufgedeckte Karte kommt zum ersten Mal ins Bild (vereinfachter Funkeneffekt)
function BpCard({ idx, card, geom, slot, open, quick, hold, onEdge, onDone, onClick, onHover, hot, sold, sellOff, sellValue, onSell, multi, scrollRef, regEl, onSeen }) {
  const [ph, setPh] = useState(0);
  const hostRef = useRef(null), cvRef = useRef(null), rootRef = useRef(null), finishedRef = useRef(false), groundRef = useRef(null);
  const cbRef = useRef({}); cbRef.current = { onEdge, onDone, onSeen };
  const [near, setNear] = useState(!multi);
  const [everNear, setEverNear] = useState(!multi);
  const Z = geom.Z, cw = geom.cw, ch = geom.ch, pad = bpFlipPad(ch);
  const url = bpCardUrl(card.name, card.rarity);
  useEffect(() => {
    if (!multi) return undefined;
    const root = scrollRef && scrollRef.current, el = rootRef.current;
    if (!root || !el || typeof IntersectionObserver === 'undefined') { setNear(true); setEverNear(true); return undefined; }
    const io = new IntersectionObserver(es => { const v = es[es.length - 1].isIntersecting; setNear(v); if (v) setEverNear(true); }, { root, rootMargin: '60% 0px 60% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [multi]);
  // schnell aufgedeckte Karte: beim ersten richtigen Auftauchen (halb im Bild) ein kurzer Funkeneffekt statt der Flip-Inszenierung
  useEffect(() => {
    if (!multi || !quick || !open) return undefined;
    const root = scrollRef && scrollRef.current, el = rootRef.current;
    if (!root || !el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(es => { if (es[es.length - 1].isIntersecting) { io.disconnect(); try { cbRef.current.onSeen && cbRef.current.onSeen(idx); } catch (e) { /* ohne */ } } }, { root, threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, [multi, quick, open]);
  useEffect(() => {
    if (!open) { setPh(0); return undefined; }
    if (quick || finishedRef.current) {   // ohne Animation (Flip All außerhalb des Bildes) bzw. schon einmal fertig (Größenänderung des Fensters: nicht noch einmal drehen)
      setPh(2); finishedRef.current = true;
      try { cbRef.current.onDone && cbRef.current.onDone(idx); } catch (e) { /* ohne */ }
      return undefined;
    }
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
      if (i > BP_FLIP_EDGE && groundRef.current && groundRef.current.style.background) groundRef.current.style.background = '';   // Umbra: Boden wieder schwarz, sobald die Vorderseite aufschlägt
      if (i >= BP_FLIP_EDGE && !edged) { edged = true; try { cbRef.current.onEdge && cbRef.current.onEdge(idx); } catch (e) { /* ohne */ } }
      if (i !== lastIdx) {
        lastIdx = i;
        if (i >= BP_FLIP_LAST) { finishedRef.current = true; setPh(2); try { cbRef.current.onDone && cbRef.current.onDone(idx); } catch (e) { /* ohne */ } return; }
        bpFlipDraw(buf, CW, CH, cw, ch, BP_FLIP_ANG[i], backPix, facePix || backPix, E);
        g.putImageData(img, 0, 0);
      }
      raf = bpRaf(tick);
    };
    raf = bpRaf(tick);
    return () => { dead = true; if (raf) bpCancel(raf); };
  }, [open, quick, cw, ch, url]);
  const done = ph >= 2;
  // Rarity-Ebene (Agent B, public/rarity-fx.js): animiert, sobald die Karte offen ist; ohne Modul/ohne Ebene bleibt es beim Kartenbild
  useEffect(() => {
    if (!done || !near || !hostRef.current || sold) return undefined;     // zurückverkaufte Karte: keine Effektebene mehr; weit außerhalb des Bildes keine animierte Ebene (Standbild genügt)
    const F = window.PpRarityFx;
    if (!F || card.rarity === 'common' || (F.available && !F.available(card.rarity))) return undefined;
    let h = null;
    try { h = F.attach(hostRef.current, { card: (window.CARDS_BY_NAME && window.CARDS_BY_NAME[card.name]) || { name: card.name }, rarity: card.rarity, animated: true, size: cw }); } catch (e) { h = null; }
    return () => { try { h && h.destroy && h.destroy(); } catch (e) { /* ohne */ } };
  }, [done, near, card.rarity, card.name, !!sold]);
  const [sx, sy] = slot || geom.slots[idx];
  const style = { left: geom.left + sx * Z, top: geom.top + sy * Z, width: cw, height: ch, '--bpz': Z };
  return (
    <div ref={(el) => { rootRef.current = el; if (regEl) regEl(idx, el); }} className={'bp-card' + (open ? ' bp-card-open' : ' bp-card-shut') + (open && !done ? ' bp-card-flip' : '') + (done ? ' bp-card-done' : '') + (hot ? ' bp-card-hot' : '') + (sold ? ' bp-card-sold' : '')} style={style}
      onClick={() => { if (!open) onClick(idx); }}
      onMouseEnter={() => onHover(idx, true)} onMouseLeave={() => onHover(idx, false)}
      role="button" tabIndex={open ? -1 : 0} aria-label={open ? bpRarityLabel(card.rarity) + ' ' + card.name : 'Card ' + (idx + 1) + ', face down'}
      onKeyDown={(e) => { if (!open && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick(idx); } }}>
      {multi && !open && <img className="bp-card-back" src={BP_DIR + 'opening/cardback.png'} alt="" draggable={false} />}
      {open && <div className="bp-card-ground" ref={groundRef} style={card.rarity === 'umbra' && !done ? { background: 'transparent' } : undefined} />}   {/* Umbra: solange die Karte auf der Kante steht, scheint die Scheibe (Effekt-Leinwand) durch; sobald sie sich dreht, kommt der schwarze Boden zurück (tick) */}
      {open && (
        <div className="bp-card-face" ref={hostRef} style={{ visibility: done ? 'visible' : 'hidden' }}>
          {everNear && <img src={url} alt="" draggable={false} />}
        </div>
      )}
      {done && sold && <div className="bp-sold-dim" />}
      {done && sold && <div className="bp-sold-tag">SOLD</div>}
      {done && sellValue > 0 && (
        <button type="button" className={'bp-sell' + (sold ? ' bp-sell-sold' : '')} disabled={sellOff || sold}
          title={sold ? 'Sold back' : sellOff ? 'You can sell back one card per pack' : 'Sell this card back for ' + sellValue + ' SC (one card per pack)'}
          onClick={(e) => { e.stopPropagation(); if (!sellOff && !sold) onSell(idx); }}>
          {sold ? 'SOLD' : <React.Fragment>{Z < 2 ? 'SELL' : 'SELL BACK!'} <span className="bp-sell-val">+{sellValue}<img src="/data/sc.png" className="bp-coin" alt="" /></span></React.Fragment>}
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
// Geometrie der Pack-Blöcke bei mehreren Packs (ganzzahliger Faktor Z): 3×3 Karten à 75×105 Bildpunkte, Spaltenabstand 8, Zeilenabstand so groß, dass der
// Sell-Back-Knopf (ragt mit seiner halben Höhe + Rahmen unter die Karte) nie die nächste Karte berührt. Maße in Bildschirmpunkten (Z-fach).
function bpBlockGeom(Z) {
  const cw = 75 * Z, ch = 105 * Z, gx = 8 * Z;
  const over = Math.ceil(Math.max(22, 12 * Z) / 2) + 3 * Z, gy = over + 6 * Z;
  const hd = Math.max(26, 8 * Z + 8);          // Kopfzeile „Pack 2 / 5“
  const gw = 3 * cw + 2 * gx, gh = 3 * ch + 2 * gy + over;
  const slots = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) slots.push([c * (75 + 8), Math.round(r * (ch + gy) / Z)]);
  return { Z, cw, ch, gw, gh, gy, over, hd, slots, blockH: hd + 10 + gh + 18 };
}
// größter ganzzahliger Faktor, bei dem EIN Pack-Block ganz in den Bereich aw × ah passt (mindestens 1: dann scrollt man auch innerhalb eines Packs)
function bpMultiScale(aw, ah) {
  for (let Z = 6; Z > 1; Z--) { const g = bpBlockGeom(Z); if (g.gw + 56 <= aw && g.blockH + 8 <= ah) return Z; }
  return 1;
}
const BP_WAVE_MS = 150;     // Flip All mit mehreren Packs: Abstand der Wellen (je sichtbarem Pack eine) in ms

// Props: packs [{ id, packId, variantId, cards, sold }] (oder `pending` = ein Pack), boosters (GET /api/boosters: price, sellback), sc (Kontostand), onSc(n),
// onClaimed(data, info), onRipMore(data)
function BoosterOpening({ packs: packsProp, pending, boosters, sc, onSc, onClaimed, onRipMore }) {
  const packs = packsProp || (pending ? [pending] : []);
  const n = packs.length, multi = n > 1;
  const first = packs[0] || {};
  const cards = useMemo(() => packs.flatMap(p => p.cards || []), [packs]);
  const where = useMemo(() => { const w = []; packs.forEach((p, pi) => (p.cards || []).forEach((c, i) => w.push([pi, i]))); return w; }, [packs]);   // Karte g → [Pack, Platz im Pack]
  const pack = ((boosters && boosters.packs) || []).find(p => p.id === first.packId) || { id: first.packId, name: first.packId, variants: [] };
  const variant = (pack.variants || []).find(v => v.id === first.variantId) || (pack.variants || [])[0] || null;

  const [phase, setPhase] = useState('load');         // 'load' | 'play' | 'cards'
  const [err, setErr] = useState('');
  const [flipped, setFlipped] = useState(() => cards.map(() => false));   // je Karte: false · true (mit Flip-Animation) · 'q' (ohne, Flip All außerhalb des Bildes)
  const flippedRef = useRef(flipped); flippedRef.current = flipped;
  const doneSet = useRef(new Set());
  const [doneN, setDoneN] = useState(0);              // Karten, deren Flip-Animation fertig ist
  const [claiming, setClaiming] = useState(false);
  const [soldArr, setSoldArr] = useState(() => packs.map(p => (Number.isInteger(p.sold) ? p.sold : -1)));   // je Pack: Index der zurückverkauften Karte (-1: keine); überlebt Neuladen (Server)
  const [selling, setSelling] = useState(false);
  const [note, setNote] = useState('');                // kurze Meldung im HUD (Sell Back / Add and rip one more)
  const [hover, setHover] = useState(-1);
  const [scHit, setScHit] = useState(null);        // { n, key }: Verkauf → Goldanzeige kurz hervorheben, grünes „+X“ daneben
  const scHitTimer = useRef(0);
  const waveTimers = useRef([]);
  useEffect(() => () => { clearTimeout(scHitTimer.current); waveTimers.current.forEach(clearTimeout); }, []);
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [op, setOp] = useState(null);                  // opening.json
  const [area, setArea] = useState(null);              // mehrere Packs: Größe des Scrollbereichs { w, h }

  const stageRef = useRef(null), fxRef = useRef(null), worldRef = useRef(null), scrollRef = useRef(null), scrollInRef = useRef(null);
  const elsRef = useRef([]);                         // Kartenelemente (für die Lage der Effekte bei mehreren Packs)
  const regEl = useCallback((g, el) => { elsRef.current[g] = el; }, []);
  const fx = useRef(null), playRef = useRef(null), mixRef = useRef(1), bigSoundT = useRef({});
  const skipRef = useRef(false), multiRef = useRef(multi); multiRef.current = multi;

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

  // Geometrie: Bühne mittig, ganzzahliger Faktor Z, Ursprung auf Rasterzellen (S) ausgerichtet.
  // Mehrere Packs: die Bühne gilt nur für die Animation (Faktor Z); die Kartenblöcke haben ihren eigenen Faktor Zc (passt EIN Pack-Block in den Scrollbereich).
  const Z = bpStageScale(vp.w, vp.h);
  const cardsView = multi && phase === 'cards';
  const Zc = cardsView ? bpMultiScale(area ? area.w : vp.w, area ? area.h : vp.h - 160) : Z;
  const S = Math.max(2, cardsView ? Zc : Z);
  const geom = useMemo(() => {
    const stage = op ? op.stage : [320, 416];
    const left = Math.max(0, Math.round((vp.w - stage[0] * Z) / 2 / S) * S), top = Math.max(0, Math.round((vp.h - stage[1] * Z) / 2 / S) * S);
    const size = op ? op.cardSize : [75, 105];
    return { Z, S, stage, left, top, slots: op ? op.cardSlots : cards.map(() => [0, 0]), cw: size[0] * Z, ch: size[1] * Z };
  }, [vp.w, vp.h, op, S]);
  const bgeom = useMemo(() => bpBlockGeom(Zc), [Zc]);

  // Laden: opening.json, Schichten des Packs, Packbild (+ Reißmasken); dann die Animation starten
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const o = await fetch(BP_DIR + 'opening/opening.json').then(r => { if (!r.ok) throw new Error('opening.json'); return r.json(); });
        if (dead) return;
        const [back, front, base, top, body] = await Promise.all([
          bpImg(BP_DIR + 'opening/' + o.layers.back.replace('<pack>', first.packId)),
          bpImg(BP_DIR + 'opening/' + o.layers.front.replace('<pack>', first.packId)),
          variant ? bpImg(bpAsset(variant.base)) : Promise.reject(new Error('variant')),
          bpImg(BP_DIR + 'opening/' + o.cut.top), bpImg(BP_DIR + 'opening/' + o.cut.body),
        ]);
        const shim = variant && variant.shimmer ? await bpImg(bpAsset(variant.shimmer)).catch(() => null) : null;
        if (dead) return;
        // Siegelstreifen / Rest als eigene Bilder (Packbild mal Maske, harte Alphawerte)
        const cut = (mask) => { const c = document.createElement('canvas'); c.width = 192; c.height = 320; const g = c.getContext('2d'); g.drawImage(base, 0, 0); g.globalCompositeOperation = 'destination-in'; g.drawImage(mask, 0, 0); return c; };
        playRef.current = { o, back, front, base, shim, topC: cut(top), bodyC: cut(body), backUrl: BP_DIR + 'opening/' + o.layers.back.replace('<pack>', first.packId), frontUrl: BP_DIR + 'opening/' + o.layers.front.replace('<pack>', first.packId) };
        setOp(o);
        setPhase('play');
      } catch (e) { if (!dead) setErr('Could not load the pack animation (' + e.message + ')'); }
    })();
    return () => { dead = true; };
  }, [first.id]);

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
      let f = Math.max(0, Math.floor((now - t0) * o.fps / 1000));   // rAF-Zeitstempel kann knapp vor t0 liegen: nie negativ (sonst fehlt der Zeitleisteneintrag und die Öffnung hängt)
      if (skipRef.current) {
        skipRef.current = false; f = Math.max(f, ready + 1); t0 = now - f * 1000 / o.fps;
        // Klänge, die beim Überspringen nicht verloren gehen sollen (opening.json: skipPlay — der „Umpf“ beim Aufgehen des Packs), genau einmal:
        // nur die, die noch NICHT gelaufen sind (nextSound = Zahl der schon gespielten Einträge)
        for (let k = nextSound; k < o.sounds.length; k++) { const s = o.sounds[k]; if (s.skipPlay) bpPlay(s.name, { volume: s.volume, rate: s.rate }); }
        nextSound = o.sounds.length; bpPlay('booster_ready', { volume: 0.85 });
      }
      while (nextSound < o.sounds.length && o.sounds[nextSound].f <= f) { const s = o.sounds[nextSound++]; bpPlay(s.name, { volume: s.volume, rate: s.rate }); }
      if (!arrived && f >= ready) { arrived = true; setPhase('cards'); }
      if (arrived && multiRef.current) { draw(Math.min(f, loopB)); return; }   // mehrere Packs: die Bühne wird ausgeblendet (die Blöcke übernehmen), nicht weiter malen
      const fd = f > loopB ? loopA + ((f - loopA) % (loopB - loopA + 1)) : f;
      if (fd !== lastF) { lastF = fd; draw(fd); }
      raf = bpRaf(tick);
    };
    raf = bpRaf(tick);
    return () => { dead = true; if (raf) bpCancel(raf); };
  }, [phase === 'load' ? 'load' : 'run', op]);

  // Effekt-Leinwand (Größe folgt dem Fenster). Bildschirmzucken (Stained): bei mehreren Packs wackelt der Inhalt des Scrollbereichs, nicht die Bühne.
  useEffect(() => {
    if (!fxRef.current) return undefined;
    if (fx.current) fx.current.destroy();
    fx.current = bpFxCreate(fxRef.current, S, cardsView ? scrollInRef.current : worldRef.current);
    return () => { if (fx.current) { fx.current.destroy(); fx.current = null; } };
  }, [vp.w, vp.h, S, phase === 'load', cardsView]);

  // Mehrere Packs: Größe des Scrollbereichs verfolgen (Fenstergröße, Knopfleiste bricht um) …
  useEffect(() => {
    if (!cardsView || !scrollRef.current) return undefined;
    const el = scrollRef.current;
    const measure = () => setArea(a => (a && a.w === el.clientWidth && a.h === el.clientHeight ? a : { w: el.clientWidth, h: el.clientHeight }));
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure); ro.observe(el);
    return () => ro.disconnect();
  }, [cardsView]);
  // … und laufende Effekte beim Scrollen mitnehmen (Effektleinwand steht fest im Fenster; in ganzen Rasterzellen, der Rest wird mitgezählt)
  const scrollAcc = useRef({ last: 0, acc: 0 });
  const onScrollArea = () => {
    const el = scrollRef.current, a = scrollAcc.current; if (!el) return;
    const dy = el.scrollTop - a.last; a.last = el.scrollTop;
    if (!fx.current || !fx.current.busy()) { a.acc = 0; return; }
    a.acc += dy;
    const k = Math.trunc(a.acc / S);
    if (k) { fx.current.shift(-k); a.acc -= k * S; }
  };

  // Karte aufdecken: die Flip-Animation der Karte (BpCard) läuft sofort; auf der Kante (Aufschlagen der Vorderseite) kommen Klänge und der Rarity-Effekt
  const flip = useCallback((i, opt) => {
    if (flippedRef.current[i]) return;
    setFlipped(f => { const nf = f.slice(); nf[i] = (opt && opt.quick) ? 'q' : true; flippedRef.current = nf; return nf; });
    if (opt && opt.mix) mixRef.current = opt.mix;
  }, []);
  const onEdge = useCallback((i) => {
    const r = cards[i].rarity, mix = mixRef.current;
    // Flip All: mehrere Karten derselben großen Rarity schlagen gleichzeitig auf – ihre Klangfolge läuft nur einmal (identische Klänge übereinander addieren sich
    // zu Übersteuerung, und eine Folge ist hier lauter genug); alle anderen Rarities behalten ihren Klang je Karte
    const big = r === 'umbra' || r === 'stained', nowT = performance.now();
    const quiet = big && mix > 1 && nowT - (bigSoundT.current[r] || -1e9) < 600;
    if (big) bigSoundT.current[r] = nowT;
    const vol = big && mix > 1 ? 0.8 : (mix > 1 ? Math.min(1, 1.3 / Math.sqrt(mix)) : 1);
    if (!quiet) (BP_FLIP_SOUNDS[r] || [['draw', { volume: 0.5 }]]).forEach(([nm, o]) => bpPlay(nm, { ...o, volume: (o.volume != null ? o.volume : 1) * vol }));
    if (BP_FX_LEN[r] && fx.current && geom) {
      if (multiRef.current) {   // Lage der Karte im Fenster (Fensterkoordinaten = Koordinaten der Effektleinwand); der Effekt scrollt danach mit (onScrollArea)
        const el = elsRef.current[i]; if (!el) return;
        const rc = el.getBoundingClientRect();
        fx.current.spawn(r, (rc.left + rc.width / 2) / S, (rc.top + rc.height / 2) / S, rc.width / S, rc.height / S, mix);
        return;
      }
      const [sx, sy] = geom.slots[i], cw = geom.cw / S, ch = geom.ch / S;
      fx.current.spawn(r, (geom.left + sx * Z) / S + cw / 2, (geom.top + sy * Z) / S + ch / 2, cw, ch, mix);
    }
  }, [cards, geom, Z, S]);
  const onCardDone = useCallback((g) => { if (!doneSet.current.has(g)) { doneSet.current.add(g); setDoneN(doneSet.current.size); } }, []);
  // eine schnell aufgedeckte Karte kommt ins Bild: vereinfachter Effekt (ein Funkenstoß), ab Rare
  const onSeen = useCallback((g) => {
    const c = cards[g], el = elsRef.current[g];
    if (!c || !el || !fx.current || !BP_FX_LEN[c.rarity]) return;
    const rc = el.getBoundingClientRect();
    fx.current.spawn('rare', (rc.left + rc.width / 2) / S, (rc.top + rc.height / 2) / S, rc.width / S, rc.height / S, 2);
  }, [cards, S]);

  // „Flip All“: ALLE noch verdeckten Karten (aller Packs) werden aufgedeckt.
  //  Ein Pack: alle drehen sich gleichzeitig (jede mit eigener Flip-Animation und ihrem Effekt).
  //  Mehrere Packs: nur die Karten im Sichtbereich bekommen die volle Inszenierung, in Wellen (je Pack eine, BP_WAVE_MS Abstand); alle anderen werden sofort
  //  (ohne Animation, ohne Effekt) umgedreht und zeigen beim ersten Auftauchen einen kurzen Funkenstoß (onSeen) — so bleibt die Last durch die Zahl der sichtbaren Karten begrenzt.
  const flipAll = () => {
    const rest = cards.map((c, g) => g).filter(g => !flippedRef.current[g]);
    if (!rest.length) return;
    if (!multi) { mixRef.current = rest.length; rest.forEach(g => flip(g, { mix: rest.length })); return; }
    const sc0 = scrollRef.current, sr = sc0 ? sc0.getBoundingClientRect() : { top: 0, bottom: vp.h };
    const vis = [], hid = [];
    for (const g of rest) { const el = elsRef.current[g], rc = el && el.getBoundingClientRect(); (rc && rc.bottom > sr.top && rc.top < sr.bottom ? vis : hid).push(g); }
    if (hid.length) setFlipped(f => { const nf = f.slice(); for (const g of hid) if (!nf[g]) nf[g] = 'q'; flippedRef.current = nf; return nf; });
    const byPack = new Map();
    for (const g of vis) { const pi = where[g][0]; if (!byPack.has(pi)) byPack.set(pi, []); byPack.get(pi).push(g); }
    mixRef.current = Math.max(2, vis.length);
    [...byPack.keys()].sort((a, b) => a - b).forEach((pi, k) => {
      const go = () => byPack.get(pi).forEach(g => flip(g, { mix: Math.max(2, vis.length) }));
      if (k === 0) go(); else waveTimers.current.push(setTimeout(go, k * BP_WAVE_MS));
    });
  };

  const allOpen = flipped.every(Boolean);
  const allDone = allOpen && doneN >= cards.length;
  const openN = flipped.filter(Boolean).length;

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
  const ripCost = packPrice * n;
  const canRip = (sc || 0) >= ripCost;       // Gutschriften aus Sell Back stehen schon im Kontostand
  const ids = packs.map(p => p.id);

  const claim = async () => {
    if (claiming) return;
    setClaiming(true); setErr(''); setNote('');
    try {
      const r = await window.ppBoosterApi.claim(ids);
      if (!r.ok) throw new Error((r.data && r.data.error) || 'Could not add the cards');
      bpPlay('shop_purchase', { volume: 0.8 });
      onClaimed(r.data);
    } catch (e) { setErr(e.message); setClaiming(false); }
  };

  // „Add and rip one more!“: alle offenen Packs einlösen + sofort gleich viele Packs derselben Art kaufen und öffnen (eine Anfrage; der Server prüft SC und löst die
  // alten Packs in jedem Fall ein). Gelingt der Neukauf nicht (zu wenig SC), sind sie trotzdem eingelöst: die Ansicht schließt mit einer Meldung.
  const ripMore = async () => {
    if (claiming || selling || !canRip) return;
    setClaiming(true); setErr(''); setNote('');
    try {
      const r = await window.ppBoosterApi.ripMore(ids);
      if (r.ok && (r.data.packs || r.data.pending)) { bpPlay('shop_purchase', { volume: 0.8 }); onRipMore && onRipMore(r.data); return; }
      if (r.data && r.data.claimed) { onClaimed(r.data, { ripFailed: r.data.error || 'Could not buy another pack' }); return; }
      throw new Error((r.data && r.data.error) || 'Could not open another pack');
    } catch (e) { setNote(e.message); setClaiming(false); }
  };

  // „Sell Back!“: EINE Karte je Pack gegen SC zurückgeben (Server: 409 beim zweiten Mal im selben Pack). Erst nach dem Aufdecken der Karte anklickbar.
  const sell = async (g) => {
    const [pi, i] = where[g];
    if (soldArr[pi] >= 0 || selling || claiming) return;
    setSelling(true); setNote('');
    const setSold = (k) => setSoldArr(a => { const b = a.slice(); b[pi] = k; return b; });
    try {
      const r = await window.ppBoosterApi.sell(packs[pi].id, i);
      if (r.ok) {
        setSold(i);
        bpPlay('gold_gain', { volume: 0.8 });
        if (onSc && r.data.sc != null) onSc(r.data.sc);
        const gain = r.data.amount != null ? r.data.amount : (sellTable[cards[g].rarity] || 0);
        setScHit({ n: gain, key: Date.now() });
        clearTimeout(scHitTimer.current);
        scHitTimer.current = setTimeout(() => setScHit(null), 2000);
      } else if (r.status === 409 && Number.isInteger(r.data.sold) && r.data.sold >= 0) setSold(r.data.sold);
      else setNote((r.data && r.data.error) || 'Could not sell the card');
    } catch (e) { setNote(e.message); }
    setSelling(false);
  };

  const hoverCard = hover >= 0 && flipped[hover] ? cards[hover] : null;
  const Tooltip = window.CardTooltipContent;
  const stageW = geom.stage[0] * Z, stageH = geom.stage[1] * Z;
  const cardsBottom = geom.top + (geom.slots[6] ? (geom.slots[6][1] + (op ? op.cardSize[1] : 105)) * Z : stageH);
  const sellHalf = Math.ceil(Math.max(22, Z * 12) / 2) + 2 * Z;   // untere Hälfte der Sell-Back-Knöpfe + Rahmen, sie ragen unter die Karten
  const hudTop = cardsBottom + sellHalf + 10;
  const hudRoom = vp.h - hudTop;
  const tight = hudRoom < 48;      // niedriger Bildschirm (Handy quer): Knöpfe an den rechten Rand statt unter die Karten

  const cardEl = (g, c, blockGeom, slot) => {
    const [pi, i] = where[g];
    return (
      <BpCard key={g} idx={g} card={c} geom={blockGeom} slot={slot} open={!!flipped[g]} quick={flipped[g] === 'q'} hold={Math.round((BP_FACE_DELAY[c.rarity] || 0) / BP_TAKT)} hot={hover === g}
        sold={soldArr[pi] === i} sellOff={soldArr[pi] >= 0 || selling || claiming} sellValue={sellTable[c.rarity] || 0} onSell={sell}
        multi={multi} scrollRef={scrollRef} regEl={regEl} onSeen={onSeen}
        onEdge={onEdge} onDone={onCardDone} onClick={(k) => { mixRef.current = 1; flip(k); }} onHover={(k, on) => setHover(on ? k : (h => (h === k ? -1 : h)))} />
    );
  };
  const addLabel = multi ? 'ADD ALL CARDS TO COLLECTION' : 'ADD CARDS TO COLLECTION';
  const ripLabel = multi ? 'ADD AND RIP ' + n + ' MORE!' : 'ADD AND RIP ONE MORE!';
  const hudButtons = () => (
    <React.Fragment>
      {!allDone && (
        <button className="btn bp-btn" disabled={allOpen} onClick={flipAll}>FLIP ALL</button>
      )}
      {allDone && (
        <div className="bp-hud-row">
          <button className="btn bp-btn bp-btn-go" disabled={claiming} onClick={claim}>
            {claiming ? 'ADDING…' : addLabel}
          </button>
          <button className="btn bp-btn bp-btn-more" disabled={claiming || !canRip} onClick={ripMore}
            title={canRip ? 'Add these cards to your collection and open ' + (multi ? n + ' more packs' : 'another pack') + ' of the same kind' : 'Not enough Smug Coins for ' + (multi ? n + ' more packs' : 'another pack') + ' (' + ripCost + ' needed)'}>
            {ripLabel} <img src="/data/sc.png" className="bp-coin" alt="" /> {ripCost}
          </button>
        </div>
      )}
    </React.Fragment>
  );
  const warnRip = allDone && !canRip && (multi || tight || hudRoom >= 84)
    ? <div className="bp-hint bp-hint-warn">{multi ? 'Not enough SC for ' + n + ' more packs (' + ripCost + ' SC needed)' : 'Not enough SC for another pack (' + packPrice + ' SC needed)'}</div> : null;

  // Die Shop-Seite läuft unter CSS-`zoom` (--ui-scale): die Vollbild-Ansicht hängt deshalb direkt an <body>, damit Fenster- und Bildpunkte übereinstimmen
  // (ganzzahliger Bühnenfaktor Z in echten Bildschirmpunkten, nicht ein mitgezoomtes Mischmaß).
  const tree = (
    <div className={'bp-open' + (multi ? ' bp-open-multi' : '')} data-pp-px="aus">
      <div className="bp-world" ref={worldRef}>
        <canvas ref={stageRef} className="bp-stage" width={geom.stage[0]} height={geom.stage[1]}
          style={{ left: geom.left, top: geom.top, width: stageW, height: stageH, visibility: phase === 'load' || cardsView ? 'hidden' : 'visible' }} />
        {phase === 'cards' && !multi && cards.map((c, i) => cardEl(i, c, geom, null))}
      </div>
      {cardsView && (
        <div className="bp-mview">
          <div className="bp-topbar">
            <div className="bp-top-title">{n} PACKS <span>· {pack.name}</span></div>
          </div>
          <div className="bp-scroll" ref={scrollRef} onScroll={onScrollArea} tabIndex={0} role="region" aria-label="Opened packs">
            <div className="bp-scroll-in" ref={scrollInRef}>
              {packs.map((p, pi) => {
                const g0 = where.findIndex(w => w[0] === pi), sd = soldArr[pi], sc2 = sd >= 0 && p.cards[sd] ? sellTable[p.cards[sd].rarity] || 0 : 0;
                return (
                  <section className="bp-pk" key={p.id} style={{ width: bgeom.gw, '--bpz': Zc }} aria-label={'Pack ' + (pi + 1) + ' of ' + n}>
                    <header className="bp-pk-head" style={{ height: bgeom.hd }}>
                      <span className="bp-pk-no">PACK {pi + 1} / {n}</span>
                      {sd >= 0 && <span className="bp-pk-sold">SOLD BACK +{sc2}<img src="/data/sc.png" className="bp-coin" alt="" /></span>}
                    </header>
                    <div className="bp-pk-grid" style={{ width: bgeom.gw, height: bgeom.gh }}>
                      {p.cards.map((c, i) => cardEl(g0 + i, c, { ...bgeom, left: 0, top: 0 }, bgeom.slots[i]))}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
          <div className="bp-hudbar">
            {hudButtons()}
            {warnRip}
            {!allOpen && <div className="bp-hint">Click a card to flip it · {openN} / {cards.length} revealed</div>}
            {note && <div className="bp-hint bp-hint-warn">{note}</div>}
          </div>
        </div>
      )}
      <canvas ref={fxRef} className="bp-fx" />
      {phase === 'load' && !err && <div className="bp-msg">Opening {multi ? n + ' × ' : ''}{pack.name}…</div>}
      {err && <div className="bp-msg bp-msg-err">{err}</div>}
      {phase === 'play' && (
        <button className="btn bp-skip" onClick={() => { skipRef.current = true; }}>SKIP ▸</button>
      )}
      {phase === 'play' && multi && <div className="bp-multi-badge">{n} PACKS</div>}
      {phase === 'cards' && !multi && (
        <div className={'bp-hud' + (tight ? ' bp-hud-tight' : '')} style={tight ? undefined : { left: Math.max(0, geom.left - 60 * Z), width: stageW + 120 * Z, top: hudTop }}>
          {hudButtons()}
          {warnRip}
          {!allOpen && <div className="bp-hint">Click a card to flip it</div>}
          {note && <div className="bp-hint bp-hint-warn">{note}</div>}
        </div>
      )}
      {phase === 'cards' && (
        <div className={'bp-sc' + (scHit ? ' bp-sc-hit' : '')} key={scHit ? 'hit' + scHit.key : 'idle'} title="Your Smug Coins">
          <img src="/data/sc.png" className="bp-coin" alt="" /> {sc || 0}
          {scHit && <span className="bp-sc-plus">+{scHit.n}</span>}
        </div>
      )}
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
