'use strict';
// C02-creatures-03 · Doomed Town Guard: zweite Kopie reagiert im selben Zug nicht auf einen späteren, getrennten Tod
// Kartentext: „Immediately summon this Creature when one or more targets you control are defeated by an opponent's card or effect."
// Skript-Kommentar: „one or more heißt: auch bei einem Mehrfachtod feuert die Karte EINMAL. Der Riegel `_dtgSummonedForDeath` klammert das ganze Sterbe-Ereignis."
//   Tatsächlich ist der Riegel eine Zugnummer (`ps._dtgSummonedForDeath === gs.turn`), gelöst erst im nächsten Zugbeginn.
// Aufbau: Sitz 0: zwei Dummies, ZWEI Doomed Town Guard auf der Hand; Sitz 1 besiegt nacheinander (zwei getrennte Ereignisse) beide Dummies.
// Erwartung: Jedes Ereignis ist ein eigener Auslöser → beide Kopien kommen (2 Wachposten auf dem Brett).
// Beobachtet: Nur die erste kommt; die zweite bleibt auf der Hand (kein Angebot).
// Ursache: cards/effects/doomed-town-guard.js ~Z. 111 und 143-148 (`_dtgSummonedForDeath === gs.turn`).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Doomed Town Guard', 'Doomed Town Guard'], []] });
  const mk = (s, h, z, n) => { const i = t.put(s, h, z, n); i.turnPlayed = 1; return i; };
  const x = mk(0, 0, 0, H.INERT.creature), y = mk(0, 1, 0, H.INERT.creature);
  await t.run(() => t.engine.actionDestroyCard({ name: 'Field Cannon', owner: 1, controller: 1 }, x));
  R.check('erster Tod → erster Wachposten', t.inst(c => c.name === 'Doomed Town Guard' && c.zone === 'support').length === 1);
  await t.run(() => t.engine.actionDestroyCard({ name: 'Field Cannon', owner: 1, controller: 1 }, y));
  const n = t.inst(c => c.name === 'Doomed Town Guard' && c.zone === 'support').length;
  R.check('zweiter, getrennter Tod → zweiter Wachposten (Kopie 2 von der Hand)', n === 2, { n, hand: t.pile(0, 'hand') });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
