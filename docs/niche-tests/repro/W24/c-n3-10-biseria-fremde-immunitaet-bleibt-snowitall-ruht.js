'use strict';
// W24 · N3-10 Absicherung: nur die EIGENE Frost-Immunität (Skript-Flag `selfFreezeImmune`) ruht bei Negation/Betäubung/Frost;
// eine fremde Quelle (The Sun Sword: `counters.buffs.freeze_immune`) bleibt auch an einer negierten Biseria; SnowItAll verhält sich wie Biseria.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  async function lauf(name, zustand, sonnenschwert) {
    const t = await H.fresh({});
    const b = t.put(0, 0, 0, name); b.turnPlayed = 1;
    b.counters.freeze_immune = 1;
    if (sonnenschwert) { b.counters.buffs = { freeze_immune: { source: 'The Sun Sword', nativ: true } }; }
    if (zustand === 'negiert') await t.run(() => t.engine.actionNegateCreature(b, 'Dark Gear'));
    await t.run(() => t.engine.applyCreatureStatus(b, 'frozen', { duration: 1, sourceOwner: 1 }));
    return { gefroren: !!b.counters.frozen, errors: t.errors };
  }
  for (const n of ['Embodiment of Biseria', 'Mischief Militia - SnowItAll']) {
    const gesund = await lauf(n, 'normal', false);
    R.check(`${n}: gesund unfreezable`, gesund.gefroren === false, gesund);
    const neg = await lauf(n, 'negiert', false);
    R.check(`${n}: negiert → einfrierbar`, neg.gefroren === true, neg);
    const sonne = await lauf(n, 'negiert', true);
    R.check(`${n}: negiert, aber Sun-Sword-Immunität → bleibt unfreezable`, sonne.gefroren === false, sonne);
    R.check(`${n}: keine Engine-Fehler`, [gesund, neg, sonne].every(x => x.errors.length === 0));
  }
  R.finish();
})();
