'use strict';
// A03-futuretech-30 · Future Tech Doomsday Bomb: „all targets on the board take damage“ lässt eine eigene Kreatur aus, wenn eine fremd beschworene Kreatur an derselben (Held, Slot)-Stelle der anderen Seite steht (Wurzel F02-14)
//
// Kartentext: „… negate that Attack. If you do, all targets on the board take damage equal to 50 times the combined number of "Future Tech Doomsday Bomb" cards in all discard piles.“
// Aufbau: Sitz 0 beschwört Plant Golem (landet bei Sitz 1, Held 0, Slot 0; owner 0, controller 1); eigene ZZ Dummy bei Sitz 0, Held 0, Slot 0; Gegner-ZZ-Dummy bei Sitz 1, Held 1, Slot 0.
//   Doomsday Bomb an Held 0, 2 weitere in der Ablage (100 Schaden), Heavy Hit auf Gegner-Held 0.
// Erwartung: Golem, eigene ZZ Dummy und Gegner-ZZ-Dummy verlieren je 100 HP. Kontrolle ohne Golem: die eigene ZZ Dummy verliert 100.
// Beobachtet: Golem und Gegner-Dummy werden getroffen, die eigene ZZ Dummy (200 HP) bleibt unversehrt.
// Ursache: future-tech-doomsday-bomb.js:77 sammelt über `engine.getCreatureTargets(0/1)`; dessen Instanz-Suche (`_engine.js` ~40263) ignoriert die Brettseite, der Golem (owner 0, controller 1) verdrängt die ZZ Dummy an (0,0).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const DB_ = 'Future Tech Doomsday Bomb';
  const hp = (i) => i.counters.currentHp ?? 200;
  for (const mitGolem of [false, true]) {
    const t = await H.fresh({ hand: [['Plant Golem', DB_, 'Heavy Hit'], []], discard: [[DB_, DB_], []], gold: [200, 100] });
    if (mitGolem) await t.play(0, 'Plant Golem', { hero: 0 });
    const golem = mitGolem ? t.inst(c => c.name === 'Plant Golem' && c.zone === 'support')[0] : null;
    const dummy = t.put(0, 0, 0, H.INERT.creature); dummy.turnPlayed = 1;
    const foe = t.put(1, 1, 0, H.INERT.creature); foe.turnPlayed = 1;
    await t.play(0, DB_, { hero: 0 });
    t.hero(0, 0).atk = 100;
    t.targetFn = (v) => [v.find(x => x.owner === 1 && x.type === 'hero' && x.heroIdx === 0).id];
    await t.play(0, 'Heavy Hit', { hero: 0 });
    const tag = mitGolem ? 'mit Golem' : 'Kontrolle ohne Golem';
    R.check(tag + ': Gegner-Dummy −100', hp(foe) === 100, hp(foe));
    R.check(tag + ': eigene ZZ Dummy −100', hp(dummy) === 100, { dummy: hp(dummy), golem: golem && golem.counters.currentHp });
    R.check(tag + ': keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
