'use strict';
// A04-cute-07 · Cute Cat: Ablage aus dem Coolness Stack löst den Mill nicht aus
//
// Kartentext (Cute Cat): "The first time every turn a 'Cute Cat' is sent to the discard pile from anywhere, send the top 3 cards of
//   your deck to the discard pile."
// Erwartung: Cat wird von der Stack-Spitze in die Ablage geschickt (Coolness Overcharge wählt die Stack-Spitze) → Top 3 des Decks
//   gehen in die Ablage, wie bei Abwurf aus der Hand.
// Beobachtet: Hand-Abwurf mill 3 (Gegenprobe ✓), vom Coolness Stack kein Mill.
// Ursache: cards/effects/cute-cat.js `onDiscard` (Z. ~165) verlangt `ctx._fromHand`; `actionPopCoolnessStackTo(..,'discard')`
//   feuert ON_DISCARD mit `_fromCoolnessStack: true`, nicht mit `_fromHand`.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const fill = () => Array(7).fill(H.INERT.creature);
  let t = await H.fresh({ deck: [fill(), []] });
  t.putArea(0, 'Wowhalla, the Hall of the Cool');
  const ps = t.gs.players[0];
  for (const n of ['Cute Bunny', 'Cute Cat']) { ps.coolnessStack.push(n); t.engine._trackCard(n, 0, 'coolnessStack'); }
  const d0 = ps.mainDeck.length;
  await t.run(() => t.engine.actionPopCoolnessStackTo(0, 'discard', { source: 'Coolness Overcharge' }));
  R.check('Cat liegt in der Ablage', ps.discardPile.includes('Cute Cat'), ps.discardPile.slice());
  R.check('Mill 3 (Deck −3)', ps.mainDeck.length === d0 - 3, { vorher: d0, nachher: ps.mainDeck.length });
  t = await H.fresh({ hand: [['Cute Cat', H.INERT.filler], []], deck: [fill(), []] });
  const d1 = t.pile(0, 'mainDeck').length;
  await t.run(() => t.engine.actionDiscardHandCard(0, 'Cute Cat', 0, { source: 'Test' }));
  R.check('Gegenprobe: Abwurf aus der Hand → Mill 3', t.pile(0, 'mainDeck').length === d1 - 3, { vorher: d1, nachher: t.pile(0, 'mainDeck').length });
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
