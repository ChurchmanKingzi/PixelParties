'use strict';
// C05-creatures-13 · Zwei getrennte Zustaende: „effect negated" und „abilities negated" (Al, Welle 3 / S1)
// Kartentexte: Decisive Defeat „that Hero's effect is negated" (nur Effekt) · Stowaway „effect and Abilities are negated" (beide).
// Erwartung: Wirt mit passiver Ability (Wealth: +4 Gold je Stufe im Rundeneinkommen):
//   • ohne Negierung: Einkommen +4 · Decisive Defeat: Passiv LAEUFT (+4) · Stowaway: Passiv STUMM (+0) ·
//   • Gegenprobe harte Standard-Negierung (addHeroStatus 'negated', z. B. Locke/Sparky Slime): Passiv stumm wie bisher.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const pickHero = (o, h) => (valid) => { const v = valid.find(x => x.type === 'hero' && x.owner === o && x.heroIdx === h); return v ? [v.id] : null; };
  const ABIL = { 0: { 0: [['Wealth'], [], []], 1: [['Decay Magic'], [], []] } };
  // Einkommen von Sitz 0 beim naechsten Rundenbeginn (zwei Zugwechsel)
  const einkommen = async (t) => { const g0 = t.gs.players[0].gold; await t.endTurn(); await t.endTurn(); return t.gs.players[0].gold - g0; };

  let t = await H.fresh({ hand: [[], []], abilities: ABIL });
  const basis = await einkommen(t);
  R.check('Basis: Wealth wirkt im Rundeneinkommen (>= 4 ueber dem Grundeinkommen)', basis >= 4, basis);

  t = await H.fresh({ hand: [['Decisive Defeat'], []], abilities: ABIL });
  t.targetFn = pickHero(0, 0);
  const rd = await t.play(0, 'Decisive Defeat', { hero: 1, noGrant: true });
  R.check('Aufbau: Decisive Defeat auf Held 0 (leichte Marke)', rd === true && !!t.hero(0, 0).statuses.negated && !t.hero(0, 0).statuses.negated.abilitiesNegated, [rd, t.hero(0, 0).statuses]);
  const dd = await einkommen(t);
  R.check('Decisive Defeat: passive Ability laeuft weiter (gleiches Einkommen wie ohne Negierung)', dd === basis, { dd, basis });

  t = await H.fresh({ hand: [['Stowaway'], []], abilities: ABIL });
  t.gs._chillyWizardHint = { 0: { ownerIdx: 0, heroIdx: 0, slotIdx: 1 } };
  const rs = await t.play(0, 'Stowaway', { hero: 1, slot: 0 });
  delete t.gs._chillyWizardHint;
  R.check('Aufbau: Stowaway auf Held 0 (harte Marke)', rs === true && t.hero(0, 0).statuses.negated?.abilitiesNegated === true, [rs, t.hero(0, 0).statuses]);
  const sw = await einkommen(t);
  R.check('Stowaway: passive Ability stumm (Einkommen ohne den Wealth-Bonus)', sw === basis - 4, { sw, basis });

  t = await H.fresh({ hand: [[], []], abilities: ABIL });
  await t.engine.addHeroStatus(0, 0, 'negated', { appliedBy: 1, source: 'Test', sourceBound: true, noAbsorb: true });
  const hart = await einkommen(t);
  R.check('Gegenprobe harte Standard-Negierung: Passiv stumm wie bisher', hart === basis - 4, { hart, basis });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
