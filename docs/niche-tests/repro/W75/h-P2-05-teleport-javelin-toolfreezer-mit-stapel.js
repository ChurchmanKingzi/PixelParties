'use strict';
// W75 · Darion — Audit P2: drei Karten, die einen Equip-Stapel nur "mitnehmen"/einzeln anfassen.
// Teleportation Powder: „… remove it, its Abilities, and all cards equipped or attached to it from the game completely. At the beginning of your next turn, return those cards to the Zones they were removed from."
// Javelin Throw: „Choose an Artifact equipped to that Hero and send it to the discard pile. Then … inflict damage equal to your chosen Hero's Base Attack …"
// Tool Freezer: „When your opponent plays ANY Artifact … negate it."
// Erwartet: (1) Darions ganzer Stapel (inkl. Zaehler der Instanzen und gleichnamiger Kopien) verschwindet und kommt unveraendert in dieselbe Zone zurueck; (2) Javelin Throw wirft genau die gewaehlte
// (mittlere) Karte, die anderen bleiben; (3) eine per Tool Freezer negierte Ausruestung landet in der Ablage, der Stapel bleibt unveraendert.
// Aufruf: node docs/niche-tests/repro/W75/h-P2-05-teleport-javelin-toolfreezer-mit-stapel.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const D = 'Darion, the Blood-Crazy Groundskeeper', F = H.INERT.filler, TU = 'Tushu, the Knowledge Keeper';
const NAMEN = ['Club of Gobbo', 'Blade of the Frostbringer', 'Cute Crown'];
function stapel(t, seite, namen = NAMEN) {
  const ps = t.gs.players[seite];
  ps.supportZones[0][1] = [];
  return namen.map(n => { ps.supportZones[0][1].push(n); const i = t.engine._trackCard(n, seite, 'support', 0, 1); i.turnPlayed = 1; return i; });
}
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;

(async () => {
  const R = H.runner();
  let t;

  R.section('1) Teleportation Powder auf den gegnerischen Darion: Stapel geht mit und kommt zurueck');
  t = await H.fresh({ active: 0, heroes: [[TU, null, null], [D, TU, null]], hand: [['Teleportation Powder'], [F]], gold: 500, deck: [Array(15).fill(F), Array(15).fill(F)] });
  const ins = stapel(t, 1, ['Club of Gobbo', 'Club of Gobbo', 'Cute Crown']);
  ins[1].counters.marke = 7;
  const ids = ins.map(i => i.id);
  t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
  await t.play(0, 'Teleportation Powder', { hero: 0 });
  R.check('weg: Zone leer, keine Instanz des Stapels mehr auf dem Brett', t.gs.players[1].supportZones[0].flat().length === 0 && !t.engine.cardInstances.some(c => ids.includes(c.id)), [t.gs.players[1].supportZones[0]]);
  R.check('Sauber (weg)', sauber(t), [t.errors, t.audit()]);
  t.gs.turn += 1; t.gs.activePlayer = 0;
  await t.run(() => require('../../../../cards/effects/teleportation-powder.js').rueckkehrNachholen(t.engine));
  R.check('zurueck: gleiche Zone, gleiche Reihenfolge', JSON.stringify(t.gs.players[1].supportZones[0][1]) === JSON.stringify(['Club of Gobbo', 'Club of Gobbo', 'Cute Crown']), t.gs.players[1].supportZones[0]);
  R.check('zurueck: dieselben Instanzen (Id) mit ihren Zaehlern', ids.every(id => t.engine.cardInstances.some(c => c.id === id && c.zone === 'support' && c.heroIdx === 0 && c.zoneSlot === 1)) && t.engine.cardInstances.find(c => c.id === ins[1].id).counters.marke === 7, ids);
  R.check('Sauber (zurueck)', sauber(t), [t.errors, t.audit()]);

  R.section('2) Javelin Throw: genau die gewaehlte (mittlere) Karte des eigenen Stapels wird geworfen');
  t = await H.fresh({ active: 0, heroes: [[D, TU, null], [F, null, null]], hand: [['Javelin Throw'], [F]], gold: 500, deck: [Array(15).fill(F), Array(15).fill(F)] });
  const jins = stapel(t, 0);
  t.script.push({ match: d => d.type === 'instancePick', answer: () => ({ instId: jins[1].id }) });
  t.targetFn = (valid) => {
    const eq = valid.find(v => v.type === 'equip' && v.owner === 0 && v.slotIdx === 1);
    return [(eq || valid.find(v => v.type === 'hero' && v.owner === 1) || valid.find(v => v.type === 'hero') || valid[0]).id];
  };
  t.policy.confirm = true;
  await t.play(0, 'Javelin Throw', { hero: 0 });
  await t.drain();
  R.check('Blade ist in der Ablage, Club + Crown bleiben', JSON.stringify(t.gs.players[0].supportZones[0][1]) === JSON.stringify(['Club of Gobbo', 'Cute Crown']) && t.pile(0, 'discardPile').includes('Blade of the Frostbringer'), [t.gs.players[0].supportZones[0], t.pile(0, 'discardPile')]);
  R.check('Sauber', sauber(t), [t.errors, t.audit()]);

  R.section('3) Tool Freezer negiert eine Ausruestung, die in den Stapel gehen sollte');
  t = await H.fresh({ active: 0, heroes: [[D, TU, null], [F, null, null]], hand: [['Glass Sword'], ['Tool Freezer']], gold: 500, deck: [Array(15).fill(F), Array(15).fill(F)] });
  stapel(t, 0);
  t.put(0, 0, 0, H.INERT.creature); t.put(0, 0, 2, H.INERT.creature);
  t.policy.confirm = true;
  await t.play(0, 'Glass Sword', { hero: 0, slot: 1 });
  await t.drain();
  R.check('Stapel unveraendert, Glass Sword in der Ablage', JSON.stringify(t.gs.players[0].supportZones[0][1]) === JSON.stringify(NAMEN) && t.pile(0, 'discardPile').includes('Glass Sword'), [t.gs.players[0].supportZones[0], t.pile(0, 'discardPile')]);
  R.check('Sauber', sauber(t), [t.errors, t.audit()]);

  R.finish();
})();
