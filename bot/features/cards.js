'use strict';
// ═══════════════════════════════════════════════════════════════════
//  Karten
//   !show <Name>   Bild der ähnlichsten Karte (Heroes bevorzugt), vollständig gerendert wie im Spiel
//   !card <Name>   dieselbe Karte als Text (Werte, Effekt)
//   !random        zufällige Karte
//   !cotd          Karte des Tages (+ automatische Veröffentlichung, wenn CARD_OF_DAY_CHANNEL_ID gesetzt ist)
//   [[Name]]       mitten in einer Nachricht: zeigt die Karte (bis zu 3 je Nachricht)
//
//  Das Bild entsteht mit demselben Renderer wie im Spiel (public/card-render.js, siehe lib/card-renderer.js).
// ═══════════════════════════════════════════════════════════════════
const { AttachmentBuilder, EmbedBuilder } = require('discord.js');
const renderer = require('../lib/card-renderer');
const { searchCards, closeAlternatives } = require('../lib/card-search');

const CACHE_MAX = 300;
const COOLDOWN_MS = 3000;
const INLINE_MAX = 3;

module.exports = function register(ctx) {
  const { client, config, db } = ctx;

  // ── Bild-Zwischenspeicher + Warteschlange (Rendern belegt die CPU; ein Bild nach dem anderen) ──
  const cache = new Map();                   // Kartenname → PNG-Buffer (LRU)
  let chain = Promise.resolve();
  const enqueue = fn => (chain = chain.then(fn, fn));
  ctx.renderQueue = enqueue;                 // andere Funktionen (Daily-Bild) reihen sich in dieselbe Schlange ein
  let generation = 0;                        // steigt bei reload(): alte Bilder verwerfen

  async function png(name) {
    if (cache.has(name)) { const b = cache.get(name); cache.delete(name); cache.set(name, b); return b; }
    const gen = generation;
    const buf = await enqueue(() => renderer.renderCardPng(name));
    if (buf && gen === generation) {
      cache.set(name, buf);
      if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
    }
    return buf;
  }
  ctx.cardPng = png;
  ctx.cardsReload = async () => { generation++; cache.clear(); await enqueue(() => renderer.reload()); };

  const last = new Map();                    // Nutzer → Zeitpunkt (Abkühlzeit)
  const cooling = (id) => {
    const now = Date.now(), t = last.get(id) || 0;
    if (now - t < COOLDOWN_MS) return true;
    last.set(id, now);
    if (last.size > 500) for (const [k, v] of last) if (now - v > COOLDOWN_MS) last.delete(k);
    return false;
  };

  const attach = (buf, name) => new AttachmentBuilder(buf, { name: name.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').slice(0, 60) + '.png' });

  async function find(query) {
    await renderer.init();
    const results = searchCards(renderer.allCards(), query);
    return { results, best: results[0]?.card || null, alternatives: closeAlternatives(results).map(r => r.card.name) };
  }

  function notFound(msg, query, results) {
    return msg.reply({ content: `I couldn’t find a card like “${query.slice(0, 60)}”.` + (results.length ? ` Did you mean: ${results.slice(0, 3).map(r => '**' + r.card.name + '**').join(', ')}?` : ''), allowedMentions: { parse: [] } });
  }

  async function showCard(msg, query) {
    const { results, best, alternatives } = await find(query);
    if (!best) return notFound(msg, query, results);
    const buf = await png(best.name);
    if (!buf) return msg.reply({ embeds: [textEmbed(best)], allowedMentions: { parse: [] } });   // keine Kunst → Text
    return msg.reply({
      content: alternatives.length ? `*Also matching: ${alternatives.slice(0, 4).join(' · ')}*` : undefined,
      files: [attach(buf, best.name)],
      allowedMentions: { parse: [] },
    });
  }

  function textEmbed(c) {
    const stats = [c.level != null ? `Level ${c.level}` : null, c.hp != null ? `HP ${c.hp}` : null, c.atk != null ? `ATK ${c.atk}` : null, c.cost != null ? `Cost ${c.cost}` : null].filter(Boolean).join(' · ');
    const e = new EmbedBuilder().setColor(0x7e57c2).setTitle(c.name.slice(0, 250))
      .setDescription(String(c.effect || '*No effect text.*').slice(0, 3900));
    const fields = [];
    fields.push({ name: 'Type', value: [c.cardType, c.subtype].filter(Boolean).join(' — ') || '—', inline: true });
    if (stats) fields.push({ name: 'Stats', value: stats, inline: true });
    if (c.archetype) fields.push({ name: 'Archetype', value: String(c.archetype).slice(0, 200), inline: true });
    if (c.setID) fields.push({ name: 'Set', value: String(c.setID).slice(0, 200), inline: true });
    const abil = [c.startingAbility1, c.startingAbility2].filter(Boolean).join(' / ');
    if (abil) fields.push({ name: 'Starting abilities', value: abil.slice(0, 200), inline: true });
    if (c.banned) fields.push({ name: 'Status', value: 'Banned', inline: true });
    return e.addFields(fields);
  }

  ctx.command('show', { help: '`!show <card name>` — card image (heroes preferred on near matches)' }, async (msg, args, rest) => {
    if (!rest) return msg.reply('Usage: `!show <card name>`');
    if (cooling(msg.author.id)) return;
    await msg.channel.sendTyping().catch(() => {});
    return showCard(msg, rest);
  });

  ctx.command('card', { help: '`!card <card name>` — card text and stats' }, async (msg, args, rest) => {
    if (!rest) return msg.reply('Usage: `!card <card name>`');
    if (cooling(msg.author.id)) return;
    const { results, best, alternatives } = await find(rest);
    if (!best) return notFound(msg, rest, results);
    const e = textEmbed(best);
    if (alternatives.length) e.setFooter({ text: 'Also matching: ' + alternatives.slice(0, 4).join(' · ') });
    return msg.reply({ embeds: [e], allowedMentions: { parse: [] } });
  });

  ctx.command('random', { help: '`!random` — a random card' }, async (msg) => {
    if (cooling(msg.author.id)) return;
    await renderer.init();
    const pool = renderer.allCards().filter(c => renderer.canRender(c.name) && !/token/i.test(c.cardType));
    const c = pool[Math.floor(Math.random() * pool.length)];
    const buf = c && await png(c.name);
    if (!buf) return msg.reply('Couldn’t draw a card right now.');
    return msg.reply({ content: `🎲 **${c.name}**`, files: [attach(buf, c.name)], allowedMentions: { parse: [] } });
  });

  // ── Karte des Tages ──
  const berlinDate = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const berlinHour = (d = new Date()) => Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', hour: '2-digit', hourCycle: 'h23' }).format(d));
  function cardOfDay(dateStr) {
    // Deterministisch je Datum: alle sehen dieselbe Karte, auch nach einem Neustart.
    const pool = renderer.allCards().filter(c => renderer.canRender(c.name) && !/token/i.test(c.cardType)).sort((a, b) => a.name.localeCompare(b.name));
    let h = 2166136261;
    for (const ch of dateStr) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    return pool[(h >>> 0) % pool.length];
  }
  async function cotdMessage() {
    await renderer.init();
    const c = cardOfDay(berlinDate());
    const buf = c && await png(c.name);
    return buf ? { content: `🃏 **Card of the day:** ${c.name}`, files: [attach(buf, c.name)], allowedMentions: { parse: [] } } : null;
  }
  ctx.command('cotd', { help: '`!cotd` — card of the day' }, async (msg) => {
    if (cooling(msg.author.id)) return;
    const m = await cotdMessage();
    return msg.reply(m || 'No card of the day available.');
  });

  async function postCotdIfDue() {
    const id = config.channels.cardOfDay;
    if (!id || berlinHour() < 12) return;                       // wie die Daily Challenge: ab 12:00 Berliner Zeit
    const today = berlinDate();
    if ((await db.kvGet('cotd_last')) === today) return;
    const guild = client.guilds.cache.get(config.guildId);
    const ch = guild && (guild.channels.cache.get(id) || await guild.channels.fetch(id).catch(() => null));
    if (!ch || !ch.isTextBased()) return;
    const m = await cotdMessage();
    if (!m) return;
    await ch.send(m);
    await db.kvSet('cotd_last', today);
  }
  ctx.onReady.push(() => {
    const t = setInterval(() => postCotdIfDue().catch(e => console.error('[cotd]', e.message)), 5 * 60 * 1000);
    t.unref && t.unref();
    postCotdIfDue().catch(e => console.error('[cotd]', e.message));
  });

  // ── [[Karte]] mitten im Text ──
  ctx.messageHandlers.push(async (msg) => {
    if (!msg.content.includes('[[')) return false;
    const names = [...msg.content.matchAll(/\[\[([^\[\]\n]{2,80})\]\]/g)].map(m => m[1].trim()).slice(0, INLINE_MAX);
    if (!names.length || cooling(msg.author.id)) return false;
    await renderer.init();
    const files = [], seen = new Set();
    for (const n of names) {
      const { best } = await find(n);
      if (!best || seen.has(best.name)) continue;
      seen.add(best.name);
      const buf = await png(best.name);
      if (buf) files.push(attach(buf, best.name));
    }
    if (files.length) await msg.reply({ files, allowedMentions: { parse: [] } });
    return files.length > 0;
  });

  ctx.onReady.push(() => renderer.init().then(() => {
    const s = renderer.imageStats();
    console.log(`[cards] Renderer bereit: ${s.total} Karten — ${s.atlas} aus Kunst-Atlas, ${s.files} aus fertigen Bilddateien (cards/), ${s.none} ganz ohne Bild (werden als Text gezeigt)`);
  }).catch(e => console.error('[cards] Renderer-Fehler:', e)));
};
