'use strict';
// C03-creatures-20 · Moonlight Butterfly (dauerhaft gestohlen) – ENTSCHIEDEN von Al (14.10.2026, Welle 5): der Falter kommt auf die Hand des KONTROLLEURS, die 150 Schaden gehen auf den Helden gegenüber dem Kontrolleur
// Kartentext: „At the end of your opponent's turn, you may add this Creature you control back to your hand, and if you do,
//   deal 150 damage to the opponent's Hero in the same position as the corresponding Hero."
// Aufbau: Sitz 0: Falter (Held 1 / Slot 0, alt); Sitz 1 stiehlt ihn (actionStealCreature). Zugende von Sitz 0 (= Zug des Gegners des Kontrolleurs), Sitz 1 sagt Ja.
// Erwartung: Falter auf der Hand des Kontrolleurs (Sitz 1); „opponent's Hero in the same position" aus Sicht des Kontrolleurs = Held des Gegners (Sitz 0) in Position 1 → Sitz 0 Held 1 verliert 150;
//   der Falter bleibt Eigentum von Sitz 0 (wird er abgelegt → Ablage von Sitz 0, W3). Keine Engine-Fehler, Zustand sauber.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({});
  const b = t.put(0, 1, 0, 'Moonlight Butterfly'); b.turnPlayed = 1;
  t.engine.actionStealCreature(1, b);
  const hand = (s) => t.pile(s, 'hand').filter(n => n === 'Moonlight Butterfly').length;
  const h0 = [hand(0), hand(1)];
  await t.endTurn();                                  // Ende des Zuges von Sitz 0
  const ctrl = t.prompts.find(p => p.d.title === 'Moonlight Butterfly');
  t.say('Rückfrage an Sitz ' + ctrl?.pi + ' · Hand-Falter Sitz0/Sitz1: ' + [hand(0), hand(1)] + ' · HP Sitz0: ' + [0, 1, 2].map(i => t.hp(0, i)) + ' · HP Sitz1: ' + [0, 1, 2].map(i => t.hp(1, i)));
  R.check('Rückfrage ging an den Kontrolleur (Sitz 1)', ctrl && ctrl.pi === 1, ctrl && ctrl.pi);
  R.check('Falter liegt auf der Hand des Kontrolleurs', hand(1) === h0[1] + 1, [hand(0), hand(1)]);
  R.check('150 Schaden auf den Helden des Gegners des Kontrolleurs in Position 1 (Sitz 0 Held 1)', t.hp(0, 1) === 650 && t.hp(1, 1) === 800, [t.hp(0, 1), t.hp(1, 1)]);
  R.check('Falter nicht auf der Hand des Besitzers (Sitz 0)', hand(0) === h0[0], [hand(0), hand(1)]);
  await t.run(() => t.engine.actionDiscardHandCard(1, 'Moonlight Butterfly', t.pile(1, 'hand').indexOf('Moonlight Butterfly')));
  R.check('abgeworfen: Falter liegt in der Ablage seines Besitzers (Sitz 0)', t.pile(0, 'discardPile').includes('Moonlight Butterfly') && !t.pile(1, 'discardPile').includes('Moonlight Butterfly'), { a0: t.pile(0, 'discardPile'), a1: t.pile(1, 'discardPile') });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
