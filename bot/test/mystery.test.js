'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { role, member, guild, message, setup, config } = require('./helpers');
const { loadImage } = require('@napi-rs/canvas');
const renderer = require('../lib/card-renderer');
const { GameApiError } = require('../lib/game-api');

const creator = role('R_CREATOR', 'Creator');
const CH = '1561796630762623036';

async function world(gameApi = {}) {
  config.channels.minigames = CH;
  const pays = [];
  const linked = new Set(['100000000000000001', '100000000000000002']);
  const { ctx, db } = await setup({
    adjustSc: async (uid, delta, admin, reason) => {
      if (!linked.has(uid)) throw new GameApiError(404, 'not_linked');
      pays.push({ uid, delta, reason });
      return { username: 'p', before: 100, after: 100 + delta, applied: delta };
    },
    ...gameApi,
  });
  const g = guild({ roles: [creator] });
  // Eigene Uhr: jeder Abruf rückt 1,7 s vor (die Tipp-Abkühlzeit blockiert so nie); Stundenwechsel setzt der Test selbst.
  const w = { t: Date.UTC(2026, 5, 10, 12, 5, 0) };
  ctx._mystery.setClock(() => (w.t += 1700));
  const users = {};
  const say = async (id, content, channelId = CH, extra = {}) => {
    users[id] ||= member({ id, ...extra });
    g.members.cache.set(id, users[id]);
    const msg = message({ guild: g, member: users[id], content });
    msg.channel.id = channelId;
    msg.sent = [];
    const send = msg.channel.send;
    msg.channel.send = async p => { msg.sent.push(typeof p === 'string' ? { content: p } : p); return send(p); };
    await ctx.handleMessage(msg);
    return msg;
  };
  const current = () => db.kvGet('mystery_current');
  const cardNot = name => renderer.allCards().find(c => c.name !== name && renderer.hasArt(c.name) && !/token/i.test(c.cardType));
  return { ctx, db, g, say, pays, current, linked, cardNot, w };
}
const isPng = b => Buffer.isBuffer(b) && b.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));

test('nur im Rätsel-Kanal; ohne Rätsel erzeugt !mystery eines (Ausschnitt als Bild, erstes der Stunde = SC wert)', async () => {
  const w = await world();
  let msg = await w.say('100000000000000001', '!mystery', 'OTHER');
  assert.match(msg.replies[0].content, new RegExp(`lives in <#${CH}>`));
  assert.equal(await w.current(), null);

  msg = await w.say('100000000000000001', '!guess Fireball', 'OTHER');
  assert.match(msg.replies[0].content, /lives in/);

  msg = await w.say('100000000000000001', '!guess Fireball');
  assert.match(msg.replies[0].content, /no active puzzle/i);

  msg = await w.say('100000000000000001', '!mystery');
  const r = msg.replies[0];
  assert.match(r.content, /Mystery card/);
  assert.match(r.content, /Worth \*\*20 SC\*\*/);
  assert.ok(isPng(r.files[0].attachment));
  const img = await loadImage(r.files[0].attachment);
  assert.equal(img.width, 384);
  const cur = await w.current();
  assert.ok(cur.card && cur.center && Number.isFinite(cur.center.x));
  assert.equal(cur.scWorth, true, 'das erste Rätsel der Stunde ist SC wert');
  // erneutes !mystery zeigt DASSELBE Rätsel, zählt nicht neu
  await w.say('100000000000000002', '!mystery');
  assert.equal((await w.current()).card, cur.card);
});

test('falsche Tipps: zählen je Person, doppelte/unbekannte nicht; Gewinn zahlt 20 − 2·eigene falsche Tipps, danach neues Rätsel', async () => {
  const w = await world();
  await w.say('100000000000000001', '!mystery');
  const target = (await w.current()).card;
  const wrong1 = w.cardNot(target).name;

  let msg = await w.say('100000000000000001', '!guess qzxwvkjq');
  assert.match(msg.replies[0].content, /not counted/);
  msg = await w.say('100000000000000001', '!guess ' + wrong1);
  assert.match(msg.replies[0].content, /❌/);
  assert.match(msg.replies[0].content, /wrong guesses on this card: 1 → a win would pay 18 SC/);
  msg = await w.say('100000000000000001', '!guess ' + wrong1);
  assert.match(msg.replies[0].content, /already guessed — not counted/);
  assert.equal((await w.current()).guesses['100000000000000001'], 1);

  // zweite Person tippt falsch (anderer Wert), erste gewinnt nach 1 falschem Tipp
  const wrong2 = renderer.allCards().find(c => c.name !== target && c.name !== wrong1 && renderer.hasArt(c.name) && !/token/i.test(c.cardType)).name;
  await w.say('100000000000000002', '!guess ' + wrong2);
  msg = await w.say('100000000000000001', '!guess ' + target);
  assert.match(msg.replies[0].content, new RegExp('🎉 <@100000000000000001> got it'));
  assert.deepEqual(w.pays, [{ uid: '100000000000000001', delta: 18, reason: 'bot:mystery' }]);
  assert.ok(isPng(msg.replies[0].files[0].attachment), 'Lösung als Kartenbild');
  assert.match(msg.sent.at(-1).content, /Mystery card/, 'neues Rätsel gepostet');
  assert.match(msg.sent.at(-1).content, /No SC for this one/, 'zweites Rätsel derselben Stunde: keine SC');
  const cur = await w.current();
  assert.notEqual(cur.card, target);
  assert.deepEqual(cur.guesses, {}, 'Tippzähler beginnt neu');
  assert.equal(cur.scWorth, false);
});

test('Gewinner ohne verknüpftes Konto: Hinweis, kein Absturz, Spiel geht weiter; SC-Fehler wird gemeldet', async () => {
  const w = await world();
  await w.say('100000000000000009', '!mystery');
  const target = (await w.current()).card;
  let msg = await w.say('100000000000000009', '!guess ' + target);
  assert.match(msg.replies[0].content, /link your account with `!link` to receive SC/);
  assert.equal(w.pays.length, 0);
  assert.ok(await w.current(), 'Folge-Rätsel läuft');

  assert.equal((await w.current()).scWorth, false, 'Folgerätsel in derselben Stunde: keine SC');
  w.w.t = Date.UTC(2026, 5, 10, 13, 0, 0);                    // neue volle Stunde …
  await w.say('100000000000000077', '!mystery skip', CH, { roles: [creator] });   // … Admin lässt neu erzeugen → SC wert
  assert.equal((await w.current()).scWorth, true);
  const target2 = (await w.current()).card;
  w.ctx.game.adjustSc = async () => { throw new GameApiError(0, 'unreachable'); };
  msg = await w.say('100000000000000001', '!guess ' + target2);
  assert.match(msg.replies[0].content, /couldn’t pay out the 20 SC/);
});

test('zu viele falsche Tipps: 0 SC; 10 falsche = nichts mehr', async () => {
  const w = await world();
  await w.say('100000000000000001', '!mystery');
  const cur = await w.current();
  cur.guesses['100000000000000001'] = 12;
  await w.db.kvSet('mystery_current', cur);
  const msg = await w.say('100000000000000001', '!guess ' + cur.card);
  assert.match(msg.replies[0].content, /No SC this time/);
  assert.equal(w.pays.length, 0);
});

test('Rätsel entstehen unbegrenzt; nur das erste neu erzeugte jeder vollen Stunde zahlt SC, die Stunde danach wieder', async () => {
  const w = await world();
  const solve = async () => {
    const cur = await w.current();
    const before = w.pays.length;
    const msg = await w.say('100000000000000001', '!guess ' + cur.card);
    assert.match(msg.replies[0].content, /got it/);
    return { cur, paid: w.pays.length - before, msg };
  };
  await w.say('100000000000000001', '!mystery');                    // 12:05 → erstes der Stunde: SC wert
  assert.equal((await w.current()).scWorth, true);
  let r = await solve();
  assert.equal(r.paid, 1, 'SC-Rätsel zahlt');
  assert.equal(w.pays.at(-1).delta, 20);
  // 10 weitere Rätsel in derselben Stunde: nie ein Ende, nie SC
  for (let i = 0; i < 10; i++) {
    const cur = await w.current();
    assert.ok(cur, 'Rätsel ' + (i + 2) + ' in derselben Stunde');
    assert.equal(cur.scWorth, false);
    r = await solve();
    assert.equal(r.paid, 0, 'Übungsrätsel zahlt nichts');
    assert.match(r.msg.replies[0].content, /No SC for this one/);
    assert.match(r.msg.sent.at(-1).content, /No SC for this one — only the first new puzzle each full hour pays/);
  }
  assert.equal(w.pays.length, 1);
  // volle Stunde beginnt: das nächste ERZEUGTE Rätsel (nach dem Lösen des offenen) ist wieder SC wert
  w.w.t = Date.UTC(2026, 5, 10, 13, 0, 5);
  r = await solve();                                                 // das noch offene Rätsel war ein Übungsrätsel (zahlt nichts) …
  assert.equal(r.paid, 0);
  assert.equal((await w.current()).scWorth, true, '… das danach erzeugte ist das erste der neuen Stunde');
  r = await solve();
  assert.equal(r.paid, 1);
  assert.equal(w.pays.length, 2);
  assert.equal((await w.current()).scWorth, false, 'danach in der Stunde wieder keine SC');
}, { timeout: 60000 });

test('ein offenes SC-Rätsel bleibt SC wert, auch wenn die Stunde wechselt', async () => {
  const w = await world();
  await w.say('100000000000000001', '!mystery');                    // 12:05, SC wert
  w.w.t = Date.UTC(2026, 5, 10, 14, 30, 0);                         // Stunden später gelöst
  const cur = await w.current();
  const msg = await w.say('100000000000000001', '!guess ' + cur.card);
  assert.match(msg.replies[0].content, /\*\*\+20 SC\*\*/);
  assert.equal(w.pays.length, 1);
});

test('Hinweis zur Stunde: Übungsrätsel nennt den Beginn der nächsten vollen Stunde; wrong-Antwort sagt „no SC on this puzzle“', async () => {
  const w = await world();
  await w.say('100000000000000001', '!mystery');
  const first = await w.current();
  await w.say('100000000000000001', '!guess ' + first.card);        // → Übungsrätsel
  const msg = await w.say('100000000000000001', '!mystery');
  const next = Math.floor(Date.UTC(2026, 5, 10, 13, 0, 0) / 1000);
  assert.match(msg.replies[0].content, new RegExp(`No SC for this one.*<t:${next}:R>`));
  const cur = await w.current();
  const wrong = w.cardNot(cur.card).name;
  const g = await w.say('100000000000000001', '!guess ' + wrong);
  assert.match(g.replies[0].content, /no SC on this puzzle/);
  assert.ok(!/would pay/.test(g.replies[0].content));
});

test('zwei gleichzeitige richtige Tipps: nur EINER gewinnt und wird bezahlt', async () => {
  const w = await world();
  await w.say('100000000000000001', '!mystery');
  const target = (await w.current()).card;
  const [a, b] = await Promise.all([w.say('100000000000000001', '!guess ' + target), w.say('100000000000000002', '!guess ' + target)]);
  assert.equal(w.pays.length, 1);
  const wins = [a, b].filter(m => /got it/.test(m.replies[0]?.content || ''));
  assert.equal(wins.length, 1);
});

test('!mystery skip: nur Admin; zeigt Lösung und startet neues Rätsel', async () => {
  const w = await world();
  await w.say('100000000000000001', '!mystery');
  const old = (await w.current()).card;
  let msg = await w.say('100000000000000001', '!mystery skip');
  assert.match(msg.replies[0].content, /Only Creator/);
  assert.equal((await w.current()).card, old);
  msg = await w.say('100000000000000005', '!mystery skip', CH, { roles: [creator] });
  assert.match(msg.sent[0].content, new RegExp('Skipped. The answer was'));
  assert.notEqual((await w.current()).card, old);
});

test('Ausschnitte: klein, aus der Kunst, abwechslungsreich und reproduzierbar (feste Zufallsquelle)', async () => {
  await renderer.init();
  const seeded = () => { let s = 42; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
  const name = 'Teocuilatl, the Embodiment of Gods';
  const a = await renderer.pickArtCrop(name, { rng: seeded() });
  const b = await renderer.pickArtCrop(name, { rng: seeded() });
  assert.deepEqual(a, b);
  assert.ok(a.w === a.h && a.w >= 8 && a.w <= 30, JSON.stringify(a));
  assert.equal(await renderer.pickArtCrop('Es gibt diese Karte nicht'), null);
  // über viele Karten: nie ein Fehler, immer innerhalb des Bildes
  const sample = renderer.allCards().filter(c => renderer.hasArt(c.name)).filter((_, i) => i % 50 === 0);
  for (const c of sample) {
    const r = await renderer.pickArtCrop(c.name);
    assert.ok(r && r.x >= 0 && r.y >= 0, c.name);
    assert.ok(isPng(await renderer.renderArtCrop(c.name, r)), c.name);
  }
});

test('Ausschnitt startet klein und wird mit JEDEM falschen Tipp (egal von wem) um einen Bildpunkt größer — gleicher Mittelpunkt, neues Bild sofort', async () => {
  const w = await world();
  await w.say('100000000000000001', '!mystery');
  const cur0 = await w.current();
  const art = await renderer.artSize(cur0.card);
  const start = await w.ctx._mystery.rectFor(cur0);
  assert.equal(start.w, start.h);
  assert.ok(start.w < Math.min(art.w, art.h) * 0.2, `Start klein: ${start.w} von ${art.w}x${art.h}`);

  const wrongs = renderer.allCards().filter(c => c.name !== cur0.card && renderer.hasArt(c.name) && !/token/i.test(c.cardType)).slice(10, 14).map(c => c.name);
  const users = ['100000000000000001', '100000000000000002', '100000000000000003', '100000000000000001'];
  let prev = start;
  for (let i = 0; i < wrongs.length; i++) {
    const msg = await w.say(users[i], '!guess ' + wrongs[i]);
    assert.match(msg.replies[0].content, /❌/);
    assert.ok(isPng(msg.replies[0].files[0].attachment), 'neues Bild gleich dabei');
    const rect = await w.ctx._mystery.rectFor(await w.current());
    assert.equal(rect.w, prev.w + Math.max(1, Math.round(Math.min(art.w, art.h) * 0.02)), 'minimal größer: +1 Bildpunkt');
    // Mittelpunkt bleibt (außer am Bildrand)
    const c0 = { x: start.x + start.w / 2, y: start.y + start.h / 2 }, c1 = { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
    if (start.x > 4 && start.y > 4 && rect.x + rect.w < art.w - 1 && rect.y + rect.h < art.h - 1) assert.ok(Math.abs(c0.x - c1.x) <= 1 && Math.abs(c0.y - c1.y) <= 1);
    prev = rect;
  }
  // doppelte, unbekannte und mehrdeutige Tipps lassen das Bild unverändert
  await w.say('100000000000000002', '!guess ' + wrongs[0]);
  await w.say('100000000000000002', '!guess qzxwvkjq');
  assert.deepEqual(await w.ctx._mystery.rectFor(await w.current()), prev);
  // !mystery zeigt die aktuelle (vergrößerte) Fassung
  const again = await w.say('100000000000000002', '!mystery');
  assert.match(again.replies[0].content, /zooms out a little with every wrong guess/);
  assert.ok(isPng(again.replies[0].files[0].attachment));
});

test('Rätsel aus der Vorversion (crop-Rechteck statt center) laufen weiter', async () => {
  const w = await world();
  await w.say('100000000000000001', '!mystery');
  const cur = await w.current();
  const old = { card: cur.card, crop: { x: 20, y: 10, w: 18, h: 18 }, number: 1, guesses: {}, tried: [], createdAt: 1 };
  const r = await w.ctx._mystery.rectFor(old);
  assert.ok(r && r.w >= 6 && r.x >= 0);
});
