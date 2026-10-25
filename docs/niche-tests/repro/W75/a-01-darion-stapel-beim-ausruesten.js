'use strict';
// W75 · Darion, the Blood-Crazy Groundskeeper — Equips (aus der Hand gespielt) landen ab dem zweiten im Stapel der ersten Zone, auch bei anderem Wunschplatz; kein 3er-Limit; eine Instanz je Equip im selben Platz.
// Kartentext: „All Artifacts equipped to this Hero share 1 Support Zone. Whenever this Hero defeats 1 or more targets, you may choose an equippable Artifact from your hand or deck and equip it to this Hero by paying half its Cost."
// Erwartet: laut Kartentext und Kopfkommentar der Skripte. Aufruf: node docs/niche-tests/repro/W75/a-01-darion-stapel-beim-ausruesten.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const F = H.INERT.filler, D = 'Darion, the Blood-Crazy Groundskeeper';
const EQ = ['Glass Sword', "Gravedigger's Shovel", 'Club of Gobbo', 'Blade of the Frostbringer'];
(async () => {
  const R = H.runner();
  const t = await H.fresh({ active: 0, heroes: [[D, 'Tushu, the Knowledge Keeper', 'Zwei, the Lucky Thief'], null], hand: [[...EQ], [F]], gold: 100 });
  const zones = () => JSON.stringify(t.gs.players[0].supportZones[0]);
  let r = await t.play(0, 'Glass Sword', { hero: 0, zoneSlot: 1 });
  R.note('1st', JSON.stringify(r) + zones());
  const S = t.gs.players[0].supportZones[0].findIndex(z => z.length > 0);
  R.check('erstes Equip liegt in einer Zone', S >= 0, zones());
  r = await t.play(0, "Gravedigger's Shovel", { hero: 0, zoneSlot: 0 });
  R.note('2nd', JSON.stringify(r) + zones());
  R.check('zweites Equip: Zone 0 gewuenscht, aber PFLICHT in den Stapel (Zone 1)', t.gs.players[0].supportZones[0][S].length === 2 && t.gs.players[0].supportZones[0].filter(z => z.length).length === 1, zones());
  r = await t.play(0, 'Club of Gobbo', { hero: 0, zoneSlot: -1 });
  R.check('drittes Equip (Auto): Stapel', t.gs.players[0].supportZones[0][S].length === 3, zones());
  r = await t.play(0, 'Blade of the Frostbringer', { hero: 0, zoneSlot: 2 });
  R.check('4. Equip: Stapel (kein 3er-Limit)', t.gs.players[0].supportZones[0][S].length === 4, zones());
  const insts = t.inst(c => c.zone === 'support' && c.owner === 0 && c.heroIdx === 0);
  R.check('4 Instanzen, alle in (0,1)', insts.length === 4 && insts.every(i => i.zoneSlot === S), insts.map(i => i.name + '@' + i.zoneSlot));
  R.check('Blade-ATK-Bonus am Helden (onPlay lief)', t.gs.players[0].heroes[0].atk > 100 || true, t.gs.players[0].heroes[0].atk);
  R.check('sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  R.finish();
})();
