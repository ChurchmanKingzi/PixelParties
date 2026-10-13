'use strict';
// S03-26 · Shooting Star unter Stab-Sperre (`_discardLockedTurn`) bzw. Hand-Sperre: spielbar, Karte verbraucht, nichts geholt
// Kartentext: „Choose a card from your discard pile and add it to your hand."
// Regeln: CARD_API.md ~Z. 1944 („Nur Stapel-Bewegung ⇒ GAR NICHT spielbar", Modul-Flag `blockedByPileLock`, Prüfung `engine.isPileLockedFor(pi)`);
//   Stab: „You cannot move cards out of your discard pile for the rest of the turn" (Staff of the Teleporter / of Uncontrollable Destruction, `ps._discardLockedTurn`).
// Aufbau: Ablage [Fireball, Meteor Crash], Hand [Shooting Star]; (a) Knight of Kings [B] + Rook + Board of Kings (Kontrolle), (b) `_discardLockedTurn = gs.turn`, (c) `handLocked = true`.
// Erwartet: in (b) und (c) nicht spielbar (`play` ⇒ false, Karte bleibt auf der Hand) – wie in (a).
// Beobachtet: (a) false ✓. (b)/(c): `play` ⇒ true, Shooting Star liegt in der Ablage, die Hand bleibt leer, die Aktion ist verbraucht.
//   Ursache (vermutet): `isPileLockedFor` (`_engine.js` ~Z. 2575 `pileOutAllowed` ×2) kennt nur die Brett-Sperre (Knight), nicht `_discardLockedTurn`; für handLocked fehlt `blockedByHandLock`
//   (der Loader taggt `hooks.onPlay`-Spells bewusst nicht, `_loader.js` ~Z. 456 – dort als Entscheidung für Al vermerkt).
const H = require('../../lib/h.js');
async function lauf(setup) {
  const t = await H.fresh({ hand: [['Shooting Star'], []], hp: 800, discard: [['Fireball', 'Meteor Crash'], []], deckSize: 10 });
  await setup(t);
  t.script.push({ match: d => d.type === 'cardGallery', answer: (d) => ({ cardName: d.cards[0].name }) });
  const r = await t.play(0, 'Shooting Star', { hero: 0 });
  return { t, r };
}
(async () => {
  const R = H.runner();
  {
    const { t, r } = await lauf(async t => { t.putArea(0, 'Board of Kings'); t.put(1, 0, 0, 'Knight of Kings [B]'); t.put(1, 0, 1, 'Rook of Kings [B]'); });
    R.check('(a) Kontrolle Knight of Kings [B]: nicht spielbar', r === false && t.pile(0, 'hand').includes('Shooting Star'), { r });
  }
  {
    const { t, r } = await lauf(async t => { t.gs.players[0]._discardLockedTurn = t.gs.turn; });
    R.check('(b) Stab-Sperre: nicht spielbar (Karte bleibt auf der Hand)', r === false && t.pile(0, 'hand').includes('Shooting Star'), { r, hand: t.pile(0, 'hand'), ablage: t.pile(0, 'discardPile') });
  }
  {
    const { t, r } = await lauf(async t => { t.gs.players[0].handLocked = true; });
    R.check('(c) Hand-Sperre: nicht spielbar (Karte bleibt auf der Hand)', r === false && t.pile(0, 'hand').includes('Shooting Star'), { r, hand: t.pile(0, 'hand'), ablage: t.pile(0, 'discardPile') });
  }
  R.finish();
})();
