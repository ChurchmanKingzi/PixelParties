'use strict';
// A01-pollution-35 · Mass Multiplication: ignoriert die Such-Sperre (Cats of the Pharaoh) – holt trotzdem 3 Kopien aus dem Deck in die Hand
// Kartentext Mass Multiplication: „… Delete a card from your hand or discard pile and add up to 3 copies of it from your deck to your hand.“
// Cats of the Pharaoh: „… you cannot search or add cards to your hand for the rest of the turn afterwards (but you can still draw).“ (setzt `ps.searchLocked`, `cats-of-the-pharaoh.js` Z. 168)
// Aufbau: Sitz 0: Mass Multiplication + Fireball auf der Hand, 3 Fireball im Deck, `ps.searchLocked = true` (genau wie Cats es setzt).
// Erwartet: die Karte ist unter der Sperre nicht spielbar (so wie reine Suchkarten, `blockedBySearchLock`, v1069 „Karten, die NUR suchen, sollen gar nicht erst spielbar sein“),
//   mindestens aber werden keine Karten aus dem Deck in die Hand gelegt und nichts gelöscht.
// Beobachtet: gespielt; die Fireball aus der Hand wird gelöscht, 3 Kopien kommen aus dem Deck auf die Hand (Hand 3, Deck 0).
// Ursache: cards/effects/mass-multiplication.js ~Z. 209–225: eigener Add-Weg (`deck.splice` + `handZugangSync`) prüft nur `ps.handLocked`, nicht `engine._isSearchBlocked(pi, {}, 'deck')`;
//   der Lader erkennt die Karte nicht als `blockedBySearchLock`, weil keines der Muster (`actionAddCardFromDeckToHand` …) im Quelltext steht.
// Aufruf: node docs/niche-tests/repro/A01-pollution/35-mass-multiplication-ignoriert-such-sperre.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Mass Multiplication', 'Fireball'], []], deck: [['Fireball', 'Fireball', 'Fireball'], []] });
  t.gs.players[0].searchLocked = true;
  R.check('Aufbau: Such-Sperre aktiv', t.engine._isSearchBlocked(0, {}, 'deck') === true, null);
  t.policy.confirm = true;
  t.script.push({ match: d => d && d.type === 'cardGallery', answer: (d) => ({ cardName: d.cards[0].name }) });
  const r = await t.play(0, 'Mass Multiplication', { hero: 0 });
  const hand = t.pile(0, 'hand');
  R.check('keine Karten aus dem Deck in die Hand unter der Such-Sperre', t.pile(0, 'mainDeck').length === 3, { r, hand, deck: t.pile(0, 'mainDeck').length, gelöscht: t.pile(0, 'deletedPile') });
  R.check('Fireball der Hand nicht gelöscht', t.pile(0, 'deletedPile').length === 0, t.pile(0, 'deletedPile'));
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
