'use strict';
// Informierte Zielwahl (policy.chooseTargets mit tgtModel: 1): liest HP/ATK/Zustand aus dem Spielstand — die Zielobjekte der Prompts tragen keine HP.
//   node scripts/skilltest-e2e/target-informed.test.js
process.env.PP_ST_SIM = '1';
const { runGame } = require('../../skilltest/sim');
const policy = require('../../skilltest/policy');
let fails = 0;
const check = (name, cond, info) => { if (cond) console.log('  ✓', name); else { fails++; console.log('  ✗', name, info !== undefined ? '→ ' + JSON.stringify(info).slice(0, 300) : ''); } };

(async () => {
  const oL = console.log, oE = console.error;
  console.log = () => {}; console.error = () => {};
  const out = await runGame({ seats: 3, setupOnly: true, noProfileSeats: [0, 1, 2], seed: 33 });
  console.log = oL; console.error = oE;
  const { engine, gs } = out;
  const st = gs.skillTest;
  const seat = 0;
  // Gegner 1: drei Helden mit sehr unterschiedlichen HP; Gegner 2: ein einzelner Held (letzter)
  const setHero = (s, hi, name, hp, atk) => { gs.players[s].heroes[hi] = { name, hp, maxHp: 400, atk, baseAtk: atk, statuses: {} }; };
  setHero(1, 0, 'Held A', 400, 80); setHero(1, 1, 'Held B', 30, 20); setHero(1, 2, 'Held C', 250, 160);
  setHero(2, 0, 'Held D', 60, 40); gs.players[2].heroes[1] = { name: null, hp: 0, maxHp: 0, atk: 0, statuses: {} }; gs.players[2].heroes[2] = { name: null, hp: 0, maxHp: 0, atk: 0, statuses: {} };
  const targets = [];
  for (const s of [1, 2]) gs.players[s].heroes.forEach((h, hi) => { if (h && h.name) targets.push({ id: `hero-${s}-${hi}`, type: 'hero', owner: s, heroIdx: hi, cardName: h.name }); });
  const cfg = { title: 'Attack', cancellable: false, maxTotal: 1 };
  const pick = (weights) => { st.botWeights = { [seat]: weights }; st.acting = { seat, hi: 0 }; gs.players[seat].heroes[0].atk = 100; return policy.chooseTargets(engine, seat, targets, cfg, null)[0]; };

  console.log('HP-bewusste Wahl');
  const picks0 = new Set(); for (let i = 0; i < 12; i++) picks0.add(pick({ tgtModel: 0 }));
  check('ohne Modell (bisher): die Wahl kennt keine HP (streut über mehrere Ziele)', picks0.size >= 2, [...picks0]);
  const lowest = new Set(); for (let i = 0; i < 12; i++) lowest.add(pick({ tgtModel: 1 }));
  check('mit Modell: der Held mit den wenigsten HP in Reichweite des Angriffs (ATK 100 → Held B, 30 HP, oder Held D, 60 HP)', [...lowest].every(id => id === 'hero-1-1' || id === 'hero-2-0'), [...lowest]);

  console.log('Eliminieren');
  const elim = new Set(); for (let i = 0; i < 12; i++) elim.add(pick({ tgtModel: 1, tElim: 10 }));
  check('tElim: der LETZTE Held eines Spielers (Held D) wird bevorzugt', [...elim].join() === 'hero-2-0', [...elim]);

  console.log('Überschaden');
  const over = new Set(); for (let i = 0; i < 12; i++) over.add(pick({ tgtModel: 1, tOverkill: 4, killBonus: 0, lowestHp: 0 }));
  check('tOverkill allein: Ziele, die der Treffer nicht „überschlägt" (Held A 400 HP, Held C 250 HP), schlagen Held B (30 HP) und Held D (60 HP)', [...over].every(id => id === 'hero-1-0' || id === 'hero-1-2'), [...over]);

  console.log('Tempo, Bedrohung, Fokus halten');
  st.exhaustedHeroes = { '1:0': true, '1:1': true, '1:2': true };           // alle Helden von Spieler 1 haben schon gehandelt, Held D nicht
  const tempo = new Set(); for (let i = 0; i < 12; i++) tempo.add(pick({ tgtModel: 1, tTempo: 8, lowestHp: 0, killBonus: 0 }));
  check('tTempo: der Held, der noch nicht gehandelt hat (Held D), wird bevorzugt', [...tempo].join() === 'hero-2-0', [...tempo]);
  st.exhaustedHeroes = {};
  const threat = new Set(); for (let i = 0; i < 12; i++) threat.add(pick({ tgtModel: 1, tThreat: 6, lowestHp: 0, killBonus: 0 }));
  check('tThreat: der Held mit dem höchsten ATK (Held C, 160) wird bevorzugt', [...threat].join() === 'hero-1-2', [...threat]);
  st.lastTarget = { [seat]: 2 };
  const stick = new Set(); for (let i = 0; i < 12; i++) stick.add(pick({ tgtModel: 1, tStick: 12, lowestHp: 0, killBonus: 0 }));
  check('tStick: der zuletzt gewählte Spieler (2) bleibt im Fokus', [...stick].join() === 'hero-2-0', [...stick]);
  st.lastTarget = {};
  pick({ tgtModel: 1 });
  check('die Wahl wird als „zuletzt gewählt" gemerkt', st.lastTarget[seat] === 1 || st.lastTarget[seat] === 2, st.lastTarget);

  console.log('Heil-/Buff-Karten bleiben unberührt');
  const own = [{ id: 'hero-0-0', type: 'hero', owner: 0, heroIdx: 0, cardName: 'X' }, { id: 'hero-1-0', type: 'hero', owner: 1, heroIdx: 0, cardName: 'Held A' }];
  st.botWeights = { [seat]: { tgtModel: 1 } };
  check('Heilung geht an einen eigenen Helden', policy.chooseTargets(engine, seat, own, { title: 'Healing Potion', cancellable: false, maxTotal: 1 }, null)[0] === 'hero-0-0');

  console.log(fails ? `\n✗ ${fails} Fehler` : '\n✓ Zielwahl-Tests grün');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
