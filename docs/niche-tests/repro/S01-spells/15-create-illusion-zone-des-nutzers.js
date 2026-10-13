'use strict';
// S01-15 · Create Illusion: die Kreatur kommt in eine freie Support Zone eines BELIEBIGEN eigenen Helden, nicht des Nutzers
// Kartentext: „Choose a level 1/2/3 or lower Creature from your deck and place it into a free Support Zone of the user."  („the user" = der wirkende Held, vgl. Create Secret Room: „the user's Surprise Zone")
// Aufbau: Sitz 0, Held 0 (Nutzer, Magic Arts 1) hat alle 3 Support Zones belegt; Held 1 hat freie Zonen; Deck: Elven Archer (Lv 1).
// Erwartet: keine freie Zone des Nutzers ⇒ der Zauber ist nicht spielbar bzw. wird abgebrochen (Karte bleibt auf der Hand); in keinem Fall landet die Illusion bei Held 1.
// Beobachtet: `spellPlayCondition` (create-illusion.js) prüft „irgendein lebender Held hat eine freie Zone"; `onPlay` sammelt `freeZones` über ALLE Helden (`for hi …`), bietet sie an
//   (promptZonePick) und legt die Illusion zu Held 1.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Create Illusion'], []], deck: [['Elven Archer', 'Fireball'], []], abilities: { 0: { 0: [['Magic Arts'], [], []] } } });
  for (let s = 0; s < 3; s++) t.put(0, 0, s, H.INERT.creature);
  t.script.push({ match: d => d.type === 'cardGallery' && d.title === 'Create Illusion', answer: () => ({ cardName: 'Elven Archer' }) });
  t.script.push({ match: d => d.type === 'zonePick', answer: () => ({ heroIdx: 1, slotIdx: 0 }) });
  const r = await t.play(0, 'Create Illusion', { hero: 0, noGrant: true });
  const ill = t.find('Elven Archer', 'support');
  R.check('die Illusion liegt nicht bei einem anderen Helden als dem Nutzer', !ill || ill.heroIdx === 0, { r, bei: ill && ill.heroIdx, hand: t.pile(0, 'hand') });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
