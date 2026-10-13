'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  H03-heroes-21 · Nicolas (dauerhaft übernommen): die Trank-Sperre gilt auch für den ALTEN Besitzer
//
//  Karte: Nicolas, the Hidden Alchemist (`potionLockAfterN: 2`); Verbraucher `checkPotionLock` (`server.js` ~4536)
//  Kartentext: „After **you** have played your second Potion during a turn, you cannot play Potions for the rest of that turn …"
//  Aufbau: Sitz 1 besitzt Nicolas (Held 0); Sitz 0 übernimmt ihn dauerhaft. Beide Sitze haben je 4 Elixir of Quickness.
//  Erwartung: Sitz 0 (Kontrolleur) ist nach dem 2. Trank gesperrt; Sitz 1 (hat Nicolas nicht mehr) kann alle 4 Tränke spielen.
//  Beobachtung (✗): Der erste Zweig von `checkPotionLock` geht über `ps.heroes` des Spielers, der den Trank spielt – also auch über den an Sitz 0 verlorenen Nicolas, der noch auf
//  Sitz 1s Brettseite steht. Sitz 1 wird nach dem 2. Trank gesperrt, obwohl er Nicolas nicht kontrolliert (Sitz 0 zusätzlich über den zweiten Zweig `charmedBy` ✓).
//  Aufruf: node docs/niche-tests/repro/H03-heroes/21-nicolas-uebernommen-sperrt-den-alten-besitzer.js   (✗ = Fehler tritt auf)
// ═══════════════════════════════════════════════════════════════════════════
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ heroes: [['Atta, Speaker of Desires', 'Hulijing, the Foxdemon', 'George, the Demigod'], ['Nicolas, the Hidden Alchemist', 'Tushu, the Knowledge Keeper', 'Zwei, the Lucky Thief']], hp: 600,
    hand: [Array(4).fill('Elixir of Quickness'), Array(4).fill('Elixir of Quickness')], deck: [Array(30).fill('Heal'), Array(30).fill('Heal')] });
  await t.run(() => t.engine.runHooks('onGameStart', {}));
  await t.run(() => t.engine.actionTakeHeroPermanently(0, 1, 0));
  const res0 = [], res1 = [];
  for (let i = 0; i < 4; i++) res0.push(await t.play(0, 'Elixir of Quickness', { hero: 0 }));
  await t.endTurn();
  for (let i = 0; i < 4; i++) res1.push(await t.play(1, 'Elixir of Quickness', { hero: 1 }));
  R.note('Kontrolleur Sitz 0 / alter Besitzer Sitz 1', { sitz0: res0, sitz1: res1 });
  R.check('Sitz 0 (Kontrolleur) ist nach dem 2. Trank gesperrt', res0.join() === 'true,true,false,false', res0);
  R.check('Sitz 1 (alter Besitzer) bleibt frei (alle 4 Tränke)', res1.every(x => x === true), res1);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
