'use strict';
// S03-08 · Petrifier: wird die Betäubung einer Kreatur GEHEILT, bleibt der Versteinerungs-Marker und die Kreatur ist dauerhaft unverwundbar
// Kartentext: „Choose a target except the user and Stun it for 3 turns. Damage a target Stunned by this effect would take becomes 0."
// Skriptkopf: „Der Marker `_petrified` sitzt AM Stun und verschwindet mit ihm." / _engine.js ~45206: „sonst bliebe die Kreatur dauerhaft unverwundbar".
// Aufbau: Sitz 0 versteinert die 1000-HP-Kreatur von Sitz 1 (Petrifier); Sitz 1 ist am Zug und spielt Beer (Cleanse „Stunned"); danach 100 Schaden.
// Erwartet: Nach dem Heilen der Betäubung ist „Stunned by this effect" nicht mehr erfüllt ⇒ die Kreatur nimmt wieder Schaden (1000 → 900).
// Beobachtet: `cleanseCreatureStatuses` räumt `stunned*` weg, aber `counters._petrified` bleibt stehen; der Schadenspfad liest nur den Marker
//   (`_engine.js` ~46187) ⇒ 0 Schaden, auch nach beliebig vielen Zugwechseln. Nur der Ablauf der Dauer (~45208) löscht den Marker.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Petrifier'], ['Beer']], hp: 500, gold: [100, 100] });
  const c = t.put(1, 0, 0, 'ZZ Dummy Big');
  t.targetFn = (valid) => [valid.find(v => v.type === 'equip').id];
  await t.play(0, 'Petrifier', { hero: 0 });
  R.check('Ausgangslage: Kreatur ist versteinert (stunned + _petrified)', !!c.counters.stunned && !!c.counters._petrified, c.counters);
  await t.endTurn();
  t.targetFn = (valid) => { const v = valid.find(q => q.type === 'equip' && q.owner === 1); return v ? [v.id] : null; };
  t.script.push({ match: d => d.type === 'statusSelect', answer: (d) => ({ selectedStatuses: d.statuses.map(s => s.key) }) });
  await t.play(1, 'Beer', { hero: 0 });
  R.check('Betäubung wurde geheilt', !c.counters.stunned, c.counters);
  const vorher = c.counters.currentHp ?? 1000;
  await t.engine.actionDealCreatureDamage({ name: 'x', owner: 0, heroIdx: 0 }, c, 100, 'destruction_spell', { sourceOwner: 0 });
  R.check('die nicht mehr betäubte Kreatur nimmt 100 Schaden', (c.counters.currentHp ?? 1000) === vorher - 100, { vorher, nachher: c.counters.currentHp, counters: c.counters });
  R.check('Marker _petrified ist mit dem Stun verschwunden', !c.counters._petrified, c.counters);
  R.finish();
})();
