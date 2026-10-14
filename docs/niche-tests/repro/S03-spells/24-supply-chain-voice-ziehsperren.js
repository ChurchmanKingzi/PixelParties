'use strict';
// S03-24 · Supply Chain (und Voice in your Head): reine Zieh-Karten sind unter Hand-/Zieh-Sperre und gegen Tuscan Artist spielbar und verpuffen
// Kartentext: Supply Chain „Draw until you have 7 cards in your hand."; Voice in your Head „Draw until you have 7 cards in your hand. This counts as an additional Action."
// Regeln: CARD_API.md ~Z. 1944 („Draw-only unter Hand-Sperre" ⇒ GAR NICHT spielbar, Präzedenz `blockedByHandLock`: Brilliant Idea, Graveyard Gathering …);
//   `_draw-block-shared.js` Ruling 16.8.: „Ist der Zug der einzige Nutzen … ist die Karte GESPERRT und wird ausgegraut. … verbraucht auch sein Once-per-turn NICHT."
//   (Tuscan Artist: Ziehen von genau 2 oder 3 Karten wird negiert.)
// Aufbau: (a) `ps.handLocked = true` bzw. `drawLocked = true` (z. B. nach Rain of Spores); (b) Tuscan Artist auf Sitz 1, Hand so, dass 2 bzw. 3 Karten zu ziehen wären.
// Erwartet: Karte nicht spielbar (`play` ⇒ false, bleibt auf der Hand).
// Beobachtet: `play` ⇒ true, Karte in der Ablage, nichts gezogen (Brilliant Idea als Kontrolle ist unter handLocked nicht spielbar).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const lock of ['handLocked', 'drawLocked']) {
    const t = await H.fresh({ hand: [['Supply Chain', H.INERT.filler], []], hp: 800, deckSize: 30 });
    t.gs.players[0][lock] = true;
    const r = await t.play(0, 'Supply Chain', { hero: 0 });
    R.check(`Supply Chain unter ${lock}: nicht spielbar`, r === false && t.pile(0, 'hand').includes('Supply Chain'), { r, ablage: t.pile(0, 'discardPile') });
  }
  {
    const t = await H.fresh({ hand: [['Brilliant Idea', H.INERT.filler], []], hp: 800, deckSize: 30 });
    t.gs.players[0].handLocked = true;
    const r = await t.play(0, 'Brilliant Idea', { hero: 0 });
    R.note('Kontrolle Brilliant Idea unter handLocked', { r });
  }
  for (const fill of [4, 5]) {   // 3 bzw. 2 Karten zu ziehen
    const t = await H.fresh({ hand: [['Supply Chain', ...Array(fill).fill(H.INERT.filler)], []], hp: 800, deckSize: 30 });
    t.put(1, 0, 0, 'Tuscan Artist');
    const r = await t.play(0, 'Supply Chain', { hero: 0 });
    R.check(`Supply Chain gegen Tuscan Artist (Ziehen von ${7 - fill}): nicht spielbar`, r === false && t.pile(0, 'hand').includes('Supply Chain'), { r, hand: t.pile(0, 'hand').length, ablage: t.pile(0, 'discardPile') });
  }
  for (const lock of ['handLocked', 'drawLocked']) {
    const t = await H.fresh({ hand: [['Voice in your Head', H.INERT.filler], []], hp: 800, deckSize: 30 });
    t.setHero(0, 0, 'Arthor, Inheritor of the Barbarian Sword', 600);
    t.gs.players[0][lock] = true;
    const r = await t.play(0, 'Voice in your Head', { hero: 0 });
    R.check(`Voice in your Head unter ${lock}: nicht spielbar (Regel von Al: Zug + Zusatzaktion = reiner Zieher)`, r === false, { r, ablage: t.pile(0, 'discardPile') });
  }
  R.finish();
})();
