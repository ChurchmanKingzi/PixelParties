'use strict';
// ═══════════════════════════════════════════════════════════════════
//  Gemeinsamer Kontext der Funktionsmodule + Nachrichtenverteilung.
//  Eigene Datei (statt in index.js), damit Tests den Bot ohne Discord-Anmeldung zusammenbauen können.
// ═══════════════════════════════════════════════════════════════════
const { createHelpers } = require('./util');

const FEATURES = ['moderation', 'welcome', 'reactionroles', 'cards', 'account', 'leaderboard', 'feeds', 'duel', 'deck', 'tournament', 'mystery', 'pixle', 'bug'];

function createContext({ client, config, db, game }) {
  const helpers = createHelpers(config);
  const commands = new Map();
  const ctx = {
    client, config, db, game, helpers,
    commands, messageFilters: [], messageHandlers: [], interactionHandlers: [], onReady: [], slashCommands: [],
    command(name, opts, handler) {
      const entry = { name, ...opts, handler };
      commands.set(name.toLowerCase(), entry);
      for (const a of opts.aliases || []) commands.set(a.toLowerCase(), entry);
    },
    modlog: async () => {},   // von moderation.js ersetzt
  };
  for (const f of FEATURES) require('../features/' + f)(ctx);

  ctx.command('help', { help: '`!help` — this overview' }, async (msg) => {
    const staff = helpers.isStaff(msg.member);
    const seen = new Set();
    const lines = [];
    for (const c of commands.values()) {
      if (seen.has(c) || !c.help || c.name === 'help') continue;
      seen.add(c);
      if (c.staff && !staff) continue;
      lines.push((c.staff ? '🔒 ' : '') + c.help);
    }
    lines.push('`[[card name]]` — anywhere in a message: shows the card (up to 3)', '`/bug` — report a bug in the game');
    // Discord erlaubt höchstens 2000 Zeichen je Nachricht; mit den Mod-Befehlen ist die Übersicht länger → in Päckchen aufteilen (an Zeilengrenzen).
    const parts = [];
    let cur = '**MoniaBot**';
    for (const l of lines) {
      if (cur.length + 1 + l.length > 1900) { parts.push(cur); cur = ''; }
      cur += (cur ? '\n' : '') + l;
    }
    parts.push(cur);
    await msg.reply({ content: parts[0], allowedMentions: { parse: [] } });
    for (const p of parts.slice(1)) await msg.channel.send({ content: p, allowedMentions: { parse: [] } });
  });

  /** Eine Servernachricht verarbeiten: Moderation → Befehl → Inline-Handler. */
  ctx.handleMessage = async function handleMessage(msg) {
    if (!msg.guild || msg.guild.id !== config.guildId || msg.author.bot || msg.system) return;
    if (msg.partial) msg = await msg.fetch();
    for (const filter of ctx.messageFilters) if (await filter(msg)) return;     // Moderation zuerst

    if (msg.content.startsWith(config.prefix)) {
      const m = /^(\S+)(?:\s+([\s\S]*))?$/.exec(msg.content.slice(config.prefix.length));
      const entry = m && commands.get(m[1].toLowerCase());
      if (entry) {
        if (!msg.member) {   // Message#member ist nur lesbar → auf der Instanz überschreiben
          const fetched = await msg.guild.members.fetch(msg.author.id).catch(() => null);
          Object.defineProperty(msg, 'member', { value: fetched, configurable: true });
        }
        if (entry.staff && !helpers.isStaff(msg.member)) {
          return void msg.reply('Only **Creator** and **Deputy Monia [MOD]** can use that command.');
        }
        const rest = (m[2] || '').trim();
        await entry.handler(msg, rest.split(/\s+/).filter(Boolean), rest);
        return;
      }
    }
    for (const h of ctx.messageHandlers) if (await h(msg)) return;
  };
  return ctx;
};

module.exports = { createContext, FEATURES };
