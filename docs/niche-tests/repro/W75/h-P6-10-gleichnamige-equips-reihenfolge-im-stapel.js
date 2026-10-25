'use strict';
// W75 · Darion · P6 (Engine `_removeCardFromState`/`entferneNameAmPlatz`, `actionTransferAttachment`, `fuehreUmhaengenAus`) — GLEICHNAMIGE Equips im Stapel: geht eine bestimmte Kopie, muss der Namens-
// Eintrag verschwinden, der ihrer Legereihenfolge entspricht (die oberste Karte des Stapels = letzter Name), nicht blind der erste gleichnamige. Sonst zeigt der Stapel nach dem Abgang der oberen
// Kopie eine andere Karte oben als vorher.
// Kartentext Darion: „All Artifacts equipped to this Hero share 1 Support Zone."
// Erwartet: Stapel [Club#1, Blade, Club#2 (oben)]. (1) Club#2 geht in die Ablage -> [Club, Blade] (Blade oben). (2) Stattdessen Club#1 geht -> [Blade, Club] (Club oben). (3) Umhaengen (actionTransferAttachment)
// der oberen Kopie zu einem anderen Helden laesst [Club, Blade] zurueck. Namen-Array und Instanzen bleiben konsistent (`t.audit()`).
// Aufruf: node docs/niche-tests/repro/W75/h-P6-10-gleichnamige-equips-reihenfolge-im-stapel.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const D = 'Darion, the Blood-Crazy Groundskeeper', T = 'Tushu, the Knowledge Keeper', F = H.INERT.filler;
async function szene() {
  const t = await H.fresh({ active: 0, heroes: [[D, T, null], [T, null, null]], hand: [[F], [F]] });
  const ps = t.gs.players[0];
  ps.supportZones[0][1] = [];
  const ins = ['Club of Gobbo', 'Blade of the Frostbringer', 'Club of Gobbo'].map(n => { ps.supportZones[0][1].push(n); const i = t.engine._trackCard(n, 0, 'support', 0, 1); i.turnPlayed = 1; return i; });
  return { t, ins, zone: () => JSON.stringify(ps.supportZones[0][1]) };
}
(async () => {
  const R = H.runner();
  R.section('1) die obere Kopie geht in die Ablage');
  {
    const { t, ins, zone } = await szene();
    await t.run(() => t.engine.actionMoveCard(ins[2], 'discard', -1, -1, { source: 'Test' }));
    R.check('Stapel [Club, Blade] (Blade oben)', zone() === JSON.stringify(['Club of Gobbo', 'Blade of the Frostbringer']), zone());
    R.check('Sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  R.section('2) die untere Kopie geht in die Ablage');
  {
    const { t, ins, zone } = await szene();
    await t.run(() => t.engine.actionMoveCard(ins[0], 'discard', -1, -1, { source: 'Test' }));
    R.check('Stapel [Blade, Club] (Club oben)', zone() === JSON.stringify(['Blade of the Frostbringer', 'Club of Gobbo']), zone());
    R.check('Sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  R.section('3) die obere Kopie wird zu Tushu umgehaengt');
  {
    const { t, ins, zone } = await szene();
    const r = await t.run(() => t.engine.actionTransferAttachment(ins[2], 0, 1, 0, { sourceName: 'Test', skipAnimation: true }));
    R.check('Umhaengen gelang', r && r.success, r);
    R.check('Darion behaelt [Club, Blade]', zone() === JSON.stringify(['Club of Gobbo', 'Blade of the Frostbringer']), zone());
    R.check('Tushu traegt die Kopie', JSON.stringify(t.gs.players[0].supportZones[1][0]) === JSON.stringify(['Club of Gobbo']), t.gs.players[0].supportZones[1]);
    R.check('Sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  R.finish();
})();
