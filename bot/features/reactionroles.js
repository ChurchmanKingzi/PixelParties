'use strict';
// ═══════════════════════════════════════════════════════════════════
//  Reaction Roles — NUR für Admins (Creator / Deputy Monia [MOD])
//
//  !setupReaction [buttons] [<Nachrichten-ID>]
//  <Titel / Beschreibung, beliebig viele Zeilen>
//  <Emoji> <Rolle>          ← Rolle als @Erwähnung, ID oder genauer Name
//  <Emoji> <Rolle>
//
//  Ohne Nachrichten-ID postet der Bot einen neuen Beitrag und reagiert selbst mit allen Emotes.
//  Mit Nachrichten-ID wird ein vorhandener Beitrag dieses Kanals angebunden.
//  Reagiert jemand → er bekommt die Rolle; nimmt er die Reaktion zurück → die Rolle wird entfernt.
//  Mit `buttons` gibt es statt Reaktionen Knöpfe (An-/Ausschalten per Klick).
//
//  !removeReaction <Nachrichten-ID>   löst die Zuordnung (der Beitrag bleibt stehen)
//  !listReactions                     zeigt alle Reaction-Role-Beiträge
// ═══════════════════════════════════════════════════════════════════
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionsBitField, MessageFlags } = require('discord.js');
const { emojiKey, parseLeadingEmoji } = require('../lib/util');

module.exports = function register(ctx) {
  const { client, config, db, helpers } = ctx;

  /** Zeilen → { description, pairs:[{emoji, role}], errors }. Reine Funktion der Eingabe (für Tests). */
  function parseSetup(guild, text) {
    const description = [];
    const pairs = [];
    const errors = [];
    for (const raw of String(text || '').split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) { if (!pairs.length) description.push(''); continue; }
      const em = parseLeadingEmoji(line);
      if (!em) { if (pairs.length) errors.push(`Not an "<emoji> <role>" line: ${line}`); else description.push(line); continue; }
      const role = helpers.findRole(guild, em.rest);
      if (!role) { errors.push(`Role not found: ${em.rest || '(empty)'}`); continue; }
      if (pairs.some(p => p.emojiKey === em.key)) { errors.push(`Emoji used twice: ${em.display}`); continue; }
      pairs.push({ emoji: em.display, react: em.react, button: em.button, emojiKey: em.key, roleId: role.id, roleName: role.name });
    }
    return { description: description.join('\n').trim(), pairs, errors };
  }
  ctx._parseReactionSetup = parseSetup;

  ctx.command('setupreaction', { staff: true, help: '`!setupReaction [buttons] [messageId]` + lines `<emoji> <role>` — set up reaction roles' }, async (msg, args, rest) => {
    const guild = msg.guild;
    const me = guild.members.me;
    if (!me.permissions.has(PermissionsBitField.Flags.ManageRoles)) return msg.reply('I need the **Manage Roles** permission.');

    // Kopfzeile = Rest der ersten Zeile hinter dem Befehl: [buttons] [ID]. Ab der nächsten Zeile: Titel + Paare.
    // (`rest` taugt dafür nicht — es hat den Zeilenumbruch hinter dem Befehl schon verschluckt.)
    const raw = msg.content.slice(config.prefix.length).replace(/^\S+/, '');
    const nl = raw.indexOf('\n');
    const head = (nl < 0 ? raw : raw.slice(0, nl)).trim().split(/\s+/).filter(Boolean);
    const body = nl < 0 ? '' : raw.slice(nl + 1);
    let mode = 'reaction', existingId = null;
    for (const h of head) {
      if (/^buttons?$/i.test(h)) mode = 'buttons';
      else if (/^\d{15,25}$/.test(h)) existingId = h;
      else return msg.reply('Unknown option: `' + h + '`. Usage: `!setupReaction [buttons] [messageId]` and then one `<emoji> <role>` per line.');
    }
    const { description, pairs, errors } = parseSetup(guild, body);
    if (!pairs.length) return msg.reply('No valid `<emoji> <role>` lines found.\nExample:\n```\n!setupReaction\nPick your roles!\n🔥 @Fire Fan\n🎮 @Gamer\n```' + (errors.length ? '\n' + errors.join('\n') : ''));
    if (errors.length) return msg.reply('Please fix these first:\n' + errors.map(e => '• ' + e).join('\n'));
    if (mode === 'buttons' && pairs.length > 25) return msg.reply('At most 25 buttons per post.');
    if (pairs.length > 20 && mode === 'reaction') return msg.reply('Discord allows at most 20 different reactions per post.');

    // Der Bot muss die Rollen auch vergeben dürfen (Rollenhierarchie)
    const tooHigh = pairs.filter(p => guild.roles.cache.get(p.roleId).position >= me.roles.highest.position);
    if (tooHigh.length) return msg.reply('I can’t manage these roles — they are at or above my own role. Move **MoniaBot**’s role higher in Server Settings → Roles: ' + tooHigh.map(p => `**${p.roleName}**`).join(', '));
    const dangerous = pairs.filter(p => guild.roles.cache.get(p.roleId).permissions.has(PermissionsBitField.Flags.Administrator));
    if (dangerous.length) return msg.reply('Refusing: these roles have the Administrator permission: ' + dangerous.map(p => `**${p.roleName}**`).join(', '));

    let target;
    if (existingId) {
      try { target = await msg.channel.messages.fetch(existingId); } catch { return msg.reply('I can’t find that message in this channel.'); }
    } else {
      const embed = new EmbedBuilder().setColor(0x7e57c2).setTitle(description.split('\n')[0] || 'Pick your roles')
        .setDescription([description.split('\n').slice(1).join('\n').trim(), pairs.map(p => `${p.emoji} — <@&${p.roleId}>`).join('\n')].filter(Boolean).join('\n\n'));
      const payload = { embeds: [embed], allowedMentions: { parse: [] } };
      if (mode === 'buttons') {
        const rows = [];
        for (let i = 0; i < pairs.length; i += 5) {
          rows.push(new ActionRowBuilder().addComponents(pairs.slice(i, i + 5).map(p => {
            const b = new ButtonBuilder().setCustomId('rr:' + p.roleId).setLabel(p.roleName.slice(0, 80)).setStyle(ButtonStyle.Secondary);
            try { b.setEmoji(p.button); } catch { /* ohne Emoji */ }
            return b;
          })));
        }
        payload.components = rows;
      }
      target = await msg.channel.send(payload);
    }

    await db.setReactionRoles(guild.id, target.channelId, target.id, pairs, mode);
    if (mode === 'reaction') {
      for (const p of pairs) {
        try { await target.react(p.react); }
        catch (err) { await msg.channel.send(`⚠️ I couldn’t add ${p.emoji}: ${err.message}`); }
      }
    }
    try { await msg.delete(); } catch { /* egal */ }
    await ctx.modlog(guild, { title: '🎭 Reaction roles set up', description: `<@${msg.author.id}> in <#${msg.channel.id}> (${target.url})\n` + pairs.map(p => `${p.emoji} → ${p.roleName}`).join('\n') });
  });

  ctx.command('removereaction', { staff: true, help: '`!removeReaction <messageId>` — remove the reaction roles from a post' }, async (msg, args) => {
    if (!/^\d{15,25}$/.test(args[0] || '')) return msg.reply('Usage: `!removeReaction <messageId>`');
    const n = await db.removeReactionRoles(args[0]);
    return msg.reply(n ? 'Removed. The post stays, but the reactions no longer grant roles.' : 'That message has no reaction roles.');
  });

  ctx.command('listreactions', { staff: true, help: '`!listReactions` — list all reaction-role posts' }, async (msg) => {
    const rows = await db.reactionRoleMessages(msg.guild.id);
    if (!rows.length) return msg.reply('No reaction-role posts yet.');
    return msg.reply({ content: rows.map(r => `https://discord.com/channels/${msg.guild.id}/${r.channel_id}/${r.message_id} (${r.mode})`).join('\n'), allowedMentions: { parse: [] } });
  });

  // ── Reaktionen → Rollen ────────────────────────────────────
  async function onReaction(reaction, user, add) {
    if (user.bot) return;
    try {
      if (reaction.partial) reaction = await reaction.fetch();
      const message = reaction.message;
      if (!message.guildId || message.guildId !== config.guildId) return;
      const row = await db.reactionRole(message.id, emojiKey(reaction.emoji));
      if (!row || row.mode !== 'reaction') return;
      const member = await message.guild.members.fetch(user.id);
      if (add) await member.roles.add(row.role_id, 'MoniaBot: Reaction Role');
      else await member.roles.remove(row.role_id, 'MoniaBot: Reaction Role entfernt');
    } catch (err) {
      console.error('[reactionroles]', err.message);
      if (reaction && reaction.message && reaction.message.guild) {
        ctx.modlog(reaction.message.guild, { title: '⚠️ Reaction role failed', description: err.message });
      }
    }
  }
  client.on('messageReactionAdd', (r, u) => onReaction(r, u, true));
  client.on('messageReactionRemove', (r, u) => onReaction(r, u, false));
  // Wird der Beitrag gelöscht, räumen wir die Zuordnung auf.
  client.on('messageDelete', async (m) => { try { await db.removeReactionRoles(m.id); } catch { /* egal */ } });

  // ── Button-Variante ────────────────────────────────────────
  ctx.interactionHandlers.push(async (i) => {
    if (!i.isButton() || !i.customId.startsWith('rr:')) return false;
    const roleId = i.customId.slice(3);
    try {
      const row = await db.reactionRoleByRole(i.message.id, roleId);
      if (!row) { await i.reply({ content: 'This role post is no longer active.', flags: MessageFlags.Ephemeral }); return true; }
      const has = i.member.roles.cache.has(roleId);
      if (has) await i.member.roles.remove(roleId, 'MoniaBot: Reaction Role (Button)');
      else await i.member.roles.add(roleId, 'MoniaBot: Reaction Role (Button)');
      await i.reply({ content: has ? `Removed <@&${roleId}>.` : `You now have <@&${roleId}>.`, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
    } catch (err) {
      console.error('[reactionroles/button]', err.message);
      await i.reply({ content: 'I couldn’t change that role — please ping a moderator.', flags: MessageFlags.Ephemeral });
    }
    return true;
  });
};
