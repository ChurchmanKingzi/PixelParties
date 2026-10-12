'use strict';
// A07-09 · Guardian Beast Shu: Kopien werden nur aus dem DECK geholt (Text: „from your deck and/or discard pile")
//
// Kartentext Shu: „… to choose a Creature on your side of the board. Choose as many copies of that Creature from your
//   deck and/or discard pile as you have deleted multiples of 4 cards and add them to your hand."
// Erwartung: Kopien aus Deck UND Ablage zählen; eine Kreatur, von der nur Kopien in der Ablage liegen, ist wählbar;
//   die wählbaren Löschmengen (4/8/12 …) richten sich nach allen verfügbaren Kopien.
// Beobachtet (guardian-beast-shu.js:60-68, :86-111): `deckCounts` liest nur `ps.mainDeck`; ohne Deck-Kopie ist die
//   Kreatur nicht wählbar (Shu nicht aktivierbar), mit 1 Deck-Kopie + 2 Ablage-Kopien sind nur [4] wählbar.
const H = require('../../lib/h.js');
const F = H.INERT.filler, D = H.INERT.creature;

(async () => {
  const R = H.runner();

  R.section('(1) Kopien NUR in der Ablage');
  let t = await H.fresh({ discard: [[...Array(4).fill(F), D, D], []], deck: [Array(6).fill(F), []] });
  let shu = t.put(0, 0, 0, 'Guardian Beast Shu'); shu.turnPlayed = 1;
  const c = t.put(0, 0, 1, D); c.turnPlayed = 1;
  t.gs.activePlayer = 0; t.phase(2);
  t.targetFn = (valid) => valid.some(v => v.cardName === D) ? [valid.find(v => v.cardName === D).id] : null;
  t.script.push({ match: d => d && d.type === 'cardGalleryMulti', once: true, answer: (d) => {
    const idx = []; d.cards.forEach((x, i) => { if (idx.length < 4 && x.name === F) idx.push(i); });
    return { selectedIndices: idx, selectedCards: idx.map(i => d.cards[i].name) }; } });
  await t.activateCreature(0, 0, 0);
  R.check('Dummy-Kopie aus der Ablage landet auf der Hand', t.pile(0, 'hand').filter(x => x === D).length >= 1, { hand: t.pile(0, 'hand'), ablage: t.pile(0, 'discardPile') });

  R.section('(2) 1 Kopie im Deck + 2 in der Ablage: 12 Karten (= 3 Kopien) sollen wählbar sein');
  t = await H.fresh({ discard: [[...Array(12).fill(F), D, D], []], deck: [[D, ...Array(6).fill(F)], []] });
  shu = t.put(0, 0, 0, 'Guardian Beast Shu'); shu.turnPlayed = 1;
  const c2 = t.put(0, 0, 1, D); c2.turnPlayed = 1;
  t.gs.activePlayer = 0; t.phase(2);
  t.targetFn = (valid) => [valid.find(v => v.cardName === D).id];
  let zaehlt = null;
  t.script.push({ match: d => d && d.type === 'cardGalleryMulti', once: true, answer: (d) => {
    zaehlt = d.validCounts;
    const idx = []; d.cards.forEach((x, i) => { if (idx.length < 4 && x.name === F) idx.push(i); });
    return { selectedIndices: idx, selectedCards: idx.map(i => d.cards[i].name) }; } });
  await t.activateCreature(0, 0, 0);
  R.check('wählbare Löschmengen enthalten 12', Array.isArray(zaehlt) && zaehlt.includes(12), zaehlt);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
