'use strict';
// A06-rebelliokai-13 · Cykyran War Counselor stummgeschaltet (eingefroren): die Verdopplung der Basis-Angriffswerte bleibt
// Kartentext: „While you control at least 3 different "War Counselor" Creatures, your Heroes' Base Attack stats are doubled." (Passive
//   Kreatureneffekte sind bei gefrorenem/betäubtem/negiertem Creature aus.)
// Beobachtung: Der Bonus (`hero._cykyranBonus`, cykyran-war-counselor.js `resync`) wird nur von Cykyrans EIGENEN Hooks nachgeführt; die Engine
//   filtert sie, solange er stummgeschaltet ist → der Held behält die doppelte Basis-ATK.
// Erwartung: eingefrorener Cykyran → Held-ATK wieder 90 (statt 180).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [[], []] });
  t.setHand(0, ['Cykyran War Counselor', 'Gorinthian War Counselor', 'Censpartan War Counselor']);
  t.setHero(0, 0, 'Calamitusk, the Chaorc War Chief', 450);   // ATK 90
  await t.play(0, 'Cykyran War Counselor', { hero: 0, slot: 0 });
  await t.play(0, 'Gorinthian War Counselor', { hero: 0, slot: 1 });
  await t.play(0, 'Censpartan War Counselor', { hero: 0, slot: 2 });
  R.check('Aufbau: Basis-ATK verdoppelt (180)', t.hero(0, 0).atk === 180, t.hero(0, 0).atk);
  const cyk = t.find('Cykyran War Counselor', 'support');
  await t.run(() => t.engine.applyCreatureStatus(cyk, 'frozen', { duration: 2, sourceOwner: 1, source: 'repro' }));
  R.check('Cykyran ist stummgeschaltet', t.engine.isCreatureEffectSuppressed(cyk) === true);
  R.check('Eingefrorener Cykyran: Held-ATK wieder 90', t.hero(0, 0).atk === 90, { atk: t.hero(0, 0).atk, base: t.hero(0, 0).baseAtk });
  R.check('keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  R.finish();
})();
