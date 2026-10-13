'use strict';
// C05-creatures-11 · Water Golem hält die Negierung seines Ziels auch dann aufrecht, wenn er selbst gefroren/betäubt/negiert ist (Klasse B-01)
// Kartentext: „While this Creature remains on the board, that target's effects are negated."
// Konvention der Engine (B-querschnitt.md B-01…B-03): eine gefrorene/betäubte/negierte Kreatur verliert ihre Effekte (`isCreatureEffectSuppressed`).
// Wörtliche Lesart: „solange sie auf dem Brett liegt" -> die Negierung bleibt.
// Beobachtet: In allen drei Zuständen bleibt der Held des Ziels negiert (die Marke `sourceBound` wird nur beim Abgang des Golems zurückgenommen).
// Ursache: `cards/effects/water-golem.js:223-230` löst die Negierung nur im `onCardLeaveZone`/`onCreatureDeath` des Golems; auf Frost/Betäubung/Negation des Golems
//   reagiert nichts. (Wörtliche Lesart des Kartentextes „while … remains on the board" – dieselbe Frage wie B-01 bei The Thing in the Ship.)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const pickHero = (o, h) => (valid) => { const v = valid.find(x => x.type === 'hero' && x.owner === o && x.heroIdx === h); return v ? [v.id] : null; };
  for (const st of ['frozen', 'stunned', 'negated']) {
    const t = await H.fresh({});
    t.grantFor(0, 0, 'Water Golem');
    t.putSurprise(0, 0, 'Water Golem');
    const gw = t.putSurprise(0, 1, 'Glass Wall');
    t.targetFn = pickHero(1, 0);
    await t.run(() => t.engine.actionMoveCard(gw, 'discard', -1, -1, { source: 'Test', sourceOwner: 1 }));
    const g = t.find('Water Golem', 'support');
    R.check(st + ': Aufbau – Golem liegt, Ziel negiert', !!g && !!t.hero(1, 0).statuses.negated);
    if (st === 'negated') await t.engine.actionNegateCreature(g, 'Neg'); else await t.engine.applyCreatureStatus(g, st, { sourceOwner: 1 });
    R.check(st + ': Golem ist stillgelegt', t.engine.isCreatureEffectSuppressed(g) === true);
    R.check(st + ': stillgelegter Golem negiert sein Ziel NICHT mehr', !t.hero(1, 0).statuses.negated, Object.keys(t.hero(1, 0).statuses));
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
