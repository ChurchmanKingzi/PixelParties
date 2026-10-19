'use strict';
// ═══════════════════════════════════════════════════════════════════
//  Moderation
//
//  1. „Nuh-uh“: Mitglied seit weniger als einem halben Jahr pingt @everyone/@here/eine Rolle UND
//     die Nachricht enthält einen Link → Nachricht wird gelöscht, MoniaBot antwortet
//     „Nuh-uh, not cool, @Nutzer!“, der Nutzer wird eine Stunde stummgeschaltet (Discord-Timeout).
//  2. Phishing-/Scam-Links (Liste + Lookalikes) werden unabhängig von der Mitgliedsdauer behandelt wie 1.
//  3. Strikes: jede dieser Taten ist ein Strike. Beim dritten GÜLTIGEN Strike folgt der Bann.
//     Strikes verfallen nach 90 Tagen (bleiben zur Einsicht gespeichert, zählen aber nicht mehr).
//  4. Raid-Schutz: viele Beitritte in kurzer Zeit → Warnung im Mod-Log, optional Verifizierungsstufe
//     vorübergehend anheben.
//  5. Mod-Log: Strikes, Timeouts, Bans, Raid-Alarme, Rollenänderungen des Bots.
//  Admins (Creator / Deputy Monia [MOD]) und Mitglieder mit Administrator-/Nachrichten-verwalten-Recht
//  sind ausgenommen.
//
//  GRENZE (Discord): Ein Bot kann eine Nachricht nicht vor dem Senden abfangen, nur Sekundenbruchteile
//  danach löschen. `!setupAutomod` legt zusätzlich eine AutoMod-Regel an, die „@everyone/@here + Link“
//  wirklich VOR dem Senden blockt (gilt dann für alle, nicht nur neue Mitglieder).
// ═══════════════════════════════════════════════════════════════════
const path = require('path');
const { EmbedBuilder, PermissionsBitField, AutoModerationRuleEventType, AutoModerationRuleTriggerType, AutoModerationActionType, VerificationLevel } = require('discord.js');
const scam = require('../lib/scam');

const COLORS = { warn: 0xf0a020, ban: 0xd32f2f, info: 0x4a90d9, ok: 0x43a047 };

module.exports = function register(ctx) {
  const { client, config, db, helpers } = ctx;
  const blocked = scam.loadBlockedDomains(path.join(config.dataDir, 'blocked-domains.txt'));

  // ── Mod-Log ────────────────────────────────────────────────
  ctx.modlog = async function modlog(guild, { title, description, color = COLORS.info, fields = [] }) {
    console.log(`[modlog] ${title}${description ? ' — ' + description.replace(/\n/g, ' | ') : ''}`);
    const id = config.channels.modlog;
    if (!id) return;
    try {
      const ch = guild.channels.cache.get(id) || await guild.channels.fetch(id);
      if (!ch || !ch.isTextBased()) return;
      const e = new EmbedBuilder().setTitle(helpers.clip(title, 250)).setColor(color).setTimestamp();
      if (description) e.setDescription(helpers.clip(description, 3500));
      if (fields.length) e.addFields(fields.map(f => ({ name: helpers.clip(f.name, 250), value: helpers.clip(f.value, 1000) || '—', inline: !!f.inline })));
      await ch.send({ embeds: [e], allowedMentions: { parse: [] } });
    } catch (err) { console.error('[modlog] senden fehlgeschlagen:', err.message); }
  };

  // ── Strike-Verfahren ───────────────────────────────────────
  /**
   * Führt die Maßnahme aus. `member`/`message` dürfen schon gelöscht sein. Gibt die Anzahl gültiger Strikes zurück.
   * Reihenfolge: Nachricht löschen → Strike buchen → Antwort → Timeout bzw. Bann → Mod-Log.
   */
  async function punish({ guild, member, message, reason, note }) {
    const user = member.user;
    const content = message ? message.content : '';
    try { if (message && message.deletable) await message.delete(); } catch (err) { console.error('[mod] löschen:', err.message); }

    await db.addStrike(guild.id, user.id, reason, scam.defang(content));
    const active = await db.activeStrikes(guild.id, user.id, config.strikeExpiryDays);
    const count = active.length;
    const banNow = count >= config.strikeLimit;

    // Antwort im selben Kanal (der Nutzer wird angepingt, sonst niemand)
    try {
      if (message && message.channel && message.channel.isTextBased()) {
        const text = reason === 'phishing'
          ? `Nuh-uh, not cool, <@${user.id}>! That link is not welcome here.`
          : `Nuh-uh, not cool, <@${user.id}>!`;
        await message.channel.send({ content: text, allowedMentions: { users: [user.id] } });
      }
    } catch (err) { console.error('[mod] antworten:', err.message); }

    let action = '';
    if (banNow) {
      try {
        await guild.members.ban(user.id, { reason: `MoniaBot: ${count} Strikes (zuletzt: ${reason})`, deleteMessageSeconds: 3600 });
        action = '🔨 **Banned**';
      } catch (err) {
        action = '⚠️ Ban failed: ' + err.message;
        try { await member.timeout(config.muteMinutes * 60 * 1000, 'MoniaBot: Bann fehlgeschlagen, ersatzweise Timeout'); action += ` — muted for ${config.muteMinutes} min instead`; } catch { /* nichts zu machen */ }
      }
    } else {
      try {
        await member.timeout(config.muteMinutes * 60 * 1000, `MoniaBot: ${reason} (Strike ${count}/${config.strikeLimit})`);
        action = `🔇 Muted for ${config.muteMinutes} min`;
      } catch (err) { action = '⚠️ Timeout failed: ' + err.message; }
    }

    await ctx.modlog(guild, {
      title: banNow ? '🔨 Ban after repeated violations' : '🚫 Message blocked',
      color: banNow ? COLORS.ban : COLORS.warn,
      description: `<@${user.id}> (${user.tag || user.username}, ${user.id})\n${action}`,
      fields: [
        { name: 'Reason', value: reason === 'phishing' ? 'Phishing/scam link' : 'New member: ping + link', inline: true },
        { name: 'Active strikes', value: `${count}/${config.strikeLimit}`, inline: true },
        { name: 'Channel', value: message && message.channel ? `<#${message.channel.id}>` : '—', inline: true },
        { name: 'Content (defanged)', value: '```' + (scam.defang(content, 500) || '—') + '```' },
        ...(note ? [{ name: 'Note', value: note }] : []),
      ],
    });
    return count;
  }

  // ── Prüfung einer Nachricht ────────────────────────────────
  /** @returns {Promise<boolean>} true = die Nachricht wurde behandelt (gelöscht) */
  async function check(message) {
    if (!message.guild || message.author.bot || message.system) return false;
    const text = message.content || '';
    if (!text) return false;
    const link = scam.hasLink(text);
    if (!link) return false;                       // beide Regeln brauchen einen Link
    let member = message.member;
    if (!member) { try { member = await message.guild.members.fetch(message.author.id); } catch { return false; } }
    if (helpers.isExempt(member)) return false;

    const phishing = scam.isPhishing(text, blocked);
    const newPing = scam.isNewMember(member.joinedTimestamp, Date.now(), config.newMemberDays)
      && scam.hasMassPing(text, message.mentions);
    if (!phishing && !newPing) return false;

    await punish({ guild: message.guild, member, message, reason: phishing ? 'phishing' : 'newmember-ping-link' });
    return true;
  }

  ctx.messageFilters.push(check);
  client.on('messageUpdate', async (_old, updated) => {
    try {
      const m = updated.partial ? await updated.fetch() : updated;
      if (m.guild && m.guild.id === config.guildId) await check(m);
    } catch { /* Nachricht weg */ }
  });

  // ── Raid-Schutz ────────────────────────────────────────────
  const joins = [];
  let lockdownTimer = null;
  client.on('guildMemberAdd', async (member) => {
    if (member.guild.id !== config.guildId) return;
    const now = Date.now();
    joins.push(now);
    while (joins.length && now - joins[0] > config.raidWindowSec * 1000) joins.shift();
    if (joins.length < config.raidJoins || lockdownTimer) return;

    const guild = member.guild;
    let lock = '';
    const prev = guild.verificationLevel;
    if (config.raidLockdownMinutes > 0 && prev < VerificationLevel.VeryHigh) {
      try {
        await guild.setVerificationLevel(VerificationLevel.VeryHigh, 'MoniaBot: Raid-Verdacht');
        lock = `\nVerification level temporarily raised to **Very High** (back to normal in ${config.raidLockdownMinutes} min).`;
      } catch (err) { lock = '\n⚠️ Couldn’t raise the verification level: ' + err.message; }
    }
    lockdownTimer = setTimeout(async () => {
      lockdownTimer = null;
      if (lock.includes('Very High')) { try { await guild.setVerificationLevel(prev, 'MoniaBot: Raid-Schutz beendet'); } catch { /* egal */ } }
    }, Math.max(1, config.raidLockdownMinutes) * 60 * 1000);
    lockdownTimer.unref && lockdownTimer.unref();

    await ctx.modlog(guild, {
      title: '🚨 Possible raid',
      color: COLORS.ban,
      description: `${joins.length} joins within ${config.raidWindowSec} s.${lock}\nCheck the newest members (Server Settings → Members, sort by join date).`,
    });
  });

  // ── Befehle für Admins ─────────────────────────────────────
  const targetUser = async (msg, args) => {
    const id = msg.mentions.users.first()?.id || args.find(a => /^\d{15,25}$/.test(a)) || (args[0] || '').replace(/[<@!>]/g, '');
    if (!/^\d{15,25}$/.test(id)) return null;
    try { return await client.users.fetch(id); } catch { return null; }
  };

  ctx.command('strikes', { staff: true, help: '`!strikes @user` — show a user’s strikes (active and expired)' }, async (msg, args) => {
    const user = await targetUser(msg, args);
    if (!user) return msg.reply('Usage: `!strikes @user`');
    const all = await db.allStrikes(msg.guild.id, user.id);
    const cutoff = Math.floor(Date.now() / 1000) - config.strikeExpiryDays * 86400;
    const active = all.filter(s => s.created_at > cutoff).length;
    const lines = all.slice(-15).map(s => `<t:${s.created_at}:d> — ${s.reason === 'phishing' ? 'Phishing' : 'Ping + link'}${s.created_at > cutoff ? '' : ' *(expired)*'}`);
    const e = new EmbedBuilder().setColor(active ? COLORS.warn : COLORS.ok)
      .setTitle(`Strikes: ${user.username}`)
      .setDescription(`Active: **${active}/${config.strikeLimit}** (strikes expire after ${config.strikeExpiryDays} days)\n\n${lines.join('\n') || 'No entries.'}`);
    return msg.reply({ embeds: [e], allowedMentions: { parse: [] } });
  });

  ctx.command('clearstrikes', { staff: true, help: '`!clearstrikes @user` — delete all of a user’s strikes' }, async (msg, args) => {
    const user = await targetUser(msg, args);
    if (!user) return msg.reply('Usage: `!clearstrikes @user`');
    const n = await db.clearStrikes(msg.guild.id, user.id);
    await ctx.modlog(msg.guild, { title: '🧹 Strikes cleared', color: COLORS.ok, description: `<@${user.id}>: ${n} entr${n === 1 ? 'y' : 'ies'} cleared by <@${msg.author.id}>.` });
    return msg.reply({ content: `Cleared ${n} strike(s) for **${user.username}**.`, allowedMentions: { parse: [] } });
  });

  ctx.command('setupautomod', { staff: true, help: '`!setupAutomod` — create an AutoMod rule that blocks “@everyone/@here + link” before it is sent' }, async (msg) => {
    const exempt = msg.guild.roles.cache.filter(r => helpers.isStaffRole(r)).map(r => r.id).slice(0, 20);
    try {
      const existing = (await msg.guild.autoModerationRules.fetch()).find(r => r.name === 'MoniaBot: no @everyone + link');
      if (existing) return msg.reply('The AutoMod rule already exists.');
      await msg.guild.autoModerationRules.create({
        name: 'MoniaBot: no @everyone + link',
        eventType: AutoModerationRuleEventType.MessageSend,
        triggerType: AutoModerationRuleTriggerType.Keyword,
        triggerMetadata: { regexPatterns: ['@(everyone|here).*(https?://|www\\.|discord\\.gg/)', '(https?://|www\\.|discord\\.gg/).*@(everyone|here)'] },
        actions: [{ type: AutoModerationActionType.BlockMessage, metadata: { customMessage: 'Nuh-uh, not cool!' } }],
        enabled: true,
        exemptRoles: exempt,
        reason: 'MoniaBot setup',
      });
      return msg.reply('✅ AutoMod rule created: messages with @everyone/@here **and** a link are now blocked before they are sent (staff roles exempt).');
    } catch (err) {
      return msg.reply('⚠️ Could not create the rule (the bot needs the **Manage Server** permission): ' + err.message);
    }
  });

  ctx.blockedDomains = blocked;
  ctx._moderation = { check, punish };
};
