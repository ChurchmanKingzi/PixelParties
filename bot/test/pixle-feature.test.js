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
  // die geheime Karte einer Person (jede hat ihre eigene)
  const secret = async (uid = '100000000000000001') => { const { p } = await ctx._pixle.prepare(uid); return renderer.allCards().find(c => c.name === p.secret); };
  // verschiedene, eindeutig auflösbare Karten, die NICHT die geheime der Person sind
  const wrongNames = async (n, uid) => {
    const s = await secret(uid);
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
  assert.ok(st.players['100000000000000001'].secret && st.date === '2026-06-10', 'die Person hat ihre eigene geheime Karte');
  assert.match(r.content, /guess your own secret card/);
  assert.match(r.content, /Everybody gets their own/);
  assert.ok(!/archetype/i.test(r.content), 'kein Archetyp mehr in den Regeln');
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
  assert.ok(img.width > 1200 && img.width < 1500 && img.height > 100, `${img.width}x${img.height}`);

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
  const s = await w.secret('100000000000000099');
  let msg = await w.say('100000000000000099', '!pixle ' + s.name);
  assert.match(msg.replies[0].content, /You’d have won \*\*30 SC\*\* — link your account with `!link`/);
  assert.equal(w.pays.length, 0);
  assert.equal(((await w.state()).players['100000000000000099']).solved, true);

  w.ctx.game.adjustSc = async () => { throw new GameApiError(0, 'unreachable'); };
  const s2 = await w.secret('100000000000000002');
  msg = await w.say('100000000000000002', '!pixle ' + s2.name);
  assert.match(msg.replies[0].content, /couldn’t pay out the 30 SC/);
  assert.equal(((await w.state()).players['100000000000000002']).solved, true, 'trotzdem gelöst, keine Doppelzahlung beim Wiederholen');
  w.ctx.game.adjustSc = async (uid, d, a, reason) => { w.pays.push({ uid, d }); return { applied: d, before: 0, after: d }; };
  await w.say('100000000000000002', '!pixle ' + s2.name);       // jetzt ein Tipp im Übungsspiel — zahlt nie
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

test('Tag: die geheime Karte einer Person bleibt den ganzen Tag gleich, wechselt um Mitternacht (Berlin); die vorherige wird genannt, nie dieselbe zweimal hintereinander', async () => {
  const w = await world();
  const u = '100000000000000001';
  const s1 = await w.secret(u);
  const [a] = await w.wrongNames(1, u);
  await w.say(u, '!pixle ' + a);
  w.w.t = Date.UTC(2026, 5, 10, 21, 30, 0);                      // 23:30 Berlin — derselbe Tag
  assert.equal((await w.secret(u)).name, s1.name);
  assert.equal((await w.state()).players[u].guesses.length, 1);

  w.w.t = Date.UTC(2026, 5, 10, 22, 5, 0);                       // 00:05 Berlin — neuer Tag
  const msg = await w.say(u, '!pixle');
  const st = await w.state();
  assert.equal(st.date, '2026-06-11');
  assert.equal(st.players[u].guesses.length, 0, 'Fortschritt beginnt neu (gestern gemachte Tipps sind weg)');
  assert.ok(msg.replies[0].content.includes(`Your previous daily card was **${plainName(s1.name)}**`), msg.replies[0].content);
  assert.notEqual(st.players[u].secret, s1.name, 'nie zweimal hintereinander dieselbe Karte');
});

test('JEDE Person hat ihr eigenes Pixle: eigene Karte, eigene Tipps, eigene SC — niemand kann bei anderen mitlesen oder „snipen“', async () => {
  const w = await world();
  const ids = ['100000000000000001', '100000000000000002', '100000000000000003', '100000000000000004', '100000000000000005', '100000000000000006'];
  const secrets = [];
  for (const id of ids) secrets.push((await w.secret(id)).name);
  assert.ok(new Set(secrets).size > 1, 'die Karten unterscheiden sich: ' + secrets.join(' | '));

  // zwei Personen mit verschiedenen Karten
  let iA = 0, iB = 1;
  while (secrets[iA] === secrets[iB]) iB++;
  const A = ids[iA], B = ids[iB], secA = secrets[iA], secB = secrets[iB];
  assert.equal((await w.secret(A)).name, secA, 'Karte bleibt stabil');
  // A tippt die Karte von B — das ist für A nur ein Tipp (kein Sieg, keine SC)
  let msg = await w.say(A, '!pixle ' + secB);
  assert.ok(!msg.replies[0].content.startsWith('🎉'), 'fremde Lösung löst nichts');
  assert.equal(w.pays.length, 0);
  assert.equal((await w.state()).players[B].guesses.length, 0, 'B bleibt unberührt');
  // jeder löst SEINE Karte und bekommt SEINE tägliche SC (einmal pro Person und Tag)
  msg = await w.say(B, '!pixle ' + secB);
  assert.match(msg.replies[0].content, new RegExp(`🎉 <@${B}> solved today’s Pixle in \\*\\*1\\*\\* guess! \\*\\*\\+30 SC`));
  msg = await w.say(A, '!pixle ' + secA);
  assert.match(msg.replies[0].content, new RegExp(`🎉 <@${A}> solved today’s Pixle in \\*\\*2\\*\\* guesses! \\*\\*\\+27 SC`));
  assert.deepEqual(w.pays.map(x => [x.uid, x.delta]).sort(), [[A, 27], [B, 30]].sort());
  // danach zahlt für beide nur noch Übung — nichts
  for (const id of [A, B]) {
    const pl = (await w.state()).players[id];
    await w.say(id, '!pixle ' + pl.practice.secret);
  }
  assert.equal(w.pays.length, 2, 'einmal pro Tag UND Person');
});

test('„Vorherige Karte“ nennt nur die eigene; Zustand der Vorversion (gemeinsame Karte) wird sauber übernommen', async () => {
  const w = await world();
  const A = '100000000000000001', B = '100000000000000002';
  const sA = await w.secret(A), sB = await w.secret(B);
  w.w.t = Date.UTC(2026, 5, 11, 12, 0, 0);
  const mA = await w.say(A, '!pixle');
  assert.ok(mA.replies[0].content.includes(`**${plainName(sA.name)}**`));
  if (plainName(sA.name) !== plainName(sB.name)) assert.ok(!mA.replies[0].content.includes(plainName(sB.name)), 'nicht die Karte der anderen Person');

  // Zustand der Vorversion: eine gemeinsame geheime Karte, Person A hatte schon getippt, B noch nicht
  const [x] = await w.wrongNames(1, A);
  await w.db.kvSet('pixle_state', { date: '2026-06-11', secret: x, players: { [A]: { guesses: ['Fireball'], solved: false } } });
  assert.equal((await w.secret(A)).name, x, 'angefangenes Spiel behält die gemeinsame Karte');
  const sB2 = await w.secret(B);
  assert.ok(sB2.name, 'wer noch nicht gespielt hatte, bekommt eine eigene Karte');
  assert.equal((await w.state()).players[B].secret, sB2.name);
});

test('das Brett hat keine Archetyp-Spalte mehr (acht Hinweis-Spalten)', async () => {
  const w = await world();
  const u = '100000000000000001';
  const [a] = await w.wrongNames(1, u);
  const msg = await w.say(u, '!pixle ' + a);
  const { ORDER } = require('../lib/pixle-board');
  assert.deepEqual(ORDER, ['type', 'subtype', 'level', 'hp', 'atk', 'cost', 'school', 'set']);
  assert.ok(isPng(msg.replies[0].files[0].attachment));
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
