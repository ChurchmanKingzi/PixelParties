'use strict';
// W14c · Q173 (S03-09) Poison Pollen: „all Stunned targets" gilt zum Zeitpunkt des Ausspielens (Al 16.10.2026): ein bereits vergifteter Held erhält Stun, aber NICHT noch einen extra Gift-Stack.
// Aufbau: Gegnerheld 0 vergiftet (2 Stacks), nicht betäubt; Gegnerheld 1 betäubt, nicht vergiftet; Gegnerheld 2 betäubt UND vergiftet (1 Stack).
// Erwartet: H0 betäubt, 2 Stacks; H1 vergiftet (1 Stack), bleibt betäubt; H2 +1 Stack (2 Stacks, war vorher schon betäubt), bleibt betäubt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Poison Pollen'], []], hp: 500 });
  await t.engine.addHeroStatus(1, 0, 'poisoned', { addStacks: 2, appliedBy: 0 });
  await t.engine.addHeroStatus(1, 1, 'stunned', { duration: 1, appliedBy: 0 });
  await t.engine.addHeroStatus(1, 2, 'poisoned', { addStacks: 1, appliedBy: 0 });
  await t.engine.addHeroStatus(1, 2, 'stunned', { duration: 1, appliedBy: 0 });
  const r = await t.play(0, 'Poison Pollen', { hero: 0 });
  const h = (i) => t.gs.players[1].heroes[i];
  const stacks = (i) => h(i).statuses.poisoned && h(i).statuses.poisoned.stacks;
  R.check('Poison Pollen gespielt', r === true, r);
  R.check('H0 (vergiftet) ist betäubt', !!h(0).statuses.stunned, h(0).statuses);
  R.check('H0 erhält KEINEN extra Gift-Stack durch das frische Stun (bleibt bei 2)', stacks(0) === 2, stacks(0));
  R.check('H1 (betäubt) wird vergiftet (1 Stack)', stacks(1) === 1, stacks(1));
  R.check('H2 (vorher betäubt und vergiftet) bekommt genau +1 Gift (1 → 2 Stacks)', stacks(2) === 2, stacks(2));
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
