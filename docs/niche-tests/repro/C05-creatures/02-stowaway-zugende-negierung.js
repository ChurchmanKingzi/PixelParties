'use strict';
// C05-creatures-02 · Stowaway: Die Negierung des Wirts (und damit die Karte selbst) endet mit dem ersten Zugende des Wirt-Besitzers
// Kartentext (Stowaway): „Summon this Creature into the free Support Zone of any Hero. The corresponding Hero's effect and Abilities
//   are negated. This counts as a negative status effect. This Creature is unaffected by all other cards and effects, but if the
//   status effect it inflicted is removed from the corresponding Hero, it is deleted."
//   Ruling CARD_API.md Z. 14245 (Badge): „Negated (Decisive Defeat): … Lasts as long as Decisive Defeat remains attached to this Hero."
//   (Anhängsel-/Kartenstatus laufen NICHT zum Zugende ab: „ZUGEFÜGT … eigene Dauer; Anhängsel folgen ihrem Status" Z. 12587.)
// Erwartung: Nach `t.endTurn()` (echter Zugwechsel) ist der Wirt weiter negiert und Stowaway liegt weiter auf dem Brett.
// Beobachtet: Am Ende des Zuges des Wirt-Besitzers wird `negated` entfernt, der Held bekommt `immune`, und der Stowaway wird
//   gelöscht (Gelöscht-Stapel). Auf einem Helden des Gegners geschieht dasselbe am Ende des GEGNER-Zuges.
//   Dieselbe Ursache trifft „Decisive Defeat" (Anhängsel, selber Helfer): auch dort wird die Karte zum Zugende abgelegt.
// Ursache: `_engine.js` processStatusExpiry('END') ~45106: `if (hero.statuses.negated && !hero.statuses.negated.sourceBound) removeHeroStatus(...)`.
//   `setzeAnhaengselStatus` (`_attachment-shared.js` ~349) setzt nur `permanent: true` + `_fromAttachment`, aber kein `sourceBound`;
//   `permanent` wird in dieser Schleife nicht gelesen.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const alsHeld = (t, pi, hi) => t.gs.players[pi].heroes[hi];

  R.section('A) Stowaway auf eigenem Helden');
  let t = await H.fresh({ hand: [['Stowaway'], []] });
  let r = await t.play(0, 'Stowaway', { hero: 0, slot: 0 });
  R.check('Aufbau: gespielt, Held 0 negiert', r === true && !!alsHeld(t, 0, 0).statuses.negated, r);
  await t.endTurn();                                           // Ende des Zuges von Sitz 0
  R.check('nach dem Zugende: Wirt noch negiert', !!alsHeld(t, 0, 0).statuses.negated, Object.keys(alsHeld(t, 0, 0).statuses));
  R.check('nach dem Zugende: Stowaway liegt noch auf dem Brett', !!t.find('Stowaway', 'support'), t.pile(0, 'deletedPile'));
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);

  R.section('B) Stowaway auf Gegnerheld (Ziel-Hint wie beim Ziehen auf eine fremde Zone)');
  t = await H.fresh({ hand: [['Stowaway'], []] });
  t.gs._chillyWizardHint = { 0: { ownerIdx: 1, heroIdx: 1, slotIdx: 2 } };
  r = await t.play(0, 'Stowaway', { hero: 0, slot: 0 });
  delete t.gs._chillyWizardHint;
  R.check('Aufbau: gegnerischer Held 1 negiert', r === true && !!alsHeld(t, 1, 1).statuses.negated, r);
  await t.endTurn();                                           // Ende Zug Sitz 0
  await t.endTurn();                                           // Ende Zug Sitz 1
  R.check('nach dem Zugende des Gegners: Held noch negiert, Stowaway noch da', !!alsHeld(t, 1, 1).statuses.negated && !!t.find('Stowaway', 'support'),
    { statuses: Object.keys(alsHeld(t, 1, 1).statuses), deleted: t.pile(0, 'deletedPile') });

  R.section('C) Mitbetroffen: Decisive Defeat (gleicher Helfer)');
  t = await H.fresh({ hand: [['Decisive Defeat'], []] });
  t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 0 && v.heroIdx === 0).id];
  r = await t.play(0, 'Decisive Defeat', { hero: 0 });
  R.check('Aufbau: Decisive Defeat hängt, Held negiert', r === true && !!alsHeld(t, 0, 0).statuses.negated, r);
  await t.endTurn();
  R.check('nach dem Zugende: Decisive Defeat noch am Helden (kein Ablegen)', !t.pile(0, 'discardPile').includes('Decisive Defeat') && !!alsHeld(t, 0, 0).statuses.negated,
    { discard: t.pile(0, 'discardPile'), statuses: Object.keys(alsHeld(t, 0, 0).statuses) });
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
