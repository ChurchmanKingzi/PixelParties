'use strict';
// W16c · A04-cute-18 (Variante): Wildur hat den Familiar-Kadaver auf den Coolness Stack gelegt; Wowhalla legt am Zugende noch eine Karte
// DARÜBER – der Familiar kehrt trotzdem zurück, der Stack verliert genau die Kadaver-Kopie, es bleibt keine Waisen-Instanz.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const FA = 'Cute Familiar';
  const t = await H.fresh({ deck: [Array(8).fill(H.INERT.creature), Array(8).fill(H.INERT.creature)] });
  t.setAbilities(0, 1, [['Charme', 'Charme'], [], []]);
  t.putArea(0, 'Wowhalla, the Hall of the Cool');
  const ps = t.gs.players[0]; ps.coolnessStack.push('Cute Bunny'); t.engine._trackCard('Cute Bunny', 0, 'coolnessStack');
  const w = t.put(0, 2, 0, 'Wildur, the Shining Coolness'); w.turnPlayed = 0;
  const fam = t.put(0, 0, 0, FA);
  await t.turnStart(0);
  await t.run(() => t.engine.actionDealCreatureDamage({ name: 'Test', owner: 1, heroIdx: 0 }, fam, 999, 'creature', { sourceOwner: 1 }));
  R.check('Aufbau: Kadaver liegt auf dem Stack, nicht in der Ablage', ps.coolnessStack.includes(FA) && !ps.discardPile.includes(FA), { stack: ps.coolnessStack.slice(), ablage: ps.discardPile.slice() });
  await t.endTurn();
  R.check('Familiar ist am Zugende wieder auf dem Brett', !!t.find(FA, 'support'));
  R.check('Stack enthält keinen Familiar mehr', !ps.coolnessStack.includes(FA), ps.coolnessStack.slice());
  const stackInsts = t.inst(c => c.name === FA && c.zone === 'coolnessStack').length;
  R.check('keine Waisen-Instanz des Familiar im Stack', stackInsts === 0, stackInsts);
  R.check('Kartenbilanz sauber', t.audit().length === 0 && t.errors.length === 0, [t.audit(), t.errors]);
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
