'use strict';
// ═══════════════════════════════════════════════════════════════════
//  !duel — offene Herausforderung im Chat
//  Das Spiel hat keine Einladungs-Links; Partien werden im Spiel selbst verabredet
//  (Who’s Online → Challenge). Der Bot vermittelt: Herausforderung posten, Annehmen-Knopf, danach
//  erfahren beide, wen sie im Spiel suchen müssen (Spielname, falls verknüpft).
// ═══════════════════════════════════════════════════════════════════
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags } = require('discord.js');

const TTL_MS = 30 * 60 * 1000;

module.exports = function register(ctx) {
  const { client, config, game } = ctx;
  const open = new Map();   // messageId → { challengerId, timer }

  async function gameName(discordId) {
    try { return (await game.user(discordId)).user.username; } catch { return null; }
  }

  ctx.command('duel', { help: '`!duel` — post an open challenge; whoever clicks “Accept” duels you' }, async (msg) => {
    const name = await gameName(msg.author.id);
    const e = new EmbedBuilder().setColor(0xef5350).setTitle('⚔️ Duel challenge!')
      .setDescription(`<@${msg.author.id}> is looking for a duel${name ? ` (in-game: **${name}**)` : ''}.\nPress **Accept**, then meet in the game — **Who’s Online → Challenge** — ${config.gameUrl}`)
      .setFooter({ text: 'Open for 30 minutes' });
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('duel:accept').setLabel('Accept').setEmoji('⚔️').setStyle(ButtonStyle.Danger));
    const post = await msg.channel.send({ embeds: [e], components: [row], allowedMentions: { parse: [] } });
    const timer = setTimeout(async () => {
      open.delete(post.id);
      try { await post.edit({ embeds: [e.setFooter({ text: 'Expired' })], components: [] }); } catch { /* weg */ }
    }, TTL_MS);
    timer.unref && timer.unref();
    open.set(post.id, { challengerId: msg.author.id, timer });
    try { await msg.delete(); } catch { /* egal */ }
  });

  ctx.interactionHandlers.push(async (i) => {
    if (!i.isButton() || i.customId !== 'duel:accept') return false;
    const d = open.get(i.message.id);
    const reply = text => i.reply({ content: text, flags: MessageFlags.Ephemeral });
    if (!d) { await reply('This challenge has expired.'); return true; }
    if (d.challengerId === i.user.id) { await reply('You can’t accept your own challenge 😄'); return true; }
    open.delete(i.message.id);
    clearTimeout(d.timer);
    const [a, b] = await Promise.all([gameName(d.challengerId), gameName(i.user.id)]);
    const find = (n, id) => (n ? `**${n}**` : `<@${id}> (not linked — ask for their in-game name)`);
    await i.update({ components: [], embeds: [EmbedBuilder.from(i.message.embeds[0]).setFooter({ text: 'Accepted' })] });
    await i.channel.send({
      content: `⚔️ <@${i.user.id}> accepted <@${d.challengerId}>’s challenge!\nIn the game: ${find(a, d.challengerId)} ⇄ ${find(b, i.user.id)} — open **Who’s Online** and send a challenge. Good luck!`,
      allowedMentions: { users: [i.user.id, d.challengerId] },
    });
    return true;
  });
};
