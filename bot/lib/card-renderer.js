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

const ROOT = path.resolve(__dirname, '..', '..');
const CARDGEN = path.join(ROOT, 'public', 'cardgen') + path.sep;
const RENDER_JS = path.join(ROOT, 'public', 'card-render.js');
const META_JSON = path.join(ROOT, 'data', 'card-render.json');
const CARDS_JSON = path.join(ROOT, 'data', 'cards.json');

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

let CR = null;
let initPromise = null;
let cardsByName = null;

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
  })();
  return initPromise;
}

/** Karte (Objekt aus cards.json oder Name) → PNG-Buffer 750×1050, oder null, wenn die Kunst fehlt. */
async function renderCardPng(cardOrName, opts) {
  await init();
  const card = typeof cardOrName === 'string' ? cardsByName.get(cardOrName) : cardOrName;
  if (!card) return null;
  const cv = await CR.renderCard(card, opts);
  return cv ? cv.encode('png') : null;
}

/** Mehrere Karten nebeneinander (z. B. die drei Helden der Daily Challenge) als EIN PNG. */
async function renderCardsRow(names, { gap = 24, scale = 1 } = {}) {
  await init();
  const cvs = [];
  for (const n of names) {
    const card = typeof n === 'string' ? cardsByName.get(n) : n;
    const cv = card ? await CR.renderCard(card, {}) : null;
    if (cv) cvs.push(cv);
  }
  if (!cvs.length) return null;
  const w = Math.round(CR.W * scale), h = Math.round(CR.H * scale);
  const out = createCanvas(cvs.length * w + (cvs.length - 1) * gap, h);
  const g = out.getContext('2d');
  g.imageSmoothingEnabled = false;
  cvs.forEach((cv, i) => g.drawImage(cv, i * (w + gap), 0, w, h));
  return out.encode('png');
}

function allCards() { return cardsByName ? [...cardsByName.values()] : []; }

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
 * von `tries` Kandidaten gewinnt der mit dem meisten Kontrast. Größe = `fraction` der kürzeren Bildseite (Pixel-Art 76×51 → Start 8×8).
 * @returns {Promise<{x:number,y:number,w:number,h:number}|null>} Koordinaten im Kunstbild
 */
async function pickArtCrop(name, { rng = Math.random, fraction = 0.16, tries = 24 } = {}) {
  const art = await artOf(name);
  if (!art) return null;
  const size = Math.max(8, Math.round(Math.min(art.sw, art.sh) * fraction));
  let best = null;
  for (let i = 0; i < tries; i++) {
    const rect = { x: Math.floor(rng() * (art.sw - size + 1)), y: Math.floor(rng() * (art.sh - size + 1)), w: size, h: size };
    const score = cropScore(art, rect);
    if (!best || score > best.score) best = { rect, score };
  }
  return best.rect;
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
  return cv.encode('png');
}

/** Hat die Karte Kunst (und lässt sich damit rendern)? */
function hasArt(name) { return !!(CR && CR.hasArt(name)); }

/** Nach einem Update (neue Karten/Kunst auf der Platte): alles neu einlesen, in frischem Kontext. */
async function reload() {
  initPromise = null; CR = null; cardsByName = null;
  return init();
}

module.exports = { init, reload, renderCardPng, renderCardsRow, allCards, hasArt, pickArtCrop, renderArtCrop, artSize };
