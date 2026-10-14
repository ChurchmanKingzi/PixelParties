'use strict';
// W4-neg-09 · Sarcophagus of Sealed Magic: negierte Helden steuern keine Schulen zum Schaden bei (Al, 14.10.2026, Welle 4 / Nachtrag)
// Kartentext: „deal damage equal to 60 times the number of Spell School Abilities with different names attached to your undefeated Heroes."
// Aufbau: Sarcophagus bei Held 2 (ohne Abilities); Held 0 (Destruction + Decay Magic) wird negiert; Held 1 hat Magic Arts. Gegner-Held 0 (800 HP) wird getroffen.
//   Erwartung: ohne/leicht 3 Schulen = 180 Schaden; hart/Stowaway nur Held 1 = 1 Schule = 60.
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
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const erwartet = { ohne: 180, leicht: 180, hart: 60, stowaway: 60 };
  for (const z of Object.keys(ZUSTAENDE)) {
    const t = t_last = await H.fresh({ abilities: { 0: { 0: [['Destruction Magic'], ['Decay Magic'], []], 1: [['Magic Arts'], [], []] } } });
    t.put(0, 2, 0, 'Sarcophagus of Sealed Magic').turnPlayed = 0;   // keine Beschwoerungs-Sperre im selben Zug
    await negiere(t, 0, 0, z);
    t.targetFn = (valid) => { const v = valid.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0); return v ? [v.id] : null; };
    t.phase(2); t.gs.activePlayer = 0;
    const r = await t.activateCreature(0, 2, 0);
    await sleep(250);
    const schaden = 800 - t.hp(1, 0);
    R.check(`${z}: Schaden ${erwartet[z]}`, schaden === erwartet[z], { r, schaden });
  }
  R.check('keine Engine-Fehler', t_last.errors.length === 0, t_last.errors);
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
