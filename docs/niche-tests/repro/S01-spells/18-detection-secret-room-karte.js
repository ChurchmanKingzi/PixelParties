'use strict';
// S01-18 · Detection zählt eine per Create Secret Room gelegte NICHT-Surprise-Karte als „Surprise"
// Kartentext Detection: „Remove all Surprises your opponent controls from the board, then draw 2 cards for every Surprise removed by this effect. … You can only play this card while your opponent controls 1+ Surprises."
// Create Secret Room: „Choose a card from your deck and place it into the user's Surprise Zone face-down. … If the card is a Surprise …" (die Karte kann jede Karte sein; CARD_API: „gewöhnliche Karte der Surprise Zone").
// Aufbau: Sitz 1 legt per Create Secret Room einen Fireball (kein Surprise) verdeckt in die Surprise Zone seines Helden 0; sonst hat Sitz 1 keine Surprise. Sitz 0 spielt Detection.
// Lesart A (Karte nach Typ): Ein Fireball ist keine Surprise ⇒ Detection ist nicht spielbar (keine Surprise des Gegners) bzw. entfernt nichts und zieht nichts.
// Lesart B (Skript): Alles in der Surprise Zone zählt (`_getOppSurprises` nimmt alle Einträge von `_getAllSurpriseEntries`, ohne Subtyp-Prüfung) ⇒ Fireball entfernt, 2 Karten gezogen.
// Beobachtet: Lesart B.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Detection'], ['Create Secret Room']], deck: [['Fireball', 'Fireball', 'Fireball', 'Fireball'], ['Fireball', 'Fireball', 'Fireball', 'Fireball']] });
  t.script.push({ match: d => d.type === 'cardGallery' && d.title === 'Create Secret Room', answer: () => ({ cardName: 'Fireball' }) });
  await t.play(1, 'Create Secret Room', { hero: 0, active: 1 });
  R.check('Aufbau: der Fireball liegt verdeckt in der Surprise Zone von Sitz 1', (t.gs.players[1].surpriseZones[0] || []).includes('Fireball'), t.gs.players[1].surpriseZones);
  const hand0 = t.pile(0, 'hand').length;           // nur Detection
  const r = await t.play(0, 'Detection', { hero: 0 });
  const gezogen = t.pile(0, 'hand').length - (hand0 - 1);
  R.check('Detection entfernt keine Nicht-Surprise-Karte und zieht nichts', gezogen === 0 && (t.gs.players[1].surpriseZones[0] || []).includes('Fireball') || r === false, { r, gezogen, zone: t.gs.players[1].surpriseZones[0], ablage1: t.pile(1, 'discardPile') });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
