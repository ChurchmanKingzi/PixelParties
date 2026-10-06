'use strict';
// Bots nutzen Tränke, Hand-Abilities und Reaktionen (headless):
//  • Aufbau: Tränke, Hand-Abilities und Reaktionskarten werden nicht mehr als „unbrauchbar" recycelt.
//  • Kampf: in einer Reihe von Partien werden Tränke getrunken, Abilities von der Hand gelegt und Reaktionen ausgelöst,
//    ohne Fehlermeldung; die Reaktionsentscheidungen landen im Lernprotokoll (react-fire / react-hold).
//  • Reaktionen sind unabhängig davon möglich, ob der Held in dieser Round noch einen Zug hat (erschöpft).
//  • Reaktionsfenster fragen alle Sitze (nicht nur „den Gegner").
process.env.PP_ST_SIM = '1';
const { runGame } = require('../../skilltest/sim');
const { GameEngine } = require('../../cards/effects/_engine');
const { getCardDB } = require('../../cards/effects/_card-db');
const { usableInBattle } = require('../../skilltest/autoprep');
let fails = 0;
const check = (name, cond, info) => { if (cond) console.log('  ✓', name); else { fails++; console.log('  ✗', name, info !== undefined ? '→ ' + JSON.stringify(info).slice(0, 300) : ''); } };

(async () => {
  const db = getCardDB();
  console.log('Aufbau: was behält der Bot?');
  const pick = (pred) => Object.values(db).find(c => c.skilltestLegal === true && pred(c));
  check('Tränke gelten als einsetzbar', usableInBattle(pick(c => c.cardType === 'Potion' && c.subtype === 'Normal')));
  check('Hand-Abilities gelten als einsetzbar', usableInBattle(pick(c => c.cardType === 'Ability')));
  check('Reaktionskarten gelten als einsetzbar', ['Spell', 'Attack', 'Artifact'].every(t => usableInBattle(pick(c => c.cardType === t && c.subtype === 'Reaction'))));

  console.log('Kampf: Tränke, Abilities, Reaktionen');
  const cnt = {}, errors = [];
  const origLog = GameEngine.prototype.log;
  GameEngine.prototype.log = function (n, d) {
    if (n === 'reaction_activated') cnt.reaction = (cnt.reaction || 0) + 1;
    if (n === 'ability_attached') cnt.ability = (cnt.ability || 0) + 1;
    if (n === 'card_played' && d && d.cardType === 'Potion') cnt.potion = (cnt.potion || 0) + 1;
    return origLog.apply(this, arguments);
  };
  const origErr = console.error;
  console.error = (...a) => { errors.push(a.join(' ').slice(0, 200)); };
  let learn = { fire: 0, hold: 0 }, finished = 0;
  const games = +process.env.ST_GAMES || 24;
  for (let g = 0; g < games; g++) {
    const r = await runGame({ seats: 2 + (g % 5), record: true });
    if (r.winnerIdx != null) finished++;
    for (const l of r.learnLog || []) { if (l.key.startsWith('react-fire:')) learn.fire++; if (l.key.startsWith('react-hold:')) learn.hold++; }
  }
  console.error = origErr;
  GameEngine.prototype.log = origLog;
  check(`Alle ${games} Partien enden mit einem Sieger`, finished === games, { finished });
  check('Bots trinken Tränke', (cnt.potion || 0) >= 1, cnt);
  check('Bots legen Abilities von der Hand an Helden', (cnt.ability || 0) >= 1, cnt);
  check('Bots lösen Reaktionen aus', (cnt.reaction || 0) >= 1, cnt);
  check('Reaktionsentscheidungen kommen ins Lernprotokoll', learn.fire + learn.hold >= 1, learn);
  console.log(`  (${JSON.stringify(cnt)}, Lernprotokoll ${JSON.stringify(learn)})`);
  check('Keine Fehlermeldungen im Lauf', errors.length === 0, errors.slice(0, 4));

  console.log('Reaktionen unabhängig vom Zug des Helden');
  const room = (await runGame({ seats: 3, returnRoom: true, maxTurns: 1, noFast: true })).room;
  const engine = room.engine, gs = room.gameState, st = gs.skillTest;
  const reactSpells = Object.values(db).filter(c => c.subtype === 'Reaction' && (c.cardType === 'Spell' || c.cardType === 'Attack')).map(c => c.name);
  const can = (pi) => gs.players[pi].heroes.map((h, hi) => reactSpells.filter(n => { try { return engine._canHeroActivateSurprise(pi, hi, n, { spellInHand: true }); } catch { return false; } }).join('|'));
  const before = [0, 1, 2].map(can);
  for (let pi = 0; pi < 3; pi++) gs.players[pi].heroes.forEach((h, hi) => { st.exhaustedHeroes[pi + ':' + hi] = true; });
  for (let pi = 0; pi < 3; pi++) gs.players[pi].heroesActedThisTurn = [0, 1, 2];
  const after = [0, 1, 2].map(can);
  check('Erschöpfte Helden können dieselben Reaktionen wirken wie bereite', JSON.stringify(before) === JSON.stringify(after), { before, after });
  check('…und es gibt überhaupt Reaktionen, die ein Held wirken kann', before.some(r => r.some(x => x.length)), before);

  console.log('Reaktionsfenster fragen alle Sitze');
  st.eliminated = [];
  check('Reihenfolge bei 3 Sitzen: erst die anderen, zuletzt der Aktive', JSON.stringify(engine._reactionCheckOrder(0)) === '[1,2,0]' && JSON.stringify(engine._reactionCheckOrder(2)) === '[0,1,2]', engine._reactionCheckOrder(0));
  st.eliminated = [1];
  check('Ausgeschiedene Sitze werden übersprungen', JSON.stringify(engine._reactionCheckOrder(0)) === '[2,0]', engine._reactionCheckOrder(0));
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
