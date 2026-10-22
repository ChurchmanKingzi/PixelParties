'use strict';
// ═══════════════════════════════════════════════════════════════════
//  Mystery-Spiel
//   !mystery        zeigt das aktuelle Rätsel: ein winziger Ausschnitt aus der Kunst einer Karte (Start ca. 8×8 Bildpunkte);
//                   mit jedem falschen Tipp von irgendwem wird er um einen Bildpunkt größer (gleicher Mittelpunkt)
//   !guess <Name>   Tipp. Richtig → die Karte wird gezeigt und ein neues Rätsel beginnt. Ist das Rätsel SC wert, bekommt der
//                   Sieger 20 SC (−2 für jeden falschen Tipp, den ER für diese Karte schon abgegeben hat).
//   !mystery skip   (Admin) Rätsel überspringen: Lösung zeigen, nächstes starten
//
//  • nur im Minigames-Kanal (MINIGAMES_CHANNEL_ID, voreingestellt auf den Kanal des Servers)
//  • Rätsel entstehen unbegrenzt — aber nur das ERSTE neu erzeugte Rätsel jeder vollen Stunde ist SC wert (alle weiteren sind Übung)
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
  const channelId = () => config.channels.minigames;

  // Alles, was den Spielstand ändert, nacheinander: zwei gleichzeitige richtige Tipps dürfen nicht beide gewinnen.
  let chain = Promise.resolve();
  const serialized = fn => { const run = chain.then(fn, fn); chain = run.catch(() => {}); return run; };

  const attach = (buf, name) => new AttachmentBuilder(buf, { name });
  const KEY = { current: 'mystery_current', scHour: 'mystery_sc_hour', recent: 'mystery_recent' };
  let clock = () => Date.now();                       // für Tests austauschbar

  /**
   * Neues Rätsel. Unbegrenzt viele — aber nur das erste, das in einer vollen Stunde ENTSTEHT, ist SC wert (`scWorth`).
   * Das Merkmal wird bei der Erzeugung festgelegt: ein offenes SC-Rätsel bleibt es auch über den Stundenwechsel hinweg.
   * @returns {Promise<object|null>} das Rätsel oder null (keine passende Karte)
   */
  async function generate() {
    await renderer.init();
    const recent = await db.kvGet(KEY.recent, []);
    const pool = mystery.eligibleCards(renderer.allCards(), renderer.hasArt, recent);
    for (let attempt = 0; attempt < 5 && pool.length; attempt++) {
      const card = pool[Math.floor(Math.random() * pool.length)];
      const crop = await ctx.renderQueue(() => renderer.pickArtCrop(card.name));
      if (!crop) continue;
      const now = clock();
      const scWorth = mystery.isScWorthy(await db.kvGet(KEY.scHour), now);
      if (scWorth) await db.kvSet(KEY.scHour, mystery.hourIndex(now));
      const center = { x: crop.x + crop.w / 2, y: crop.y + crop.h / 2 };      // der Ausschnitt wächst um diesen Punkt
      const puzzle = { card: card.name, center, scWorth, guesses: {}, tried: [], createdAt: now };
      await db.kvSet(KEY.current, puzzle);
      await db.kvSet(KEY.recent, [...recent, card.name].slice(-RECENT_KEEP));
      return puzzle;
    }
    return null;
  }

  /**
   * Der Ausschnitt des Rätsels nach `wrong` falschen Tipps (Standard: bisherige): Start klein, +1 Bildpunkt je falschem Tipp (egal von wem) —
   * aber nie mit Stellen, die auf der fertigen Karte verdeckt sind (Textfelder von Vollbild-Karten, Symbole): dort wächst er nicht weiter.
   */
  async function rectFor(puzzle, wrong = puzzle.tried.length) {
    const art = await renderer.artSize(puzzle.card);
    if (!art) return null;
    const center = puzzle.center || { x: puzzle.crop.x + puzzle.crop.w / 2, y: puzzle.crop.y + puzzle.crop.h / 2 };   // Rätsel aus der Vorversion
    return renderer.visibleCropRect(puzzle.card, center, mystery.cropSize(art.w, art.h, wrong));
  }

  // Rätsel aus der Vorversion (ohne scWorth) galten alle als SC wert.
  const worthSc = puzzle => puzzle.scWorth !== false;

  const rewardText = puzzle => worthSc(puzzle)
    ? `💰 Worth **${config.mysteryReward} SC** — minus ${config.mysteryPenalty} for each wrong guess you’ve already made on this card. (Link your account with \`${config.prefix}link\` to receive SC.)`
    : `No SC for this one — only the first new puzzle each full hour pays. The next hour starts <t:${mystery.nextHourSec(clock())}:R>.`;

  async function puzzleMessage(puzzle, { intro } = {}) {
    const rect = await rectFor(puzzle);
    const png = await ctx.renderQueue(() => renderer.renderArtCrop(puzzle.card, rect));
    const tried = puzzle.tried.length ? `\nAlready guessed: ${puzzle.tried.slice(-12).map(n => `*${n}*`).join('; ')}` : '';
    return {
      content: `${intro ? intro + '\n\n' : ''}🕵️ **Mystery card** — which card is this?\n` +
        `Guess with \`${config.prefix}guess <card name>\`. ${rewardText(puzzle)}\n` +
        `The picture zooms out a little with every wrong guess.${tried}`,
      files: [attach(png, 'mystery.png')],
      allowedMentions: { parse: [] },
    };
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

  ctx.command('mystery', { help: '`!mystery` — show the current mystery card (only in the minigames channel); admins: `!mystery skip`' }, (msg, args) => serialized(async () => {
    if (!guard(msg)) return;
    const sub = (args[0] || '').toLowerCase();

    if (sub === 'skip') {
      if (!helpers.isStaff(msg.member)) return msg.reply('Only Creator / Deputy Monia [MOD] can skip a puzzle.');
      const cur = await db.kvGet(KEY.current);
      if (!cur) return msg.reply('There is no active puzzle.');
      await db.kvSet(KEY.current, null);
      const next = await generate();
      await msg.channel.send({ content: `⏭️ Skipped. The answer was **${mystery.plainName(cur.card)}**.`, files: await reveal(cur), allowedMentions: { parse: [] } });
      return msg.channel.send(next ? await puzzleMessage(next) : 'I couldn’t find a new card right now — type `' + config.prefix + 'mystery` to try again.');
    }

    let cur = await db.kvGet(KEY.current);
    if (!cur) {
      cur = await generate();
      if (!cur) return msg.reply('I couldn’t find a card for a puzzle right now — please try again in a moment.');
    }
    return msg.reply(await puzzleMessage(cur));
  }));

  const lastGuess = new Map();

  ctx.command('guess', { help: '`!guess <card name>` — guess the mystery card (only in the minigames channel)' }, (msg, args, rest) => serialized(async () => {
    if (!guard(msg)) return;
    const cur = await db.kvGet(KEY.current);
    if (!cur) return msg.reply(`There’s no active puzzle right now. Type \`${config.prefix}mystery\` to start one.`);
    if (!rest) return msg.reply(`Usage: \`${config.prefix}guess <card name>\``);
    if (clock() - (lastGuess.get(msg.author.id) || 0) < GUESS_COOLDOWN_MS) return;
    lastGuess.set(msg.author.id, clock());

    await renderer.init();
    const target = renderer.allCards().find(c => c.name === cur.card);
    if (!target) { await db.kvSet(KEY.current, null); return msg.reply('Oops, that puzzle is broken — type `' + config.prefix + 'mystery` for a new one.'); }
    const verdict = mystery.judgeGuess(renderer.allCards(), target, rest);

    if (verdict.kind === 'unknown') return msg.reply('I don’t know a card like that — not counted.');
    if (verdict.kind === 'ambiguous') return msg.reply(`That matches several cards (like **${mystery.plainName(verdict.best.name)}**) — please be more specific. Not counted.`);

    if (verdict.kind === 'wrong') {
      const guessed = mystery.plainName(verdict.best.name);
      if (cur.tried.includes(guessed)) return msg.reply({ content: `**${guessed}** was already guessed — not counted.`, allowedMentions: { parse: [] } });
      const n = (cur.guesses[msg.author.id] || 0) + 1;
      cur.guesses[msg.author.id] = n;
      cur.tried.push(guessed);
      await db.kvSet(KEY.current, cur);
      const next = worthSc(cur) ? mystery.reward(config.mysteryReward, config.mysteryPenalty, n) : 0;
      const outlook = worthSc(cur) ? `a win would pay ${next} SC` : 'no SC on this puzzle';
      // Das Bild wird mit jedem falschen Tipp etwas größer — gleich das neue zeigen, sonst sieht es niemand.
      const before = await rectFor(cur, cur.tried.length - 1), rect = await rectFor(cur);
      const grew = before && rect && rect.w > before.w;
      const png = await ctx.renderQueue(() => renderer.renderArtCrop(cur.card, rect));
      return msg.reply({ content: `❌ Not **${guessed}**. (Your wrong guesses on this card: ${n} → ${outlook}.)\n` +
        (grew ? '🔍 The picture just zoomed out a bit:' : '🔍 The picture can’t zoom out any further — the rest of this card’s art is covered by its text boxes:'),
        files: png ? [attach(png, 'mystery.png')] : [], allowedMentions: { parse: [] } });
    }

    // ── richtig ──
    const wrongBefore = cur.guesses[msg.author.id] || 0;
    const amount = worthSc(cur) ? mystery.reward(config.mysteryReward, config.mysteryPenalty, wrongBefore) : 0;
    await db.kvSet(KEY.current, null);                         // zuerst abschließen: kein zweiter Gewinner
    let scLine;
    if (!worthSc(cur)) scLine = 'No SC for this one — only the first new puzzle each full hour pays.';
    else if (amount <= 0) scLine = 'No SC this time — too many wrong guesses.';
    else {
      try {
        const r = await game.adjustSc(msg.author.id, amount, client.user ? client.user.id : '', 'bot:mystery');
        scLine = `**+${r.applied} SC** (${r.before} → ${r.after})`;
      } catch (err) {
        if (err instanceof GameApiError && err.code === 'not_linked') scLine = `You’d have won **${amount} SC** — link your account with \`${config.prefix}link\` to receive SC next time!`;
        else { console.error('[mystery] SC-Buchung fehlgeschlagen:', err.message); scLine = `⚠️ I couldn’t pay out the ${amount} SC right now — please ping a moderator.`; }
      }
    }
    await msg.reply({ content: `🎉 <@${msg.author.id}> got it: **${mystery.plainName(target.name)}**! ${scLine}`, files: await reveal(cur), allowedMentions: { users: [msg.author.id] } });
    const next = await generate();
    if (next) await msg.channel.send(await puzzleMessage(next, { intro: '▶️ Next one:' }));
  }));

  ctx._mystery = { generate, rectFor, KEY, setClock: f => { clock = f; } };
};
