'use strict';
// W4-neg-08 · Weapon Unleashing: kein Level-3-Stapel unter Ability-Negation (Al, 14.10.2026, Welle 4 / Nachtrag)
// Kartentext: „This Spell can only be used by a Hero with an Ability at level 3." (Magic Arts Lv0)
// Aufbau: Held 0 mit Fighting x3. Erwartung: aktivierbar ohne Negierung und bei leichter Form, NICHT bei harter Form und Stowaway.
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
  const wu = require('../../../../cards/effects/weapon-unleashing.js');
  for (const z of Object.keys(ZUSTAENDE)) {
    const t = t_last = await H.fresh({ abilities: { 0: { 0: [['Fighting', 'Fighting', 'Fighting'], [], []] } } });
    await negiere(t, 0, 0, z);
    t.gs.currentPhase = 3;
    const ok = !!wu.canActivate(t.gs, 0, t.engine);
    R.check(`${z}: Weapon Unleashing ${FUNKT[z] ? 'aktivierbar' : 'NICHT aktivierbar'}`, ok === FUNKT[z], ok);
  }
  R.check('keine Engine-Fehler', t_last.errors.length === 0, t_last.errors);
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
