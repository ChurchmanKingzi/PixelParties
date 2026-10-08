'use strict';
// Klick auf eine eigene Kreatur OHNE aktiven Effekt (rounds.skipWithCreature): sie gilt als benutzt (ergraut) und der Zug geht weiter.
//   node scripts/skilltest-e2e/creature-skip.test.js
process.env.PP_ST_SIM = '1';
const { runGame } = require('../../skilltest/sim');
const rounds = require('../../skilltest/rounds');
let fails = 0;
const check = (name, cond, info) => { if (cond) console.log('  ✓', name); else { fails++; console.log('  ✗', name, info !== undefined ? '→ ' + JSON.stringify(info).slice(0, 300) : ''); } };

(async () => {
  const oL = console.log, oE = console.error;
  console.log = () => {}; console.error = () => {};
  const out = await runGame({ seats: 3, setupOnly: true, noProfileSeats: [0, 1, 2], seed: 21 });
  console.log = oL; console.error = oE;
  const { room, host, gs, engine } = out;
  const st = gs.skillTest;
  const seat = gs.activePlayer;
  const place = (name, hi, slot) => {
    for (const i of engine.cardInstances.filter(c => c.zone === 'support' && c.owner === seat && c.heroIdx === hi && c.zoneSlot === slot)) engine._untrackCard(i.id);
    gs.players[seat].supportZones[hi][slot] = [name];
    return engine._trackCard(name, seat, 'support', hi, slot);
  };
  const plain = place('Cute Bunny', 0, 0);          // Kreatur ohne aktiven Effekt
  const active = place('Skeleton Reaper', 0, 1);    // Kreatur mit aktivem Effekt
  const turnsBefore = st.turnsTaken[seat] || 0;

  console.log('Kreatur mit aktivem Effekt');
  check('wird nicht ausgesetzt (dafür gibt es den Effekt)', (await rounds.skipWithCreature(room, seat, { heroIdx: 0, zoneSlot: 1 }, host)) === false && gs.activePlayer === seat);

  console.log('Kreatur ohne aktiven Effekt');
  const ok = await rounds.skipWithCreature(room, seat, { heroIdx: 0, zoneSlot: 0 }, host);
  check('Klick wird angenommen', ok === true);
  check('Kreatur ist benutzt (ergraut bis zur nächsten Round)', st.exhaustedCreatures[plain.id] === true);
  check('der Zug zählt und geht weiter', (st.turnsTaken[seat] || 0) === turnsBefore + 1 && gs.activePlayer !== seat, { active: gs.activePlayer, seat });
  check('der Sitz ist nicht aus der Round (Helden können später noch handeln)', !st.passed[seat]);
  gs.activePlayer = seat; st.busy = false;
  check('ein zweiter Klick auf dieselbe Kreatur wird abgelehnt', (await rounds.skipWithCreature(room, seat, { heroIdx: 0, zoneSlot: 0 }, host)) === false);

  console.log('Falsche Aufrufe');
  gs.activePlayer = (seat + 1) % 3;
  check('nicht am Zug: abgelehnt', (await rounds.skipWithCreature(room, seat, { heroIdx: 0, zoneSlot: 0 }, host)) === false);
  gs.activePlayer = seat;
  check('leerer Platz: abgelehnt', (await rounds.skipWithCreature(room, seat, { heroIdx: 2, zoneSlot: 2 }, host)) === false);

  console.log(fails ? `\n✗ ${fails} Fehler` : '\n✓ Kreatur-Aussetzen-Tests grün');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
