'use strict';
// Booster-Shop: Auslage (Stunden-Rotation, Kauf), „Sell Back!“ und „Add and rip one more!“ — reine Logik (rarities.js) und die Server-Routen
// (eigener Server auf freiem Port mit Wegwerf-Datenbank).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');
const { spawn } = require('child_process');
const R = require('../rarities');

const root = path.join(__dirname, '..');
const cards = JSON.parse(fs.readFileSync(path.join(root, 'data', 'cards.json'), 'utf8'));
const art = JSON.parse(fs.readFileSync(path.join(root, 'data', 'card-art', 'index.json'), 'utf8'));
const masks = new Set(Object.keys(JSON.parse(fs.readFileSync(path.join(root, 'data', 'subject-masks.json'), 'utf8')).cards));
const hasMask = (n) => masks.has(n);
const pool = (() => {
  const seen = new Set();
  for (const id of R.PACK_IDS) for (const c of R.cardsOfPack(id, cards, art)) seen.add(c.name);
  return [...seen];
})();

// ── Reine Logik ──────────────────────────────────────────────
test('Auslage: ein Platz je Rarity der Preistabelle (Zahl der Plätze folgt der Rarity-Liste)', () => {
  assert.deepStrictEqual(R.DISPLAY_RARITIES, ['uncommon', 'rare', 'prismatic', 'super', 'storm', 'spectral', 'stained', 'umbra']);
  assert.deepStrictEqual(R.DISPLAY_PRICE, { uncommon: 2, rare: 4, prismatic: 8, super: 20, storm: 30, spectral: 40, stained: 70, umbra: 100 });
  assert.deepStrictEqual(R.SELLBACK, { uncommon: 1, rare: 2, prismatic: 4, super: 6, storm: 8, spectral: 10, stained: 14, umbra: 18 });
  for (const id of R.DISPLAY_RARITIES) { assert.ok(R.isRarity(id) && id !== 'common'); assert.ok(R.SELLBACK[id] > 0); }
  assert.strictEqual(R.sellbackValue('common'), 0);
  assert.strictEqual(R.sellbackValue('nonsense'), 0);
});

test('Auslage: Stundenindex wechselt bei :00 UTC, Countdown stimmt', () => {
  const h0 = Date.UTC(2026, 10, 9, 13, 0, 0, 0);
  assert.strictEqual(R.displayHourIndex(h0 - 1), R.displayHourIndex(h0) - 1);
  assert.strictEqual(R.displayHourIndex(h0), R.displayHourIndex(h0 + 3599999));
  assert.strictEqual(R.displayHourIndex(h0 + 3600000), R.displayHourIndex(h0) + 1);
  assert.strictEqual(R.msToNextHour(h0), 3600000);
  assert.strictEqual(R.msToNextHour(h0 + 1), 3599999);
  assert.strictEqual(R.msToNextHour(h0 + 3599999), 1);
  assert.strictEqual(R.displayHourIndex(h0) * R.HOUR_MS, h0);
});

test('Auslage: deterministisch, ohne Dubletten, nur gültige Karten, Umbra/Stained nur mit Maske', () => {
  const base = R.displayHourIndex(Date.UTC(2026, 10, 9, 0, 0, 0));
  const poolSet = new Set(pool);
  const seenSets = new Set();
  for (let k = 0; k < 600; k++) {
    const d = R.rollDisplay(base + k, pool, hasMask);
    assert.strictEqual(d.length, R.DISPLAY_RARITIES.length + 1, 'neun Plätze');
    assert.deepStrictEqual(d.slice(0, 8).map(c => c.rarity), R.DISPLAY_RARITIES, 'eine Karte je Rarity, in Reihenfolge');
    assert.ok(d.slice(0, 8).every(c => !c.special && c.price === R.DISPLAY_PRICE[c.rarity]));
    const sp = d[8];
    assert.strictEqual(sp.special, true, 'neunter Platz = Sonderangebot');
    assert.ok(R.DISPLAY_RARITIES.includes(sp.rarity));
    assert.strictEqual(sp.fullPrice, R.DISPLAY_PRICE[sp.rarity]);
    assert.strictEqual(sp.price, Math.ceil(R.DISPLAY_PRICE[sp.rarity] / 2), 'halber Preis, aufgerundet');
    assert.strictEqual(sp.price, R.specialPrice(sp.rarity));
    const names = d.map(c => c.name);
    assert.strictEqual(new Set(names).size, names.length, 'Dublette in Stunde ' + (base + k) + ': ' + names);
    for (const c of d) {
      assert.ok(poolSet.has(c.name), c.name + ' nicht im Pool');
      assert.strictEqual(c.price, c.special ? Math.ceil(R.DISPLAY_PRICE[c.rarity] / 2) : R.DISPLAY_PRICE[c.rarity]);
      if (R.NEEDS_MASK[c.rarity]) assert.ok(masks.has(c.name), c.name + ' hat keine Maske für ' + c.rarity);
    }
    // gleiche Stunde + gleicher Pool (auch in anderer Reihenfolge) = gleiche Auslage
    assert.deepStrictEqual(R.rollDisplay(base + k, pool.slice().reverse(), hasMask), d);
    seenSets.add(names.join('|'));
  }
  assert.ok(seenSets.size > 590, 'die Auslage wechselt von Stunde zu Stunde (' + seenSets.size + ' verschiedene in 600)');
});

test('Auslage: jede Rarity zieht quer über die Stunden aus dem ganzen Pool (kein Ausreißer-Bias)', () => {
  const base = R.displayHourIndex(Date.UTC(2026, 0, 1));
  const per = {};
  for (let k = 0; k < 2000; k++) for (const c of R.rollDisplay(base + k, pool, hasMask)) (per[c.rarity] || (per[c.rarity] = new Set())).add(c.name);
  assert.ok(per.uncommon.size > 800, 'Uncommon streut breit: ' + per.uncommon.size);
  assert.ok(per.stained.size > 300, 'Stained streut breit: ' + per.stained.size);
});

test('Sonderangebot: Preis = halber Normalpreis aufgerundet; die Rarity wechselt von Stunde zu Stunde und trifft alle acht', () => {
  assert.deepStrictEqual(R.DISPLAY_RARITIES.map(r => R.specialPrice(r)), [1, 2, 4, 10, 15, 20, 35, 50]);
  const base = R.displayHourIndex(Date.UTC(2026, 0, 1)), seen = {};
  for (let k = 0; k < 800; k++) { const sp = R.rollDisplay(base + k, pool, hasMask)[8]; seen[sp.rarity] = (seen[sp.rarity] || 0) + 1; }
  assert.deepStrictEqual(Object.keys(seen).sort(), R.DISPLAY_RARITIES.slice().sort(), 'jede Rarity kommt als Sonderangebot vor');
  for (const r of R.DISPLAY_RARITIES) assert.ok(seen[r] > 40, r + ' zu selten: ' + seen[r]);
  // das Sonderangebot ändert die acht regulären Plätze nicht
  const d = R.rollDisplay(base, pool, hasMask);
  assert.deepStrictEqual(d.slice(0, 8).map(c => c.name), R.rollDisplay(base, pool, hasMask).slice(0, 8).map(c => c.name));
});

test('Auslage: kleiner Pool — Plätze ohne Karte entfallen, keine Dubletten, Masken-Pflicht gilt weiter', () => {
  const small = ['A', 'B', 'C'];
  const d = R.rollDisplay(5, small, (n) => n === 'C');
  const names = d.map(c => c.name);
  assert.strictEqual(new Set(names).size, names.length);
  assert.ok(d.length <= 3);
  // nur C hat eine Maske: Umbra/Stained zusammen höchstens eine Karte
  assert.ok(d.filter(c => R.NEEDS_MASK[c.rarity]).every(c => c.name === 'C'));
  assert.ok(d.filter(c => R.NEEDS_MASK[c.rarity]).length <= 1);
  assert.deepStrictEqual(R.rollDisplay(5, [], hasMask), []);
});

// ── Server ───────────────────────────────────────────────────
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pp-booster-shop-'));
const dbPath = path.join(tmp, 'test.db');
let proc = null, port = 0, B = '', dbc = null, srvLog = '';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Der Server schreibt auch nach seiner Antwort noch kurz (Gast-Anlage); SQLite kennt hier keine Wartezeit → bei BUSY einfach nochmal.
async function dbx(stmt) {
  for (let i = 0; ; i++) {
    const c = require('@libsql/client').createClient({ url: 'file:' + dbPath });   // je Aufruf eine frische Verbindung (und danach zu): offene Leser würden den Server blockieren
    try { return await c.execute(stmt); }
    catch (e) { if (!/SQLITE_BUSY|locked/i.test(String(e && (e.code || e.message))) || i > 100) throw e; await sleep(30); }
    finally { try { c.close(); } catch { /* ok */ } }
  }
}

async function freePort() {
  return new Promise((res, rej) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); s.on('error', rej); });
}

async function startServer() {
  const { createClient } = require('@libsql/client');
  // Datenbank VOR dem Start mit dem ALTEN Schema des offenen Packs (ohne sold_idx) anlegen: die Migration muss die Spalte nachziehen.
  dbc = createClient({ url: 'file:' + dbPath });
  await dbc.execute('PRAGMA journal_mode = WAL');   // zwei Prozesse (Server + Test) an einer Datei: Leser sperren Schreiber nicht
  await dbc.execute(`CREATE TABLE pending_booster (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, pack_id TEXT NOT NULL, variant_id TEXT NOT NULL, cards_json TEXT NOT NULL, created_at INTEGER DEFAULT (unixepoch()))`);
  await dbc.execute({ sql: 'INSERT INTO pending_booster (id, user_id, pack_id, variant_id, cards_json) VALUES (?, ?, ?, ?, ?)', args: ['legacy', 'legacy-user', 'hero', 'hero-1', JSON.stringify([{ name: 'Alice', rarity: 'rare' }])] });
  dbc.close(); dbc = null;   // ab hier öffnet nur noch dbx() kurzlebige Verbindungen
  port = await freePort();
  B = 'http://127.0.0.1:' + port + '/api';
  proc = spawn(process.execPath, [path.join(root, 'server.js')], {
    cwd: root, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: String(port), PP_DB_PATH: dbPath, PP_DEMO_RECORD: '0', NODE_ENV: 'test' },
  });
  let log = '';
  await new Promise((resolve, reject) => {
    const to = setTimeout(() => reject(new Error('Server startet nicht:\n' + log.slice(-2000))), 90000);
    const on = (d) => { log += d; srvLog = log; if (log.includes('running on')) { clearTimeout(to); resolve(); } };
    proc.stdout.on('data', on); proc.stderr.on('data', on);
    proc.on('exit', (c) => { clearTimeout(to); reject(new Error('Server beendet (' + c + '):\n' + log.slice(-2000))); });
  });
}

async function guest() {
  let g = null;
  for (let i = 0; i < 20 && !(g && g.token); i++) {   // der Server schreibt kurz nach der Antwort weiter → bei BUSY einfach nochmal
    g = await (await fetch(B + '/auth/guest', { method: 'POST' })).json();
    if (!g.token) await sleep(100);
  }
  assert.ok(g && g.token, 'Gast-Login: ' + JSON.stringify(g) + '\n' + srvLog.slice(-600));
  await sleep(150);   // der Server legt nach der Antwort noch Start-Daten an: nicht dazwischenschreiben
  const H = { 'Content-Type': 'application/json', 'x-auth-token': g.token };
  const api = async (method, p, body) => {
    const r = await fetch(B + p, { method, headers: H, body: body === undefined ? undefined : JSON.stringify(body) });
    let data = null; try { data = await r.json(); } catch { /* leer */ }
    return { status: r.status, data: data || {} };
  };
  const id = g.user.id;
  const setSc = (n) => dbx({ sql: 'UPDATE users SET sc = ? WHERE id = ?', args: [n, id] });
  const sc = async () => Number((await dbx({ sql: 'SELECT sc FROM users WHERE id = ?', args: [id] })).rows[0].sc);
  const log = async (reason) => (await dbx({ sql: 'SELECT amount, opponent_id FROM sc_log WHERE user_id = ? AND reward_id = ? ORDER BY created_at, rowid', args: [id, reason] })).rows.map(r => ({ amount: Number(r.amount), opponent_id: r.opponent_id }));
  const owned = async () => (await api('GET', '/collection')).data.rarities || {};
  const seedPending = async (packId, list, soldIdx) => {
    await dbx({ sql: 'DELETE FROM pending_booster WHERE user_id = ?', args: [id] });
    const pid = 'p' + Math.random().toString(36).slice(2);
    await dbx({ sql: 'INSERT INTO pending_booster (id, user_id, pack_id, variant_id, cards_json, sold_idx) VALUES (?, ?, ?, ?, ?, ?)', args: [pid, id, packId, packId + '-1', JSON.stringify(list), soldIdx == null ? -1 : soldIdx] });
    return pid;
  };
  return { id, api, setSc, sc, log, owned, seedPending };
}

const total = (own) => Object.values(own).reduce((a, o) => a + Object.values(o).reduce((x, y) => x + y, 0), 0);
const nineCards = (over) => {
  const base = ['Alice', 'Bifab, Bridge to Coolness', 'Pyroblast', 'Trade', 'Alchemy', 'Archer', 'Splashy Slime', 'Elixir of Immortality', 'Shard of Chaos'];
  const rar = ['uncommon', 'uncommon', 'rare', 'rare', 'prismatic', 'super', 'storm', 'spectral', 'umbra'];
  return base.map((name, i) => ({ name, rarity: (over && over[i]) || rar[i] }));
};

test.before(async () => { await startServer(); }, { timeout: 100000 });
test.after(async () => {
  if (proc) { proc.kill('SIGKILL'); await sleep(200); }

  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* ok */ }
});

test('Migration: altes pending_booster bekommt sold_idx = -1, GET /pending liefert sold', async () => {
  const col = (await dbx("SELECT name FROM pragma_table_info('pending_booster')")).rows.map(r => r.name);
  assert.ok(col.includes('sold_idx'));
  const old = (await dbx("SELECT sold_idx FROM pending_booster WHERE id = 'legacy'")).rows[0];
  assert.strictEqual(Number(old.sold_idx), -1);
  const u = await guest();
  await dbx({ sql: "UPDATE pending_booster SET user_id = ? WHERE id = 'legacy'", args: [u.id] });
  const p = await u.api('GET', '/boosters/pending');
  assert.strictEqual(p.status, 200);
  assert.strictEqual(p.data.pending.id, 'legacy');
  assert.strictEqual(p.data.pending.sold, -1);
});

test('GET /api/boosters nennt Preis und Rückkaufwerte', async () => {
  const u = await guest();
  const r = await u.api('GET', '/boosters');
  assert.strictEqual(r.data.price, 20);
  assert.deepStrictEqual(r.data.sellback, R.SELLBACK);
});

test('Auslage: GET liefert acht Karten der aktuellen Stunde mit Countdown', async () => {
  const u = await guest();
  const before = Date.now();
  const r = await u.api('GET', '/boosters/display');
  assert.strictEqual(r.status, 200);
  const d = r.data;
  assert.strictEqual(d.cards.length, 9);
  assert.deepStrictEqual(d.cards.slice(0, 8).map(c => c.rarity), R.DISPLAY_RARITIES);
  assert.strictEqual(d.cards[8].special, true);
  assert.strictEqual(d.cards[8].price, Math.ceil(d.cards[8].fullPrice / 2));
  assert.ok(d.msLeft > 0 && d.msLeft <= 3600000);
  assert.strictEqual(d.nextAt, (d.hour + 1) * 3600000);
  assert.ok(Math.abs(d.serverTime - before) < 5000);
  // Server und reine Logik würfeln dasselbe (Pool = alle Pack-Pools)
  const expect = R.rollDisplay(d.hour, pool, hasMask);
  assert.deepStrictEqual(d.cards.map(c => [c.rarity, c.name, c.price]), expect.map(c => [c.rarity, c.name, c.price]));
  assert.deepStrictEqual(d.cards.map(c => !!c.special), expect.map(c => !!c.special));
  assert.ok(d.cards.every(c => c.owned === 0));
  assert.strictEqual(new Set(d.cards.map(c => c.name)).size, d.cards.length);
});

test('Auslage kaufen: zu wenig SC → 402 ohne Buchung; genug → SC ab, Rarity in der Sammlung, je Platz und Stunde nur einmal', async () => {
  const u = await guest();
  const d0 = (await u.api('GET', '/boosters/display')).data;
  const slot = (r) => d0.cards.find(c => c.rarity === r);
  await u.setSc(1);
  let r = await u.api('POST', '/boosters/display/buy', { rarity: 'uncommon', hour: d0.hour, name: slot('uncommon').name });
  assert.strictEqual(r.status, 402);
  assert.strictEqual(r.data.sc, 1);
  assert.strictEqual(await u.sc(), 1);
  assert.deepStrictEqual(await u.owned(), {});

  await u.setSc(500);
  // Rand der Stunde: ändert sich die Stunde zwischen Abfrage und Kauf, gilt der Kauf nicht (409) — dann neu abfragen
  let d = d0;
  const buy = async (rarity) => {
    let res = await u.api('POST', '/boosters/display/buy', { rarity, hour: d.hour, name: d.cards.find(c => c.rarity === rarity).name });
    if (res.status === 409) { d = res.data.display; res = await u.api('POST', '/boosters/display/buy', { rarity, hour: d.hour, name: d.cards.find(c => c.rarity === rarity).name }); }
    return res;
  };
  r = await buy('uncommon');
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.data.card.rarity, 'uncommon');
  assert.strictEqual(r.data.card.price, 2);
  assert.strictEqual(r.data.sc, 498);
  assert.strictEqual(r.data.owned, 1);
  assert.strictEqual(await u.sc(), 498);
  const name = r.data.card.name;
  assert.strictEqual((await u.owned())[name].uncommon, 1);

  // derselbe Platz nochmal: 409 „schon gekauft“, nichts gebucht (läuft die Stunde genau jetzt ab, ist es eine neue Auslage: dann Test unverbindlich)
  r = await u.api('POST', '/boosters/display/buy', { rarity: 'uncommon', hour: d.hour, name });
  if (r.status === 409 && r.data.display.hour === d.hour) {
    assert.ok(/already bought/i.test(r.data.error), r.data.error);
    assert.deepStrictEqual(r.data.display.bought, [0]);
    assert.strictEqual(await u.sc(), 498);
    assert.strictEqual((await u.owned())[name].uncommon, 1);
  }
  d = (await u.api('GET', '/boosters/display')).data;
  assert.ok(Array.isArray(d.bought));

  const before = await u.sc();
  r = await buy('umbra');
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.data.card.price, 100);
  assert.strictEqual(await u.sc(), before - 100);
  assert.ok(masks.has(r.data.card.name), 'Umbra trägt eine Maske');
  assert.strictEqual((await u.owned())[r.data.card.name].umbra, 1);

  const lg = await u.log('shop:display');
  assert.deepStrictEqual(lg.map(l => l.amount), [-2, -100]);
  assert.ok(lg[0].opponent_id.startsWith('uncommon:'));
});

test('Auslage kaufen: falsche Stunde / falscher Name → 409 mit aktueller Auslage, nichts gebucht; unbekannte Rarity → 400', async () => {
  const u = await guest();
  await u.setSc(300);
  const d = (await u.api('GET', '/boosters/display')).data;
  let r = await u.api('POST', '/boosters/display/buy', { rarity: 'rare', hour: d.hour - 1, name: d.cards[1].name });
  assert.strictEqual(r.status, 409);
  assert.ok(r.data.display && r.data.display.cards.length === 9);
  assert.ok(r.data.display.hour >= d.hour);
  assert.strictEqual(await u.sc(), 300);
  r = await u.api('POST', '/boosters/display/buy', { rarity: 'rare', hour: d.hour, name: 'Definitely Not The Card' });
  assert.strictEqual(r.status, 409);
  assert.strictEqual(await u.sc(), 300);
  assert.deepStrictEqual(await u.owned(), {});
  for (const bad of ['common', 'foil', '', undefined]) {
    r = await u.api('POST', '/boosters/display/buy', { rarity: bad });
    assert.strictEqual(r.status, 400, String(bad));
  }
  assert.strictEqual(await u.sc(), 300);
});

test('Sonderangebot kaufen: Slot 8 zum halben Preis, Server prüft Slot, Preis und Rarity; zu wenig SC → 402', async () => {
  const u = await guest();
  let d = (await u.api('GET', '/boosters/display')).data;
  const sp = d.cards[8];
  const send = (b) => u.api('POST', '/boosters/display/buy', { hour: d.hour, ...b });
  await u.setSc(sp.price - 1);
  let r = await send({ slot: 8, name: sp.name, rarity: sp.rarity, special: true, price: sp.price });
  assert.strictEqual(r.status, 402);
  assert.strictEqual(await u.sc(), sp.price - 1);
  await u.setSc(400);
  // falscher Preis (Normalpreis statt halbem), falsche Rarity, Sonderangebot-Flag falsch → 409, nichts gebucht
  for (const bad of [{ price: sp.fullPrice }, { rarity: sp.rarity === 'rare' ? 'super' : 'rare' }, { special: false }, { name: 'Not The Card' }]) {
    r = await send({ slot: 8, name: sp.name, rarity: sp.rarity, special: true, price: sp.price, ...bad });
    assert.strictEqual(r.status, 409, JSON.stringify(bad));
    assert.strictEqual(r.data.display.cards.length, 9);
  }
  assert.strictEqual(await u.sc(), 400);
  assert.deepStrictEqual(await u.owned(), {});
  // Platz außerhalb → 400
  for (const slot of [9, -2, 1.5, 'x']) assert.strictEqual((await send({ slot })).status, 400, String(slot));
  // der Kauf selbst (läuft die Stunde genau jetzt ab, kommt 409 mit neuer Auslage → mit ihr nochmal)
  r = await send({ slot: 8, name: sp.name, rarity: sp.rarity, special: true, price: sp.price });
  if (r.status === 409) { d = r.data.display; const n = d.cards[8]; r = await send({ slot: 8, name: n.name, rarity: n.rarity, special: true, price: n.price }); }
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.data.card.special, true);
  const paid = 400 - r.data.sc;
  assert.strictEqual(paid, Math.ceil(R.DISPLAY_PRICE[r.data.card.rarity] / 2));
  assert.strictEqual(paid, r.data.card.price);
  assert.strictEqual((await u.owned())[r.data.card.name][r.data.card.rarity], 1);
  const lg = await u.log('shop:display');
  assert.deepStrictEqual(lg.map(l => l.amount), [-paid]);
  assert.ok(lg[0].opponent_id.endsWith(':special'));
  // der reguläre Platz derselben Rarity kostet den vollen Preis (wenn es dieselbe Karte nicht gibt: anderer Name, Rarity doppelt möglich)
  const reg = r.data.display.cards.find(c => c.rarity === r.data.card.rarity && !c.special);
  const before = await u.sc();
  const r2 = await u.api('POST', '/boosters/display/buy', { slot: r.data.display.cards.indexOf(reg), hour: r.data.display.hour });
  if (r2.status === 200) { assert.strictEqual(before - r2.data.sc, R.DISPLAY_PRICE[reg.rarity]); assert.notStrictEqual(reg.name, r.data.card.name); }
});

test('Sell Back: Gutschrift je Rarity, nur eine Karte je Pack (409), Zustand überlebt Neuladen, Einlösen überspringt die verkaufte Karte', async () => {
  const u = await guest();
  const list = nineCards();
  for (let idx = 0; idx < list.length; idx++) {
    await u.setSc(0);
    const pid = await u.seedPending('hero', list, null);
    const r = await u.api('POST', '/boosters/sell', { id: pid, index: idx });
    assert.strictEqual(r.status, 200, 'Karte ' + idx);
    assert.strictEqual(r.data.amount, R.SELLBACK[list[idx].rarity]);
    assert.strictEqual(r.data.sc, R.SELLBACK[list[idx].rarity]);
    assert.strictEqual(r.data.sold, idx);
  }
  // ein Pack: erst verkaufen, dann alles weitere abweisen
  await u.setSc(5);
  const pid = await u.seedPending('hero', list, null);
  let r = await u.api('POST', '/boosters/sell', { id: pid, index: 8 });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.data.sc, 5 + 18);
  r = await u.api('POST', '/boosters/sell', { id: pid, index: 8 });         // dieselbe Karte nochmal
  assert.strictEqual(r.status, 409);
  assert.strictEqual(r.data.sold, 8);
  r = await u.api('POST', '/boosters/sell', { id: pid, index: 0 });         // eine andere Karte
  assert.strictEqual(r.status, 409);
  assert.strictEqual(await u.sc(), 23);
  // Persistenz (Neuladen = GET /pending)
  const p = await u.api('GET', '/boosters/pending');
  assert.strictEqual(p.data.pending.sold, 8);
  assert.strictEqual(p.data.pending.cards.length, 9);
  // Fehlerpfade
  r = await u.api('POST', '/boosters/sell', { id: 'nope', index: 1 });
  assert.strictEqual(r.status, 404);
  // Einlösen: die verkaufte Karte (Umbra) fehlt, alle anderen sind da
  const c = await u.api('POST', '/boosters/claim', { id: pid });
  assert.strictEqual(c.status, 200);
  assert.strictEqual(c.data.added.length, 8);
  assert.ok(!c.data.added.some(x => x.rarity === 'umbra'));
  assert.strictEqual(c.data.sold.name, 'Shard of Chaos');
  const own = await u.owned();
  assert.strictEqual(total(own), 8 + 0);   // earlier loop packs were never claimed
  assert.ok(!(own['Shard of Chaos'] && own['Shard of Chaos'].umbra));
  assert.strictEqual(own['Alice'].uncommon, 1);
  // kein offenes Pack mehr: Verkauf → 404
  r = await u.api('POST', '/boosters/sell', { id: pid, index: 0 });
  assert.strictEqual(r.status, 404);
  const lg = await u.log('shop:booster_sellback');
  assert.ok(lg.length >= 10 && lg.every(l => l.amount > 0));
  assert.strictEqual(lg[lg.length - 1].amount, 18);
});

test('Sell Back: Index außerhalb → 400; Gleichzeitigkeit: nur ein Verkauf gewinnt', async () => {
  const u = await guest();
  await u.setSc(0);
  const pid = await u.seedPending('clash', nineCards(), null);
  for (const idx of [-1, 9, 1.5, 'x', null]) {
    const r = await u.api('POST', '/boosters/sell', { id: pid, index: idx });
    assert.strictEqual(r.status, 400, String(idx));
  }
  assert.strictEqual(await u.sc(), 0);
  const rs = await Promise.all([0, 1, 2, 3, 4, 5].map(i => u.api('POST', '/boosters/sell', { id: pid, index: i })));
  const okays = rs.filter(r => r.status === 200);
  assert.strictEqual(okays.length, 1, 'genau ein Verkauf: ' + rs.map(r => r.status));
  assert.ok(rs.filter(r => r.status !== 200).every(r => r.status === 409));
  assert.strictEqual(await u.sc(), okays[0].data.amount);
});

test('Kaufen + Einlösen (bestehende Routen): Pack kostet 20 SC, zweiter Kauf bei offenem Pack → 409, Pack kommt mit sold = -1', async () => {
  const u = await guest();
  await u.setSc(45);
  let r = await u.api('POST', '/boosters/buy', { packId: 'trials' });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.data.sc, 25);
  assert.strictEqual(r.data.pending.cards.length, 9);
  assert.strictEqual(r.data.pending.sold, -1);
  r = await u.api('POST', '/boosters/buy', { packId: 'trials' });
  assert.strictEqual(r.status, 409);
  assert.strictEqual(r.data.pending.sold, -1);
  const pend = (await u.api('GET', '/boosters/pending')).data.pending;
  const c = await u.api('POST', '/boosters/claim', { id: pend.id });
  assert.strictEqual(c.status, 200);
  assert.strictEqual(c.data.added.length, 9);
  assert.strictEqual(c.data.sold, null);
  assert.strictEqual(total(await u.owned()), 9);
  r = await u.api('POST', '/boosters/buy', { packId: 'nonexistent' });
  assert.strictEqual(r.status, 404);
});

test('Add and rip one more: Pack wird eingelöst und ein Pack DERSELBEN Art gekauft (SC −20, sold = -1)', async () => {
  const u = await guest();
  await u.setSc(20);
  const pid = await u.seedPending('monia', nineCards(), null);
  const r = await u.api('POST', '/boosters/rip-more', { id: pid });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.data.pending.packId, 'monia');
  assert.notStrictEqual(r.data.pending.id, pid);
  assert.strictEqual(r.data.pending.cards.length, 9);
  assert.strictEqual(r.data.pending.sold, -1);
  assert.strictEqual(r.data.sc, 0);
  assert.strictEqual(await u.sc(), 0);
  assert.strictEqual(r.data.added.length, 9);
  assert.strictEqual(total(await u.owned()), 9);
  const g = (await u.api('GET', '/boosters/pending')).data.pending;
  assert.strictEqual(g.id, r.data.pending.id);
  const buys = await u.log('shop:booster');
  assert.deepStrictEqual(buys.map(b => [b.amount, b.opponent_id]), [[-20, 'monia']]);
});

test('Add and rip one more: zu wenig SC → 402, das alte Pack ist trotzdem eingelöst, kein neues Pack, SC unverändert', async () => {
  const u = await guest();
  await u.setSc(19);
  const pid = await u.seedPending('future', nineCards(), null);
  const r = await u.api('POST', '/boosters/rip-more', { id: pid });
  assert.strictEqual(r.status, 402);
  assert.strictEqual(r.data.claimed, true);
  assert.strictEqual(r.data.added.length, 9);
  assert.strictEqual(r.data.sc, 19);
  assert.strictEqual(await u.sc(), 19);
  assert.strictEqual(total(await u.owned()), 9);
  assert.strictEqual((await u.api('GET', '/boosters/pending')).data.pending, null);
  // nochmal derselbe Aufruf: Pack ist weg → 404, nichts doppelt gebucht
  const r2 = await u.api('POST', '/boosters/rip-more', { id: pid });
  assert.strictEqual(r2.status, 404);
  assert.strictEqual(total(await u.owned()), 9);
});

test('Add and rip one more: die Gutschrift aus Sell Back zählt für den Preis, die verkaufte Karte wird nicht eingelöst', async () => {
  const u = await guest();
  await u.setSc(2);
  const list = nineCards();
  const pid = await u.seedPending('world1', list, null);
  // 2 SC reichen nicht …
  // … aber nach dem Verkauf der Umbra-Karte (+18) sind es genau 20
  const s = await u.api('POST', '/boosters/sell', { id: pid, index: 8 });
  assert.strictEqual(s.status, 200);
  assert.strictEqual(s.data.sc, 20);
  const r = await u.api('POST', '/boosters/rip-more', { id: pid });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.data.sc, 0);
  assert.strictEqual(r.data.added.length, 8);
  assert.strictEqual(r.data.pending.packId, 'world1');
  assert.strictEqual(r.data.pending.sold, -1);        // das neue Pack beginnt ohne Verkauf
  const own = await u.owned();
  assert.strictEqual(total(own), 8);
  assert.ok(!(own['Shard of Chaos']));
  // das neue Pack kann wieder genau EINE Karte verkaufen
  const idx = 0, amount = R.SELLBACK[r.data.pending.cards[idx].rarity];
  const s2 = await u.api('POST', '/boosters/sell', { id: r.data.pending.id, index: idx });
  assert.strictEqual(s2.status, 200);
  assert.strictEqual(s2.data.sc, amount);
  const s3 = await u.api('POST', '/boosters/sell', { id: r.data.pending.id, index: 1 });
  assert.strictEqual(s3.status, 409);
});

test('Add and rip one more ohne offenes Pack → 404 und nichts gebucht', async () => {
  const u = await guest();
  await u.setSc(100);
  const r = await u.api('POST', '/boosters/rip-more', { id: 'gibts-nicht' });
  assert.strictEqual(r.status, 404);
  assert.strictEqual(await u.sc(), 100);
});
