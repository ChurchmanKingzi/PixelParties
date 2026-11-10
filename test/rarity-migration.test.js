'use strict';
// Migration Diamond Rare → Storm Rare: eine ALTE Datenbank (Rarity `diamond` in Sammlung, Decks und offenem Pack) wird beim Serverstart
// umgeschrieben; Zähler werden bei Konflikt addiert; ein zweiter Start ändert nichts mehr (idempotent).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');
const { spawn } = require('child_process');

const root = path.join(__dirname, '..');
const M = require(path.join(root, 'rarity-migrate'));

test('reine Umschreib-Funktionen', () => {
  const ren = { diamond: 'storm' };
  assert.strictEqual(M.renameInDeckRarities({ main: ['rare', 'super'], heroes: [{ hero: 'rare' }] }, ren), null);
  assert.strictEqual(M.renameInDeckRarities('x', ren), null);
  assert.deepStrictEqual(
    M.renameInDeckRarities({ main: ['diamond', 'common'], potion: ['diamond'], side: [], heroes: [{ hero: 'diamond', ability1: 'rare', ability2: 'diamond' }, {}] }, ren),
    { main: ['storm', 'common'], potion: ['storm'], side: [], heroes: [{ hero: 'storm', ability1: 'rare', ability2: 'storm' }, {}] });
  assert.strictEqual(M.renameInPackCards([{ name: 'A', rarity: 'rare' }], ren), null);
  assert.deepStrictEqual(M.renameInPackCards([{ name: 'A', rarity: 'diamond' }, { name: 'B', rarity: 'umbra' }], ren),
    [{ name: 'A', rarity: 'storm' }, { name: 'B', rarity: 'umbra' }]);
  assert.deepStrictEqual(M.RENAMES, { diamond: 'storm' });
});

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pp-rarity-migration-'));
const dbPath = path.join(tmp, 'old.db');
let proc = null;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); s.on('error', rej); });

async function startServer() {
  const port = await freePort();
  proc = spawn(process.execPath, [path.join(root, 'server.js')], {
    cwd: root, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: String(port), PP_DB_PATH: dbPath, PP_DEMO_RECORD: '0', NODE_ENV: 'test' },
  });
  let log = '';
  await new Promise((resolve, reject) => {
    const to = setTimeout(() => reject(new Error('Server startet nicht:\n' + log.slice(-2000))), 90000);
    const on = (d) => { log += d; if (log.includes('running on')) { clearTimeout(to); resolve(); } };
    proc.stdout.on('data', on); proc.stderr.on('data', on);
    proc.on('exit', (c) => { clearTimeout(to); reject(new Error('Server beendet (' + c + '):\n' + log.slice(-2000))); });
  });
  return log;
}
async function stopServer() { if (proc) { const p = proc; proc = null; p.removeAllListeners('exit'); p.kill('SIGKILL'); await sleep(300); } }

async function dbx(stmt) {
  for (let i = 0; ; i++) {
    const c = require('@libsql/client').createClient({ url: 'file:' + dbPath });
    try { return await c.execute(stmt); }
    catch (e) { if (!/SQLITE_BUSY|locked/i.test(String(e && (e.code || e.message))) || i > 100) throw e; await sleep(30); }
    finally { try { c.close(); } catch { /* ok */ } }
  }
}

const HEROES = JSON.stringify([{ hero: 'Alice', ability1: 'Fighting', ability2: 'Fighting' }, { hero: null, ability1: null, ability2: null }, { hero: null, ability1: null, ability2: null }]);
const DECK_R = { main: ['diamond', 'common', 'super'], potion: [], side: ['diamond'], heroes: [{ hero: 'diamond', ability1: 'common', ability2: 'rare' }, {}, {}] };

test.after(async () => { await stopServer(); try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* ok */ } });

test('Alt-Datenbank mit Diamond-Zeilen wird beim Start zu Storm, zweiter Start ändert nichts', async () => {
  // Datenbank VOR dem Start mit dem alten Stand anlegen
  const { createClient } = require('@libsql/client');
  const c = createClient({ url: 'file:' + dbPath });
  await c.execute('PRAGMA journal_mode = WAL');
  await c.execute('CREATE TABLE user_card_rarities (user_id TEXT NOT NULL, card TEXT NOT NULL, rarity TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (user_id, card, rarity))');
  const ins = (u, card, r, n) => c.execute({ sql: 'INSERT INTO user_card_rarities (user_id, card, rarity, count) VALUES (?, ?, ?, ?)', args: [u, card, r, n] });
  await ins('u1', 'Alice', 'diamond', 2);
  await ins('u1', 'Alice', 'storm', 1);          // Konflikt: Zähler werden addiert (2 + 1)
  await ins('u1', 'Alice', 'rare', 4);
  await ins('u2', 'Pyroblast', 'diamond', 3);    // kein Konflikt
  await c.execute('CREATE TABLE decks (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL, main_deck TEXT DEFAULT \'[]\', heroes TEXT, potion_deck TEXT DEFAULT \'[]\', side_deck TEXT DEFAULT \'[]\', is_default INTEGER DEFAULT 0, rarities TEXT DEFAULT \'{}\', created_at INTEGER DEFAULT (unixepoch()), updated_at INTEGER DEFAULT (unixepoch()))');
  const deck = (id, r) => c.execute({ sql: 'INSERT INTO decks (id, user_id, name, main_deck, heroes, side_deck, rarities) VALUES (?, ?, ?, ?, ?, ?, ?)', args: [id, 'u1', id, JSON.stringify(['Fireball', 'Ice', 'Fireball']), HEROES, JSON.stringify(['Ice']), r] });
  await deck('deck-d', JSON.stringify(DECK_R));
  await deck('deck-plain', JSON.stringify({ main: ['rare', 'common', 'common'], heroes: [{ hero: 'rare' }, {}, {}] }));
  await deck('deck-broken', '{kaputt "diamond"');
  await deck('deck-empty', '{}');
  await c.execute('CREATE TABLE pending_booster (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, pack_id TEXT NOT NULL, variant_id TEXT NOT NULL, cards_json TEXT NOT NULL, created_at INTEGER DEFAULT (unixepoch()))');
  await c.execute({ sql: 'INSERT INTO pending_booster (id, user_id, pack_id, variant_id, cards_json) VALUES (?, ?, ?, ?, ?)', args: ['p1', 'u3', 'hero', 'hero-1',
    JSON.stringify([{ name: 'Alice', rarity: 'uncommon' }, { name: 'Pyroblast', rarity: 'diamond' }, { name: 'Ice', rarity: 'umbra' }])] });
  c.close();

  const check = async () => {
    const coll = (await dbx('SELECT user_id, card, rarity, count FROM user_card_rarities ORDER BY user_id, card, rarity')).rows.map(r => [r.user_id, r.card, r.rarity, Number(r.count)]);
    assert.deepStrictEqual(coll, [['u1', 'Alice', 'rare', 4], ['u1', 'Alice', 'storm', 3], ['u2', 'Pyroblast', 'storm', 3]]);
    const rar = async (id) => (await dbx({ sql: 'SELECT rarities FROM decks WHERE id = ?', args: [id] })).rows[0].rarities;
    assert.deepStrictEqual(JSON.parse(await rar('deck-d')), { main: ['storm', 'common', 'super'], potion: [], side: ['storm'], heroes: [{ hero: 'storm', ability1: 'common', ability2: 'rare' }, {}, {}] });
    assert.deepStrictEqual(JSON.parse(await rar('deck-plain')), { main: ['rare', 'common', 'common'], heroes: [{ hero: 'rare' }, {}, {}] });
    assert.strictEqual(await rar('deck-broken'), '{kaputt "diamond"');   // kaputtes JSON bleibt unberührt, kein Absturz
    assert.strictEqual(await rar('deck-empty'), '{}');
    const pk = JSON.parse((await dbx("SELECT cards_json FROM pending_booster WHERE id = 'p1'")).rows[0].cards_json);
    assert.deepStrictEqual(pk, [{ name: 'Alice', rarity: 'uncommon' }, { name: 'Pyroblast', rarity: 'storm' }, { name: 'Ice', rarity: 'umbra' }]);
    const left = (await dbx("SELECT (SELECT COUNT(*) FROM user_card_rarities WHERE rarity = 'diamond') + (SELECT COUNT(*) FROM pending_booster WHERE cards_json LIKE '%\"diamond\"%') AS n")).rows[0].n;
    assert.strictEqual(Number(left), 0);
  };

  const log1 = await startServer();
  assert.ok(/\[rarity\] Umbenennung Diamond → Storm: Sammlung 2, Decks 1, offene Packs 1/.test(log1), log1.slice(0, 1500));
  await stopServer();
  await check();
  const log2 = await startServer();
  assert.ok(!/Umbenennung Diamond/.test(log2), 'zweiter Start findet nichts mehr umzuschreiben');
  await stopServer();
  await check();
});
