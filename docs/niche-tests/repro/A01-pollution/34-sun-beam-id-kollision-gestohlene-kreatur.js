'use strict';
// A01-pollution-34 · Sun Beam: Ziel-IDs nach Besitzer statt nach Brettseite – gestohlene Kreatur kollidiert mit der eigenen an derselben (Held, Slot)-Stelle
// Kartentext: „Choose up to 3 cards on the board that aren't Heroes and send them to the discard pile. Place the same number of Pollution Tokens into your free Support Zones.“
// Aufbau: Sitz 1 besitzt Royal Corgi (Held 0 / Slot 0), Sitz 0 stiehlt sie → sie liegt auf Sitz 0s Brett an Held 0 / Slot 0 (owner 1, controller 0).
//   Sitz 1 hat außerdem eine eigene ZZ Dummy an Held 0 / Slot 0 SEINES Bretts. Sitz 0 spielt Sun Beam und wählt die Dummy.
// Erwartet: die gewählte Dummy (Sitz 1, eigenes Brett) wird zerstört; die gestohlene Corgi bleibt. (Gemeinsamer Sammler `collectNonHeroBoardTargets` vergibt IDs nach Brettseite.)
// Beobachtet: beide Einträge tragen die ID `equip-1-0-0` (Besitzer-Index statt Brettseite); `targets.find(t => t.id === id)` liefert den ersten – die Corgi wird zerstört, die gewählte Dummy bleibt.
//   Menschen: die gestohlene Corgi auf Sitz 0s Brett kann gar nicht angeklickt werden (ihre Kachel trägt `owner: 1`).
// Ursache: cards/effects/sun-beam.js (Sammler ~Z. 60–80: `id: equip-${inst.owner}-…`, `owner: inst.owner`; Auflösung `targets.find(...)`). Vergleich `_targeting-shared.js` `collectNonHeroBoardTargets` (`_brettSeite`).
// Aufruf: node docs/niche-tests/repro/A01-pollution/34-sun-beam-id-kollision-gestohlene-kreatur.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Sun Beam'], []] });
  const stolen = t.put(1, 0, 0, 'Royal Corgi');
  await t.run(() => t.engine.actionStealCreature(0, stolen));
  const own = t.put(1, stolen.heroIdx, stolen.zoneSlot, H.INERT.creature);
  R.check('Aufbau: Corgi gestohlen, gleiche (Held, Slot)-Stelle wie die eigene Dummy', stolen.controller === 0 && stolen.heroIdx === own.heroIdx && stolen.zoneSlot === own.zoneSlot,
    { stolen: [stolen.owner, stolen.controller, stolen.heroIdx, stolen.zoneSlot], own: [own.owner, own.heroIdx, own.zoneSlot] });
  let angebote = [];
  t.targetFn = (v) => { angebote = v.filter(y => y.type === 'equip').map(y => y.id + '=' + y.cardName); return [v.find(y => y.cardName === H.INERT.creature).id]; };
  await t.play(0, 'Sun Beam', { hero: 0 });
  const ids = angebote.map(s => s.split('=')[0]);
  R.check('die beiden Karten haben verschiedene Ziel-IDs', new Set(ids).size === ids.length, angebote);
  R.check('die gewählte Dummy wurde zerstört', !t.find(H.INERT.creature, 'support'), { dummyDa: !!t.find(H.INERT.creature, 'support') });
  R.check('die gestohlene Corgi blieb unberührt', !!t.find('Royal Corgi', 'support'), { corgiDa: !!t.find('Royal Corgi', 'support') });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
