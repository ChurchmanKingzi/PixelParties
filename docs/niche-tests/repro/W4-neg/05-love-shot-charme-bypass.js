'use strict';
// W4-neg-05 · Love Shot: der Charme-Level-Bypass fehlt unter Ability-Negation (Al, 14.10.2026, Welle 4 / Nachtrag)
// Kartentext: „This Spell can be used by Heroes with the "Charme" Ability regardless of its level." (Love Shot ist Magic Arts Lv1)
// Al: „Love Shot, Lizbeth und Co haben unter Ability-Negation keinen Zugriff auf die entsprechenden Abilities."
// Aufbau: Held 0 mit Charme x1, OHNE Magic Arts. Erwartung: Stufenpruefung fuer Love Shot erfuellt ohne Negierung und bei leichter Form (nur Effekt),
//   NICHT erfuellt bei harter Standardform und beim Stowaway.
const H = require('../../lib/h.js');
const ZUSTAENDE = {
  ohne: null,
  leicht: { effectOnly: true },
  hart: { sourceBound: true, noAbsorb: true },
  stowaway: { _fromAttachment: 'Stowaway', abilitiesNegated: true, permanent: true },
};
const karte = (name) => { const c = require('../../../../data/cards.json'); const a = Array.isArray(c) ? c : Object.values(c); return a.find(x => x.name === name); };
const negiere = async (t, seite, hi, z) => { if (ZUSTAENDE[z]) await t.engine.addHeroStatus(seite, hi, 'negated', { appliedBy: 1 - seite, source: 'Test', ...ZUSTAENDE[z] }); };
const FUNKT = { ohne: true, leicht: true, hart: false, stowaway: false };   // Zugriff auf die Ability besteht nur ohne Abilities-Negation
(async () => {
  const R = H.runner(); let t_last;
  for (const z of Object.keys(ZUSTAENDE)) {
    const t = t_last = await H.fresh({ abilities: { 0: { 0: [['Charme'], [], []] } } });
    await negiere(t, 0, 0, z);
    const ok = t.engine.heroMeetsLevelReq(0, 0, karte('Love Shot'));
    R.check(`${z}: Love Shot per Charme ${FUNKT[z] ? 'spielbar' : 'NICHT spielbar'}`, ok === FUNKT[z], ok);
  }
  R.check('keine Engine-Fehler', t_last.errors.length === 0, t_last.errors);
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
