'use strict';
// ═══════════════════════════════════════════════════════════════════
//  Turniere (K.-o.-System)
//   !tournament create <Name>   (Admin) Anmeldung eröffnen — Spieler tragen sich per Button ein
//   !tournament start           (Admin) auslosen, Bracket posten, erste Paarungen ankündigen
//   !tournament win @Sieger     (Admin) Ergebnis eintragen → nächste Paarungen / Sieger
//   !tournament dq @Nutzer      (Admin) ausschließen (Gegner gewinnt)
//   !tournament bracket         jeder: aktueller Stand
//   !tournament cancel          (Admin) abbrechen
//  Die Spiele selbst laufen im Spiel (Who’s Online → Challenge); die Ergebnisse trägt ein Admin ein.
// ═══════════════════════════════════════════════════════════════════
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags } = require('discord.js');
const bracket = require('../lib/bracket');

module.exports = function register(ctx) {
  const { client, config, db, helpers } = ctx;
  const COLOR = 0x26a69a;

  const signupRow = (disabled = false) => new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('tn:join').setLabel('Join').setEmoji('⚔️').setStyle(ButtonStyle.Success).setDisabled(disabled),
    new ButtonBuilder().setCustomId('tn:leave').setLabel('Leave').setStyle(ButtonStyle.Secondary).setDisabled(disabled));

  function signupEmbed(state) {
    return new EmbedBuilder().setColor(COLOR).setTitle(`🏆 ${state.name}`)
      .setDescription(`Sign-up is open! Press **Join** to take part.\nSingle elimination — you play in the game (Who’s Online → Challenge), an admin enters the results.\n\n**Players (${state.players.length}):**\n${state.players.map(p => `<@${p}>`).join(', ') || '*nobody yet*'}`.slice(0, 4000));
  }
  function bracketEmbed(state) {
    const e = new EmbedBuilder().setColor(COLOR).setTitle(`🏆 ${state.name}`);
    for (const r of bracket.describe(state)) e.addFields({ name: r.title, value: r.text.slice(0, 1020) || '—' });
    if (state.champion) e.setDescription(`👑 **Champion:** <@${state.champion}>`);
    return e;
  }
  const matchLines = matches => matches.filter(m => m.b).map(m => `⚔️ <@${m.a}> vs <@${m.b}>`).join('\n');
  const ping = matches => ({ users: [...new Set(matches.flatMap(m => [m.a, m.b]).filter(Boolean))].slice(0, 100) });

  async function refreshSignup(state, guild) {
    try {
      const ch = await guild.channels.fetch(state.channelId);
      const m = await ch.messages.fetch(state.messageId);
      await m.edit({ embeds: [signupEmbed(state)], components: [signupRow(state.status !== 'signup')], allowedMentions: { parse: [] } });
    } catch { /* Beitrag gelöscht */ }
  }

  async function announce(msg, state, newMatches, note) {
    const lines = [];
    if (note) lines.push(note);
    if (state.champion) lines.push(`🏆 **${state.name}** is over! Congratulations <@${state.champion}> — champion! 👑`);
    else if (newMatches && newMatches.length) lines.push(`**Next matches:**\n${matchLines(newMatches)}`);
    await msg.channel.send({ content: lines.join('\n\n') || undefined, embeds: [bracketEmbed(state)], allowedMentions: ping(newMatches || []) });
  }

  const userArg = (msg, args) => msg.mentions.users.first()?.id || args.find(a => /^\d{15,25}$/.test(a));

  async function cmd(msg, args, rest) {
    const guild = msg.guild;
    const sub = (args[0] || '').toLowerCase();
    const cur = await db.activeTournament(guild.id);
    const staff = helpers.isStaff(msg.member);
    const needStaff = () => !staff && (msg.reply('Only Creator / Deputy Monia [MOD] can do that.'), true);

    if (sub === 'create') {
      if (needStaff()) return;
      if (cur) return msg.reply('There is already a tournament (' + cur.state.name + '). `!tournament cancel` it first.');
      const name = rest.replace(/^create\s*/i, '').trim().slice(0, 80) || 'Pixel Parties Tournament';
      const state = { name, status: 'signup', players: [], rounds: [], champion: null, channelId: msg.channel.id, messageId: null };
      const post = await msg.channel.send({ embeds: [signupEmbed(state)], components: [signupRow()], allowedMentions: { parse: [] } });
      state.messageId = post.id;
      await db.createTournament(guild.id, state);
      try { await msg.delete(); } catch { /* egal */ }
      return;
    }
    if (!cur) return msg.reply('No tournament is running. An admin can start one with `!tournament create <name>`.');
    const { id, state } = cur;

    if (sub === 'start') {
      if (needStaff()) return;
      if (state.status !== 'signup') return msg.reply('The tournament has already started.');
      if (state.players.length < 2) return msg.reply('At least 2 players are needed.');
      bracket.start(state);
      await db.saveTournament(id, state);
      await refreshSignup(state, guild);
      return announce(msg, state, bracket.pendingMatches(state), `🏁 **${state.name}** starts now with ${state.players.length} players! Challenge each other in the game, an admin enters the results.`);
    }
    if (sub === 'win' || sub === 'report') {
      if (needStaff()) return;
      const uid = userArg(msg, args.slice(1));
      if (!uid) return msg.reply('Usage: `!tournament win @winner`');
      const r = bracket.report(state, uid);
      if (!r.ok) return msg.reply(r.error);
      await db.saveTournament(id, state, state.status !== 'finished');
      return announce(msg, state, r.newMatches, `✅ <@${uid}> wins their match!`);
    }
    if (sub === 'dq' || sub === 'remove') {
      if (needStaff()) return;
      const uid = userArg(msg, args.slice(1));
      if (!uid) return msg.reply('Usage: `!tournament dq @user`');
      const r = bracket.disqualify(state, uid);
      if (!r.ok) return msg.reply(r.error);
      await db.saveTournament(id, state, state.status !== 'finished');
      if (state.status === 'signup') { await refreshSignup(state, guild); return msg.reply({ content: `Removed <@${uid}> from the sign-up.`, allowedMentions: { parse: [] } }); }
      return announce(msg, state, r.newMatches, `🚫 <@${uid}> was disqualified.`);
    }
    if (sub === 'cancel') {
      if (needStaff()) return;
      state.status = 'cancelled';
      await db.saveTournament(id, state, false);
      await refreshSignup(state, guild);
      return msg.reply(`**${state.name}** was cancelled.`);
    }
    if (sub === 'bracket' || sub === 'show' || !sub) {
      if (state.status === 'signup') return msg.reply({ embeds: [signupEmbed(state)], allowedMentions: { parse: [] } });
      return msg.reply({ embeds: [bracketEmbed(state)], allowedMentions: { parse: [] } });
    }
    return msg.reply('Usage: `!tournament create <name>` · `start` · `win @user` · `dq @user` · `bracket` · `cancel`');
  }

  ctx.command('tournament', { aliases: ['tourney'], help: '`!tournament bracket` — current tournament; admins: `create <name>`, `start`, `win @user`, `dq @user`, `cancel`' }, (msg, args, rest) => cmd(msg, args, rest));

  ctx.interactionHandlers.push(async (i) => {
    if (!i.isButton() || !i.customId.startsWith('tn:')) return false;
    const cur = await db.activeTournament(i.guildId);
    const reply = text => i.reply({ content: text, flags: MessageFlags.Ephemeral });
    if (!cur || cur.state.messageId !== i.message.id) { await reply('This sign-up is no longer active.'); return true; }
    const { id, state } = cur;
    if (state.status !== 'signup') { await reply('Sign-up is closed.'); return true; }
    const joined = state.players.includes(i.user.id);
    if (i.customId === 'tn:join') {
      if (joined) { await reply('You’re already in!'); return true; }
      if (state.players.length >= 128) { await reply('The tournament is full.'); return true; }
      state.players.push(i.user.id);
    } else {
      if (!joined) { await reply('You’re not signed up.'); return true; }
      state.players = state.players.filter(p => p !== i.user.id);
    }
    await db.saveTournament(id, state);
    await i.update({ embeds: [signupEmbed(state)], components: [signupRow()], allowedMentions: { parse: [] } });
    return true;
  });
};
