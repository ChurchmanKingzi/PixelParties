'use strict';
// A06-rebelliokai-12 · Censpartan War Counselor stummgeschaltet (eingefroren): der Schutzschirm der anderen Ratgeber bleibt
// Kartentext: „Other "War Counselor" Creatures you control cannot be chosen by your opponent's cards and effects." (Passive Kreatureneffekte
//   eines gefrorenen/betäubten/negierten Creatures sind aus, vgl. `engine.isCreatureEffectSuppressed`.)
// Beobachtung: Der Schirm ist ein Zähler-Paar (`untargetable_by_opponent`/`_pi`, censpartan-war-counselor.js `resyncShield`), das nur durch die
//   EIGENEN Hooks des Censpartan neu abgeglichen wird. Ist er stummgeschaltet, filtert die Engine diese Hooks – der Schirm bleibt liegen.
// Erwartung: eingefrorener Censpartan → Gorinthian ist wieder wählbar (kein Schirm).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [[], []] });
  t.setHand(0, ['Censpartan War Counselor', 'Gorinthian War Counselor']);
  await t.play(0, 'Censpartan War Counselor', { hero: 0, slot: 0 });
  await t.play(0, 'Gorinthian War Counselor', { hero: 0, slot: 1 });
  const gor = t.find('Gorinthian War Counselor', 'support'), cen = t.find('Censpartan War Counselor', 'support');
  R.check('Aufbau: Gorinthian trägt den Schirm', !!gor.counters.untargetable_by_opponent, gor.counters);
  await t.run(() => t.engine.applyCreatureStatus(cen, 'frozen', { duration: 2, sourceOwner: 1, source: 'repro' }));
  R.check('Censpartan ist stummgeschaltet', t.engine.isCreatureEffectSuppressed(cen) === true);
  R.check('Eingefrorener Censpartan: Gorinthian ist nicht mehr durch den Schirm geschützt', !gor.counters.untargetable_by_opponent, gor.counters);
  // Auswirkung: Fireball des Gegners
  t.setHand(1, ['Fireball']); t.gs.activePlayer = 1; t.reset();
  t.targetFn = (valid) => [valid[0].id];
  await t.play(1, 'Fireball', { hero: 0 });
  const angeboten = t.targets.some(x => x.valid.some(v => v.cardName === 'Gorinthian War Counselor'));
  R.check('Gegner-Fireball kann den Gorinthian wählen', angeboten, t.targets.map(x => x.valid.map(v => v.cardName)));
  R.check('keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  R.finish();
})();
