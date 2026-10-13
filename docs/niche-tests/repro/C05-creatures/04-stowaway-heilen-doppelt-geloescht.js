'use strict';
// C05-creatures-04 · Stowaway landet doppelt im Gelöscht-Stapel, wenn ein „heile ALLE Status"-Effekt seinen Wirt reinigt
// Kartentext (Waitress): „You may heal a Hero you control from all status effects (at least 1) to summon this Creature as an additional
//   Action." Kartentext (Stowaway): „…if the status effect it inflicted is removed from the corresponding Hero, it is deleted."
//   „This counts as a negative status effect." (Stowaway.js: Heilen = löschen, `deleteOnCleanse`)
// Erwartung: Der Stowaway wird genau EINMAL gelöscht: Gelöscht-Stapel von Sitz 0 enthält ihn einmal, die Kartenbilanz stimmt.
// Beobachtet: Der Gelöscht-Stapel enthält „Stowaway" ZWEIMAL (Kartenbilanz: Stowaway +1, es gibt aber nur eine Karte). Mit einem Einzel-Entfernen
//   (`removeHeroStatus('negated')`) ist es genau einmal; mit „alle heilbaren Status" zweimal.
// Ursache: `cleanseHeroStatuses` (_engine.js ~17314/~17338) startet bei „alle heilbaren Status gewählt" ZWEI nebenläufige Aufräumer für dieselbe Karte:
//   (a) `cleanseNegativeAttachments` -> `anhaengselAbraeumen` und (b) den Hook `onStatusRemoved` (`_attachment-shared.js` ~410, `heilenWirftAb`) ->
//   `anhaengselAbraeumen`. Beide sehen die Karte noch im Support; bei der Ablage-Variante (Decisive Defeat, `sendBoardCardToDiscard`) schluckt die
//   Engine die zweite Ausführung, die Löschvariante (`actionMoveCard(inst,'deleted',…)`, _engine.js ~6872) hängt den Namen ein zweites Mal an.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const pickHero = (o, h) => (valid) => { const v = valid.find(x => x.type === 'hero' && x.owner === o && x.heroIdx === h); return v ? [v.id] : null; };
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  R.section('A) Waitress (Zusatzaktions-Variante) heilt den Stowaway-Wirt');
  let t = await H.fresh({ hand: [['Stowaway', 'Waitress'], []] });
  await t.play(0, 'Stowaway', { hero: 1, slot: 0 });
  R.check('Aufbau: Held 1 negiert, Stowaway liegt', !!t.hero(0, 1).statuses.negated && !!t.find('Stowaway', 'support'));
  const vorher = t.census();
  t.script.push({ match: d => d.type === 'zonePick', answer: d => { const z = d.zones.find(q => q.heroIdx === 0 && q.slotIdx === 0) || d.zones[0]; return { heroIdx: z.heroIdx, slotIdx: z.slotIdx, owner: z.owner }; } });
  t.targetFn = pickHero(0, 1);
  const r = await t.play(0, 'Waitress', { hero: 0, slot: 0 });
  await sleep(50);                                              // die Aufräumer laufen als Mikrotask
  R.check('Waitress gespielt, Wirt geheilt, Stowaway weg', r === true && !t.hero(0, 1).statuses.negated && !t.find('Stowaway', 'support'), r);
  R.check('Stowaway genau einmal im Gelöscht-Stapel', t.pile(0, 'deletedPile').filter(n => n === 'Stowaway').length === 1, t.pile(0, 'deletedPile'));
  const diff = t.censusDiff(vorher, t.census()).filter(s => /^Stowaway/.test(s));
  R.check('Kartenbilanz: keine zusätzliche Stowaway-Karte', diff.length === 0, diff);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);

  R.section('B) Gegenprobe: Einzel-Entfernen von „negated" löscht genau einmal');
  t = await H.fresh({ hand: [['Stowaway'], []] });
  await t.play(0, 'Stowaway', { hero: 1, slot: 0 });
  await t.engine.removeHeroStatus(0, 1, 'negated');
  await sleep(50);
  R.check('Stowaway einmal im Gelöscht-Stapel', t.pile(0, 'deletedPile').filter(n => n === 'Stowaway').length === 1, t.pile(0, 'deletedPile'));
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
