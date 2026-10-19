'use strict';
// ═══════════════════════════════════════════════════════════════════
//  MoniaBot — Discord-Bot für den Pixel-Parties-Server
//  Start: `node index.js` (im Betrieb als systemd-Dienst `moniabot`, siehe deploy/ und docs/MONIABOT.md)
// ═══════════════════════════════════════════════════════════════════
const { Client, GatewayIntentBits, Partials, PermissionsBitField, MessageFlags } = require('discord.js');
const config = require('./config');
const { openDb } = require('./lib/db');
const { createGameApi } = require('./lib/game-api');
const { createContext } = require('./lib/context');

const INVITE_PERMISSIONS = new PermissionsBitField([
  'ViewChannel', 'SendMessages', 'EmbedLinks', 'AttachFiles', 'AddReactions', 'ReadMessageHistory', 'UseExternalEmojis',
  'ManageMessages',     // Nachrichten löschen (Moderation)
  'ModerateMembers',    // Timeout
  'BanMembers',         // Bann nach drei Strikes
  'ManageRoles',        // Reaction Roles, Rang-Rollen
  'ManageNicknames',    // optional: Spitznamen-Abgleich
  'ManageGuild',        // optional: AutoMod-Regel, Raid-Schutz (Verifizierungsstufe)
]);
const inviteUrl = () => `https://discord.com/oauth2/authorize?client_id=${config.clientId}&scope=bot%20applications.commands&permissions=${INVITE_PERMISSIONS.bitfield}`;

async function main() {
  if (process.argv.includes('--invite')) { console.log(inviteUrl()); return; }

  const problems = [];
  if (!config.token) problems.push('DISCORD_TOKEN fehlt');
  if (!config.guildId) problems.push('GUILD_ID fehlt (Rechtsklick auf den Server → Server-ID kopieren)');
  if (!config.botSecret) problems.push('BOT_SECRET fehlt (muss mit dem des Spielservers übereinstimmen)');
  if (problems.length) { console.error('Konfiguration unvollständig:\n - ' + problems.join('\n - ')); process.exit(1); }

  const db = openDb(config.dataDir);
  await db.init();
  const game = createGameApi({ baseUrl: config.gameApiUrl, secret: config.botSecret });
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,            // privilegiert: Beitritte, Rollenabgleich
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,          // privilegiert: !Befehle, Links lesen
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.GuildModeration,
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.User, Partials.GuildMember],
    allowedMentions: { parse: [], repliedUser: false },
  });

  const ctx = createContext({ client, config, db, game });

  client.on('messageCreate', async (msg) => {
    try { await ctx.handleMessage(msg); }
    catch (err) { console.error('[messageCreate]', err); }
  });

  // ── Knöpfe und Slash-Befehle ──
  client.on('interactionCreate', async (i) => {
    try {
      if (i.guildId !== config.guildId) return;
      for (const h of ctx.interactionHandlers) if (await h(i)) return;
    } catch (err) {
      console.error('[interactionCreate]', err);
      try {
        const text = 'Something went wrong — please try again.';
        if (i.deferred || i.replied) await i.followUp({ content: text, flags: MessageFlags.Ephemeral });
        else await i.reply({ content: text, flags: MessageFlags.Ephemeral });
      } catch { /* Interaktion abgelaufen */ }
    }
  });

  client.once('clientReady', async () => {
    console.log(`[bot] angemeldet als ${client.user.tag}, Server ${config.guildId}`);
    const guild = client.guilds.cache.get(config.guildId);
    if (!guild) {
      console.error('[bot] Der Bot ist nicht auf dem Server mit der GUILD_ID! Einladung:\n' + inviteUrl());
      process.exit(1);
    }
    for (const other of client.guilds.cache.values()) {
      if (other.id !== config.guildId) { console.warn('[bot] verlasse fremden Server', other.name); await other.leave().catch(() => {}); }
    }
    await guild.members.fetch().catch(err => console.warn('[bot] Mitgliederliste:', err.message));
    try { await guild.commands.set(ctx.slashCommands); }
    catch (err) { console.error('[bot] Slash-Befehle:', err.message); }
    for (const fn of ctx.onReady) { try { fn(); } catch (err) { console.error('[bot] onReady:', err); } }
  });

  client.on('error', err => console.error('[client]', err));
  process.on('unhandledRejection', err => console.error('[unhandledRejection]', err));
  process.on('SIGTERM', async () => { await client.destroy(); process.exit(0); });
  process.on('SIGINT', async () => { await client.destroy(); process.exit(0); });

  await client.login(config.token);
}

if (require.main === module) main().catch(err => { console.error(err); process.exit(1); });
module.exports = { inviteUrl, INVITE_PERMISSIONS };
