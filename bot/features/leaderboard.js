'use strict';
// ═══════════════════════════════════════════════════════════════════
//  Rangliste
//   !top [n]   die besten Spieler (max. 20), aus der öffentlichen Rangliste des Spiels
//   LEADERBOARD_CHANNEL_ID gesetzt → der Bot pflegt dort EINE Nachricht, die er regelmäßig aktualisiert
// ═══════════════════════════════════════════════════════════════════
const { EmbedBuilder } = require('discord.js');
const rolesLogic = require('../lib/roles-logic');

module.exports = function register(ctx) {
  const { client, config, db, game } = ctx;
  const MEDALS = ['🥇', '🥈', '🥉'];

  async function board(n) {
    const { players } = await game.leaderboard();
    const lines = players.slice(0, n).map(p => `${MEDALS[p.rank - 1] || `**${p.rank}.**`} **${p.username}** — ${p.elo} Elo · ${rolesLogic.rankFor(p.elo).name}`);
    return new EmbedBuilder().setColor(0xffc107).setTitle('🏆 Pixel Parties — Top players')
      .setDescription(lines.join('\n') || 'No ranked games yet.').setFooter({ text: 'Ranked Elo' }).setTimestamp();
  }

  ctx.command('top', { help: '`!top [n]` — leaderboard (top 10)' }, async (msg, args) => {
    const n = Math.min(20, Math.max(1, parseInt(args[0], 10) || 10));
    try { return await msg.reply({ embeds: [await board(n)], allowedMentions: { parse: [] } }); }
    catch { return msg.reply('The leaderboard isn’t available right now.'); }
  });

  async function updatePinned() {
    const id = config.channels.leaderboard;
    if (!id) return;
    const guild = client.guilds.cache.get(config.guildId);
    const ch = guild && (guild.channels.cache.get(id) || await guild.channels.fetch(id).catch(() => null));
    if (!ch || !ch.isTextBased()) return;
    const embed = await board(10);
    const saved = await db.kvGet('leaderboard_msg');
    if (saved && saved.channelId === id) {
      const m = await ch.messages.fetch(saved.messageId).catch(() => null);
      if (m) { await m.edit({ embeds: [embed] }); return; }
    }
    const m = await ch.send({ embeds: [embed] });
    await db.kvSet('leaderboard_msg', { channelId: id, messageId: m.id });
  }

  ctx.onReady.push(() => {
    const run = () => updatePinned().catch(e => console.error('[leaderboard]', e.message));
    const t = setInterval(run, Math.max(1, config.leaderboardMinutes) * 60 * 1000);
    t.unref && t.unref();
    setTimeout(run, 25 * 1000).unref();
  });
};
