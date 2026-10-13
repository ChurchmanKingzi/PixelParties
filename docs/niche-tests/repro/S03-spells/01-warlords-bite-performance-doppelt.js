'use strict';
// S03-01 · The Warlord's Bite zählt Performance doppelt
// Kartentext: „Choose a target that is not Poisoned yet and inflict 1/2/4 Stacks of Poison to it."
//   (Staffel = Decay-Magic-Stufe des Nutzers; Performance „becomes a copy of that Ability, increasing it to the next level"
//    = zählt als Joker INNERHALB der Stufe, `countAbilitiesForSchool` rechnet das bereits ein.)
// Aufbau: Held 0 mit Decay Magic ×1 + Performance (gestapelt in derselben Zone) = Decay Magic Stufe 2.
// Erwartet: 2 Stacks (Stufe 2) – wie bei Slow (2/3/4 Karten, Stufe 2 ⇒ 3) über `effectiveSchoolLevelForCaster`.
// Beobachtet: 4 Stacks (Stufe 3): das Skript addiert `effectiveSchoolLevelForCaster('Decay Magic')` (enthält die Performance-Joker)
//   und danach noch einmal `countAbilitiesForSchool('Performance', …)` ⇒ jede Performance-Karte zählt doppelt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  async function stacks(zones) {
    const t = await H.fresh({ hand: [["The Warlord's Bite"], []], abilities: { 0: { 0: zones } } });
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
    const r = await t.play(0, "The Warlord's Bite", { hero: 0, noGrant: true });
    const st = t.gs.players[1].heroes[0].statuses.poisoned;
    return { r, stacks: st && st.stacks, errors: t.errors.length, level: t.engine.effectiveSchoolLevelForCaster('Decay Magic', 0, 0) };
  }
  const a = await stacks([['Decay Magic'], [], []]);
  R.check('Decay Magic 1 ⇒ 1 Stack', a.stacks === 1, a);
  const b = await stacks([['Decay Magic', 'Performance'], [], []]);
  R.check('Decay Magic 1 + Performance (= Stufe 2) ⇒ 2 Stacks', b.stacks === 2, b);
  const c = await stacks([['Decay Magic', 'Decay Magic'], [], []]);
  R.check('Decay Magic 2 ⇒ 2 Stacks', c.stacks === 2, c);
  const d = await stacks([['Decay Magic', 'Decay Magic', 'Performance'], [], []]);
  R.check('Decay Magic 2 + Performance (= Stufe 3) ⇒ 4 Stacks', d.stacks === 4, d);
  R.finish();
})();
