'use strict';
// S01-28 · Aurora Borealis ist unter der Hand-Sperre (`handLocked`) spielbar und verpufft
// Kartentext: „Choose up to 1/2/3 Spells with different names from your deck, reveal them and add them to your hand. …"  (Suche + Hand-Add)
// Sperren-Vertrag (CARD_API.md ~Z. 15805-15820): `handLocked` sperrt Draws UND Suchen/Adds. Brilliant Idea und Divine Gift of Creation tragen dafür `blockedByHandLock` (⇒ unspielbar, Karte bleibt auf der Hand);
//   Aurora Borealis trägt nur `blockedBySearchLock` (greift bei `searchLocked`, nicht bei `handLocked`).
// Aufbau: Sitz 0 hat `handLocked = true`, Aurora Borealis auf der Hand, Spells im Deck.
// Erwartet: Aurora ist nicht spielbar (Karte bleibt auf der Hand; kein Verbrauch ohne Wirkung).
// Beobachtet: Der Server spielt sie (true), die Galerie öffnet sich, aber das Hinzufügen schlägt still fehl: Karte in der Ablage, nichts gesucht – die Aktion und die Karte sind verbraucht.
const H = require('../../lib/h.js');
async function lauf(card, lock, gallery) {
  const t = await H.fresh({ hand: [[card], []], deck: [['Fireball', 'Burning Finger'], ['ZZ Dummy']], abilities: { 0: { 0: [['Magic Arts', 'Magic Arts', 'Magic Arts'], ['Destruction Magic'], []] } } });
  t.gs.players[0][lock] = true;
  t.script.push(gallery);
  const r = await t.play(0, card, { hero: 0, noGrant: true });
  return { r, hand: t.pile(0, 'hand'), ablage: t.pile(0, 'discardPile'), deck: t.pile(0, 'mainDeck').length, errors: t.errors };
}
(async () => {
  const R = H.runner();
  const k = await lauf('Brilliant Idea', 'handLocked', { match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
  R.check('Kontrolle: Brilliant Idea (blockedByHandLock) bleibt unter handLocked auf der Hand', k.hand.includes('Brilliant Idea') && k.ablage.length === 0, k);
  const a = await lauf('Aurora Borealis', 'handLocked', { match: d => d.type === 'cardGalleryMulti', answer: () => ({ selectedCards: ['Fireball'] }) });
  R.check('Aurora Borealis bleibt unter handLocked auf der Hand (nicht verbraucht)', a.hand.includes('Aurora Borealis') && a.ablage.length === 0, a);
  R.check('keine Engine-Fehler', a.errors.length === 0 && k.errors.length === 0);
  R.finish();
})();
