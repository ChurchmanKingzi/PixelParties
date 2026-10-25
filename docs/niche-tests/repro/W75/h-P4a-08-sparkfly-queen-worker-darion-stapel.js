'use strict';
// W75 · Audit P4a · Sparkfly Queen (Worker Gift) × Darion (geteilte Equip-Zone)
// Kartentext (Worker-Geschenk der Queen): „… once per turn, the opponent picks any non-Hero card on their side of the board and adds it to your hand." (Sparkfly Worker: Queen erbt den Effekt)
// Darion: „All Artifacts equipped to this Hero share 1 Support Zone."
// Erwartet: Der Gegner (Darion-Stapel Club / Blade / Crown) waehlt die MITTLERE Karte: genau Blade wandert auf die Hand der Queen-Spielerin (originalOwner bleibt der Gegner),
//   Club und Crown bleiben im Stapel; Namen und Instanzen sind konsistent.
// Aufruf: node docs/niche-tests/repro/W75/h-P4a-08-sparkfly-queen-worker-darion-stapel.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const D = 'Darion, the Blood-Crazy Groundskeeper', F = H.INERT.filler, Q = 'Sparkfly Queen';
const NAMEN = ['Club of Gobbo', 'Blade of the Frostbringer', 'Cute Crown'];
(async () => {
  const R = H.runner();
  const t = await H.fresh({ active: 0, heroes: [['Tushu, the Knowledge Keeper', null, null], [D, null, null]], hand: [[F], [F]], gold: 500, deck: [Array(15).fill(F), Array(15).fill(F)] });
  const q = t.put(0, 0, 0, Q); q.turnPlayed = 1;
  q.counters._sparkflyGifts = { worker: true };
  q.counters._sparkflyQueenModeUsed = { main: t.gs.turn };   // MAIN verbraucht: es bleibt nur das Worker-Geschenk
  const ps = t.gs.players[1]; ps.supportZones[0][1] = [];
  const insts = NAMEN.map(n => { ps.supportZones[0][1].push(n); const i = t.engine._trackCard(n, 1, 'support', 0, 1); i.turnPlayed = 1; return i; });
  let gefragt = 0;
  t.script.push({ match: d => d.type === 'instancePick', answer: () => { gefragt++; return { instId: insts[1].id }; } });
  t.targetFn = (valid) => [valid.find(v => v.type === 'equip' && v.owner === 1 && v.slotIdx === 1).id];
  t.phase(2);
  const res = await t.activateCreature(0, 0, 0);
  await t.drain();
  const z = t.gs.players[1].supportZones[0][1];
  R.note('lauf', JSON.stringify({ res, gefragt, zone: z, hand0: t.pile(0, 'hand'), ziele: t.targets.map(x => x.valid.map(v => v.id)) }));
  const ids = (t.targets[0] || { valid: [] }).valid.map(v => v.id);
  R.check('Der Stapel ist in der Zielwahl EIN Ziel (keine doppelte ID)', ids.length === new Set(ids).size && ids.includes('equip-1-0-1'), ids);
  R.check('Rueckfrage "welche Karte?" kam', gefragt > 0, gefragt);
  R.check('Nur Blade wurde abgegeben, Club und Crown bleiben', JSON.stringify(z) === JSON.stringify([NAMEN[0], NAMEN[2]]), z);
  R.check('Blade liegt auf der Hand der Queen-Spielerin', t.pile(0, 'hand').includes(NAMEN[1]), t.pile(0, 'hand'));
  R.check('Sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
