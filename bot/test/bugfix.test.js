'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { findBugfixes, readNotes, fingerprint, parseNameStatus, parseRequires } = require('../lib/bugfix');
const { guild, setup, config } = require('./helpers');

const real = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'cards.json'), 'utf8'));
const slug = n => n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const USED = new Set(['Acid Rain', 'Fireball', 'Anti Grav Trap', 'Chain Lightning']);
const BROAD_CARDS = real.filter(c => c.cardType === 'Spell' && !USED.has(c.name)).slice(0, 14).map(c => c.name);

/** Kleines Git-Repo mit cards/effects/. */
function makeRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pp-bugfix-'));
  const g = (...a) => execFileSync('git', ['-C', dir, '-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  g('init', '-q', '-b', 'main');
  const api = {
    dir, git: async (...a) => g(...a), sync: g,
    write(file, text) { const f = path.join(dir, file); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); },
    remove(file) { fs.rmSync(path.join(dir, file)); },
    commit(msg = 'x') { g('add', '-A'); g('commit', '-qm', msg); return g('rev-parse', 'HEAD').trim(); },
    clean() { fs.rmSync(dir, { recursive: true, force: true }); },
  };
  const E = f => `cards/effects/${f}.js`;
  api.E = E;
  api.write(E('acid-rain'), "module.exports = { effect: 1 };\n// Kommentar\n");
  api.write(E('fireball'), "module.exports = { effect: 2 };\n");
  api.write(E('alice-the-puppeteer-girl'), "const s = require('./_alice-shared');\nmodule.exports = { s };\n");
  api.write(E('alice-the-transfer-student'), "const s = require(\"./_alice-shared.js\");\nmodule.exports = { s };\n");
  api.write(E('_alice-shared'), "exports.x = 1;\n");
  api.write(E('_outer-shared'), "const a = require('./_alice-shared');\nexports.y = a;\n");
  api.write(E('anti-grav-trap'), "const o = require('./_outer-shared');\nmodule.exports = { o };\n");
  api.write(E('_big-shared'), "exports.big = 1;\n");
  for (const n of BROAD_CARDS) api.write(E(slug(n)), "const b = require('./_big-shared');\nmodule.exports = { b };\n");
  api.write(E('not-a-card-at-all'), "module.exports = {};\n");
  api.write('server.js', '// x\n');
  api.head = api.commit('Erster Stand');
  return api;
}
const names = list => list.map(x => x.card.name).sort();

test('Hilfsfunktionen: Fingerabdruck ignoriert Kommentare/Leerraum, parseNameStatus/parseRequires', () => {
  assert.equal(fingerprint('a = 1; // hallo\n/* x */ b = 2;'), fingerprint('a=1;\n\n b = 2; // anders'));
  assert.notEqual(fingerprint('a = 1;'), fingerprint('a = 2;'));
  assert.equal(fingerprint("u = 'http://x.y'; // c"), fingerprint("u = 'http://x.y';"), 'URL in Zeichenkette bleibt, Kommentar geht');
  assert.deepEqual(parseNameStatus('M\tcards/effects/a.js\nA\tcards/effects/b.js\nM\tcards/effects/CARD_API.md\nM\tserver.js\n'),
    [{ status: 'M', file: 'cards/effects/a.js' }, { status: 'A', file: 'cards/effects/b.js' }]);
  const deps = parseRequires("abc123:cards/effects/x.js:require('./_s-shared')\nabc123:cards/effects/x.js:require(\"./y\")\nabc123:cards/effects/z.js:require('./_t.js')\n");
  assert.deepEqual([...deps.get('x')], ['_s-shared']);
  assert.deepEqual([...deps.get('z')], ['_t']);
});

test('geändertes Karten-Skript → diese Karte; Kommentare/neue/gelöschte Dateien/andere Ordner zählen nicht', async () => {
  const r = makeRepo();
  try {
    const ask = async (prev) => findBugfixes({ git: r.git, last: prev, head: r.head, cards: real });
    let prev = r.head;

    r.write(r.E('acid-rain'), "module.exports = { effect: 99 };\n// Kommentar\n");
    r.head = r.commit('Fix');
    let f = await ask(prev); prev = r.head;
    assert.deepEqual(names(f.direct), ['Acid Rain']);
    assert.deepEqual(f.shared, []);

    r.write(r.E('fireball'), "// jetzt kommentiert\nmodule.exports   =   { effect: 2 };   // und eingerückt\n");
    r.head = r.commit('Nur Kommentare');
    f = await ask(prev); prev = r.head;
    assert.deepEqual([f.direct, f.shared], [[], []], 'reine Kommentar-/Leerraum-Änderung ist kein Bugfix');

    r.write(r.E('chain-lightning'), "module.exports = { neu: true };\n");     // neu hinzugekommen = neue Umsetzung
    r.head = r.commit('Neue Karte');
    f = await ask(prev); prev = r.head;
    assert.deepEqual([f.direct, f.shared], [[], []], 'neue Datei ist keine Korrektur');

    r.remove(r.E('chain-lightning')); r.write(r.E('not-a-card-at-all'), "module.exports = { geaendert: 1 };\n"); r.write('server.js', '// y\nfoo();\n');
    r.head = r.commit('Löschen + Nicht-Karte + andere Datei');
    f = await ask(prev); prev = r.head;
    assert.deepEqual([f.direct, f.shared], [[], []], 'gelöschte Datei, Datei ohne Karte und Dateien außerhalb von cards/effects zählen nicht');
  } finally { r.clean(); }
});

test('geänderter gemeinsamer Baustein → die Karten, die ihn einbinden (auch über andere Bausteine); breite Bausteine nur mit Anzahl', async () => {
  const r = makeRepo();
  try {
    const ask = (prev, maxShared = 12) => findBugfixes({ git: r.git, last: prev, head: r.head, cards: real, maxShared });
    let prev = r.head;

    r.write(r.E('_alice-shared'), "exports.x = 2;\n");
    r.head = r.commit('Alice-Baustein');
    let f = await ask(prev); prev = r.head;
    assert.deepEqual(f.direct, []);
    assert.equal(f.shared.length, 1);
    assert.equal(f.shared[0].module, '_alice-shared');
    // direkt: beide Alice-Karten; über `_outer-shared` (bindet `_alice-shared` ein): Anti Grav Trap
    assert.deepEqual(names(f.shared[0].cards.map(card => ({ card }))), ['Alice, the Puppeteer Girl', 'Alice, the Transfer Student', 'Anti Grav Trap']);
    assert.equal(f.shared[0].broad, false);

    r.write(r.E('_big-shared'), "exports.big = 2;\n");
    r.head = r.commit('Breiter Baustein');
    f = await ask(prev); prev = r.head;
    assert.equal(f.shared[0].module, '_big-shared');
    assert.equal(f.shared[0].count, 14);
    assert.equal(f.shared[0].broad, true, '14 > 12 → breit');
    r.write(r.E('_big-shared'), "exports.big = 3;\n");
    r.head = r.commit('nochmal');
    assert.equal((await ask(prev, 20)).shared[0].broad, false, 'Schwelle einstellbar');

    r.write(r.E('_alice-shared'), "exports.x = 3;\n"); r.write(r.E('alice-the-puppeteer-girl'), "const s = require('./_alice-shared');\nmodule.exports = { s, fix: 1 };\n");
    const before = r.head;
    r.head = r.commit('Karte + Baustein');
    f = await ask(before);
    assert.deepEqual(names(f.direct), ['Alice, the Puppeteer Girl'], 'direkte Korrektur wird getrennt gemeldet');
    assert.equal(f.shared[0].cards.length >= 2, true);
  } finally { r.clean(); }
});

test('Feed: Kartenbilder im Bugfix-Kanal (direkte Korrekturen, schmale Bausteine mit Hinweis, breite nur als Text); erster Lauf merkt nur', async () => {
  const r = makeRepo();
  try {
    config.repoRoot = r.dir; config.channels.bugfixes = 'BF'; config.bugfixMaxShared = 12;
    const { ctx, client, db } = await setup();      // NACH der Umstellung von repoRoot: feeds liest es beim Registrieren
    const sent = [];
    const g = guild();
    g.channels.cache.set('BF', { isTextBased: () => true, send: async p => { sent.push(p); } });
    client.guilds.cache.set('G1', g);
    const poll = () => ctx._feeds.pollBugfixes();

    await poll();
    assert.equal(sent.length, 0, 'erster Lauf postet nichts');
    assert.equal(await db.kvGet('bugfix_last'), r.head);

    r.write(r.E('acid-rain'), "module.exports = { effect: 'fix' };\n");
    r.write(r.E('_alice-shared'), "exports.x = 'fix';\n");
    r.commit('Karte + Baustein');
    await poll();
    assert.equal(sent.length, 1);
    const m = sent[0];
    assert.match(m.content, /Bug fixes\*\* — 4 cards/);
    assert.match(m.content, /\*\*Acid Rain\*\*(?! —)/);
    assert.match(m.content, /\*\*Alice, the Puppeteer Girl\*\*(?! —)/);
    assert.match(m.content, /\*\*Anti Grav Trap\*\*(?! —)/, 'über einen weiteren Baustein eingebunden');
    assert.ok(m.files.length >= 3 && m.files.length <= 4, 'Bilder für alle Karten mit Kunst (in der Test-Umgebung fehlt ein Bild)');
    assert.ok(m.files.every(f => f.attachment.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))), 'Kartenbilder');
    assert.deepEqual(m.allowedMentions, { parse: [] });
    assert.ok(!/Fix|Karte \+ Baustein/.test(m.content), 'keine Commit-Texte');

    await poll();
    assert.equal(sent.length, 1, 'nichts Neues → nichts gepostet');

    r.write(r.E('_big-shared'), "exports.big = 'fix';\n"); r.commit('Engine');
    await poll();
    assert.equal(sent.length, 2);
    assert.match(sent[1].content, /Shared engine code was fixed[\s\S]*• `_big-shared` \(14 cards\)$/);
    assert.ok(!sent[1].files, 'breiter Baustein: keine Kartenbilder');

    r.write(r.E('fireball'), "// nur ein Kommentar\nmodule.exports = { effect: 2 };\n"); r.write('server.js', '// z\n');
    const h = r.commit('Kommentar');
    await poll();
    assert.equal(sent.length, 2, 'Kommentar/andere Dateien: nichts');
    assert.equal(await db.kvGet('bugfix_last'), h, 'Stand wurde trotzdem weitergesetzt');
  } finally { r.clean(); }
});

test('Feed ohne Kanal und ohne Git stürzt nicht ab', async () => {
  const r = makeRepo();
  try {
    config.repoRoot = r.dir; config.channels.bugfixes = '';
    const a = await setup();
    await a.ctx._feeds.pollBugfixes();
    r.write(r.E('acid-rain'), "module.exports = { effect: 'fix2' };\n"); const h = r.commit('x');
    await a.ctx._feeds.pollBugfixes();
    assert.equal(await a.db.kvGet('bugfix_last'), h, 'Stand wird auch ohne Kanal weitergesetzt');
    config.repoRoot = os.tmpdir();               // kein Git-Repo
    const b = await setup();
    await b.ctx._feeds.pollBugfixes();
  } finally { r.clean(); config.repoRoot = path.resolve(__dirname, '..', '..'); }
});

test('Balancing-Änderung (cards.json) ist kein Bugfix; Bugfix-Note beschreibt den Fehler', async () => {
  const r = makeRepo();
  try {
    // cards.json mit zwei Karten im Repo (echte Namen, damit Bilder/Zuordnung klappen)
    const mk = (acid, fire) => JSON.stringify(real.map(c => c.name === 'Acid Rain' ? { ...c, effect: acid } : c.name === 'Fireball' ? { ...c, effect: fire } : c));
    r.write('data/cards.json', mk('A', 'F'));
    r.head = r.commit('cards.json');
    config.repoRoot = r.dir; config.channels.bugfixes = 'BF'; config.bugfixMaxShared = 12;
    const { ctx, client, db } = await setup();
    const sent = [];
    const g = guild();
    g.channels.cache.set('BF', { isTextBased: () => true, send: async p => { sent.push(p); } });
    client.guilds.cache.set('G1', g);
    await ctx._feeds.pollBugfixes();                          // merkt den Stand
    assert.equal(sent.length, 0);

    // Acid Rain: Skript UND Effekttext geändert = Balancing; Fireball: nur Skript = Bugfix
    r.write(r.E('acid-rain'), "module.exports = { effect: 'balance' };\n");
    r.write(r.E('fireball'), "module.exports = { effect: 'bugfix' };\n");
    r.write('data/cards.json', mk('B', 'F'));
    r.commit('Balancing + Fix\n\nBugfix-Note: Fireball | Damage was dealt twice when the target had a shield.');
    await ctx._feeds.pollBugfixes();
    assert.equal(sent.length, 1);
    assert.match(sent[0].content, /Bug fixes\*\* — 1 card\n/);
    assert.match(sent[0].content, /\*\*Fireball\*\*\n {2}↳ Damage was dealt twice when the target had a shield\./);
    assert.ok(!/Acid Rain/.test(sent[0].content), 'Balancing-Änderung nicht als Bugfix');

    // Gleiche Karte mit Beschreibung → ausdrücklich Bugfix (z. B. fehlerhafter Effekttext korrigiert)
    r.write(r.E('acid-rain'), "module.exports = { effect: 'balance2' };\n");
    r.write('data/cards.json', mk('C', 'F'));
    r.commit('Textfehler\n\n* Bugfix-Note: acid rain | The card text promised 2 damage but the script dealt 1.');
    await ctx._feeds.pollBugfixes();
    assert.equal(sent.length, 2);
    assert.match(sent[1].content, /\*\*Acid Rain\*\*\n {2}↳ The card text promised 2 damage but the script dealt 1\./);

    // Baustein-Beschreibung: schmal (an den Karten) und breit (in der Zeile)
    r.write(r.E('_alice-shared'), "exports.x = 'z';\n"); r.write(r.E('_big-shared'), "exports.big = 'z';\n");
    r.commit('Bausteine\n\nBugfix-Note: _alice-shared | Summons no longer stay on the board after their owner leaves.\nBugfix-Note: _big-shared | Hooks fired in the wrong order.');
    await ctx._feeds.pollBugfixes();
    assert.equal(sent.length, 4);
    assert.match(sent[2].content, /Alice, the Puppeteer Girl\*\*\n {2}↳ Summons no longer stay on the board/);
    assert.match(sent[3].content, /• `_big-shared` \(14 cards\) — Hooks fired in the wrong order\.$/);
    assert.ok(sent.every(m => JSON.stringify(m.allowedMentions) === '{"parse":[]}'));
  } finally { r.clean(); config.repoRoot = path.resolve(__dirname, '..', '..'); }
});

test('Neue, noch nicht live gegangene Karte: kein Bugfix, auch nicht mit Bugfix-Note (Troubleshooting vor dem Livegang)', async () => {
  const r = makeRepo();
  try {
    const mk = (ohneFireball) => JSON.stringify(ohneFireball ? real.filter(c => c.name !== 'Fireball') : real);
    r.write('data/cards.json', mk(true));
    r.head = r.commit('cards.json ohne Fireball');
    config.repoRoot = r.dir; config.channels.bugfixes = 'BF'; config.bugfixMaxShared = 12;
    const { ctx, client } = await setup();
    const sent = [];
    const g = guild();
    g.channels.cache.set('BF', { isTextBased: () => true, send: async p => { sent.push(p); } });
    client.guilds.cache.set('G1', g);
    await ctx._feeds.pollBugfixes();                          // merkt den Stand (Fireball ist noch nicht in cards.json)
    assert.equal(sent.length, 0);

    // Fireball kommt NEU dazu (Eintrag + Skript), wird nachgebessert und mit Note beschrieben; Acid Rain ist ein echter Bugfix
    r.write('data/cards.json', mk(false));
    r.write(r.E('fireball'), "module.exports = { effect: 'v1' };\n");
    r.commit('Neue Karte Fireball');
    r.write(r.E('fireball'), "module.exports = { effect: 'v2' };\n");
    r.write(r.E('acid-rain'), "module.exports = { effect: 'fix' };\n");
    r.commit('Troubleshooting\n\nBugfix-Note: Fireball | Damage was dealt twice.\nBugfix-Note: Acid Rain | Damage was dealt once too often.');
    await ctx._feeds.pollBugfixes();
    assert.equal(sent.length, 1);
    assert.match(sent[0].content, /Bug fixes\*\* — 1 card\n/);
    assert.match(sent[0].content, /\*\*Acid Rain\*\*\n {2}↳ Damage was dealt once too often\./);
    assert.ok(!/Fireball/.test(sent[0].content), 'neue Karte erscheint nicht im Bugfix-Feed');
  } finally { r.clean(); config.repoRoot = path.resolve(__dirname, '..', '..'); }
});

test('readNotes: Zeilenformat, Aufzählungszeichen, Kürzung, mehrere Zeilen pro Ziel; findBugfixes lässt balancierte Karten aus', async () => {
  const r = makeRepo();
  try {
    const from = r.head;
    r.write(r.E('fireball'), "module.exports = { effect: 'b' };\n");
    r.commit('Eins\n\nBugfix-Note: Fireball | First part.\n- Bugfix-Note: Fireball | Second part.\nBugfix-Note: kaputt ohne Trenner\nBugfix-Note: Acid Rain |   ');
    r.write(r.E('acid-rain'), "module.exports = { effect: 'b' };\n");
    r.commit('Zwei\n\nBugfix-Note: "Deadly Poison" | ' + 'x'.repeat(500));
    const n = await readNotes({ git: r.git, last: from, head: r.head = r.sync('rev-parse', 'HEAD').trim() });
    assert.equal(n.get('fireball'), 'First part.; Second part.');
    assert.equal(n.get('deadlypoison').length, 220, 'lange Beschreibung wird gekürzt');
    assert.ok(!n.has('acidrain') && n.size === 2, 'leere/kaputte Zeilen ignoriert');

    const f = await findBugfixes({ git: r.git, last: from, head: r.head, cards: real, balanced: new Set(['Acid Rain']) });
    assert.deepEqual(names(f.direct), ['Fireball']);
    const g = await findBugfixes({ git: r.git, last: from, head: r.head, cards: real });
    assert.deepEqual(names(g.direct), ['Acid Rain', 'Fireball']);
    assert.deepEqual(await readNotes({ git: r.git, last: 'deadbeef', head: r.head }), new Map(), 'unbekannter Stand → keine Beschreibungen, kein Absturz');
  } finally { r.clean(); }
});
