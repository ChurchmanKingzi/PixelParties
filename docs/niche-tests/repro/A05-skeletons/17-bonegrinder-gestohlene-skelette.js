'use strict';
// A05-skeletons-17 · The Bonegrinder prüft den KONTROLLEUR statt die Ablage des Besitzers (gestohlene Skelette)
// Kartentext: „… when a "Skeleton" Creature would be sent to your discard pile, you may delete it to draw 1 card."
// Regel (CARD_API „Gestohlene Karten gehen in die Ablage ihres Besitzers"): ein gestohlenes Skelett stirbt in die Ablage seines BESITZERS.
// (a) Mein Skelett, vom Gegner gestohlen, stirbt → geht in MEINE Ablage → meine Bonegrinder darf greifen.
// (b) Ein Gegner-Skelett, von mir gestohlen, stirbt → geht in die Ablage des GEGNERS → meine Bonegrinder darf NICHT greifen (nicht „your discard pile").
// Beobachtet: (a) keine Abfrage, Skelett landet in der Ablage; (b) Abfrage, das Gegner-Skelett wird in den Gelöscht-Stapel des Gegners umgeleitet und ICH ziehe 1.
// Ursache: the-bonegrinder.js `onCardLeaveZone` vergleicht `leaving.controller ?? leaving.owner` mit dem Bonegrinder-Kontrolleur statt mit `originalOwner/owner` (Ablage-Seite).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  let t = await H.fresh({});
  t.putArea(0, 'The Bonegrinder');
  const mine = t.put(0, 0, 0, 'Skeleton Archer'); mine.turnPlayed = 1;
  t.engine.actionStealCreature(1, mine);
  let fragen = 0;
  t.script.push({ match: d => d.type === 'confirm' && d.title === 'The Bonegrinder', answer: () => { fragen++; return { confirmed: true }; } });
  await t.run(() => t.engine.actionDestroyCard({ name: 'x', owner: 0 }, mine));
  R.check('(a) eigenes, gestohlenes Skelett → Ablage 0 → Bonegrinder fragt', fragen === 1, { fragen, ablage0: t.pile(0, 'discardPile') });

  t = await H.fresh({});
  t.putArea(0, 'The Bonegrinder');
  const theirs = t.put(1, 0, 0, 'Skeleton Archer'); theirs.turnPlayed = 1;
  t.engine.actionStealCreature(0, theirs);
  fragen = 0;
  t.script.push({ match: d => d.type === 'confirm' && d.title === 'The Bonegrinder', answer: () => { fragen++; return { confirmed: true }; } });
  const h0 = t.pile(0, 'hand').length;
  await t.run(() => t.engine.actionDestroyCard({ name: 'x', owner: 1 }, theirs));
  R.check('(b) gestohlenes Gegner-Skelett → Ablage 1 → Bonegrinder 0 greift nicht, ich ziehe nichts', fragen === 0 && t.pile(0, 'hand').length === h0, { fragen, handPlus: t.pile(0, 'hand').length - h0, geloescht1: t.pile(1, 'deletedPile') });
  R.finish();
})();
