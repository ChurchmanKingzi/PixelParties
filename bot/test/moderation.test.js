'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { role, member, guild, message, setup, config } = require('./helpers');

const creator = role('R_CREATOR', 'Creator');
const deputy = role('R_DEP', 'Deputy Monia [MOD]');
const LINK_PING = '@everyone check this out https://example.com/free';

async function run(content, opts = {}) {
  const { ctx, db } = await setup();
  const m = opts.member || member({ id: 'U1', joinedDaysAgo: opts.joinedDaysAgo ?? 10, roles: opts.roles || [] });
  const g = guild({ roles: [creator, deputy], members: [m] });
  const msg = message({ guild: g, member: m, content, mentions: opts.mentions });
  const handled = await ctx.messageFilters[0](msg);
  return { ctx, db, g, m, msg, handled };
}

test('neues Mitglied: @everyone + Link → gelöscht, „Nuh-uh“, 1 h Timeout, Strike', async () => {
  const { msg, m, handled, db } = await run(LINK_PING);
  assert.equal(handled, true);
  assert.equal(msg.deleted, true);
  assert.equal(msg.replies.length, 1);
  assert.equal(msg.replies[0].content, 'Nuh-uh, not cool, <@U1>!');
  assert.deepEqual(msg.replies[0].allowedMentions, { users: ['U1'] });
  assert.equal(m.calls.timeout.length, 1);
  assert.equal(m.calls.timeout[0].ms, 3600000);
  assert.equal((await db.activeStrikes('G1', 'U1', 90)).length, 1);
});

test('auch @here, Rollen-Erwähnung und der bloße Versuch ohne Berechtigung zählen', async () => {
  for (const c of ['@here https://a.example.org', 'hey <@&123456789012345678> www.example.net', '@everyone discord.gg/abc']) {
    const r = await run(c);
    assert.equal(r.handled, true, c);
  }
  const viaMentions = await run('hi https://example.com', { mentions: { roles: { size: 1 } } });
  assert.equal(viaMentions.handled, true);
});

test('keine Maßnahme: kein Link, kein Ping, altes Mitglied, Admin-Rollen', async () => {
  assert.equal((await run('@everyone game night tonight!')).handled, false, 'Ping ohne Link');
  assert.equal((await run('look https://example.com/cards')).handled, false, 'Link ohne Ping');
  assert.equal((await run(LINK_PING, { joinedDaysAgo: 200 })).handled, false, 'älter als ein halbes Jahr');
  assert.equal((await run(LINK_PING, { roles: [creator] })).handled, false, 'Creator');
  assert.equal((await run(LINK_PING, { roles: [deputy] })).handled, false, 'Deputy Monia [MOD]');
  assert.equal((await run(LINK_PING, { member: member({ admin: true }) })).handled, false, 'Discord-Administrator');
  const bot = await run(LINK_PING);   // Gegenprobe: derselbe Text trifft normale neue Mitglieder
  assert.equal(bot.handled, true);
});

test('Phishing wird unabhängig von Mitgliedsdauer und Ping behandelt', async () => {
  const r = await run('free nitro https://discord-nitro.gift/claim', { joinedDaysAgo: 900 });
  assert.equal(r.handled, true);
  assert.match(r.msg.replies[0].content, /^Nuh-uh, not cool, <@U1>!/);
  assert.equal((await r.db.allStrikes('G1', 'U1'))[0].reason, 'phishing');
});

test('dritter gültiger Strike → Bann (kein Timeout); Strikes älter als 90 Tage zählen nicht', async () => {
  const { ctx, db } = await setup();
  const m = member({ id: 'U9' });
  const g = guild({ roles: [creator], members: [m] });
  const now = Math.floor(Date.now() / 1000);
  await db.addStrike('G1', 'U9', 'newmember-ping-link', '', now - 100 * 86400);   // verfallen
  const send = () => message({ guild: g, member: m, content: LINK_PING });

  let msg = send(); await ctx.messageFilters[0](msg);
  assert.equal(g.bans.length, 0, '1 gültiger Strike (der alte ist verfallen) → kein Bann');
  assert.equal(m.calls.timeout.length, 1);
  msg = send(); await ctx.messageFilters[0](msg);
  assert.equal(g.bans.length, 0, '2 gültige Strikes → noch kein Bann');
  assert.equal(m.calls.timeout.length, 2);
  msg = send(); await ctx.messageFilters[0](msg);
  assert.equal(g.bans.length, 1, '3 gültige → Bann');
  assert.equal(g.bans[0].id, 'U9');
  assert.equal(m.calls.timeout.length, 2, 'beim Bann kein weiterer Timeout');
  assert.equal(msg.replies[0].content, 'Nuh-uh, not cool, <@U9>!');
  assert.equal((await db.allStrikes('G1', 'U9')).length, 4, 'verfallener bleibt zur Einsicht gespeichert');
});

test('Befehle: nur Creator/Deputy; !strikes und !clearstrikes', async () => {
  const { ctx, db } = await setup();
  const normal = member({ id: '200000000000000002' });
  const boss = member({ id: '200000000000000003', roles: [creator] });
  const g = guild({ roles: [creator], members: [normal, boss] });
  await db.addStrike('G1', '200000000000000002', 'phishing', 'x');

  let msg = message({ guild: g, member: normal, content: '!strikes <@200000000000000002>', mentions: { users: { first: () => ({ id: '200000000000000002' }) } } });
  await ctx.handleMessage(msg);
  assert.match(msg.replies[0].content, /Only \*\*Creator\*\* and \*\*Deputy Monia \[MOD\]\*\*/);
  assert.equal((await db.allStrikes('G1', '200000000000000002')).length, 1, 'nichts gelöscht');

  msg = message({ guild: g, member: normal, content: '!clearstrikes <@200000000000000002>', mentions: { users: { first: () => ({ id: '200000000000000002' }) } } });
  await ctx.handleMessage(msg);
  assert.equal((await db.allStrikes('G1', '200000000000000002')).length, 1, 'Nicht-Admin kann nicht löschen');

  msg = message({ guild: g, member: boss, content: '!strikes <@200000000000000002>', mentions: { users: { first: () => ({ id: '200000000000000002' }) } } });
  await ctx.handleMessage(msg);
  assert.match(msg.replies[0].embeds[0].data.description, /Active: \*\*1\/3\*\*/);

  msg = message({ guild: g, member: boss, content: '!CLEARSTRIKES <@200000000000000002>', mentions: { users: { first: () => ({ id: '200000000000000002' }) } } });
  await ctx.handleMessage(msg);
  assert.equal((await db.allStrikes('G1', '200000000000000002')).length, 0);
});

test('Link-Vorschau (messageUpdate ohne Textänderung) und Bearbeitung derselben Nachricht → nur EIN Strike', async () => {
  const { ctx, db, client } = await setup();
  const m = member({ id: 'U5' });
  const g = guild({ roles: [creator], members: [m] });
  const msg = message({ guild: g, member: m, content: LINK_PING });
  await ctx.messageFilters[0](msg);
  const unfurled = { ...msg, partial: false, guild: g, member: m, author: m.user, content: LINK_PING };
  client.emit('messageUpdate', msg, unfurled);             // Embed-Vorschau: Text gleich
  client.emit('messageUpdate', { ...msg, content: 'x' }, unfurled);   // Text „geändert“, aber dieselbe Nachricht (ID)
  await new Promise(r => setTimeout(r, 30));
  assert.equal((await db.allStrikes('G1', 'U5')).length, 1);
  assert.equal(m.calls.timeout.length, 1);
});

test('Raid-Schutz: 8 Beitritte in 60 s → Verifizierungsstufe hoch + Alarm (kein Absturz)', async () => {
  const { ctx, client } = await setup();
  const g = guild();
  g.verificationLevel = 1; g.setVerificationLevel = async lvl => { g.levels = (g.levels || []).concat(lvl); };
  const logged = [];
  ctx.modlog = async (_guild, x) => { logged.push(x); };
  // moderation.js hat ctx.modlog beim Registrieren ersetzt; der Raid-Handler ruft ctx.modlog zur Laufzeit auf
  for (let i = 0; i < 8; i++) client.emit('guildMemberAdd', { guild: g, id: 'N' + i, user: { bot: false } });
  await new Promise(r => setTimeout(r, 30));
  assert.deepEqual(g.levels, [4], 'VeryHigh (=4) gesetzt');
  assert.match(logged[0].title, /Possible raid/);
});
