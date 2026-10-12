'use strict';
// A04-cute-13 · Fun-Fun Circus Clown legt Applause Counter auf eine per Cute Conversion geliehene Kreatur
//
// Kartentext (Cute Conversion): "Take control of all Creatures your opponent controls for the rest of the turn. Creatures controlled by
//   this effect are unaffected by all cards and effects while they are controlled."
//   Clown: "… place 1 Applause Counter on every other 'Fun-Fun Circus' Creature on the board."
// Erwartung: Die geliehene Kreatur ist „unaffected by all cards and effects" → kein Counter darauf (Schaden und Status sind blockiert, ✓).
// Beobachtet: Der Clown legt 1 Applause Counter auf den geliehenen gegnerischen Strongman.
// Ursache: cards/effects/_applause-shared.js `placeApplause` prüft keine Omni-Immunität (`engine.isOmniImmune`); die Immunität gilt
//   dort nur für Schadens-/Status-/Zerstörungs-/Zonenpfade. Restunsicherheit (B): ob „all cards and effects" auch EIGENE Effekte des
//   Kontrolleurs meint (die Conversion-Kopfzeile sagt: gegen FREMDE Karten; Counter-Legen ist aber kein Effekt der geliehenen Kreatur).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Cute Conversion'], []], deck: [Array(4).fill(H.INERT.creature), Array(4).fill(H.INERT.creature)] });
  t.setAbilities(0, 0, [['Magic Arts', 'Magic Arts'], [], []]);
  const clown = t.put(0, 0, 0, 'Fun-Fun Circus Clown'); clown.turnPlayed = 0;
  const strong = t.put(1, 0, 0, 'Fun-Fun Circus Strongman');
  await t.play(0, 'Cute Conversion', { hero: 0, noGrant: true });
  R.check('Strongman ist geliehen (stolenBy 0)', strong.stolenBy === 0, strong.stolenBy);
  await t.run(() => t.engine.actionDealCreatureDamage({ name: 'Test', owner: 0, heroIdx: 0 }, strong, 100, 'creature', { sourceOwner: 0 }));
  R.check('Gegenprobe: Schaden wirkt nicht', (strong.counters.currentHp ?? 10) >= 10, strong.counters);
  t.script.push({ match: d => d.type === 'optionPicker', answer: () => ({ optionId: 'all' }) });
  t.gs.activePlayer = 0; t.phase(2);
  await t.activateCreature(0, 0, 0);
  R.check('kein Applause Counter auf der geliehenen Kreatur', (strong.counters.applause || 0) === 0, { applause: strong.counters.applause });
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
