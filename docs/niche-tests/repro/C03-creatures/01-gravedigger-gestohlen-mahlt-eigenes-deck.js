'use strict';
// C03-creatures-01 · Gravedigger (gestohlen): der Dieb mahlt sein EIGENES Deck statt das des Gegners
// Kartentext: „You may once per turn send the top card of your opponent's deck to the discard pile."
// Aufbau: Sitz 0 besitzt Gravedigger (Held 0 / Slot 0, „alt"); Sitz 1 stiehlt ihn (actionStealCreature, Weg wie Lovely Teddy / Deepsea Succubus)
//   und aktiviert ihn (charmedOwner = Brettseite 0). Decks: Sitz 0 = 20× Fireball, Sitz 1 = 20× Slow.
// Erwartung: „your opponent" = Gegner des KONTROLLEURS (Sitz 1) = Sitz 0 → Deck von Sitz 0 verliert 1 Karte, Deck von Sitz 1 bleibt voll.
// Beobachtet: Deck von Sitz 1 (dem Dieb!) verliert die Karte, Deck von Sitz 0 bleibt unberührt.
// Ursache: cards/effects/gravedigger.js onCreatureEffect: `pi = engine.physicalSide(ctx.card) ?? ctx.cardOwner` – physicalSide() einer geliehenen
//   Kreatur ist der BESITZER (0); `oi = opponentOf(pi)` ergibt damit den Kontrolleur selbst. Richtig wäre `ctx.cardOwner` (Kontrolleur).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ deck: [Array(20).fill('Fireball'), Array(20).fill('Slow')] });
  const gd = t.put(0, 0, 0, 'Gravedigger'); gd.turnPlayed = 1;
  t.engine.actionStealCreature(1, gd);
  t.gs.activePlayer = 1; t.phase(2);
  const r = await t.run(() => t.host.doActivateCreatureEffect(t.room, 1, { heroIdx: 0, zoneSlot: 0, charmedOwner: 0 }));
  R.check('Aktivierung durch den Dieb wurde behandelt', r === true, r);
  R.check('Deck des GEGNERS (Sitz 0) verliert 1 Karte', t.pile(0, 'mainDeck').length === 19, t.pile(0, 'mainDeck').length);
  R.check('Deck des Diebes (Sitz 1) bleibt unberührt', t.pile(1, 'mainDeck').length === 20, t.pile(1, 'mainDeck').length);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
