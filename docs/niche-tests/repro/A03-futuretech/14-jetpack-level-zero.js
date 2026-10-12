'use strict';
// A03-futuretech-14 · Jetpack und Escape Device behandeln „Stufe ≤ Anzahl“ bei 0 Kopien in der Ablage unterschiedlich (Stufe C – Regelfrage)
//
// Kartentext Jetpack: „… cannot be chosen or hit by Attacks whose levels are lower than or equal to the number of "Future Tech Jetpack" cards in your discard pile.“
// Kartentext Escape Device: „… an Attack or Spell whose level is equal to or lower than the number of "Future Tech Escape Device" cards in your discard pile.“
// Beobachtet bei 0 Kopien in der Ablage und einer Stufe-0-Karte (0 ≤ 0):
//   • Escape Device (Hand) negiert Future Tech Organnon (Lv 0) für den gewählten Helden.            (`level <= zaehleInAblage`, kein Mindestwert)
//   • Jetpack schützt NICHT vor der Stufe-0-Attacke „Attack“: Held ist wählbar und verliert HP.     (future-tech-jetpack.js:61 `&& kopien > 0`)
//   Beide Kopfkommentare sagen dasselbe („Mit leerer Ablage schützt sie gegen NICHTS (Stufe ≤ 0 trifft nur stufenlose …)“).
// Frage an Al: Soll Jetpack bei 0 Kopien in der Ablage Stufe-0-Attacken (14 Karten, z. B. „Attack“, Backstab) abwehren, wie Escape Device Stufe-0-Zauber – ja oder nein?
const H = require('../../lib/h.js');
const ESC = 'Future Tech Escape Device', ORG = 'Future Tech Organnon', JET = 'Future Tech Jetpack';
(async () => {
  const R = H.runner();
  // Escape Device: Lv-0-Zauber, 0 Escape Device in der Ablage
  let t = await H.fresh({ hand: [[ORG], [ESC]], discard: [[ORG, ORG], []] });
  t.setAbilities(0, 0, [['Inventing', 'Inventing', 'Inventing'], [], []]);
  t.targetFn = (v) => [v[0].id];
  await t.play(0, ORG, { hero: 0, noGrant: true });
  R.check('Escape Device (0 in der Ablage) wehrt den Lv-0-Zauber Organnon für einen Helden ab', [0, 1, 2].some(h => t.hp(1, h) === 800) && t.hp(1, 1) === 700, [0, 1, 2].map(h => t.hp(1, h)));
  // Jetpack: Lv-0-Attacke, 0 Jetpack in der Ablage
  t = await H.fresh({ hand: [['Attack'], []], discard: [[], []] });
  t.put(1, 0, 0, JET);
  t.hero(0, 0).atk = 100; t.hero(0, 0).baseAtk = 100;
  t.targetFn = (v) => { const x = v.find(z => z.type === 'hero' && z.owner === 1 && z.heroIdx === 0); return x ? [x.id] : []; };
  await t.play(0, 'Attack', { hero: 0 });
  R.check('Jetpack (0 in der Ablage) wehrt die Lv-0-Attacke „Attack“ ab (gleiche Zählweise wie Escape Device)', t.hp(1, 0) === 800, t.hp(1, 0));
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
