'use strict';
// S03-09 (Stufe C) · Poison Pollen: Momentaufnahme oder der Reihe nach?
// Kartentext: „Stun all Poisoned targets on the board for 1 turn and inflict 1 Stack of Poison to all Stunned targets on the board."
// Skript (Kopfkommentar): „The board is sampled BEFORE any mutation so a freshly-applied status doesn't chain through the other clause mid-resolve."
// Aufbau: Gegner-Held 0 ist vergiftet (2 Stacks), nicht betäubt. Sitz 0 spielt Poison Pollen.
// Lesart A (Skript, Momentaufnahme): Held 0 wird betäubt, bleibt bei 2 Stacks (er war beim Wirken nicht betäubt).
// Lesart B (der Reihe nach, wörtlich „and"): erst werden alle Vergifteten betäubt, DANN bekommen alle Betäubten – also auch Held 0 – 1 Stack ⇒ 3 Stacks.
// Das Repro prüft Lesart B (✗ = Skript folgt Lesart A).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Poison Pollen'], []], hp: 500 });
  await t.engine.addHeroStatus(1, 0, 'poisoned', { addStacks: 2, appliedBy: 0 });
  const r = await t.play(0, 'Poison Pollen', { hero: 0 });
  const h = t.gs.players[1].heroes[0];
  R.check('Poison Pollen gespielt', r === true, r);
  R.check('Held 0 ist betäubt', !!h.statuses.stunned, h.statuses);
  R.note('Gift-Stacks von Held 0 nach dem Zauber (Lesart A = 2, Lesart B = 3)', h.statuses.poisoned && h.statuses.poisoned.stacks);
  R.check('Lesart B: das eben betäubte Ziel bekommt im selben Zauber +1 Gift (3 Stacks)', h.statuses.poisoned && h.statuses.poisoned.stacks === 3, h.statuses.poisoned);
  R.finish();
})();
