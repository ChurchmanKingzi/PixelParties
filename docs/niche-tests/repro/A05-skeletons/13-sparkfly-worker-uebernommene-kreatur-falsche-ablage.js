'use strict';
// A05-skeletons-13 · Sparkfly Worker: dauerhaft übernommene Fremdkreatur wird auf die Hand genommen und als MEINE Karte etikettiert → landet in meiner Ablage
// Kartentext (Sparkfly Worker): „… choose a card on the board that is not a Hero and add it to your hand."
// Ruling (CARD_API v1224/„GESTOHLENE KARTEN GEHEN IN DIE ABLAGE IHRES BESITZERS", Liste der getaggten Karten nennt „Sparkfly"): die Karte kehrt in Ablage/Deck
//   des URSPRÜNGLICHEN Besitzers (deck-seitige Identität = `originalOwner`) zurück; Brett-Übernahmen laufen über das bei der Erstellung eingefrorene `originalOwner`.
// Aufbau: Seite 1 besitzt eine Kreatur; Seite 0 übernimmt sie dauerhaft (`actionTransferCreature` ⇒ owner = 0, originalOwner = 1). Worker nimmt sie auf die Hand.
// Erwartung: Handinstanz trägt originalOwner = 1; beim Abwerfen landet die Karte in der Ablage von Seite 1.
// Beobachtet: originalOwner = 0 → die Karte landet in Ablage von Seite 0.
// Ursache: `_sparkfly-shared.js:stealBoardCardToHand` setzt `newInst.originalOwner = targetInst.owner` statt `targetInst.originalOwner ?? targetInst.owner`.
//   Die Königin-Gabe des Workers nutzt dieselbe Funktion.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Sparkfly Worker'], []] });
  t.setAbilities(0, 0, [['Summoning Magic'], [], []]);
  const q = t.put(0, 0, 1, 'Sparkfly Queen'); q.turnPlayed = 1;
  const fremd = t.put(1, 0, 0, H.INERT.big);
  await t.run(() => t.engine.actionTransferCreature(fremd, 0, 2, 2, { skipAnimation: true, sourceName: 'test' }));
  R.check('Aufbau: deck-seitige Identität der übernommenen Kreatur ist Seite 1', fremd.originalOwner === 1, fremd.originalOwner);
  t.targetFn = (valid) => { const v = valid.find(x => x.cardName === H.INERT.big); return [v ? v.id : valid[0].id]; };
  await t.play(0, 'Sparkfly Worker', { hero: 0, slot: 0 });
  const idx = t.pile(0, 'hand').indexOf(H.INERT.big);
  R.check('Kontrolle: Karte liegt in meiner Hand', idx >= 0, t.pile(0, 'hand'));
  await t.run(() => t.engine.actionDiscardHandCard(0, H.INERT.big, idx, {}));
  R.check('beim Abwerfen landet die Karte in der Ablage ihres ursprünglichen Besitzers (Seite 1)', t.pile(1, 'discardPile').includes(H.INERT.big) && !t.pile(0, 'discardPile').includes(H.INERT.big), { ablage0: t.pile(0, 'discardPile'), ablage1: t.pile(1, 'discardPile') });
  R.finish();
})();
