'use strict';
// S02-21 · Haste (reine Zieh-Karte) ist unter Zieh-/Hand-Sperre spielbar und verpufft – gegen Tuscan Artist dagegen korrekt gesperrt
// Haste: „Draw 2/3/4 cards."
// Regel (CARD_API.md ~Z. 1944 „Draw-only unter Hand-Sperre ⇒ GAR NICHT spielbar"; `_draw-block-shared.js` Ruling 16.8.: Karten, deren Zug der einzige Nutzen ist, sind gesperrt/ausgegraut).
// Aufbau: Hand [Haste, 2 Füllkarten], Deck 30; (a) `ps.drawLocked = true` (Sacred Jewel), (b) `ps.handLocked = true` (Rain of Spores), (c) Kontrolle: Tuscan Artist auf Sitz 1 + Support Magic 1 (Zug von genau 2).
// Erwartet: in (a)/(b) ist Haste nicht spielbar (`play` ⇒ false, Karte bleibt auf der Hand, Aktion bleibt frei).
// Beobachtet: (a)/(b) `play` ⇒ true, Haste in der Ablage, nichts gezogen, Aktion verbraucht; (c) gesperrt ✓ (`haste.js` canPlayWithHero ruft nur `drawWouldBeBlocked`).
// Ursache: `haste.js` Z. 20–26 prüft nur Tuscan Artist; kein `blockedByHandLock` (der Loader markiert nur `resolve`-Module automatisch, `_loader.js` ~Z. 442) – gleiche Klasse wie S03-24.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const lock of ['drawLocked', 'handLocked']) {
    const t = await H.fresh({ hand: [['Haste', H.INERT.filler, H.INERT.filler], []], deckSize: 30 });
    t.gs.players[0][lock] = true;
    const r = await t.play(0, 'Haste', { hero: 0 });
    R.check(`Haste unter ${lock}: nicht spielbar, Karte bleibt auf der Hand`, r === false && t.pile(0, 'hand').includes('Haste'), { ret: r, hand: t.pile(0, 'hand'), ablage: t.pile(0, 'discardPile') });
  }
  {
    const t = await H.fresh({ hand: [['Haste', H.INERT.filler], []], deckSize: 30 });
    t.put(1, 0, 0, 'Tuscan Artist');
    const r = await t.play(0, 'Haste', { hero: 0 });
    R.check('Kontrolle: Haste (Zug von genau 2) gegen Tuscan Artist gesperrt', r === false, r);
  }
  R.finish();
})();
