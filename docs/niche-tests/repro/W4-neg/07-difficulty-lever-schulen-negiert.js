'use strict';
// W4-neg-07 · Difficulty Lever: Schulen eines Helden mit negierten Abilities zaehlen nicht als "hat" (Al, 14.10.2026, Welle 4 / Nachtrag)
// Kartentext: „Choose a Spell … and a Spell School that none of your Heroes (including defeated ones) has from your hand."
// Aufbau: Hand: Difficulty Lever + Fireball (Destruction Magic); Held 0 hat Destruction Magic x1. Ohne Negierung/leichte Form hat ein Held die Schule -> Fireball nicht waehlbar -> Karte nicht aktivierbar.
//   Bei harter Form/Stowaway zaehlt Held 0 nicht (Abilities negiert) -> Fireball waehlbar -> aktivierbar (Held 1 und 2 sind faehig).
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
  const lever = require('../../../../cards/effects/difficulty-lever.js');
  for (const z of Object.keys(ZUSTAENDE)) {
    const t = t_last = await H.fresh({ hand: [['Difficulty Lever', 'Fireball'], []], abilities: { 0: { 0: [['Destruction Magic'], [], []] } } });
    await negiere(t, 0, 0, z);
    t.gs.currentPhase = 3;
    const ok = !!lever.canActivate(t.gs, 0, t.engine);
    R.check(`${z}: Difficulty Lever ${FUNKT[z] ? 'NICHT aktivierbar (Schule vorhanden)' : 'aktivierbar (Schule gilt als nicht vorhanden)'}`, ok === !FUNKT[z], ok);
  }
  R.check('keine Engine-Fehler', t_last.errors.length === 0, t_last.errors);
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
