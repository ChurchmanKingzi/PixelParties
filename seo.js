'use strict';
// ═══════════════════════════════════════════════════════════════
//  PIXEL PARTIES — SUCHMASCHINEN-SEITEN (SEO)
//
//  Problem: Das Spiel ist eine Ein-Seiten-App. Unter „/" liegt nur ein Ladebildschirm, dahinter baut React die Oberfläche
//  auf. Für Google gab es damit genau EINE URL ohne Text — nichts, wofür man „Pixel Parties card game", „Pixel Parties
//  <Kartenname>" o. ä. finden könnte.
//
//  Lösung: öffentliche, serverseitig gerenderte (also ohne JavaScript lesbare) Seiten, alle mit einem „Jetzt spielen"-Knopf
//  zurück in die App:
//    • GET /cards          Kartenliste: jede Karte nach Typ, mit Link auf ihre Seite
//    • GET /card/<slug>    Seite je Karte: Name, Typ, Werte, Effekttext, verwandte Karten
//    • GET /robots.txt     Regeln für Crawler (verweist auf die Sitemap)
//    • GET /sitemap.xml    Startseite + Kartenliste + alle Kartenseiten
//
//  Welche Karten erscheinen? Nur, was Spieler wirklich benutzen können: Karte hat ein Effekt-Skript UND ein Bild/Kunst, und es
//  ist kein Token. So tauchen unfertige oder noch nicht freigegebene Karten nie in der Suchmaschine auf.
//
//  Farben: alle aus data/palette.json (siehe CLAUDE.md). Keine Weichzeichner, keine Rundungen, keine Emojis.
//  Wichtig für Spielregeln: neue öffentliche Seiten gehören in die Sitemap (siteUrls) und bekommen einen Titel + eine Beschreibung.
// ═══════════════════════════════════════════════════════════════

const SITE_NAME = 'Pixel Parties TCG';
const DISCORD_URL = 'https://discord.gg/K8PFRjr';

// Reihenfolge und Mehrzahl der Kartentypen auf der Kartenliste.
const TYPE_ORDER = ['Hero', 'Ascended Hero', 'Ability', 'Spell', 'Attack', 'Creature', 'Artifact', 'Potion'];
const TYPE_PLURAL = {
  'Hero': 'Heroes', 'Ascended Hero': 'Ascended Heroes', 'Ability': 'Abilities', 'Spell': 'Spells',
  'Attack': 'Attacks', 'Creature': 'Creatures', 'Artifact': 'Artifacts', 'Potion': 'Potions',
};
const typePlural = (t) => TYPE_PLURAL[t] || (t + 's');

const article = (w) => (/^[aeiou]/i.test(String(w || '')) ? 'an' : 'a');

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** `"Bloom", the Continent Corruptor` → `bloom-the-continent-corruptor` */
function slugify(name) {
  return String(name || '')
    .toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'card';
}

/** Text auf Wortgrenze kürzen (für Meta-Beschreibungen). */
function clip(text, max) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const sp = cut.lastIndexOf(' ');
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,;:.\-–]+$/, '') + '…';
}

// ── Katalog: welche Karten sind öffentlich, wie heißen ihre Seiten? ─────────────────────────────────
function buildCatalog(cards, { hasEffect, imageNames } = {}) {
  const list = (cards || []).filter(c => c && c.name
    && !/token/i.test(String(c.cardType || ''))
    && (!hasEffect || hasEffect(c.name))
    && (!imageNames || imageNames.has(c.name)));
  list.sort((a, b) => a.name.localeCompare(b.name, 'en'));   // feste Reihenfolge → feste Kurznamen (Slugs)
  const bySlug = new Map();
  const slugOf = new Map();
  const entries = [];
  for (const card of list) {
    const base = slugify(card.name);
    let slug = base;
    for (let n = 2; bySlug.has(slug); n++) slug = base + '-' + n;
    const e = { card, slug };
    bySlug.set(slug, e); slugOf.set(card.name, slug); entries.push(e);
  }
  const byType = new Map();
  const byArchetype = new Map();
  entries.forEach((e, i) => {
    e.index = i;
    const t = e.card.cardType || 'Other';
    if (!byType.has(t)) byType.set(t, []);
    byType.get(t).push(e);
    const a = String(e.card.archetype || '').trim();
    if (a) { if (!byArchetype.has(a)) byArchetype.set(a, []); byArchetype.get(a).push(e); }
  });
  return { entries, bySlug, slugOf, byType, byArchetype };
}

// ── Aussehen ─────────────────────────────────────────────────────────────────────────────────────
// Palettenfarben: #08060c Grund, #2d4362/#405f8c Flächen, #7e41ba Rahmen, #1aedff Akzent, #e6e6e6 Text, #a8a8a8 gedämpft.
const CSS = `
@font-face{font-family:'Pixel Intv';src:url('/data/Pixel%20Intv.otf') format('opentype');font-display:swap}
*{box-sizing:border-box}
html{background:#08060c;color:#e6e6e6}
body{margin:0;font:18px/1.55 'Pixel Intv',monospace;background:#08060c;color:#e6e6e6;-webkit-font-smoothing:none}
a{color:#1aedff}
a:hover,a:focus{color:#ffffff}
.wrap{max-width:960px;margin:0 auto;padding:0 16px 48px}
.top{background:#2d4362;border-bottom:4px solid #7e41ba}
.top .wrap{display:flex;flex-wrap:wrap;align-items:center;gap:12px 24px;padding-top:12px;padding-bottom:12px}
.brand{color:#1aedff;font-size:22px;letter-spacing:3px;text-decoration:none;text-transform:uppercase;margin-right:auto}
.top a.nav{color:#e6e6e6;text-decoration:none}
.top a.nav:hover{color:#1aedff}
.btn{display:inline-block;background:#1aedff;color:#08060c;text-decoration:none;padding:8px 18px;border:4px solid #08060c;box-shadow:0 0 0 4px #1aedff;text-transform:uppercase;letter-spacing:2px;margin:6px 4px}
.btn:hover,.btn:focus{background:#ffffff;color:#08060c;box-shadow:0 0 0 4px #ffffff}
h1{font-size:30px;line-height:1.25;margin:28px 0 8px;color:#ffffff}
h2{font-size:22px;margin:32px 0 8px;color:#1aedff}
p{margin:8px 0}
.muted{color:#a8a8a8}
.crumbs{margin:16px 0 0;color:#a8a8a8;font-size:16px}
.card{background:#2d4362;border:4px solid #7e41ba;box-shadow:0 0 0 4px #08060c;padding:8px 20px 20px;margin:20px 0}
.effect{background:#08060c;border:4px solid #405f8c;padding:12px 16px;white-space:pre-line}
table{border-collapse:collapse;width:100%;margin:12px 0}
th,td{text-align:left;padding:6px 10px;border-bottom:2px solid #405f8c;vertical-align:top}
th{width:38%;color:#a8a8a8;font-weight:normal}
ul.list{list-style:none;margin:0;padding:0;columns:2 280px;column-gap:24px}
ul.list li{break-inside:avoid;padding:3px 0;border-bottom:2px solid #2d4362}
ul.list .set{color:#a8a8a8;font-size:14px}
.cta{text-align:center;margin:28px 0}
.foot{border-top:4px solid #2d4362;margin-top:40px;padding-top:16px;color:#a8a8a8;font-size:15px}
.jump a{display:inline-block;margin:2px 10px 2px 0}
`.replace(/\n/g, '');

function layout({ origin, canonOrigin, path, title, description, body, jsonLd, noindex }) {
  const url = origin + path;
  const canonUrl = (canonOrigin || origin) + path;
  const ld = jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>` : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="${noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large'}">
<meta name="theme-color" content="#08060c">
<link rel="canonical" href="${esc(canonUrl)}">
<link rel="icon" type="image/png" href="/favicon.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonUrl)}">
<meta property="og:image" content="${esc(origin)}/title.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(origin)}/title.png">
${ld}
<style>${CSS}</style>
</head>
<body>
<header class="top"><div class="wrap">
<a class="brand" href="/">Pixel Parties</a>
<a class="nav" href="/cards">Card list</a>
<a class="nav" href="${DISCORD_URL}" rel="noopener">Discord</a>
<a class="btn" href="/">Play free</a>
</div></header>
<main class="wrap">
${body}
<p class="cta"><a class="btn" href="/">Play Pixel Parties free in your browser</a></p>
<footer class="foot">
<p>${SITE_NAME} is a free online trading card game: build a party of Heroes, shape their Abilities and eliminate the competition. No download needed.</p>
<p><a href="/">Play</a> &middot; <a href="/cards">All cards</a> &middot; <a href="${DISCORD_URL}" rel="noopener">Join the Discord</a></p>
</footer>
</main>
</body>
</html>
`;
}

// ── Kartenliste ──────────────────────────────────────────────────────────────────────────────────
function cardListPage(cat, origin, canonOrigin) {
  const total = cat.entries.length;
  const types = [...cat.byType.keys()].sort((a, b) => {
    const ia = TYPE_ORDER.indexOf(a), ib = TYPE_ORDER.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
  });
  const jump = types.map(t => `<a href="#t-${slugify(t)}">${esc(typePlural(t))} (${cat.byType.get(t).length})</a>`).join(' ');
  const sections = types.map(t => {
    const items = cat.byType.get(t).map(e =>
      `<li><a href="/card/${e.slug}">${esc(e.card.name)}</a></li>`).join('');
    return `<h2 id="t-${slugify(t)}">${esc(typePlural(t))}</h2><ul class="list">${items}</ul>`;
  }).join('\n');
  const title = `Pixel Parties Card List – All ${total} Cards | ${SITE_NAME}`;
  const description = `Browse all ${total} cards of Pixel Parties TCG, the free online trading card game: Heroes, Abilities, Spells, Attacks, Creatures, Artifacts and Potions with their full effect text.`;
  const body = `
<p class="crumbs"><a href="/">Pixel Parties</a> &rsaquo; Card list</p>
<h1>Pixel Parties card list</h1>
<p>${total} cards of the free online trading card game Pixel Parties: pick a card to read its full effect text, stats and related cards. Ready to try them? <a href="/">Play in your browser</a>, no download needed.</p>
<p class="jump">${jump}</p>
${sections}`;
  return layout({
    origin, canonOrigin, path: '/cards', title, description, body,
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'CollectionPage', name: title, description, url: origin + '/cards', isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: origin + '/' } },
        { '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: SITE_NAME, item: origin + '/' },
          { '@type': 'ListItem', position: 2, name: 'Card list', item: origin + '/cards' },
        ] },
      ],
    },
  });
}

// ── Seite einer Karte ────────────────────────────────────────────────────────────────────────────
function cardFacts(c) {
  const rows = [];
  const add = (k, v) => { if (v !== null && v !== undefined && String(v).trim() !== '') rows.push([k, v]); };
  add('Card type', [c.cardType, c.subtype].filter(Boolean).join(' – '));
  add('Level', c.level);
  add('HP', c.hp);
  add('ATK', c.atk);
  add('Gold cost', c.costLabel || c.cost);
  add('Spell school', [c.spellSchool1, c.spellSchool2].filter(Boolean).join(', '));
  add('Starting Abilities', [c.startingAbility1, c.startingAbility2].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', '));
  add('Archetype', c.archetype);
  add('Set', c.setID);
  add('Copies per deck', c.maxCopies);
  if (c.banned) add('Status', String(c.banned));
  return rows;
}

function cardPage(cat, e, origin, canonOrigin) {
  const c = e.card;
  const type = [c.subtype, c.cardType].filter(Boolean).join(' ');   // „Reaction Attack“, „Normal Spell“, „Ascended Hero“
  const effect = String(c.effect || '').trim();
  const title = `${c.name} – ${c.cardType || 'Card'} | ${SITE_NAME}`;
  const stats = [c.hp != null ? `${c.hp} HP` : '', c.atk != null ? `${c.atk} ATK` : '', c.level != null ? `Level ${c.level}` : ''].filter(Boolean).join(', ');
  const description = clip(`${c.name} is ${article(type)} ${type} card in Pixel Parties TCG${stats ? ' (' + stats + ')' : ''}. ${effect}`, 158);

  const rows = cardFacts(c).map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('');

  const arch = String(c.archetype || '').trim();
  const sameArch = arch ? (cat.byArchetype.get(arch) || []).filter(x => x !== e).slice(0, 16) : [];
  const sameType = cat.byType.get(c.cardType || 'Other') || [];
  const pos = sameType.indexOf(e);
  const near = sameType.slice(Math.max(0, pos - 4), pos + 5).filter(x => x !== e);
  const link = (x) => `<li><a href="/card/${x.slug}">${esc(x.card.name)}</a></li>`;
  const related =
    (sameArch.length ? `<h2>More ${esc(arch)} cards</h2><ul class="list">${sameArch.map(link).join('')}</ul>` : '') +
    (near.length ? `<h2>More ${esc(typePlural(c.cardType || 'Other'))}</h2><ul class="list">${near.map(link).join('')}</ul>` : '');

  const body = `
<p class="crumbs"><a href="/">Pixel Parties</a> &rsaquo; <a href="/cards">Card list</a> &rsaquo; ${esc(c.name)}</p>
<div class="card">
<h1>${esc(c.name)}</h1>
<p class="muted">${esc(type || 'Card')} &middot; Pixel Parties TCG</p>
${effect ? `<h2>Card effect</h2><div class="effect">${esc(effect)}</div>` : ''}
<h2>Card details</h2>
<table>${rows}</table>
</div>
<p>${esc(c.name)} is one of ${cat.entries.length} cards you can collect and use in <a href="/">Pixel Parties</a>, a free online trading card game. Build a deck around it and duel other players or the CPU right in your browser.</p>
${related}`;
  return layout({
    origin, canonOrigin, path: '/card/' + e.slug, title, description, body,
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'WebPage', name: title, description, url: origin + '/card/' + e.slug, isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: origin + '/' } },
        { '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: SITE_NAME, item: origin + '/' },
          { '@type': 'ListItem', position: 2, name: 'Card list', item: origin + '/cards' },
          { '@type': 'ListItem', position: 3, name: c.name, item: origin + '/card/' + e.slug },
        ] },
      ],
    },
  });
}

function notFoundPage(origin, slug) {
  return layout({
    origin, path: '/card/' + slug, noindex: true,
    title: `Card not found | ${SITE_NAME}`,
    description: 'This card page does not exist. Browse the full Pixel Parties card list instead.',
    body: `<h1>Card not found</h1><p>There is no card page called &ldquo;${esc(slug)}&rdquo;. Try the <a href="/cards">full card list</a>.</p>`,
  });
}

// ── Sitemap ──────────────────────────────────────────────────────────────────────────────────────
function siteUrls(cat) {
  return [
    { path: '/', priority: '1.0' },
    { path: '/cards', priority: '0.8' },
    ...cat.entries.map(e => ({ path: '/card/' + e.slug, priority: '0.5' })),
  ];
}

function sitemapXml(cat, origin, lastmod) {
  const urls = siteUrls(cat).map(u =>
    `  <url><loc>${esc(origin + u.path)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}<priority>${u.priority}</priority></url>`);
  return ['<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">', ...urls, '</urlset>', ''].join('\n');
}

// ── Anbindung an Express ─────────────────────────────────────────────────────────────────────────
/**
 * @param app  Express-App
 * @param deps {
 *   resolveOrigin(req)   → Ursprung, unter dem die Seite erreicht wurde
 *   isIndexable(req)     → true nur für den echten Produktionshost (andere Hosts bekommen `noindex`)
 *   canonicalOrigin()    → Ursprung der Produktionsseite (Ziel des Canonical auf anderen Hosts)
 *   getCardArray()       → Karten aus data/cards.json
 *   hasCardEffect(name)  → Karte hat ein Effekt-Skript
 *   cardNamesWithImage(cards) → Set der Kartennamen mit Bild (oder null, wenn nicht lesbar)
 *   cardsJsonMtime()     → Zeitstempel (ms) von data/cards.json, für <lastmod> und den Zwischenspeicher
 * }
 */
function registerSeoRoutes(app, deps) {
  let cache = null;   // { key, cat }
  function catalog() {
    const cards = deps.getCardArray();
    const key = cards;   // neue Kartenliste (Neuladen) → neuer Katalog
    if (cache && cache.key === key && Date.now() - cache.at < 10 * 60 * 1000) return cache.cat;
    let imageNames = null;
    try { imageNames = deps.cardNamesWithImage(cards); } catch { imageNames = null; }
    const cat = buildCatalog(cards, { hasEffect: deps.hasCardEffect, imageNames });
    cache = { key, cat, at: Date.now() };
    return cat;
  }
  const lastmod = () => { try { return new Date(deps.cardsJsonMtime()).toISOString().slice(0, 10); } catch { return ''; } };

  // Auf Test-/Vorschau-Hosts zeigt der Canonical auf die Produktionsseite.
  const canon = (req) => (deps.isIndexable(req) || !deps.canonicalOrigin ? deps.resolveOrigin(req) : deps.canonicalOrigin());

  function send(req, res, html, status) {
    if (!deps.isIndexable(req)) res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.status(status || 200);
    res.setHeader('Content-Type', 'text/html; charset=UTF-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(html);
  }

  app.get('/robots.txt', (req, res) => {
    const origin = deps.resolveOrigin(req);
    res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send([
      'User-agent: *',
      'Allow: /',
      // Nichts von Wert fuer den Index, aber viel Crawl-Budget:
      // Klaenge und Musik sind hunderte Dateien, /api/ liefert nur JSON.
      'Disallow: /api/',
      'Disallow: /sounds/',
      'Disallow: /music/',
      '',
      `Sitemap: ${origin}/sitemap.xml`,
      '',
    ].join('\n'));
  });

  app.get('/sitemap.xml', (req, res) => {
    const origin = deps.resolveOrigin(req);
    if (!deps.isIndexable(req)) res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('Content-Type', 'application/xml; charset=UTF-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(sitemapXml(catalog(), origin, lastmod()));
  });

  app.get('/cards', (req, res) => send(req, res, cardListPage(catalog(), deps.resolveOrigin(req), canon(req))));

  app.get('/card/:slug', (req, res) => {
    const cat = catalog();
    const wanted = String(req.params.slug || '');
    const e = cat.bySlug.get(wanted);
    if (e) return send(req, res, cardPage(cat, e, deps.resolveOrigin(req), canon(req)));
    // Gross-/Kleinschreibung oder Namens-Schreibweise: auf die richtige Adresse weiterleiten statt zu verdoppeln
    const alt = cat.bySlug.get(slugify(wanted));
    if (alt) return res.redirect(301, '/card/' + alt.slug);
    return send(req, res, notFoundPage(deps.resolveOrigin(req), slugify(wanted).slice(0, 80)), 404);
  });
}

module.exports = { registerSeoRoutes, buildCatalog, slugify, cardPage, cardListPage, sitemapXml, siteUrls, esc, clip };
