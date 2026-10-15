'use strict';
// W10b · Q32 (A05-15) · Vacarn + The Bonegrinder: Vacarns Löschen verdrängt das Bonegrinder-Ziehen (gewollt, Absicherung)
//
// Kartentext (Vacarn): „Creatures in this Hero's Support Zones that are defeated are deleted."
// Kartentext (The Bonegrinder): „Up to 5 times per turn, when a "Skeleton" Creature would be sent to your discard pile, you may delete it to draw 1 card."
// ENTSCHIEDEN (Al, Welle 10, Q32): „Nein" → The Bonegrinder zieht NICHT, wenn Vacarn das Skelett ohnehin löscht.
// Geprüft: (a) Skelett in Vacarns Zone: gelöscht, keine Bonegrinder-Frage, keine Karte gezogen; (b) Kontrolle: Skelett in der Zone eines anderen Helden:
//   Bonegrinder fragt, löscht und zieht 1.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ heroes: [['Vacarn, the Dark Goblin Necromancer', 'Rick, the Trigger Happy Undertaker', 'Zwei, the Lucky Thief'], []] });
  t.putArea(0, 'The Bonegrinder');
  const a = t.put(0, 0, 0, 'Skeleton Archer'); a.turnPlayed = 1;
  const b = t.put(0, 1, 0, 'Skeleton Archer'); b.turnPlayed = 1;
  let fragen = 0;
  t.script.push({ match: d => d.type === 'confirm' && d.title === 'The Bonegrinder', answer: () => { fragen++; return { confirmed: true }; } });
  const h0 = t.pile(0, 'hand').length;
  await t.run(() => t.engine.actionDestroyCard({ name: 'x', owner: 1 }, a));
  R.check('(a) Skelett in Vacarns Zone gelöscht', t.pile(0, 'deletedPile').includes('Skeleton Archer'), t.pile(0, 'deletedPile'));
  R.check('(a) Bonegrinder fragt nicht und zieht nicht', fragen === 0 && t.pile(0, 'hand').length === h0, { fragen, hand: t.pile(0, 'hand').length - h0 });
  await t.run(() => t.engine.actionDestroyCard({ name: 'x', owner: 1 }, b));
  R.check('(b) Kontrolle: Skelett bei anderem Helden – Bonegrinder fragt und zieht 1', fragen === 1 && t.pile(0, 'hand').length === h0 + 1, { fragen, hand: t.pile(0, 'hand').length - h0 });
  R.check('keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
