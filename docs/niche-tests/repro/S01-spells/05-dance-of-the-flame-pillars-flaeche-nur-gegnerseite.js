'use strict';
// S01-05 · Dance of the Flame Pillars: der Vollflächen-Zweig (150 auf ALLE Ziele) trifft nur die Gegnerseite
// Kartentext: „Choose as many different targets as there are Destruction Magic Spells with different names in your discard pile and deal 100 damage to them.
//   If there are more different Destruction Magic Spells in your discard pile than targets on the board, deal 150 damage to all targets instead."
// Skript-Kommentar (dance-of-the-flame-pillars.js Kopf): „150 damage to ALL targets … (both sides included)".
// Ursache: dance-of-the-flame-pillars.js:118 ruft `ctx.aoeHit({ side: 'any', … })`; `engine.aoeTargetPlayers` (_engine.js:45462) kennt nur 'own' / 'both' / 'enemy'
//   — 'any' fällt auf den Default „Gegner" zurück. (Es ist die einzige Karte mit side:'any' an aoeHit.)
// Aufbau: je Seite 1 Held + 1 Kreatur (4 Ziele), Ablage Sitz 0: 5 verschiedene Destruction-Magic-Zauber (5 > 4 → Vollfläche).
// Erwartet: Alle 4 Ziele verlieren 150 (eigener Held 650, eigene Kreatur 50 übrig, Gegner-Held 650, Gegner-Kreatur 50).
// Beobachtet: nur Gegner-Held und Gegner-Kreatur werden getroffen; die eigene Seite bleibt unversehrt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ heroes: [['Tushu, the Knowledge Keeper'], ['Atta, Speaker of Desires']], hand: [['Dance of the Flame Pillars'], []],
    discard: [['Fireball', 'Burning Finger', 'Boiling Oil', 'Big Oopsie', 'Armageddon'], []] });
  const eigene = t.put(0, 0, 0, H.INERT.creature);
  const fremde = t.put(1, 0, 0, H.INERT.creature);
  const r = await t.play(0, 'Dance of the Flame Pillars', { hero: 0 });
  R.check('Spielweg meldet true', r === true, r);
  R.check('Gegner-Held −150', t.hp(1, 0) === 650, t.hp(1, 0));
  R.check('Gegner-Kreatur −150', fremde.counters.currentHp === 50, fremde.counters.currentHp);
  R.check('EIGENER Held −150 („all targets", beide Seiten)', t.hp(0, 0) === 650, t.hp(0, 0));
  R.check('EIGENE Kreatur −150', eigene.counters.currentHp === 50, eigene.counters.currentHp);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
