'use strict';
// S01-09 · Flächenschlag „all targets your opponent controls" trifft eine vom Wirker KONTROLLIERTE (geliehene/gestohlene) Kreatur
// Kartentext Boiling Oil: „Deal 80 damage to all targets your opponent controls."  (gleicher Weg: jede Karte mit `aoeHit({ side: 'enemy' })`)
// Regel in der Engine (`collectAoeHeroTargets`, v718 „Seite statt Spalte"): ein vom Wirker kontrollierter HELD fällt aus einem Gegnerflächenschlag heraus.
// Aufbau: Sitz 1 besitzt eine Kreatur, Sitz 0 hat sie sich geliehen (`actionStealCreature(0, inst)`, wie Aligning Goals); außerdem eine eigene Kreatur von Sitz 0, die Sitz 1 sich geliehen hat.
// Erwartet: die vom Wirker kontrollierte Kreatur bleibt unverletzt; die dem Wirker gehörende, aber vom Gegner kontrollierte Kreatur wird getroffen (−80).
// Beobachtet: beide werden getroffen. Ursache: `collectAoeCreatureTargets` (_engine.js ~45511) nimmt jede Kreatur, deren Besitzer ODER Kontrolleur in `targetPlayers` liegt
//   (`inst.owner !== tpi && inst.controller !== tpi` → continue). Bei `side: 'both'` (Hole in the Sky, MOE Bomb, …) steht eine solche Kreatur zudem doppelt in der Zielliste.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Boiling Oil'], []] });
  const geliehen = t.put(1, 0, 0, H.INERT.creature);       // gehört Sitz 1, Sitz 0 kontrolliert sie
  const verloren = t.put(0, 0, 0, H.INERT.creature);       // gehört Sitz 0, Sitz 1 kontrolliert sie
  t.engine.actionStealCreature(0, geliehen);
  t.engine.actionStealCreature(1, verloren);
  const hp = (k) => k.counters.currentHp ?? 200;
  await t.play(0, 'Boiling Oil', { hero: 0 });
  R.check('Kontrolle: die vom Gegner kontrollierte Kreatur (gehört dem Wirker) wird getroffen (−80)', hp(verloren) === 120, hp(verloren));
  R.check('die vom Wirker kontrollierte Kreatur wird NICHT getroffen', hp(geliehen) === 200, hp(geliehen));
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
