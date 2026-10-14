'use strict';
// W7-a/03 · Welle 7 (Al, 14.10.2026) + Zwei-Zustände-Modell (Welle 3/4): Ability-Passive (Terror, Stealth) ruhen bei Frost,
// Betäubung und „Abilities negiert" (harte Form) — die LEICHTE Negation („nur Effekt", `effectOnly`) lässt sie laufen.
// Heldeneffekt-Passive (Ghazma, Junshi …) ruhen bei JEDER Negation.
// Aufruf: node docs/niche-tests/repro/W7-a/03-abilities-leichte-und-harte-negation.js   (Exit 1 = Fehler tritt auf)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const potions = ['Smoke Vial', 'Tears of Creation', 'Life Serum', 'Poison Vial', 'Magnetic Potion'];

  // Terror: Schwelle 5 (Stufe 3)
  async function terror(status, opts) {
    const t = await H.fresh({ hand: [[], []], hp: 800, deck: [Array(10).fill('ZZ Dummy'), Array(10).fill('ZZ Dummy')] });
    t.setAbilities(0, 0, [['Terror', 'Terror', 'Terror'], [], []]);
    if (status) t.heroStatus(0, 0, status, opts);
    t.targetFn = (valid) => { const v = valid.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0); return v ? [v.id] : null; };
    for (const p of potions) await t.play(0, p, { hero: 0, keepActions: true });
    return t.gs._terrorForceEndTurn != null;
  }
  R.check('Terror ohne Status: Zugende nach 5 Karten', await terror(null) === true);
  R.check('Terror, Effekt negiert (leichte Form): läuft weiter', await terror('negated', { effectOnly: true }) === true);
  R.check('Terror, Abilities negiert (harte Form): ruht', await terror('negated') === false);
  R.check('Terror gefroren: ruht', await terror('frozen') === false);
  R.check('Terror betäubt: ruht', await terror('stunned') === false);

  // Stealth: Held 0 mit Stealth Lv3 ist für Quick Attack (Lv1) nicht wählbar, solange Stealth läuft
  async function stealth(status, opts) {
    const t = await H.fresh({ hand: [['Quick Attack'], []] });
    t.setAbilities(1, 0, [['Stealth', 'Stealth', 'Stealth'], [], []]);
    if (status) t.heroStatus(1, 0, status, opts);
    let seen = [];
    t.targetFn = (valid) => { seen = valid.filter(v => v.type === 'hero' && !v.ineligible).map(v => `${v.owner}-${v.heroIdx}`); return null; };
    await t.play(0, 'Quick Attack', { hero: 1 });
    return seen.includes('1-0');
  }
  R.check('Stealth ohne Status: Held nicht wählbar', await stealth(null) === false);
  R.check('Stealth, Effekt negiert (leichte Form): schützt weiter', await stealth('negated', { effectOnly: true }) === false);
  R.check('Stealth, Abilities negiert (harte Form): Held wählbar', await stealth('negated') === true);
  R.check('Stealth gefroren: Held wählbar', await stealth('frozen') === true);
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
