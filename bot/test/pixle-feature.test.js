'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { role, member, guild, message, setup, config } = require('./helpers');
const renderer = require('../lib/card-renderer');
const { plainName } = require('../lib/mystery');
const px = require('../lib/pixle');
const { GameApiError } = require('../lib/game-api');
const { loadImage } = require('@napi-rs/canvas');

const CH = '1561796630762623036';
const isPng = b => Buffer.isBuffer(b) && b.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));

async function world(gameApi = {}) {
  config.channels.minigames = CH;
  config.pixleMaxGuesses = 10; config.pixleReward = 30; config.pixlePenalty = 3;
  const pays = [];
  const linked = new Set(['100000000000000001', '100000000000000002', '100000000000000003']);
  const { ctx, db } = await setup({
    adjustSc: async (uid, delta, admin, reason) => {
      if (!linked.has(uid)) throw new GameApiError(404, 'not_linked');
      pays.push({ uid, delta, reason });
      return { username: 'p', before: 100, after: 100 + delta, applied: delta };
    }, ...gameApi,
  });
  const g = guild();
  const w = { t: Date.UTC(2026, 5, 10, 12, 0, 0) };
  ctx._pixle.setClock(() => w.t);
  const users = {};
  const say = async (id, content, channelId = CH) => {
    users[id] ||= member({ id });
    const msg = message({ guild: g, member: users[id], content });
    msg.channel.id = channelId;
    await ctx.handleMessage(msg);
    return msg;
  };
  const state = () => db.kvGet('pixle_state');
  const secret = async () => { const s = await ctx._pixle.today(); return renderer.allCards().find(c => c.name === s.secret); };
  // verschiedene, eindeutig auflösbare Karten, die NICHT die geheime sind
  const wrongNames = async (n) => {
    const s = await secret();
    return renderer.allCards().filter(c => plainName(c.name) !== plainName(s.name) && !/\[(B|W)\]$/.test(c.name) && renderer.canRender(c.name) && px.resolveCard(renderer.allCards(), c.name).kind === 'ok')
      .filter((_, i) => i % 37 === 0).slice(0, n).map(c => c.name);
  };
  return { ctx, db, say, pays, state, secret, wrongNames, w, linked };
}

test('nur im Minigames-Kanal; ohne Tipp: Regeln (10 Tipps, 30 SC), noch kein Brett', async () => {
  const w = await world();
  let msg = await w.say('100000000000000001', '!pixle', 'ANDERER');
  assert.match(msg.replies[0].content, new RegExp(`Pixle lives in <#${CH}>`));
  assert.equal(await w.state(), null, 'im falschen Kanal passiert nichts');

  msg = await w.say('100000000000000001', '!pixle');
  const r = msg.replies[0];
  assert.match(r.content, /Pixle/);
  assert.match(r.content, /\*\*10 guesses\*\* per game/);
  assert.match(r.content, /30 SC/);
  assert.match(r.content, /a new one starts right away/);
  assert.match(r.content, /🟩 same/);
  assert.ok(!r.files, 'noch kein Brett');
  const st = await w.state();
  assert.ok(st.secret && st.date === '2026-06-10');
});

test('Tipp: unbekannt / mehrdeutig / doppelt zählen nicht; ein falscher Tipp zeigt das Brett als Bild', async () => {
  const w = await world();
  const [a, b] = await w.wrongNames(2);
  const u = '100000000000000001';
  let msg = await w.say(u, '!pixle qzxwvkjq');
  assert.match(msg.replies[0].content, /don’t know a card like that — not counted/);
  msg = await w.say(u, '!pixle Alice');
  assert.match(msg.replies[0].content, /more specific/);
  assert.equal(((await w.state()).players[u] || { guesses: [] }).guesses.length, 0);

  msg = await w.say(u, '!pixle ' + a);
  const r = msg.replies[0];
  assert.match(r.content, /Guess 1\/10 — 9 left/);
  assert.ok(isPng(r.files[0].attachment));
  assert.equal(r.files[0].name, 'pixle.png');
  const img = await loadImage(r.files[0].attachment);
  assert.ok(img.width > 1400 && img.height > 100, `${img.width}x${img.height}`);

  msg = await w.say(u, '!pixle ' + a);
  assert.match(msg.replies[0].content, /already guessed .* not counted/);
  msg = await w.say(u, '!pixle ' + b);
  assert.match(msg.replies[0].content, /Guess 2\/10 — 8 left/);
  const img2 = await loadImage(msg.replies[0].files[0].attachment);
  assert.ok(img2.height > img.height, 'Brett wächst mit jeder Zeile');

  // !pixle zeigt dasselbe Brett wieder
  msg = await w.say(u, '!pixle');
  assert.match(msg.replies[0].content, /Guess 2\/10/);
  assert.ok(isPng(msg.replies[0].files[0].attachment));
});

test('Lösen: SC = 30 − 3 je falschem Tipp davor (Grund bot:pixle), Lösung nur als Spoiler (Text UND Bild); danach startet sofort ein Übungsspiel ohne SC', async () => {
  const w = await world();
  const u = '100000000000000001';
  const wrong = await w.wrongNames(3);
  for (const n of wrong) await w.say(u, '!pixle ' + n);
  const s = await w.secret();
  const msg = await w.say(u, '!pixle ' + s.name);
  const r = msg.replies[0];
  assert.match(r.content, new RegExp(`🎉 <@${u}> solved today’s Pixle in \\*\\*4\\*\\* guesses!`));
  assert.match(r.content, /\*\*\+21 SC\*\*/);
  assert.deepEqual(w.pays, [{ uid: u, delta: 21, reason: 'bot:pixle' }]);
  // Spoilerschutz: Name nur innerhalb von ||…||
  assert.ok(r.content.includes(`||**${plainName(s.name)}**||`));
  assert.equal(r.content.replace(/\|\|[^|]*\|\|/g, '').includes(plainName(s.name)), false, 'Name steht außerhalb des Spoilers: ' + r.content);
  assert.ok(r.files.some(f => f.name === 'pixle.png'));
  assert.ok(r.files.some(f => f.name === 'SPOILER_pixle-card.png' && isPng(f.attachment)), 'Kartenbild als Spoiler-Anhang');
  assert.deepEqual(r.allowedMentions, { users: [u] });

  // Nach dem Lösen startet SOFORT das nächste Spiel (Übung, eigene Karte, keine SC)
  assert.match(r.content, /A new Pixle has started/);
  assert.match(r.content, /practice game with a fresh card, no SC/);
  const st = await w.state();
  const pl = st.players[u];
  assert.ok(pl.practice && pl.practice.secret && pl.practice.guesses.length === 0, 'Übungsspiel läuft');
  assert.notEqual(plainName(pl.practice.secret), plainName(s.name), 'andere Karte als die tägliche');
  const again = await w.say(u, '!pixle ' + wrong[0]);
  assert.match(again.replies[0].content, /Practice Pixle #1 · Guess 1\/10/);
  assert.equal(w.pays.length, 1, 'Übungsspiele zahlen nichts');
});

test('sofort gelöst: volle 30 SC', async () => {
  const w = await world();
  const s = await w.secret();
  const msg = await w.say('100000000000000001', '!pixle ' + s.name);
  assert.match(msg.replies[0].content, /in \*\*1\*\* guess!/);
  assert.equal(w.pays[0].delta, 30);
});

test('Limit: nach 10 (hier 3) Tipps endet das Spiel — Lösung nur als Spoiler — und das nächste startet sofort; jede Person zählt für sich', async () => {
  const w = await world();
  config.pixleMaxGuesses = 3;
  const [a, b, c, d] = await w.wrongNames(4);
  const u = '100000000000000001', v = '100000000000000002';
  await w.say(u, '!pixle ' + a); await w.say(u, '!pixle ' + b);
  let msg = await w.say(u, '!pixle ' + c);
  const s = await w.secret();
  assert.match(msg.replies[0].content, /That was your last guess of this game — the answer was \|\|\*\*/);
  assert.ok(msg.replies[0].content.includes(`||**${plainName(s.name)}**||`));
  assert.equal(msg.replies[0].content.replace(/\|\|[^|]*\|\|/g, '').includes(plainName(s.name)), false);
  assert.match(msg.replies[0].content, /A new Pixle has started/);
  assert.equal(w.pays.length, 0, 'nicht gelöst → keine SC');
  // der nächste Tipp gehört schon zum Übungsspiel
  msg = await w.say(u, '!pixle ' + d);
  assert.match(msg.replies[0].content, /Practice Pixle #1 · Guess 1\/3 — 2 left/);
  const pl = (await w.state()).players[u];
  assert.equal(pl.guesses.length, 3, 'die tägliche Karte bleibt bei ihren 3 Tipps');
  assert.equal(pl.solved, false);
  // Person v hat ihre eigenen Spiele
  msg = await w.say(v, '!pixle ' + a);
  assert.match(msg.replies[0].content, /Daily Pixle · Guess 1\/3 — 2 left/);
  config.pixleMaxGuesses = 10;
});

test('ohne verknüpftes Konto: Hinweis statt SC; SC-Fehler wird gemeldet; beides löst das Rätsel trotzdem', async () => {
  const w = await world();
  const s = await w.secret();
  let msg = await w.say('100000000000000099', '!pixle ' + s.name);
  assert.match(msg.replies[0].content, /You’d have won \*\*30 SC\*\* — link your account with `!link`/);
  assert.equal(w.pays.length, 0);
  assert.equal(((await w.state()).players['100000000000000099']).solved, true);

  w.ctx.game.adjustSc = async () => { throw new GameApiError(0, 'unreachable'); };
  msg = await w.say('100000000000000002', '!pixle ' + s.name);
  assert.match(msg.replies[0].content, /couldn’t pay out the 30 SC/);
  assert.equal(((await w.state()).players['100000000000000002']).solved, true, 'trotzdem gelöst, keine Doppelzahlung beim Wiederholen');
  w.ctx.game.adjustSc = async (uid, d, a, reason) => { w.pays.push({ uid, d }); return { applied: d, before: 0, after: d }; };
  await w.say('100000000000000002', '!pixle ' + s.name);        // jetzt ein Tipp im Übungsspiel — zahlt nie
  assert.equal(w.pays.length, 0);
});

test('zwei gleichzeitige richtige Tipps derselben Person zahlen nur einmal', async () => {
  const w = await world();
  const s = await w.secret();
  const u = '100000000000000001';
  const [a, b] = await Promise.all([w.say(u, '!pixle ' + s.name), w.say(u, '!pixle ' + s.name)]);
  assert.equal(w.pays.length, 1);
  assert.equal([a, b].filter(m => m.replies[0].content.startsWith('🎉')).length, 1, 'genau eine Siegmeldung');
  const second = [a, b].find(m => !m.replies[0].content.startsWith('🎉'));
  assert.match(second.replies[0].content, /Practice Pixle #1 · Guess 1\/10/, 'der zweite Tipp landet im bereits gestarteten Übungsspiel (und zahlt nichts)');
});

test('Tag, Zufall und Gestern: die geheime Karte bleibt den ganzen Tag gleich, wechselt um Mitternacht (Berlin); gestern wird genannt, Fortschritt beginnt neu', async () => {
  const w = await world();
  const u = '100000000000000001';
  const s1 = await w.secret();
  const [a] = await w.wrongNames(1);
  await w.say(u, '!pixle ' + a);
  w.w.t = Date.UTC(2026, 5, 10, 21, 30, 0);                      // 23:30 Berlin — derselbe Tag
  assert.equal((await w.secret()).name, s1.name);
  assert.equal((await w.state()).players[u].guesses.length, 1);

  w.w.t = Date.UTC(2026, 5, 10, 22, 5, 0);                       // 00:05 Berlin — neuer Tag
  const msg = await w.say(u, '!pixle');
  const st = await w.state();
  assert.equal(st.date, '2026-06-11');
  assert.deepEqual(st.players, {}, 'Fortschritt beginnt neu (gestern gemachte Tipps sind weg)');
  assert.ok(msg.replies[0].content.includes(`Yesterday’s card was **${plainName(s1.name)}**`), msg.replies[0].content);
  assert.notEqual(st.secret, s1.name, 'nie zweimal hintereinander dieselbe Karte');
});

test('Übungsspiele: beliebig viele nacheinander, jedes mit frischer Karte (nie die tägliche, nie ein Wiederholer), nie SC; Brett zeigt „SOLVED!“-Zeile erst beim Lösen', async () => {
  const w = await world();
  const u = '100000000000000001';
  const daily = await w.secret();
  await w.say(u, '!pixle ' + daily.name);                         // tägliches Spiel gelöst: 30 SC
  assert.equal(w.pays.length, 1);
  const seenSecrets = new Set([plainName(daily.name)]);
  for (let i = 1; i <= 6; i++) {
    const pl = (await w.state()).players[u];
    assert.equal(pl.practiceCount, i);
    assert.ok(!seenSecrets.has(plainName(pl.practice.secret)), `Übungskarte ${i} ist neu`);
    seenSecrets.add(plainName(pl.practice.secret));
    const msg = await w.say(u, '!pixle ' + pl.practice.secret);   // sofort richtig geraten
    const r = msg.replies[0];
    assert.match(r.content, new RegExp(`🎉 <@${u}> solved Practice Pixle #${i} in \\*\\*1\\*\\* guess! No SC for practice games`));
    assert.ok(r.content.includes(`||**${plainName(pl.practice.secret)}**||`), 'Lösung als Spoiler');
    assert.equal(r.content.replace(/\|\|[^|]*\|\|/g, '').includes(plainName(pl.practice.secret)), false);
    assert.deepEqual(r.allowedMentions, { parse: [] }, 'Übungssieg pingt niemanden');
    assert.match(r.content, /A new Pixle has started/);
    assert.ok(r.files.some(f => f.name === 'SPOILER_pixle-card.png'));
  }
  assert.equal(w.pays.length, 1, 'über alle Übungsspiele hinweg wurde nichts ausgezahlt');
});

test('nur das ERSTE Pixle des Tages zahlt: wer die tägliche Karte nicht löst, bekommt auch mit Übungssiegen keine SC; am nächsten Tag zahlt die neue tägliche Karte wieder', async () => {
  const w = await world();
  config.pixleMaxGuesses = 2;
  const u = '100000000000000001';
  const [a, b] = await w.wrongNames(2);
  await w.say(u, '!pixle ' + a); await w.say(u, '!pixle ' + b);       // tägliches Spiel verloren
  let pl = (await w.state()).players[u];
  assert.ok(pl.practice, 'Übungsspiel startete sofort');
  const msg = await w.say(u, '!pixle ' + pl.practice.secret);         // Übungsspiel gewonnen
  assert.match(msg.replies[0].content, /No SC for practice games/);
  assert.equal(w.pays.length, 0, 'kein SC, weil die tägliche Karte nicht gelöst wurde');

  w.w.t = Date.UTC(2026, 5, 11, 12, 0, 0);                            // nächster Tag
  const s2 = await w.secret();
  const res = await w.say(u, '!pixle ' + s2.name);
  assert.match(res.replies[0].content, /solved today’s Pixle in \*\*1\*\* guess!/);
  assert.deepEqual(w.pays, [{ uid: u, delta: 30, reason: 'bot:pixle' }], 'die neue tägliche Karte zahlt wieder');
  assert.deepEqual((await w.state()).players[u].practiceCount, 1, 'neuer Tag: Fortschritt beginnt neu, nur das gerade gestartete Übungsspiel');
  config.pixleMaxGuesses = 10;
});

test('!pixle zeigt das laufende Spiel: Übungsspiel frisch (ohne Brett), mit Tipps (Brett, „practice — no SC“); alte Zustände ohne Übungsspiel laufen weiter', async () => {
  const w = await world();
  const u = '100000000000000001';
  const daily = await w.secret();
  await w.say(u, '!pixle ' + daily.name);
  let msg = await w.say(u, '!pixle');
  assert.match(msg.replies[0].content, /Practice Pixle #1 is ready/);
  assert.ok(!msg.replies[0].files);
  const [a] = await w.wrongNames(1);
  await w.say(u, '!pixle ' + a);
  msg = await w.say(u, '!pixle');
  assert.match(msg.replies[0].content, /Practice Pixle #1 · Guess 1\/10 — 9 left\. \(practice — no SC\)/);
  assert.ok(isPng(msg.replies[0].files[0].attachment));

  // Zustand der Vorversion: täglich gelöst, aber noch kein Übungsspiel gespeichert
  const st = await w.state();
  delete st.players[u].practice; delete st.players[u].practiceCount; delete st.players[u].seen;
  await w.db.kvSet('pixle_state', st);
  msg = await w.say(u, '!pixle');
  assert.match(msg.replies[0].content, /Practice Pixle #1 is ready/, 'wird beim nächsten Aufruf nachgestartet');
});
