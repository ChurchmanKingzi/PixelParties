'use strict';
// Karte des Tages: Auswahl (card-of-day.js), Nutzungs-Erfassung (_sc-tracking.js) und der Bonus „Card of the Day!" (sc-rewards.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const { createClient } = require('@libsql/client');
const { berlinDate, cardOfDay, cardOfDayPool } = require('../card-of-day');
const Tr = require('../cards/effects/_sc-tracking');
const { createScRewards, ensureScSchema } = require('../sc-rewards');

const CARDS = [
  { name: 'Alpha Spell', cardType: 'Spell' }, { name: 'Beta Hero', cardType: 'Hero' }, { name: 'Gamma Creature', cardType: 'Creature' },
  { name: 'Delta Token', cardType: 'Token' }, { name: 'Epsilon Both', cardType: 'Creature/Token' },
  { name: 'Zeta Banned', cardType: 'Spell', banned: 'Banned' }, { name: 'Eta Ascended', cardType: 'Ascended Hero' },
];

test('Berliner Tag und Auswahl: stabil je Datum, ohne Tokens, gebannte Karten und Ascended Heroes', () => {
  assert.equal(berlinDate(new Date('2026-10-20T21:59:00Z')), '2026-10-20');   // 23:59 MESZ
  assert.equal(berlinDate(new Date('2026-10-20T22:00:00Z')), '2026-10-21');   // 00:00 MESZ
  assert.equal(berlinDate(new Date('2026-12-31T23:30:00Z')), '2027-01-01');   // MEZ
  assert.deepEqual(cardOfDayPool(CARDS).map(c => c.name), ['Alpha Spell', 'Beta Hero', 'Gamma Creature']);
  assert.equal(cardOfDay('2026-10-21', CARDS).name, cardOfDay('2026-10-21', [...CARDS].reverse()).name, 'Reihenfolge der Eingabe egal');
  const seen = new Set(); for (let d = 1; d <= 28; d++) seen.add(cardOfDay(`2026-11-${String(d).padStart(2, '0')}`, CARDS).name);
  assert.ok(seen.size > 1 && [...seen].every(n => ['Alpha Spell', 'Beta Hero', 'Gamma Creature'].includes(n)));
  assert.equal(cardOfDay('2026-10-21', []), null);
});

test('Nutzung wird erfasst: Startkarten, onPlay, Brett betreten, Spell per Effekt, Aszendierung — nicht Ziehen/Ablage', () => {
  const tr = [Tr.neu(), Tr.neu()];
  Tr.startKarten(tr, [
    { heroes: [{ name: 'Beta Hero' }, { name: '' }, { name: 'Hero Two' }], abilityZones: [[['Fighting'], ['Fighting', 'Fighting']], [], [['Wealth']]] },
    { heroes: [{ name: 'Opp Hero' }], abilityZones: [] },
  ]);
  assert.deepEqual(tr[0].cardsUsed.sort(), ['Beta Hero', 'Fighting', 'Hero Two', 'Wealth']);
  assert.deepEqual(tr[1].cardsUsed, ['Opp Hero']);

  Tr.beiHook(tr, 'onPlay', { playedCard: { name: 'Alpha Spell', owner: 0, controller: 0 } });
  Tr.beiHook(tr, 'onPlay', { playedCard: { name: 'Stolen', owner: 0, controller: 1 } });          // zählt für den, der es spielt
  Tr.beiHook(tr, 'onCardEnterZone', { enteringCard: { name: 'Gamma Creature', owner: 1, controller: 1 }, toZone: 'support' });
  Tr.beiHook(tr, 'onCardEnterZone', { enteringCard: { name: 'Only Hand', owner: 1, controller: 1 }, toZone: 'hand' });
  Tr.beiHook(tr, 'onCardEnterZone', { enteringCard: { name: 'Only Discard', owner: 1, controller: 1 }, toZone: 'discard' });
  Tr.beiHook(tr, 'afterSpellResolved', { casterIdx: 0, spellName: 'Cast By Effect', spellCardData: { cardType: 'Spell' } });
  Tr.beiHook(tr, 'afterPotionUsed', { potionOwner: 1, potionName: 'Elixir' });
  Tr.beiHook(tr, 'onPlay', {});                                                                    // ohne Instanz: kein Absturz
  Tr.kartenName(tr[0], 'Ascended Form'); Tr.kartenName(tr[0], 'Ascended Form');
  assert.ok(['Alpha Spell', 'Cast By Effect', 'Ascended Form'].every(n => tr[0].cardsUsed.includes(n)));
  assert.equal(tr[0].cardsUsed.filter(n => n === 'Ascended Form').length, 1, 'jede Karte nur einmal');
  assert.ok(!tr[0].cardsUsed.includes('Stolen'));
  assert.ok(['Stolen', 'Gamma Creature', 'Elixir'].every(n => tr[1].cardsUsed.includes(n)));
  assert.ok(!tr[1].cardsUsed.some(n => n === 'Only Hand' || n === 'Only Discard'));
  assert.deepEqual(JSON.parse(JSON.stringify(tr)), tr, 'JSON-sicher (Snapshot/Restore)');
});

async function fixture() {
  const client = createClient({ url: ':memory:' });
  const db = {
    execute: (sql, args = []) => client.execute({ sql, args }),
    run: async (sql, args = []) => { const r = await client.execute({ sql, args }); return { rowsAffected: r.rowsAffected }; },
    get: async (sql, args = []) => (await client.execute({ sql, args })).rows[0],
    all: async (sql, args = []) => (await client.execute({ sql, args })).rows,
  };
  await db.execute('CREATE TABLE users (id TEXT PRIMARY KEY, sc INTEGER DEFAULT 0, elo INTEGER DEFAULT 1000)');
  await db.execute(`CREATE TABLE sc_log (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, reward_id TEXT NOT NULL, opponent_id TEXT, opponent_ip TEXT, amount INTEGER NOT NULL, created_at INTEGER DEFAULT (unixepoch()))`);
  await ensureScSchema(db);
  await db.run("INSERT INTO users (id) VALUES ('u1'), ('u2')");
  let n = 0;
  let today = { date: '2026-10-21', card: 'Fireball' };
  const nowMs = Date.now();
  const sc = createScRewards({ db, uuidv4: () => 'id' + (++n), getActiveDaily: () => null, getCardDB: () => ({}), getCardOfDay: () => today, now: () => nowMs });
  const game = (used0, used1) => ({
    turn: 8, _gameStartTime: nowMs - 10 * 60 * 1000, _playerIPs: ['1.1.1.1', '2.2.2.2'],
    _scTracking: [{ ...Tr.neu(), cardsPlayedFromHand: 5, cardsUsed: used0 }, { ...Tr.neu(), cardsPlayedFromHand: 5, cardsUsed: used1 }],
    players: [{ userId: 'u1', heroes: [{ name: 'A', hp: 100, maxHp: 100 }], hand: [], mainDeck: [] }, { userId: 'u2', heroes: [{ name: 'B', hp: 0, maxHp: 100 }], hand: [], mainDeck: [] }],
  });
  const room = gs => ({ gameState: gs, type: 'casual', format: 1 });
  return { db, sc, game, room, setToday: t => { today = t; } };
}
const cotd = r => (r?.rewards || []).find(x => x.baseId === 'card_of_the_day');

test('Bonus „Card of the Day!": Sieg + Karte benutzt = 30 SC, einmal je Tag; Niederlage/nicht benutzt/Verbindungsabbruch nichts', async () => {
  const { db, sc, game, room, setToday } = await fixture();
  const scOf = async id => Number((await db.get('SELECT sc FROM users WHERE id = ?', [id])).sc);

  // u1 gewinnt und hat Fireball benutzt; u2 hat verloren, aber ebenfalls benutzt → nichts
  let res = await sc.evaluate(room(game(['Fireball'], ['Fireball'])), 0, 'all_heroes_dead');
  const r = cotd(res[0]);
  assert.ok(r, 'Bonus für den Sieger');
  assert.equal(r.amount, 30);
  assert.equal(r.title, 'Card of the Day!', 'Datum steht nicht im Titel');
  assert.equal(r.id, 'card_of_the_day:2026-10-21');
  assert.match(r.description, /Fireball/);
  assert.equal(r.limit, 'daily_key');
  assert.ok(!cotd(res[1]), 'Verlierer bekommt ihn nicht');
  const nach1 = await scOf('u1');

  // gleicher Tag, zweiter Sieg → kein zweites Mal
  res = await sc.evaluate(room(game(['Fireball'], [])), 0, 'all_heroes_dead');
  assert.ok(!cotd(res[0]), 'einmalig je Tag');
  assert.ok(await scOf('u1') >= nach1);

  // nächster Berliner Tag, andere Karte
  setToday({ date: '2026-10-22', card: 'Ice Age' });
  res = await sc.evaluate(room(game(['Fireball'], [])), 0, 'all_heroes_dead');
  assert.ok(!cotd(res[0]), 'andere Karte nicht benutzt → nichts');
  res = await sc.evaluate(room(game(['Fireball', 'Ice Age'], [])), 0, 'all_heroes_dead');
  assert.equal(cotd(res[0])?.amount, 30, 'neuer Tag, neuer Bonus');
  const rows = await db.all("SELECT reward_id FROM sc_log WHERE user_id = 'u1' AND reward_id LIKE 'card_of_the_day%' ORDER BY reward_id");
  assert.deepEqual(rows.map(x => x.reward_id), ['card_of_the_day:2026-10-21', 'card_of_the_day:2026-10-22']);

  // Sieg durch Verbindungsabbruch: kein Bonus (wie alle Boni ohne onDisconnectWin)
  setToday({ date: '2026-10-23', card: 'Fireball' });
  res = await sc.evaluate(room(game(['Fireball'], [])), 0, 'disconnect_timeout');
  assert.ok(!cotd(res[0]));

  // zu kurze Partie (Anti-Farm-Riegel) → kein Bonus
  const kurz = game(['Fireball'], []); kurz._gameStartTime = Date.now() - 30 * 1000;
  res = await sc.evaluate(room(kurz), 0, 'all_heroes_dead');
  assert.ok(!cotd(res[0]));

  // keine Karte des Tages verfügbar → nichts, kein Absturz
  setToday(null);
  res = await sc.evaluate(room(game(['Fireball'], [])), 0, 'all_heroes_dead');
  assert.ok(!cotd(res[0]));
});

test('Katalog: Eintrag gültig, 30 SC', () => {
  const { validateCatalog } = require('../sc-rewards');
  const cat = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', 'data', 'sc-rewards.json'), 'utf8'));
  assert.deepEqual(validateCatalog(cat), []);
  assert.equal(cat.find(r => r.id === 'card_of_the_day').amount, 30);
});
