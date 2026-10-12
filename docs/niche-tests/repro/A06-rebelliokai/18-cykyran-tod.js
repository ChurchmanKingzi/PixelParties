'use strict';
// A06-rebelliokai-18 · Cykyran War Counselor verlässt das Feld: die verdoppelte Basis-ATK bleibt dauerhaft
// Kartentext: „While you control at least 3 different "War Counselor" Creatures, your Heroes' Base Attack stats are doubled."
// Beobachtung: `resync` (cykyran-war-counselor.js) läuft nur über Cykyrans EIGENE Hooks. Beim Verlassen (`onCardLeaveZone`) steht er noch auf
//   dem Brett und zählt als Ratgeber → Bedingung bleibt "erfüllt"; `onCreatureDeath` wird von `resyncFromCtx` verworfen (`inst.zone !== 'support'`).
//   Danach gibt es keinen Zuhörer mehr – der Zuschlag (`hero._cykyranBonus`) bleibt über Zugwechsel hinweg liegen.
//   (Stirbt dagegen ein ANDERER Ratgeber, gleicht Cykyran korrekt ab: 180 → 90.)
// Erwartung: nach Cykyrans Tod hat der Held wieder seine einfache Basis-ATK (90).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const src = { name: 'Opp Destroy', owner: 1, heroIdx: 0 };
  const t = await H.fresh({ hand: [[], []] });
  t.setHand(0, ['Cykyran War Counselor', 'Gorinthian War Counselor', 'Censpartan War Counselor']);
  t.setHero(0, 0, 'Calamitusk, the Chaorc War Chief', 450);   // ATK 90
  await t.play(0, 'Cykyran War Counselor', { hero: 0, slot: 0 });
  await t.play(0, 'Gorinthian War Counselor', { hero: 0, slot: 1 });
  await t.play(0, 'Censpartan War Counselor', { hero: 0, slot: 2 });
  R.check('Aufbau: Basis-ATK verdoppelt (180)', t.hero(0, 0).atk === 180, t.hero(0, 0).atk);
  await t.run(() => t.engine.actionDestroyCard(src, t.find('Cykyran War Counselor', 'support')));
  R.check('Cykyran ist weg', !t.find('Cykyran War Counselor', 'support'));
  R.check('Nach Cykyrans Tod: Held-ATK wieder 90', t.hero(0, 0).atk === 90, { atk: t.hero(0, 0).atk, base: t.hero(0, 0).baseAtk, bonus: t.hero(0, 0)._cykyranBonus });
  await t.endTurn(); await t.endTurn();
  R.check('auch nach einem Zugumlauf: Held-ATK 90', t.hero(0, 0).atk === 90, t.hero(0, 0).atk);
  R.check('keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  R.finish();
})();
