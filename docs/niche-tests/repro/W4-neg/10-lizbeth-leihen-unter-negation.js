'use strict';
// W4-neg-10 · Lizbeth: kein Zugriff auf geliehene Abilities unter Ability-Negation (Al, 14.10.2026, Welle 4 / Nachtrag)
// Kartentext (Lizbeth, the Reaper of the Light): behandelt die Abilities der Gegner-Helden, als haetten sie sie selbst (Leihen).
// Aufbau: Lizbeth = Sitz 0 Held 0 (keine eigenen Abilities), Gegner-Held 0 hat Destruction Magic x2; Sitz 0 am Zug. Fireball (Destruction Lv2) ist nur per Leihe spielbar.
// Erwartung: ohne Negierung spielbar; bei Negierung von LIZBETH (harte Form, Stowaway) NICHT; leichte Form: ebenfalls nicht (der Leih-Effekt ist ihr Heldeneffekt, ist negiert - Ruling unveraendert).
// Gegenprobe: Quelle (Gegner-Held) in harter Form negiert -> nichts zu leihen.
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
  const mkt = async () => H.fresh({ heroes: [['Lizbeth, the Reaper of the Light', 'Rick, the Trigger Happy Undertaker', 'Zwei, the Lucky Thief'], undefined], abilities: { 1: { 0: [['Destruction Magic', 'Destruction Magic'], [], []] } } });
  const erwartet = { ohne: true, leicht: false, hart: false, stowaway: false };
  for (const z of Object.keys(ZUSTAENDE)) {
    const t = t_last = await mkt();
    await negiere(t, 0, 0, z);
    const ok = t.engine.heroMeetsLevelReq(0, 0, karte('Fireball'));
    R.check(`${z}: Lizbeth ${erwartet[z] ? 'spielt Fireball per Leihe' : 'kann nicht leihen'}`, ok === erwartet[z], ok);
  }
  { const t = t_last = await mkt();
    await negiere(t, 1, 0, 'hart');
    R.check('Quelle hart negiert: keine Leihe', t.engine.heroMeetsLevelReq(0, 0, karte('Fireball')) === false); }
  R.check('keine Engine-Fehler', t_last.errors.length === 0, t_last.errors);
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
