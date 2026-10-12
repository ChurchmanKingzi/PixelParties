'use strict';
// The Thing in the Ship (Creature): „While this Creature remains on the board, NEITHER PLAYER can activate the active effects of their Abilities."
// Erwartung (Konvention: gefrorene/betäubte/negierte Kreaturen verlieren ihre Effekte, `engine.isCreatureEffectSuppressed`): ist sie stillgelegt, gilt die Sperre nicht mehr.
// Beobachtung: `engine.abilityActivationBlocked()` (_engine.js ~10729) fragt nur „liegt eine offene Kreatur mit blocksAbilityActivation auf dem Brett" – ohne Status-Prüfung.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const mode of ['normal', 'frozen', 'stunned', 'negated']) {
    const t = await H.fresh({});
    const inst = t.put(1, 0, 0, 'The Thing in the Ship');
    if (mode === 'frozen') await t.engine.applyCreatureStatus(inst, 'frozen', { sourceOwner: 0, duration: 9 });
    if (mode === 'stunned') await t.engine.applyCreatureStatus(inst, 'stunned', { sourceOwner: 0, duration: 9 });
    if (mode === 'negated') await t.engine.actionNegateCreature(inst, 'Test Source');
    const blocked = t.engine.abilityActivationBlocked();
    if (mode === 'normal') R.check('normal: Ability-Aktivierung ist gesperrt', blocked === true, blocked);
    else R.check(`${mode}: Kreatur ist stillgelegt (isCreatureEffectSuppressed=${t.engine.isCreatureEffectSuppressed(inst)}) ⇒ Sperre müsste entfallen`, blocked === false, { blocked });
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
