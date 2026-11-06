'use strict';
// ═══════════════════════════════════════════════════════════════════
//  Karten-Renderer für den Bot
//
//  Das Spiel setzt jede Karte im Browser zusammen (public/card-render.js, reiner Canvas-Code).
//  Der Bot führt GENAU DIESE Datei in Node aus — mit @napi-rs/canvas statt dem Browser-Canvas —,
//  damit Discord-Karten pixelgleich mit denen im Spiel sind und es keine zweite Bildersammlung
//  zu pflegen gibt. card-render.js selbst bleibt unverändert.
// ═══════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createCanvas, loadImage, Path2D } = require('@napi-rs/canvas');
const { cropSize, cropRect } = require('./mystery');

const ROOT = path.resolve(__dirname, '..', '..');
const CARDGEN = path.join(ROOT, 'public', 'cardgen') + path.sep;
const RENDER_JS = path.join(ROOT, 'public', 'card-render.js');
const META_JSON = path.join(ROOT, 'data', 'card-render.json');
const SPRITES_JSON = path.join(CARDGEN, 'sprites.json');
const SPRITES_PNG = path.join(CARDGEN, 'sprites.png');
const CARDS_JSON = path.join(ROOT, 'data', 'cards.json');
let CARDS_DIR = path.join(ROOT, 'cards');             // fertige Kartenbilder für Karten ohne Atlas-Kunst (wie im Spiel)
const cardImages = require(path.join(ROOT, 'card-images.js'));   // dieselbe Zuordnung Karte → Bilddatei wie im Spiel

/** Dateizugriff statt Netzwerk: `fetch('/cardgen/art.json')` liest direkt von der Platte. */
function localFetch(url) {
  const rel = String(url).replace(/^\/+/, '');
  const file = path.join(ROOT, rel.startsWith('data/') ? rel : path.join('public', rel));
  return fs.promises.readFile(file).then(buf => ({ ok: true, json: async () => JSON.parse(buf.toString('utf8')) }));
}

/** `new Image()` mit src/onload wie im Browser, gespeist aus loadImage (Datei oder Puffer). */
class NodeImage {
  set src(v) {
    this._src = v;
    const file = String(v).startsWith(CARDGEN) ? v : path.join(ROOT, 'public', String(v).replace(/^\/+/, ''));
    loadImage(file).then(img => {
      this._img = img; this.width = img.width; this.height = img.height; this.naturalWidth = img.width; this.naturalHeight = img.height;
      this.onload && this.onload();
    }, err => this.onerror && this.onerror(err));
  }
  get src() { return this._src; }
}

/**
 * PNG synchron kodieren (Hauptthread). `canvas.encode()` läuft im Hintergrund-Thread der Bibliothek; unter Last stürzte der Prozess dort
 * gelegentlich mit SIGSEGV ab (in Tests unter paralleler Last reproduziert). Eine Karte kostet so ~50 ms im Hauptthread — für den Bot
 * unerheblich, ein Absturz dagegen nicht.
 */
const toPng = cv => cv.toBuffer('image/png');

let CR = null;
let initPromise = null;
let cardsByName = null;
let staticImages = new Map();
let metaCards = {};                 // card-render.json → cards (Rahmenart je Karte)
let maskGrids = new Map();          // Maskenname → { w, h, opaque }
let visibilityCache = new Map();    // Kartenname → Sichtbarkeits-Prüfer       // Kartenname → Pfad der fertigen Bilddatei (nur Karten, die es wirklich als Datei gibt)

function buildContext() {
  const sandbox = {
    document: { createElement: tag => { if (tag !== 'canvas') throw new Error('nur canvas: ' + tag); return createCanvas(1, 1); } },
    Image: class extends NodeImage {},
    Path2D,
    fetch: localFetch,
    console,
    Promise, Map, Set, Math, JSON, Object, Array, Number, String, Error, Uint8ClampedArray, Uint8Array, Float32Array, Float64Array,
  };
  // loadImage() akzeptiert unsere NodeImage-Instanzen nicht direkt → drawImage bekommt das echte Bild.
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(RENDER_JS, 'utf8'), ctx, { filename: 'card-render.js' });
  return sandbox;
}

/** drawImage(NodeImage …) → echtes Bild: wir verpacken createCanvas, damit der Browser-Code unverändert läuft. */
function patchCanvasFactory() {
  const proto = Object.getPrototypeOf(createCanvas(1, 1).getContext('2d'));
  if (proto.__ppPatched) return;
  const orig = proto.drawImage;
  proto.drawImage = function (img, ...rest) { return orig.call(this, img && img._img ? img._img : img, ...rest); };
  proto.__ppPatched = true;
}

async function init() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    patchCanvasFactory();
    const sb = buildContext();
    CR = sb.CardRender;
    await CR.init({ base: '/cardgen/' });
    await CR.loadMeta('/data/card-render.json');
    await CR.loadArtIndex();
    const cards = JSON.parse(fs.readFileSync(CARDS_JSON, 'utf8'));
    cardsByName = new Map(cards.map(c => [c.name, c]));
    staticImages = findStaticImages(cards);
    try { metaCards = JSON.parse(fs.readFileSync(META_JSON, 'utf8')).cards || {}; } catch { metaCards = {}; }
    maskGrids = await loadMaskGrids();
    visibilityCache = new Map();
  })();
  return initPromise;
}

/**
 * Karten, für die es KEINE Atlas-Kunst, aber eine fertige Bilddatei in ./cards gibt (ältere Karten). Das Spiel zeigt sie genauso:
 * card-image-shim.js fällt auf die Datei zurück, wo der Renderer keine Kunst hat. Die Zuordnung Name → Datei kommt aus card-images.js.
 */
function findStaticImages(cards) {
  const map = new Map();
  let available = {};
  try { available = cardImages.availableImageMap(cards, CARDS_DIR); } catch { return map; }
  for (const [name, file] of Object.entries(available)) {
    if (CR && CR.hasArt(name)) continue;                      // Atlas-Kunst hat Vorrang
    const full = path.join(CARDS_DIR, file);
    if (fs.existsSync(full)) map.set(name, full);
  }
  return map;
}

/** Fertiges Bild als Canvas (so groß wie die Datei; Karten sind 750×1050). */
async function staticCardCanvas(file) {
  const img = await loadImage(file);
  const cv = createCanvas(img.width, img.height);
  cv.getContext('2d').drawImage(img, 0, 0);
  return cv;
}

/** Die Karte als Canvas: zusammengesetzt aus der Atlas-Kunst, sonst die fertige Bilddatei, sonst null. */
async function cardCanvas(cardOrName, opts) {
  await init();
  const card = typeof cardOrName === 'string' ? cardsByName.get(cardOrName) : cardOrName;
  if (!card) return null;
  const cv = await CR.renderCard(card, opts);
  if (cv) return cv;
  const file = staticImages.get(card.name);
  if (!file) return null;
  try { return await staticCardCanvas(file); } catch (err) { console.error('[cards] Bilddatei unlesbar:', file, err.message); return null; }
}

/** Karte (Objekt aus cards.json oder Name) → PNG-Buffer (750×1050), oder null, wenn es weder Kunst noch Bilddatei gibt. */
async function renderCardPng(cardOrName, opts) {
  const cv = await cardCanvas(cardOrName, opts);
  return cv ? toPng(cv) : null;
}

/** Mehrere Karten nebeneinander (z. B. die drei Helden der Daily Challenge) als EIN PNG. */
async function renderCardsRow(names, { gap = 24, scale = 1 } = {}) {
  await init();
  const cvs = [];
  for (const n of names) {
    const cv = await cardCanvas(n, {});
    if (cv) cvs.push(cv);
  }
  if (!cvs.length) return null;
  const w = Math.round(CR.W * scale), h = Math.round(CR.H * scale);
  const out = createCanvas(cvs.length * w + (cvs.length - 1) * gap, h);
  const g = out.getContext('2d');
  g.imageSmoothingEnabled = false;
  cvs.forEach((cv, i) => g.drawImage(cv, i * (w + gap), 0, w, h));
  return toPng(out);
}

function allCards() { return cardsByName ? [...cardsByName.values()] : []; }

// ── Was von der Kunst ist auf der fertigen Karte SICHTBAR? ──
// Die Kunst liegt unter der Rahmenmaske des Spiels (`mask.art` für normale Karten, `mask.fullart` / `mask.hero` für Vollbild-Karten, 
// siehe card-render.js `draw`). Auf Vollbild-Karten liegen Namenszeile, Fähigkeiten-, Text- und Wertefelder ÜBER dem Bild: dort ist die
// Maske nicht voll deckend (Umrisslinie 0, Füllung ~20 %). Nur Stellen mit voller Deckkraft (>= 230, wie `artMask` im Spiel) zählen als
// sichtbar. Dazu kommen die Symbole, die bei Zaubern und Kreaturen über die Bildecken ragen (Schule links, Stufe rechts).
const OPAQUE_MIN = 230;
const ART_BOX = [70, 170, 610, 400], FULL_BOX = [0, 0, 750, 1050];
const SPELL_OVERLAYS = [[0, 550, 110, 110], [650, 550, 110, 110]];   // Schule-Symbol, Stufe (card-render.js, Schritt 5)

async function loadMaskGrids() {
  const rects = JSON.parse(fs.readFileSync(SPRITES_JSON, 'utf8')).rects;
  const img = await loadImage(SPRITES_PNG);
  const grids = new Map();
  for (const key of ['mask.art', 'mask.fullart', 'mask.hero']) {
    const r = rects[key];
    if (!r) continue;
    const cv = createCanvas(r[2], r[3]), g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(img, r[0], r[1], r[2], r[3], 0, 0, r[2], r[3]);
    const d = g.getImageData(0, 0, r[2], r[3]).data;
    const opaque = new Uint8Array(r[2] * r[3]);
    for (let i = 0; i < opaque.length; i++) opaque[i] = d[i * 4 + 3] >= OPAQUE_MIN ? 1 : 0;
    grids.set(key, { w: r[2], h: r[3], opaque });
  }
  return grids;
}

/** Rahmenart der Karte (wie card-render.js specFromCard) — bestimmt Bildfeld und Maske. */
function frameTypeOf(card) {
  const spec = CR.specFromCard(card, metaCards[card.name]);
  return spec.type;
}

/**
 * Prüfer für eine Karte: `visible(rect)` sagt, ob ein Rechteck der Kunst (Bildpunkte der Kunst) auf der fertigen Karte
 * vollständig zu sehen ist; `art` = Größe der Kunst. null, wenn es keine Kunst gibt.
 */
async function visibilityOf(name) {
  if (visibilityCache.has(name)) return visibilityCache.get(name);
  const art = await artOf(name);
  const card = cardsByName.get(name);
  let checker = null;
  if (art && card) {
    const type = frameTypeOf(card);
    const full = type === 'superhero' || type === 'fullartHero';
    const box = full ? FULL_BOX : ART_BOX;
    const grid = maskGrids.get(type === 'superhero' ? 'mask.hero' : type === 'fullartHero' ? 'mask.fullart' : 'mask.art');
    const overlays = (type === 'spell' || type === 'summon') ? SPELL_OVERLAYS : [];
    const aw = art.sw, ah = art.sh;
    checker = {
      art: { w: aw, h: ah }, type, full,
      visible(rect) {
        if (rect.x < 0 || rect.y < 0 || rect.x + rect.w > aw || rect.y + rect.h > ah) return false;
        // Kunst-Rechteck → Kartenpixel
        const x0 = box[0] + rect.x / aw * box[2], x1 = box[0] + (rect.x + rect.w) / aw * box[2];
        const y0 = box[1] + rect.y / ah * box[3], y1 = box[1] + (rect.y + rect.h) / ah * box[3];
        for (const o of overlays) if (x0 < o[0] + o[2] && x1 > o[0] && y0 < o[1] + o[3] && y1 > o[1]) return false;
        if (!grid) return true;
        // … → Zellen der Maske (die Maske ist auf das Bildfeld gestreckt)
        const cx0 = Math.floor((x0 - box[0]) / box[2] * grid.w), cx1 = Math.ceil((x1 - box[0]) / box[2] * grid.w) - 1;
        const cy0 = Math.floor((y0 - box[1]) / box[3] * grid.h), cy1 = Math.ceil((y1 - box[1]) / box[3] * grid.h) - 1;
        for (let cy = Math.max(0, cy0); cy <= Math.min(grid.h - 1, cy1); cy++)
          for (let cx = Math.max(0, cx0); cx <= Math.min(grid.w - 1, cx1); cx++) if (!grid.opaque[cy * grid.w + cx]) return false;
        return true;
      },
    };
  }
  visibilityCache.set(name, checker);
  return checker;
}

/** Größtes Quadrat um `center` (bis `cap`), das noch vollständig sichtbar ist; 0, wenn schon das kleinste nicht passt. */
function maxVisibleSize(vis, center, cap, minSize) {
  let best = 0;
  for (let s = minSize; s <= cap; s++) {
    if (vis.visible(cropRect(vis.art.w, vis.art.h, center, s))) best = s; else break;
  }
  return best;
}

/**
 * Das Rechteck für einen Ausschnitt der Kantenlänge `size` um `center` — aber NIE mit verdeckten Stellen: ragt es in ein Textfeld
 * (Vollbild-Karten) oder unter ein Symbol, wird es verkleinert, so weit nötig (der Ausschnitt wächst dann dort nicht weiter).
 * Liegt schon der kleinste Ausschnitt unter einem Feld, wird der nächstgelegene sichtbare Platz genommen. null, wenn es keinen gibt.
 */
async function visibleCropRect(name, center, size, minSize = 6) {
  const vis = await visibilityOf(name);
  if (!vis) return null;
  for (let s = size; s >= minSize; s--) {
    const rect = cropRect(vis.art.w, vis.art.h, center, s);
    if (vis.visible(rect)) return rect;
  }
  // Mittelpunkt liegt im verdeckten Bereich → nächstgelegene sichtbare Stelle für den kleinsten Ausschnitt
  let best = null;
  for (let y = 0; y + minSize <= vis.art.h; y++) for (let x = 0; x + minSize <= vis.art.w; x++) {
    const rect = { x, y, w: minSize, h: minSize };
    if (!vis.visible(rect)) continue;
    const d = Math.hypot(x + minSize / 2 - center.x, y + minSize / 2 - center.y);
    if (!best || d < best.d) best = { d, rect };
  }
  return best ? best.rect : null;
}

// ── Bildausschnitte (Mystery-Spiel) ──
/** Kunst der Karte: Quelle + Ausschnitt im Atlas bzw. ganzes Bild. null, wenn es keine gibt. */
async function artOf(name) {
  await init();
  const a = await CR.getArt(name);
  if (!a) return null;
  return a.sw ? a : { ...a, sx: 0, sy: 0, sw: a.src.width, sh: a.src.height };
}

/** Wie viel Kontrast steckt in einem Ausschnitt? (Farbvielfalt + Helligkeitsstreuung; durchsichtige Ränder zählen gegen ihn) */
function cropScore(art, rect) {
  const n = Math.min(rect.w, 24);
  const cv = createCanvas(n, n), g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(art.src, art.sx + rect.x, art.sy + rect.y, rect.w, rect.h, 0, 0, n, n);
  const d = g.getImageData(0, 0, n, n).data;
  const colors = new Set();
  let sum = 0, sum2 = 0, opaque = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 200) continue;
    opaque++;
    const l = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
    sum += l; sum2 += l * l;
    colors.add((d[i] >> 4) << 8 | (d[i + 1] >> 4) << 4 | (d[i + 2] >> 4));
  }
  if (opaque < n * n * 0.9) return 0;
  const mean = sum / opaque;
  return Math.sqrt(Math.max(0, sum2 / opaque - mean * mean)) + colors.size * 1.5;
}

/**
 * Ein zufälliger, aber abwechslungsreicher quadratischer Ausschnitt der Kartenkunst (nie nur Himmel oder Einheitsfläche):
 * von `tries` Kandidaten gewinnt der mit dem meisten Kontrast. Start = `cropSize(…, 0)` (Pixel-Art 76×51 → 8×8). Bei Vollbild-Karten
 * nur Stellen, die nicht unter Textfeldern liegen und genug Platz zum Wachsen haben.
 * @returns {Promise<{x:number,y:number,w:number,h:number}|null>} Koordinaten im Kunstbild
 */
async function pickArtCrop(name, { rng = Math.random, tries = 24, growthWanted = 12 } = {}) {
  const vis = await visibilityOf(name);
  if (!vis) return null;
  const art = await artOf(name);
  const size = cropSize(vis.art.w, vis.art.h, 0);
  const cap = cropSize(vis.art.w, vis.art.h, 60);
  const want = cropSize(vis.art.w, vis.art.h, growthWanted);        // so weit soll der Ausschnitt wachsen können, bevor er an ein Feld stößt

  // Kandidaten: nur Stellen, die auf der fertigen Karte vollständig sichtbar sind (nicht unter Textfeldern/Symbolen/Maskenrändern)
  const cands = [];
  const consider = rect => {
    if (!vis.visible(rect)) return;
    const center = { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
    cands.push({ rect, score: cropScore(art, rect), room: maxVisibleSize(vis, center, cap, size) });
  };
  for (let i = 0; i < tries * 8 && cands.length < tries; i++) {
    consider({ x: Math.floor(rng() * (vis.art.w - size + 1)), y: Math.floor(rng() * (vis.art.h - size + 1)), w: size, h: size });
  }
  if (!cands.length) {   // Zufall fand nichts (kleines Sichtfeld): systematisch suchen
    for (let y = 0; y + size <= vis.art.h && cands.length < tries; y += 2) for (let x = 0; x + size <= vis.art.w && cands.length < tries; x += 2) consider({ x, y, w: size, h: size });
  }
  if (!cands.length) return null;
  const roomy = cands.filter(c => c.room >= want);
  const pool = roomy.length ? roomy : cands.filter(c => c.room === Math.max(...cands.map(k => k.room)));
  return pool.reduce((best, c) => (c.score > best.score ? c : best)).rect;
}

/** Breite und Höhe der Kunst in Bildpunkten (null, wenn es keine gibt). */
async function artSize(name) {
  const a = await artOf(name);
  return a ? { w: a.sw, h: a.sh } : null;
}

/** Den Ausschnitt als PNG (`px`×`px`); Pixel-Art wird ohne Glättung vergrößert. */
async function renderArtCrop(name, rect, px = 384) {
  const art = await artOf(name);
  if (!art) return null;
  const cv = createCanvas(px, px), g = cv.getContext('2d');
  g.imageSmoothingEnabled = rect.w >= 120;
  g.drawImage(art.src, art.sx + rect.x, art.sy + rect.y, rect.w, rect.h, 0, 0, px, px);
  return toPng(cv);
}

/** Hat die Karte Atlas-Kunst? (Nur dann gibt es einen Kunst-Ausschnitt — Mystery.) */
function hasArt(name) { return !!(CR && CR.hasArt(name)); }

/** Lässt sich die Karte als Bild zeigen — aus Atlas-Kunst ODER aus einer fertigen Bilddatei? */
function canRender(name) { return hasArt(name) || staticImages.has(name); }

/** Zählt, woher die Kartenbilder kommen — fürs Protokoll beim Start (Hinweis, falls Karten gar kein Bild haben). */
function imageStats() {
  const all = allCards();
  const atlas = all.filter(c => hasArt(c.name)).length, files = all.filter(c => !hasArt(c.name) && staticImages.has(c.name)).length;
  return { total: all.length, atlas, files, none: all.length - atlas - files };
}

/** Nur für Tests: anderer Ordner für die fertigen Kartenbilder; danach reload() aufrufen. */
function setCardsDir(dir) { CARDS_DIR = dir; }

/** Nach einem Update (neue Karten/Kunst auf der Platte): alles neu einlesen, in frischem Kontext. */
async function reload() {
  initPromise = null; CR = null; cardsByName = null;
  return init();
}

module.exports = { _test: { cardCanvas: (c, o) => cardCanvas(c, o), artOf: n => artOf(n) }, visibilityOf, visibleCropRect, init, reload, renderCardPng, renderCardsRow, allCards, hasArt, canRender, imageStats, setCardsDir, pickArtCrop, renderArtCrop, artSize };
