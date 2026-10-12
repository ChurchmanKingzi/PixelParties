'use strict';
// C04-06 · Powder Keg: „an opponent's Hero" wird nach der Brettseite entschieden, nicht nach der Kontrolle
// Kartentext: „Place this card into an opponent's Hero's Support Zone. When this Creature is defeated, deal 150 damage to all Creatures in the corresponding Hero's other Support Zones."
// Konvention im Code (Plant Golem „a Hero your opponent controls", Styx 28.9.; Realmniversal Emperor / Barbarian Sword über `heroSideOf`): maßgeblich ist die KONTROLLE des Helden,
//   ein von mir übernommener Gegnerheld ist kein Gegnerheld, ein vom Gegner übernommener eigener Held schon.
// Erwartung (nach dieser Konvention): (a) ein von mir per Charme kontrollierter Gegnerheld (Seat 1 / Held 0) wird NICHT als Platzierungsziel angeboten;
//   (b) ein eigener Held, den der Gegner per Charme kontrolliert, ist ein gültiges Ziel (hier der einzige freie Platz, weil die Gegnerspalte voll ist).
// Beobachtet: (a) der übernommene Held 1/0 (und seine freien Zonen) wird angeboten; (b) bei voller Gegnerspalte gibt es gar kein Ziel – der Keg ist nicht spielbar.
// Ursache: cards/effects/powder-keg.js `getOppPlacementTargets` (Z. 84) iteriert nur über `gs.players[opponentOfGs(...)].heroes` und fragt `heroSideOf` nie ab.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const KEG = require('../../../../cards/effects/powder-keg.js');
  // (a)
  let t = await H.fresh({ hand: [['Powder Keg'], []] });
  const ok = t.engine.actionStealHero(0, 1, 0, { sourceName: 'test' });
  R.check('Aufbau (a): Gegnerheld 1/0 von Seat 0 gecharmt', ok === true && t.engine.heroSideOf(1, t.hero(1, 0)) === 0, ok);
  const v1 = KEG.getValidTargets(t.gs, 0);
  R.check('(a) der von mir kontrollierte Held 1/0 wird nicht als Ziel angeboten', !v1.some(v => v.owner === 1 && v.heroIdx === 0), v1.map(v => v.id));
  // (b)
  t = await H.fresh({ hand: [['Powder Keg'], []] });
  for (let hi = 0; hi < 3; hi++) for (let si = 0; si < 3; si++) t.put(1, hi, si, H.INERT.creature);   // Gegnerspalte voll
  const ok2 = t.engine.actionStealHero(1, 0, 2, { sourceName: 'test' });
  R.check('Aufbau (b): eigener Held 0/2 vom Gegner gecharmt', ok2 === true && t.engine.heroSideOf(0, t.hero(0, 2)) === 1, ok2);
  const v2 = KEG.getValidTargets(t.gs, 0);
  R.check('(b) der vom Gegner kontrollierte Held 0/2 ist ein gültiges Ziel', v2.some(v => v.owner === 0 && v.heroIdx === 2), v2.map(v => v.id));
  R.finish();
})();
