'use strict';
// A02-deepsea-32 · Deepsea Monstrosity: die Auswahl wird nur über Held/Slot aufgelöst – bei gleichen Koordinaten auf beiden Brettern trifft es die falsche Karte
//
// Kartentext (Monstrosity): „When you summon this Creature, you may choose one of your other "Deepsea" Creatures in play. Add it back to your hand."
// Aufbau: Seat 0: Monstrosity auf der Hand (Held 0, Summoning Magic Lv2), eigene Deepsea Skeleton in Held 1 / Slot 0 (eine Runde alt).
//   Seat 1: Deepsea Bats in Held 1 / Slot 0, von Seat 0 geliehen (Kontrolle bei mir, Brett beim Gegner). Beide stehen als Kandidaten in der Zonenwahl
//   (die Einträge tragen `owner` = Brettseite: 0 bzw. 1). Ich wähle den Eintrag der geliehenen Bats (owner 1).
// Erwartung: Die gewählte Kreatur (Bats) wird zurückgenommen (und an ihren Besitzer, Seat 1, gegeben); meine Skeleton bleibt stehen.
// Beobachtet: Steht meine Skeleton in `cardInstances` vor den Bats, geht die SKELETON auf meine Hand, obwohl die Bats gewählt wurden
//   (Ergebnis hängt von der Instanzreihenfolge ab; mit den Bats zuerst stimmt es).
// Ursache: `deepsea-monstrosity.js` Z. 103 `candidates.find(i => i.heroIdx === picked.heroIdx && i.zoneSlot === picked.slotIdx)` – `picked.owner` wird nicht verglichen.
//   Shapeshift (Z. 157) und Deepsea Castle (Z. 151) lösen genauso über Held/Slot auf (ihre Zonenlisten tragen nicht einmal `owner`).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Deepsea Monstrosity'], []] });
  t.setAbilities(0, 0, [['Summoning Magic', 'Summoning Magic']]);
  const mine = t.put(0, 1, 0, 'Deepsea Skeleton');
  const theirs = t.put(1, 1, 0, 'Deepsea Bats');
  mine.turnPlayed = 1; theirs.turnPlayed = 1;
  await t.run(() => t.engine.actionStealCreature(0, theirs, { sourceName: 'Deepsea Succubus' }));
  t.script.push({ match: d => d.type === 'zonePick' && /Monstrosity/.test(d.title || ''), answer: (d) => { const z = d.zones.find(z => z.owner === 1); return { owner: z.owner, heroIdx: z.heroIdx, slotIdx: z.slotIdx }; } });
  t.script.push({ match: d => d.type === 'cardGallery' || d.type === 'zonePick', answer: (d) => d.type === 'zonePick' ? { owner: d.zones[0].owner, heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx } : { cardName: d.cards[0].name || d.cards[0] } });
  const r = await t.play(0, 'Deepsea Monstrosity', { hero: 0, slot: 0 });
  const mineStays = t.inst(c => c.id === mine.id && c.zone === 'support').length === 1;
  const theirsBounced = t.inst(c => c.id === theirs.id && c.zone === 'support').length === 0;
  R.check('Monstrosity gespielt', r === true, r);
  R.check('die GEWÄHLTE geliehene Bats wurden zurückgenommen', theirsBounced, { hand0: t.pile(0, 'hand'), hand1: t.pile(1, 'hand') });
  R.check('meine nicht gewählte Skeleton bleibt stehen', mineStays, { hand0: t.pile(0, 'hand') });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
