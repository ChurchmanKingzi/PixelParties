'use strict';
// W16c · A06-14/-28 (Variante Kreatur): Gorinthian betäubt eine KREATUR: Schaden 0, solange die Betäubung liegt (auch im letzten Zug),
// danach voller Schaden; ein anderweitig betäubtes Ziel ist nicht geschützt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const src = { name: 'Opp Source', owner: 0, heroIdx: 0 };
  const t = await H.fresh({});
  const g = t.put(0, 0, 0, 'Gorinthian War Counselor'); g.turnPlayed = t.gs.turn - 1;
  t.put(0, 0, 1, 'Cykyran War Counselor').turnPlayed = t.gs.turn - 1;
  const ziel = t.put(1, 0, 0, H.INERT.big);
  const fremd = t.put(1, 0, 1, H.INERT.big);
  await t.run(() => t.engine.applyCreatureStatus(fremd, 'stunned', { duration: 3, sourceOwner: 0, source: 'andere Quelle' }));
  t.gs.currentPhase = 2; t.resetActions(0);
  t.targetFn = (valid) => [valid.find(v => v.type === 'equip' && v.owner === 1 && v.slotIdx === 0).id];
  const r = await t.activateCreature(0, 0, 0);
  R.check('Aufbau: Ziel betäubt', r === true && !!ziel.counters.stunned, { r, c: ziel.counters });
  const dmg = async (inst) => { const v = inst.counters.currentHp ?? 1000; await t.run(() => t.engine.actionDealCreatureDamage(src, inst, 10, 'creature', { sourceOwner: 0 })); return v - (inst.counters.currentHp ?? 1000); };
  R.check('anderweitig betäubtes Ziel ist NICHT geschützt (10)', (await dmg(fremd)) === 10);
  for (let i = 0; i < 4; i++) {
    const stun = !!ziel.counters.stunned;
    const d = await dmg(ziel);
    R.check(`Zug ${t.gs.turn}: betäubt=${stun} → Schaden ${stun ? 0 : 10}`, stun ? d === 0 : d === 10, { stun, d });
    await t.endTurn();
  }
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
