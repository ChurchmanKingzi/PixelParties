'use strict';
// A05-skeletons-11 · Sparkfly Attendant: Die Aura („Queen unaffected by opponent's cards and effects") bleibt dauerhaft, auch wenn der Attendant weg/negiert ist
// Kartentext (Sparkfly Attendant): „While you control this Creature, "Sparkfly Queen" Creatures you control are unaffected by your opponent's cards and effects."
// Erwartung: Verlässt der Attendant das Brett (zerstört/besiegt), verliert die Queen den Schutz sofort; ebenso solange er negiert ist (statischer Effekt).
// Beobachtet: `refreshAttendantAura` läuft nur über Hooks des Attendants selbst (onPlay/onCardEnterZone/onCardLeaveZone/onGameStart). Beim eigenen Abgang
//   ist er noch gezählt bzw. sein Hook feuert nicht mehr → `_oppEffectImmune`, `_oppDamageImmune`, `_sparkflyAttendantAura` bleiben auf der Queen stehen
//   (auch nach zwei Zugwechseln). Die Queen ist damit dauerhaft gegen Gegnerschaden und Gegnereffekte immun.
// Ursache: `_sparkfly-shared.js:refreshAttendantAura` wird nur aus attendant-eigenen Hooks aufgerufen; weder Tod des Attendants noch Negation lösen ein Refresh aus.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  // (a) Attendant zerstört
  let t = await H.fresh({});
  let att = t.put(0, 0, 0, 'Sparkfly Attendant'); att.turnPlayed = 1;
  let q = t.put(0, 0, 1, 'Sparkfly Queen'); q.turnPlayed = 1;
  await t.run(() => t.engine.runHooks('onPlay', { _onlyCard: att, playedCard: att, cardName: att.name, zone: 'support', heroIdx: 0, zoneSlot: 0 }));
  R.check('Aufbau: Queen trägt die Aura', !!q.counters._sparkflyAttendantAura, q.counters);
  await t.run(() => t.engine.actionDestroyCard({ name: 'x', owner: 0 }, att));
  R.check('Aufbau: Attendant ist vom Brett', !t.engine.cardInstances.includes(att) || att.zone !== 'support', att.zone);
  const hp0 = q.counters.currentHp ?? 150;
  await t.run(() => t.engine.actionDealCreatureDamage({ name: 'x', owner: 1 }, q, 100, 'creature', { sourceOwner: 1 }));
  R.check('(a) nach dem Abgang des Attendants nimmt die Queen Gegnerschaden', (q.counters.currentHp ?? 150) < hp0, q.counters);
  R.check('(a) Aura-Flags sind von der Queen entfernt', !q.counters._oppEffectImmune && !q.counters._oppDamageImmune && !q.counters._sparkflyAttendantAura, q.counters);
  // (b) Attendant negiert
  t = await H.fresh({});
  att = t.put(0, 0, 0, 'Sparkfly Attendant'); att.turnPlayed = 1;
  q = t.put(0, 0, 1, 'Sparkfly Queen'); q.turnPlayed = 1;
  await t.run(() => t.engine.runHooks('onPlay', { _onlyCard: att, playedCard: att, cardName: att.name, zone: 'support', heroIdx: 0, zoneSlot: 0 }));
  await t.run(() => t.engine.actionNegateCreature(att, 'test'));
  const hp1 = q.counters.currentHp ?? 150;
  await t.run(() => t.engine.actionDealCreatureDamage({ name: 'x', owner: 1 }, q, 100, 'creature', { sourceOwner: 1 }));
  R.check('(b) solange der Attendant negiert ist, nimmt die Queen Gegnerschaden (B-Lesart)', (q.counters.currentHp ?? 150) < hp1, q.counters);
  R.finish();
})();
