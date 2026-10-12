'use strict';
// Plant Golem (Creature, Summoning Magic Lv1): „Summon this card into a free Support Zone of a Hero your opponent controls. The corresponding Hero cannot perform Actions."
// Erwartung (Konvention: gefrorene/betäubte/negierte Kreaturen verlieren ihre Effekte): nur ein arbeitender Golem sperrt den Wirtsheld.
// Beobachtung: `canHeroPerformAction` (_engine.js ~43410) übergeht den Golem nur bei `counters.negated`; gefroren/betäubt sperrt er weiter.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const mode of ['normal', 'frozen', 'stunned', 'negated']) {
    const t = await H.fresh({ hand: [['Plant Golem'], []] });
    t.script.push({ match: d => d && d.type === 'zonePick', answer: () => ({ heroIdx: 0, slotIdx: 0 }) });
    await t.play(0, 'Plant Golem', { hero: 0 });
    const inst = t.find('Plant Golem', 'support');
    if (mode === 'frozen') await t.engine.applyCreatureStatus(inst, 'frozen', { sourceOwner: 0, duration: 9 });
    if (mode === 'stunned') await t.engine.applyCreatureStatus(inst, 'stunned', { sourceOwner: 0, duration: 9 });
    if (mode === 'negated') await t.engine.actionNegateCreature(inst, 'Test Source');
    const can = t.engine.canHeroPerformAction(1, 0);   // Wirtsheld: Sitz 1, Held 0
    if (mode === 'normal') R.check('normal: Wirtsheld kann nicht handeln', can === false, can);
    else R.check(`${mode}: Golem stillgelegt (suppressed=${t.engine.isCreatureEffectSuppressed(inst)}) ⇒ Wirtsheld müsste wieder handeln können`, can === true, { can });
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
