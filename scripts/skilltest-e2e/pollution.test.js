'use strict';
// Pollution Tokens („… into your free Support Zones“) zählen die freien Zonen GEFALLENER Heroes mit (Pyroblast mit nur einem lebenden Hero ohne freie Zone);
// Acid Rain („one of their Heroes' free Support Zones“) bleibt bei den lebenden.
//   node scripts/skilltest-e2e/pollution.test.js
process.env.PP_ST_SIM = '1';
const { runGame } = require('../../skilltest/sim');
const bot = require('../../skilltest/bot');
const rounds = require('../../skilltest/rounds');
const P = require('../../cards/effects/_pollution-shared');
let fails = 0;
const check = (name, cond, info) => { if (cond) console.log('  ✓', name); else { fails++; console.log('  ✗', name, info !== undefined ? '→ ' + JSON.stringify(info).slice(0, 300) : ''); } };

(async () => {
  const oL = console.log, oE = console.error;
  console.log = () => {}; console.error = () => {};
  const out = await runGame({ seats: 3, setupOnly: true, noProfileSeats: [0, 1, 2], seed: 21,
    mutatePrep: (prep) => { prep.players[0].hand = ['Pyroblast']; } });
  console.log = oL; console.error = oE;
  const { room, host, gs, engine } = out;
  const ps = gs.players[0];

  // Lage des Nutzers: ein lebender Hero ohne freie Zone, ein gefallener Hero mit freien Zonen
  const live = ps.heroes.findIndex(h => h && h.name), dead = ps.heroes.findIndex((h, i) => h && h.name && i !== live);
  for (let hi = 0; hi < ps.heroes.length; hi++) if (ps.heroes[hi] && ps.heroes[hi].name && hi !== live && hi !== dead) { ps.heroes[hi].hp = 0; ps.supportZones[hi] = [['Skeleton Reaper'], ['Skeleton Reaper'], ['Skeleton Reaper']]; }
  ps.supportZones[live] = [['Skeleton Reaper'], ['Skeleton Reaper'], ['Skeleton Reaper']];
  ps.supportZones[dead] = [[], [], []];
  ps.heroes[dead].hp = 0;

  console.log('Zählen und Aufzählen');
  check('3 freie Zonen: die des gefallenen Heroes', P.countFreeZones(gs, 0) === 3 && P.getFreeZones(gs, 0).every(z => z.heroIdx === dead), P.getFreeZones(gs, 0));
  check('Acid Rain (aliveOnly): keine', P.countFreeZones(gs, 0, { aliveOnly: true }) === 0 && !P.hasFreeZone(gs, 0, { aliveOnly: true }));
  check('hasFreeZone ohne Option zählt die gefallenen mit', P.hasFreeZone(gs, 0));

  console.log('Tokens setzen');
  const r = await P.placePollutionTokens(engine, 0, 2, 'Test', {});
  check('zwei Tokens in den Zonen des gefallenen Heroes', r.placed === 2 && ps.supportZones[dead].filter(z => z[0] === 'Pollution Token').length === 2, [r.placed, ps.supportZones[dead]]);
  const r2 = await P.placePollutionTokens(engine, 0, 1, 'Acid Rain', { aliveOnly: true });
  check('Acid Rain-Weg (aliveOnly): nichts gesetzt, kein Absturz', r2.placed === 0 && ps.supportZones[dead].filter(z => z[0] === 'Pollution Token').length === 2, r2.placed);

  console.log('Pyroblast im Spiel');
  // Der Zug wird gespielt wie ein Mensch ihn spielt (Pyroblast mit dem lebenden Hero). Trifft der zufällig gewählte Gegner nicht (geschützt, z. B. durch Charme),
  // werden keine Tokens gesetzt — dann frisch und noch einmal (höchstens 8 Versuche).
  const st = gs.skillTest;
  let events = [], tokens = 0, tries = 0;
  const origLog = engine.log.bind(engine);
  engine.log = (n, d) => { if (/^pyroblast/.test(n)) events.push([n, d]); return origLog(n, d); };
  do {
    tries++;
    events = [];
    ps.supportZones[dead] = [[], [], []];
    ps.hand = ['Pyroblast'];
    engine.cardInstances.filter(i => i.zone === 'support' && i.owner === 0 && i.heroIdx === dead).forEach(i => engine._untrackCard(i.id));
    gs.hoptUsed = {}; st.busy = false; gs.activePlayer = 0; gs.currentPhase = 3;
    const params = { cardName: 'Pyroblast', handIndex: 0, heroIdx: live };
    await rounds.act(room, 0, 'play_spell', params, () => host.doPlaySpell(room, 0, params), host);
    tokens = ps.supportZones[dead].filter(z => z[0] === 'Pollution Token').length;
  } while (tokens === 0 && !events.some(e => e[0] === 'pyroblast_fizzle') && tries < 8 && !gs.result);
  check('Pyroblast wirkt (kein „no_free_zones“)', events.some(e => e[0] === 'pyroblast') && !events.some(e => e[0] === 'pyroblast_fizzle'), { tries, events });
  check('die Pollution Tokens liegen in den Zonen des gefallenen Heroes', tokens >= 1 && !ps.hand.includes('Pyroblast'), { tokens, tries, hand: ps.hand });
  void bot;

  console.log(fails ? `\n✗ ${fails} Fehler` : '\n✓ Pollution-Tests grün');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
