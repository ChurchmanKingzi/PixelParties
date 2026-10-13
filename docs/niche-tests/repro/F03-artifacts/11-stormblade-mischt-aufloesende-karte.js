'use strict';
// F03-artifacts-11 · The Stormblade: die gerade aufgelöste gegnerische Karte wird mit der „entire hand" ins Deck gemischt (Gegner +1 Karte, Zauber nie in der Ablage)
// Kartentext: „Whenever your opponent hits the equipped Hero with a card or effect, they must shuffle their entire hand back into their deck and draw the same number of cards afterwards."
// Regel (CARD_API.md Z. ~19870, Engine `_handOhneAufloesendeKarte`/`_istAufloesendeHandkarte`, v1405): die Karte, die gerade gespielt/aufgelöst wird, zählt nicht zur Hand.
// Aufbau: Sitz 0 rüstet The Stormblade an Held 0 aus. Sitz 1 hat [Fireball, Bird, Bird, Bird] und trifft Held 0 mit dem Fireball (Deck 20).
// Erwartung: Der Sturm mischt die 3 Birds und zieht 3; der Fireball landet danach regulär in der Ablage ⇒ Hand 3, Ablage [Fireball], Fireball nicht im Deck.
// Beobachtet (✗): Der Sturm mischt 4 Karten (inkl. des Fireballs, der noch in `ps.hand` liegt) und zieht 4 ⇒ Hand 4, Ablage leer, Fireball liegt im Deck (Gegner hat +1 Karte,
//   der Zauber ist nicht abgelegt und kann wieder gezogen werden).
// Ursache: `cards/effects/the-stormblade.js` sturmzyklus (Z. ~120–135) nimmt `engine.shuffleBackEligibleHandSlots(pi)` = alle Handplätze; die auflösende Handkarte (`ps._resolvingCard`)
//   wird nicht ausgenommen (Helfer `engine._handOhneAufloesendeKarte`, _engine.js ~19638, existiert; Bubbles the Bouncy Bunny / Live Show nutzen ihn). Der Server findet danach keinen Handplatz mehr
//   und überspringt die Ablage (`doPlaySpell`-Nachlauf).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['The Stormblade'], ['Fireball', 'Bird', 'Bird', 'Bird']], deckSize: 20 });
  await t.play(0, 'The Stormblade', { hero: 0, slot: 0 });
  t.targetFn = (valid) => { const v = valid.find(v => v.type === 'hero' && v.owner === 0 && v.heroIdx === 0); return v ? [v.id] : [valid[0].id]; };
  const r = await t.play(1, 'Fireball', { hero: 0 });
  const cnt = (arr, n) => arr.filter(x => x === n).length;
  const hand = t.pile(1, 'hand'), disc = t.pile(1, 'discardPile'), deck = t.pile(1, 'mainDeck');
  R.check('Aufbau: Fireball wurde gespielt und traf', r === true && t.hp(0, 0) < 800, { r, hp: t.hp(0, 0) });
  R.check('Hand hat 3 Karten (3 Birds gemischt, 3 gezogen)', hand.length === 3, hand);
  R.check('Fireball liegt in der Ablage', cnt(disc, 'Fireball') === 1, { disc });
  R.check('Fireball liegt nicht im Deck', cnt(deck, 'Fireball') === 0, { fireballInDeck: cnt(deck, 'Fireball') });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
