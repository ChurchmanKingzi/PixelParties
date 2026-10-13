'use strict';
// F03-artifacts-01 · The White Eye kehrt beim Heldentod nicht auf die Hand zurück
// Kartentext: „When this card is sent to your discard pile, except because you discarded it from your hand, add it to your hand immediately."
// Erwartung: Stirbt der ausgerüstete Held, wird die Ausrüstung in die Ablage gelegt (handleHeroDeathCleanup) – das ist „sent to your discard pile"
//   (nicht „discarded from your hand") → The White Eye landet auf der Hand (wie bei Zerstörung per Effekt, Kontrollprobe A).
// Beobachtet: Kontrollprobe A ✓ (Zerstörung → Hand). Heldentod ✗: die Karte liegt in der Ablage, die Hand bleibt leer.
// Ursache: `cards/effects/the-white-eye.js` onCardLeaveZone verlangt `ctx.toZone === 'discard'`; der Heldentod-Abbau (`_engine.js` handleHeroDeathCleanup ~47650)
//   ruft den Hook OHNE `toZone` und schiebt die Karte selbst in `discardPile` (kein `_returnToHand`-Pfad wie in `actionMoveCard` ~13482).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const WE = 'The White Eye';
  // A) Kontrollprobe: Zerstörung per Effekt
  let t = await H.fresh({ hand: [[WE], []] });
  await t.play(0, WE, { hero: 0, slot: 0 });
  await t.run(() => t.engine.actionDestroyCard({ name: 'Test', owner: 1, heroIdx: 0 }, t.find(WE, 'support')));
  R.check('A) Zerstörung per Effekt: White Eye auf der Hand', t.pile(0, 'hand').includes(WE), { hand: t.pile(0, 'hand'), ablage: t.pile(0, 'discardPile') });
  // B) Heldentod
  t = await H.fresh({ hand: [[WE], []] });
  await t.play(0, WE, { hero: 0, slot: 0 });
  await t.run(() => t.engine.actionDealDamage({ name: 'Test', owner: 1, heroIdx: 0 }, t.hero(0, 0), 5000, 'creature'));
  R.check('Aufbau: Träger-Held ist tot', t.hp(0, 0) <= 0, t.hp(0, 0));
  R.check('B) Heldentod: White Eye auf der Hand statt in der Ablage', t.pile(0, 'hand').includes(WE), { hand: t.pile(0, 'hand'), ablage: t.pile(0, 'discardPile') });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
