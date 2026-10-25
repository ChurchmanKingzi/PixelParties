'use strict';
// W75 · Darion, the Blood-Crazy Groundskeeper — Nischen: volles Brett (der Stapel zaehlt als Platz), ATK-Boni addieren sich und gehen einzeln, negierter Darion teilt nicht, gegnerisches Control Device.
// Kartentext: „All Artifacts equipped to this Hero share 1 Support Zone. Whenever this Hero defeats 1 or more targets, you may choose an equippable Artifact from your hand or deck and equip it to this Hero by paying half its Cost."
// Erwartet: laut Kartentext und Kopfkommentar der Skripte. Aufruf: node docs/niche-tests/repro/W75/a-05-darion-nischen-voll-atk-negiert-controldevice.js   (Exit 0 = korrekt)
const U = require('../../lib/umhaengen.js');
const { H } = U;
const D = 'Darion, the Blood-Crazy Groundskeeper', BIG = H.INERT.big;
const eq = (t, s, hi) => JSON.stringify(t.gs.players[s].supportZones[hi]);
(async () => {
  const R = H.runner();
  let t;
  R.section('1) Keine freie Zone mehr: Equip geht trotzdem in den Stapel');
  t = await U.fresh(0, { hand: ['Club of Gobbo', 'Glass Sword', 'Blade of the Frostbringer'], heroes: { 0: [D, 'Tushu, the Knowledge Keeper', 'Zwei, the Lucky Thief'] } });
  await U.lege(t, 0, 'Club of Gobbo', 0);
  const S = t.gs.players[0].supportZones[0].findIndex(z => z.length);
  for (let z = 0; z < 3; z++) if (z !== S) { t.put(0, 0, z, BIG).turnPlayed = 1; }
  R.note('voll', eq(t, 0, 0));
  const r1 = await U.lege(t, 0, 'Glass Sword', 0);
  R.check('Equip bei vollem Brett gespielt (true)', r1 === true && t.gs.players[0].supportZones[0][S].includes('Glass Sword'), [r1, eq(t, 0, 0)]);
  // Gegenprobe: ein anderer Held (ohne Stapel) mit vollem Brett: nicht spielbar
  for (let z = 0; z < 3; z++) t.put(0, 1, z, BIG).turnPlayed = 1;
  for (let z = 0; z < 3; z++) t.put(0, 2, z, BIG).turnPlayed = 1;
  const r2 = await U.lege(t, 0, 'Blade of the Frostbringer', 1);
  R.check('Gegenprobe: Held 1 ohne freie Zone: Equip abgelehnt', r2 !== true || !t.gs.players[0].supportZones[1].some(z => z.includes('Blade of the Frostbringer')), [r2, eq(t, 0, 1)]);
  R.check('Sauber', U.sauber(t), [t.errors, t.audit()]);

  R.section('2) ATK-Boni mehrerer Equips im Stapel: addieren sich, gehen einzeln wieder');
  t = await U.fresh(0, { hand: ['Blade of the Frostbringer', 'Blade of the Swamp Witch', 'Club of Gobbo'], heroes: { 0: [D, 'Tushu, the Knowledge Keeper', 'Zwei, the Lucky Thief'] } });
  const a0 = t.gs.players[0].heroes[0].atk;
  await U.lege(t, 0, 'Blade of the Frostbringer', 0);
  const a1 = t.gs.players[0].heroes[0].atk;
  await U.lege(t, 0, 'Blade of the Swamp Witch', 0);
  const a2 = t.gs.players[0].heroes[0].atk;
  await U.lege(t, 0, 'Club of Gobbo', 0);
  const a2b = t.gs.players[0].heroes[0].atk;   // alle drei Equips
  R.note('atk', JSON.stringify([a0, a1, a2, a2b]));
  R.check('Boni addieren sich', a1 > a0 && a2 > a1, [a0, a1, a2]);
  const bl = t.inst(c => c.name === 'Blade of the Frostbringer' && c.zone === 'support')[0];
  await t.run(() => t.engine.actionDestroyCard({ name: 'Test', owner: 1 }, bl));
  const a3 = t.gs.players[0].heroes[0].atk;
  R.check('Zerstoeren eines Equips nimmt NUR dessen Bonus', a3 === a2b - (a1 - a0), [a0, a1, a2, a2b, a3]);
  R.check('Stapel hat noch 2 Equips', t.gs.players[0].supportZones[0].find(z => z.length)?.length === 2, eq(t, 0, 0));
  R.check('Sauber', U.sauber(t), [t.errors, t.audit()]);

  R.section('3) Darion stumm (negiert): neues Equip nimmt eine andere Zone; danach gilt wieder der Stapel');
  t = await U.fresh(0, { hand: ['Club of Gobbo', 'Glass Sword', 'Blade of the Frostbringer', 'Blade of the Swamp Witch'], heroes: { 0: [D, 'Tushu, the Knowledge Keeper', 'Zwei, the Lucky Thief'] } });
  await U.lege(t, 0, 'Club of Gobbo', 0);
  t.gs.players[0].heroes[0].statuses.negated = true;
  await U.lege(t, 0, 'Glass Sword', 0);
  R.note('negiert', eq(t, 0, 0));
  R.check('negiert: Glass Sword in EIGENER Zone', t.gs.players[0].supportZones[0].filter(z => z.length).length === 2, eq(t, 0, 0));
  delete t.gs.players[0].heroes[0].statuses.negated;
  await U.lege(t, 0, 'Blade of the Frostbringer', 0);
  R.note('wieder aktiv', eq(t, 0, 0));
  R.check('wieder aktiv: Equip landet in einem bestehenden Equip-Platz (kein dritter Platz)', t.gs.players[0].supportZones[0].filter(z => z.length).length === 2, eq(t, 0, 0));
  R.check('Sauber', U.sauber(t), [t.errors, t.audit()]);

  R.section('4) Gegner legt Future Tech Control Device auf Darion');
  t = await U.fresh(0, { hand: ['Club of Gobbo'], heroes: { 0: [D, 'Tushu, the Knowledge Keeper', 'Zwei, the Lucky Thief'] } });
  await U.lege(t, 0, 'Club of Gobbo', 0);
  t.setHand(1, ['Future Tech Control Device']);
  t.gs.activePlayer = 1;
  const rc = await t.play(1, 'Future Tech Control Device', { hero: 0, active: 1 });
  R.note('control', JSON.stringify(rc) + eq(t, 0, 0) + eq(t, 1, 0));
  R.check('keine Engine-Fehler / Zustand sauber', U.sauber(t), [t.errors, t.audit()]);
  R.finish();
})();
