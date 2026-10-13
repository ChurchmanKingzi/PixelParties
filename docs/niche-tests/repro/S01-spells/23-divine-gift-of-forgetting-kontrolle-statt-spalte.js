'use strict';
// S01-23 · Divine Gift of Forgetting: „Heroes they control" wird nach Spalte statt nach Kontrolle ausgewertet
// Kartentext: „Your opponent shuffles all Abilities attached to Heroes they control back into their deck, except Starting Abilities."
// Ruling CARD_API.md ~Z. 6046-6090 (v718): „Wer nach Seiten rechnet, fragt nie die Spalte" – `engine.heroSideOf` / `engine.heroesControlledBy(pi)`.
// Aufbau: Sitz 1 hat Abilities an Held 0 und Held 1; Sitz 0 kontrolliert Held 1 von Sitz 1 (Charme, `actionStealHero(0, 1, 1)`); Sitz 1 kontrolliert Held 2 von Sitz 0 (`actionStealHero(1, 0, 2)`), der Abilities trägt.
// Erwartet: betroffen sind die Helden, die der Gegner (Sitz 1) kontrolliert: Held 0 und der gestohlene Held (0,2); der von Sitz 0 kontrollierte Held (1,1) behält seine Abilities.
// Beobachtet: `collectRemovableAbilities(engine, oi)` läuft über die Heldenspalte `gs.players[oi].heroes`: Held (1,1) verliert seine Abilities, Held (0,2) behält sie.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Divine Gift of Forgetting'], []], deck: [['ZZ Dummy', 'ZZ Dummy'], ['ZZ Dummy', 'ZZ Dummy']],
    abilities: { 0: { 2: [['Magic Arts', 'Magic Arts'], [], []] }, 1: { 0: [['Support Magic', 'Support Magic'], [], []], 1: [['Decay Magic', 'Decay Magic'], [], []] } } });
  t.engine.actionStealHero(0, 1, 1);
  t.engine.actionStealHero(1, 0, 2);
  const anzahl = (s, h) => (t.gs.players[s].abilityZones[h] || []).reduce((n, z) => n + z.length, 0);
  await t.play(0, 'Divine Gift of Forgetting', { hero: 0 });
  R.check('Kontrolle: Held (1,0) (vom Gegner kontrolliert) verliert seine Abilities', anzahl(1, 0) === 0, anzahl(1, 0));
  R.check('Held (1,1) (vom Wirker kontrolliert) behält seine Abilities', anzahl(1, 1) === 2, anzahl(1, 1));
  R.check('Held (0,2) (vom Gegner kontrolliert) verliert seine Abilities', anzahl(0, 2) === 0, anzahl(0, 2));
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
