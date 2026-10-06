'use strict';
// Kartenregeln des Skill Test (headless): Kartenpool (Future Tech gesperrt, je Partie ein Cardinal Beast weniger),
// Quetzahuitl (nie Brett-Hero, nur in Händen mit ≥ 4 Heroes, fällt er → Kontrolleur scheidet aus) und
// The Golden Abomination (Gegnerwahl zu Spielbeginn, nur dessen Start-Gold wird umgelenkt).
process.env.PP_ST_SIM = '1';
const Rules = require('../../public/skilltest-rules.js');
const { CardPool, dealHand } = require('../../skilltest/pool');
const { CONFIG } = require('../../skilltest/config');
const { getCardDB } = require('../../cards/effects/_card-db');
const { GameEngine } = require('../../cards/effects/_engine');
const { runGame } = require('../../skilltest/sim');
let fails = 0;
const check = (name, cond, info) => { if (cond) console.log('  ✓', name); else { fails++; console.log('  ✗', name, info !== undefined ? '→ ' + JSON.stringify(info).slice(0, 300) : ''); } };

const QUETZA = 'Quetzahuitl, Receiver of Sacrifices';
const ABOM = 'The Golden Abomination';

(async () => {
  const cards = getCardDB();
  const env = { cards, areaLimitOf: () => undefined };

  console.log('Kartenpool');
  const ft = Object.values(cards).filter(c => c.archetype === 'Future Tech');
  check('Alle Future-Tech-Karten sind gesperrt', ft.length >= 29 && ft.every(c => c.skilltestLegal === false), { n: ft.length });
  check('Quetzahuitl, Golden Abomination und die vier Cardinal Beasts sind freigegeben',
    [QUETZA, ABOM, ...CONFIG.CARDINAL_BEASTS].every(n => cards[n] && cards[n].skilltestLegal === true));
  const banCount = {}; let wrongLeft = 0, qHands = 0, qBad = 0, ftInPool = 0;
  const ftNames = new Set(ft.map(c => c.name));
  for (let g = 0; g < 300; g++) {
    const pool = new CardPool(cards);
    for (const b of pool.banned) banCount[b] = (banCount[b] || 0) + 1;
    const left = CONFIG.CARDINAL_BEASTS.filter(n => pool.buckets.creature.includes(n)).length;
    if (left !== 3 || pool.banned.length !== 1) wrongLeft++;
    for (const arr of Object.values(pool.buckets)) for (const n of arr) if (ftNames.has(n)) ftInPool++;
    for (let p = 0; p < 8; p++) {
      const { hand } = dealHand(pool);
      if (hand.includes(QUETZA)) { qHands++; if (hand.filter(n => cards[n] && cards[n].cardType === 'Hero').length < 4) qBad++; }
      if (CONFIG.CARDINAL_BEASTS.filter(n => hand.includes(n)).length && pool.banned.some(n => hand.includes(n))) wrongLeft++;
    }
  }
  check('Je Partie fehlt genau ein Cardinal Beast (drei von vieren im Pool)', wrongLeft === 0, { wrongLeft });
  check('Jedes Cardinal Beast wird mal gesperrt (Rotation)', CONFIG.CARDINAL_BEASTS.every(n => banCount[n] > 20), banCount);
  check('Kein Future-Tech-Karte im Pool', ftInPool === 0, { ftInPool });
  check('Quetzahuitl kommt vor, aber nur in Händen mit mindestens 4 Heroes', qHands > 10 && qBad === 0, { qHands, qBad });

  console.log('Quetzahuitl in der Vorbereitung');
  const ps0 = Rules.emptyPlayer();
  ps0.hand = [QUETZA, 'Alice'];
  check('Zone „Hero“ nimmt Quetzahuitl nicht auf', !Rules.zoneAccepts(env, ps0, QUETZA, { kind: 'hero', hi: 0 }));
  check('Auch canDrop sperrt ihn', !Rules.canDrop(env, ps0, QUETZA, { kind: 'hero', hi: 0 }));
  const r = Rules.applyMove(env, ps0, { type: 'place', from: { kind: 'hand', idx: 0 }, to: { kind: 'hero', hi: 0 } });
  check('applyMove lehnt das Platzieren ab', !r.ok, r);
  const heroes = Object.values(cards).filter(c => c.cardType === 'Hero' && c.skilltestLegal === true && c.name !== QUETZA).slice(0, 3).map(c => c.name);
  const ps1 = Rules.emptyPlayer(); ps1.hand = [QUETZA, ...heroes];
  check('Er zählt nicht zu den Heroes, die das Brett füllen (3 + Quetzahuitl = ok, 2 + Quetzahuitl = zu wenig)',
    Rules.totalHeroes(env, ps1) === 3 && Rules.totalHeroes(env, { ...ps1, hand: [QUETZA, heroes[0], heroes[1]] }) === 2);
  const { autoFillHeroes } = require('../../skilltest/autoprep');
  const filled = autoFillHeroes(env, ps1, null);
  check('Auto-Aufbau stellt nur andere Heroes auf (Quetzahuitl bleibt auf der Hand)', Rules.boardFull(filled) && !filled.heroes.includes(QUETZA) && filled.hand.includes(QUETZA), filled.heroes);

  console.log('Golden Abomination (Gegnerwahl zu Spielbeginn)');
  const events = [];
  const origLog = GameEngine.prototype.log;
  GameEngine.prototype.log = function (name, data) {
    if (/^(golden_abomination|quetzahuitl_|skilltest_eliminated)/.test(name)) events.push({ name, data, room: this.room && this.room.id });
    return origLog.apply(this, arguments);
  };
  const errors = [];
  const origErr = console.error;
  console.error = (...a) => { errors.push(a.join(' ').slice(0, 200)); };
  let r1 = null, goldTarget = null;
  const seatsN = 4;
  const abomPrep = (prep) => {
    // Seat 0 hat die Abomination; Seat 2 hat am meisten Gold (recycelt am meisten) → Bot-Wahl muss auf Seat 2 fallen.
    const p0 = prep.players[0];
    for (const hi of [0, 1, 2]) for (const s of [0, 1, 2]) if (!p0.supportZones[hi][s].length) { p0.supportZones[hi][s] = [ABOM]; return afterPlace(prep); }
    p0.supportZones[0][0] = [ABOM]; afterPlace(prep);
  };
  function afterPlace(prep) { prep.players[1].recycled = 1; prep.players[2].recycled = 9; prep.players[3].recycled = 2; prep.players[0].recycled = 0; }
  const goldStart = [];
  r1 = await runGame({ seats: seatsN, mutatePrep: abomPrep, returnRoom: true, maxTurns: 3 });
  const gs = r1.room.gameState;
  const targetEv = events.filter(e => e.name === 'golden_abomination_target' && e.room === r1.room.id);
  const stealEv = events.filter(e => e.name === 'golden_abomination' && e.room === r1.room.id);
  const inst = r1.room.engine.cardInstances.find(c => c.name === ABOM);
  goldTarget = inst && inst._stTarget;
  check('Die Abomination hat zu Spielbeginn einen Gegner gewählt', goldTarget != null && goldTarget !== 0, { goldTarget, targetEv: targetEv.length });
  check('Der Bot wählt den Gegner mit dem meisten Gold (Seat 2)', goldTarget === 2, { goldTarget });
  check('Genau dessen Start-Gold-Tick wurde umgeleitet', stealEv.length === 1 && stealEv[0].data.from === gs.players[2].username, stealEv.map(e => e.data));
  void goldStart;

  console.log('Quetzahuitl im Kampf');
  let arrivals = 0, defeats = 0, defeatThenEliminated = 0, finished = 0, noWinner = 0;
  for (let g = 0; g < 40; g++) {
    events.length = 0;
    const res = await runGame({ seats: 5, returnRoom: true, mutatePrep: (prep) => {
      // Es gibt Quetzahuitl nur einmal: andere Sitze verlieren ihn (sonst zählte ihr Fall zu „Seat 0“), Seat 0 bekommt ihn auf die Hand.
      for (const q of prep.players) q.hand = q.hand.filter(n => n !== QUETZA);
      prep.players[0].hand.push(QUETZA);
    } });
    finished++;
    if (res.winnerIdx == null) noWinner++;
    const mine = events.filter(e => e.room === res.room.id);
    if (mine.some(e => e.name === 'quetzahuitl_arrival')) arrivals++;
    if (mine.some(e => e.name === 'quetzahuitl_defeated')) {
      defeats++;
      if (res.eliminated.includes(0)) defeatThenEliminated++;
    }
  }
  console.error = origErr;
  GameEngine.prototype.log = origLog;
  check('Alle Quetzahuitl-Partien enden mit einem Sieger', finished === 40 && noWinner === 0, { finished, noWinner });
  check('Quetzahuitl steigt herab, wenn der letzte Hero außerhalb des eigenen Zuges fällt (mind. einmal in 40 Partien)', arrivals >= 1, { arrivals });
  check('Fällt Quetzahuitl, scheidet sein Kontrolleur aus', defeats === defeatThenEliminated, { defeats, defeatThenEliminated });
  console.log(`  (${arrivals} Abstiege, ${defeats} Niederlagen von Quetzahuitl)`);
  check('Keine Fehlermeldungen im Lauf', errors.length === 0, errors.slice(0, 3));
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
