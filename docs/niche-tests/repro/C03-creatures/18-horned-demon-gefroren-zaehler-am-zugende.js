'use strict';
// C03-creatures-18 · Horned Demon (gefroren/betäubt): bekommt am Ende des eigenen Zuges trotzdem den Demon Counter
// Kartentext: „At the end of each of your turns, place a Demon Counter on this Creature."
// Konvention (B-querschnitt B-01…B-03): eine gefrorene/betäubte Kreatur verliert ihre Effekte (`isCreatureEffectSuppressed`).
// Aufbau: Sitz 0: Horned Demon (alt, 1 Counter). Sitz 1 friert/betäubt ihn in SEINEM Zug (realistisch: Status hält über den ganzen nächsten Zug von Sitz 0).
//   Dann Zug von Sitz 0: Demon kann nicht aktiviert werden (✓ gefroren); Zugende von Sitz 0.
// Erwartung: Zähler bleibt unverändert (der Demon war den ganzen Zug gefroren/betäubt).
// Beobachtet: Zähler +1. Reihenfolge in der End-Phase (_engine.js ~22923 vs. ~23479): erst `processStatusExpiry('END')` (Frost/Betäubung fallen),
//   DANACH laufen die onTurnEnd-Hooks – der Demon ist beim Hook nicht mehr gefroren. (Gegenprobe Mimic: Zugbeginn-Hook, gefroren ⇒ kein Klau ✓.)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const status of ['frozen', 'stunned']) {
    const t = await H.fresh({});
    const demon = t.put(0, 0, 0, 'Horned Demon'); demon.turnPlayed = 1; demon.counters.demonCounter = 1;
    await t.endTurn();                                    // Sitz 1 am Zug
    await t.run(() => t.engine.applyCreatureStatus(demon, status, { sourceOwner: 1 }));
    await t.endTurn();                                    // Zug von Sitz 0, Demon ist noch gefroren/betäubt
    R.check(status + ': Status hält in den Zug von Sitz 0', !!demon.counters[status], demon.counters);
    t.gs.activePlayer = 0; t.phase(2);
    t.targetFn = (valid) => [valid[0].id];
    const r = await t.run(() => t.host.doActivateCreatureEffect(t.room, 0, { heroIdx: 0, zoneSlot: 0 }));
    R.check(status + ': Aktivierung abgewiesen', r === false, r);
    const vorher = demon.counters.demonCounter;
    await t.endTurn();                                    // Zugende von Sitz 0
    R.check(status + ': kein neuer Counter am Zugende (erwartet ' + vorher + ')', demon.counters.demonCounter === vorher, demon.counters.demonCounter);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
