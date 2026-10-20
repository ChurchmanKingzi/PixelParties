'use strict';
// ═══════════════════════════════════════════════════════════════════
//  Pixle — das tägliche Karten-Ratespiel
//   !pixle            Regeln und dein Brett von heute
//   !pixle <Name>     ein Tipp: du siehst, wie Typ, Subtyp, Level, HP, ATK, Kosten, Schule, Archetyp und Set deiner Karte zur
//                     geheimen Karte von heute stehen (🟩 gleich · 🟨 nah dran · 🟥 anders · ▲/▼ die geheime Karte hat mehr/weniger)
//
//  • eine geheime Karte pro Tag (Berliner Kalendertag), für alle gleich, ZUFÄLLIG gewählt und gespeichert (nicht aus dem Datum ableitbar)
//  • jede Person hat ihre eigenen Tipps (höchstens PIXLE_MAX_GUESSES, voreingestellt 10) und ihr eigenes Brett
//  • SC gibt es nur fürs Lösen, einmal pro Tag: 30 SC, minus 3 je falschem Tipp davor (mindestens 3) — nur mit verknüpftem Konto
//  • Spoilerschutz: die Lösung steht nur in Spoiler-Tags (Text und Bild), das Brett zeigt die richtige Zeile als „SOLVED!“
//  • nur im Minigames-Kanal
// ═══════════════════════════════════════════════════════════════════
const { AttachmentBuilder } = require('discord.js');
const renderer = require('../lib/card-renderer');
const pixle = require('../lib/pixle');
const { renderBoard } = require('../lib/pixle-board');
const { plainName } = require('../lib/mystery');

const RECENT_KEEP = 120;

module.exports = function register(ctx) {
  const { client, config, db, game } = ctx;
  const GameApiError = game.GameApiError;
  const KEY = { state: 'pixle_state', recent: 'pixle_recent', yesterday: 'pixle_yesterday' };
  let clock = () => Date.now();                       // für Tests austauschbar

  // Alles, was den Tageszustand ändert, nacheinander (zwei gleichzeitige Tipps derselben Person dürfen nicht beide zählen).
  let chain = Promise.resolve();
  const serialized = fn => { const run = chain.then(fn, fn); chain = run.catch(() => {}); return run; };

  const attach = (buf, name) => new AttachmentBuilder(buf, { name });
  const spoiler = (buf, name) => new AttachmentBuilder(buf, { name: 'SPOILER_' + name });
  const cardByName = name => renderer.allCards().find(c => c.name === name);
  const max = () => config.pixleMaxGuesses;

  /** Zustand von heute; am neuen Tag wird eine neue geheime Karte gewählt (die von gestern merkt sich der Bot). */
  async function today() {
    await renderer.init();
    const day = pixle.berlinDay(clock());
    let state = await db.kvGet(KEY.state);
    if (state && state.date === day && cardByName(state.secret)) return state;
    if (state && state.date !== day) await db.kvSet(KEY.yesterday, { date: state.date, card: state.secret });
    const recent = await db.kvGet(KEY.recent, []);
    const pool = renderer.allCards().filter(c => renderer.canRender(c.name) && !/token/i.test(c.cardType) && !/\[W\]$/.test(c.name));
    const secret = pixle.pickSecret(pool, recent);
    if (!secret) throw new Error('Pixle: keine Karte für das Rätsel');
    state = { date: day, secret: secret.name, players: {} };
    await db.kvSet(KEY.state, state);
    await db.kvSet(KEY.recent, [...recent, plainName(secret.name)].slice(-RECENT_KEEP));
    return state;
  }

  /** Das Brett einer Person als Bild. */
  function boardFor(player, secret) {
    const rows = player.guesses.map(name => {
      const card = cardByName(name);
      const r = pixle.compareCards(card, secret);
      return { name: plainName(card.name), cells: r.cells, correct: r.correct, hideName: r.correct };
    });
    return renderBoard(rows);
  }

  const LEGEND = '🟩 same · 🟨 close / partly the same · 🟥 different · ▲/▼ the secret card’s value is higher/lower';
  const rulesText = () =>
    `🟦 **Pixle** — guess today’s secret card! Type \`${config.prefix}pixle <card name>\`.\n` +
    `After each guess you see how its type, subtype, level, HP, ATK, cost, school, archetype and set compare to the secret card.\n${LEGEND}\n` +
    `You have **${max()} guesses**. Solving it pays up to **${config.pixleReward} SC** (−${config.pixlePenalty} per wrong guess before), once a day — link your account with \`${config.prefix}link\` to receive SC.`;

  function guard(msg) {
    const id = config.channels.minigames;
    if (!id) { msg.reply('The minigames aren’t set up on this server.'); return false; }
    if (msg.channel.id !== id && msg.channel.parentId !== id) {
      msg.reply({ content: `Pixle lives in <#${id}> 🟦`, allowedMentions: { parse: [] } });
      return false;
    }
    return true;
  }

  const progress = p => `Guess ${p.guesses.length}/${max()}`;

  ctx.command('pixle', { help: '`!pixle` — rules and your board; `!pixle <card name>` — guess today’s secret card (only in the minigames channel)' }, (msg, args, rest) => serialized(async () => {
    if (!guard(msg)) return;
    const state = await today();
    const secret = cardByName(state.secret);
    const uid = msg.author.id;
    const p = state.players[uid] || (state.players[uid] = { guesses: [], solved: false });
    const midnight = `<t:${pixle.nextBerlinMidnightSec(clock())}:R>`;

    // ── ohne Namen: Regeln + Brett ──
    if (!rest) {
      if (!p.guesses.length) {
        const y = await db.kvGet(KEY.yesterday);
        return msg.reply({ content: rulesText() + (y ? `\n*Yesterday’s card was **${plainName(y.card)}**.*` : ''), allowedMentions: { parse: [] } });
      }
      const note = p.solved ? `✅ You solved today’s Pixle in **${p.guesses.length}**! A new one starts ${midnight}.`
        : p.guesses.length >= max() ? `You’re out of guesses for today. A new Pixle starts ${midnight}.`
        : `${progress(p)} — keep going!\n${LEGEND}`;
      return msg.reply({ content: note, files: [attach(boardFor(p, secret), 'pixle.png')], allowedMentions: { parse: [] } });
    }

    // ── mit Namen: ein Tipp ──
    if (p.solved) return msg.reply(`You already solved today’s Pixle 🎉 — a new one starts ${midnight}.`);
    if (p.guesses.length >= max()) {
      return msg.reply(`You’re out of guesses for today — the answer was ||**${plainName(secret.name)}**||. A new Pixle starts ${midnight}.`);
    }
    const r = pixle.resolveCard(renderer.allCards(), rest);
    if (r.kind === 'unknown') return msg.reply('I don’t know a card like that — not counted.');
    if (r.kind === 'ambiguous') return msg.reply({ content: `That matches several cards (like **${plainName(r.card.name)}**, **${r.alternatives[0]}**) — please be more specific. Not counted.`, allowedMentions: { parse: [] } });
    const guess = r.card;
    if (p.guesses.some(n => plainName(n) === plainName(guess.name))) {
      return msg.reply({ content: `You already guessed **${plainName(guess.name)}** — not counted.`, allowedMentions: { parse: [] } });
    }

    p.guesses.push(guess.name);
    const cmp = pixle.compareCards(guess, secret);
    if (!cmp.correct) {
      await db.kvSet(KEY.state, state);
      const left = max() - p.guesses.length;
      const tail = left > 0 ? `${progress(p)} — ${left} left.` : `That was your last guess — the answer was ||**${plainName(secret.name)}**||. A new Pixle starts ${midnight}.`;
      return msg.reply({ content: `${tail}`, files: [attach(boardFor(p, secret), 'pixle.png')], allowedMentions: { parse: [] } });
    }

    // ── gelöst ──
    p.solved = true;
    const wrongBefore = p.guesses.length - 1;
    const amount = pixle.reward(config.pixleReward, config.pixlePenalty, wrongBefore);
    p.reward = amount;
    await db.kvSet(KEY.state, state);                    // zuerst festhalten: kein zweites Auszahlen
    let scLine;
    try {
      const paid = await game.adjustSc(uid, amount, client.user ? client.user.id : '', 'bot:pixle');
      scLine = `**+${paid.applied} SC** (${paid.before} → ${paid.after})`;
    } catch (err) {
      if (err instanceof GameApiError && err.code === 'not_linked') scLine = `You’d have won **${amount} SC** — link your account with \`${config.prefix}link\` to receive SC next time!`;
      else { console.error('[pixle] SC-Buchung fehlgeschlagen:', err.message); scLine = `⚠️ I couldn’t pay out the ${amount} SC right now — please ping a moderator.`; }
    }
    const png = await ctx.cardPng(secret.name);
    return msg.reply({
      content: `🎉 <@${uid}> solved today’s Pixle in **${p.guesses.length}** guess${p.guesses.length === 1 ? '' : 'es'}! ${scLine}\nThe card (spoiler!): ||**${plainName(secret.name)}**||`,
      files: [attach(boardFor(p, secret), 'pixle.png'), ...(png ? [spoiler(png, 'pixle-card.png')] : [])],
      allowedMentions: { users: [uid] },
    });
  }));

  ctx._pixle = { today, KEY, setClock: f => { clock = f; } };
};
