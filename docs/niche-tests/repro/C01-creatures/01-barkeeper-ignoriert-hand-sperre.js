'use strict';
// C01-creatures-01 · Barkeeper fuellt die Hand auch unter Hand-/Such-Sperre auf
// Kartentext (Barkeeper): „When you summon this Creature, you may add copies of "Beer" from outside the game to your hand until your hand contains 7 cards."
// Kartentext (Cats of the Pharaoh): „… if you do, you cannot search or add cards to your hand for the rest of the turn afterwards (but you can still draw)."
// Kartentext (Ice Sculpture Garden / Kazena / Navigation / Rain of Spores): „You cannot draw or add cards to your hand for the rest of the turn afterwards." (= ps.handLocked)
// Aufbau: Teil A echter Spielweg: Cats liegt in der Ablage, Sitz 0 ohne Kreatur; Sitz 1 beendet den Zug -> Cats-Angebot (Ja) -> ps.searchLocked.
//   Danach spielt Sitz 0 den Barkeeper (Hand: Barkeeper + Fueller). Teil B: ps.handLocked = true (genau das setzt ctx.lockHand()), Barkeeper spielen.
// Erwartung: Unter der Sperre kommen KEINE Beer auf die Hand („add cards to your hand" ist gesperrt).
// Beobachtet: Hand wird in beiden Faellen auf 7 aufgefuellt (5-6 Beer).
// Ursache: cards/effects/barkeeper.js:88 ruft `engine.handZugangSync(...)` ohne `engine.handZugangGesperrt(pi)` / `_isSearchBlocked(...)`;
//   die Engine delegiert die Hand-Sperre ausdruecklich an den Aufrufer (_engine.js ~11624).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  R.section('A) Cats of the Pharaoh -> searchLocked, dann Barkeeper');
  {
    const t = await H.fresh({ active: 1, discard: [['Cats of the Pharaoh'], []], abilities: { 0: { 0: [['Summoning Magic'], [], []] } },
      hand: [['Barkeeper', H.INERT.filler], []] });
    const ps = t.gs.players[0];
    await t.endTurn();
    R.check('Vorbedingung: Cats beschworen, searchLocked gesetzt', ps.searchLocked === true && t.find('Cats of the Pharaoh', 'support'), { s: ps.searchLocked });
    const handVor = ps.hand.length;
    await t.play(0, 'Barkeeper');
    const beer = ps.hand.filter(n => n === 'Beer').length;
    R.check('Barkeeper fuegt unter searchLocked keine Beer hinzu', beer === 0, { beer, handVor, handNach: ps.hand.length });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.section('B) handLocked (z. B. nach Ice Sculpture Garden)');
  {
    const t = await H.fresh({ hand: [['Barkeeper', H.INERT.filler], []] });
    const ps = t.gs.players[0];
    ps.handLocked = true;
    await t.play(0, 'Barkeeper');
    const beer = ps.hand.filter(n => n === 'Beer').length;
    R.check('Barkeeper fuegt unter handLocked keine Beer hinzu', beer === 0, { beer, hand: ps.hand.length });
  }
  R.finish();
})();
