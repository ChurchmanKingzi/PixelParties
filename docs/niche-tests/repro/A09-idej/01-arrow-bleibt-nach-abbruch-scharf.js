'use strict';
// A09-01 · Angelfeather Arrow (und alle Pfeile): Nach abgebrochenem Angriff bleibt der Pfeil am Helden "scharf"
// Kartentext Angelfeather Arrow: „Play this card when a Hero you control performs an Attack. Increase THAT Attack's damage by 60."
// Aufbau: Seed 1234, Held 0 (Tushu, ATK 40) mit Fighting 1; Hand [Angelfeather Arrow, Attack]; Gegner-Held 0 als Ziel.
// Schritte: 1. "Attack" spielen, den Pfeil ketten, im Zielwahl-Fenster ABBRECHEN (Abbruch-Knopf = null) -> Karte kehrt auf die Hand zurück.
//           2. Danach einen zweiten "Attack" ohne Pfeil spielen.
// Erwartet: Der zweite Angriff macht 40 Schaden (der Pfeil gehörte zu dem abgebrochenen Angriff, "that Attack").
// Beobachtet: Der Pfeil liegt nach dem Abbruch weiter in hero._armedArrows (server.js doPlaySpell Abbruch-Zweig ruft
//             clearArmedArrows nicht auf) -> der nächste Angriff macht 100 Schaden.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Angelfeather Arrow', 'Attack'], []], gold: [100, 100] });
  t.setAbilities(0, 0, [['Fighting'], [], []]);
  t.targetFn = () => null;                                   // Mensch bricht die Zielwahl ab
  await t.play(0, 'Attack', { hero: 0 });
  R.check('Abbruch: Angriff zurück auf der Hand', t.pile(0, 'hand').includes('Attack'), t.pile(0, 'hand'));
  R.check('Abbruch: Pfeil nicht mehr am Helden scharf', !(t.hero(0, 0)._armedArrows || []).length, t.hero(0, 0)._armedArrows);
  t.reset();
  t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
  t.setHand(0, ['Attack']);
  const hp = t.hp(1, 0);
  await t.play(0, 'Attack', { hero: 0 });
  R.check('zweiter Angriff ohne Pfeil macht nur 40 Schaden', hp - t.hp(1, 0) === 40, hp - t.hp(1, 0));
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
