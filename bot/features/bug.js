'use strict';
// ═══════════════════════════════════════════════════════════════════
//  /bug — Fehlermeldung per Slash-Befehl
//  Landet als Embed im Team-Kanal (BUG_CHANNEL_ID) und, wenn GITHUB_TOKEN gesetzt ist, zusätzlich als
//  GitHub-Issue (GITHUB_REPO). Vorschläge laufen weiter über die bestehende Infrastruktur.
// ═══════════════════════════════════════════════════════════════════
const { EmbedBuilder, SlashCommandBuilder, MessageFlags } = require('discord.js');

module.exports = function register(ctx) {
  const { client, config } = ctx;
  const cooldown = new Map();

  ctx.slashCommands.push(new SlashCommandBuilder().setName('bug').setDescription('Report a bug in Pixel Parties')
    .addStringOption(o => o.setName('title').setDescription('Short summary').setRequired(true).setMaxLength(100))
    .addStringOption(o => o.setName('description').setDescription('What happened? What did you expect? How can we reproduce it?').setRequired(true).setMaxLength(1500))
    .addAttachmentOption(o => o.setName('screenshot').setDescription('Optional screenshot')));

  async function createIssue({ title, description, reporter, screenshotUrl }) {
    const body = `${description}\n\n${screenshotUrl ? `Screenshot: ${screenshotUrl}\n\n` : ''}*Reported via Discord by ${reporter}.*`;
    const res = await fetch(`https://api.github.com/repos/${config.githubRepo}/issues`, {
      method: 'POST',
      headers: { authorization: `Bearer ${config.githubToken}`, accept: 'application/vnd.github+json', 'content-type': 'application/json', 'user-agent': 'MoniaBot' },
      body: JSON.stringify({ title: `[Discord] ${title}`.slice(0, 200), body, labels: ['bug'] }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error('GitHub ' + res.status);
    return (await res.json()).html_url;
  }

  ctx.interactionHandlers.push(async (i) => {
    if (!i.isChatInputCommand() || i.commandName !== 'bug') return false;
    const last = cooldown.get(i.user.id) || 0;
    if (Date.now() - last < 60000) { await i.reply({ content: 'Thanks — please wait a minute before sending another report.', flags: MessageFlags.Ephemeral }); return true; }
    cooldown.set(i.user.id, Date.now());
    await i.deferReply({ flags: MessageFlags.Ephemeral });

    const title = i.options.getString('title', true);
    const description = i.options.getString('description', true);
    const shot = i.options.getAttachment('screenshot');
    const screenshotUrl = shot && /^image\//.test(shot.contentType || '') ? shot.url : null;

    let issueUrl = null;
    if (config.githubToken) { try { issueUrl = await createIssue({ title, description, reporter: i.user.tag || i.user.username, screenshotUrl }); } catch (err) { console.error('[bug] GitHub:', err.message); } }

    const e = new EmbedBuilder().setColor(0xe53935).setTitle(('🐞 ' + title).slice(0, 250)).setDescription(description)
      .setAuthor({ name: i.user.tag || i.user.username, iconURL: i.user.displayAvatarURL() }).setTimestamp();
    if (screenshotUrl) e.setImage(screenshotUrl);
    if (issueUrl) e.addFields({ name: 'GitHub', value: issueUrl });
    let delivered = !!issueUrl;
    const id = config.channels.bugs;
    if (id) {
      try {
        const ch = await client.channels.fetch(id);
        await ch.send({ embeds: [e], allowedMentions: { parse: [] } });
        delivered = true;
      } catch (err) { console.error('[bug] Kanal:', err.message); }
    }
    console.log(`[bug] ${i.user.tag}: ${title}`);
    await i.editReply(delivered ? 'Thanks! Your bug report was sent to the team. 🐞' : 'Thanks! I noted your report, but couldn’t deliver it to the team channel — please ping a moderator as well.');
    return true;
  });
};
