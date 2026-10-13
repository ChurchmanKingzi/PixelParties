'use strict';
// C01-creatures-09 · Coreling: die „Haste" durch „Spirit of the Ultimate Gun" bleibt bestehen, wenn der Spirit im selben Zug das Brett verlässt
// Kartentext: „If you control „Spirit of the Ultimate Gun", this Creature may use this effect the turn it is summoned."
// Aufbau: Seed 1234, Spirit (alt) in Held-1-Zone, Coreling wird beschworen (Haste wird gesetzt), danach stirbt der Spirit (Main Phase 2 / dieselbe Phase).
// Erwartung: Ohne Spirit unter meiner Kontrolle ist die Kreatur im Beschwörungszug NICHT aktivierbar (Beschwörungsstarre gilt wieder).
// Beobachtet: Coreling feuert (50 Schaden auf den Gegner-Helden), obwohl der Spirit in der Ablage liegt.
// Ursache: cards/effects/coreling.js – `hasteAbgleichen` wird nur bei `onTurnStart`/`onPhaseStart`/`onCardEnterZone` aufgerufen;
//   `onCardLeaveZone`/`onCreatureDeath` rufen nur `handLevelAbgleichen` (Z. ~227-229, 201). Das Entziehen der Marke `_hasHaste` kommt erst beim nächsten Phasenstart.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const C = 'Coreling', SP = 'Spirit of the Ultimate Gun';
  const t = await H.fresh({ hand: [[C], []] });
  const gs = t.gs, e = t.engine;
  t.grantFor(0, 0, C);
  const sp = t.put(0, 1, 0, SP); sp.turnPlayed = 1;
  await t.play(0, C, { slot: 1 });
  const co = t.find(C, 'support');
  await t.run(() => e.actionDestroyCard({ name: 'X', owner: 1, heroIdx: 0 }, sp));
  R.note('Zustand', { spiritZone: sp.zone, haste: co.counters._hasHaste, phase: gs.currentPhase });
  gs.currentPhase = 4;
  t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
  const hp0 = t.hp(1, 0);
  const a = await t.activateCreature(0, co.heroIdx, co.zoneSlot);
  R.check('Coreling ist OHNE Spirit im Beschwörungszug nicht aktivierbar', a === false && t.hp(1, 0) === hp0, { a, dmg: hp0 - t.hp(1, 0) });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
