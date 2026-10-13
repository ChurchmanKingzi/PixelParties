'use strict';
// A07-31 · Dauerhafte Übernahme (Dark Gear u. a.) umgeht „1 Gigantisaur pro Held" und „only control 1 Brachion"
//
// Kartentexte: Gigantisaur (alle neun): „A Hero can only have 1 "Gigantisaur" Creature in its Support Zones at a time."
//   Brachion: „You can only control 1 "Gigantisaur Brachion" at a time."
//   Dark Gear: „Choose a Creature your opponent controls and take permanent control of it. Place it into a free Support Zone of any Hero you control."
// Erwartung: eine übernommene Kreatur darf nur in eine Zone, in der die Regeln gelten (Held ohne Gigantisaurier; Brachion nur, wenn
//   man noch keine kontrolliert); die Zonenwahl bietet die verbotenen Plätze gar nicht an bzw. die Übernahme ist nicht möglich.
// Beobachtet: `dark-gear.js` getFreeZones bietet jede freie Zone an, `actionTransferCreature` prüft weder `canSummon` noch
//   `beforeSummon`/Einzigkeit. Ergebnis: Held 0 trägt Ankylos UND Pteranos; Sitz 0 kontrolliert zwei Brachion.
//   (Gleiche Lücke für Diplomacy, Capture, Memory Blast, Liberation … – alle über `actionTransferCreature`; nicht einzeln gemessen.)
//   Der Engine-Aufruf `actionTransferCreature` allein verhält sich ebenso (gemessen: erfolgreicher Transfer ohne jede Prüfung).
const H = require('../../lib/h.js');

(async () => {
  const R = H.runner();

  R.section('Dark Gear: Pteranos auf Held mit Ankylos');
  let t = await H.fresh({ hand: [['Dark Gear'], []], deckSize: 10, gold: [100, 100] });
  t.put(0, 0, 0, 'Gigantisaur Ankylos');
  t.put(1, 0, 0, 'Gigantisaur Pteranos');
  let angeboten = null;
  t.script.push({ match: d => d && d.type === 'zonePick', once: true, answer: (d) => { angeboten = d.zones.map(z => `${z.heroIdx}/${z.slotIdx}`); return { heroIdx: 0, slotIdx: 1 }; } });
  t.targetFn = (v) => [v.find(x => x.cardName === 'Gigantisaur Pteranos').id];
  const r = await t.play(0, 'Dark Gear', {});
  const ptr = t.inst(c => c.name === 'Gigantisaur Pteranos')[0];
  const gigaHeld0 = t.inst(c => c.zone === 'support' && c.heroIdx === 0 && (c.controller ?? c.owner) === 0 && /^Gigantisaur/.test(c.name) && t.engine.physicalSide(c) === 0).map(c => c.name);
  R.note('Ablauf', { r, angeboten, pteranos: ptr && { zone: ptr.zone, hero: ptr.heroIdx, slot: ptr.zoneSlot, ctrl: ptr.controller } });
  R.check('Zonenwahl bietet keinen Platz bei Held 0 (hat schon Ankylos) an', !angeboten || !angeboten.some(z => z.startsWith('0/')), angeboten);
  R.check('Held 0 hat danach höchstens 1 Gigantisaurier', gigaHeld0.length <= 1, gigaHeld0);

  R.section('Dark Gear: zweites Brachion');
  t = await H.fresh({ hand: [['Dark Gear'], []], deckSize: 10, gold: [100, 100] });
  t.put(0, 0, 0, 'Gigantisaur Brachion');
  t.put(1, 0, 0, 'Gigantisaur Brachion');
  t.targetFn = (v) => [v.find(x => x.cardName === 'Gigantisaur Brachion' && x.owner === 1).id];
  await t.play(0, 'Dark Gear', {});
  const brach = t.inst(c => c.zone === 'support' && c.name === 'Gigantisaur Brachion' && (c.controller ?? c.owner) === 0).length;
  R.check('Sitz 0 kontrolliert höchstens 1 Brachion', brach <= 1, { brach });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
