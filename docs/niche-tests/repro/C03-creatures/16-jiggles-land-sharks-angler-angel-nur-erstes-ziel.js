'use strict';
// C03-creatures-16 · Mr. Jiggles / Land Sharks + Angler Angel: bei mehreren Zielen erhöht Angler nur das erste (Bestätigung von C01-10 für zwei weitere Täter)
// Kartentext (Angler Angel): „All damage your other Creatures inflict with their effects is increased by 50."
// Kartentext (Mr. Jiggles): „… choose up to 2 targets your opponent controls and inflict 100 damage to them." / (Land Sharks): „… up to 1/2/3 targets … deal 100 damage to them."
// Aufbau: Sitz 0: Angler Angel (Held 0) + Täter (Held 1, Slot 0, nicht frisch); Sitz 1: Helden 0/1 + große Kreatur. Jiggles: Ziele Held 0 + Held 1; Land Sharks (SM 3): Held 0, Held 1, Kreatur.
// Erwartung (Ruling im Kopf von angler-angel.js 20.8. / C01-10): ein Schlag auf mehrere Ziele ist EINE Schadensinstanz – alle Ziele erhalten +50 (150 statt 100).
// Beobachtet: nur das erste Ziel bekommt 150, alle übrigen 100.
// Ursache: siehe C01-10 (`angler-angel.js` bucht die Rundensperre `angler-boost:<id>` beim ersten Treffer; Jiggles/Sharks bauen für jeden Treffer ein neues Literal-Quellobjekt `{ name, owner, heroIdx }` bzw. rufen `ctx.dealDamage` einzeln auf).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  {
    R.section('Mr. Jiggles: Held 0 + Held 1');
    const t = await H.fresh({});
    t.put(0, 0, 0, 'Angler Angel').turnPlayed = 1; t.put(0, 1, 0, 'Mr. Jiggles').turnPlayed = 1;
    t.targetFn = (valid) => [0, 1].map(i => valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === i).id);
    t.gs.activePlayer = 0; t.phase(2);
    await t.run(() => t.host.doActivateCreatureEffect(t.room, 0, { heroIdx: 1, zoneSlot: 0 }));
    const d = [800 - t.hp(1, 0), 800 - t.hp(1, 1)];
    R.note('Schaden Held 0 / Held 1', d);
    R.check('beide Helden 150', d[0] === 150 && d[1] === 150, d);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  {
    R.section('Land Sharks (SM 3): Held 0, Held 1, Kreatur');
    const t = await H.fresh({});
    t.setAbilities(0, 1, [Array(3).fill('Summoning Magic'), [], []]);
    t.put(0, 0, 0, 'Angler Angel').turnPlayed = 1;
    t.put(0, 1, 0, 'Land Sharks').turnPlayed = 1; t.gs.players[0].supportZones[1][1] = ['_ZoneBlocked']; t.gs.players[0].supportZones[1][2] = ['_ZoneBlocked'];
    const c = t.put(1, 2, 0, H.INERT.big);
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id, valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 1).id, valid.find(v => v.type === 'equip' && v.cardName === H.INERT.big).id];
    t.gs.activePlayer = 0; t.phase(2);
    await t.run(() => t.host.doActivateCreatureEffect(t.room, 0, { heroIdx: 1, zoneSlot: 0 }));
    const d = [800 - t.hp(1, 0), 800 - t.hp(1, 1), 1000 - c.counters.currentHp];
    R.note('Schaden Held 0 / Held 1 / Kreatur', d);
    R.check('alle drei Ziele 150', d.every(x => x === 150), d);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
