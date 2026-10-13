'use strict';
// S03-P2 (Prüfauftrag S01-09) · Rain of Arrows trifft eine vom Wirker kontrollierte (gestohlene) Gegnerkreatur
// Kartentext: „Deal damage equal to 30 times the number of Creatures you control to all targets your opponent controls."
// Aufbau: Sitz 0 kontrolliert ZZ Dummy Big (eigene) + eine per `actionStealCreature` gestohlene Gegnerkreatur (Besitzer 1, Kontrolleur 0, physisch in Spalte 1).
// Erwartet: Die gestohlene Kreatur wird vom Wirker kontrolliert ⇒ kein Ziel (1000 HP bleiben); Gegner-Helden verlieren 60.
// Beobachtet: Helden 740 ✓ (2 eigene Kreaturen gezählt), aber die gestohlene Kreatur nimmt 60 Schaden (940 HP) – `collectAoeCreatureTargets` nimmt „Besitzer ODER Kontrolleur" (S01-09).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Rain of Arrows'], []], hp: 800, deckSize: 20 });
  t.setAbilities(0, 0, [['Destruction Magic'], [], []]);
  t.put(0, 0, 0, H.INERT.big);
  const gestohlen = t.put(1, 0, 0, H.INERT.big);
  await t.engine.actionStealCreature(0, gestohlen);
  await new Promise(r => setTimeout(r, 80));
  await t.play(0, 'Rain of Arrows', { hero: 0, noGrant: true });
  R.check('Gegner-Helden verlieren 60 (2 kontrollierte Kreaturen)', t.hp(1, 0) === 740, t.hp(1, 0));
  R.check('die selbst kontrollierte (gestohlene) Kreatur bleibt unversehrt', (gestohlen.counters.currentHp ?? 1000) === 1000, gestohlen.counters.currentHp);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
