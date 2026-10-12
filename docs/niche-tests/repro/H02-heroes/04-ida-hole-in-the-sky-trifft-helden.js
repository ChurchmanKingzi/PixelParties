// H02-heroes-04 · Ida, the Adept of Destruction – Hole in the Sky (nur Creatures) wird zum Heldentreffer
//
// Kartentext Hole in the Sky: „All Creatures both players control take 999 damage."
// Kartentext Ida: „This Hero can never hit more than 1 target with a Destruction Spell."
// Erwartung: unter Ida trifft Hole in the Sky höchstens EINE Creature (Einzelziel-Wahl nur unter Creatures); Helden sind
//   nie Ziel (der Zauber betrifft nur Creatures).
// Beobachtung: `actionAoeHit` baut Idas Einzelziel-Wahl mit `types: types.includes('creature') ? ['hero','creature'] : ['hero']`
//   (`_engine.js` ~45664) – für einen reinen Creature-Zauber (`types: ['creature']`) werden also auch alle HELDEN angeboten,
//   und ein gewählter Held nimmt 999 Schaden (800 → 0, besiegt).
// Aufruf: node docs/niche-tests/repro/H02-heroes/04-ida-hole-in-the-sky-trifft-helden.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const IDA = 'Ida, the Adept of Destruction';
  const t = await H.fresh({ heroes: [[IDA, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], hand: [['Hole in the Sky'], []] });
  await t.run(() => t.engine.runHooks('onGameStart', {}));   // fresh() startet das Spiel nicht von selbst
  t.put(1, 0, 0, H.INERT.big);
  t.put(0, 1, 0, H.INERT.big);
  let offered = null;
  t.targetFn = (valid) => { offered = valid.map(v => v.type); return [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id]; };
  const r = await t.play(0, 'Hole in the Sky', { hero: 0 });
  R.check('Hole in the Sky behandelt', r === true, r);
  R.note('angebotene Zieltypen', offered);
  R.check('Zielwahl bietet nur Creatures an (kein Held)', offered && offered.every(x => x !== 'hero'), offered);
  R.check('Gegnerischer Held 0 unversehrt (800 HP)', t.hp(1, 0) === 800, t.hp(1, 0));
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
