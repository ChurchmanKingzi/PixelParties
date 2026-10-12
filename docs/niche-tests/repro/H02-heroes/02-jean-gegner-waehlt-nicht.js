// H02-heroes-02 · Jean, the Pillaging Knight – „your opponent must CHOOSE 2 additional cards", das Skript mill't die obersten 2
//
// Kartentext Jean: „... your opponent must choose 2 additional cards from their deck and send them to the discard pile."
// Erwartung: der Gegner (Sitz 1) bekommt eine Auswahl (Prompt) und bestimmt selbst, welche 2 Karten seines Decks abgeworfen werden.
// Beobachtung: kein Prompt an den Gegner; `jean-the-pillaging-knight.js:65` ruft `actionMillCards(oppIdx, 2, …)` – die
//   OBERSTEN 2 Karten wandern in die Ablage (der Kopfkommentar des Skripts nennt noch die alte Fassung „must also send 2 additional cards").
// Aufruf: node docs/niche-tests/repro/H02-heroes/02-jean-gegner-waehlt-nicht.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const J = 'Jean, the Pillaging Knight';
  const t = await H.fresh({ heroes: [[J, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null] });
  t.setDeck(1, ['Fireball','Cavalry','ZZ Dummy','ZZ Dummy Big','ZZ Dummy Frail','ZZ Filler','ZZ Trinket','Fireball','Fireball','Fireball']);
  t.reset();
  R.section('Ein Mill von 1 Karte auf das Gegnerdeck (Jean liegt bei Sitz 0)');
  await t.run(() => t.engine.actionMillCards(1, 1, { source: 'test' }));
  R.note('Ablage Gegner', t.pile(1, 'discardPile'));
  R.note('Prompts', t.prompts.map(p => ({ pi: p.pi, type: p.d.type, title: p.d.title })));
  R.check('3 Karten in der Ablage (1 + 2 zusätzliche)', t.pile(1, 'discardPile').length === 3, t.pile(1, 'discardPile'));
  R.check('der Gegner wird gefragt, welche 2 Karten er abwirft (Prompt an Sitz 1)', t.prompts.some(p => p.pi === 1), t.prompts.length);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
