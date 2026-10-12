'use strict';
// A04-cute-16 · Cute Bunny reagiert nicht auf die Mehrfach-Abwürfe von Cute Hydra und Cute Dog
//
// Kartentext (Cute Bunny): "Whenever you discard or delete 2 or more cards from your hand through an effect, draw 1 card." (und:
//   "You may immediately summon this Creature … from your hand when you discard or delete 2 or more cards at the same time from your hand.")
//   Cute Hydra: "When this Creature is summoned, discard 2 or more cards from your hand …"; Cute Dog: "discard up to 2 cards to search …"
// Erwartung: Bunny auf dem Brett zieht 1 Karte, wenn Hydra (≥ 2 Abwürfe) bzw. Dog (2 Abwürfe) ihre Abwurfkosten bezahlen – so wie bei
//   Cute Phoenix/Cute Bird (actionPromptForceDiscard) und Cute Annoyance Mini (withDiscardBatch), wo es funktioniert (Gegenprobe ✓).
// Beobachtet: Hydra und Dog werfen einzeln über `actionDiscardHandCard` in einer Schleife ab; kein Batch → Bunny sieht nichts.
// Ursache: cards/effects/cute-hydra.js (onPlay-Schleife) und cute-dog.js (onCreatureEffect-Schleife) umgeben die Abwürfe nicht mit
//   `engine.withDiscardBatch(...)` (Annoyance Mini tut das ausdrücklich für Bunny).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const wahl = (t) => t.script.push({ match: d => d.type === 'forceDiscard' || d.type === 'forceDiscardCancellable', answer: (d, pi, tt) => { const h = tt.pile(0, 'hand'); const i = h.indexOf(H.INERT.filler); return i >= 0 ? { cardName: h[i], handIndex: i } : { cancelled: true }; } });
  const deck = () => Array(10).fill(H.INERT.creature);

  let t = await H.fresh({ hand: [[H.INERT.filler, H.INERT.filler, H.INERT.filler], []], deck: [deck(), deck()] });
  t.put(0, 0, 0, 'Cute Bunny'); wahl(t);
  const h0 = t.pile(0, 'hand').length;
  await t.run(() => t.engine.actionPromptForceDiscard(0, 2, { source: 'Test', selfInflicted: true }));
  R.check('Gegenprobe actionPromptForceDiscard(2): Bunny zieht 1', t.pile(0, 'hand').length === h0 - 2 + 1, { vorher: h0, nachher: t.pile(0, 'hand').length });

  t = await H.fresh({ hand: [[H.INERT.filler, H.INERT.filler, H.INERT.filler], []], deck: [['Cute Phoenix', 'Cute Hydra', ...deck()], []] });
  t.put(0, 0, 0, 'Cute Bunny'); const dog = t.put(0, 0, 1, 'Cute Dog'); dog.turnPlayed = 0; wahl(t);
  t.script.push({ match: d => d.type === 'cardGalleryMulti', answer: (d) => ({ selectedCards: d.cards.slice(0, 2).map(c => c.name) }) });
  const h1 = t.pile(0, 'hand').length;
  t.gs.activePlayer = 0; t.phase(2);
  await t.activateCreature(0, 0, 1);
  R.check('Cute Dog (2 Abwürfe, 2 Suchkarten): Bunny zieht zusätzlich 1 (Hand = Start −2 +2 +1)', t.pile(0, 'hand').length === h1 + 1, { start: h1, jetzt: t.pile(0, 'hand').length, ablage: t.pile(0, 'discardPile').slice() });

  t = await H.fresh({ hand: [['Cute Hydra', H.INERT.filler, H.INERT.filler, H.INERT.filler, H.INERT.filler], []], deck: [deck(), deck()] });
  t.put(0, 0, 1, 'Cute Bunny');
  t.script.push({ match: d => d.type === 'forceDiscard', answer: (d, pi, tt) => { const h = tt.pile(0, 'hand'); const i = h.indexOf(H.INERT.filler); return { cardName: h[i], handIndex: i }; } });
  t.script.push({ match: d => d.type === 'forceDiscardCancellable', answer: () => ({ cancelled: true }) });   // „Done" nach den 2 Pflichtabwürfen
  const h2 = t.pile(0, 'hand').length;
  await t.play(0, 'Cute Hydra', { hero: 0, slot: 0 });
  const disc = t.pile(0, 'discardPile').filter(x => x === H.INERT.filler).length;
  R.check('Cute Hydra (2 Abwürfe): Bunny zieht 1 (Hand = Start −1 −Abwürfe +1)', t.pile(0, 'hand').length === h2 - 1 - disc + 1, { start: h2, abgeworfen: disc, jetzt: t.pile(0, 'hand').length });
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
