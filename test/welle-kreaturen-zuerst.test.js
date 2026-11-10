'use strict';
// Welle mit `waveAnimation.kreaturenZuerst` (Flame Avalanche): Kreaturen VOR den Helden, Helden zu absoluten Zeitpunkten ab Wellenstart (`heroAt` + Platz * `hitDelay`),
// die Welle sendet `delay`/`heroAt`/`hitDelay` mit. Ohne das Flag bleibt der alte Ablauf (Helden nacheinander, danach die Kreaturen) unverändert.
const test = require('node:test');
const assert = require('node:assert/strict');
const { GameEngine } = require('../cards/effects/_engine');

function engine() {
  const log = [], t0 = Date.now();
  const rel = () => Date.now() - t0;
  const heroes = [0, 1, 2].map((i) => ({ name: 'Held' + i, hp: 400 }));
  const e = Object.create(GameEngine.prototype);
  Object.assign(e, {
    gs: { turn: 3, players: [{ heroes: [] }, { heroes }] },
    cardInstances: [], _fastMode: false, _aborted: false,
    physicalSide: () => 1,
    hasEffectImmunity: () => false, isSubmergedProtected: () => false,
    _markCreatureDamageImmunity() {}, _applyBoardAoeGuards: async (x) => x,
    beginAoeStrike: async () => {}, endMultiHit: async () => {},
    sync() {}, _sogBeginnen: () => null, _sogAbschliessen() {},
    _broadcastEvent: (name, data) => log.push({ ev: name, data, t: rel() }),
    actionDealDamage: async (q, hero, amount) => { log.push({ ev: 'held', name: hero.name, t: rel() }); hero.hp -= amount; },
    processCreatureDamageBatch: async (entries) => { log.push({ ev: 'kreaturen', n: entries.length, ohneStaffel: !!entries._ohneStaffel, t: rel() }); },
  });
  return { e, log, heroes };
}
const quelle = { name: 'Flame Avalanche', owner: 0, heroIdx: 1 };
const ziele = (heroes) => [
  ...[0, 1, 2].map((i) => ({ type: 'hero', owner: 1, heroIdx: i })),
  ...[0, 1, 2].map((i) => ({ type: 'creature', inst: { id: 10 + i, name: 'K' + i, zone: 'support', heroIdx: i, zoneSlot: 0, counters: {} } })),
];
const opts = (wave) => ({ damage: 150, damageType: 'destruction_spell', sourceName: 'Flame Avalanche', surpriseCheck: false, postTargetCheck: false, boardGuards: false, waveAnimation: wave });

test('kreaturenZuerst: Kreaturen vor den Helden, Helden bei heroAt + i * hitDelay, Welle sendet die Zeiten', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const { e, log, heroes } = engine();
  const lauf = e.dealDamageToTargets(quelle, ziele(heroes), opts({ type: 'flame_avalanche', duration: 2000, delay: 470, heroAt: 870, hitDelay: 120, kreaturenZuerst: true }));
  for (let i = 0; i < 40; i++) { await Promise.resolve(); t.mock.timers.tick(50); await Promise.resolve(); }
  await lauf;
  const welle = log.find((x) => x.ev === 'play_zone_animation');
  assert.equal(welle.data.kreaturenZuerst, true);
  assert.equal(welle.data.delay, 470); assert.equal(welle.data.heroAt, 870); assert.equal(welle.data.hitDelay, 120);
  assert.equal(welle.data.targets.length, 6, 'Zielliste bleibt in Engine-Reihenfolge (Helden, dann Kreaturen)');
  const kr = log.find((x) => x.ev === 'kreaturen'), helden = log.filter((x) => x.ev === 'held');
  assert.equal(kr.n, 3); assert.equal(kr.ohneStaffel, true, 'alle Kreaturen im selben Augenblick');
  assert.ok(kr.t >= 450 && kr.t < 560, 'Kreaturen bei ~470 ms: ' + kr.t);
  assert.deepEqual(helden.map((h) => h.name), ['Held0', 'Held1', 'Held2']);
  [870, 990, 1110].forEach((soll, i) => assert.ok(helden[i].t >= soll - 5 && helden[i].t < soll + 100, `Held ${i} bei ~${soll} ms: ${helden[i].t}`));
  assert.ok(kr.t < helden[0].t, 'Kreaturen zuerst');
});

test('heldenZuerst: Helden bei heroAt + i * hitDelay, danach alle Kreaturen gleichzeitig bei creatureAt', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const { e, log, heroes } = engine();
  const lauf = e.dealDamageToTargets(quelle, ziele(heroes), opts({ type: 'flame_avalanche', duration: 2000, delay: 590, heroAt: 590, hitDelay: 120, creatureAt: 1100, heldenZuerst: true }));
  for (let i = 0; i < 60; i++) { await Promise.resolve(); t.mock.timers.tick(50); await Promise.resolve(); }
  await lauf;
  const welle = log.find((x) => x.ev === 'play_zone_animation');
  assert.equal(welle.data.heldenZuerst, true); assert.equal(welle.data.creatureAt, 1100); assert.equal(welle.data.heroAt, 590); assert.equal(welle.data.hitDelay, 120);
  const kr = log.find((x) => x.ev === 'kreaturen'), helden = log.filter((x) => x.ev === 'held');
  assert.deepEqual(helden.map((h) => h.name), ['Held0', 'Held1', 'Held2']);
  [590, 710, 830].forEach((soll, i) => assert.ok(helden[i].t >= soll - 5 && helden[i].t < soll + 100, `Held ${i} bei ~${soll} ms: ${helden[i].t}`));
  assert.equal(kr.n, 3); assert.equal(kr.ohneStaffel, true);
  assert.ok(kr.t >= 1095 && kr.t < 1200, 'Kreaturen bei ~1100 ms: ' + kr.t); assert.ok(kr.t > helden[2].t, 'Helden zuerst');
});

test('ohne Flag: alter Ablauf (Helden nacheinander im hitDelay-Takt, danach die Kreaturen), Welle sendet keine neuen Felder', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const { e, log, heroes } = engine();
  const lauf = e.dealDamageToTargets(quelle, ziele(heroes), { ...opts({ type: 'flame_avalanche', duration: 1600, delay: 520 }), hitDelay: 150 });
  for (let i = 0; i < 40; i++) { await Promise.resolve(); t.mock.timers.tick(50); await Promise.resolve(); }
  await lauf;
  const welle = log.find((x) => x.ev === 'play_zone_animation');
  assert.equal('kreaturenZuerst' in welle.data, false); assert.equal('heroAt' in welle.data, false);
  const kr = log.find((x) => x.ev === 'kreaturen'), helden = log.filter((x) => x.ev === 'held');
  assert.equal(kr.ohneStaffel, false);
  assert.ok(helden[0].t >= 520 && helden[1].t - helden[0].t >= 140 && kr.t > helden[2].t, 'Helden vor den Kreaturen, 150-ms-Takt');
});

test('Idas Einzelziel (einzel): Welle sendet heroAt = delay, hitDelay 0', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const { e, log } = engine();
  const lauf = e._spieleWellenAnimation({ waveAnimation: { type: 'flame_avalanche', delay: 470, heroAt: 870, hitDelay: 120, kreaturenZuerst: true } }, quelle, 0, 1, [{ owner: 1, heroIdx: 0, zoneSlot: -1 }], { einzel: true });
  t.mock.timers.tick(500); const r = await lauf;
  const w = log.find((x) => x.ev === 'play_zone_animation').data;
  assert.equal(w.heroAt, 470); assert.equal(w.hitDelay, 0); assert.ok(typeof r.t0 === 'number');
});
