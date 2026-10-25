'use strict';
// W75 · Darion — Audit P2: Secret Spell Book mit Equip-Stapeln. Kartentext: „Take permanent control of all cards on the board that are originally owned by you. You may place any
// Creatures, Spells and Artifacts affected by this effect into the Support Zones of any Heroes you control." Darion: „All Artifacts equipped to this Hero share 1 Support Zone."
// Erwartet: (1) Liegt EINE meiner Karten im Stapel eines gegnerischen Darion, nimmt das Buch nur diese Karte (Stapelnachbarn bleiben); (2) hat mein eigener Darion einen Stapel und
// keine freie Zone, wird als Platz fuer die zurueckgeholte Ausruestung der Stapel angeboten (und sie landet oben drauf).
// Aufruf: node docs/niche-tests/repro/W75/h-P2-03-secret-spell-book-stapel.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const D = 'Darion, the Blood-Crazy Groundskeeper', F = H.INERT.filler, TU = 'Tushu, the Knowledge Keeper';
function stapel(t, seite, hi, slot, namen) {
  const ps = t.gs.players[seite];
  ps.supportZones[hi][slot] = [];
  return namen.map(n => { ps.supportZones[hi][slot].push(n); const i = t.engine._trackCard(n, seite, 'support', hi, slot); i.turnPlayed = 1; return i; });
}
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;

(async () => {
  const R = H.runner();
  let t;

  R.section('1) Meine Karte (Club) liegt im Stapel des gegnerischen Darion');
  t = await H.fresh({ active: 0, heroes: [[TU, null, null], [D, TU, null]], hand: [['Secret Spell Book'], [F]], gold: 500, deck: [Array(15).fill(F), Array(15).fill(F)] });
  const ins = stapel(t, 1, 0, 1, ['Glass Sword', 'Club of Gobbo', 'Cute Crown']);
  ins[1].originalOwner = 0;
  let angebot = null;
  t.script.push({ match: d => d.type === 'zonePick', answer: (d) => { angebot = d.zones; return { owner: d.zones[0].owner, heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx }; } });
  await t.play(0, 'Secret Spell Book', { hero: 0 });
  R.check('Club liegt jetzt bei mir (Tushu), der Stapel des Gegners behaelt Glass Sword + Cute Crown',
    JSON.stringify(t.gs.players[0].supportZones[0].flat()) === JSON.stringify(['Club of Gobbo']) && JSON.stringify(t.gs.players[1].supportZones[0][1]) === JSON.stringify(['Glass Sword', 'Cute Crown']),
    [t.gs.players[0].supportZones[0], t.gs.players[1].supportZones[0]]);
  R.check('Club-Instanz gehoert mir (Kontrolle + Seite)', ins[1].owner === 0 && (ins[1].controller ?? ins[1].owner) === 0 && ins[1].heroIdx === 0, [ins[1].owner, ins[1].controller, ins[1].heroIdx]);
  R.check('Sauber', sauber(t), [t.errors, t.audit()]);

  R.section('2) Mein Darion hat einen Stapel und keine freie Zone: die Ausruestung kommt oben drauf');
  t = await H.fresh({ active: 0, heroes: [[D, null, null], [TU, null, null]], hand: [['Secret Spell Book'], [F]], gold: 500, deck: [Array(15).fill(F), Array(15).fill(F)] });
  stapel(t, 0, 0, 1, ['Glass Sword']);
  t.put(0, 0, 0, H.INERT.creature); t.put(0, 0, 2, H.INERT.creature);
  const c = t.put(1, 0, 0, 'Club of Gobbo'); c.originalOwner = 0; c.turnPlayed = 1;
  angebot = null;
  t.script.push({ match: d => d.type === 'zonePick', answer: (d) => { angebot = d.zones; return { owner: d.zones[0].owner, heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx }; } });
  await t.play(0, 'Secret Spell Book', { hero: 0 });
  R.check('angeboten wird genau der Stapel-Platz', angebot && angebot.length === 1 && angebot[0].heroIdx === 0 && angebot[0].slotIdx === 1, angebot);
  R.check('Club liegt oben im Stapel von Darion, beim Gegner nichts mehr', JSON.stringify(t.gs.players[0].supportZones[0][1]) === JSON.stringify(['Glass Sword', 'Club of Gobbo']) && t.gs.players[1].supportZones[0].flat().length === 0,
    [t.gs.players[0].supportZones[0], t.gs.players[1].supportZones[0]]);
  R.check('Sauber', sauber(t), [t.errors, t.audit()]);

  R.finish();
})();
