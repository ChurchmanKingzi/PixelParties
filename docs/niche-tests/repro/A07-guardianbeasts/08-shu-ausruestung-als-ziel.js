'use strict';
// A07-08 · Guardian Beast Shu: Ausrüstung wird als „Creature on your side of the board" angeboten
//
// Kartentext Shu: „You may once per turn delete a multiple of 4 cards total from both discard piles to choose a
//   **Creature** on your side of the board. Choose as many copies of that Creature from your deck and/or discard pile
//   as you have deleted multiples of 4 cards and add them to your hand."
// Erwartung: nur Kreaturen sind wählbar.
// Beobachtet (guardian-beast-shu.js:62-68, :87-97): `ownCreatures` nimmt ALLE offenen Support-Karten des Kontrolleurs
//   (auch Ausrüstung/Anhängsel) mit Namen im Deck; eine Ausrüstung mit Kopien im Deck ist wählbar und wird nachgeholt.
const H = require('../../lib/h.js');
const F = H.INERT.filler;

(async () => {
  const R = H.runner();
  const t = await H.fresh({ discard: [Array(4).fill(F), []], deck: [['Charm of Balance', 'Charm of Balance', ...Array(5).fill(F)], []] });
  const shu = t.put(0, 0, 0, 'Guardian Beast Shu'); shu.turnPlayed = 1;
  t.put(0, 0, 1, 'Charm of Balance');
  let angeboten = [];
  t.targetFn = (valid) => { angeboten = valid.map(v => v.cardName); return null; };      // nur mitschneiden, dann abbrechen
  t.gs.activePlayer = 0; t.phase(2);
  await t.activateCreature(0, 0, 0);
  R.check('Ausrüstung (Charm of Balance) wird nicht als „Creature" angeboten', !angeboten.includes('Charm of Balance'), angeboten);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
