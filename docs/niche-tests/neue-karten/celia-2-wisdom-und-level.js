const H = require('../lib/h.js');
const CELIA = 'Celia, the Class Clown';
(async () => {
  const R = H.runner();
  for (const variante of ['A: nur der Zauber auf der Hand', 'B: 2 weitere Handkarten', 'C: 1 weitere Handkarte']) {
    const extra = variante.startsWith('B') ? ['Heal', 'Heal'] : variante.startsWith('C') ? ['Heal'] : [];
    const t = await H.fresh({ active: 1, hand: [[], ['Burning Finger', ...extra]], hp: 800 });
    t.setAbilities(1, 0, [['Destruction Magic'], ['Wisdom'], []]);
    const celia = t.put(0, 0, 0, CELIA); celia.turnPlayed = 1;
    t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 0 && v.heroIdx === 0).id];
    await t.play(1, 'Burning Finger', { hero: 0, noGrant: true });
    R.note(variante, JSON.stringify({ prompts: t.prompts.map(p => p.pi + p.d.type + (p.d.title || '')), hand: t.pile(1, 'hand'), dis: t.pile(1, 'discardPile'), hp0: t.hp(0, 0) }));
    if (variante.startsWith('A')) R.check('A: nichts zum Abwerfen -> negiert (kein Schaden)', t.hp(0, 0) === 800 && t.pile(1, 'discardPile').includes('Burning Finger'), [t.hp(0, 0), t.pile(1, 'discardPile')]);
    if (variante.startsWith('B')) R.check('B: Zauber wirkt, Wisdom-Zusatz bezahlt (Heal abgeworfen)', t.hp(0, 0) < 800 && t.pile(1, 'discardPile').filter(n => n === 'Heal').length >= 1, [t.hp(0, 0), t.pile(1, 'discardPile')]);
    R.check(variante + ': sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  // Lv0-Zauber (ZZ Filler) durch Celia auf Lv1: negiert (Stempel + Log), Held ohne Schule
  const t = await H.fresh({ active: 1, hand: [[], [H.INERT.filler]] });
  const celia = t.put(0, 0, 0, CELIA); celia.turnPlayed = 1;
  await t.play(1, H.INERT.filler, { hero: 0, noGrant: true });
  R.check('Spell OHNE Schule (ZZ Filler): hat keine Stufenanforderung, kann nie "zu hoch" werden => kein celia_negate', t.lg('celia_negate').length === 0, t.lg('celia_negate'));
  // Lv0-Zauber MIT Schule: Curse (Decay Magic Lv0) -> Lv1, Held ohne Decay Magic => negiert
  const t2 = await H.fresh({ active: 1, hand: [[], ['Curse']] });
  const c2 = t2.put(0, 0, 0, CELIA); c2.turnPlayed = 1;
  t2.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 0 && v.heroIdx === 0).id];
  await t2.play(1, 'Curse', { hero: 0, noGrant: true });
  R.note('curse', JSON.stringify({ prompts: t2.prompts.map(p => p.pi + p.d.type + (p.d.title || '')), dis: t2.pile(1, 'discardPile'), logs: t2.logs.map(l => l.type) }));
  R.check('Curse Lv0 -> Lv1, Held ohne Decay Magic: negiert', t2.lg('celia_negate').length === 1, t2.lg('celia_negate'));
  R.check('Lv0: sauber', t.errors.length === 0 && t.audit().length === 0);
  R.finish();
})();
