'use strict';
// F01-artifacts-02 · Birthday Present: wird die Gabe an den Gegner per Ambush the Scout negiert, verschwinden die 3 aufgedeckten Karten
// Kartentext (Birthday Present): „Reveal the top 3 cards of your deck. Your opponent chooses 1 of them. Add that card to your opponent's hand and add the other 2 cards to your hand."
// Kartentext (Ambush the Scout): „Play this card immediately when your opponent activates an effect that would interact with your hand. Negate that effect. Then, your opponent discards 2 cards of their choice from their hand."
// Aufbau: Sitz 0 hat Birthday Present (Deck: Fireball, Beer, Coffee, 2× Dummy), Sitz 1 hat Ambush the Scout (Decay Magic) auf der Hand.
// Erwartung: Auch bei negierter Hand-Interaktion geht keine Karte verloren: die 3 Karten liegen danach wieder oben im Deck (oder die zwei eigenen
//   gehen auf die Hand – „negiert wird NUR DER TEILEFFEKT", Skriptkopf Ambush); jedenfalls bleibt die Kartenbilanz erhalten.
// Beobachtet: Fireball, Beer und Coffee sind in KEINER Zone mehr (Deck −3, Hand unverändert, Ablage nur Birthday Present). Log: `birthday_present_negated`.
// Ursache: `cards/effects/birthday-present.js` Schritt 7 (Z. 209): Nach `checkHandInteractionReaction(... 'insert' ...)` → `return` ohne die per `takeTop` entnommenen
//   Karten zurückzulegen (der frühe Abbruch bei zu kleinem Deck weiter oben macht es mit `engine.returnToPile` richtig).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Birthday Present'], ['Ambush the Scout', 'ZZ Filler', 'ZZ Filler', 'ZZ Filler']],
    deck: [['Fireball', 'Beer', 'Coffee', 'ZZ Dummy', 'ZZ Dummy'], undefined] });
  t.grantFor(1, 0, 'Ambush the Scout');
  t.policy.confirm = true;
  const vorher = t.census();
  const r = await t.play(0, 'Birthday Present', { hero: 0 });
  const nachher = t.census();
  R.check('Birthday Present wurde gespielt', r === true, r);
  R.check('Ambush the Scout hat reagiert (Log hand_interaction_negated)', t.lg('hand_interaction_negated').length === 1 || t.logs.some(l => l.type === 'birthday_present_negated'), t.logs.map(l => l.type));
  const diff = t.censusDiff(vorher, nachher);
  const verloren = diff.filter(s => /: -\d+$/.test(s));
  // erwartet: nur Birthday Present + Ambush wechseln den Ort (Summe je Name bleibt); verlorene Namen dürfen nicht auftauchen
  R.check('Kartenbilanz: keine Karte verschwunden (Fireball/Beer/Coffee noch irgendwo)', verloren.length === 0, diff);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
