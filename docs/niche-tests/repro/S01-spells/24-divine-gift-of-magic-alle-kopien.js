'use strict';
// S01-24 · Divine Gift of Magic: die Stufensenkung gilt für ALLE Kopien des Namens, nicht nur für den offenbarten Zauber
// Kartentext: „Reveal a Spell from your hand. Until the end of this turn, that Spell's level in your hand is reduced by 3."
// Das Skript speichert `ps._magicLevelReductions = [{ cardName, amount: 3 }]` (nach NAME). Der Engine-Weg `_applyCardLevelReductions` addiert den Eintrag für jede Karte dieses Namens
//   (auch für später gezogene Kopien und für Pile-Auswertungen, `effectiveCardLevel(cd, pi, { pileSide: true })` = 0). Die Engine kennt einen Kopie-genauen Weg (`ps._handLevelOffsets[handIdx]`).
// Aufbau: Held 0 ohne Destruction Magic; Hand: Divine Gift of Magic, Fireball (Lv2) ×2. Das Gift offenbart die erste Fireball-Kopie.
// Lesart A (Text wörtlich): nur diese eine Kopie ist gesenkt ⇒ der erste Fireball ist spielbar, der zweite nicht.
// Lesart B (Skript): beide Kopien sind gesenkt.
// Beobachtet: Lesart B.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Divine Gift of Magic', 'Fireball', 'Fireball'], []], abilities: { 0: { 0: [['Magic Arts'], [], []] } } });
  t.script.push({ match: d => d.type === 'pickHandCard', answer: (d) => { const i = d.eligibleIndices[0]; return { cardName: t.gs.players[0].hand[i], handIndex: i }; } });
  t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0).id];
  await t.play(0, 'Divine Gift of Magic', { hero: 0, noGrant: true });
  const r1 = await t.play(0, 'Fireball', { hero: 0, noGrant: true, keepActions: true });
  const r2 = await t.play(0, 'Fireball', { hero: 0, noGrant: true });          // frische Aktion: nur die Stufe entscheidet
  R.check('der offenbarte Fireball (erste Kopie) ist ohne Destruction Magic spielbar', r1 === true, { r1 });
  R.check('die zweite, nicht offenbarte Kopie bleibt auf Stufe 2 (nicht spielbar)', r2 === false, { r2, hand: t.pile(0, 'hand') });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
