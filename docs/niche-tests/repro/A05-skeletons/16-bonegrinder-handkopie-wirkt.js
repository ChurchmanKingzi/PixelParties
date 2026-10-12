'use strict';
// A05-skeletons-16 · The Bonegrinder: die Kopie auf der HAND löst den Lösch-und-Zieh-Effekt bereits aus
// Kartentext (The Bonegrinder, Spell Area): „… Up to 5 times per turn, when a "Skeleton" Creature would be sent to your discard pile, you may delete it to draw 1 card."
//   (Dritter Effekt = Dauereffekt der ausliegenden Area; die ersten beiden nennen die Hand ausdrücklich: „level in your hand", „make this Spell count as an additional Action".)
// Erwartung: Solange die Bonegrinder nur auf der Hand liegt (nicht gespielt), reagiert sie nicht auf Skelett-Tode.
// Beobachtet: Hand-Kopie fragt „Delete it instead and draw 1 card?" und zieht (Skelett wird gelöscht). Bei Hand- und Area-Kopie gleichzeitig hätte jede ihr eigenes 5er-Limit.
// Ursache: `the-bonegrinder.js` `activeIn: ['hand','area']` (nötig für die Stufensenkung); die Hooks `onCardLeaveZone`/`onDiscard`/`onMill` prüfen die Zone nicht.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['The Bonegrinder'], []] });
  const a = t.put(0, 0, 0, 'Skeleton Archer'); a.turnPlayed = 1;
  let fragen = 0;
  t.script.push({ match: d => d.type === 'confirm' && d.title === 'The Bonegrinder', answer: () => { fragen++; return { confirmed: true }; } });
  await t.run(() => t.engine.actionDestroyCard({ name: 'x', owner: 1 }, a));
  R.check('Bonegrinder auf der Hand (nicht in der Area) bietet kein Löschen+Ziehen an', fragen === 0, { fragen, geloescht: t.pile(0, 'deletedPile') });
  R.finish();
})();
