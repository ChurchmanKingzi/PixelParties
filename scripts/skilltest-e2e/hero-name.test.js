'use strict';
// CPU-Sitze im Skill Test: Namen aus dem mittleren Hero (nur der Name, ohne Titel), eindeutig; Server-Kurzname = Client-Kurzname.
//   node scripts/skilltest-e2e/hero-name.test.js
process.env.PP_ST_SIM = '1';
const fs = require('fs');
const path = require('path');
const { heroShortName } = require('../../skilltest/hero-name');
const { runGame } = require('../../skilltest/sim');
let fails = 0;
const check = (name, cond, info) => { if (cond) console.log('  ✓', name); else { fails++; console.log('  ✗', name, info !== undefined ? '→ ' + JSON.stringify(info).slice(0, 300) : ''); } };

(async () => {
  console.log('Kurzname');
  check('Name ohne Titel', heroShortName('Garius, the Great Reformer') === 'Garius' && heroShortName('Treasure Huntress Semi') === 'Semi'
    && heroShortName('Tarleinn the Traveler') === 'Tarleinn' && heroShortName('Fairy Queen Crestina, the Creation Fairy') === 'Crestina');

  // Zwilling des Clients (public/app-shared.jsx `heroDisplayName`) — gleiche Regeln, sonst driften Server- und Client-Namen auseinander.
  const src = fs.readFileSync(path.join(__dirname, '../../public/app-shared.jsx'), 'utf-8');
  const i = src.indexOf('const HERO_NAME_OVERRIDES = {');
  const j = src.indexOf('function heroDisplayName(fullName) {');
  const k = src.indexOf('\n}\n', j) + 3;
  const clientFn = new Function(src.slice(i, k) + '\nreturn heroDisplayName;')();
  const cards = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/cards.json'), 'utf-8'));
  const list = Array.isArray(cards) ? cards : Object.values(cards.cards || cards);
  const heroes = list.filter(c => c && c.cardType === 'Hero').map(c => c.name);
  const diff = heroes.filter(n => clientFn(n) !== heroShortName(n));
  check(`Server und Client kürzen alle ${heroes.length} Heroes gleich`, heroes.length > 50 && diff.length === 0, diff.slice(0, 5));

  console.log('Kampfstart');
  const oL = console.log, oE = console.error;
  console.log = () => {}; console.error = () => {};
  const out = await runGame({ seats: 5, setupOnly: true, noProfileSeats: [0, 1, 2, 3, 4], seed: 7 });
  console.log = oL; console.error = oE;
  const { room, gs } = out;
  const bots = room.players.map((p, i) => ({ p, i })).filter(x => x.p.isBot);
  check('es gibt CPU-Sitze', bots.length >= 3, bots.length);
  const middle = (i) => { const hs = gs.players[i].heroes || []; return (hs[1] && hs[1].name) || (hs.find(h => h && h.name) || {}).name; };
  check('CPU heißt wie sein mittlerer Hero (nur Name)', bots.every(({ p, i }) => p.username.replace(/ \d+$/, '') === heroShortName(middle(i))), bots.map(({ p, i }) => [p.username, middle(i)]));
  check('Spielzustand trägt denselben Namen', bots.every(({ p, i }) => gs.players[i].username === p.username));
  check('kein Titel im Namen (kein Komma, kein „ the “)', bots.every(({ p }) => !/,| the /i.test(p.username)), bots.map(x => x.p.username));
  const names = room.players.map(p => p.username);
  check('Namen eindeutig', new Set(names).size === names.length, names);

  console.log(fails ? `\n✗ ${fails} Fehler` : '\n✓ CPU-Namen-Tests grün');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
