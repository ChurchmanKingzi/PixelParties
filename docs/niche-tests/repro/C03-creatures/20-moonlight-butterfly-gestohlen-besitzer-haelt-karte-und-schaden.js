'use strict';
// C03-creatures-20 · Moonlight Butterfly (dauerhaft gestohlen): der Falter fliegt auf die Hand des BESITZERS und der 150-Schaden trifft dessen Wirtsheld
// Kartentext: „At the end of your opponent's turn, you may add this Creature you control back to your hand, and if you do,
//   deal 150 damage to the opponent's Hero in the same position as the corresponding Hero."
// Aufbau: Sitz 0: Falter (Held 1 / Slot 0, alt); Sitz 1 stiehlt ihn dauerhaft (actionStealCreature). Zugende von Sitz 0 (= Zug des Gegners des Kontrolleurs), Sitz 1 sagt Ja.
// Erwartung (Lesart A): „your hand" = Hand des Kontrolleurs (Sitz 1); Schaden auf den Helden GEGENÜBER dem Wirtsheld (Sitz 1 Held 1 ist der eigene; „opponent's Hero" des Kontrolleurs = Sitz 0).
//   Lesart B (jetzt): Falter auf die Hand des Besitzers, 150 auf Sitz 0 Held 1 = den Wirtsheld, auf dem der Falter selbst stand.
// Beobachtet: Hand Sitz 0: +1 Falter (der Dieb gibt die Karte zurück); Sitz 0 Held 1: −150; Sitz 1 unberührt.
// Ursache: moonlight-butterfly.js `onTurnEnd`: `oi = opponentOf(ctx.cardOwner)` (Kontrolleur → Sitz 0), `heroIdx = inst.heroIdx` (Spalte des Wirtes, der selbst auf Sitz 0 steht);
//   `returnSupportCreatureToHand` legt in die Hand des Besitzers.
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
  R.check('Falter liegt auf der Hand des Kontrolleurs (Lesart A)', hand(1) === h0[1] + 1, [hand(0), hand(1)]);
  R.check('Wirtsheld des Falters (Sitz 0 Held 1) verliert keine 150 HP durch den eigenen Falter', t.hp(0, 1) === 800, t.hp(0, 1));
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
