'use strict';
// A05-skeletons-21 · Skeleton Demon: Schaden richtet sich nach der angesagten, nicht nach der tatsächlich gezogenen Kartenzahl
// Kartentext (Skeleton Demon): „Whenever your opponent draws or adds cards to their hand with one of their own effects while you control this Creature,
//   you may choose a target and deal 50 damage times the number of cards to it."
// Aufbau: Seite 0 hat Skeleton Demon; Seite 1 hat Skeleton Mage („draw 2 cards and discard 1"). (a) Gegner-Deck hat nur 1 Karte, (b) Gegner-Deck ist leer.
// Erwartung: (a) 50 Schaden (1 Karte gezogen), (b) kein Auslöser (0 Karten gezogen).
// Beobachtet: (a) 100 Schaden, (b) 100 Schaden.
// Ursache: `skeleton-demon.js` `beforeDrawBatch` → `offerDamage(ctx, ctx.amount)` – die Zahl stammt aus der Ansage vor dem Ziehen und wird nicht gegen die echte Ziehmenge (Deckgröße/Sperren) gekürzt.
const H = require('../../lib/h.js');
async function lauf(deck) {
  const t = await H.fresh({ hand: [[], ['ZZ Filler']], deck: [[], deck] });
  const d = t.put(0, 0, 0, 'Skeleton Demon'); d.turnPlayed = 1;
  const mage = t.put(1, 0, 0, 'Skeleton Mage'); mage.turnPlayed = 1;
  t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1).id];
  t.script.push({ match: x => x.type === 'forceDiscard' || x.type === 'forceDiscardCancellable', answer: () => ({ handIndex: 0 }) });
  const hp = t.hp(1, 0);
  t.gs.activePlayer = 1; t.phase(2);
  await t.activateCreature(1, 0, 0);
  return hp - t.hp(1, 0);
}
(async () => {
  const R = H.runner();
  R.check('(a) Deck mit 1 Karte: 50 Schaden', (await lauf([H.INERT.creature])) === 50);
  R.check('(b) leeres Deck: kein Schaden', (await lauf([])) === 0);
  R.finish();
})();
