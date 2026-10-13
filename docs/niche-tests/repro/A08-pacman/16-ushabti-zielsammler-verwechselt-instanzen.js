// A08-16 · Ushabti of the Great Pharaoh: die Zielwahl findet die Instanz über „Besitzer ODER Kontrolleur" + Koordinaten + Name und greift bei gleichnamigen Kreaturen die FALSCHE
//
// Kartentext: „Choose any Creature on the board and place it face-down into the Surprise Zone of the corresponding Hero."
// Aufbau: Sitz 1 hat „ZZ Dummy" (Held 0, Slot 0), Sitz 0 hat ebenfalls „ZZ Dummy" (Held 0, Slot 0). Sitz 0 stiehlt die Kreatur von Sitz 1 (Kontrolleur 0, steht weiter auf Seite 1).
// Sitz 0 spielt Ushabti und wählt die EIGENE Kreatur (Brettspalte Sitz 0).
// Erwartung: die eigene Kreatur wandert in die Surprise Zone von Sitz 0 / Held 0; die gestohlene bleibt unberührt auf Seite 1.
// Beobachtet: `_getEligibleCreatures` (ushabti-of-the-great-pharaoh.js ~Z. 132) sucht `(c.owner === pi || c.controller === pi) && zone/heroIdx/slot/name` und trifft die
//   gestohlene Kreatur (controller === 0, steht aber auf Seite 1, gleiche Koordinaten + Name). Die Instanz der GESTOHLENEN wandert in die Surprise Zone von Sitz 0, ihr Name
//   bleibt aber in Support Zone von Seite 1 stehen, die eigene Instanz bleibt in der Support Zone und ihr Name wird aus ihr entfernt: Geister-Instanz + doppelter Name (audit() ✗).
// Aufruf: node docs/niche-tests/repro/A08-pacman/16-ushabti-zielsammler-verwechselt-instanzen.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const D = H.INERT.creature;
  const t = await H.fresh({ hand: [[], []] });
  const B = t.put(1, 0, 0, D); B.turnPlayed = 1;     // zuerst angelegt (steht früher in cardInstances)
  const A = t.put(0, 0, 0, D); A.turnPlayed = 1;
  t.engine.actionStealCreature(0, B);
  t.targetFn = (v) => [v.find(x => x.type === 'equip' && x.owner === 0).id];   // eigene Kreatur wählen
  const r = await t.play(0, 'Ushabti of the Great Pharaoh', {});
  R.note('Spielweg', JSON.stringify({ r, A: A.zone, B: B.zone, Bctrl: B.controller }));
  R.check('die gewählte eigene Kreatur liegt jetzt in der Surprise Zone', A.zone === 'surprise', A.zone);
  R.check('die gestohlene Gegner-Kreatur bleibt auf dem Brett', B.zone === 'support', B.zone);
  R.check('Zustand sauber (keine Geister-Instanz)', t.audit().length === 0, t.audit());
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
