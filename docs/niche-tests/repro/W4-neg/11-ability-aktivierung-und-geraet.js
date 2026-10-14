'use strict';
// W4-neg-11 · Ability-Aktivierung und Communication Device unter harter Negierung (Al, 14.10.2026, Welle 4 / Nachtrag)
// Al: „Jede Negierung von Abilities ..." / "keinen Zugriff auf die entsprechenden Abilities".
// (a) Aktive Ability (Adventurousness): aktivierbar ohne Negierung und bei leichter Form; NICHT bei harter Standardform (bisher fehlerhaft aktivierbar) und Stowaway.
// (b) Communication Device: Held 0 und Held 1 tragen je eins; Held 1 hat Destruction Magic x2 -> Held 0 kann Fireball (Lv2) per Geraet; nicht mehr, wenn Held 1 (Geber) hart negiert ist.
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
    const t = t_last = await H.fresh({ abilities: { 0: { 0: [['Adventurousness'], [], []] } } });
    await negiere(t, 0, 0, z);
    t.gs.currentPhase = 3;
    const ok = (t.engine.getActivatableAbilities(0) || []).some(a => a.heroIdx === 0);
    R.check(`${z}: Adventurousness ${FUNKT[z] ? 'aktivierbar' : 'NICHT aktivierbar'}`, ok === FUNKT[z], ok);
  }
  for (const z of Object.keys(ZUSTAENDE)) {
    const t = t_last = await H.fresh({ abilities: { 0: { 1: [['Destruction Magic', 'Destruction Magic'], [], []] } } });
    t.put(0, 0, 0, 'Communication Device'); t.put(0, 1, 0, 'Communication Device');
    await negiere(t, 0, 1, z);
    const ok = t.engine.heroMeetsLevelReq(0, 0, karte('Fireball'));
    R.check(`${z} (Geber Held 1): Geraet ${FUNKT[z] ? 'liefert die Stufe' : 'liefert nichts'}`, ok === FUNKT[z], ok);
  }
  R.check('keine Engine-Fehler', t_last.errors.length === 0, t_last.errors);
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
