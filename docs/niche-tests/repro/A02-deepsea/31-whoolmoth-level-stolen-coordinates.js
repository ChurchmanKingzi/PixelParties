'use strict';
// A02-deepsea-31 · Slippery Whoolmoth: Level-Rabatt zählt eine geliehene Gegnerkreatur an denselben Koordinaten als „Kreatur bei meinem Helden"
//
// Kartentext (Whoolmoth): „If there is at least 1 Creature in a Support Zone of each of your Heroes, this Creature's level in your hand becomes 0."
// Aufbau: Seat 0: Held 0 und Held 1 mit je einer Kreatur, Held 2 trägt NUR ein Artefakt (Slot 0). Seat 1: Kreatur in Held 2 / Slot 0 (liegt vor meinem
//   Artefakt in der Instanzliste), von Seat 0 geliehen (Kontrolle bei mir, Brett beim Gegner, z. B. Deepsea Succubus). Whoolmoth auf der Hand.
// Erwartung: Held 2 hat keine Kreatur in seinen Support Zones -> Rabatt greift nicht (`reduceCardLevel` = 0), auch wenn die geliehene Kreatur an (2/0) steht.
// Beobachtet: 5 (Rabatt). `slotHoldsCreature` sucht die Instanz nur über heroIdx/zoneSlot und `owner === ownerIdx || controller === ownerIdx`, ohne Brettseite;
//   findet die geliehene Kreatur und hält damit meine Artefakt-Zone für eine Kreatur. Ohne Diebstahl: 0 (Kontrolle ✓).
// Ursache: `slippery-whoolmoth.js` `slotHoldsCreature` (Z. ~41). Das Ergebnis hängt von der Reihenfolge der Instanzen ab.
const H = require('../../lib/h.js');
const W = require('../../../../cards/effects/slippery-whoolmoth.js');
(async () => {
  const R = H.runner();
  async function level(steal) {
    const t = await H.fresh({ hand: [['Slippery Whoolmoth'], []] });
    const theirs = t.put(1, 2, 0, H.INERT.creature);
    t.put(0, 0, 0, H.INERT.creature); t.put(0, 1, 0, H.INERT.creature);
    t.put(0, 2, 0, H.INERT.artifact);
    if (steal) await t.run(() => t.engine.actionStealCreature(0, theirs, { sourceName: 'Deepsea Succubus' }));
    const inst = t.inst(c => c.zone === 'hand' && c.name === 'Slippery Whoolmoth' && c.owner === 0)[0];
    return W.reduceCardLevel(t.engine._getCardDB()['Slippery Whoolmoth'], t.engine, 0, inst);
  }
  R.check('Kontrolle ohne Diebstahl: kein Rabatt (Held 2 ohne Kreatur)', (await level(false)) === 0);
  const r = await level(true);
  R.check('mit geliehener Kreatur auf dem Gegnerbrett (2/0): weiterhin kein Rabatt', r === 0, r);
  R.finish();
})();
