// A08-08 · Distracting Crystal sperrt Horn in a Bottle (Trank ohne Zielwahl) nicht
//
// Kartentext Distracting Crystal: „While this card is in your hand, you cannot activate effects that include adding cards
//   from your hand or discard pile to your deck."
// Kartentext Horn in a Bottle: „Shuffle any number of cards from your hand back into your deck to draw the same number of cards +1."
// Skript-Kopf von horn-in-a-bottle.js: „Von Distracting Crystal gesperrt" (Marke `shufflesFromHandOrDiscardIntoDeck: true`).
//
// Erwartung: Mit Distracting Crystal auf der Hand lehnt der Server das Ausspielen ab (play = false), Horn bleibt auf der Hand, nichts wird gemischt.
// Beobachtet: Der Trank wird gespielt (play = true), eine Handkarte wandert ins Deck, es wird nachgezogen. Das Tor
//   `isShuffleIntoDeckBlockedByDistractingCrystal` steht in `doConfirmPotion` (Tränke MIT Zielwahl), nicht aber in `doUsePotion` (server.js ~11849),
//   und Horn in a Bottle hat keine Zielwahl.
// Aufruf: node docs/niche-tests/repro/A08-pacman/08-distracting-crystal-sperrt-horn-in-a-bottle-nicht.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const F = H.INERT.filler;
  const t = await H.fresh({ gold: [100, 100], hand: [[], []], deck: [Array(20).fill(F), Array(20).fill(F)] });
  t.engine.handZugangSync(0, 'Distracting Crystal');
  for (const n of [F, F, F]) t.engine.handZugangSync(0, n);
  // Falls gespielt: ein Filler (Index 1) wird zum Mischen gewählt
  t.script.push({ match: d => d.type === 'handPick', answer: (d) => ({ selectedCards: [{ handIndex: 1, cardName: t.pile(0, 'hand')[1] }] }) });
  const deck0 = t.pile(0, 'mainDeck').length;
  const r = await t.play(0, 'Horn in a Bottle');
  R.check('Horn in a Bottle wird bei Distracting Crystal auf der Hand abgelehnt (play = false)', r === false, { play: r });
  R.check('Horn in a Bottle liegt noch auf der Hand', t.pile(0, 'hand').includes('Horn in a Bottle'), t.pile(0, 'hand'));
  R.check('es wurde nichts ins Deck gemischt/gezogen (Deck unverändert)', t.pile(0, 'mainDeck').length === deck0, { deck0, deck1: t.pile(0, 'mainDeck').length });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
