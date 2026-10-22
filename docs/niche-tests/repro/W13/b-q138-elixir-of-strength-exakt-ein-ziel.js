'use strict';
// W13 / Q138 (M01-12) · Elixir of Strength: „The next time that Hero hits exactly 1 target with an Attack …"
// Al: „Nur bei exakt einem Ziel. Aber: Ricochet z.B. trifft initial *exakt ein Ziel*, bevor die Attacke sich fortsetzt, *da* funktioniert es!"
// Erwartung: (a) Whirlwind Strike auf 2 Helden (4 Ziele): kein Bonus, Buff bleibt; (b) danach eine Ein-Ziel-Attack: +150 (W49a: früher +100), Buff weg;
// (c) Ricochet: der erste Treffer bekommt +150 (190), die folgenden die Hälfte des VOLLEN Vorgängerschadens (W49a), Buff danach weg. Exit 0 = korrekt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  { const t = await H.fresh({ hand: [['Elixir of Strength', 'Whirlwind Strike', 'Attack'], []], hp: 800 });
    t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === 0 && x.heroIdx === 0).id];
    await t.play(0, 'Elixir of Strength');
    t.put(1, 0, 0, H.INERT.creature); t.put(1, 1, 0, H.INERT.creature);
    t.targetFn = (valid) => valid.filter(v => v.type === 'hero' && v.owner === 1).slice(0, 2).map(v => v.id);
    const vor = [t.hp(1, 0), t.hp(1, 1)];
    await t.play(0, 'Whirlwind Strike', { hero: 0 });
    const dmg = [vor[0] - t.hp(1, 0), vor[1] - t.hp(1, 1)];
    R.check('(a) Mehrziel-Attack: kein Bonus (je 40), Buff bleibt', dmg[0] === 40 && dmg[1] === 40 && !!t.hero(0, 0).buffs?.empowered_strike, { dmg, buffs: Object.keys(t.hero(0, 0).buffs || {}) });
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 2).id];
    const h2 = t.hp(1, 2);
    await t.play(0, 'Attack', { hero: 0 });
    R.check('(b) danach Ein-Ziel-Attack: 40 + 150 = 190, Buff verbraucht', h2 - t.hp(1, 2) === 190 && !t.hero(0, 0).buffs?.empowered_strike, { dmg: h2 - t.hp(1, 2), buffs: Object.keys(t.hero(0, 0).buffs || {}) });
    R.check('(a/b) keine Engine-Fehler', t.errors.length === 0, t.errors); }
  { const t = await H.fresh({ hand: [['Elixir of Strength', 'Ricochet'], []], hp: 800 });
    t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === 0 && x.heroIdx === 0).id];
    await t.play(0, 'Elixir of Strength');
    t.targetFn = (valid) => [valid[0].id];
    const vor = [t.hp(1, 0), t.hp(1, 1), t.hp(1, 2)];
    await t.play(0, 'Ricochet', { hero: 0 });
    const treffer = [0, 1, 2].map(i => vor[i] - t.hp(1, i)).filter(x => x > 0);
    R.note('Ricochet-Treffer an Gegnerhelden', treffer);
    R.check('(c) Ricochet: erster Treffer 190 (= 40 + 150)', treffer.includes(190), treffer);
    R.check('(c) Buff nach Ricochet verbraucht', !t.hero(0, 0).buffs?.empowered_strike, Object.keys(t.hero(0, 0).buffs || {}));
    R.check('(c) keine Engine-Fehler', t.errors.length === 0, t.errors); }
  R.finish();
})();
