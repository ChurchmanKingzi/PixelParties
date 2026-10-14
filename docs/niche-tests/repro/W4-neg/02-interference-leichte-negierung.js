'use strict';
// W4-neg-02 · Interference (Ability) wirkt, solange nicht Abilities negiert sind (Al, 14.10.2026, Welle 4 / C)
// Kartentext Interference Lv2: „This Hero takes no damage from sources that hit other targets in addition to it."
// Al: „Interference als Ability wirkt, solange nicht Abilities negiert sind." -> LEICHTE Negierung (nur Heldeneffekt: Decisive Defeat, Weakening Crystal, Locke …)
//   laesst Interference wirken; HARTE Form / `abilitiesNegated` (Stowaway), Stunned, Frozen, Mumie: wirkt nicht.
// Aufbau: Sitz 1 Held 0 hat Interference Lv2; Sitz 0 spielt einen Flaechenschaden (Flame Avalanche) auf alle Helden des Gegners.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const pickHero = (o, h) => (valid) => { const v = valid.find(x => x.type === 'hero' && x.owner === o && x.heroIdx === h); return v ? [v.id] : null; };
  const ABIL = { 1: { 0: [['Interference', 'Interference'], [], []] } };
  const szene = async (extra = {}) => H.fresh({ abilities: ABIL, ...extra });

  R.section('A) Stufe/Anteil je Zustand (Sitz 1, Held 0, Interference Lv2)');
  let t = await szene();
  R.check('ohne Negierung: Stufe 2, Anteil 1', t.engine.interferenceLevel(1, 0) === 2 && t.engine.interferenceShare(1, t.hero(1, 0)) === 1, [t.engine.interferenceLevel(1, 0), t.engine.interferenceShare(1, t.hero(1, 0))]);
  await t.engine.addHeroStatus(1, 0, 'negated', { appliedBy: 0, source: 'Test', effectOnly: true });
  R.check('leichte Negierung (effectOnly): Interference wirkt weiter (Stufe 2)', t.engine.interferenceLevel(1, 0) === 2, t.engine.interferenceLevel(1, 0));
  t = await szene();
  await t.engine.addHeroStatus(1, 0, 'negated', { appliedBy: 0, source: 'Test', sourceBound: true, noAbsorb: true });
  R.check('harte Negierung (Standard): Interference wirkt nicht', t.engine.interferenceLevel(1, 0) === 0, t.engine.interferenceLevel(1, 0));
  t = await szene();
  await t.engine.addHeroStatus(1, 0, 'negated', { appliedBy: 0, source: 'Test', _fromAttachment: 'Test', abilitiesNegated: true, permanent: true });
  R.check('Abilities negiert (Marke abilitiesNegated, Stowaway-Form): Interference wirkt nicht', t.engine.interferenceLevel(1, 0) === 0, t.engine.interferenceLevel(1, 0));
  for (const st of ['stunned', 'frozen']) {
    t = await szene();
    await t.engine.addHeroStatus(1, 0, st, { appliedBy: 0, source: 'Test' });
    R.check(st + ': Interference wirkt nicht (unveraendert)', t.engine.interferenceLevel(1, 0) === 0, t.engine.interferenceLevel(1, 0));
  }

  R.section('B) echte Karten: Decisive Defeat (Anhaengsel, leicht) vs. Stowaway (hart)');
  t = await szene({ hand: [['Decisive Defeat'], []], abilities: { ...ABIL, 0: { 1: [['Decay Magic'], [], []] } } });
  t.targetFn = pickHero(1, 0);
  let r = await t.play(0, 'Decisive Defeat', { hero: 1, noGrant: true });   // Held 1 (Decay Magic Lv1) legt es auf Sitz 1, Held 0
  R.check('Decisive Defeat liegt: Interference Lv2 wirkt weiter', r === true && !!t.hero(1, 0).statuses.negated && t.engine.interferenceLevel(1, 0) === 2, [r, t.hero(1, 0).statuses, t.engine.interferenceLevel(1, 0)]);
  t = await szene({ hand: [['Stowaway'], []] });
  t.gs._chillyWizardHint = { 0: { ownerIdx: 1, heroIdx: 0, slotIdx: 1 } };
  r = await t.play(0, 'Stowaway', { hero: 1, slot: 0 });
  delete t.gs._chillyWizardHint;
  R.check('Stowaway liegt: Interference wirkt nicht', t.hero(1, 0).statuses.negated?.abilitiesNegated === true && t.engine.interferenceLevel(1, 0) === 0, [r, t.hero(1, 0).statuses, t.engine.interferenceLevel(1, 0)]);

  R.section('C) Flaechenschaden wirkt wirklich (Flame Avalanche) - Interference Lv2 unter leichter Negierung schuetzt den Traeger');
  const avalanche = async (negieren) => {
    const s = await szene({ hand: [['Flame Avalanche'], []] });
    if (negieren === 'leicht') await s.engine.addHeroStatus(1, 0, 'negated', { appliedBy: 0, source: 'Test', effectOnly: true });
    if (negieren === 'hart') await s.engine.addHeroStatus(1, 0, 'negated', { appliedBy: 0, source: 'Test', sourceBound: true, noAbsorb: true });
    const rr = await s.play(0, 'Flame Avalanche', { hero: 0 });
    await sleep(250);
    return { rr, hp0: s.hp(1, 0), hp1: s.hp(1, 1), errors: s.errors };
  };
  const ohne = await avalanche(null), leicht = await avalanche('leicht'), hart = await avalanche('hart');
  R.check('Aufbau: Flame Avalanche trifft die ungeschuetzten Helden', ohne.rr === true && ohne.hp1 < 800, ohne);
  R.check('ohne Negierung: Traeger nimmt keinen Schaden', ohne.hp0 === 800, ohne);
  R.check('leichte Negierung: Traeger nimmt weiterhin keinen Schaden', leicht.hp0 === 800 && leicht.hp1 < 800, leicht);
  R.check('harte Negierung: Traeger wird getroffen', hart.hp0 < 800, hart);
  R.check('keine Engine-Fehler', ohne.errors.length + leicht.errors.length + hart.errors.length === 0, [ohne.errors, leicht.errors, hart.errors]);
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
