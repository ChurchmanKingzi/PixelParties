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

/** Hat die Karte Kunst (und lässt sich damit rendern)? */
function hasArt(name) { return !!(CR && CR.hasArt(name)); }

/** Nach einem Update (neue Karten/Kunst auf der Platte): alles neu einlesen, in frischem Kontext. */
async function reload() {
  initPromise = null; CR = null; cardsByName = null;
  return init();
}

module.exports = { init, reload, renderCardPng, renderCardsRow, allCards, hasArt };
