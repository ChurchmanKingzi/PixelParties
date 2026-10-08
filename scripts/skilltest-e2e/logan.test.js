'use strict';
// Logan, the Investment Monkee: sein Auszahlungseffekt („At the end of your turn“) feuert im Skill Test am ENDE JEDER ROUND (rounds.endRound).
//   node scripts/skilltest-e2e/logan.test.js
process.env.PP_ST_SIM = '1';
const { runGame } = require('../../skilltest/sim');
const rounds = require('../../skilltest/rounds');
let fails = 0;
const check = (name, cond, info) => { if (cond) console.log('  ✓', name); else { fails++; console.log('  ✗', name, info !== undefined ? '→ ' + JSON.stringify(info).slice(0, 300) : ''); } };

(async () => {
  const oL = console.log, oE = console.error;
  console.log = () => {}; console.error = () => {};
  const out = await runGame({ seats: 3, setupOnly: true, noProfileSeats: [0, 1, 2], seed: 41,
    mutatePrep: (prep) => { prep.players[1].heroes[0] = 'Logan, the Investment Monkee'; prep.players[2].heroes[0] = 'Logan, the Investment Monkee'; } });   // Logan ordentlich auf dem Brett (Karteninstanz, Skript)
  console.log = oL; console.error = oE;
  const { host, gs, engine } = out;
  const st = gs.skillTest;
  const events = [];
  const origLog = engine.log.bind(engine);
  engine.log = (n, d) => { if (/^logan_/.test(n)) events.push([n, d]); return origLog(n, d); };

  const seat = 1;
  const hero = gs.players[seat].heroes[0];
  check('Logan steht auf dem Brett', hero.name === 'Logan, the Investment Monkee', hero.name);
  const goldBefore = (gs.players[seat].gold = 10);
  hero._investCounters = 3;
  const hpBefore = gs.players.map(p => (p.heroes || []).filter(h => h && h.name).map(h => h.hp));
  await rounds.endRound(engine);
  check('Auszahlung am Rundenende ausgelöst (Gold oder Schaden)', events.length >= 1, events.map(e => e[0]));
  const gold = gs.players[seat].gold > goldBefore;
  const dmg = gs.players.some((p, i) => (p.heroes || []).filter(h => h && h.name).some((h, j) => h.hp < (hpBefore[i][j] ?? Infinity)));
  check('… und wirkt tatsächlich (Gold gestiegen oder Schaden verteilt)', gold || dmg, { gold: gs.players[seat].gold, events: events.map(e => e[0]) });
  check('die CPU wählt Schaden (Zähler bleiben liegen)', events.some(e => e[0] === 'logan_payout_damage') && hero._investCounters === 3, events.map(e => e[0]));
  const n1 = events.length;
  await rounds.startRound(engine, host);
  await rounds.endRound(engine);
  check('auch in der nächsten Round (Zähler bleiben liegen)', events.length > n1, events.map(e => e[0]));
  // Mensch (Sitz 2 wird zum „Menschen“ mit festen Antworten): die Abfragen am Rundenende erreichen ihn — Gold-Auszahlung gewählt.
  const human = 2;
  const h2 = gs.players[human].heroes[0];
  h2._investCounters = 2;
  const asked = [];
  engine.isCpuPlayer = (pi) => pi !== human;
  const pg = engine.promptGeneric.bind(engine);
  engine.promptGeneric = async (pi, cfg) => { if (pi === human) { asked.push(cfg && cfg.title); return { optionId: 'gold' }; } return pg(pi, cfg); };
  const goldH = gs.players[human].gold;
  await rounds.startRound(engine, host);
  await rounds.endRound(engine);
  check('Mensch am Rundenende gefragt (Logan-Abfrage)', asked.includes('Logan, the Investment Monkee') || events.filter(e => e[1] && e[1].player === gs.players[human].username).length > 0, { asked, events: events.map(e => e[0]) });
  console.log(fails ? `\n✗ ${fails} Fehler` : '\n✓ Logan-Tests grün');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
