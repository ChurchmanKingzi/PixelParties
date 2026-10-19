'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { Collection } = require('discord.js');
const { role, member, guild, message, setup, adoptRoles } = require('./helpers');

const creator = role('R_CREATOR', 'Creator');
const deputy = role('R_DEP', 'Deputy Monia [MOD]');
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
const isPng = b => Buffer.isBuffer(b) && b.subarray(0, 4).equals(PNG);

// ── Begrüßung ──
test('Begrüßung: exakter Text mit Ping', async () => {
  const { ctx, client } = await setup();
  const m = member({ id: '300000000000000001' });
  const g = guild({ members: [m] });
  const sent = [];
  g.systemChannel = { isTextBased: () => true, send: async p => { sent.push(p); } };
  m.guild = g;
  client.emit('guildMemberAdd', m);
  await new Promise(r => setTimeout(r, 20));
  assert.equal(sent.length, 1);
  assert.equal(sent[0].content,
    'Heya, <@300000000000000001>!\nWelcome to Pixel Planet!\n\n' +
    'Make sure to check out Pixel Parties online at https://pixelpartiestcg.com/ and look around the server to meet other players, see new cards as they are added, discuss the game, or suggest your very own ideas!\n\n' +
    'Have a **cool** time!');
  assert.deepEqual(sent[0].allowedMentions, { users: ['300000000000000001'] });
});

// ── !show ──
test('!show Teocuilatl → Hero-Karte als vollständig gerendertes PNG', async () => {
  const { ctx } = await setup();
  const m = member({ id: '300000000000000002' });
  const g = guild({ members: [m] });
  const msg = message({ guild: g, member: m, content: '!show Teocuilatl' });
  await ctx.handleMessage(msg);
  const reply = msg.replies.at(-1);
  assert.ok(reply.files && reply.files.length === 1, JSON.stringify(reply).slice(0, 200));
  assert.match(reply.files[0].name, /^Teocuilatl_the_Embodiment_of_Gods\.png$/);
  assert.ok(isPng(reply.files[0].attachment));
  assert.ok(reply.files[0].attachment.length > 30000, 'echtes Bild, kein Platzhalter');
});

test('!show: Unsinn → freundliche Meldung; [[Karte]] im Fließtext; !card; Abkühlzeit', async () => {
  const { ctx } = await setup();
  const g = guild();
  const mk = (id, content) => { const m = member({ id }); return message({ guild: g, member: m, content }); };

  let msg = mk('300000000000000003', '!show qzxwvkjqq');
  await ctx.handleMessage(msg);
  assert.match(msg.replies[0].content, /couldn’t find a card/);

  msg = mk('300000000000000004', 'I love [[Acid Rain]] and [[fireball]] so much');
  await ctx.handleMessage(msg);
  assert.equal(msg.replies[0].files.length, 2);

  msg = mk('300000000000000005', '!card Acid Rain');
  await ctx.handleMessage(msg);
  assert.equal(msg.replies[0].embeds[0].data.title, 'Acid Rain');
  assert.match(msg.replies[0].embeds[0].data.description, /Pollution Token/);

  const spam = mk('300000000000000006', '!show Acid Rain');
  await ctx.handleMessage(spam);
  const again = message({ guild: g, member: spam.member, content: '!show Fireball' });
  await ctx.handleMessage(again);
  assert.equal(again.replies.length, 0, 'zweiter Aufruf innerhalb der Abkühlzeit wird still ignoriert');
});

// ── Reaction Roles ──
test('!setupReaction: nur Admin; Parser; Rolle/Emoji → Vergabe und Entzug über Reaktionen', async () => {
  const fire = role('111000000000000001', 'Fire Fan', 5), gamer = role('111000000000000002', 'Gamer', 5), tooHigh = role('111000000000000003', 'Boss', 500);
  const { ctx, db, client } = await setup();
  const boss = member({ id: '400000000000000001', roles: [creator] });
  const normal = member({ id: '400000000000000002' });
  const g = guild({ roles: [creator, fire, gamer, tooHigh], members: [boss, normal] });

  // Parser
  const p = ctx._parseReactionSetup(g, 'Pick your roles!\nSecond title line\n🔥 <@&111000000000000001>\n🎮 Gamer\n<:custom:123456789012345678> fire fan\n❤️ Nonexistent');
  assert.equal(p.description, 'Pick your roles!\nSecond title line');
  assert.deepEqual(p.pairs.map(x => [x.emoji, x.roleName]), [['🔥', 'Fire Fan'], ['🎮', 'Gamer'], ['<:custom:123456789012345678>', 'Fire Fan']]);
  assert.equal(p.pairs[2].emojiKey, '123456789012345678');
  assert.equal(p.errors.length, 1);
  assert.match(p.errors[0], /Role not found: Nonexistent/);

  // Nicht-Admin
  const reactedTo = [];
  const target = { id: '500000000000000001', channelId: 'C1', url: 'u', react: async e => { reactedTo.push(e); } };
  let msg = message({ guild: g, member: normal, content: '!setupReaction\nHi\n🔥 Fire Fan' });
  msg.channel.send = async () => target;
  await ctx.handleMessage(msg);
  assert.match(msg.replies[0].content, /Only \*\*Creator\*\*/);
  assert.equal(await db.reactionRole(target.id, '🔥'), undefined);

  // Admin
  msg = message({ guild: g, member: boss, content: '!setupReaction\nPick!\n🔥 Fire Fan\n🎮 <@&111000000000000002>' });
  const posted = [];
  msg.channel.send = async p => { posted.push(p); return target; };
  await ctx.handleMessage(msg);
  assert.equal(posted.length, 1);
  assert.deepEqual(reactedTo, ['🔥', '🎮']);
  assert.equal((await db.reactionRole(target.id, '🔥')).role_id, '111000000000000001');
  assert.equal(msg.deleted, true, 'Befehlsnachricht aufgeräumt');

  // Rolle über dem Bot wird abgelehnt
  msg = message({ guild: g, member: boss, content: '!setupReaction\nPick!\n🔥 Boss' });
  msg.channel.send = async () => target;
  await ctx.handleMessage(msg);
  assert.match(msg.replies[0].content, /at or above my own role/);

  // Reaktion → Rolle, zurücknehmen → Rolle weg
  const reaction = (emojiName) => ({ partial: false, emoji: { id: null, name: emojiName }, message: { id: target.id, guildId: 'G1', guild: g } });
  g.members.cache.set(normal.id, normal);
  client.emit('messageReactionAdd', reaction('🔥'), { id: normal.id, bot: false });
  await new Promise(r => setTimeout(r, 30));
  assert.deepEqual(normal.calls.rolesAdded, ['111000000000000001']);
  client.emit('messageReactionRemove', reaction('🔥'), { id: normal.id, bot: false });
  await new Promise(r => setTimeout(r, 30));
  assert.deepEqual(normal.calls.rolesRemoved, ['111000000000000001']);
  // nicht zugeordnetes Emoji / Bot: nichts
  client.emit('messageReactionAdd', reaction('🍕'), { id: normal.id, bot: false });
  client.emit('messageReactionAdd', reaction('🎮'), { id: 'BOT', bot: true });
  await new Promise(r => setTimeout(r, 30));
  assert.deepEqual(normal.calls.rolesAdded, ['111000000000000001']);
  // ❤ mit und ohne Variantenselektor sind dasselbe Emoji
  await db.setReactionRoles('G1', 'C1', 'M2', [{ emojiKey: '❤', roleId: '111000000000000002' }]);
  client.emit('messageReactionAdd', { ...reaction('❤️'), message: { id: 'M2', guildId: 'G1', guild: g } }, { id: normal.id, bot: false });
  await new Promise(r => setTimeout(r, 30));
  assert.ok(normal.calls.rolesAdded.includes('111000000000000002'));
});

// ── Konto: SC, Daily, Rollen ──
test('!addsc / !removesc: Argumente, Admin-Pflicht, Antwort', async () => {
  const calls = [];
  const { ctx } = await setup({
    adjustSc: async (uid, delta, admin) => { calls.push([uid, delta, admin]); return { username: 'Alice', before: 100, after: Math.max(0, 100 + delta), applied: Math.max(-100, delta) }; },
  });
  const boss = member({ id: '600000000000000001', roles: [deputy] });
  const normal = member({ id: '600000000000000002' });
  const g = guild({ roles: [deputy], members: [boss, normal] });
  const target = { users: { first: () => ({ id: '600000000000000009' }) } };

  let msg = message({ guild: g, member: normal, content: '!addsc 50 <@600000000000000009>', mentions: target });
  await ctx.handleMessage(msg);
  assert.equal(calls.length, 0);

  msg = message({ guild: g, member: boss, content: '!addsc 50 <@600000000000000009>', mentions: target });
  await ctx.handleMessage(msg);
  assert.deepEqual(calls[0], ['600000000000000009', 50, '600000000000000001']);
  assert.match(msg.replies[0].content, /100 → \*\*150 SC\*\*/);

  msg = message({ guild: g, member: boss, content: '!removesc <@600000000000000009> 30', mentions: target });
  await ctx.handleMessage(msg);
  assert.deepEqual(calls[1], ['600000000000000009', -30, '600000000000000001']);

  msg = message({ guild: g, member: boss, content: '!removesc 500 <@600000000000000009>', mentions: target });
  await ctx.handleMessage(msg);
  assert.match(msg.replies[0].content, /can’t go below 0/);

  for (const bad of ['!addsc abc <@600000000000000009>', '!addsc -5 <@600000000000000009>', '!addsc 1.5 <@600000000000000009>', '!addsc 5']) {
    msg = message({ guild: g, member: boss, content: bad, mentions: bad.includes('<@') ? target : {} });
    await ctx.handleMessage(msg);
    assert.match(msg.replies[0].content, /Usage/, bad);
  }
  assert.equal(calls.length, 3);
});

test('!daily: drei Helden als EIN Bild, exakte Nachricht; ohne Daily wird sie gestartet; ohne Verknüpfung Hinweis', async () => {
  const state = { mode: 'active', started: 0, startResult: 'ok' };
  const HEROES = ['Teocuilatl, the Embodiment of Gods', 'Alice, the Transfer Student', 'Alice, the Puppeteer Girl'];
  const { ctx } = await setup({
    daily: async () => {
      if (state.mode === 'unlinked') throw Object.assign(new (require('../lib/game-api').GameApiError)(404, 'not_linked'), {});
      return state.mode === 'active' ? { active: true, heroes: HEROES, nextResetTs: 1 } : { active: false, heroes: [], nextResetTs: 1900000000 };
    },
    startDaily: async () => { state.started++; return state.startResult === 'ok' ? { active: true, created: true, heroes: HEROES, nextResetTs: 1 } : { active: false, heroes: [], nextResetTs: 1 }; },
  });
  const m = member({ id: '700000000000000001' });
  const g = guild({ members: [m] });
  let msg = message({ guild: g, member: m, content: '!daily' });
  await ctx.handleMessage(msg);
  const r = msg.replies.at(-1);
  assert.equal(r.content, 'Your challenge for today: Win a game with 2, or 3 of these Heroes:');
  assert.equal(r.files.length, 1);
  assert.ok(isPng(r.files[0].attachment));
  assert.equal(state.started, 0, 'läuft schon eine → nichts neu gewürfelt');
  const { loadImage } = require('@napi-rs/canvas');
  const img = await loadImage(r.files[0].attachment);
  assert.ok(img.width > img.height * 2, 'drei Karten nebeneinander: ' + img.width + 'x' + img.height);

  state.mode = 'none';                       // noch keine Challenge → der Bot startet sie
  msg = message({ guild: g, member: m, content: '!daily' });
  await ctx.handleMessage(msg);
  assert.equal(state.started, 1);
  assert.equal(msg.replies.at(-1).content, 'Your challenge for today: Win a game with 2, or 3 of these Heroes:');
  assert.ok(isPng(msg.replies.at(-1).files[0].attachment));

  state.startResult = 'fail';
  msg = message({ guild: g, member: m, content: '!daily' });
  await ctx.handleMessage(msg);
  assert.match(msg.replies[0].content, /couldn’t start your daily challenge/);

  state.mode = 'unlinked';
  msg = message({ guild: g, member: m, content: '!daily' });
  await ctx.handleMessage(msg);
  assert.match(msg.replies[0].content, /haven’t linked/);
  assert.equal(state.started, 2, 'ohne Verknüpfung wird nichts gestartet (Zähler bleibt bei den zwei Starts davor)');
});

test('SC-Meldungen zeigen den DISCORD-Namen, nicht den Spielnamen', async () => {
  const { ctx } = await setup({
    user: async () => ({ user: { username: 'SpielName', sc: 1234, elo: 1000, wins: 0, losses: 0, skins: 0, color: '#00f0ff' } }),
    adjustSc: async () => ({ username: 'SpielName', before: 100, after: 150, applied: 50 }),
  });
  const boss = member({ id: '600000000000000001', roles: [deputy], tag: 'Chef#0001' });
  const player = member({ id: '600000000000000009', tag: 'DiscordNick#0002' });
  const g = guild({ roles: [deputy], members: [boss, player] });

  let msg = message({ guild: g, member: player, content: '!sc' });
  await ctx.handleMessage(msg);
  assert.equal(msg.replies[0].content, '🪙 **DiscordNick** has **1,234 SC**');

  msg = message({ guild: g, member: boss, content: '!sc <@600000000000000009>' });
  await ctx.handleMessage(msg);
  assert.equal(msg.replies[0].content, '🪙 **DiscordNick** has **1,234 SC**');

  msg = message({ guild: g, member: boss, content: '!addsc 50 <@600000000000000009>' });
  await ctx.handleMessage(msg);
  assert.match(msg.replies[0].content, /^🪙 \*\*DiscordNick\*\*: 100 → \*\*150 SC\*\*/);
  assert.ok(!msg.replies[0].content.includes('SpielName'));

  msg = message({ guild: g, member: player, content: '!profile' });
  await ctx.handleMessage(msg);
  const e = msg.replies[0].embeds[0].data;
  assert.equal(e.title, 'DiscordNick');
  assert.ok(e.fields.some(f => f.name === 'In-game name' && f.value === 'SpielName'));
});

test('Rollenabgleich: Rang nach Elo, Skin Collector ab 50, Entzug bei Abstieg', async () => {
  const roles = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Master', 'Grandmaster', 'Skin Collector', 'Veteran', 'Top 10', 'Champion']
    .map((n, i) => role('RR' + i, n, 3));
  const view = { discordId: '800000000000000001', username: 'Alice', elo: 1450, skins: 50, wins: 1, losses: 1, leaderboardRank: null };
  const { ctx } = await setup({ linked: async () => ({ users: [view] }) });
  const m = member({ id: view.discordId });
  const g = guild({ roles, members: [m] });
  assert.deepEqual(await ctx._account.syncMember(g, view), { added: [], removed: [] }, 'ohne !setupRoles fasst der Bot nichts an');
  await adoptRoles(ctx, g, member({ id: '900000000000000099', roles: [creator] }));

  await new Promise(r => setTimeout(r, 30));   // !setupRoles gleicht im Hintergrund sofort ab
  assert.deepEqual([...m.roles.cache.values()].map(x => x.name).sort(), ['Gold', 'Skin Collector']);
  assert.deepEqual(m.calls.rolesRemoved, []);

  view.elo = 1810; view.skins = 49;
  const r2 = await ctx._account.syncMember(g, view);
  assert.deepEqual(r2.added, ['Diamond']);
  assert.deepEqual(r2.removed.sort(), ['Gold', 'Skin Collector']);
  assert.deepEqual([...m.roles.cache.values()].map(x => x.name).sort(), ['Diamond']);

  const r3 = await ctx._account.syncMember(g, view);
  assert.deepEqual([r3.added, r3.removed], [[], []], 'idempotent');
});

test('Rollenabgleich: fremde Rollen bleiben unberührt, Rollen über dem Bot werden übersprungen', async () => {
  const other = role('RX', 'Moderator', 3);
  const bronzeHigh = role('RB', 'Bronze', 999);        // über der Bot-Rolle (100)
  const silver = role('RS', 'Silver', 3);
  const view = { discordId: '800000000000000002', username: 'Bob', elo: 1250, skins: 0, wins: 0, losses: 0, leaderboardRank: null };
  const { ctx } = await setup();
  const m = member({ id: view.discordId, roles: [other] });
  const g = guild({ roles: [other, bronzeHigh, silver], members: [m] });
  await adoptRoles(ctx, g, member({ id: '900000000000000098', roles: [creator] }));
  const r = await ctx._account.syncMember(g, view);
  assert.deepEqual(r.added, ['Silver']);
  assert.ok(m.roles.cache.has('RX'));
});

test('!link: Code eingelöst, Nachricht gelöscht, Rollen vergeben; falscher Code freundlich abgelehnt', async () => {
  const GameApiError = require('../lib/game-api').GameApiError;
  const { ctx } = await setup({
    link: async (code, id) => {
      if (code !== 'ABCD2345') throw new GameApiError(404, 'invalid_code');
      return { user: { discordId: id, username: 'Alice', elo: 1000, skins: 0, wins: 0, losses: 0 } };
    },
    linked: async () => ({ users: [] }),
  });
  const m = member({ id: '900000000000000001' });
  const g = guild({ roles: [role('RB', 'Bronze', 2)], members: [m] });
  await adoptRoles(ctx, g, member({ id: '900000000000000097', roles: [creator] }));
  let msg = message({ guild: g, member: m, content: '!link abcd2345' });
  msg.content = '!link ABCD2345';
  await ctx.handleMessage(msg);
  assert.equal(msg.deleted, true);
  assert.match(msg.replies[0].content, /Linked to \*\*Alice\*\*/);
  assert.deepEqual(m.calls.rolesAdded, ['RB']);

  msg = message({ guild: g, member: m, content: '!link WRONGCODE' });
  await ctx.handleMessage(msg);
  assert.match(msg.replies[0].content, /invalid or expired/);
});

test('!help zeigt Admin-Befehle nur Admins', async () => {
  const { ctx } = await setup();
  const g = guild({ roles: [creator] });
  const boss = member({ id: '1', roles: [creator] }), normal = member({ id: '2' });
  let msg = message({ guild: g, member: normal, content: '!help' }); await ctx.handleMessage(msg);
  assert.ok(!msg.replies[0].content.includes('!setupReaction'));
  assert.ok(msg.replies[0].content.includes('!show'));
  msg = message({ guild: g, member: boss, content: '!help' }); await ctx.handleMessage(msg);
  assert.ok(msg.replies[0].content.includes('!setupReaction'));
  assert.ok(msg.replies[0].content.includes('!addsc'));
});

test('Rollenabgleich: eine von Hand vergebene gleichnamige Rolle bleibt unangetastet, solange sie nicht übernommen wurde', async () => {
  const champion = role('RC', 'Champion', 3), silver = role('RS', 'Silver', 3);
  const view = { discordId: '800000000000000003', username: 'Cy', elo: 1250, skins: 0, wins: 0, losses: 0, leaderboardRank: null };
  const { ctx, db } = await setup();
  const m = member({ id: view.discordId, roles: [champion] });
  const g = guild({ roles: [champion, silver], members: [m] });
  // Nur Silver ist verwaltet (z. B. nach dem Löschen der übrigen Rollen und erneutem !setupRoles ohne Champion):
  await db.kvSet('managed_roles', { silver: 'RS' });
  const r = await ctx._account.syncMember(g, view);
  assert.deepEqual(r.added, ['Silver']);
  assert.ok(m.roles.cache.has('RC'), 'fremde „Champion“-Rolle bleibt');
});

test('syncAll: wer sich im Spiel entkoppelt hat, verliert die Rollen', async () => {
  const roles = [role('RB', 'Bronze', 2), role('RS', 'Silver', 2)];
  let users = [{ discordId: '800000000000000004', username: 'Di', elo: 1250, skins: 0, wins: 0, losses: 0, leaderboardRank: null }];
  const { ctx } = await setup({ linked: async () => ({ users }) });
  const m = member({ id: '800000000000000004' });
  const g = guild({ roles, members: [m] });
  await adoptRoles(ctx, g, member({ id: '900000000000000096', roles: [creator] }));
  await ctx._account.syncAll(g);
  assert.ok(m.roles.cache.has('RS'));
  users = [];                                   // im Spiel entkoppelt
  await ctx._account.syncAll(g);
  assert.equal(m.roles.cache.has('RS'), false);
});

test('Antwort auf Alice + „@Bob“ im Text: Ziel ist Bob (Reihenfolge im Text, nicht die API-Erwähnungsliste)', async () => {
  const calls = [];
  const { ctx } = await setup({ adjustSc: async (uid, delta) => { calls.push(uid); return { username: 'x', before: 0, after: delta, applied: delta }; } });
  const boss = member({ id: '600000000000000001', roles: [deputy] });
  const g = guild({ roles: [deputy], members: [boss] });
  const alice = '600000000000000011', bob = '600000000000000012';
  const msg = message({ guild: g, member: boss, content: `!addsc 5 <@${bob}>`, mentions: { users: { first: () => ({ id: alice }) } } });   // API-Liste: Alice (Antwort-Ziel) zuerst
  await ctx.handleMessage(msg);
  assert.deepEqual(calls, [bob]);
});

test('Reaction Roles: Rollen mit Mod-/Verwaltungsrechten, Bot-Admin-Rollen und verwaltete Rangrollen werden abgelehnt; Buttons nicht an bestehende Nachricht', async () => {
  const modRole = role('222000000000000001', 'Helper', 5, { permissions: { has: f => f === require('discord.js').PermissionsBitField.Flags.BanMembers } });
  const staffRole = role('222000000000000002', 'Deputy Monia [MOD]', 5);
  const rank = role('222000000000000003', 'Gold', 5);
  const fine = role('222000000000000004', 'Gamer', 5);
  const { ctx, db } = await setup();
  await db.kvSet('managed_roles', { gold: rank.id });
  const boss = member({ id: '400000000000000009', roles: [creator] });
  const g = guild({ roles: [creator, modRole, staffRole, rank, fine], members: [boss] });
  const run = async content => { const msg = message({ guild: g, member: boss, content }); msg.channel.send = async () => ({ id: '1', channelId: 'C1', url: 'u', react: async () => {} }); await ctx.handleMessage(msg); return msg.replies[0]?.content || ''; };
  const out = await run('!setupReaction\nPick\n🔥 Helper\n🎮 Deputy Monia [MOD]\n⭐ Gold');
  assert.match(out, /Helper\*\* — it has powerful permissions \(BanMembers\)/);
  assert.match(out, /bot-admin role/);
  assert.match(out, /managed by the bot/);
  assert.match(await run('!setupReaction buttons 500000000000000077\nPick\n🔥 Gamer'), /only be added to a \*\*new\*\* post/);
  assert.equal((await run('!setupReaction\nPick\n🔥 Gamer')), '', 'harmlose Rolle wird eingerichtet (keine Fehlerantwort)');
});
