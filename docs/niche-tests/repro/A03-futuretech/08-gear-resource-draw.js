'use strict';
// A03-futuretech-08 · Future Tech Gear: mahlt schon beim normalen Zug-Ziehen des Gegners (nicht „via an effect“)
//
// Kartentext: „The first time every turn when your opponent draws or adds a card from their deck to their hand **via an effect**, they must send
//   cards equal to twice the number of "Future Tech Gear" in your discard pile from the top of their deck to the discard pile.“
// Konvention: das Ziehen der Ressourcen-Phase trägt `_isResourceDraw` und zählt nicht als „via an effect“ (Cute Meanie Melissa Z. 34,
//   Dirty Smuggler Z. 45, Analyzer/Gatherer, Albrecht überspringen es; CARD_API.md ~7486).
// Erwartung: Das Pflicht-Ziehen von Sitz 1 zu Zugbeginn mahlt nichts (Deck 20 → 19, Ablage 0); erst das erste Effekt-Ziehen danach mahlt 2.
// Beobachtet: schon das Pflicht-Ziehen löst die Gear aus (Deck 15 = 1 gezogen + 4 gemahlen), und die Rundensperre ist damit verbraucht –
//   ein späteres echtes Effekt-Ziehen im selben Zug mahlt nichts mehr.
// Ursache: cards/effects/future-tech-gear.js `ausloesen()` (Z. 109 ff.; Hooks Z. 103-104 `onCardAddedToHand`/`onDraw`) prüft `ctx._isResourceDraw` nicht.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const GEAR = 'Future Tech Gear';
  const t = await H.fresh({ discard: [[GEAR, GEAR], []], deck: [Array(20).fill(H.INERT.creature), Array(20).fill('Fireball')], gold: 100 });
  t.put(0, 0, 0, GEAR);
  await t.endTurn();                                   // Sitz 1 beginnt: Pflicht-Ziehen der Ressourcen-Phase
  R.check('Zugbeginn von Sitz 1: Pflicht-Ziehen mahlt nichts (Ablage 0, Deck 19, Hand 1)',
    t.pile(1, 'discardPile').length === 0 && t.pile(1, 'mainDeck').length === 19 && t.pile(1, 'hand').length === 1,
    { ablage: t.pile(1, 'discardPile').length, deck: t.pile(1, 'mainDeck').length, hand: t.pile(1, 'hand').length });
  const vorher = t.pile(1, 'discardPile').length;
  await t.run(() => t.engine.actionDrawCards(1, 1, { source: 'Test' }));      // erstes echtes Effekt-Ziehen dieses Zugs
  R.check('erstes Effekt-Ziehen danach mahlt 4 Karten (2 × 2 Gear in der Ablage)', t.pile(1, 'discardPile').length - vorher === 4, { gemahlen: t.pile(1, 'discardPile').length - vorher });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
