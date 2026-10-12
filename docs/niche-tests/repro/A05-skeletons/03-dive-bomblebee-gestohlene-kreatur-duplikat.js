'use strict';
// A05-skeletons-03 · Dive Bomblebee: gestohlene Kreatur → Karte bleibt im Support-Slot, Instanz weg, Kopie im Deck (Duplikat)
// Kartentext (Dive Bomblebee): „… choose a card on your opponent's side of the board that is not a Hero and place it at the bottom of your opponent's deck."
// Aufbau: Seite 1 hat eine Kreatur von Seite 0 gestohlen (actionStealCreature; sie bleibt physisch in Seite 0 Held 1 Slot 0, controller = 1).
//   Seite 0 hat Dive Bomblebee; ein Gegner-Ziel (Seite 1) stirbt.
// Erwartung: Entweder wird die gestohlene Kreatur gar nicht angeboten (sie liegt auf MEINER Seite) oder sie wird sauber vom Brett genommen;
//   in keinem Fall bleibt der Name in meinem Support-Slot stehen, während die Instanz getilgt ist und eine Kopie im Gegner-Deck liegt.
// Beobachtet: Kreatur steht weiter in supportZones[0][1][0] (ohne Instanz → audit: „0 Instanzen") UND ein Exemplar liegt unten im Deck des Gegners
//   (Kartenbilanz +1).
// Ursache: dive-bomblebee.js `pickableOppCards` filtert nach controller, `runOpponentDeathPayload` spleißt aber aus `gs.players[oi].supportZones`
//   (die Brettseite einer gestohlenen Kreatur ist `physicalSide(inst)` = owner).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({});
  const dive = t.put(0, 0, 0, 'Dive Bomblebee'); dive.turnPlayed = 1;
  const opfer = t.put(1, 2, 2, H.INERT.frail);
  const meine = t.put(0, 1, 0, H.INERT.big);
  t.engine.actionStealCreature(1, meine);
  t.targetFn = (valid) => { const v = valid.find(x => x.cardName === H.INERT.big); return v ? [v.id] : [valid[0].id]; };
  const c0 = t.census();
  await t.run(() => t.engine.actionDestroyCard({ name: 'x', owner: 0 }, opfer));
  const bilanz = t.censusDiff(c0, t.census());
  R.note('Kartenbilanz', bilanz);
  R.check('Zustand sauber (Zone ↔ Instanz)', t.audit().length === 0, t.audit());
  R.check('Kartenbilanz: nur das besiegte Ziel verlässt das Brett (keine Kopie entsteht)', !bilanz.includes(H.INERT.big + ': +1'), bilanz);
  R.finish();
})();
