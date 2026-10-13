'use strict';
// C03-creatures-14 · Lovely Teddy: eine geklaute Kreatur an derselben (Held, Slot)-Stelle der anderen Brettseite macht die gegnerische Kreatur unborgbar (Wurzel F02-14)
// Kartentext: „You may once per turn choose a Creature your opponent controls. You may use that Creature's active effects as if you controlled it for the rest of the turn."
// Aufbau: Sitz 0: Lovely Teddy (Held 0 / Slot 0) und Haressassin Y (Held 1 / Slot 0, Besitzer 0); Sitz 1 stiehlt Y (`actionStealCreature(1, Y)` ⇒ Kontrolle 1, Brettseite 0).
//   Sitz 1: Mr. Jiggles X (Held 1 / Slot 0). Y wurde VOR X angelegt (Instanzreihenfolge). Sitz 0 aktiviert Teddy.
// Erwartung: X ist eine Kreatur, die der Gegner kontrolliert, mit aktivem Effekt ⇒ borgbar (Teddy aktivierbar, X danach unter Kontrolle von Sitz 0).
// Beobachtet: Teddy ist nicht aktivierbar (r = false, keine Zielliste). `getCreatureTargets(1)` löst die Stelle (Held 1 / Slot 0) auf Y statt X auf; Y trägt `stolenBy` ⇒ von Teddys Filter
//   ausgeschlossen, X fällt mit heraus. Vertauschte Anlegereihenfolge (X vor Y): X wird korrekt angeboten und geborgt.
// Ursache: cards/effects/_engine.js ~40263 `getCreatureTargets` (Instanzsuche `(c.owner === playerIdx || c.controller === playerIdx)` ohne Brettseite) – dieselbe Wurzel wie F02-14.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({});
  const teddy = t.put(0, 0, 0, 'Lovely Teddy'); teddy.turnPlayed = 1;
  const Y = t.put(0, 1, 0, 'Haressassin'); Y.turnPlayed = 1;
  const X = t.put(1, 1, 0, 'Mr. Jiggles'); X.turnPlayed = 1;
  t.engine.actionStealCreature(1, Y);
  t.targetFn = (valid) => { const v = valid.find(x => x.cardName === 'Mr. Jiggles'); return v ? [v.id] : null; };
  t.gs.activePlayer = 0; t.phase(2);
  const r = await t.run(() => t.host.doActivateCreatureEffect(t.room, 0, { heroIdx: 0, zoneSlot: 0 }));
  R.note('Aktivierung / Kontrolle X', [r, X.controller]);
  R.check('Mr. Jiggles ist borgbar (Kontrolle danach bei Sitz 0)', X.controller === 0, { r, controllerX: X.controller });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
