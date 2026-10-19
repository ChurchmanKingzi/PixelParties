'use strict';
// ═══════════════════════════════════════════════════════════════════
//  Willkommen
//   • Begrüßung neuer Mitglieder (Text laut Vorgabe) im Willkommens-Kanal (oder Systemkanal)
//   • optional: Startrolle „Newcomer“ (NEWCOMER_ROLE_ID) und kurze DM (WELCOME_DM=1)
//   • optional: `!setupRules <Text>` — Regel-Nachricht mit Button „I agree“, der die Newcomer-Rolle
//     entfernt und die Verified-Rolle (VERIFIED_ROLE_ID) vergibt
// ═══════════════════════════════════════════════════════════════════
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags } = require('discord.js');

module.exports = function register(ctx) {
  const { client, config } = ctx;

  const welcomeText = (userId) =>
    `Heya, <@${userId}>!\n` +
    'Welcome to Pixel Planet!\n\n' +
    `Make sure to check out Pixel Parties online at ${config.gameUrl} and look around the server to meet other players, see new cards as they are added, discuss the game, or suggest your very own ideas!\n\n` +
    'Have a **cool** time!';
  ctx.welcomeText = welcomeText;

  client.on('guildMemberAdd', async (member) => {
    if (member.guild.id !== config.guildId || member.user.bot) return;
    const guild = member.guild;

    if (config.newcomerRoleId) {
      try { await member.roles.add(config.newcomerRoleId, 'MoniaBot: Newcomer'); }
      catch (err) { console.error('[welcome] Newcomer-Rolle:', err.message); }
    }

    try {
      const id = config.channels.welcome;
      const ch = (id && (guild.channels.cache.get(id) || await guild.channels.fetch(id))) || guild.systemChannel;
      if (ch && ch.isTextBased()) await ch.send({ content: welcomeText(member.id), allowedMentions: { users: [member.id] } });
      else console.warn('[welcome] kein Kanal gefunden — WELCOME_CHANNEL_ID setzen oder einen Systemkanal wählen');
    } catch (err) { console.error('[welcome] senden fehlgeschlagen:', err.message); }

    if (config.welcomeDm) {
      try { await member.send(`Heya! Welcome to **${guild.name}**! Pixel Parties is online at ${config.gameUrl} — have a **cool** time!`); }
      catch { /* DMs zu */ }
    }
  });

  ctx.command('setuprules', { staff: true, help: '`!setupRules <text>` — post the rules with an “I agree” button' }, async (msg, args, rest) => {
    if (!rest) return msg.reply('Usage: `!setupRules <rules text>` (multi-line is fine)');
    const embed = new EmbedBuilder().setTitle('Server rules').setDescription(rest.slice(0, 4000)).setColor(0x7e57c2);
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('rules:accept').setLabel('I agree').setEmoji('✅').setStyle(ButtonStyle.Success));
    await msg.channel.send({ embeds: [embed], components: [row] });
    try { await msg.delete(); } catch { /* egal */ }
  });

  ctx.interactionHandlers.push(async (i) => {
    if (!i.isButton() || i.customId !== 'rules:accept') return false;
    const member = i.member;
    try {
      if (config.verifiedRoleId) await member.roles.add(config.verifiedRoleId, 'MoniaBot: rules accepted');
      if (config.newcomerRoleId) await member.roles.remove(config.newcomerRoleId, 'MoniaBot: rules accepted');
      await i.reply({ content: 'Thanks! Have a **cool** time! 😎', flags: MessageFlags.Ephemeral });
    } catch (err) {
      console.error('[rules]', err.message);
      await i.reply({ content: 'Something went wrong — please ping a moderator.', flags: MessageFlags.Ephemeral });
    }
    return true;
  });
};
