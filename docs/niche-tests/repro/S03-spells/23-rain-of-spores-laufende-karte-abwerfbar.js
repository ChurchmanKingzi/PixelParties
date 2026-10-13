'use strict';
// S03-23 · Rain of Spores: die gerade aufgelöste Karte steht noch in `ps.hand` und ist als EIGENER Abwurf wählbar (Wurzel R02-07)
// Kartentext: „Discard any number of cards from your hand. Then, look at your opponent's hand and discard the same number of cards +1 from there."
// Aufbau: Sitz 0 Hand [Rain of Spores, Fireball, Fireball, Meteor Crash] (Decay Magic 3), Sitz 1 hat 6 Karten.
// Schritte: 1. Rain of Spores spielen. 2. Erste Abwurf-Abfrage lesen (`eligibleIndices`), dann die laufende Rain-of-Spores-Karte selbst als Abwurf wählen.
// Erwartet: Die laufende Karte liegt nicht mehr „in der Hand" – sie ist nicht wählbar; ohne echten Abwurf muss der Gegner genau 1 Karte abwerfen.
// Beobachtet: Index 0 (die laufende Rain of Spores) ist wählbar; der Spieler wirft sie als „1 Karte aus der Hand" ab und der Gegner muss 2 abwerfen (6 → 4) – ein
//   kostenloser Zusatzabwurf (die Karte wäre ohnehin in der Ablage gelandet). Eine Karte, die nur noch Rain of Spores in der Hand hält, bekommt so den Effekt „+1" gratis.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Rain of Spores', 'Fireball', 'Fireball', 'Meteor Crash'], Array(6).fill(H.INERT.creature)], hp: 800, deckSize: 20 });
  t.setAbilities(0, 0, [['Decay Magic', 'Decay Magic', 'Decay Magic'], [], []]);
  let erste = null;
  t.script.push({ match: d => d.type === 'forceDiscardCancellable', answer: (d) => {
    if (!erste) erste = { eligible: d.eligibleIndices.slice(), hand: t.pile(0, 'hand').slice() };
    return erste.hand.indexOf('Rain of Spores') >= 0 && t.pile(0, 'hand').includes('Rain of Spores') && !erste.gewaehlt
      ? ((erste.gewaehlt = true), { cardName: 'Rain of Spores', handIndex: t.pile(0, 'hand').indexOf('Rain of Spores') })
      : { cancelled: true };
  } });
  await t.play(0, 'Rain of Spores', { hero: 0, noGrant: true });
  R.check('die laufende Rain of Spores ist KEIN wählbarer Abwurf', erste && !erste.eligible.includes(erste.hand.indexOf('Rain of Spores')), erste);
  R.check('ohne echten Abwurf wirft der Gegner genau 1 Karte ab (6 → 5)', t.pile(1, 'hand').length === 5, t.pile(1, 'hand').length);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
