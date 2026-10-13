// A08-28 · Weakening Crystal legt die Negation unter Umgehung der Status-Immunität an (Petrification Break)
//
// Kartentexte: Weakening Crystal: „While this card is in your hand, the effects of all your Heroes are negated. This counts as a negative status effect."
//   Petrification Break: „While this card is attached to a Hero, it cannot be affected by negative status effects and any damage it would take is halved."
// Aufbau: Sitz 0 hält Weakening Crystal; Held 0 trägt Petrification Break (Engine erkennt den Schutz: `heroHasStatusImmunityAttachment(0,0)` = true; Frost wird abgewehrt).
//   Die Kristall-Anlage läuft wie beim Eintritt in die Hand (`_refreshWeakeningCrystalNegation({ reapply: true })`).
// Erwartung: Held 0 bleibt unbeeinflusst (die Negation zählt als negativer Status, Petrification Break schützt), Held 1 und 2 sind negiert.
// Beobachtet: Alle drei Helden tragen `negated`, auch der Träger von Petrification Break. Ursache: `_crystals-shared.js` ~Z. 132 schreibt `hero.statuses.negated = {…}` direkt, statt über `addHeroStatus`
//   (dort stehen die Immunitäten: `status_immunity_attachment` `_engine.js` ~44835, Johanna, Submerged, Karian …).
// Aufruf: node docs/niche-tests/repro/A08-pacman/28-weakening-crystal-ignoriert-statusimmunitaet.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const F = H.INERT.filler;
  const t = await H.fresh({ hand: [['Weakening Crystal'], []], deck: [Array(30).fill(F), Array(30).fill(F)] });
  const pb = t.put(0, 0, 0, 'Petrification Break'); pb.turnPlayed = 1;
  R.check('Aufbau: Petrification Break schützt Held 0', t.engine.heroHasStatusImmunityAttachment(0, 0) === true);
  await t.run(() => t.engine.addHeroStatus(0, 0, 'frozen', { duration: 1, appliedBy: 1 }));
  R.check('Kontrolle: Frost wird von Petrification Break abgewehrt', !t.hero(0, 0).statuses.frozen);
  t.engine._refreshWeakeningCrystalNegation({ reapply: true });
  const neg = (hi) => !!t.hero(0, hi).statuses.negated;
  R.note('negiert (Held 0/1/2)', JSON.stringify([neg(0), neg(1), neg(2)]));
  R.check('Held 1 und 2 sind negiert', neg(1) && neg(2));
  R.check('Held 0 (Petrification Break) wird nicht negiert', !neg(0));
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
