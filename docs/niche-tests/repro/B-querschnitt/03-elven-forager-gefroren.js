'use strict';
// Elven Forager (Creature, Lv1): „"Elven" Creatures in your hand and deck have their levels reduced by 1."
// Aufbau: Held 0 mit Summoning Magic Lv1; Elven Leader (Lv2) auf der Hand. Mit wirksamem Forager ist Leader Lv1 ⇒ beschwörbar; ohne/bei stillgelegtem Forager Lv2 ⇒ nicht.
// Erwartung (Konvention: gefrorene/betäubte/negierte Kreaturen verlieren ihre Effekte): stillgelegter Forager senkt nichts.
// Beobachtung: der Stufensenker-Weg (`_applyCardLevelReductions`, _engine.js ~43930) prüft nur `inst.isActiveIn()` (Zone), keine Status.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const mode of ['ohne Forager', 'normal', 'frozen', 'stunned', 'negated']) {
    const t = await H.fresh({ hand: [['Elven Leader'], []] });
    t.setAbilities(0, 0, [['Summoning Magic'], [], []]);
    if (mode !== 'ohne Forager') {
      const inst = t.put(0, 1, 0, 'Elven Forager');
      if (mode === 'frozen') await t.engine.applyCreatureStatus(inst, 'frozen', { sourceOwner: 1, duration: 9 });
      if (mode === 'stunned') await t.engine.applyCreatureStatus(inst, 'stunned', { sourceOwner: 1, duration: 9 });
      if (mode === 'negated') await t.engine.actionNegateCreature(inst, 'Test Source');
    }
    const r = await t.play(0, 'Elven Leader', { hero: 0, noGrant: true });
    const summoned = !!t.find('Elven Leader', 'support');
    if (mode === 'ohne Forager') R.check('ohne Forager: Elven Leader (Lv2) ist mit Summoning Magic 1 nicht beschwörbar', !summoned, { r, summoned });
    else if (mode === 'normal') R.check('normal: Forager senkt Leader auf Lv1 ⇒ beschwörbar', summoned, { r, summoned });
    else R.check(`${mode}: Forager stillgelegt ⇒ keine Senkung ⇒ Leader nicht beschwörbar`, !summoned, { r, summoned });
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
