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

test('Patchnotes: erster Lauf merkt nur, danach neue Commits ohne Merges', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pp-git-'));
  const git = (...a) => execFileSync('git', ['-C', dir, '-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { encoding: 'utf8' });
  git('init', '-q', '-b', 'main');
  fs.writeFileSync(path.join(dir, 'a'), '1'); git('add', '.'); git('commit', '-qm', 'Erster Stand');
  const { ctx, db, client } = await setup();
  const sent = [];
  const ch = { isTextBased: () => true, send: async p => { sent.push(p); } };
  const g = guild();
  g.channels.cache.set('PN', ch);
  client.guilds.cache.set('G1', g);
  config.repoRoot = dir; config.channels.patchnotes = 'PN';
  // feeds hat repoRoot beim Registrieren gelesen → neuen Kontext bauen
  const fresh = await setup(); fresh.client.guilds.cache.set('G1', g);
  await fresh.ctx._feeds.pollPatchnotes();
  assert.equal(sent.length, 0, 'erster Lauf postet nichts');
  fs.writeFileSync(path.join(dir, 'b'), '2'); git('add', '.'); git('commit', '-qm', 'Neue Karte: Fireball überarbeitet');
  fs.writeFileSync(path.join(dir, 'c'), '3'); git('add', '.'); git('commit', '-qm', 'Tooltip im Pixel-Stil');
  await fresh.ctx._feeds.pollPatchnotes();
  assert.equal(sent.length, 1);
  assert.match(sent[0].content, /Patch notes\*\*\n• Neue Karte: Fireball überarbeitet\n• Tooltip im Pixel-Stil/);
  await fresh.ctx._feeds.pollPatchnotes();
  assert.equal(sent.length, 1, 'nichts Neues → nichts gepostet');
  fs.rmSync(dir, { recursive: true, force: true });
});
