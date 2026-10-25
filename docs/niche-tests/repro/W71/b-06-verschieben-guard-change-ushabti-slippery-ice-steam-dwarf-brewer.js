'use strict';
// W71b-06 · Cool Rescuer Monia: VERSCHIEBEN / TAUSCHEN / WEGLEGEN (Zonenwechsel auf dem Brett) öffnet das Fenster
//
// Guard Change („place them into free Support Zones of other Heroes" / swap), Slippery Ice/Skates („move a Creature into the free Support Zone of an adjacent Hero"), Ushabti („place it face-down into
// the Surprise Zone") und Steam Dwarf Brewer („set the current and max HP of another Creature") schrieben Zone und Werte der Kreatur direkt. Jetzt fragt jeder dieser Schreiber vorher
// `engine.kreaturBetroffen(inst, 'move' | 'stats', Quelle)`; das EIGENE Gleiten einer Slippery-Kreatur am Zugbeginn ist ihr eigener Text und fragt nicht.
// Aufruf: node docs/niche-tests/repro/W71/b-06-….js   (Exit 0 = korrekt; auf dem Stand vor W71b rot)
const S = require('../../lib/monia-sweep.js');
const { H } = S;
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(2); });

const DEFS = [
  { name: 'Guard Change', hand: ['Guard Change'], ziel: 'eigen', spiel: (t, W, h) => t.play(W, 'Guard Change', { hero: h }) },
  { name: 'Ushabti of the Great Pharaoh', hand: ['Ushabti of the Great Pharaoh'], ziel: 'gegner', spiel: (t, W, h) => t.play(W, 'Ushabti of the Great Pharaoh', { hero: h }) },
  { name: 'Slippery Ice', ziel: 'eigen', karten: 0, spiel: async (t, W) => { t.putArea(W, 'Slippery Ice'); t.gs.activePlayer = W; t.phase(2); await t.run(() => t.engine.activateAreaEffect(W, W, 'Slippery Ice')); } },
  { name: 'Steam Dwarf Brewer', ziel: 'eigen', karten: 0, ignoriere: /^Steam Dwarf Brewer@/, vorbereitung: async (t, W, V) => { const inst = t.put(W, W === 0 ? 0 : 2, 2, 'Steam Dwarf Brewer'); inst.turnPlayed = 1; t._brewer = inst; },
    spiel: async (t, W) => { const b = t._brewer; t.gs.activePlayer = W; t.phase(2); await t.activateCreature(W, b.heroIdx, b.zoneSlot); } },
];

(async () => {
  const R = H.runner();
  await S.tabelle(R, DEFS);
  R.finish();
})().catch(e => { process.stderr.write(String(e && e.stack || e) + '\n'); process.exit(2); });
