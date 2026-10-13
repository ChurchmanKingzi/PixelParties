'use strict';
// C05-creatures-10 · Stowaway negiert nur den Heldeneffekt (LEICHTE Form), die Abilities des Wirts funktionieren weiter
// Kartentext (Stowaway): „The corresponding Hero's effect and Abilities are negated. This counts as a negative status effect."
//   (Zum Vergleich Decisive Defeat: „that Hero's effect is negated" – dort ist die leichte Form richtig, siehe CARD_API.md Z. 14268-14287.)
// Erwartung: Wirt mit Destruction Magic Lv2 (2 Karten) kann „Fireball" (Destruction Magic Lv2) NICHT spielen, solange der Stowaway ihn negiert (wie bei jeder
//   harten Negation: nur Lv0-Karten ohne Schulanforderung bleiben spielbar).
// Beobachtet: Fireball ist spielbar und wirkt (150 Schaden). Der Wirt trägt `negated` mit `_fromAttachment: 'Stowaway'`; die Engine behandelt jede `_fromAttachment`-
//   Negation als „leicht" (Abilities bleiben) – das ist für Decisive Defeat gewollt, für den Stowaway nicht.
// Ursache: `cards/effects/_attachment-shared.js:349` (`setzeAnhaengselStatus`) markiert mit `_fromAttachment`; `_engine.js:42954`, `:43702` (heroMeetsLevelReq), `:44557`
//   (Weisheitskosten) und `:17245` lesen `_fromAttachment` als leichte Form. `stowaway.js:175` ruft diesen Helfer ohne Hinweis auf die harte Form.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const pickHero = (o, h) => (valid) => { const v = valid.find(x => x.type === 'hero' && x.owner === o && x.heroIdx === h); return v ? [v.id] : null; };
  const t = await H.fresh({ hand: [['Fireball', 'Stowaway'], []], abilities: { 0: { 0: [['Destruction Magic', 'Destruction Magic'], [], []] } } });
  t.gs._chillyWizardHint = { 0: { ownerIdx: 0, heroIdx: 0, slotIdx: 1 } };     // Stowaway von Held 1 aus in die Zone von Held 0 legen
  const r0 = await t.play(0, 'Stowaway', { hero: 1, slot: 0 });
  delete t.gs._chillyWizardHint;
  R.check('Aufbau: Held 0 durch Stowaway negiert', r0 === true && !!t.hero(0, 0).statuses.negated && t.hero(0, 0).statuses.negated._fromAttachment === 'Stowaway', [r0, t.hero(0, 0).statuses]);
  t.targetFn = pickHero(1, 0);
  const r = await t.play(0, 'Fireball', { hero: 0, noGrant: true });
  R.check('Wirt negiert: Fireball (Lv2, Destruction Magic) nicht spielbar', r === false && t.hp(1, 0) === 800, { r, hpGegner: t.hp(1, 0) });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
