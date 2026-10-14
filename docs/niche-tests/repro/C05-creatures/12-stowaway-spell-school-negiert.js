'use strict';
// C05-creatures-12 · Stowaway negiert die ABILITIES des Wirts – auch die als Spell School zählenden (Schulstufen)
// Kartentext (Stowaway): „The corresponding Hero's effect and Abilities are negated. This counts as a negative status effect. …
//   if the status effect it inflicted is removed from the corresponding Hero, it is deleted."
// Zweiter Beleg zu C05-10 (Auftrag Al): Wirt mit Destruction Magic ×2 und Support Magic ×1.
// Erwartung (harte Form, nur für den Stowaway; Decisive Defeat bleibt bei „nur Heldeneffekt"):
//   • Fireball (Destruction Magic Lv2) und Heal (Support Magic Lv1) sind vom Wirt NICHT spielbar,
//   • Ability-Aktivierungen des Wirts sind stumm (Adventurousness steht nicht in der Aktivierungsliste),
//   • der Held ist sonst handlungsfähig (nicht frozen/stunned), Lv-0-Karten (Arms Trade) bleiben spielbar,
//   • die Negierung überlebt das Zugende (Z2), ist heilbar; nach Heilen/Löschen des Stowaway ist alles wieder spielbar,
//   • Gegenprobe Decisive Defeat: Fireball bleibt spielbar (leichte Form).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const pickHero = (o, h) => (valid) => { const v = valid.find(x => x.type === 'hero' && x.owner === o && x.heroIdx === h); return v ? [v.id] : null; };
  const ABIL = { 0: { 0: [['Destruction Magic', 'Destruction Magic'], ['Support Magic'], ['Adventurousness']] } };
  const szene = async (hand) => {
    const t = await H.fresh({ hand: [hand, []], abilities: ABIL });
    t.gs._chillyWizardHint = { 0: { ownerIdx: 0, heroIdx: 0, slotIdx: 1 } };      // Stowaway von Held 1 aus in die Zone von Held 0
    return t;
  };
  const stowaway = async (t) => { const r = await t.play(0, 'Stowaway', { hero: 1, slot: 0 }); delete t.gs._chillyWizardHint; return r; };
  const karte = (name) => { const c = require('../../../../data/cards.json'); const a = Array.isArray(c) ? c : Object.values(c); return a.find(x => x.name === name); };
  const adventurous = (t) => { t.gs.currentPhase = 3; return (t.engine.getActivatableAbilities(0) || []).some(a => a.heroIdx === 0 && a.zoneIdx === 2); };   // Aktionsphase; Zone 2 = Adventurousness

  R.section('A) Vorher: ohne Stowaway sind Fireball/Heal/Aktivierung verfügbar');
  let t = await szene(['Stowaway', 'Fireball', 'Heal', 'Arms Trade']);
  R.check('Fireball (Lv2) erfüllt die Stufe', t.engine.heroMeetsLevelReq(0, 0, karte('Fireball')) === true);
  R.check('Heal (Support Magic Lv1) erfüllt die Stufe', t.engine.heroMeetsLevelReq(0, 0, karte('Heal')) === true);
  R.check('Aktivierung (Adventurousness) gelistet', adventurous(t), t.engine.getActivatableAbilities(0));

  R.section('B) Stowaway auf dem Wirt: Schulstufen zählen nicht');
  const r0 = await stowaway(t);
  const w = t.hero(0, 0);
  R.check('Aufbau: Held 0 durch Stowaway negiert (harte Marke)', r0 === true && !!w.statuses.negated && w.statuses.negated.abilitiesNegated === true, [r0, w.statuses]);
  R.check('Wirt nicht gefroren/betäubt (handlungsfähig)', !w.statuses.frozen && !w.statuses.stunned && !t.engine.isHeroIncapacitated(0, 0), w.statuses);
  R.check('Stufenprüfung: Fireball (Destruction Magic Lv2) verfehlt', t.engine.heroMeetsLevelReq(0, 0, karte('Fireball')) === false);
  R.check('Stufenprüfung: Heal (Support Magic Lv1) verfehlt', t.engine.heroMeetsLevelReq(0, 0, karte('Heal')) === false);
  R.check('Schulstufe für Skalierung = 0', t.engine.effectiveSchoolLevelForCaster('Destruction Magic', 0, 0) === 0);
  R.check('Ability-Aktivierung des Wirts gesperrt', !adventurous(t), t.engine.getActivatableAbilities(0));
  t.targetFn = pickHero(1, 0);
  let r = await t.play(0, 'Fireball', { hero: 0, noGrant: true });
  R.check('Fireball nicht spielbar', r === false && t.hp(1, 0) === 800, { r, hp: t.hp(1, 0) });
  t.targetFn = pickHero(0, 1);
  r = await t.play(0, 'Heal', { hero: 0, noGrant: true });
  R.check('Heal nicht spielbar', r === false, r);
  r = await t.play(0, 'Arms Trade', { hero: 0, noGrant: true });
  R.check('Lv-0-Karte (Arms Trade) bleibt spielbar', r === true, r);

  R.section('C) Zugende (Z2): Negierung bleibt, Fireball weiter gesperrt');
  await t.endTurn(); await t.endTurn();
  R.check('Wirt noch negiert, Stowaway noch da', !!t.hero(0, 0).statuses.negated && !!t.find('Stowaway', 'support'), Object.keys(t.hero(0, 0).statuses));
  R.check('Fireball weiter nicht erfüllt', t.engine.heroMeetsLevelReq(0, 0, karte('Fireball')) === false);

  R.section('D) Heilen: Status weg -> Stowaway gelöscht -> wieder spielbar');
  await t.engine.removeHeroStatus(0, 0, 'negated');
  await sleep(250);
  R.check('Stowaway gelöscht, Wirt frei', !t.hero(0, 0).statuses.negated && !t.find('Stowaway', 'support') && t.pile(0, 'deletedPile').filter(n => n === 'Stowaway').length === 1, t.pile(0, 'deletedPile'));
  R.check('Fireball wieder erfüllt', t.engine.heroMeetsLevelReq(0, 0, karte('Fireball')) === true);
  R.check('Heal wieder erfüllt', t.engine.heroMeetsLevelReq(0, 0, karte('Heal')) === true);
  R.check('Aktivierung wieder gelistet', adventurous(t));
  R.check('Schulstufe wieder 2', t.engine.effectiveSchoolLevelForCaster('Destruction Magic', 0, 0) === 2);
  t.setHand(0, ['Fireball']);
  t.targetFn = pickHero(1, 0);
  r = await t.play(0, 'Fireball', { hero: 0, noGrant: true });
  R.check('Fireball wird gespielt und wirkt (150)', r === true && t.hp(1, 0) === 650, { r, hp: t.hp(1, 0) });

  R.section('E) Stowaway verlässt das Brett (Wirt-Tod/Löschen): Negierung fällt mit');
  t = await szene(['Stowaway']);
  await stowaway(t);
  const inst = t.find('Stowaway', 'support');
  await t.engine.anhaengselAbraeumen(inst, { name: 'test' });
  await sleep(250);
  R.check('Wirt wieder frei, Stufe erfüllt', !t.hero(0, 0).statuses.negated && t.engine.heroMeetsLevelReq(0, 0, karte('Fireball')) === true, t.hero(0, 0).statuses);

  R.section('F) Gegenprobe Decisive Defeat: leichte Form, Fireball bleibt spielbar');
  t = await H.fresh({ hand: [['Decisive Defeat', 'Fireball'], []], abilities: { 0: { 0: ABIL[0][0], 1: [['Decay Magic']] } } });
  t.targetFn = pickHero(0, 0);
  const rd = await t.play(0, 'Decisive Defeat', { hero: 1, noGrant: true });   // Held 1 (Decay Magic Lv1) legt es auf Held 0
  R.check('Aufbau: Held negiert ohne harte Marke', rd === true && !!t.hero(0, 0).statuses.negated && !t.hero(0, 0).statuses.negated.abilitiesNegated, t.hero(0, 0).statuses);
  R.check('Fireball-Stufe weiter erfüllt (Abilities zählen)', t.engine.heroMeetsLevelReq(0, 0, karte('Fireball')) === true);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
