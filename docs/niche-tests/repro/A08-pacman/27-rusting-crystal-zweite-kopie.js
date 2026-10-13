// A08-27 · Rusting Crystal: eine zweite Kopie auf der Hand verdoppelt die Kosten der ersten nicht
//
// Kartentext: „While this card is in your hand, the Costs of all your other Artifacts are doubled. This effect does not stack with itself."
// Aufbau: Sitz 0 hält 1 bzw. 2 Rusting Crystal (Kosten 15) und spielt eine davon mit 15 bzw. 30 Gold.
// Lesart A (wörtlich): die zweite Kopie ist ein „anderes Artefakt" der ersten ⇒ Kosten 30 (nicht gestapelt: nicht 60).
// Lesart B (Engine heute): der Kristall zählt nie auf sich selbst/Kopien ⇒ 15.
// Beobachtet: 2 Kopien, 15 Gold ⇒ die Kopie wird gespielt (Gold 0). Lesart A würde sie ablehnen.
// Aufruf: node docs/niche-tests/repro/A08-pacman/27-rusting-crystal-zweite-kopie.js   (✗ = Lesart A verletzt)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [[], []], gold: [15, 100] });
  t.engine.handZugangSync(0, 'Rusting Crystal'); t.engine.handZugangSync(0, 'Rusting Crystal');
  const r = await t.play(0, 'Rusting Crystal', {});
  R.note('zwei Kopien, 15 Gold', JSON.stringify({ play: r, gold: t.gs.players[0].gold, hand: t.pile(0, 'hand') }));
  R.check('zwei Kopien: die zweite verdoppelt die Kosten der ersten (15 Gold reichen nicht)', r === false, { play: r, gold: t.gs.players[0].gold });
  R.finish();
})();
