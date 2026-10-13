'use strict';
// S01-21 · Divine Gift of Death: die Zusatzaktion wird auch gewährt, wenn nur EIN Held erweckt wird
// Kartentext: „Choose up to 1/2/3 defeated Heroes and revive them. … If at least 2 Heroes are revived by this effect, this counts as an additional Action."
// Aufbau: Held 0 mit Support Magic 2 (+ Destruction Magic 1), zwei gefallene eigene Helden, Action Phase. Der Spieler wählt nur EINEN Helden.
// Erwartet: nur 1 erweckt ⇒ der Zauber verbraucht die Aktion, ein weiterer Zauber im selben Zug ist nicht spielbar.
// Beobachtet: `inherentAction` (divine-gift-of-death.js) ist eine Funktion, die VOR der Wahl auswertet („≥ 2 gefallene Helden und Support Magic ≥ 2") – nicht die tatsächliche Zahl.
//   Nach dem Erwecken nur eines Helden ist ein Burning Finger trotzdem spielbar.
// Kontrolle: Bei Support Magic 1 (nur 1 erweckbar) ist keine Zusatzaktion da (✓).
const H = require('../../lib/h.js');
async function lauf(sm, wieviele) {
  const t = await H.fresh({ hand: [['Divine Gift of Death', 'Burning Finger'], []], abilities: { 0: { 0: [Array(sm).fill('Support Magic'), ['Destruction Magic'], []] } } });
  t.gs.players[0].heroes[1].hp = 0; t.gs.players[0].heroes[2].hp = 0;
  t.targetFn = (v) => v.map(x => x.id).slice(0, wieviele);
  await t.play(0, 'Divine Gift of Death', { hero: 0, noGrant: true });
  const erweckt = t.gs.players[0].heroes.filter((h, i) => i > 0 && h.hp > 0).length;
  t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0).id];
  const r2 = await t.play(0, 'Burning Finger', { hero: 0, keepActions: true, noGrant: true });
  return { erweckt, r2, errors: t.errors };
}
(async () => {
  const R = H.runner();
  const a = await lauf(2, 1);
  R.check('nur 1 Held erweckt ⇒ keine Zusatzaktion (weiterer Zauber nicht spielbar)', a.erweckt === 1 && a.r2 === false, a);
  const b = await lauf(2, 2);
  R.check('Kontrolle: 2 Helden erweckt ⇒ Zusatzaktion (weiterer Zauber spielbar)', b.erweckt === 2 && b.r2 === true, b);
  R.check('keine Engine-Fehler', a.errors.length === 0 && b.errors.length === 0);
  R.finish();
})();
