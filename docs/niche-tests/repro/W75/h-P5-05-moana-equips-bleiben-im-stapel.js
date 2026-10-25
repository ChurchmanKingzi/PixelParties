'use strict';
// W75 · Audit P5 · Darion × Tempeste Moana, the Rain Singer — ein Equip, das durch Moana zusaetzlich als Kreatur zaehlt („Artifact/Creature", 50 HP), bleibt Teil des Equip-Stapels.
// Kartentext: „The first 2 Artifacts equipped and Spells attached to any Hero each turn also count as Creatures with 50 HP. …" / Darion: „All Artifacts equipped to this Hero share 1 Support Zone."
// Befund (vorher): `equipsAt` (Stapel-Aufzaehlung) liess ein Equipment mit cardType „Artifact/Creature" aus → nach dem ersten Moana-Equip kannte Darion keinen Stapel mehr, das naechste Equip verlangte einen EIGENEN Platz (oder wurde abgelehnt: „Platz belegt").
// Erwartet: Moana (Seite 0) steht auf dem Brett; Darion (Seite 1) spielt Glass Sword, Gravedigger's Shovel, Club of Gobbo hintereinander: alle drei im SELBEN Platz, die ersten beiden sind Moana-Kreaturen (50 HP), die dritte nicht; Instanzen passen zu den Namen.
// Aufruf: node docs/niche-tests/repro/W75/h-P5-05-moana-equips-bleiben-im-stapel.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const ES = require('../../../../cards/effects/_equip-stack-shared.js');
const D = 'Darion, the Blood-Crazy Groundskeeper', F = H.INERT.filler, MOANA = 'Tempeste Moana, the Rain Singer';
const EQ = ['Glass Sword', "Gravedigger's Shovel", 'Club of Gobbo'];
(async () => {
  const R = H.runner();
  const t = await H.fresh({ active: 1, heroes: [[MOANA, null, null], [D, null, null]], hand: [[F], [...EQ]], gold: 500, deck: [Array(15).fill(F), Array(15).fill(F)] });
  const erg = [];
  for (const n of EQ) erg.push(await t.play(1, n, { hero: 0, slot: 1 }));
  const zonen = t.gs.players[1].supportZones[0];
  const insts = t.inst(c => c.zone === 'support' && c.owner === 1 && c.heroIdx === 0);
  R.note('lauf', JSON.stringify({ erg, zonen, kreaturen: insts.map(c => c.name + ':' + (c.counters._moanaCreature ? 'K' : '-')) }));
  R.check('alle drei Equips wurden gespielt', erg.every(x => x === true), erg);
  R.check('alle drei liegen im SELBEN Platz (Stapel), die anderen Plaetze leer', zonen.filter(z => z.length).length === 1 && zonen.flat().length === 3, zonen);
  const platz = zonen.findIndex(z => z.length);
  R.check('Stapelreihenfolge = Spielreihenfolge', JSON.stringify(zonen[platz]) === JSON.stringify(EQ), zonen);
  R.check('die ersten beiden sind Moana-Kreaturen, die dritte nicht', insts.filter(c => c.counters._moanaCreature).map(c => c.name).sort().join() === [EQ[0], EQ[1]].sort().join(), insts.map(c => c.name + ':' + !!c.counters._moanaCreature));
  R.check('die Stapel-Aufzaehlung (equipsAt) kennt alle drei Karten, auch die „Artifact/Creature"-Equips', ES.equipsAt(t.engine, 1, 0, platz).length === 3, ES.equipsAt(t.engine, 1, 0, platz).map(i => i.name));
  R.check('Sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  R.finish();
})();
