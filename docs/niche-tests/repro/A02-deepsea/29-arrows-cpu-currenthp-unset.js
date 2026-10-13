'use strict';
// A02-deepsea-29 · Aquatic Arrows (CPU-Weg): frisch gelegte Kreaturen haben kein `counters.currentHp` – `?? 0` zählt sie als „sterben am Flächenschaden"
//
// Kartentext (Aquatic Arrows): „Deal 100 damage to all Creatures in that Hero's Support Zones."
// Aufbau: Gegner hat genau EINE Kreatur mit 1000 HP unter dem Host-Helden; die CPU (Sitz 0) entscheidet über die Aktivierung.
// Erwartung: `kills` = Zahl der Kreaturen mit HP <= 100 -> 0; ziele.length = 1 -> Heuristik `kills >= 1 || ziele.length >= 2` = false (nicht lohnend).
// Beobachtet: `counters.currentHp` wird erst beim ersten Schaden angelegt (`summonCreature` setzt es nicht, siehe `_engine.js` ~Z. 46382);
//   `(z.counters?.currentHp ?? 0) <= AOE_DAMAGE` hält die unbeschädigte 1000-HP-Kreatur für einen Kill -> {confirmed:true}.
const H = require('../../lib/h.js');
const AA = require('../../../../cards/effects/aquatic-arrows.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [[], []] });
  t.put(1, 0, 0, H.INERT.big);
  t.engine._cpuPlayerIdx = 0;
  const r = AA.cpuResponse(t.engine, 'generic', { type: 'confirm', title: 'Aquatic Arrows', _hostHeroIdx: 0 });
  R.check('CPU aktiviert Aquatic Arrows nicht gegen eine einzelne unversehrte 1000-HP-Kreatur (kein Kill, < 2 Ziele)', r && r.confirmed === false, r);
  R.finish();
})();
