// A08-20 · Weakening Crystal: eine fremde Negation verdrängt die Kristall-Negation; läuft sie ab, bleibt der Held bis zum nächsten eigenen Zugbeginn ungebunden
//
// Kartentext: „While this card is in your hand, the effects of all your Heroes are negated." (Ruling `_crystals-shared.js`: Anlage nur bei Eintritt in die Hand, zu Beginn der Runde des Betroffenen, beim Laden)
// Aufbau: Sitz 0 hält Weakening Crystal; Held 0 trägt schon eine fremde 1-Zug-Negation (`addHeroStatus(0,0,'negated',{duration:1})`), danach wird der Kristall angelegt
//   (`_refreshWeakeningCrystalNegation({reapply:true})`, wie beim Eintritt in die Hand). Held 1 und 2 bekommen die Kristall-Negation, Held 0 nicht (`if (cur && cur._byWeakeningCrystal !== true) continue;`).
// Schritte: echter Zugwechsel (Zugende Sitz 0 räumt `negated` ohne `sourceBound` weg, `_engine.js` ~45106).
// Erwartung: der Kristall liegt weiter auf der Hand ⇒ Held 0 ist auch in der Runde des Gegners negiert.
// Beobachtet: Nach dem Zugende von Sitz 0 trägt Held 0 gar keine Negation mehr (Held 1/2 schon), obwohl der Kristall in der Hand liegt – bis zum nächsten Zugbeginn von Sitz 0.
// Aufruf: node docs/niche-tests/repro/A08-pacman/20-weakening-crystal-luecke-nach-fremder-negation.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const F = H.INERT.filler;
  const t = await H.fresh({ hand: [['Weakening Crystal'], []], deck: [Array(30).fill(F), Array(30).fill(F)] });
  await t.run(() => t.engine.addHeroStatus(0, 0, 'negated', { duration: 1, appliedBy: 1 }));
  t.engine._refreshWeakeningCrystalNegation({ reapply: true });
  const neg = (hi) => !!(t.gs.players[0].heroes[hi].statuses && t.gs.players[0].heroes[hi].statuses.negated);
  R.check('Aufbau: Held 0 trägt die fremde Negation, Held 1/2 die des Kristalls', neg(0) && neg(1) && neg(2), [neg(0), neg(1), neg(2)]);
  await t.endTurn();      // Zug des Gegners
  R.check('Kristall liegt noch auf der Hand', t.pile(0, 'hand').includes('Weakening Crystal'), t.pile(0, 'hand'));
  R.check('in der Runde des Gegners ist auch Held 0 negiert (Kristall auf der Hand)', neg(0), [neg(0), neg(1), neg(2)]);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
