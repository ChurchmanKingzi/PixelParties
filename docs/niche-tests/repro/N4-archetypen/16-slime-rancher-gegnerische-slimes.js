'use strict';
// N4-archetypen-16 · Slime Rancher: verdoppelt er nur die eigenen Slimes oder auch die des Gegners? (Stufe C – Lesart)
// Kartentext (Slime Rancher): „While you control this Creature, the effects of "Slime" Creatures that activate when they are summoned are activated an additional time."
//   (Vergleich Sandy Blob: „… of a Creature **you control** …" – der Rancher-Text schränkt NICHT auf eigene Slimes ein.)
// Lesart A (Wortlaut): Solange ich einen Slime Rancher kontrolliere, wirken die Einsatz-Effekte JEDES Slimes doppelt – auch wenn der Gegner einen Slime beschwört.
// Lesart B (heute): slime-rancher.js filtert `(entering.controller ?? entering.owner) !== ctx.cardOwner` → nur Slimes, die ich selbst kontrolliere.
// Aufbau: Sitz 0 hat einen Slime Rancher. Sitz 1 beschwört einen Icy Slime (Einsatz-Effekt: Ziel einfrieren).
// Erwartung hier nach Lesart A: 2 Zielwahlen des Icy Slime; ✗ = heutiges Verhalten (1 Zielwahl).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['ZZ Filler'], ['Icy Slime']], deckSize: 30, active: 1 });
  t.setAbilities(1, 0, [['Summoning Magic'], [], []]);
  const r = t.put(0, 0, 0, 'Slime Rancher'); r.turnPlayed = 1;
  t.put(0, 1, 0, H.INERT.big);
  t.targetFn = (valid) => [valid[0].id];
  await t.play(1, 'Icy Slime', { hero: 0, slot: 0 });
  const n = t.targets.filter(x => x.config && x.config.title === 'Icy Slime').length;
  R.note('Zielwahlen des Icy Slime (Sitz 1) bei Rancher auf Sitz 0', n);
  R.check('Rancher doppelt den Einsatz-Effekt eines gegnerischen Slimes (Lesart A)', n === 2, n);
  R.finish();
})();
