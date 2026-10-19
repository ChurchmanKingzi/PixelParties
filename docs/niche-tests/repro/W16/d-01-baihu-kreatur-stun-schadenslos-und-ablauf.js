'use strict';
// W16d · d-01 (zu A07-03): Cardinal Beast Baihu betäubt eine Kreatur WIRKLICH (counters.stunned, 3 Züge) und macht sie schadenslos
// („A target Stunned by this effect takes no damage from any sources"); mit dem Ablauf des Stuns fällt auch die Unverwundbarkeit.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ deckSize: 30 });
  const baihu = t.put(0, 0, 0, 'Cardinal Beast Baihu'); baihu.turnPlayed = 1;
  const ziel = t.put(1, 0, 0, H.INERT.big); ziel.turnPlayed = 1;
  t.targetFn = (v) => [v.find(x => x.cardName === H.INERT.big).id];
  t.gs.activePlayer = 0; t.phase(2);
  await t.activateCreature(0, 0, 0);
  R.check('Ziel ist betäubt (counters.stunned) und trägt den Marker', !!ziel.counters.stunned && !!ziel.counters._petrified, ziel.counters);
  const hp0 = ziel.counters.currentHp ?? 1000;
  await t.run(() => t.engine.actionDealCreatureDamage({ name: 'T', owner: 0, heroIdx: 0 }, ziel, 100, 'creature'));
  R.check('versteinertes Ziel nimmt keinen Schaden', (ziel.counters.currentHp ?? 1000) === hp0, ziel.counters.currentHp);
  // Ablauf: 3 Zugenden des Besitzers (Sitz 1)
  await t.endTurn();                      // Zug von Sitz 1
  await t.endTurn();                      // Ende Sitz 1 (1)  -> Zug Sitz 0
  await t.endTurn();                      // Zug Sitz 1
  await t.endTurn();                      // Ende Sitz 1 (2)
  await t.endTurn();                      // Zug Sitz 1
  await t.endTurn();                      // Ende Sitz 1 (3)
  R.check('nach 3 Zügen ist der Stun samt Unverwundbarkeit weg', !ziel.counters.stunned && !ziel.counters._petrified, ziel.counters);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
