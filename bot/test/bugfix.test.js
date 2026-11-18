'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { findBugfixes, readNotes, parseSkips, readCommitChanges, changedFiles, applySkips, applyCommitSkips, fingerprint, parseNameStatus, parseRequires } = require('../lib/bugfix');
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

test('Bugfix-Skip im Feed: unterdrückt nur die Änderung des eigenen Commits (auch für Bausteine); ein anderer Commit ohne Skip bringt das Ziel zurück', async () => {
  const r = makeRepo();
  try {
    r.write('data/cards.json', JSON.stringify(real));
    r.head = r.commit('cards.json');
    config.repoRoot = r.dir; config.channels.bugfixes = 'BF'; config.bugfixMaxShared = 12;
    const { ctx, client } = await setup();
    const sent = [];
    const g = guild();
    g.channels.cache.set('BF', { isTextBased: () => true, send: async p => { sent.push(p); } });
    client.guilds.cache.set('G1', g);
    await ctx._feeds.pollBugfixes();                          // merkt den Stand
    assert.equal(sent.length, 0);

    // EIN Commit passt Fireball und zwei Bausteine nur an eine neue Karte an (Skip, die Note desselben Commits entfällt); Acid Rain ist ein echter Fix in einem eigenen Commit
    r.write(r.E('fireball'), "module.exports = { effect: 'angepasst' };\n");
    r.write(r.E('_alice-shared'), "exports.x = 'z';\n"); r.write(r.E('_big-shared'), "exports.big = 'z';\n");
    r.commit('Neue Karte\n\nBugfix-Note: Fireball | Eine zu Unrecht geschriebene Beschreibung.\nBugfix-Skip: Fireball | nur an die neue Karte angepasst\n- Bugfix-Skip: _alice-shared\nBugfix-Skip: _big-shared');
    r.write(r.E('acid-rain'), "module.exports = { effect: 'fix' };\n");
    r.commit('Fix\n\nBugfix-Note: Acid Rain | Damage was dealt once too often.');
    await ctx._feeds.pollBugfixes();
    assert.equal(sent.length, 1, 'nur eine Nachricht (Karten); der breite Baustein ist abgemeldet');
    assert.match(sent[0].content, /Bug fixes\*\* — 1 card\n/);
    assert.match(sent[0].content, /\*\*Acid Rain\*\*\n {2}↳ Damage was dealt once too often\./);
    assert.ok(!/Fireball/.test(sent[0].content), 'Fireball (Skip im eigenen Commit) erscheint nicht — auch nicht mit der Note dieses Commits');
    assert.ok(!/Alice/.test(sent[0].content), 'über den abgemeldeten Baustein betroffene Karten erscheinen nicht');

    // Ein SPÄTERER Commit mit Skip rettet frühere Änderungen nicht: Fireball und der breite Baustein wurden vorher ohne Skip geändert (Fireball sogar mit Note)
    r.write(r.E('fireball'), "module.exports = { effect: 'echter fix' };\n"); r.write(r.E('_big-shared'), "exports.big = 'echt';\n");
    r.commit('Echter Fix\n\nBugfix-Note: Fireball | Damage was dealt twice when the target had a shield.');
    r.write(r.E('fireball'), "module.exports = { effect: 'noch eine anpassung' };\n"); r.write(r.E('_big-shared'), "exports.big = 'anpassung';\n");
    r.commit('Anpassung\n\nBugfix-Skip: Fireball\nBugfix-Skip: _big-shared');
    await ctx._feeds.pollBugfixes();
    assert.equal(sent.length, 3, 'Karten-Nachricht und Baustein-Nachricht');
    assert.match(sent[1].content, /\*\*Fireball\*\*\n {2}↳ Damage was dealt twice when the target had a shield\./);
    assert.match(sent[2].content, /• `_big-shared` \(14 cards\)$/);
  } finally { r.clean(); config.repoRoot = path.resolve(__dirname, '..', '..'); }
});

// ── Skip und Note gelten je Commit ─────────────────────────────────
/** Wie der Feed: Fund → Skips der eigenen Commits abziehen; dazu die Notes. */
async function pipeline(r, last, opts = {}) {
  const head = r.sync('rev-parse', 'HEAD').trim();
  const found = await applyCommitSkips({ git: r.git, last, head, found: await findBugfixes({ git: r.git, last, head, cards: real, ...opts }) });
  const notes = await readNotes({ git: r.git, last, head });
  return { found, notes };
}
const cardsOf = f => [...new Set([...f.direct.map(d => d.card.name), ...f.shared.flatMap(sh => sh.cards.map(c => c.name))])].sort();

test('Skip je Commit (a): Note in Commit 1, Skip in Commit 2 für dasselbe Ziel → gemeldet, mit der Note aus Commit 1', async () => {
  const r = makeRepo();
  try {
    const from = r.head;
    r.write(r.E('fireball'), "module.exports = { effect: 'fix' };\n");
    r.commit('Fix\n\nBugfix-Note: Fireball | Damage was dealt twice when the target had a shield.');
    r.write(r.E('fireball'), "module.exports = { effect: 'angepasst' };\n");
    r.commit('Anpassung\n\nBugfix-Skip: Fireball | nur an die neue Karte angepasst');
    const { found, notes } = await pipeline(r, from);
    assert.deepEqual(names(found.direct), ['Fireball']);
    assert.equal(notes.get('fireball'), 'Damage was dealt twice when the target had a shield.');
  } finally { r.clean(); }
});

test('Skip je Commit (b): nur ein Commit mit Skip → unterdrückt', async () => {
  const r = makeRepo();
  try {
    const from = r.head;
    r.write(r.E('fireball'), "module.exports = { effect: 'angepasst' };\n");
    r.commit('Anpassung\n\nBugfix-Skip: Fireball');
    const { found } = await pipeline(r, from);
    assert.deepEqual([found.direct, found.shared], [[], []]);
    // ein Skip in einem Commit, der das Skript nicht ändert, unterdrückt nichts
    r.write(r.E('acid-rain'), "module.exports = { effect: 'fix' };\n");
    r.commit('Fix');
    r.write('server.js', '// anders\nfoo();\n');
    r.commit('Anderes\n\nBugfix-Skip: Acid Rain');
    assert.deepEqual(names((await pipeline(r, from)).found.direct), ['Acid Rain'], 'Skip im Commit ohne Skript-Änderung greift nicht');
  } finally { r.clean(); }
});

test('Skip je Commit (c): Skip in Commit 2, aber Commit 1 ändert das Skript ohne Skip und ohne Note → gemeldet, ohne Erklärung', async () => {
  const r = makeRepo();
  try {
    const from = r.head;
    r.write(r.E('fireball'), "module.exports = { effect: 'fix' };\n");
    r.commit('Fix');
    r.write(r.E('fireball'), "module.exports = { effect: 'angepasst' };\n");
    r.commit('Anpassung\n\nBugfix-Skip: Fireball');
    const { found, notes } = await pipeline(r, from);
    assert.deepEqual(names(found.direct), ['Fireball']);
    assert.ok(!notes.has('fireball'));
  } finally { r.clean(); }
});

test('Skip je Commit (d): Baustein — Skip auf den Baustein unterdrückt die Karte; Skip auf die Karte nur diese Änderung; ein weiterer Commit ohne Skip bringt sie zurück', async () => {
  const r = makeRepo();
  try {
    const Y = 'Alice, the Transfer Student';
    let from = r.head;
    r.write(r.E('_alice-shared'), "exports.x = 2;\n");
    r.commit('Baustein\n\nBugfix-Skip: _alice-shared | neue Karte');
    let f = (await pipeline(r, from)).found;
    assert.deepEqual([f.direct, f.shared], [[], []], 'Skip auf den Baustein: weder der Baustein noch seine Karten');

    from = r.sync('rev-parse', 'HEAD').trim();
    r.write(r.E('_alice-shared'), "exports.x = 3;\n");
    r.commit('Baustein, nur für Y abgemeldet\n\nBugfix-Skip: Alice, the Transfer Student');
    f = (await pipeline(r, from)).found;
    assert.deepEqual(cardsOf(f), ['Alice, the Puppeteer Girl', 'Anti Grav Trap'], 'Skip auf die Karte Y entfernt nur Y');
    assert.equal(f.shared[0].count, 2);

    r.write(r.E('_alice-shared'), "exports.x = 4;\n");
    r.commit('Baustein nochmal, ohne Skip');
    f = (await pipeline(r, from)).found;
    assert.ok(cardsOf(f).includes(Y), 'ein weiterer Commit ändert den Baustein ohne Skip → Y wird gemeldet');
    assert.equal(f.shared[0].count, 3);

    // Skip auf den Baustein im einen, Skip auf Y im anderen Commit: jede Änderung ist abgemeldet → nichts
    from = r.sync('rev-parse', 'HEAD').trim();
    r.write(r.E('_alice-shared'), "exports.x = 5;\n"); r.commit('A\n\nBugfix-Skip: _alice-shared');
    r.write(r.E('_alice-shared'), "exports.x = 6;\n"); r.commit('B\n\nBugfix-Skip: Alice, the Transfer Student');
    f = (await pipeline(r, from)).found;
    assert.deepEqual(cardsOf(f), ['Alice, the Puppeteer Girl', 'Anti Grav Trap'], 'Commit B zählt für alle außer Y, Commit A für niemanden');
  } finally { r.clean(); }
});

test('Skip je Commit (e): Note und Skip für dasselbe Ziel im selben Commit → der Skip gewinnt; andere Ziele und andere Commits bleiben unberührt', async () => {
  const r = makeRepo();
  try {
    const from = r.head;
    r.write(r.E('fireball'), "module.exports = { effect: 'v1' };\n"); r.write(r.E('acid-rain'), "module.exports = { effect: 'v1' };\n");
    r.commit('Beides\n\nBugfix-Note: Fireball | Wrong text.\nBugfix-Skip: Fireball\nBugfix-Note: Acid Rain | Damage was dealt once too often.');
    let { found, notes } = await pipeline(r, from);
    assert.deepEqual(names(found.direct), ['Acid Rain']);
    assert.deepEqual([...notes.keys()], ['acidrain'], 'die Note des Commits mit Skip fällt weg');

    r.write(r.E('fireball'), "module.exports = { effect: 'v2' };\n");
    r.commit('Echter Fix\n\nBugfix-Note: Fireball | Damage was dealt twice.');
    ({ found, notes } = await pipeline(r, from));
    assert.deepEqual(names(found.direct), ['Acid Rain', 'Fireball'], 'der zweite Commit hat keinen Skip → Fireball gemeldet');
    assert.equal(notes.get('fireball'), 'Damage was dealt twice.', 'nur die Note des Commits ohne Skip');
  } finally { r.clean(); }
});

test('Skip je Commit (f): reine Kommentar-Änderung ohne Skip ändert nichts, wenn die inhaltliche Änderung in einem Commit mit Skip steht', async () => {
  const r = makeRepo();
  try {
    let from = r.head;
    r.write(r.E('fireball'), "module.exports = { effect: 'angepasst' };\n");
    r.commit('Anpassung\n\nBugfix-Skip: Fireball');
    r.write(r.E('fireball'), "// jetzt kommentiert\nmodule.exports   =   { effect: 'angepasst' };   // und eingerückt\n");
    r.commit('Nur Kommentare');
    let f = (await pipeline(r, from)).found;
    assert.deepEqual([f.direct, f.shared], [[], []]);

    // umgekehrte Reihenfolge, und auch über einen Baustein
    from = r.sync('rev-parse', 'HEAD').trim();
    r.write(r.E('_alice-shared'), "// nur Kommentar\nexports.x = 1;\n"); r.write(r.E('acid-rain'), "// auch\nmodule.exports = { effect: 1 };\n");
    r.commit('Nur Kommentare');
    r.write(r.E('_alice-shared'), "// nur Kommentar\nexports.x = 7;\n");
    r.commit('Baustein angepasst\n\nBugfix-Skip: _alice-shared');
    f = (await pipeline(r, from)).found;
    assert.deepEqual([f.direct, f.shared], [[], []]);
  } finally { r.clean(); }
});

test('Skip je Commit: Merge-Commits tragen keine eigene Änderung (Skip in der Merge-Nachricht greift nicht), Commits auf Seitenzweigen zählen; Notes in Merge-Nachrichten gelten', async () => {
  const r = makeRepo();
  try {
    const from = r.head;
    r.sync('checkout', '-q', '-b', 'feature');
    r.write(r.E('fireball'), "module.exports = { effect: 'feature' };\n");
    r.commit('Auf dem Seitenzweig (ohne Skip)');
    r.write(r.E('acid-rain'), "module.exports = { effect: 'feature' };\n");
    r.commit('Auf dem Seitenzweig\n\nBugfix-Skip: Acid Rain');
    r.sync('checkout', '-q', 'main');
    r.write('server.js', '// main\n');
    r.commit('Auf main');
    r.sync('merge', '--no-ff', '-q', '-m', 'Merge feature\n\nBugfix-Skip: Fireball\nBugfix-Note: Fireball | Damage was dealt twice.', 'feature');
    const { found, notes } = await pipeline(r, from);
    assert.deepEqual(names(found.direct), ['Fireball'], 'Acid Rain: Skip im eigenen Commit; Fireball: der Skip der Merge-Nachricht ändert nichts');
    assert.equal(notes.get('fireball'), undefined, 'die Note im selben Merge-Commit wie der Skip entfällt');
    r.sync('commit', '-q', '--amend', '-m', 'Merge feature\n\nBugfix-Note: Fireball | Damage was dealt twice.');
    assert.equal((await readNotes({ git: r.git, last: from, head: r.sync('rev-parse', 'HEAD').trim() })).get('fireball'), 'Damage was dealt twice.');
  } finally { r.clean(); }
});

test('readCommitChanges: je Datei die inhaltlich ändernden Commits mit ihren Skips; Grenzen (maxPairs) gelten im Zweifel als Änderung', async () => {
  const r = makeRepo();
  try {
    const from = r.head;
    r.write(r.E('fireball'), "module.exports = { effect: 'a' };\n");
    const c1 = r.commit('Eins\n\nBugfix-Skip: Fireball');
    r.write(r.E('fireball'), "// Kommentar\nmodule.exports = { effect: 'a' };\n");
    r.commit('Zwei (nur Kommentar)');
    r.write(r.E('fireball'), "module.exports = { effect: 'b' };\n"); r.write(r.E('acid-rain'), "module.exports = { effect: 'b' };\n"); r.write(r.E('chain-lightning'), "module.exports = {};\n");
    const c3 = r.commit('Drei');
    const head = r.sync('rev-parse', 'HEAD').trim();

    const ch = await readCommitChanges({ git: r.git, last: from, head, files: ['fireball', 'acid-rain', 'chain-lightning', 'nicht-angefragt'] });
    assert.deepEqual([...ch.keys()].sort(), ['acid-rain', 'fireball'], 'neue Datei (chain-lightning) zählt nicht');
    assert.deepEqual(ch.get('fireball').map(c => c.hash), [c3, c1], 'neueste zuerst; der Kommentar-Commit fehlt');
    assert.deepEqual([...ch.get('fireball')[1].skips], ['fireball']);
    assert.equal(ch.get('fireball')[0].skips.size, 0);
    assert.deepEqual((await readCommitChanges({ git: r.git, last: from, head, files: [] })), new Map());
    assert.deepEqual(await readCommitChanges({ git: r.git, last: 'deadbeef', head, files: ['fireball'] }), new Map(), 'unbekannter Stand → leer, kein Absturz');

    const grob = await readCommitChanges({ git: r.git, last: from, head, files: ['fireball'], maxPairs: 0 });
    assert.equal(grob.get('fireball').length, 3, 'über der Grenze: der Kommentar-Commit gilt vorsichtshalber als Änderung');
    assert.deepEqual(parseSkips('Text\nBugfix-Skip: Fireball | Grund\n* Bugfix-Skip: _alice-shared\nBugfix-Skip:  '), new Set(['fireball', 'aliceshared']));
  } finally { r.clean(); }
});

test('applySkips (rein): je Commit; ohne Commit-Angaben wird nichts unterdrückt, Karten ohne Angaben bleiben', () => {
  const sk = (...t) => new Set(t);
  const found = {
    direct: [{ card: { name: 'Fireball' }, file: 'fireball' }, { card: { name: 'Deadly Poison' }, file: 'deadly-poison' }, { card: { name: 'Acid Rain' }, file: 'acid-rain' }],
    shared: [{ module: '_alice-shared', cards: [{ name: 'Alice' }, { name: 'Bob' }], count: 2, broad: false },
      { module: '_outer-shared', cards: [{ name: 'Acid Rain' }], count: 1, broad: false },
      { module: '_leer-shared', cards: [], count: 0, broad: false }],
  };
  const changes = new Map([
    ['fireball', [{ hash: 'a', skips: sk('fireball') }]],                                  // alles abgemeldet
    ['deadly-poison', [{ hash: 'b', skips: sk('fireball') }, { hash: 'c', skips: sk() }]],  // Commit c ohne Skip
    ['_alice-shared', [{ hash: 'd', skips: sk('alice') }, { hash: 'e', skips: sk('aliceshared') }]],
    ['_outer-shared', [{ hash: 'f', skips: sk('outershared') }]],
    ['_leer-shared', [{ hash: 'g', skips: sk() }]],
  ]);
  const out = applySkips(found, changes);
  assert.deepEqual(out.direct.map(d => d.card.name), ['Deadly Poison', 'Acid Rain'], 'Acid Rain: keine Angaben zur Datei → bleibt');
  assert.deepEqual(out.shared.map(x => x.module), ['_alice-shared', '_leer-shared'], '_outer-shared: Skip auf den Baustein im einzigen Commit');
  assert.deepEqual(out.shared[0].cards.map(c => c.name), ['Bob'], 'Commit d zählt nur für Bob (Alice abgemeldet), Commit e (Skip auf den Baustein) für niemanden → Alice fällt weg');
  assert.equal(out.shared[0].count, 1);
  assert.equal(applySkips(found, new Map()), found, 'ohne Commit-Angaben unverändert');
  assert.equal(applySkips(found, null), found);
  assert.deepEqual(changedFiles(found).sort(), ['_alice-shared', '_leer-shared', '_outer-shared', 'acid-rain', 'deadly-poison', 'fireball']);
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
