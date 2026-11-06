'use strict';
// ═══════════════════════════════════════════════════════════════════
//  KARTENBILDER AUS DEM RENDERER STATT AUS DATEIEN
//
//  Das Spiel setzt Kartenbilder überall als `<img src="/cards/<Datei>.png">`
//  bzw. `/cards/skins/<Skin>.png` (und als `new Image()` für Animationen).
//  Statt dafür 1.200 fertige Karten-PNGs auszuliefern, fängt diese Datei
//  solche Quellen ab und lässt die Karte von `card-render.js` zusammensetzen:
//  Rahmen + Icons + Schrift (zusammen ~40 KB) und die Kunst der Karte aus
//  EINEM Atlas (`cardgen/art.png`). Der Rest des Spiels bleibt unverändert —
//  `img.src` liefert weiterhin die Karten-URL zurück.
//
//  Ablauf je Bild: Quelle -> Karte bestimmen (cards.json / skins.json) ->
//  [dauerhafter Cache: IndexedDB, siehe CardRender.openCache] -> Canvas -> PNG-Blob -> `blob:`-URL (gemerkt, 400 Stück).
//  Eine einmal gezeichnete Karte wird dauerhaft aufgehoben und beim naechsten Besuch (Refresh!) aus dem Speicher geholt statt
//  neu gezeichnet; ein neuer Stand der Dateien (render-version.js) verwirft den Vorrat. Bilder im sichtbaren
//  Bereich werden zuerst gerendert, solche weit außerhalb erst beim Scrollen.
//  Gibt es zu einer Quelle keine Kunst im Atlas (oder fehlt Path2D/Canvas), wird die
//  ursprüngliche URL ganz normal vom Server geladen.
// ═══════════════════════════════════════════════════════════════════
(function () {
  if (window.__cardImageShim) return;
  if (!window.CardRender || typeof Path2D === 'undefined' || !HTMLImageElement) return;
  window.__cardImageShim = true;

  // Durchsichtiger Platzhalter in Kartengröße (750x1050): Bis die Karte fertig ist, hat das <img> dieselbe
  // natürliche Größe wie später. Ein 1x1-Pixel würde Layouts verfälschen, die von der Bildgröße abhängen
  // (z. B. der absolut positionierte Ausschnitt in HeroArtCrop liegt dann ganz außerhalb seines Rahmens,
  // der IntersectionObserver meldet ihn nie als sichtbar, und die Karte würde nie gezeichnet).
  const PLACEHOLDER = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="750" height="1050"/>');
  const MAX_CACHE = 400;

  // Dateinamen verlieren Satzzeichen („Hello, World“ -> „Hello World.png“): gleiche Regel wie card-images.js
  const strippedKey = n => String(n || '').replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

  const protoDesc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  const nativeSetAttr = Element.prototype.setAttribute;
  const nativeGetAttr = Element.prototype.getAttribute;
  const nativeRemoveAttr = Element.prototype.removeAttribute;
  function setReal(img, url) { protoDesc.set.call(img, url); }

  // ── Zuordnung Bilddatei -> Karte / Skin ──
  let ready = null;          // Promise, sobald Renderer, Daten und Kunstindex da sind
  let failed = false;
  let cardByStem = null, skinByStem = null, cardsByName = null;

  function boot() {
    if (ready) return ready;
    ready = (async () => {
      const [cards, version] = await Promise.all([
        fetch('/data/cards.json').then(r => r.json()),
        // Fingerabdruck aller Dateien, aus denen Karten entstehen (render-version.js): gilt als Schluessel des dauerhaften Caches
        fetch('/api/render-version', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then(j => (j && j.v) || null).catch(() => null),
        CardRender.init({ base: '/cardgen/' }),
        CardRender.loadMeta('/data/card-render.json'),
        CardRender.loadArtIndex(),
      ]);
      await CardRender.openCache(version);     // ohne Version oder ohne IndexedDB: false, dann wird wie bisher jedes Mal gezeichnet
      cardsByName = Object.create(null);
      cardByStem = Object.create(null);
      for (const c of cards) {
        cardsByName[c.name] = c;
        // Farbvarianten „Name [B]“ / „Name [W]“ liegen als „Name.png“ / „Name.1.png“ auf der Platte
        const m = /^(.*?)\s*\[(B|W)\]$/.exec(c.name);
        cardByStem[strippedKey(m ? (m[2] === 'B' ? m[1] : m[1] + '.1') : c.name)] = c.name;
      }
      skinByStem = Object.create(null);
      const art = await CardRender.loadArtIndex();
      for (const k of [...Object.keys(art.a), ...Object.keys(art.b)]) {
        if (k.startsWith('skin/')) skinByStem[strippedKey(k.slice(5))] = k.slice(5);
      }
      // Skin -> Basiskarte (data/skins.json: Held -> [Skins]); Held-Namen dürfen ohne Satzzeichen stehen
      const skins = await fetch('/data/skins.json').then(r => r.json());
      window.__cardShimSkinBase = Object.create(null);
      for (const [hero, list] of Object.entries(skins)) {
        const base = cardsByName[hero] || cardsByName[cardByStem[strippedKey(hero)]];
        if (base) for (const s of list) window.__cardShimSkinBase[s] = base;
      }
    })().catch(err => { failed = true; console.warn('[card-image-shim] Renderer nicht verfügbar, nutze PNG-Dateien:', err && err.message); });
    return ready;
  }

  /** URL -> { id, kind, key } oder null (kein Kartenbild). */
  function parse(url) {
    if (!url || typeof url !== 'string') return null;
    let path = url;
    if (/^https?:/i.test(url)) {
      try { const u = new URL(url); if (u.origin !== location.origin) return null; path = u.pathname; } catch (e) { return null; }
    }
    // Varianten per Query: `?ohne=hp,atk` (Karte ohne gedruckte HP/ATK — Brett, dort liegen die Live-Werte darueber) und
    // `?lv=2&kost=3` (aktuelle Stufe / Kosten auf die Karte gedruckt — Hand: gruen = verringert, rot = erhoeht) und
    // `?stufe=2` (Faehigkeitskarte: die Box der aktuellen Stufe hervorgehoben, die anderen grau — Brett).
    const query = url.split('#')[0].split('?').slice(1).join('?');
    const qm = /(?:^|&)ohne=([a-z,]*)/.exec(query);
    const ohne = qm ? ['atk', 'hp'].filter(k => qm[1].split(',').includes(k)).join(',') : '';
    const zahl = name => { const m = new RegExp('(?:^|&)' + name + '=(\\d{1,3})(?:&|$)').exec(query); return m ? parseInt(m[1], 10) : null; };
    const lv = zahl('lv'), kost = zahl('kost'), stufe = zahl('stufe');
    path = path.split(/[?#]/)[0];
    if (!path.startsWith('/cards/') || path.startsWith('/cards/effects/')) return null;
    let rel;
    try { rel = decodeURIComponent(path.slice(7)); } catch (e) { return null; }
    if (!/\.(png|webp|jpe?g)$/i.test(rel)) return null;
    const stem = rel.replace(/\.[a-z]+$/i, '');
    const sfx = variantKey({ ohne, lv, kost, stufe });
    if (stem.startsWith('skins/')) {
      const file = stem.replace(/^skins\/(?:unlockable\/)?/, '');
      return { kind: 'skin', stem: file, ohne, lv, kost, stufe, id: 'skin:' + file + sfx };
    }
    if (stem.includes('/')) return null;
    return { kind: 'card', stem, ohne, lv, kost, stufe, id: 'card:' + stem + sfx };
  }
  /** Die Variante als Anhang der Karten-ID: `|o=hp,atk|l=2|k=3` (leer ohne Variante). */
  function variantKey(v) {
    return (v.ohne ? '|o=' + v.ohne : '') + (v.lv != null ? '|l=' + v.lv : '') + (v.kost != null ? '|k=' + v.kost : '') + (v.stufe != null ? '|s=' + v.stufe : '');
  }
  /** Karten-ID (`card:Stem` / `skin:Stem`, optional mit Variante) -> wie `parse`; fuer das Vorwaermen aus der gemerkten Liste. */
  function fromId(id) {
    const teile = id.split('|');
    const m = { kind: id.startsWith('skin:') ? 'skin' : 'card', stem: teile[0].slice(5), ohne: '', lv: null, kost: null, stufe: null, id };
    for (const t of teile.slice(1)) {
      if (t.startsWith('o=')) m.ohne = t.slice(2);
      else if (t.startsWith('l=')) m.lv = parseInt(t.slice(2), 10);
      else if (t.startsWith('k=')) m.kost = parseInt(t.slice(2), 10);
      else if (t.startsWith('s=')) m.stufe = parseInt(t.slice(2), 10);
    }
    return m;
  }

  function resolve(m) {
    if (m.kind === 'skin') {
      const skin = skinByStem[strippedKey(m.stem)] || (CardRender.hasArt('skin/' + m.stem) ? m.stem : null);
      const base = skin && window.__cardShimSkinBase[skin];
      return base ? { card: base, skin } : null;
    }
    const name = cardByStem[strippedKey(m.stem)] || (cardsByName[m.stem] ? m.stem : null);
    return name && CardRender.hasArt(name) ? { card: cardsByName[name], skin: null } : null;
  }

  // ── Blob-Cache (LRU) ──
  const cache = new Map();           // id -> blob:-URL
  const inflight = new Map();        // id -> Promise<url|null>
  function remember(id, url) {
    cache.set(id, url);
    if (cache.size > MAX_CACHE) {
      const oldest = cache.keys().next().value;
      URL.revokeObjectURL(cache.get(oldest));
      cache.delete(oldest);
    }
  }
  function blobFor(m) {
    if (cache.has(m.id)) { const u = cache.get(m.id); cache.delete(m.id); cache.set(m.id, u); return Promise.resolve(u); }
    if (inflight.has(m.id)) return inflight.get(m.id);
    const p = (async () => {
      const r = resolve(m);
      if (!r) return null;
      // Dauerhafter Cache: die Karte aus einem frueheren Besuch (gleiche Render-Version) statt neu zu zeichnen
      const key = 'c:' + m.id;
      const hit = await CardRender.cacheGet(key);
      if (hit instanceof Blob) {
        stats.persisted++;
        const url = URL.createObjectURL(hit);
        fromStore.add(url);
        remember(m.id, url);
        return url;
      }
      const opts = {};
      if (r.skin) opts.skin = r.skin;
      if (m.ohne) { if (m.ohne.includes('hp')) opts.noHp = true; if (m.ohne.includes('atk')) opts.noAtk = true; }
      if (m.lv != null) opts.lv = m.lv;
      if (m.kost != null) opts.kost = m.kost;
      if (m.stufe != null) opts.stufe = m.stufe;
      const cv = await CardRender.renderCard(r.card, Object.keys(opts).length ? opts : null);
      if (!cv) return null;
      const blob = await CardRender.toBlob(cv);
      if (!blob) return null;
      CardRender.cachePut(key, blob, blob.size);          // fuer den naechsten Besuch (ohne zu warten)
      const url = URL.createObjectURL(blob);
      remember(m.id, url);
      return url;
    })().catch(err => { console.warn('[card-image-shim]', m.id, err && err.message); return null; })
      .finally(() => inflight.delete(m.id));
    inflight.set(m.id, p);
    return p;
  }

  // ── Warteschlange ──
  // Fuenf Stufen: sichtbare Bilder zuerst, dann `new Image()` (Animationen warten auf onload), dann solche, die nur in der
  // Naehe des Bildschirms liegen, dann das VORWAERMEN der Karten, die der naechste Bildschirm zuerst zeigt, ganz zuletzt reine
  // DEKORATION (`data-card-low`, z. B. die Kartenwand des Hauptmenues): sie darf nie die Karten aufhalten, die jemand gerade
  // ansehen will. Drei Arbeiter ueberlappen Zeichnen (Hauptthread) und
  // PNG-Kodierung (im Hintergrund); zwischen zwei Karten bekommt die Oberflaeche Luft.
  const stats = { handled: 0, enqueued: 0, applied: 0, stale: 0, fallback: 0, renderMs: 0, renders: 0, persisted: 0, recovered: 0, dropped: 0, warmed: 0 };
  const fromStore = new Set();       // blob:-URLs, die aus dem dauerhaften Cache stammen (zum Erkennen kaputter Eintraege)
  const queues = [[], [], [], [], []];     // 0 sichtbar, 1 `new Image()`, 2 in der Naehe/Leerlauf, 3 Vorwaermen (Hauptmenue), 4 Dekoration (`data-card-low`)
  let workers = 0;
  const WORKERS = 3;
  function enqueue(job, tier) { if (job.queued) return; job.queued = true; stats.enqueued++; queues[tier].push(job); while (workers < WORKERS) { workers++; work().finally(() => { workers--; }); } }
  function nextJob() { for (const q of queues) if (q.length) return q.shift(); return null; }
  async function work() {
    await boot();
    for (let job; (job = nextJob());) {
      if (job.warm) {                                                           // Vorwaermen: nur in den Speicher holen, kein <img>
        if (!failed) { const url = await blobFor(job.m); if (url) pin(job.m.id, url, job.keep); }
        warming.delete(job.m.id); stats.warmed++;
        await new Promise(r => setTimeout(r, 0));
        continue;
      }
      if (job.img.__cardTok !== job.tok) { stats.stale++; continue; }       // inzwischen anderes Bild
      // Das Bild steht gar nicht mehr in der Seite (z. B. das Hauptmenue wurde verlassen): nicht zeichnen. Kommt es wieder in
      // die Seite, holt der MutationObserver unten den Auftrag nach. `new Image()` hat nie einen Platz in der Seite.
      if (!job.img.__viaCtor && !job.img.isConnected) { job.img.__cardDropped = true; job.queued = false; stats.dropped++; continue; }
      const t0 = performance.now();
      const url = failed ? null : await blobFor(job.m);
      stats.renders++; stats.renderMs += performance.now() - t0;
      if (job.img.__cardTok !== job.tok) { stats.stale++; continue; }
      if (url) stats.applied++; else stats.fallback++;
      setReal(job.img, url || job.orig);                                  // ohne Kunst: ganz normal die Datei vom Server
      if (url) waermeStufen(job.m);
      // Ein gemerkter Eintrag, der sich nicht dekodieren laesst (beschaedigt), wird verworfen und die Karte neu gezeichnet
      if (url && fromStore.has(url)) job.img.addEventListener('error', () => {
        if (protoDesc.get.call(job.img) !== url) return;                  // inzwischen ein anderes Bild
        stats.recovered++;
        CardRender.cacheDel('c:' + job.m.id);
        const alt = cache.get(job.m.id); if (alt === url) cache.delete(job.m.id);
        fromStore.delete(url);
        handle(job.img, job.orig);
      }, { once: true });
      await new Promise(r => setTimeout(r, 0));
    }
  }

  // Bilder weit ausserhalb des Bildschirms warten, bis man in ihre Naehe scrollt
  const io = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      io.unobserve(e.target);
      const job = e.target.__cardJob;
      if (!job || e.target.__cardTok !== job.tok) continue;
      const r = e.boundingClientRect;
      const visible = r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
      enqueue(job, job.low ? 4 : visible ? 0 : 2);
    }
  }, { rootMargin: '700px' }) : null;

  // `new Image()` (Animationen, Vorlader) kommt sofort an die Reihe; ein per createElement erzeugtes <img> wird
  // von React oft erst Millisekunden spaeter in die Seite gehaengt — dann entscheidet seine Lage am Bildschirm.
  const NativeImage = window.Image;
  window.Image = function Image(w, h) { const i = new NativeImage(w, h); i.__viaCtor = true; return i; };
  window.Image.prototype = NativeImage.prototype;
  // Bilder, die in der Seite stehen, aber (noch) nicht sichtbar sind — etwa weiter unten in einem Scrollbereich,
  // dessen Rand der IntersectionObserver nicht weitet —, werden in Leerlaufzeiten nachgezeichnet, damit sie beim
  // Scrollen schon fertig sind. Sichtbare kommen vorher dran (Stufe 0), diese zuletzt (Stufe 2).
  function vorrendern(job) {
    setTimeout(() => {
      const run = () => {
        const img = job.img;
        if (job.queued || img.__cardTok !== job.tok || !img.isConnected) return;
        io.unobserve(img);
        enqueue(job, job.low ? 4 : 2);
      };
      if (window.requestIdleCallback) requestIdleCallback(run, { timeout: 4000 }); else run();
    }, 1200);
  }
  function place(job, tries) {
    const img = job.img;
    if (img.__cardTok !== job.tok) return;
    job.low = img.hasAttribute('data-card-low');
    if (io && img.isConnected) { io.observe(img); vorrendern(job); return; }
    if (img.__viaCtor || tries > 90 || !io) { enqueue(job, job.low ? 4 : 1); return; }
    requestAnimationFrame(() => place(job, tries + 1));
  }
  function handle(img, value) {
    stats.handled++;
    const orig = String(value == null ? '' : value);
    const m = parse(orig);
    const tok = img.__cardTok = (img.__cardTok || 0) + 1;
    if (!m || failed) { img.__cardOrig = null; return setReal(img, orig); }
    img.__cardOrig = orig;
    queueMicrotask(() => note(img, m));        // erst danach: React setzt `data-card-low` nach `src`
    if (cache.has(m.id)) { const u = cache.get(m.id); cache.delete(m.id); cache.set(m.id, u); img.__cardBase = m.kind + ':' + m.stem; return setReal(img, u); }
    const job = img.__cardJob = { img, m, tok, orig };
    // ★ NUR EINE VARIANTE DERSELBEN KARTE (Stufe, Kosten, HP-Aufdruck — Fähigkeits-Level-Up, Handkarte wird billiger):
    // das alte Bild bleibt stehen, bis das neue fertig ist, statt kurz zu verschwinden (Als Befund 23.10.: „die Stufen-Box
    // hängt einen Moment"), und kommt SOFORT an die Reihe (Stufe 0) statt erst über IntersectionObserver und Leerlauf.
    const basis = m.kind + ':' + m.stem;
    const gleicheKarte = img.__cardBase === basis && img.isConnected && protoDesc.get.call(img).startsWith('blob:');
    img.__cardBase = basis;
    if (gleicheKarte) { job.low = false; setTimeout(() => { if (img.__cardTok === tok) enqueue(job, 0); }, 0); return; }
    // Eingebaute Bilder zeigen bis zum Rendern eine durchsichtige Fläche (kein Alt-Text-Flackern); `new Image()`
    // bleibt leer, damit onload erst mit der fertigen Karte feuert.
    if (!img.__viaCtor) setReal(img, PLACEHOLDER);
    setTimeout(() => place(job, 0), 0);
  }

  // Nur <img> ist betroffen: die Überschreibungen sitzen auf HTMLImageElement.prototype, andere Elemente
  // behalten ihre ursprünglichen Methoden (kein Mehraufwand für React bei den übrigen Attributen).
  const IMG = HTMLImageElement.prototype;
  Object.defineProperty(IMG, 'src', {
    configurable: true, enumerable: true,
    get() { return this.__cardOrig != null ? this.__cardOrig : protoDesc.get.call(this); },
    set(v) { handle(this, v); },
  });
  IMG.setAttribute = function (name, value) {
    if (String(name).toLowerCase() === 'src') { handle(this, value); return; }
    return nativeSetAttr.call(this, name, value);
  };
  IMG.getAttribute = function (name) {
    if (this.__cardOrig != null && String(name).toLowerCase() === 'src') return this.__cardOrig;
    return nativeGetAttr.call(this, name);
  };
  IMG.removeAttribute = function (name) {
    if (String(name).toLowerCase() === 'src') { this.__cardOrig = null; this.__cardTok = (this.__cardTok || 0) + 1; }
    return nativeRemoveAttr.call(this, name);
  };

  // Per `innerHTML` / `insertAdjacentHTML` erzeugte <img> setzen ihre Quelle im HTML-Parser und umgehen die
  // Überschreibungen oben. Sobald so ein Bild in die Seite kommt, übernehmen wir es nachträglich; die schon
  // angestoßene Anfrage wird durch die neue Quelle verworfen.
  function adopt(img) {
    if (img.__cardDropped) { img.__cardDropped = false; if (img.__cardOrig != null) handle(img, img.__cardOrig); return; }   // wieder in der Seite: Auftrag nachholen
    if (img.__cardOrig != null) return;
    const src = nativeGetAttr.call(img, 'src');
    if (!src || src.charCodeAt(0) === 98 /* b */ || src.charCodeAt(0) === 100 /* d */) return;    // blob: / data:
    if (parse(src)) handle(img, src);
  }
  if (typeof MutationObserver === 'function') {
    new MutationObserver(muts => {
      for (const mu of muts) {
        for (const n of mu.addedNodes) {
          if (n.nodeType !== 1) continue;
          if (n.nodeName === 'IMG') adopt(n);
          else if (n.firstElementChild) for (const i of n.getElementsByTagName('img')) adopt(i);
        }
      }
    }).observe(document, { childList: true, subtree: true });
  }

  // ★ STUFEN-VARIANTEN VORWÄRMEN (Als Befund 23.10.): Eine Fähigkeitskarte mit drei Textboxen (`skill3`) steht auf dem Brett als
  // `?stufe=N`; steigt ihre Stufe, wechselt die URL. War die neue Variante noch nie gezeichnet, blieb die Karte (bzw. der Tooltip)
  // einen Moment leer oder falsch. Darum werden, sobald eine solche Karte (mit oder ohne Stufe) gezeigt wird, die Stufen 1–3 im
  // Hintergrund bereitgelegt (Blob-URL im Speicher + dekodiert) — der Wechsel ist dann ein Cache-Treffer. Als Handkarte ohne Stufe zählt das
  // schon im Voraus: bis sie auf dem Brett liegt, sind alle drei Varianten fertig.
  function waermeStufen(m) {
    if (m.kind !== 'card' || m.ohne || m.lv != null || m.kost != null) return;
    const r = resolve(m);
    const c = r && r.card;
    if (!c || c.cardType !== 'Ability' || !/^\s*1\)/m.test(c.effect || '') || !/^\s*2\)/m.test(c.effect || '') || !/^\s*3\)/m.test(c.effect || '')) return;
    for (let st = 1; st <= 3; st++) {
      const id = 'card:' + m.stem + variantKey({ stufe: st });
      if (id === m.id || warming.has(id) || (cache.has(id) && (pinned.has(id) || keepPinned.has(id)))) continue;
      warming.add(id);
      enqueue({ warm: true, m: fromId(id) }, m.stufe != null ? 1 : 3);
    }
  }

  // ── Vorwaermen ──
  // Wer das Hauptmenue verlaesst, oeffnet fast immer einen Bildschirm voller Karten (Deck Editor, Puzzle-Creator ...). Frisch
  // gerendert wird dort dank des dauerhaften Caches nichts mehr — aber jede Karte kostet trotzdem Warteschlange, IndexedDB-Lesen,
  // Blob-URL und Dekodieren, und das spielt sich sichtbar NACH dem Aufbau des Bildschirms ab (Platzhalter -> Karte). Darum merkt
  // sich der Shim je Bildschirm (`window.__ppScreen`), welche Karten er zuerst gezeigt hat, und holt genau diese im Hauptmenue im
  // Leerlauf bereit: Blob-URL im Speicher (dann setzt `handle` sie beim Einhaengen sofort) und das Bild schon dekodiert.
  // Fehlt eine Karte im dauerhaften Cache (z. B. nach einem Update), wird sie hier im Hintergrund gezeichnet statt spaeter vor aller Augen.
  const WARM_KEY = 'pp-card-warm', WARM_PER_SCREEN = 30, WARM_SCREENS = 6, WARM_TOTAL = 60, PIN_MAX = 60;
  let warmLists = {};                // Bildschirm -> [Karten-ID], in der Reihenfolge des Erscheinens
  try { warmLists = JSON.parse(localStorage.getItem(WARM_KEY)) || {}; } catch (e) { warmLists = {}; }
  if (!warmLists || typeof warmLists !== 'object' || Array.isArray(warmLists)) warmLists = {};   // beschaedigt: von vorn anfangen
  const warming = new Set();         // IDs, die gerade in der Warteschlange stehen
  const pinned = new Map();          // ID -> Image: haelt die dekodierte Karte im Speicher des Browsers
  let rec = { screen: null, ids: [], seen: new Set() };
  let warmTimer = 0;
  function saveWarm() { try { localStorage.setItem(WARM_KEY, JSON.stringify(warmLists)); } catch (e) { /* privat/voll: dann eben ohne */ } }
  function flushRec() {
    if (!rec.screen || rec.screen === 'menu' || !rec.ids.length) return;
    delete warmLists[rec.screen];                       // Reihenfolge der Schluessel = Aktualitaet: der zuletzt besuchte Bildschirm steht hinten
    warmLists[rec.screen] = rec.ids.slice();
    for (const k of Object.keys(warmLists).slice(0, -WARM_SCREENS)) delete warmLists[k];
    saveWarm();
  }
  function note(img, m) {
    const sc = window.__ppScreen || '';
    if (sc !== rec.screen) { flushRec(); rec = { screen: sc, ids: [], seen: new Set() }; if (sc === 'menu') scheduleWarm(); }
    if (!sc || sc === 'menu' || rec.ids.length >= WARM_PER_SCREEN || rec.seen.has(m.id)) return;
    if (img.__viaCtor || img.hasAttribute('data-card-low')) return;           // Animationen und Dekoration zaehlen nicht
    rec.seen.add(m.id); rec.ids.push(m.id);
    if (rec.ids.length >= WARM_PER_SCREEN) flushRec();
  }
  addEventListener('pagehide', flushRec);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushRec(); });
  const keepPinned = new Map();      // Tutorial-Karten (warmCards): bleiben dekodiert im Speicher, unabhaengig vom Deckel PIN_MAX
  function pin(id, url, keep) {
    if (pinned.has(id) || keepPinned.has(id)) return;
    const im = new NativeImage();
    setReal(im, url);
    if (keep) { keepPinned.set(id, im); if (im.decode) im.decode().catch(() => {}); return; }
    pinned.set(id, im);
    if (pinned.size > PIN_MAX) pinned.delete(pinned.keys().next().value);
    if (im.decode) im.decode().catch(() => {});
  }
  function scheduleWarm() {
    if (warmTimer) return;
    warmTimer = setTimeout(() => {
      warmTimer = 0;
      if (window.requestIdleCallback) requestIdleCallback(warm, { timeout: 3000 }); else warm();
    }, 1200);
  }
  function warm() {
    if (failed) return;
    const ids = [];                                                            // zuletzt besuchte Bildschirme zuerst, bis WARM_TOTAL erreicht ist
    for (const l of Object.values(warmLists).reverse()) {
      if (!Array.isArray(l)) continue;
      for (const id of l) if (!ids.includes(id)) ids.push(id);
      if (ids.length >= WARM_TOTAL) break;
    }
    for (const id of ids.slice(0, WARM_TOTAL)) {
      if (typeof id !== 'string' || !/^(card|skin):./.test(id)) continue;
      if (warming.has(id) || (cache.has(id) && pinned.has(id))) continue;
      warming.add(id);
      enqueue({ warm: true, m: fromId(id) }, 3);
    }
  }
  boot().then(scheduleWarm);

  /** Karten fuer ein Tutorial im Voraus rendern und dekodiert halten. `names`: Kartennamen; `opts.board`: Namen, die auf dem Brett als
   *  Held/Kreatur (ohne gedruckte HP/ATK) bzw. Faehigkeit (Stufen 1-3) vorkommen. Laeuft im Hintergrund (Tier 3: nach allem Sichtbaren). */
  async function warmCards(names, opts) {
    await boot(); if (failed) return 0;
    opts = opts || {};
    const heroes = new Set(opts.heroes || []), abilities = new Set(opts.abilities || []);
    let n = 0;
    for (const name of names || []) {
      const stem = strippedKey(name); if (!stem) continue;
      const base = parse('/cards/' + encodeURIComponent(stem) + '.png'); if (!base) continue;
      const variants = [base.id], url = '/cards/' + encodeURIComponent(stem) + '.png';
      if (heroes.has(name)) variants.push(parse(url + '?ohne=atk,hp').id);                                   // Brett: ohne gedruckte HP/ATK
      if (abilities.has(name)) for (let st = 1; st <= 3; st++) variants.push(parse(url + '?stufe=' + st).id); // Faehigkeit: Stufe hervorgehoben
      for (const id of variants) {
        if (warming.has(id) || keepPinned.has(id)) continue;
        warming.add(id); n++;
        enqueue({ warm: true, keep: opts.keep !== false, m: fromId(id) }, 3);
      }
    }
    return n;
  }

  /** Wie warmCards, aber TROPFENWEISE: je Takt eine Karte, und nur, wenn nichts Sichtbares auf Rendern wartet und der Tab im Vordergrund ist —
   *  das Vorwaermen selbst darf nie ruckeln (auf schwachen Handys kostet jede Karte einige 10 ms Zeichnen + Dekodieren). `opts.keep` falsch:
   *  nur zeichnen und im dauerhaften Cache ablegen, nicht dauerhaft dekodiert im Speicher halten (fuer Gegner-Decks). Doppelte Namen werden verworfen. */
  const dripQueue = [], dripSeen = new Set(); let dripTimer = 0;
  function warmDrip(names, opts) {
    opts = opts || {};
    const heroes = new Set(opts.heroes || []), abilities = new Set(opts.abilities || []);
    const neu = [];
    for (const name of names || []) {
      const key = (opts.keep === false ? 'c:' : 'k:') + name;
      if (typeof name !== 'string' || dripSeen.has(key)) continue;
      dripSeen.add(key);
      neu.push({ name, keep: opts.keep !== false, heroes: heroes.has(name) ? [name] : [], abilities: abilities.has(name) ? [name] : [] });
    }
    if (opts.front) dripQueue.unshift(...neu); else dripQueue.push(...neu);   // `front`: vor die wartenden (z. B. Deck der naechsten Partie vor die Tutorial-Karten)
    dripPlane(opts.delay || 800);
  }
  function dripPlane(ms) { if (dripTimer || !dripQueue.length) return; dripTimer = setTimeout(dripSchritt, ms); }
  // Eingaben der letzten Sekunde: waehrenddessen wird nicht gezeichnet (Tippen, Wischen, Scrollen sollen nie auf eine Karte warten).
  let letzteEingabe = 0, dripBusy = 0;
  for (const ev of ['pointerdown', 'pointermove', 'touchstart', 'touchmove', 'keydown', 'wheel', 'scroll']) addEventListener(ev, () => { letzteEingabe = performance.now(); }, { passive: true, capture: true });
  function dripSchritt() {
    dripTimer = 0;
    if (!dripQueue.length) return;
    const frei = !document.hidden && queues.every(q => q.length === 0) && workers === 0 && performance.now() - letzteEingabe > 1000;
    if (!frei) { dripPlane(700); return; }
    // Nur in einer ECHTEN Leerlaufluecke anfangen (>= 25 ms am Stueck frei) — eine Karte kostet auf schwachen Handys einige 10 ms.
    const los = () => {
      if (!dripQueue.length) return;
      const it = dripQueue.shift();
      warmCards([it.name], { heroes: it.heroes, abilities: it.abilities, keep: it.keep }).finally(() => {
        const weiter = () => dripPlane(260);          // naechste Karte frueh genug, aber mit Mindestabstand
        if (window.requestIdleCallback) requestIdleCallback(weiter, { timeout: 1500 }); else weiter();
      });
    };
    // Auf einer animierten Seite gibt es nie 25 ms am Stueck — nach drei Fehlversuchen (je 400 ms Pause) faengt eine Karte trotzdem an.
    if (window.requestIdleCallback) requestIdleCallback((d) => { if (!d.didTimeout && d.timeRemaining() < 25 && dripBusy++ < 3) dripPlane(400); else { dripBusy = 0; los(); } }, { timeout: 2000 });
    else los();
  }

  // Für Hintergrund-Aufwärmer: Kunstindex und Rahmen schon vor den ersten Karten holen
  // Skin -> Basiskarte (fuer das Skin-Holo: es braucht den Kartentyp des Helden). Wartet auf boot().
  async function skinBase(skin) { await boot(); return (window.__cardShimSkinBase && window.__cardShimSkinBase[skin]) || null; }
  window.CardImageShim = { boot, skinBase, parse, warmCards, warmDrip, cacheSize: () => cache.size, stats, cacheStats: () => CardRender.cacheStats(), queued: () => queues.reduce((n, q) => n + q.length, 0) };
  boot();
})();
