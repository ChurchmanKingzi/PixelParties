'use strict';
// W4-neg-03 · Scaling-Karten lesen unter harter Negierung (Stowaway / Standard-negated) die Stufe 0 (Al, 14.10.2026, Welle 4 / B)
// Al zu Royal Treasury (Bonus 4/6/8 Gold nach Magic-Arts-Stufe des Wirts): "Das gilt generell fuer alle Scaling-Karten."
// Erwartung: Ist der Held in der HARTEN Form negiert (Stowaway = Marke `abilitiesNegated`, oder Standard-`negated` ohne leichte Marke), liest jede Stufen-Skalierung 0;
//   die LEICHTE Form (`effectOnly`, Decisive Defeat) laesst die Stufen stehen.
// Aufbau: Sitz 0, Held 0 mit Magic Arts x2, Fighting x2, Decay Magic x2, Support Magic x2.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const ABIL = { 0: { 0: [['Magic Arts', 'Magic Arts'], ['Fighting', 'Fighting'], ['Decay Magic', 'Decay Magic']] } };
  const ZUSTAENDE = {
    ohne: null,
    leicht: { effectOnly: true },
    hart: { sourceBound: true, noAbsorb: true },
    stowaway: { _fromAttachment: 'Stowaway', abilitiesNegated: true, permanent: true },
  };
  const szene = async (z, extra = {}) => {
    const t = await H.fresh({ abilities: ABIL, ...extra });
    if (ZUSTAENDE[z]) await t.engine.addHeroStatus(0, 0, 'negated', { appliedBy: 1, source: 'Test', ...ZUSTAENDE[z] });
    return t;
  };
  const erwartet = { ohne: 2, leicht: 2, hart: 0, stowaway: 0 };

  R.section('A) zentrale Leser: heroSchoolLevel / effectiveSchoolLevelForCaster / heroAbilityLevel');
  for (const z of Object.keys(ZUSTAENDE)) {
    const t = await szene(z);
    const e = erwartet[z];
    R.check(`${z}: heroSchoolLevel('Magic Arts') = ${e}`, t.engine.heroSchoolLevel?.('Magic Arts', 0, 0) === e, t.engine.heroSchoolLevel?.('Magic Arts', 0, 0));
    R.check(`${z}: effectiveSchoolLevelForCaster('Decay Magic') = ${e}`, t.engine.effectiveSchoolLevelForCaster('Decay Magic', 0, 0) === e, t.engine.effectiveSchoolLevelForCaster('Decay Magic', 0, 0));
    const { heroAbilityLevel } = require('../../../../cards/effects/_hooks');
    R.check(`${z}: heroAbilityLevel('Fighting') = ${e}`, heroAbilityLevel(t.engine, 0, 0, 'Fighting') === e, heroAbilityLevel(t.engine, 0, 0, 'Fighting'));
  }

  R.section('B) Royal Treasury (Bonus 4/6/8 nach Magic Arts des Wirts; Stufe 2 -> 6)');
  for (const z of Object.keys(ZUSTAENDE)) {
    const t = await szene(z, { hand: [['Royal Treasury'], []], gold: 10 });
    t.put(0, 0, 0, 'Royal Treasury');
    const g0 = t.gs.players[0].gold;
    await t.run(() => t.engine.actionGainGold(0, 5, { source: 'Test' }));
    await sleep(250);
    const delta = t.gs.players[0].gold - g0;
    const e = (z === 'ohne' || z === 'leicht') ? 5 + 6 : 5;
    R.check(`${z}: Gold +5 durch anderen Effekt -> insgesamt +${e}`, delta === e, { delta, e });
    R.check(`${z}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }

  R.section('C) weitere Leser (Skript-Vertraege): Instant Cryo Stasis (Decay Magic >= 2 -> Zusatzaktion), Divine Gift of Skill (Magic Arts >= 1)');
  for (const z of Object.keys(ZUSTAENDE)) {
    const t = await szene(z);
    const e = erwartet[z];
    const cryo = require('../../../../cards/effects/instant-cryo-stasis.js');
    R.check(`${z}: Instant Cryo Stasis inherentAction (Decay Magic 2) = ${e === 2}`, !!cryo.inherentAction(t.gs, 0, 0, t.engine) === (e === 2), cryo.inherentAction(t.gs, 0, 0, t.engine));
    t.hero(0, 0)._skillLockTurn = t.gs.turn;
    R.check(`${z}: isHeroSkillLocked (Magic Arts >= 1 hebt auf) = ${e === 0}`, t.engine.isHeroSkillLocked(0, 0) === (e === 0), t.engine.isHeroSkillLocked(0, 0));
  }
  R.section('D) echter Stowaway (Wirt Held 0) + Royal Treasury: Bonus entfaellt, nach Loeschen des Stowaway wieder da');
  {
    const t = await H.fresh({ hand: [['Stowaway'], []], abilities: { 0: { 0: ABIL[0][0], 1: [['Decay Magic'], [], []] } }, gold: 10 });
    t.put(0, 0, 0, 'Royal Treasury');
    t.gs._chillyWizardHint = { 0: { ownerIdx: 0, heroIdx: 0, slotIdx: 1 } };
    const r = await t.play(0, 'Stowaway', { hero: 1, slot: 0 });
    delete t.gs._chillyWizardHint;
    R.check('Aufbau: Held 0 durch Stowaway negiert', r === true && t.hero(0, 0).statuses.negated?.abilitiesNegated === true, [r, t.hero(0, 0).statuses]);
    let g0 = t.gs.players[0].gold;
    await t.run(() => t.engine.actionGainGold(0, 5, { source: 'Test' }));
    await sleep(250);
    R.check('unter Stowaway: nur +5, kein Royal-Treasury-Bonus', t.gs.players[0].gold - g0 === 5, t.gs.players[0].gold - g0);
    await t.engine.removeHeroStatus(0, 0, 'negated');
    await sleep(250);
    t.gs.hoptUsed = {};
    g0 = t.gs.players[0].gold;
    await t.run(() => t.engine.actionGainGold(0, 5, { source: 'Test' }));
    await sleep(250);
    R.check('nach dem Heilen: Bonus (Magic Arts 2 -> 6) wieder da', t.gs.players[0].gold - g0 === 11, t.gs.players[0].gold - g0);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
