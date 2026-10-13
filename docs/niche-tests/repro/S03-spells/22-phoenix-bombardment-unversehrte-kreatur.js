'use strict';
// S03-22 · Phoenix Bombardment: gegen eine UNVERSEHRTE Kreatur passiert nichts (Rückfall `counters.currentHp ?? 0`)
// Kartentext: „Reduce a target's HP to 1. Then, the user takes damage equal to the amount of HP reduced by this effect. Immediately end your turn afterwards."
// Aufbau: Sitz 1 beschwört „ZZ Dummy" (200 HP) über den echten Spielweg (counters = {} – currentHp wird erst beim ersten Schaden angelegt),
//   Sitz 0 spielt Phoenix Bombardment (Destruction Magic 2) auf die Kreatur; Gegenprobe: dieselbe Kreatur nach 1 Schadenspunkt (currentHp gesetzt).
// Erwartet: Kreatur-HP = 1, Wirker nimmt 199 Rückstoß, Zug endet (`gs._terrorForceEndTurn`).
// Beobachtet: `phoenix-bombardment.js` Z. 104 `vorher = inst.counters?.currentHp ?? 0; if (vorher <= 0) return;` – die Karte bricht lautlos ab (HP bleiben 200,
//   kein Rückstoß, kein Zugende); die Aktion ist verbraucht. Mit bereits beschädigter Kreatur rechnet die Karte richtig.
const H = require('../../lib/h.js');
async function lauf(vorschaden) {
  const t = await H.fresh({ hand: [['Phoenix Bombardment'], [H.INERT.creature]], hp: 800 });
  t.setAbilities(0, 0, [['Destruction Magic', 'Destruction Magic'], [], []]);
  await t.play(1, H.INERT.creature, { hero: 0, slot: 0 });
  const inst = t.engine.cardInstances.find(i => i.owner === 1 && i.zone === 'support' && i.name === H.INERT.creature);
  if (vorschaden) await t.engine.actionDealCreatureDamage({ name: 'Test', owner: 0 }, inst, 1, 'destruction_spell', { sourceOwner: 0 });
  const hpVor = inst.counters.currentHp;
  t.targetFn = (valid) => [valid.find(v => v.type === 'equip' && v.owner === 1).id];
  await t.play(0, 'Phoenix Bombardment', { hero: 0, noGrant: true });
  return { t, inst, hpVor };
}
(async () => {
  const R = H.runner();
  {
    const { t, inst } = await lauf(false);
    R.check('unversehrte Kreatur: HP auf 1 gesenkt', inst.counters.currentHp === 1, inst.counters);
    R.check('unversehrte Kreatur: Wirker nimmt 199 Rückstoß', t.hp(0, 0) === 800 - 199, t.hp(0, 0));
    R.check('unversehrte Kreatur: Zugende ausgelöst', t.gs._terrorForceEndTurn != null || t.gs.activePlayer === 1, { force: t.gs._terrorForceEndTurn, aktiv: t.gs.activePlayer });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  {
    const { t, inst, hpVor } = await lauf(true);
    R.note('Gegenprobe (vorbeschädigt)', { hpVor, hpNach: inst.counters.currentHp, wirker: t.hp(0, 0) });
    R.check('Gegenprobe: beschädigte Kreatur wird auf 1 gesenkt', inst.counters.currentHp === 1, inst.counters);
  }
  R.finish();
})();
