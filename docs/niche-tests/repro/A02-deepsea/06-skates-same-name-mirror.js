'use strict';
// A02-deepsea-06 · Slippery Skates: eine gleichnamige Kreatur der Gegenseite am selben Platz sperrt die Aktivierung
//
// Kartentext (Slippery Skates): „Equip this card to a Hero you control. You may once per turn move a Creature in one of the equipped
// Hero's Support Zones into the free Support Zone of an adjacent Hero. A Creature can only be moved by the effect of "Slippery Skates" once per turn."
// Erwartung: Skates lassen sich mit einer eigenen Kreatur auf dem ausgerüsteten Helden immer aktivieren (Spiegelduell Slippery gegen Slippery
//   ist der Normalfall: beide haben z. B. einen Slippery Narw in Held 0 / Slot 0).
// Beobachtet: Liegt die gleichnamige GEGNERISCHE Kreatur an denselben Koordinaten und wurde sie früher angelegt, ist `activateEquip` = false
//   und die Kreatur wird nicht angeboten. Wurde die eigene früher angelegt, funktioniert es – das Ergebnis hängt von der Reihenfolge der Instanzen ab.
// Ursache: `slippery-skates.js` `_getCreaturesOnHero` (Z. ~367): `engine.cardInstances.find(c => c.zone === 'support' && c.heroIdx === heroIdx && c.zoneSlot === zi && c.name === name)`
//   – kein Besitzer-/Seitenvergleich; findet die Instanz des Gegners, die danach am Kontrolleur-Filter (`!== kontrolleur`) scheitert.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const oppFirst of [false, true]) {
    R.section('Gegnerische Narw wurde ' + (oppFirst ? 'VOR' : 'NACH') + ' meiner angelegt');
    const t = await H.fresh({ hand: [['Slippery Skates'], []] });
    if (oppFirst) t.put(1, 0, 0, 'Slippery Narw');
    t.put(0, 0, 0, 'Slippery Narw');
    if (!oppFirst) t.put(1, 0, 0, 'Slippery Narw');
    for (const c of t.inst(c => c.name === 'Slippery Narw')) c.turnPlayed = 1;
    await t.play(0, 'Slippery Skates', { hero: 0, slot: 1 });
    t.script.push({ match: d => d.type === 'skatesMove', answer: (d) => ({ creatureSlot: d.creatures[0].zoneSlot, destHeroIdx: d.destZones[0].heroIdx, destSlot: d.destZones[0].slotIdx }) });
    const a = await t.activateEquip(0, 0, 1, {});
    R.check('Skates aktivierbar', a === true, a);
    R.check('Meine Narw wurde verschoben (Held 0 / Slot 0 ist frei)', (t.gs.players[0].supportZones[0][0] || []).length === 0, t.gs.players[0].supportZones[0]);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
