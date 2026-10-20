'use strict';
// ═══════════════════════════════════════════════════════════════════
//  Pixle — das tägliche Karten-Ratespiel
//   !pixle            Regeln und dein Brett von heute
//   !pixle <Name>     ein Tipp: du siehst, wie Typ, Subtyp, Level, HP, ATK, Kosten, Schule und Set deiner Karte zu DEINER
//                     geheimen Karte stehen (🟩 gleich · 🟨 nah dran · 🟥 anders · ▲/▼ die geheime Karte hat mehr/weniger)
//
//  • JEDE PERSON hat ihr eigenes Pixle: ihre eigene geheime Karte, zufällig gewählt und gespeichert (Berliner Kalendertag). So kann niemand
//    bei anderen mitlesen oder deren Lösung „snipen“. Das ERSTE Spiel des Tages (die tägliche Karte der Person) zahlt SC: 30 SC, −3 je
//    falschem Tipp davor (mindestens 3), einmal pro Tag UND Person, nur mit verknüpftem Konto
//  • Endet ein Spiel (gelöst oder alle Tipps verbraucht), beginnt für die Person SOFORT das nächste — ein Übungsspiel mit eigener, frischer
//    Karte, unbegrenzt oft, ohne SC. Am neuen Tag beginnt alles wieder mit der neuen täglichen Karte.
//  • jede Person hat ihre eigenen Spiele und Bretter (höchstens PIXLE_MAX_GUESSES Tipps je Spiel, voreingestellt 10)
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
  const KEY = { state: 'pixle_state', history: 'pixle_history' };
  let clock = () => Date.now();                       // für Tests austauschbar

  // Alles, was den Zustand ändert, nacheinander (zwei gleichzeitige Tipps derselben Person dürfen nicht beide zählen).
  let chain = Promise.resolve();
  const serialized = fn => { const run = chain.then(fn, fn); chain = run.catch(() => {}); return run; };

  const attach = (buf, name) => new AttachmentBuilder(buf, { name });
  const spoiler = (buf, name) => new AttachmentBuilder(buf, { name: 'SPOILER_' + name });
  const cardByName = name => renderer.allCards().find(c => c.name === name);
  const max = () => config.pixleMaxGuesses;
  const poolOf = () => renderer.allCards().filter(c => renderer.canRender(c.name) && !/token/i.test(c.cardType) && !/\[W\]$/.test(c.name));

  /**
   * Zustand von heute: { date, players: { <Discord-ID>: { secret, guesses, solved, reward?, practice?, practiceCount?, seen? } } }.
   * Am neuen Tag beginnt alles neu; die letzte tägliche Karte jeder Person merkt sich der Bot (kv `pixle_history`: { last, recent }).
   */
  async function today() {
    await renderer.init();
    const day = pixle.berlinDay(clock());
    let state = await db.kvGet(KEY.state);
    if (state && state.date === day) return state;
    if (state) {                                      // Tageswechsel: die täglichen Karten von gestern festhalten
      const hist = await db.kvGet(KEY.history, {});
      for (const [uid, p] of Object.entries(state.players || {})) {
        const secret = p.secret || state.secret;      // `state.secret`: Zustand der Vorversion mit gemeinsamer Karte
        if (secret) (hist[uid] ||= { recent: [] }).last = { date: state.date, card: secret };
      }
      await db.kvSet(KEY.history, hist);
    }
    state = { date: day, players: {} };
    await db.kvSet(KEY.state, state);
    return state;
  }

  /**
   * Die Person und ihre tägliche Karte: JEDE Person hat ihre eigene, zufällig gewählte und gespeicherte geheime Karte (nicht aus dem Datum
   * ableitbar, nicht für andere sichtbar) — so kann niemand bei anderen mitlesen. Gewählt wird sie beim ersten Aufruf des Tages;
   * die Karten der letzten Tage dieser Person kommen nicht wieder dran.
   * @returns {Promise<{p:object, created:boolean}>}
   */
  async function ensurePlayer(state, uid) {
    const p = state.players[uid] || (state.players[uid] = { guesses: [], solved: false });
    if (p.secret) return { p, created: false };
    if (state.secret && p.guesses.length) { p.secret = state.secret; return { p, created: false }; }   // Zustand der Vorversion: angefangenes Spiel behält seine Karte
    const hist = await db.kvGet(KEY.history, {});
    const mine = hist[uid] || (hist[uid] = { recent: [] });
    const secret = pixle.pickSecret(poolOf(), mine.recent);
    if (!secret) throw new Error('Pixle: keine Karte für das Rätsel');
    p.secret = secret.name;
    mine.recent = [...mine.recent, plainName(secret.name)].slice(-RECENT_KEEP);
    await db.kvSet(KEY.history, hist);
    return { p, created: true };
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
    `🟦 **Pixle** — guess your own secret card! Everybody gets their own, so nobody can peek at anyone else’s. Type \`${config.prefix}pixle <card name>\`.\n` +
    `After each guess you see how its type, subtype, level, HP, ATK, cost, school and set compare to your secret card.\n${LEGEND}\n` +
    `You have **${max()} guesses** per game. Solving **your card of the day** pays up to **${config.pixleReward} SC** (−${config.pixlePenalty} per wrong guess before), once a day — link your account with \`${config.prefix}link\` to receive SC.\n` +
    `When a game ends, a new one starts right away (a practice game with a fresh card, no SC) — only your first Pixle of the day pays.`;

  function guard(msg) {
    const id = config.channels.minigames;
    if (!id) { msg.reply('The minigames aren’t set up on this server.'); return false; }
    if (msg.channel.id !== id && msg.channel.parentId !== id) {
      msg.reply({ content: `Pixle lives in <#${id}> 🟦`, allowedMentions: { parse: [] } });
      return false;
    }
    return true;
  }

  // ── Spiele einer Person: erst die tägliche Karte (SC), dann Übungsspiele ──
  const PRACTICE_SEEN_KEEP = 40;
  const isDone = g => g.solved || g.guesses.length >= max();

  /** Neues Übungsspiel mit frischer Karte (nicht die tägliche, nicht eine der zuletzt geübten). */
  function startPractice(state, p) {
    const pool = renderer.allCards().filter(c => renderer.canRender(c.name) && !/token/i.test(c.cardType) && !/\[W\]$/.test(c.name) && plainName(c.name) !== plainName(p.secret));
    const secret = pixle.pickSecret(pool, p.seen || []);
    if (!secret) throw new Error('Pixle: keine Karte für ein Übungsspiel');
    p.seen = [...(p.seen || []), plainName(secret.name)].slice(-PRACTICE_SEEN_KEEP);
    p.practiceCount = (p.practiceCount || 0) + 1;
    p.practice = { secret: secret.name, guesses: [], solved: false };
  }

  /** Das laufende Spiel: die tägliche Karte, solange sie nicht beendet ist, danach das Übungsspiel (bei Bedarf neu gestartet). */
  function currentGame(state, p) {   // state bleibt im Aufruf, falls ein Spiel den ganzen Tageszustand braucht
    if (!isDone(p)) return { g: p, secretName: p.secret, daily: true };
    if (!p.practice || isDone(p.practice)) startPractice(state, p);
    return { g: p.practice, secretName: p.practice.secret, daily: false };
  }

  const label = (p, daily) => (daily ? 'Daily Pixle' : `Practice Pixle #${p.practiceCount}`);
  const progress = (p, game) => `${label(p, game.daily)} · Guess ${game.g.guesses.length}/${max()}`;
  const nextNote = () => `▶️ **A new Pixle has started** — a practice game with a fresh card, no SC (only your first Pixle of the day pays). Guess with \`${config.prefix}pixle <card name>\`.`;

  ctx.command('pixle', { help: '`!pixle` — rules and your board; `!pixle <card name>` — guess (only in the minigames channel). A new game starts right away; only the first of the day pays SC' }, (msg, args, rest) => serialized(async () => {
    if (!guard(msg)) return;
    const state = await today();
    const uid = msg.author.id;
    const { p, created } = await ensurePlayer(state, uid);
    const cur = currentGame(state, p);
    if (created || !cur.daily) await db.kvSet(KEY.state, state);   // frisch gewählte Karte / frisch gestartetes Übungsspiel gleich festhalten
    const secret = cardByName(cur.secretName);

    // ── ohne Namen: Regeln + Brett ──
    if (!rest) {
      if (!cur.g.guesses.length) {
        if (cur.daily) {
          const last = ((await db.kvGet(KEY.history, {}))[uid] || {}).last;
          return msg.reply({ content: rulesText() + (last && last.date !== state.date ? `\n*Your previous daily card was **${plainName(last.card)}**.*` : ''), allowedMentions: { parse: [] } });
        }
        return msg.reply({ content: `${nextNote().replace('A new Pixle has started', `${label(p, false)} is ready`)}\n${LEGEND}`, allowedMentions: { parse: [] } });
      }
      const left = max() - cur.g.guesses.length;
      return msg.reply({ content: `${progress(p, cur)} — ${left} left.${cur.daily ? '' : ' (practice — no SC)'}\n${LEGEND}`, files: [attach(boardFor(cur.g, secret), 'pixle.png')], allowedMentions: { parse: [] } });
    }

    // ── mit Namen: ein Tipp ──
    const r = pixle.resolveCard(renderer.allCards(), rest);
    if (r.kind === 'unknown') return msg.reply('I don’t know a card like that — not counted.');
    if (r.kind === 'ambiguous') return msg.reply({ content: `That matches several cards (like **${plainName(r.card.name)}**, **${r.alternatives[0]}**) — please be more specific. Not counted.`, allowedMentions: { parse: [] } });
    const guess = r.card;
    if (cur.g.guesses.some(n => plainName(n) === plainName(guess.name))) {
      return msg.reply({ content: `You already guessed **${plainName(guess.name)}** in this game — not counted.`, allowedMentions: { parse: [] } });
    }

    cur.g.guesses.push(guess.name);
    const cmp = pixle.compareCards(guess, secret);
    const board = () => attach(boardFor(cur.g, secret), 'pixle.png');

    if (!cmp.correct) {
      const left = max() - cur.g.guesses.length;
      if (left > 0) {
        await db.kvSet(KEY.state, state);
        return msg.reply({ content: `${progress(p, cur)} — ${left} left.`, files: [board()], allowedMentions: { parse: [] } });
      }
      // alle Tipps verbraucht → Lösung nur als Spoiler, sofort das nächste Spiel
      const finishedBoard = board();
      startPractice(state, p);
      await db.kvSet(KEY.state, state);
      return msg.reply({ content: `That was your last guess of this game — the answer was ||**${plainName(secret.name)}**||.\n${nextNote()}`, files: [finishedBoard], allowedMentions: { parse: [] } });
    }

    // ── gelöst ──
    cur.g.solved = true;
    let head;
    if (cur.daily) {
      const amount = pixle.reward(config.pixleReward, config.pixlePenalty, cur.g.guesses.length - 1);
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
      head = `🎉 <@${uid}> solved today’s Pixle in **${cur.g.guesses.length}** guess${cur.g.guesses.length === 1 ? '' : 'es'}! ${scLine}`;
    } else {
      head = `🎉 <@${uid}> solved ${label(p, false)} in **${cur.g.guesses.length}** guess${cur.g.guesses.length === 1 ? '' : 'es'}! No SC for practice games — only your first Pixle of the day pays.`;
    }
    const finishedBoard = board();
    const png = await ctx.cardPng(secret.name);
    startPractice(state, p);                               // sofort das nächste Spiel
    await db.kvSet(KEY.state, state);
    return msg.reply({
      content: `${head}\nThe card (spoiler!): ||**${plainName(secret.name)}**||\n${nextNote()}`,
      files: [finishedBoard, ...(png ? [spoiler(png, 'pixle-card.png')] : [])],
      allowedMentions: cur.daily ? { users: [uid] } : { parse: [] },
    });
  }));

  /** Für Tests: Zustand von heute samt Person (legt deren Karte an, falls nötig). */
  const prepare = uid => serialized(async () => {
    const state = await today();
    const { p, created } = await ensurePlayer(state, uid);
    if (created) await db.kvSet(KEY.state, state);
    return { state, p };
  });

  ctx._pixle = { today, prepare, KEY, setClock: f => { clock = f; } };
};
