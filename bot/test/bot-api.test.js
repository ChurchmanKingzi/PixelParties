'use strict';
// Integrationstest der Spielserver-Seite (bot-api.js): echter Express-Server, SQLite im Speicher.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const root = path.resolve(__dirname, '..', '..');
const express = require(path.join(root, 'node_modules', 'express'));
const { createClient } = require(path.join(root, 'node_modules', '@libsql', 'client'));

process.env.BOT_SECRET = 'test-secret';
const botApi = require(path.join(root, 'bot-api.js'));

async function setup() {
  const client = createClient({ url: ':memory:' });
  const db = {
    execute: (s, a) => client.execute({ sql: s, args: a || [] }),
    run: async (s, a = []) => { const r = await client.execute({ sql: s, args: a }); return { rowsAffected: r.rowsAffected }; },
    get: async (s, a = []) => (await client.execute({ sql: s, args: a })).rows[0],
    all: async (s, a = []) => (await client.execute({ sql: s, args: a })).rows,
  };
  await db.execute(`CREATE TABLE users (id TEXT PRIMARY KEY, username TEXT, elo INTEGER DEFAULT 1000, color TEXT, avatar TEXT, sc INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0, losses INTEGER DEFAULT 0, ranked_games INTEGER DEFAULT 0, created_at INTEGER DEFAULT 0, is_guest INTEGER DEFAULT 0,
    daily_heroes TEXT, daily_start_ts INTEGER DEFAULT 0, daily_claimed_big INTEGER DEFAULT 0)`);
  await db.execute('CREATE TABLE user_shop_items (id TEXT PRIMARY KEY, user_id TEXT, item_type TEXT, item_id TEXT)');
  await db.execute('CREATE TABLE sc_log (id TEXT PRIMARY KEY, user_id TEXT, reward_id TEXT, opponent_id TEXT, opponent_ip TEXT, amount INTEGER, created_at INTEGER DEFAULT 0)');
  await db.execute('CREATE TABLE decks (id TEXT, user_id TEXT, name TEXT, main_deck TEXT, heroes TEXT, potion_deck TEXT, side_deck TEXT, cover_card TEXT, updated_at INTEGER)');
  await botApi.ensureSchema(db);
  await botApi.ensureSchema(db);   // idempotent
  await db.run("INSERT INTO users (id, username, elo, sc, wins, losses, ranked_games) VALUES ('u1','Alice',1500,40,3,1,4)");
  await db.run("INSERT INTO users (id, username, is_guest) VALUES ('u2','Gast',1)");
  for (let i = 0; i < 52; i++) await db.run("INSERT INTO user_shop_items VALUES (?, 'u1', 'skin', ?)", ['s' + i, 'skin' + i]);

  const app = express();
  app.use(express.json());
  // Anmeldung nachgebaut: Header x-user bestimmt den Spieler.
  const authMiddleware = (req, res, next) => { const u = req.headers['x-user']; if (!u) return res.status(401).json({ error: 'no' }); req.user = { userId: u }; next(); };
  const daily = { heroes: ['A', 'B', 'C'], startTs: 1, expiresTs: 2, claimedBig: 0 };
  botApi.mount({ app, db, authMiddleware, getActiveDaily: u => (u.id === 'u1' ? daily : null),
    nextNoonCETAfter: () => 99, mostRecentNoonCETSec: () => 11, uuidv4: () => Math.random().toString(36).slice(2) });
  const server = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  const base = 'http://127.0.0.1:' + server.address().port;
  const call = async (method, p, { body, headers } = {}) => {
    const res = await fetch(base + p, { method, headers: { 'content-type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, json: await res.json().catch(() => null) };
  };
  return { db, server, call };
}
const bot = { 'x-bot-secret': 'test-secret' };

test('Verknüpfung per Einmalcode, Rollenabgleich-Daten, SC-Buchung, Daily', async (t) => {
  const { db, server, call } = await setup();
  t.after(() => server.close());

  // Gäste dürfen nicht verknüpfen, ohne Anmeldung auch nicht
  assert.equal((await call('POST', '/api/discord/link-code')).status, 401);
  assert.equal((await call('POST', '/api/discord/link-code', { headers: { 'x-user': 'u2' } })).status, 403);

  const { json: { code } } = await call('POST', '/api/discord/link-code', { headers: { 'x-user': 'u1' } });
  assert.match(code, /^[A-HJ-NP-Z2-9]{8}$/);

  // falscher Code / ohne Secret / über Proxy
  assert.equal((await call('POST', '/api/bot/link', { headers: bot, body: { code: 'WRONG123', discordId: '111111111111111111' } })).status, 404);
  assert.equal((await call('POST', '/api/bot/link', { body: { code, discordId: '111111111111111111' } })).status, 403);
  assert.equal((await call('POST', '/api/bot/link', { headers: { ...bot, 'x-forwarded-for': '1.2.3.4' }, body: { code, discordId: '111111111111111111' } })).status, 403);

  const ok = await call('POST', '/api/bot/link', { headers: bot, body: { code: code.toLowerCase(), discordId: '111111111111111111' } });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.user.username, 'Alice');
  assert.equal(ok.json.user.skins, 52);
  // Code ist verbraucht
  assert.equal((await call('POST', '/api/bot/link', { headers: bot, body: { code, discordId: '222222222222222222' } })).status, 404);
  // schon verknüpftes Konto bekommt keinen neuen Code
  assert.equal((await call('POST', '/api/discord/link-code', { headers: { 'x-user': 'u1' } })).status, 409);

  // dieselbe Discord-ID nicht für zweites Konto
  await db.run("INSERT INTO users (id, username) VALUES ('u3','Bob')");
  const c3 = (await call('POST', '/api/discord/link-code', { headers: { 'x-user': 'u3' } })).json.code;
  assert.equal((await call('POST', '/api/bot/link', { headers: bot, body: { code: c3, discordId: '111111111111111111' } })).json.error, 'discord_already_linked');

  const u = await call('GET', '/api/bot/user/111111111111111111', { headers: bot });
  assert.equal(u.json.user.elo, 1500);
  assert.equal((await call('GET', '/api/bot/user/999', { headers: bot })).status, 404);
  assert.equal(Object.hasOwn(u.json.user, 'password_hash'), false);

  const linked = await call('GET', '/api/bot/linked', { headers: bot });
  assert.equal(linked.json.users.length, 1);
  assert.equal(linked.json.users[0].leaderboardRank, 1);

  const d = await call('GET', '/api/bot/daily/111111111111111111', { headers: bot });
  assert.deepEqual(d.json.heroes, ['A', 'B', 'C']);

  // SC: erhöhen, senken, nie unter 0
  const add = await call('POST', '/api/bot/sc', { headers: bot, body: { discordId: '111111111111111111', delta: 25, adminDiscordId: '5' } });
  assert.equal(add.json.after, 65);
  const sub = await call('POST', '/api/bot/sc', { headers: bot, body: { discordId: '111111111111111111', delta: -1000 } });
  assert.equal(sub.json.after, 0);
  assert.equal(sub.json.applied, -65);
  assert.equal((await call('POST', '/api/bot/sc', { headers: bot, body: { discordId: '111111111111111111', delta: 1.5 } })).status, 400);
  assert.equal((await call('POST', '/api/bot/sc', { headers: bot, body: { discordId: '111111111111111111', delta: 0 } })).status, 400);
  assert.equal((await call('POST', '/api/bot/sc', { headers: bot, body: { discordId: '333', delta: 5 } })).status, 404);
  assert.equal((await db.all("SELECT * FROM sc_log WHERE reward_id = 'admin:discord'")).length, 2);

  // Unverknüpfen durch den Spieler
  assert.equal((await call('POST', '/api/discord/unlink', { headers: { 'x-user': 'u1' } })).json.linked, false);
  assert.equal((await call('GET', '/api/bot/user/111111111111111111', { headers: bot })).status, 404);
});

test('ohne BOT_SECRET sind die Bot-Routen aus', async () => {
  const saved = process.env.BOT_SECRET;
  delete process.env.BOT_SECRET;
  delete require.cache[require.resolve(path.join(root, 'bot-api.js'))];
  const fresh = require(path.join(root, 'bot-api.js'));
  const app = express(); app.use(express.json());
  fresh.mount({ app, db: {}, authMiddleware: (q, r, n) => n(), getActiveDaily: () => null, nextNoonCETAfter: () => 0, mostRecentNoonCETSec: () => 0, uuidv4: () => 'x' });
  const server = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  try {
    const res = await fetch('http://127.0.0.1:' + server.address().port + '/api/bot/linked', { headers: { 'x-bot-secret': 'anything' } });
    assert.equal(res.status, 404);
  } finally { server.close(); process.env.BOT_SECRET = saved; }
});

test('Daily per Discord starten: würfelt nach den Spielregeln, gilt im Spiel, läuft schon eine → unverändert, atomar', async () => {
  const { db, server, call } = await (async () => {
    const client = createClient({ url: ':memory:' });
    const db = {
      execute: (s, a) => client.execute({ sql: s, args: a || [] }),
      run: async (s, a = []) => { const r = await client.execute({ sql: s, args: a }); return { rowsAffected: r.rowsAffected }; },
      get: async (s, a = []) => (await client.execute({ sql: s, args: a })).rows[0],
      all: async (s, a = []) => (await client.execute({ sql: s, args: a })).rows,
    };
    await db.execute(`CREATE TABLE users (id TEXT PRIMARY KEY, username TEXT, elo INTEGER DEFAULT 1000, color TEXT, avatar TEXT, sc INTEGER DEFAULT 0,
      wins INTEGER DEFAULT 0, losses INTEGER DEFAULT 0, ranked_games INTEGER DEFAULT 0, created_at INTEGER DEFAULT 0, is_guest INTEGER DEFAULT 0,
      daily_heroes TEXT, daily_start_ts INTEGER DEFAULT 0, daily_claimed_big INTEGER DEFAULT 0)`);
    await db.execute('CREATE TABLE user_shop_items (id TEXT PRIMARY KEY, user_id TEXT, item_type TEXT, item_id TEXT)');
    await botApi.ensureSchema(db);
    await db.run("INSERT INTO users (id, username, discord_id) VALUES ('u1','Alice','111111111111111111')");
    const app = express(); app.use(express.json());
    let rolls = 0;
    // wie im Spiel: aktiv, wenn gestartet und innerhalb von 24 h
    const getActiveDaily = u => (u.daily_start_ts && Date.now() / 1000 - u.daily_start_ts < 86400 ? { heroes: JSON.parse(u.daily_heroes), startTs: u.daily_start_ts, expiresTs: u.daily_start_ts + 86400, claimedBig: 0 } : null);
    botApi.mount({ app, db, authMiddleware: (q, r, n) => n(), getActiveDaily, rollDailyHeroes: () => ['H' + (++rolls) + 'a', 'H' + rolls + 'b', 'H' + rolls + 'c'],
      nextNoonCETAfter: () => 99, mostRecentNoonCETSec: () => 11, uuidv4: () => 'x' });
    const server = await new Promise(r => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
    const base = 'http://127.0.0.1:' + server.address().port;
    const call = async (method, p, { headers } = {}) => {
      const res = await fetch(base + p, { method, headers: { 'content-type': 'application/json', ...headers } });
      return { status: res.status, json: await res.json().catch(() => null) };
    };
    return { db, server, call };
  })();
  try {
    const id = '111111111111111111';
    assert.equal((await call('GET', '/api/bot/daily/' + id, { headers: bot })).json.active, false);
    assert.equal((await call('POST', '/api/bot/daily/' + id + '/start')).status, 403, 'ohne Secret');
    assert.equal((await call('POST', '/api/bot/daily/999/start', { headers: bot })).status, 404);

    const first = await call('POST', '/api/bot/daily/' + id + '/start', { headers: bot });
    assert.equal(first.status, 200);
    assert.equal(first.json.created, true);
    assert.deepEqual(first.json.heroes, ['H1a', 'H1b', 'H1c']);
    const row = await db.get("SELECT daily_heroes, daily_start_ts, daily_claimed_big FROM users WHERE id = 'u1'");
    assert.deepEqual(JSON.parse(row.daily_heroes), ['H1a', 'H1b', 'H1c'], 'am Spielerkonto gespeichert → gilt im Spiel');
    assert.ok(row.daily_start_ts > 0 && row.daily_claimed_big === 0);

    const again = await call('POST', '/api/bot/daily/' + id + '/start', { headers: bot });
    assert.equal(again.json.created, false);
    assert.deepEqual(again.json.heroes, ['H1a', 'H1b', 'H1c'], 'läuft schon → unverändert');
    assert.deepEqual((await call('GET', '/api/bot/daily/' + id, { headers: bot })).json.heroes, ['H1a', 'H1b', 'H1c']);

    // abgelaufen (älter als 24 h) → neu würfeln; zwei gleichzeitige Starts → genau EINE Challenge
    await db.run("UPDATE users SET daily_start_ts = ? WHERE id = 'u1'", [Math.floor(Date.now() / 1000) - 90000]);
    const [a, b] = await Promise.all([call('POST', '/api/bot/daily/' + id + '/start', { headers: bot }), call('POST', '/api/bot/daily/' + id + '/start', { headers: bot })]);
    assert.equal([a, b].filter(x => x.json.created).length, 1);
    assert.deepEqual(a.json.heroes, b.json.heroes, 'beide sehen dieselbe Challenge');
  } finally { server.close(); }
});
