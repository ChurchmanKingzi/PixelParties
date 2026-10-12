'use strict';
// S01-06 · Dance of the Flame Pillars zählt Ausrüstung/Anhänge als „Ziele auf dem Brett" – die Wahl bietet sie aber nicht an
// Kartentext: s. 05. Ziele sind (wie bei der Zielwahl der Karte selbst: types ['hero','creature']) Helden und Kreaturen.
// Ursache: `countAllValidTargets` (dance-of-the-flame-pillars.js:57) zählt JEDE belegte Support Zone (`slot.length > 0`), auch Artefakte/Ausrüstung.
//   Der Kommentar bei der Mehrfachwahl („hier unten stehen also immer mindestens N Ziele zur Verfügung") stimmt dann nicht mehr.
// Aufbau: je Seite 1 Held, je Seite 1 Artefakt (ZZ Trinket); Ablage Sitz 0: 3 verschiedene Destruction-Magic-Zauber (N = 3).
//   Ziele laut Text: 2 Helden (keine Kreaturen) → 3 > 2 → Vollfläche, 150 auf alle.
// Beobachtet: Skript zählt 4 (2 Helden + 2 Artefakte), 3 ≤ 4 → Wahlmodus: angeboten werden nur die 2 Helden (minRequired 3, maxTotal 2), beide bekommen nur 100.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ heroes: [['Tushu, the Knowledge Keeper'], ['Atta, Speaker of Desires']], hand: [['Dance of the Flame Pillars'], []],
    discard: [['Fireball', 'Burning Finger', 'Boiling Oil'], []] });
  t.put(0, 0, 0, H.INERT.artifact); t.put(1, 0, 0, H.INERT.artifact);
  t.targetFn = (valid) => valid.map(v => v.id);          // alles wählen, was angeboten wird
  await t.play(0, 'Dance of the Flame Pillars', { hero: 0 });
  const angebot = t.targets.map(x => x.valid.length);
  R.note('angebotene Ziele in der Wahl', angebot);
  R.check('Gegner-Held verliert 150 (3 verschiedene Zauber > 2 Ziele auf dem Brett → Vollfläche)', t.hp(1, 0) === 650, { hpGegner: t.hp(1, 0), hpEigen: t.hp(0, 0) });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
