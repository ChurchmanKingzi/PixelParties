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
    path = path.split(/[?#]/)[0];
    if (!path.startsWith('/cards/') || path.startsWith('/cards/effects/')) return null;
    let rel;
    try { rel = decodeURIComponent(path.slice(7)); } catch (e) { return null; }
    if (!/\.(png|webp|jpe?g)$/i.test(rel)) return null;
    const stem = rel.replace(/\.[a-z]+$/i, '');
    if (stem.startsWith('skins/')) {
      const file = stem.replace(/^skins\/(?:unlockable\/)?/, '');
      return { kind: 'skin', stem: file, id: 'skin:' + file };
    }
    if (stem.includes('/')) return null;
    return { kind: 'card', stem, id: 'card:' + stem };
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
      const cv = await CardRender.renderCard(r.card, r.skin ? { skin: r.skin } : null);
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
  // Vier Stufen: sichtbare Bilder zuerst, dann `new Image()` (Animationen warten auf onload), dann solche, die nur in der
  // Naehe des Bildschirms liegen, ganz zuletzt reine DEKORATION (`data-card-low`, z. B. die Kartenwand des Hauptmenues): sie
  // darf nie die Karten aufhalten, die jemand gerade ansehen will. Drei Arbeiter ueberlappen Zeichnen (Hauptthread) und
  // PNG-Kodierung (im Hintergrund); zwischen zwei Karten bekommt die Oberflaeche Luft.
  const stats = { handled: 0, enqueued: 0, applied: 0, stale: 0, fallback: 0, renderMs: 0, renders: 0, persisted: 0, recovered: 0, dropped: 0 };
  const fromStore = new Set();       // blob:-URLs, die aus dem dauerhaften Cache stammen (zum Erkennen kaputter Eintraege)
  const queues = [[], [], [], []];     // 0 sichtbar, 1 `new Image()`, 2 in der Naehe/Leerlauf, 3 Dekoration (`data-card-low`)
  let workers = 0;
  const WORKERS = 3;
  function enqueue(job, tier) { if (job.queued) return; job.queued = true; stats.enqueued++; queues[tier].push(job); while (workers < WORKERS) { workers++; work().finally(() => { workers--; }); } }
  function nextJob() { for (const q of queues) if (q.length) return q.shift(); return null; }
  async function work() {
    await boot();
    for (let job; (job = nextJob());) {
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
      enqueue(job, job.low ? 3 : visible ? 0 : 2);
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
        enqueue(job, job.low ? 3 : 2);
      };
      if (window.requestIdleCallback) requestIdleCallback(run, { timeout: 4000 }); else run();
    }, 1200);
  }
  function place(job, tries) {
    const img = job.img;
    if (img.__cardTok !== job.tok) return;
    job.low = img.hasAttribute('data-card-low');
    if (io && img.isConnected) { io.observe(img); vorrendern(job); return; }
    if (img.__viaCtor || tries > 90 || !io) { enqueue(job, job.low ? 3 : 1); return; }
    requestAnimationFrame(() => place(job, tries + 1));
  }
  function handle(img, value) {
    stats.handled++;
    const orig = String(value == null ? '' : value);
    const m = parse(orig);
    const tok = img.__cardTok = (img.__cardTok || 0) + 1;
    if (!m || failed) { img.__cardOrig = null; return setReal(img, orig); }
    img.__cardOrig = orig;
    if (cache.has(m.id)) { const u = cache.get(m.id); cache.delete(m.id); cache.set(m.id, u); return setReal(img, u); }
    const job = img.__cardJob = { img, m, tok, orig };
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

  // Für Hintergrund-Aufwärmer: Kunstindex und Rahmen schon vor den ersten Karten holen
  // Skin -> Basiskarte (fuer das Skin-Holo: es braucht den Kartentyp des Helden). Wartet auf boot().
  async function skinBase(skin) { await boot(); return (window.__cardShimSkinBase && window.__cardShimSkinBase[skin]) || null; }
  window.CardImageShim = { boot, skinBase, parse, cacheSize: () => cache.size, stats, cacheStats: () => CardRender.cacheStats(), queued: () => queues.reduce((n, q) => n + q.length, 0) };
  boot();
})();
