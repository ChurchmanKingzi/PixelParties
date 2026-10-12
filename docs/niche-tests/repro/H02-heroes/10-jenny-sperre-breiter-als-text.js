// H02-heroes-10 · Jenny, the Class Fairy – die Sperre („handLocked") ist breiter als der Kartentext
//
// Kartentext Jenny: „… You cannot draw or add cards **from your deck** to your hand for the rest of the turn afterwards."
// Erwartung: nach Jennys Effekt sind Ziehen und Deck→Hand gesperrt, Ablage→Hand bleibt möglich.
// Beobachtung: `jenny-the-class-fairy.js` setzt `ps.handLocked = true` – die volle Hand-Sperre (Kazena: „draw or add cards to your hand"), die auch Ablage→Hand
//   (`addCardFromDiscardToHand` → `_isSearchBlocked(…, "discard")` liefert bei `handLocked` immer true) sperrt. Die exakte Form wäre `drawLocked` + `searchLocked` (nur Deck-Suche, nicht Ablage).
// Aufruf: node docs/niche-tests/repro/H02-heroes/10-jenny-sperre-breiter-als-text.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
const JENNY = 'Jenny, the Class Fairy';
(async () => {
  const R = H.runner();
  const t = await H.fresh({ heroes: [[JENNY, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], abilities: { 0: { 1: [['Fighting'], [], []] } }, deckSize: 20, discard: [['Fireball'], []] });
  t.targetFn = (valid) => valid.filter(v => v.type === 'ability').map(v => v.id);
  const r = await t.activateHero(0, 0, { effect: JENNY });
  R.check('Jenny aktiviert', r === true, r);
  const gezogen = await t.run(() => t.engine.actionDrawCards(0, 1, { source: 'test' }));
  R.check('Ziehen ist gesperrt', Array.isArray(gezogen) && gezogen.length === 0, gezogen);
  const deckAdd = await t.run(() => t.engine.actionAddCardFromDeckToHand(0, 'ZZ Dummy', { source: 'test' }));
  R.check('Deck→Hand ist gesperrt', !deckAdd, deckAdd);
  const ablage = await t.run(() => t.engine.addCardFromDiscardToHand(0, 'Fireball', 0, { source: 'test' }));
  R.check('Ablage→Hand bleibt möglich (der Text sperrt nur das DECK)', !!ablage && t.pile(0, 'hand').includes('Fireball'), { ablage, hand: t.pile(0, 'hand') });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
