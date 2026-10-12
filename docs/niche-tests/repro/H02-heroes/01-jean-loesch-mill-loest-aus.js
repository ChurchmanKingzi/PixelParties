// H02-heroes-01 · Jean, the Pillaging Knight – ein Mill im LÖSCH-Modus löst Jeans Bonus-Mill aus
//
// Kartentext Jean: „Whenever 1 or more cards are sent from your opponent's deck to the discard pile, except by this
//   effect, your opponent must choose 2 additional cards from their deck and send them to the discard pile."
// Erwartung: Löscht der Gegner Karten von seinem Deck (Golem Smash: „delete up to 10 of the top cards of your deck"),
//   gehen sie in den Gelöscht-Stapel, NICHT in die Ablage – Jean löst nicht aus; in der Ablage liegt nur die gespielte
//   Golem Smash selbst.
// Beobachtung: `jean-the-pillaging-knight.js` onMill prüft `ctx.deleteMode` nicht; `actionMillCards` feuert onMill auch
//   im Lösch-Modus. Der Gegner verliert dadurch zusätzlich 2 Karten in die Ablage (bei Golem Smash 3 Karten Deck-Verlust
//   statt 1, und zwei Karten vom Deck landen in der Ablage).
// Aufruf: node docs/niche-tests/repro/H02-heroes/01-jean-loesch-mill-loest-aus.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const J = 'Jean, the Pillaging Knight';
  const t = await H.fresh({ heroes: [[J, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], hand: [[], ['Golem Smash']], active: 1 });
  t.setDeck(1, ['Fireball','Cavalry','ZZ Dummy','ZZ Dummy Big','ZZ Dummy Frail','ZZ Filler','ZZ Trinket','Fireball','Fireball','Fireball']);
  t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 0 && v.heroIdx === 1).id];
  t.script.push({ match: d => d.type === 'optionPicker' && d.title === 'Golem Smash', answer: () => ({ optionId: '1' }), once: true });
  t.reset();
  R.section('Sitz 1 spielt Golem Smash und löscht 1 Karte vom eigenen Deck (Jean liegt bei Sitz 0)');
  const r = await t.play(1, 'Golem Smash', { hero: 0 });
  R.check('Golem Smash gespielt', r === true, r);
  R.note('Gegner Deck / Ablage / Gelöscht', [t.pile(1,'mainDeck').length, t.pile(1,'discardPile'), t.pile(1,'deletedPile')]);
  R.check('genau 1 Karte gelöscht', t.pile(1,'deletedPile').length === 1, t.pile(1,'deletedPile'));
  R.check('Ablage des Gegners enthält nur die gespielte Golem Smash (nichts vom Deck „sent to the discard pile")', t.pile(1,'discardPile').length === 1 && t.pile(1,'discardPile')[0] === 'Golem Smash', t.pile(1,'discardPile'));
  R.check('Deck −1 (nur die gelöschte Karte)', t.pile(1,'mainDeck').length === 9, t.pile(1,'mainDeck').length);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
