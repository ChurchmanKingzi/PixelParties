'use strict';
// C01-creatures-13 · 500 Piranhas: das Opfer ersetzt sich in derselben Zone (Cute Bird -> Cute Phoenix) – Piranhas bleibt auf der Hand, das Opfer ist trotzdem verloren
// Kartentext: „Choose a Creature your opponent controls and defeat it to play this card. Place this Creature into the Support Zone the defeated Creature occupied. …
//   Playing this card does not cost an Action, but you can only play 1 „500 Piranhas in a Monster Suit" per turn."
// Kartentext Cute Bird: „When this Creature is defeated, you may discard 2 cards from your hand to immediately place a „Cute Phoenix" from your deck into the same Support Zone."
// Aufbau: Seed 1234. Sitz 0: Hand [Piranhas]. Sitz 1: Cute Bird in Held 0 / Zone 0, Hand 3 Karten, Deck mit Cute Phoenix oben. Sitz 1 sagt Ja und wirft 2 Karten ab.
// Erwartung (unsicher, Stufe C): Entweder (a) die Karte lässt sich nicht spielen, ohne das Opfer zu verlieren (die Wahl verlangt eine Zone, die frei bleibt), oder (b) die Piranhas wird nach der
//   Ersetzung trotzdem irgendwo hingelegt/abgelegt. Das Skript wählt (c): Opfer besiegt (Bird in der Ablage, Phoenix bekommt den Platz), Piranhas bleibt auf der Hand, Einmal-pro-Zug nicht gestempelt.
// Beobachtet: (c). Kein Fehler, keine Engine-Meldung; das Skript loggt `piranhas_fizzle: slot_reoccupied` und sagt im Quelltext „fizzle without claiming the HOPT".
// Ursache/Stelle: cards/effects/500-piranhas-in-a-monster-suit.js Z. ~178-189 (Zone nach dem Besiegen wieder belegt).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const P = '500 Piranhas in a Monster Suit';
  const t = await H.fresh({ hand: [[P], ['ZZ Filler', 'ZZ Filler', 'ZZ Filler']], deck: [[], ['Cute Phoenix', 'ZZ Filler', 'ZZ Filler']] });
  const gs = t.gs, ps = gs.players[0];
  t.put(1, 0, 0, 'Cute Bird');
  t.targetFn = (valid) => [valid.find(v => v.cardName === 'Cute Bird').id];
  t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
  t.script.push({ match: d => d.type === 'handPick' || d.type === 'multiHandPick', answer: () => ({ selectedCards: [{ handIndex: 0, cardName: 'ZZ Filler' }, { handIndex: 1, cardName: 'ZZ Filler' }] }) });
  await t.play(0, P);
  const bird = gs.players[1].discardPile.includes('Cute Bird');
  const phoenix = !!t.find('Cute Phoenix', 'support');
  const pir = !!t.find(P, 'support');
  R.note('Ausgang', { vogelBesiegt: bird, phoenixImPlatz: phoenix, piranhasAufBrett: pir, piranhasInHand: ps.hand.includes(P) });
  R.check('Opfer besiegt  =>  Piranhas ist gespielt (auf dem Brett oder zumindest nicht mehr in der Hand liegen geblieben)', !bird || pir || !ps.hand.includes(P), { bird, pir, hand: ps.hand });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
