'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { Collection } = require('discord.js');
const { role, member, guild, message, setup, config } = require('./helpers');

const creator = role('R_CREATOR', 'Creator');

test('!deck: Structure Deck per unscharfer Suche, Heldenbild + Deckliste; Datei-Upload; unbekannt', async () => {
  const { ctx } = await setup({ decks: async () => { throw new (require('../lib/game-api').GameApiError)(404, 'not_linked'); } });
  const m = member({ id: '300000000000000010' });
  const g = guild({ members: [m] });
  let msg = message({ guild: g, member: m, content: '!deck bloody king zi' });
  await ctx.handleMessage(msg);
  const e = msg.replies[0].embeds[0].data;
  assert.equal(e.title, 'Structure Deck: Bloody King Zi');
  assert.match(e.fields[0].value, /Timeless King Zi/);
  assert.match(e.fields[1].name, /Main deck \(60\)/);
  assert.equal(msg.replies[0].files.length, 1);

  msg = message({ guild: g, member: m, content: '!deck zzzzzzzzzz' });
  await ctx.handleMessage(msg);
  assert.match(msg.replies[0].content, /No deck found/);

  msg = message({ guild: g, member: m, content: '!deck' });
  await ctx.handleMessage(msg);
  assert.match(msg.replies[0].content, /Usage/);
});

test('Deck-Parser und eigene Decks aus der Datenbank', () => {
  const deckLib = require('../lib/deck');
  const text = fs.readFileSync(path.join(config.repoRoot, 'data', 'SampleDecks', 'Venom Swamp.txt'), 'utf8');
  const d = deckLib.parseDeckText(text, 'x');
  assert.equal(d.heroes.length, 3);
  assert.equal(deckLib.total(d.main), 60);
  assert.equal(deckLib.parseDeckText('hello'), null);
  const db = deckLib.fromDb({ name: 'Mine', heroes: [{ hero: 'A' }, { hero: null }, { hero: 'B' }], main: ['X', 'X', 'Y', { name: 'Z', count: 3 }], potion: [], side: [] });
  assert.deepEqual(db.heroes, ['A', 'B']);
  assert.deepEqual(db.main, [{ name: 'X', n: 2 }, { name: 'Y', n: 1 }, { name: 'Z', n: 3 }]);
});

test('Turnier: anlegen, beitreten per Button, starten, Ergebnisse, Sieger — nur Admin verwaltet', async () => {
  const { ctx, db } = await setup();
  const boss = member({ id: '500000000000000001', roles: [creator] });
  const players = ['500000000000000011', '500000000000000012', '500000000000000013', '500000000000000014'].map(id => member({ id }));
  const g = guild({ roles: [creator], members: [boss, ...players] });
  const posts = [];
  const chan = { id: 'C1', isTextBased: () => true, send: async p => { posts.push(p); return { id: 'POST1' }; }, sendTyping: async () => {} };
  const say = async (m, content, mentions) => { const msg = message({ guild: g, member: m, content, mentions }); msg.channel = chan; msg.replies.length = 0; await ctx.handleMessage(msg); return msg; };

  let msg = await say(players[0], '!tournament create Cup');
  assert.match(msg.replies[0].content, /Only \*\*Creator\*\*|Only Creator/);

  await say(boss, '!tournament create Summer Cup');
  assert.equal(posts.length, 1);
  assert.match(posts[0].embeds[0].data.title, /Summer Cup/);

  const press = async (m, id) => {
    const out = {};
    const i = { isButton: () => true, customId: id, guildId: 'G1', user: m.user, message: { id: 'POST1' },
      reply: async p => { out.reply = p; }, update: async p => { out.update = p; } };
    for (const h of ctx.interactionHandlers) if (await h(i)) break;
    return out;
  };
  for (const p of players) await press(p, 'tn:join');
  assert.equal((await press(players[0], 'tn:join')).reply.content, 'You’re already in!');
  assert.equal((await db.activeTournament('G1')).state.players.length, 4);

  msg = await say(players[0], '!tournament start');
  assert.match(msg.replies[0].content, /Only/);
  posts.length = 0;
  await say(boss, '!tournament start');
  const st = (await db.activeTournament('G1')).state;
  assert.equal(st.status, 'running');
  assert.equal(st.rounds[0].length, 2);
  assert.match(posts[0].content, /Next matches/);

  const winnerOf = m0 => m0.a;
  const [m1, m2] = st.rounds[0];
  const win = id => say(boss, `!tournament win <@${id}>`, { users: { first: () => ({ id }) } });
  await win(winnerOf(m1));
  await win(winnerOf(m2));
  const st2 = (await db.activeTournament('G1')).state;
  assert.equal(st2.rounds.length, 2);
  posts.length = 0;
  await win(winnerOf(m1));
  assert.match(posts[0].content, new RegExp(`champion`));
  assert.equal(await db.activeTournament('G1'), null, 'beendetes Turnier ist nicht mehr aktiv');
});

test('Patchnotes: nur Bilder geänderter Karten (keine Commit-Texte, keine neuen Karten, keine Nebensächlichkeiten)', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pp-git-'));
  const git = (...a) => execFileSync('git', ['-C', dir, '-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { encoding: 'utf8' });
  const real = JSON.parse(fs.readFileSync(path.join(config.repoRoot, 'data', 'cards.json'), 'utf8'));
  const pick = n => JSON.parse(JSON.stringify(real.find(c => c.name === n)));
  const names = ['Acid Rain', 'Fireball', 'Teocuilatl, the Embodiment of Gods', 'Alchemic Journal'];
  let cards = names.slice(0, 3).map(pick);
  const write = () => fs.writeFileSync(path.join(dir, 'cards.json.tmp'), '') || (fs.mkdirSync(path.join(dir, 'data'), { recursive: true }), fs.writeFileSync(path.join(dir, 'data', 'cards.json'), JSON.stringify(cards, null, 1)));
  const commit = msg => { git('add', '.'); git('commit', '-qm', msg); };
  git('init', '-q', '-b', 'main');
  write(); commit('Erster Stand');

  const fresh = await setup();
  const sent = [];
  const g = guild();
  g.channels.cache.set('PN', { isTextBased: () => true, send: async p => { sent.push(p); } });
  fresh.client.guilds.cache.set('G1', g);
  config.repoRoot = dir; config.channels.patchnotes = 'PN';
  // feeds hat repoRoot beim Registrieren gelesen → neuen Kontext NACH der Umstellung bauen
  const ctx2 = (await setup()); ctx2.client.guilds.cache.set('G1', g);
  const feeds = ctx2.ctx._feeds;

  await feeds.pollPatchnotes();
  assert.equal(sent.length, 0, 'erster Lauf postet nichts');

  // Commit 1: Text von Acid Rain und HP des Heroes geändert, Fireball bleibt, Alchemic Journal ist NEU, interne Markierung bei Fireball
  cards[0].effect += ' Test.'; cards[2].hp += 10; cards[1].skilltestLegal = !cards[1].skilltestLegal; cards.push(pick(names[3]));
  write(); commit('Balance: Acid Rain und Teocuilatl angepasst');
  await feeds.pollPatchnotes();
  assert.equal(sent.length, 1);
  const msg = sent[0];
  assert.match(msg.content, /Patch notes\*\* — 2 cards changed/);
  assert.match(msg.content, /\*\*Acid Rain\*\* — changed: effect text/);
  assert.match(msg.content, /\*\*Teocuilatl, the Embodiment of Gods\*\* — changed: HP/);
  assert.ok(!/Balance|angepasst/.test(msg.content), 'keine Commit-Texte');
  assert.ok(!/Fireball|Alchemic/.test(msg.content), 'weder interne Markierung noch neue Karte');
  assert.equal(msg.files.length, 2);
  assert.ok(msg.files.every(f => f.attachment.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))));

  // Commit 2: nur eine andere Datei → nichts
  fs.writeFileSync(path.join(dir, 'x.txt'), '1'); commit('Nur Code');
  await feeds.pollPatchnotes();
  assert.equal(sent.length, 1);
  await feeds.pollPatchnotes();
  assert.equal(sent.length, 1, 'nichts Neues → nichts gepostet');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('diffCards: nur veränderte Karten; neue/entfernte/Nebenfelder zählen nicht', async () => {
  const { ctx } = await setup();
  const d = ctx._feeds.diffCards;
  const A = { name: 'A', effect: 'x', hp: 10, setID: 's1' }, B = { name: 'B', effect: 'y' };
  assert.deepEqual(d([A, B], [A, B]), []);
  assert.deepEqual(d([A, B], [{ ...A, effect: 'z', hp: 11 }, B]), [{ name: 'A', fields: ['effect text', 'HP'] }]);
  assert.deepEqual(d([A], [A, { name: 'NEU', effect: 'q' }]), [], 'neue Karte');
  assert.deepEqual(d([A, B], [A]), [], 'entfernte Karte');
  assert.deepEqual(d([A], [{ ...A, setID: 's2', skilltestLegal: true }]), [], 'nur Nebenfelder');
  assert.deepEqual(d([A], [{ ...A, cost: 3 }]), [{ name: 'A', fields: ['cost'] }], 'neues Feld');
});
