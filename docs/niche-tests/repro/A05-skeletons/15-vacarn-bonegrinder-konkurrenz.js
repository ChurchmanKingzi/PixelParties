'use strict';
// A05-skeletons-15 · Vacarn + The Bonegrinder: wer zuerst ersetzt, entscheidet, ob man zieht (Regelfrage)
// Kartentext (Vacarn): „Creatures in this Hero's Support Zones that are defeated are deleted."
// Kartentext (The Bonegrinder): „Up to 5 times per turn, when a "Skeleton" Creature would be sent to your discard pile, you may delete it to draw 1 card."
// Aufbau: Vacarn als Held 0, The Bonegrinder in der Area; ein Skelett in Vacarns Zonen und eines in der Zone eines anderen Helden werden besiegt.
// Beobachtet: Das Skelett in Vacarns Zone wird gelöscht, OHNE dass die Bonegrinder fragt/zieht (Vacarns Hook setzt `_redirectToDeleted`, Bonegrinder bricht dann ab);
//   das Skelett in der anderen Zone wird gefragt und zieht.
// Lesart A (Skript): Vacarn ersetzt zuerst, Bonegrinder hat nichts mehr zu tun. Lesart B: der Spieler darf Bonegrinder wählen (Löschen UND Ziehen), die Löschung ist dasselbe Ergebnis.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ heroes: [['Vacarn, the Dark Goblin Necromancer', 'Rick, the Trigger Happy Undertaker', 'Zwei, the Lucky Thief'], []] });
  t.putArea(0, 'The Bonegrinder');
  const a = t.put(0, 0, 0, 'Skeleton Archer'); a.turnPlayed = 1;
  let fragen = 0;
  t.script.push({ match: d => d.type === 'confirm' && d.title === 'The Bonegrinder', answer: () => { fragen++; return { confirmed: true }; } });
  const h0 = t.pile(0, 'hand').length;
  await t.run(() => t.engine.actionDestroyCard({ name: 'x', owner: 1 }, a));
  R.check('Kontrolle: Skelett in Vacarns Zone gelöscht', t.pile(0, 'deletedPile').includes('Skeleton Archer'), t.pile(0, 'deletedPile'));
  R.check('Lesart B: Bonegrinder darf trotzdem fragen/ziehen', fragen === 1 && t.pile(0, 'hand').length === h0 + 1, { fragen, hand: t.pile(0, 'hand').length - h0 });
  R.finish();
})();
