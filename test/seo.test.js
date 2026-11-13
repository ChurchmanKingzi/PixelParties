'use strict';
// SEO-Seiten (seo.js): Katalog, Kartenseiten, Sitemap, noindex auf Nicht-Produktionshosts, Startseite mit echtem Text.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const seo = require('../seo');

const CARDS = [
  { name: '"Bloom", the Continent Corruptor', cardType: 'Ascended Hero', subtype: '', hp: 500, atk: 80, effect: 'Do <b>things</b> & "stuff".', archetype: 'Paraseed', setID: 'PP MBS1' },
  { name: 'Bloom the Continent Corruptor', cardType: 'Hero', subtype: '', hp: 400, atk: 30, effect: 'Second card with the same slug.', archetype: 'Paraseed', setID: 'PP X' },
  { name: 'Acid Vial', cardType: 'Potion', subtype: 'Normal', effect: 'Deal 150 damage.', setID: 'PP SET01' },
  { name: 'Unfinished Card', cardType: 'Spell', subtype: 'Normal', effect: 'No script yet.', setID: 'PP NEW' },
  { name: 'Some Token', cardType: 'Token', effect: 'x', setID: 'PP TOKEN' },
];
const opts = { hasEffect: (n) => n !== 'Unfinished Card', imageNames: new Set(CARDS.map(c => c.name)) };

test('Katalog: nur spielbare Karten, keine Tokens, eindeutige Slugs', () => {
  const cat = seo.buildCatalog(CARDS, opts);
  assert.strictEqual(cat.entries.length, 3);                               // ohne Skript-lose Karte und ohne Token
  const slugs = cat.entries.map(e => e.slug);
  assert.strictEqual(new Set(slugs).size, slugs.length);
  assert.ok(slugs.includes('acid-vial'));
  assert.ok(slugs.some(s => /^bloom-the-continent-corruptor(-2)?$/.test(s)));
  assert.ok(!slugs.some(s => /unfinished|token/.test(s)));
});

test('Kartenseite: Text maskiert, Titel/Beschreibung/Canonical vorhanden', () => {
  const cat = seo.buildCatalog(CARDS, opts);
  const e = cat.bySlug.get('acid-vial');
  const html = seo.cardPage(cat, e, 'https://pixelpartiestcg.com', 'https://pixelpartiestcg.com');
  assert.match(html, /<title>Acid Vial – Potion \| Pixel Parties TCG<\/title>/);
  assert.match(html, /rel="canonical" href="https:\/\/pixelpartiestcg\.com\/card\/acid-vial"/);
  assert.match(html, /Deal 150 damage\./);
  assert.match(html, /<h1>Acid Vial<\/h1>/);
  const bloom = cat.entries.find(x => x.card.cardType === 'Ascended Hero');
  const h2 = seo.cardPage(cat, bloom, 'https://x.test', 'https://x.test');
  assert.ok(!h2.includes('<b>things</b>'), 'Karteneffekt darf kein HTML einschleusen');
  assert.match(h2, /&lt;b&gt;things&lt;\/b&gt; &amp; &quot;stuff&quot;/);
  assert.match(h2, /is an Ascended Hero card/);
});

test('Kartenliste und Sitemap fuehren jede oeffentliche Karte', () => {
  const cat = seo.buildCatalog(CARDS, opts);
  const list = seo.cardListPage(cat, 'https://pixelpartiestcg.com', 'https://pixelpartiestcg.com');
  const xml = seo.sitemapXml(cat, 'https://pixelpartiestcg.com', '2026-01-01');
  for (const e of cat.entries) {
    assert.ok(list.includes(`href="/card/${e.slug}"`), 'Liste: ' + e.slug);
    assert.ok(xml.includes(`<loc>https://pixelpartiestcg.com/card/${e.slug}</loc>`), 'Sitemap: ' + e.slug);
  }
  assert.ok(xml.includes('<loc>https://pixelpartiestcg.com/</loc>'));
  assert.ok(xml.includes('<loc>https://pixelpartiestcg.com/cards</loc>'));
});

function fakeApp() {
  const routes = {};
  return { routes, get: (p, h) => { routes[p] = h; } };
}
function call(handler, req) {
  const res = { headers: {}, code: 200, body: null, redirectTo: null,
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, status(c) { this.code = c; return this; },
    send(b) { this.body = b; }, redirect(c, u) { this.code = c; this.redirectTo = u; } };
  handler({ headers: {}, params: {}, ...req }, res);
  return res;
}

test('Routen: noindex nur auf Nicht-Produktionshosts, 404 und Weiterleitung', () => {
  const app = fakeApp();
  let indexable = true;
  seo.registerSeoRoutes(app, {
    resolveOrigin: () => (indexable ? 'https://pixelpartiestcg.com' : 'https://neu.pixelpartiestcg.com'),
    isIndexable: () => indexable,
    canonicalOrigin: () => 'https://pixelpartiestcg.com',
    getCardArray: () => CARDS, hasCardEffect: opts.hasEffect, cardNamesWithImage: () => opts.imageNames,
    cardsJsonMtime: () => Date.UTC(2026, 0, 2),
  });
  let r = call(app.routes['/cards'], {});
  assert.strictEqual(r.code, 200);
  assert.ok(!r.headers['x-robots-tag']);

  r = call(app.routes['/card/:slug'], { params: { slug: 'Acid-Vial' } });
  assert.strictEqual(r.code, 301); assert.strictEqual(r.redirectTo, '/card/acid-vial');
  r = call(app.routes['/card/:slug'], { params: { slug: 'gibt-es-nicht' } });
  assert.strictEqual(r.code, 404); assert.match(r.body, /noindex/);

  r = call(app.routes['/robots.txt'], {});
  assert.match(r.body, /Sitemap: https:\/\/pixelpartiestcg\.com\/sitemap\.xml/);
  assert.match(r.body, /Allow: \//);
  r = call(app.routes['/sitemap.xml'], {});
  assert.match(r.body, /<lastmod>2026-01-02<\/lastmod>/);

  indexable = false;
  r = call(app.routes['/card/:slug'], { params: { slug: 'acid-vial' } });
  assert.strictEqual(r.headers['x-robots-tag'], 'noindex, nofollow');
  assert.match(r.body, /rel="canonical" href="https:\/\/pixelpartiestcg\.com\/card\/acid-vial"/);
});

test('Startseite liefert echten Text, Titel, Beschreibung und Kartenlisten-Link im HTML', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  const title = /<title>([^<]+)<\/title>/.exec(html)[1];
  assert.ok(title.length >= 30 && title.length <= 70, 'Titel-Laenge ' + title.length);
  assert.match(title, /trading card game/i);
  const desc = /<meta name="description" content="([^"]+)"/.exec(html)[1];
  assert.ok(desc.length >= 80 && desc.length <= 200, 'Beschreibung-Laenge ' + desc.length);
  assert.match(html, /<h1[^>]*>Pixel Parties<\/h1>/);
  assert.match(html, /id="seo-content"[\s\S]*href="\/cards"/);
  assert.match(html, /<link rel="canonical" href="https:\/\/pixelpartiestcg\.com\/">/);
});
