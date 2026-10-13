'use strict';
// M02-20 · Overflowing Chalice und Pressed Skill: die Wahlmenge „a Hero you control" nutzt die physische Heldenreihe statt der Kontrolle (gecharmte Helden)
// Kartentext: „Your opponent chooses a Hero you control. That Hero may immediately perform an additional Action."
// Engine-Definition der Kontrolle: `engine.heroesControlledBy(pi)` (Kontrolle hängt an `hero.charmedBy`).
// Erwartung: ein Held von mir, den der Gegner gecharmt hat, steht NICHT zur Wahl; ein Gegnerheld, den ich gecharmt habe, steht zur Wahl.
// Beobachtet: die Optionsliste ist immer meine drei physischen Helden (`lebendeHelden(ps)`, overflowing-chalice.js:33) – der gecharmte eigene Held wird angeboten
//   (und bekäme die Zusatzaktion des Besitzers), der von mir gecharmte Gegnerheld fehlt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const charm = (t, seat, hi, by) => { const h = t.gs.players[seat].heroes[hi]; h.charmedBy = by; h.statuses = { ...(h.statuses || {}), charmed: { duration: 5 } }; };
  async function optionen(setup) {
    const t = await H.fresh({ hand: [['Overflowing Chalice'], []], hp: 800 });
    setup(t);
    let opt = null;
    t.script.push({ match: d => d.type === 'optionPicker', answer: (d) => { opt = d.options.map(o => o.label); return { optionId: d.options[0].id }; } });
    t.script.push({ match: d => d.type === 'heroAction', answer: () => null });
    await t.play(0, 'Overflowing Chalice', { hero: 0 });
    return opt;
  }
  const a = await optionen(t => charm(t, 0, 1, 1));
  R.check('eigener, vom Gegner gecharmter Held (Rick) wird nicht angeboten', a && !a.some(n => /Rick/.test(n)), a);
  const b = await optionen(t => charm(t, 1, 0, 0));
  R.check('von mir gecharmter Gegnerheld (Atta) wird angeboten', b && b.some(n => /Atta/.test(n)), b);
  // Pressed Skill: „attach it to a Hero you control" – gleiche Klasse
  async function ps(setup) {
    const t = await H.fresh({ hand: [['Pressed Skill'], []], hp: 800, deck: [['Wealth', 'ZZ Dummy'], []] });
    setup(t);
    let el = null;
    t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: 'Wealth', source: 'deck' }) });
    t.script.push({ match: d => d.type === 'abilityAttachTarget', answer: (d) => { el = d.eligibleHeroIdxs; return null; } });
    await t.play(0, 'Pressed Skill', { hero: 0 });
    return el;
  }
  const c = await ps(t => charm(t, 0, 1, 1));
  R.check('Pressed Skill: eigener, vom Gegner gecharmter Held 1 ist kein zulässiges Ziel', c && !c.includes(1), c);
  R.finish();
})();
