'use strict';
// ═══════════════════════════════════════════════════════════════════
//  Pixel-Parties-Konto
//   !link <Code>        Discord-Konto mit dem Spielkonto verknüpfen (Code erzeugt man im Spiel, Profil)
//   !unlink             Verknüpfung lösen (nimmt die Rang-/Erfolgsrollen weg)
//   !sc [@Nutzer]       Smug Coins
//   !profile [@Nutzer]  Elo, Rang, SC, Bilanz, Skins, Avatar
//   !daily              die Daily Challenge des Spielers als Bild der drei Helden
//   !sync               Rollen sofort abgleichen
//   !addsc / !removesc  (Admin) SC erhöhen/senken
//   !setupRoles         (Admin) fehlende Rang-/Erfolgsrollen anlegen
//   !syncall            (Admin) alle verknüpften Spieler abgleichen
//
//  ROLLEN-ABGLEICH: Rang nach Elo (wie im Spiel), Erfolgsrollen (Skin Collector …), automatisch alle
//  ROLE_SYNC_MINUTES Minuten und bei !link/!sync. Eine individuelle Namensfarbe gibt es nicht — Discord
//  färbt Namen nur über Rollen (max. 250 je Server); die Rang-Rollen tragen die Farbe.
// ═══════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const { AttachmentBuilder, EmbedBuilder, PermissionsBitField, escapeMarkdown } = require('discord.js');
const renderer = require('../lib/card-renderer');
const rolesLogic = require('../lib/roles-logic');
const { key, mentionedIds } = require('../lib/util');

module.exports = function register(ctx) {
  const { client, config, db, game, helpers } = ctx;
  const { GameApiError } = game;

  const DAILY_TEXT = 'Your challenge for today: Win a game with 2, or 3 of these Heroes:';
  const notLinked = (who = 'You') => `${who === 'You' ? 'You haven’t' : who + ' hasn’t'} linked a Pixel Parties account yet. Open **Profile** in the game → **Link Discord**, then type \`${config.prefix}link CODE\` here.`;

  function apiError(err) {
    if (err instanceof GameApiError) {
      if (err.status === 0) return 'The game server isn’t reachable right now — please try again in a minute.';
      if (err.status === 404 && err.code === 'not_linked') return null;
    }
    console.error('[account]', err);
    return 'Something went wrong talking to the game server.';
  }

  // Erste im TEXT erwähnte Person (nicht `msg.mentions`: das enthält bei einer Antwort auch den Autor der Ursprungsnachricht).
  /** Name, wie er im Discord-Server erscheint (Spitzname, sonst Anzeigename/Nutzername) — NICHT der Spielname. */
  async function discordName(guild, discordId) {
    const member = guild.members.cache.get(discordId) || await guild.members.fetch(discordId).catch(() => null);
    return escapeMarkdown(member ? member.displayName : 'Unknown user');
  }

  const mentioned = (msg, args) => mentionedIds(msg.content)[0] || args.find(a => /^\d{15,25}$/.test(a)) || null;

  // ── Rollen-Abgleich ────────────────────────────────────────
  const managed = rolesLogic.managedRoleDefs(config);
  const managedKeys = new Set(managed.map(m => key(m.name)));
  /**
   * Die Rollen, die der Bot verwaltet — NUR die, die `!setupRoles` angelegt oder (auf ausdrücklichen Admin-Befehl) übernommen hat,
   * gemerkt als IDs. Eine zufällig gleichnamige Rolle (z. B. von Hand vergebenes „Champion“) fasst der Bot nie an.
   * @returns {Promise<Map<string, import('discord.js').Role>>} Schlüssel (Rollenname normalisiert) → Rolle
   */
  async function managedRoles(guild) {
    const ids = await db.kvGet('managed_roles', {});
    const map = new Map();
    for (const [k, id] of Object.entries(ids)) {
      const role = guild.roles.cache.get(id);
      if (role && managedKeys.has(k)) map.set(k, role);
    }
    return map;
  }

  /** Gleicht Rang-/Erfolgsrollen (und optional den Spitznamen) eines Mitglieds ab. @returns {{added:string[], removed:string[]}} */
  async function syncMember(guild, user) {
    const member = await guild.members.fetch(user.discordId).catch(() => null);
    if (!member) return { added: [], removed: [] };
    const have = await managedRoles(guild);
    const wantNames = rolesLogic.desiredRoleNames(user, config).map(key);
    const add = [], remove = [];
    for (const [k, role] of have) {
      const has = member.roles.cache.has(role.id), want = wantNames.includes(k);
      if (want && !has) add.push(role);
      if (!want && has) remove.push(role);
    }
    const me = guild.members.me;
    const reachable = r => r.position < me.roles.highest.position && !r.managed;
    const addOk = add.filter(reachable), removeOk = remove.filter(reachable);
    if (add.length !== addOk.length || remove.length !== removeOk.length) {
      console.warn('[roles] Einige Rollen liegen über der Bot-Rolle und wurden übersprungen — MoniaBot-Rolle in der Rollenliste nach oben ziehen.');
    }
    try {
      if (addOk.length) await member.roles.add(addOk, 'MoniaBot: role sync');
      if (removeOk.length) await member.roles.remove(removeOk, 'MoniaBot: role sync');
    } catch (err) { console.error('[roles] Abgleich', user.username, err.message); return { added: [], removed: [] }; }

    if (config.syncNicknames && member.manageable && member.nickname !== user.username && member.displayName !== user.username) {
      try { await member.setNickname(user.username.slice(0, 32), 'MoniaBot: in-game name'); } catch { /* Besitzer o. höhere Rolle */ }
    }
    return { added: addOk.map(r => r.name), removed: removeOk.map(r => r.name) };
  }

  async function syncAll(guild) {
    const { users } = await game.linked();
    let changed = 0;
    for (const u of users) {
      const r = await syncMember(guild, u);
      if (r.added.length || r.removed.length) changed++;
    }
    // Wer sich im SPIEL entkoppelt hat, fehlt jetzt in der Liste, trägt aber noch Rollen: nachträglich abnehmen.
    const now = users.map(u => u.discordId);
    const before = await db.kvGet('synced_discord_ids', []);
    for (const id of before) if (!now.includes(id)) { await removeManagedRoles(guild, id); changed++; }
    await db.kvSet('synced_discord_ids', now);
    return { total: users.length, changed };
  }

  async function removeManagedRoles(guild, discordId) {
    const member = await guild.members.fetch(discordId).catch(() => null);
    if (!member) return;
    const mine = [...(await managedRoles(guild)).values()].filter(r => member.roles.cache.has(r.id));
    if (mine.length) await member.roles.remove(mine, 'MoniaBot: account unlinked').catch(() => {});
  }

  ctx.onReady.push(() => {
    const guild = () => client.guilds.cache.get(config.guildId);
    const run = () => { const g = guild(); if (g) syncAll(g).catch(e => e instanceof GameApiError && e.status === 0 ? null : console.error('[roles] syncAll:', e.message)); };
    const t = setInterval(run, Math.max(1, config.syncMinutes) * 60 * 1000);
    t.unref && t.unref();
    setTimeout(run, 20 * 1000).unref();
  });

  // ── Befehle ────────────────────────────────────────────────
  ctx.command('link', { help: '`!link <code>` — link your Pixel Parties account (create the code in the game under Profile)' }, async (msg, args) => {
    try { if (msg.deletable) await msg.delete(); } catch { /* Code ist ohnehin nur einmal gültig */ }
    const code = (args[0] || '').trim();
    if (!/^[A-Za-z0-9]{6,12}$/.test(code)) return msg.channel.send({ content: `<@${msg.author.id}> Usage: \`${config.prefix}link CODE\` — create the code in the game under **Profile → Link Discord**.`, allowedMentions: { users: [msg.author.id] } });
    try {
      const { user } = await game.link(code, msg.author.id);
      const r = await syncMember(msg.guild, { ...user, leaderboardRank: null });
      await msg.channel.send({ content: `<@${msg.author.id}> ✅ Linked to **${user.username}**! ${r.added.length ? 'Roles: ' + r.added.join(', ') : ''}`.trim(), allowedMentions: { users: [msg.author.id] } });
      syncAll(msg.guild).catch(() => {});   // Ranglisten-Rollen (Top 10) sofort mitziehen
    } catch (err) {
      let text;
      if (err instanceof GameApiError && err.code === 'invalid_code') text = 'That code is invalid or expired. Create a new one in the game.';
      else if (err instanceof GameApiError && err.code === 'discord_already_linked') text = `This Discord account is already linked to a Pixel Parties account. Use \`${config.prefix}unlink\` first.`;
      else text = apiError(err) || 'Linking failed.';
      await msg.channel.send({ content: `<@${msg.author.id}> ${text}`, allowedMentions: { users: [msg.author.id] } });
    }
  });

  ctx.command('unlink', { help: '`!unlink` — unlink your account' }, async (msg) => {
    try {
      const r = await game.unlink(msg.author.id);
      await removeManagedRoles(msg.guild, msg.author.id);
      return msg.reply(r.unlinked ? 'Unlinked. Your rank roles were removed.' : notLinked());
    } catch (err) { return msg.reply(apiError(err) || notLinked()); }
  });

  async function viewOf(discordId) {
    try { return (await game.user(discordId)).user; }
    catch (err) { if (err instanceof GameApiError && err.code === 'not_linked') return null; throw err; }
  }

  ctx.command('sc', { help: '`!sc [@user]` — show Smug Coins' }, async (msg, args) => {
    const id = mentioned(msg, args) || msg.author.id;
    try {
      const u = await viewOf(id);
      if (!u) return msg.reply(id === msg.author.id ? notLinked() : notLinked('That player'));
      return msg.reply({ content: `🪙 **${await discordName(msg.guild, id)}** has **${Number(u.sc).toLocaleString('en-US')} SC**`, allowedMentions: { parse: [] } });
    } catch (err) { return msg.reply(apiError(err)); }
  });

  // Avatar des Spielers: Datei auf der Platte (Shop/Standard) oder eingebettete Bilddaten — nie ein fremder Pfad.
  function avatarBuffer(avatar) {
    if (!avatar) return null;
    try {
      if (avatar.startsWith('data:image/')) {
        const m = /^data:[^;,]+(;base64)?,(.*)$/s.exec(avatar);
        return m ? (m[1] ? Buffer.from(m[2], 'base64') : Buffer.from(decodeURIComponent(m[2]))) : null;
      }
      const rel = decodeURIComponent(avatar).replace(/^\/+/, '');
      const base = rel.startsWith('data/') ? config.repoRoot : path.join(config.repoRoot, 'public');
      const file = path.resolve(base, rel);
      const allowed = [path.join(config.repoRoot, 'data', 'shop') + path.sep, path.join(config.repoRoot, 'public', 'avatars') + path.sep];
      if (!allowed.some(a => file.startsWith(a))) return null;
      return fs.readFileSync(file);
    } catch { return null; }
  }

  ctx.command('profile', { help: '`!profile [@user]` — player profile' }, async (msg, args) => {
    const id = mentioned(msg, args) || msg.author.id;
    try {
      const u = await viewOf(id);
      if (!u) return msg.reply(id === msg.author.id ? notLinked() : notLinked('That player'));
      const tier = rolesLogic.rankFor(u.elo);
      const games = u.wins + u.losses;
      const e = new EmbedBuilder().setTitle(await discordName(msg.guild, id)).setColor(/^#[0-9a-f]{6}$/i.test(u.color) ? parseInt(u.color.slice(1), 16) : tier.color)
        .addFields(
          { name: 'In-game name', value: u.username, inline: true },
          { name: 'Rank', value: `${tier.name} · ${u.elo} Elo`, inline: true },
          { name: 'SC', value: Number(u.sc).toLocaleString('en-US'), inline: true },
          { name: 'Record', value: games ? `${u.wins}W / ${u.losses}L (${Math.round(100 * u.wins / games)}%)` : 'No games yet', inline: true },
          { name: 'Skins', value: String(u.skins), inline: true },
        );
      const files = [];
      const buf = avatarBuffer(u.avatar);
      if (buf) { files.push(new AttachmentBuilder(buf, { name: 'avatar.png' })); e.setThumbnail('attachment://avatar.png'); }
      return msg.reply({ embeds: [e], files, allowedMentions: { parse: [] } });
    } catch (err) { return msg.reply(apiError(err)); }
  });

  ctx.command('daily', { help: '`!daily` — your Daily Challenge (three heroes); starts it if you haven’t yet' }, async (msg) => {
    try {
      let d = await game.daily(msg.author.id);
      // Noch keine Challenge heute → hier nach den Regeln des Spiels würfeln; sie gilt damit auch im Spiel.
      if (!d.active) d = await game.startDaily(msg.author.id);
      if (!d.active) return msg.reply('I couldn’t start your daily challenge right now — please try again in a minute.');
      await msg.channel.sendTyping().catch(() => {});
      await renderer.init();
      const buf = await ctx.renderQueue(() => renderer.renderCardsRow(d.heroes, { scale: 0.75 }));
      if (!buf) return msg.reply(`${DAILY_TEXT}\n${d.heroes.map(h => '**' + h + '**').join(', ')}`);
      return msg.reply({ content: DAILY_TEXT, files: [new AttachmentBuilder(buf, { name: 'daily.png' })], allowedMentions: { parse: [] } });
    } catch (err) {
      if (err instanceof GameApiError && err.code === 'not_linked') return msg.reply(notLinked());
      return msg.reply(apiError(err));
    }
  });

  const syncCooldown = new Map();
  ctx.command('sync', { help: '`!sync` — update your rank/achievement roles now' }, async (msg) => {
    if (Date.now() - (syncCooldown.get(msg.author.id) || 0) < 30000) return msg.reply('Easy — try again in a few seconds.');
    syncCooldown.set(msg.author.id, Date.now());
    try {
      const { users } = await game.linked();
      const me = users.find(u => u.discordId === msg.author.id);
      if (!me) return msg.reply(notLinked());
      if (!Object.keys(await db.kvGet('managed_roles', {})).length) return msg.reply('The rank roles aren’t set up yet — an admin needs to run `' + config.prefix + 'setupRoles` first.');
      const r = await syncMember(msg.guild, me);
      return msg.reply(r.added.length || r.removed.length
        ? `Updated your roles${r.added.length ? ' · added: ' + r.added.join(', ') : ''}${r.removed.length ? ' · removed: ' + r.removed.join(', ') : ''}.`
        : 'Your roles are already up to date.');
    } catch (err) { return msg.reply(apiError(err)); }
  });

  ctx.command('syncall', { staff: true, help: '`!syncAll` — update roles of all linked players' }, async (msg) => {
    try { const r = await syncAll(msg.guild); return msg.reply(`Synced ${r.total} linked player(s), ${r.changed} changed.`); }
    catch (err) { return msg.reply(apiError(err)); }
  });

  ctx.command('setuproles', { staff: true, help: '`!setupRoles` — create missing rank/achievement roles' }, async (msg) => {
    const guild = msg.guild;
    if (!guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles)) return msg.reply('I need the **Manage Roles** permission.');
    // Vorhandene Rolle gleichen Namens wird ÜBERNOMMEN (der Admin hat den Befehl ausdrücklich gegeben), sonst neu angelegt.
    // Gemerkt werden die IDs; nur diese Rollen verwaltet der Bot später.
    const ids = await db.kvGet('managed_roles', {});
    const created = [], existing = [];
    for (const def of managed) {
      const k = key(def.name);
      let role = ids[k] && guild.roles.cache.get(ids[k]);
      if (!role) role = guild.roles.cache.find(r => key(r.name) === k && !r.managed);
      if (role) { ids[k] = role.id; existing.push(def.name); continue; }
      try { role = await guild.roles.create({ name: def.name, colors: { primaryColor: def.color }, reason: 'MoniaBot: !setupRoles', permissions: [] }); ids[k] = role.id; created.push(def.name); }
      catch (err) { await db.kvSet('managed_roles', ids); return msg.reply(`Couldn’t create **${def.name}**: ${err.message}`); }
    }
    await db.kvSet('managed_roles', ids);
    await msg.reply(`✅ Created: ${created.join(', ') || 'nothing new'}${existing.length ? `\nAlready there: ${existing.join(', ')}` : ''}\n` +
      '**Important:** in *Server Settings → Roles*, drag **MoniaBot**’s role above these roles, and place the rank roles above your default roles so the name colour shows.');
    syncAll(guild).catch(() => {});
  });

  // ── Admin: SC ──────────────────────────────────────────────
  function parseScArgs(msg, args) {
    const uid = mentioned(msg, args);
    const numTok = args.find(a => /^[+-]?\d{1,7}$/.test(a) && !/^\d{15,}$/.test(a));
    if (!uid || numTok === undefined) return null;
    return { uid, n: Number(numTok) };
  }
  async function adjust(msg, args, sign) {
    const p = parseScArgs(msg, args);
    const verb = sign > 0 ? 'addsc' : 'removesc';
    if (!p || !Number.isInteger(p.n) || p.n <= 0) return msg.reply(`Usage: \`${config.prefix}${verb} <whole number> @user\` (the number must be positive).`);
    try {
      const r = await game.adjustSc(p.uid, sign * p.n, msg.author.id);
      const note = r.applied !== sign * p.n ? ` (balance can’t go below 0, applied ${r.applied})` : '';
      await ctx.modlog(msg.guild, { title: `🪙 SC ${sign > 0 ? 'added' : 'removed'}`, color: 0xfbc02d, description: `<@${msg.author.id}> → **${r.username}** (<@${p.uid}>): ${r.applied > 0 ? '+' : ''}${r.applied} SC · ${r.before} → ${r.after}` });
      return msg.reply({ content: `🪙 **${await discordName(msg.guild, p.uid)}**: ${r.before} → **${r.after} SC**${note}`, allowedMentions: { parse: [] } });
    } catch (err) {
      if (err instanceof GameApiError && err.code === 'not_linked') return msg.reply('That user hasn’t linked a Pixel Parties account.');
      return msg.reply(apiError(err));
    }
  }
  ctx.command('addsc', { staff: true, help: '`!addsc <number> @user` — add SC' }, (msg, args) => adjust(msg, args, +1));
  ctx.command('removesc', { staff: true, help: '`!removesc <number> @user` — remove SC' }, (msg, args) => adjust(msg, args, -1));

  ctx._account = { syncMember, syncAll, avatarBuffer, parseScArgs };
};
