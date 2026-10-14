'use strict';
// W5b-Z4 (zu S03-24) · „Draw until you have 7": Voice in your Head, Supply Chain, Kazena, Populated Island Turtle – Entscheidung Al (Welle 5):
//   „Unter Handsperre/Ziehsperre ist Voice negiert und *nicht* spielbar. Bei Artis [Tuscan Artist: 'any effect that would allow your opponent to draw 2 or 3 cards is negated']
//    nur, wenn sie exakt 2 oder 3 Karten ziehen würde (dasselbe für Supply Chain, Kazena und ähnliche Effekte)."
// Erwartung: gegen Tuscan Artist auf der Gegnerseite nicht spielbar/aktivierbar nur bei einer Ziehmenge von genau 2 oder 3; bei 1 und ≥ 4 spielbar. Hand-/Zieh-Sperre: nie spielbar.
const H = require('../../lib/h.js');
const F = H.INERT.filler;
(async () => {
  const R = H.runner();
  // Voice: die Karte selbst liegt in der Hand (zählt mit): Hand = 1 + n Füller -> Ziehmenge = 7 - n
  for (const n of [3, 4, 5, 6]) {
    const menge = 7 - n;
    const t = await H.fresh({ hand: [['Voice in your Head', ...Array(n).fill(F)], []], hp: 800, deckSize: 30 });
    t.setHero(0, 0, 'Arthor, Inheritor of the Barbarian Sword', 600);
    t.put(1, 0, 0, 'Tuscan Artist');
    const r = await t.play(0, 'Voice in your Head', { hero: 0 });
    const gesperrt = menge === 2 || menge === 3;
    R.check(`Voice gegen Tuscan Artist (Ziehmenge ${menge}): ${gesperrt ? 'nicht spielbar' : 'spielbar'}`, gesperrt ? (r === false && t.pile(0, 'hand').includes('Voice in your Head')) : (r === true && t.errors.length === 0), { r, hand: t.pile(0, 'hand').length });
  }
  for (const lock of ['handLocked', 'drawLocked']) {
    const t = await H.fresh({ hand: [['Voice in your Head', F], []], hp: 800, deckSize: 30 });
    t.setHero(0, 0, 'Arthor, Inheritor of the Barbarian Sword', 600);
    t.gs.players[0][lock] = true;
    const r = await t.play(0, 'Voice in your Head', { hero: 0 });
    R.check(`Voice unter ${lock}: nicht spielbar`, r === false && t.pile(0, 'hand').includes('Voice in your Head'), { r });
  }
  // Kazena (Heldeneffekt): Hand 4 => zieht 3 (gesperrt), Hand 6 => zieht 1 (frei), Hand 2 => zieht 5 (frei)
  for (const [n, gesperrt] of [[4, true], [5, true], [6, false], [2, false]]) {
    const t = await H.fresh({ heroes: [['Kazena, the Storming Rebel', H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], hand: [Array(n).fill(F), []], hp: 800, deckSize: 30 });
    t.put(1, 0, 0, 'Tuscan Artist');
    const vorher = t.pile(0, 'hand').length;
    await t.activateHero(0, 0, {});
    const gezogen = t.pile(0, 'hand').length - vorher;
    R.check(`Kazena gegen Tuscan Artist (Ziehmenge ${7 - n}): ${gesperrt ? 'nicht aktivierbar' : 'zieht'}`, gesperrt ? gezogen === 0 : gezogen === 7 - n, { gezogen });
  }
  R.finish();
})();
