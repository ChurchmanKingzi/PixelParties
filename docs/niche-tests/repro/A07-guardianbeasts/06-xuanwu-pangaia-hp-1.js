'use strict';
// A07-06 · Cardinal Beast Xuanwu + Pangaia: wiederbelebte Kreatur hat 201 statt 1 HP
//
// Kartentexte:
//   Cardinal Beast Xuanwu: „You may once per turn place a level 3 or lower Creature from your discard pile into one of
//     your Heroes' free Support Zones, but its current and max HP become 1."
//   Pangaia, the Dino Domain: „The current and max HP of all level 3 or higher Creatures either player summons are
//     increased by 200."
//
// Erwartung: Die von Xuanwu gelegte Kreatur hat danach 1/1 HP. (Wird Pangaia auf die Platzierung angewandt, muss „become 1"
//   als letzter Schritt gelten; wird sie nicht angewandt – „place" ist kein „summon" –, bleibt es ebenfalls bei 1.)
// Beobachtet: Xuanwu setzt HP=1 (cardinal-beast-xuanwu.js:140) und feuert danach `onCardEnterZone`; Pangaias Hook addiert
//   +200 (pangaia-the-dino-domain.js `onCardEnterZone`) → 201/201.
const H = require('../../lib/h.js');

(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Pangaia, the Dino Domain'], []], discard: [['Gigantisaur Raptoren'], []], deckSize: 10 });
  const x = t.put(0, 0, 0, 'Cardinal Beast Xuanwu'); x.turnPlayed = 1;
  await t.play(0, 'Pangaia, the Dino Domain', { hero: 0 });
  R.check('Vorbedingung: Pangaia liegt in der Area Zone', t.gs.areaZones[0].includes('Pangaia, the Dino Domain'));
  t.script.push({ match: d => d && d.type === 'cardGallery', answer: () => ({ cardName: 'Gigantisaur Raptoren', source: 'discard' }) });
  t.script.push({ match: d => d && d.type === 'zonePick', answer: (d) => ({ heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx, owner: d.zones[0].owner }) });
  t.gs.activePlayer = 0; t.phase(2);
  await t.activateCreature(0, 0, 0);
  const r = t.find('Gigantisaur Raptoren', 'support');
  R.check('Raptoren liegt auf dem Brett', !!r);
  R.check('Raptoren hat 1/1 HP', r && r.counters.currentHp === 1 && r.counters.maxHp === 1, r && { cur: r.counters.currentHp, max: r.counters.maxHp });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
