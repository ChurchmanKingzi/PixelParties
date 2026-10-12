'use strict';
// C01-creatures-05 · Cavalry trifft „Kreaturen in den Support Zones des Helden" nach KONTROLLE statt nach Zone (gestohlene Kreaturen)
// Kartentext: „You may once per turn choose a Hero your opponent controls and deal 50 damage to it and all Creatures in its Support Zones."
// Aufbau: Sitz 0: Cavalry (Held 0), eigene Kreatur C in Held-0-Zone, die der Gegner gestohlen hat (actionStealCreature(1, C): physisch weiter bei Sitz 0, controller 1).
//   Sitz 1: Kreatur A in Held 0, Kreatur B in Held 0, die ICH gestohlen habe (physisch weiter bei Sitz 1/Held 0, controller 0). Cavalry waehlt Gegner-Held 0.
// Erwartung: getroffen werden alle Kreaturen, die in den Support Zones von Gegner-Held 0 LIEGEN: A und B. C liegt in meiner Zone und bleibt unversehrt.
//   (Vergleich: Whirlwind Strike waehlt „Kreaturen in ihren Support Zones" nach `inst.owner`, also nach der Zone.)
// Beobachtet: A und C nehmen 50, B bleibt heil.
// Ursache: cards/effects/cavalry.js `creatureFilter: (inst) => (inst.controller ?? inst.owner) === tgtOwner && inst.heroIdx === tgtHeroIdx` – bei gestohlenen Karten ist
//   `controller` NICHT die Brettseite (`engine.physicalSide(inst)` = `owner`, wenn `stolenBy`/`crossSideControlled`).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({});
  const gs = t.gs, e = t.engine;
  const cav = t.put(0, 0, 0, 'Cavalry'); cav.turnPlayed = 1;
  const A = t.put(1, 0, 0, H.INERT.big);
  const B = t.put(1, 0, 1, H.INERT.big); e.actionStealCreature(0, B);
  const C = t.put(0, 0, 1, H.INERT.big); e.actionStealCreature(1, C);
  const dmg = (i) => 1000 - (i.counters.currentHp ?? 1000);
  t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
  gs.currentPhase = 2;
  const r = await t.activateCreature(0, 0, 0);
  R.check('Cavalry wurde aktiviert', r === true, r);
  R.check('Gegner-Held 0 verliert 50', t.hp(1, 0) === 750, t.hp(1, 0));
  R.check('A (Gegner, in Gegner-H0) nimmt 50', dmg(A) === 50, dmg(A));
  R.check('B (von mir gestohlen, liegt in Gegner-H0) nimmt 50', dmg(B) === 50, dmg(B));
  R.check('C (liegt in MEINER Held-0-Zone, vom Gegner gestohlen) bleibt unversehrt', dmg(C) === 0, dmg(C));
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
