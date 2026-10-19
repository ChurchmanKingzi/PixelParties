'use strict';
// ═══════════════════════════════════════════════════════════════════
//  Mystery-Spiel
//   !mystery        zeigt das aktuelle Rätsel: ein winziger Ausschnitt aus der Kunst einer Karte (Start ca. 8×8 Bildpunkte);
//                   mit jedem falschen Tipp von irgendwem wird er um einen Bildpunkt größer (gleicher Mittelpunkt)
//   !guess <Name>   Tipp. Richtig → der Sieger bekommt 20 SC (−2 für jeden falschen Tipp, den ER für diese Karte schon
//                   abgegeben hat), die Karte wird gezeigt und ein neues Rätsel beginnt.
//   !mystery skip   (Admin) Rätsel überspringen: Lösung zeigen, nächstes starten
//
//  • nur im Rätsel-Kanal (MYSTERY_CHANNEL_ID, voreingestellt auf den Kanal des Servers)
//  • höchstens 5 NEUE Rätsel je Tag (Berliner Kalendertag); ist das Kontingent aufgebraucht, bleibt der Kanal bis Mitternacht ruhig
//  • SC gibt es nur mit verknüpftem Konto (!link); alle anderen dürfen mitspielen und gewinnen, bekommen aber keine SC
//  • Tipps, die keiner Karte ähneln, oder die schon einmal getippt wurden, zählen nicht
// ═══════════════════════════════════════════════════════════════════
const { AttachmentBuilder } = require('discord.js');
const renderer = require('../lib/card-renderer');
const mystery = require('../lib/mystery');

const RECENT_KEEP = 60;
const GUESS_COOLDOWN_MS = 1500;

module.exports = function register(ctx) {
  const { client, config, db, game, helpers } = ctx;
  const GameApiError = game.GameApiError;
  const channelId = () => config.channels.mystery;

  // Alles, was den Spielstand ändert, nacheinander: zwei gleichzeitige richtige Tipps dürfen nicht beide gewinnen.
  let chain = Promise.resolve();
  const serialized = fn => { const run = chain.then(fn, fn); chain = run.catch(() => {}); return run; };

  const attach = (buf, name) => new AttachmentBuilder(buf, { name });
  const KEY = { current: 'mystery_current', day: 'mystery_day', recent: 'mystery_recent' };

  async function dayInfo() { return mystery.dayState(await db.kvGet(KEY.day)); }

  /** Neues Rätsel, wenn das Tageskontingent es erlaubt. @returns {Promise<object|null>} das Rätsel oder null (Kontingent leer / keine Karte) */
  async function generate() {
    const day = await dayInfo();
    if (day.count >= config.mysteryDailyMax) return null;
    await renderer.init();
    const recent = await db.kvGet(KEY.recent, []);
    const pool = mystery.eligibleCards(renderer.allCards(), renderer.hasArt, recent);
    for (let attempt = 0; attempt < 5 && pool.length; attempt++) {
      const card = pool[Math.floor(Math.random() * pool.length)];
      const crop = await ctx.renderQueue(() => renderer.pickArtCrop(card.name));
      if (!crop) continue;
      const center = { x: crop.x + crop.w / 2, y: crop.y + crop.h / 2 };      // der Ausschnitt wächst um diesen Punkt
      const puzzle = { card: card.name, center, number: day.count + 1, guesses: {}, tried: [], createdAt: Date.now() };
      await db.kvSet(KEY.current, puzzle);
      await db.kvSet(KEY.day, { date: day.date, count: day.count + 1 });
      await db.kvSet(KEY.recent, [...recent, card.name].slice(-RECENT_KEEP));
      return puzzle;
    }
    return null;
  }

  /** Der Ausschnitt des Rätsels in seiner aktuellen Größe: Start klein, +1 Bildpunkt je falschem Tipp (egal von wem). */
  async function rectFor(puzzle) {
    const art = await renderer.artSize(puzzle.card);
    if (!art) return null;
    const center = puzzle.center || { x: puzzle.crop.x + puzzle.crop.w / 2, y: puzzle.crop.y + puzzle.crop.h / 2 };   // Rätsel aus der Vorversion
    return mystery.cropRect(art.w, art.h, center, mystery.cropSize(art.w, art.h, puzzle.tried.length));
  }

  const rewardText = () => `**${config.mysteryReward} SC** — minus ${config.mysteryPenalty} for each wrong guess you’ve already made on this card`;

  async function puzzleMessage(puzzle, { intro } = {}) {
    const rect = await rectFor(puzzle);
    const png = await ctx.renderQueue(() => renderer.renderArtCrop(puzzle.card, rect));
    const tried = puzzle.tried.length ? `\nAlready guessed: ${puzzle.tried.slice(-12).map(n => `*${n}*`).join(', ')}` : '';
    return {
      content: `${intro ? intro + '\n\n' : ''}🕵️ **Mystery card #${puzzle.number} today** — which card is this?\n` +
        `Guess with \`${config.prefix}guess <card name>\`. Reward: ${rewardText()}. (Link your account with \`${config.prefix}link\` to receive SC.)\n` +
        `The picture zooms out a little with every wrong guess.${tried}`,
      files: [attach(png, 'mystery.png')],
      allowedMentions: { parse: [] },
    };
  }

  async function exhaustedText() {
    return `That was today’s last mystery card (${config.mysteryDailyMax} per day)! New ones start <t:${mystery.nextBerlinMidnightSec()}:R>.`;
  }

  async function reveal(puzzle) {
    const buf = await ctx.cardPng(puzzle.card);
    return buf ? [attach(buf, 'answer.png')] : [];
  }

  /** In den Rätsel-Kanal? Sonst freundlicher Hinweis. */
  function guard(msg) {
    const id = channelId();
    if (!id) { msg.reply('The mystery game isn’t set up on this server.'); return false; }
    if (msg.channel.id !== id && msg.channel.parentId !== id) {
      msg.reply({ content: `The mystery game lives in <#${id}> 🕵️`, allowedMentions: { parse: [] } });
      return false;
    }
    return true;
  }

  ctx.command('mystery', { help: '`!mystery` — show the current mystery card (only in the mystery channel); admins: `!mystery skip`' }, (msg, args) => serialized(async () => {
    if (!guard(msg)) return;
    const sub = (args[0] || '').toLowerCase();

    if (sub === 'skip') {
      if (!helpers.isStaff(msg.member)) return msg.reply('Only Creator / Deputy Monia [MOD] can skip a puzzle.');
      const cur = await db.kvGet(KEY.current);
      if (!cur) return msg.reply('There is no active puzzle.');
      await db.kvSet(KEY.current, null);
      const next = await generate();
      await msg.channel.send({ content: `⏭️ Skipped. The answer was **${cur.card}**.`, files: await reveal(cur), allowedMentions: { parse: [] } });
      return next ? msg.channel.send(await puzzleMessage(next)) : msg.channel.send(await exhaustedText());
    }

    let cur = await db.kvGet(KEY.current);
    if (!cur) {
      cur = await generate();
      if (!cur) return msg.reply(`All ${config.mysteryDailyMax} mystery cards for today are done! New ones start <t:${mystery.nextBerlinMidnightSec()}:R>.`);
    }
    return msg.reply(await puzzleMessage(cur));
  }));

  const lastGuess = new Map();

  ctx.command('guess', { help: '`!guess <card name>` — guess the mystery card (only in the mystery channel)' }, (msg, args, rest) => serialized(async () => {
    if (!guard(msg)) return;
    const cur = await db.kvGet(KEY.current);
    if (!cur) return msg.reply(`There’s no active puzzle right now. Type \`${config.prefix}mystery\` to start one.`);
    if (!rest) return msg.reply(`Usage: \`${config.prefix}guess <card name>\``);
    if (Date.now() - (lastGuess.get(msg.author.id) || 0) < GUESS_COOLDOWN_MS) return;
    lastGuess.set(msg.author.id, Date.now());

    await renderer.init();
    const target = renderer.allCards().find(c => c.name === cur.card);
    if (!target) { await db.kvSet(KEY.current, null); return msg.reply('Oops, that puzzle is broken — type `' + config.prefix + 'mystery` for a new one.'); }
    const verdict = mystery.judgeGuess(renderer.allCards(), target, rest);

    if (verdict.kind === 'unknown') return msg.reply('I don’t know a card like that — not counted.');
    if (verdict.kind === 'ambiguous') return msg.reply(`That matches several cards (like **${verdict.best.name}**) — please be more specific. Not counted.`);

    if (verdict.kind === 'wrong') {
      if (cur.tried.includes(verdict.best.name)) return msg.reply({ content: `**${verdict.best.name}** was already guessed — not counted.`, allowedMentions: { parse: [] } });
      const n = (cur.guesses[msg.author.id] || 0) + 1;
      cur.guesses[msg.author.id] = n;
      cur.tried.push(verdict.best.name);
      await db.kvSet(KEY.current, cur);
      const next = mystery.reward(config.mysteryReward, config.mysteryPenalty, n);
      // Das Bild wird mit jedem falschen Tipp etwas größer — gleich das neue zeigen, sonst sieht es niemand.
      const rect = await rectFor(cur);
      const png = await ctx.renderQueue(() => renderer.renderArtCrop(cur.card, rect));
      return msg.reply({ content: `❌ Not **${verdict.best.name}**. (Your wrong guesses on this card: ${n} → a win would pay ${next} SC.)\n🔍 The picture just zoomed out a bit:`,
        files: png ? [attach(png, 'mystery.png')] : [], allowedMentions: { parse: [] } });
    }

    // ── richtig ──
    const wrongBefore = cur.guesses[msg.author.id] || 0;
    const amount = mystery.reward(config.mysteryReward, config.mysteryPenalty, wrongBefore);
    await db.kvSet(KEY.current, null);                         // zuerst abschließen: kein zweiter Gewinner
    let scLine;
    if (amount <= 0) scLine = 'No SC this time — too many wrong guesses.';
    else {
      try {
        const r = await game.adjustSc(msg.author.id, amount, client.user ? client.user.id : '', 'bot:mystery');
        scLine = `**+${r.applied} SC** (${r.before} → ${r.after})`;
      } catch (err) {
        if (err instanceof GameApiError && err.code === 'not_linked') scLine = `You’d have won **${amount} SC** — link your account with \`${config.prefix}link\` to receive SC next time!`;
        else { console.error('[mystery] SC-Buchung fehlgeschlagen:', err.message); scLine = `⚠️ I couldn’t pay out the ${amount} SC right now — please ping a moderator.`; }
      }
    }
    await msg.reply({ content: `🎉 <@${msg.author.id}> got it: **${target.name}**! ${scLine}`, files: await reveal(cur), allowedMentions: { users: [msg.author.id] } });
    const next = await generate();
    if (next) await msg.channel.send(await puzzleMessage(next, { intro: '▶️ Next one:' }));
    else await msg.channel.send(await exhaustedText());
  }));

  ctx._mystery = { generate, rectFor, KEY };
};
