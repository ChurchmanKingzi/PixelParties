'use strict';
// N4-archetypen-13 · Alleria: wird die Umleitung auch angeboten, wenn der Gegner genau 1 KREATUR von mir wählt? (Stufe C – Lesart)
// Kartentext (Alleria, the Queen of Spiders): „Once per turn, when your opponent chooses exactly 1 target you control for an Attack, Spell or Creature effect, you may redirect that Attack,
//   Spell or effect to any of your Heroes that has a Surprise in its Surprise Zone. If you do, that Attack's or Spell's damage cannot be reduced or negated, except by a Surprise."
// Lesart A („target" = Held ODER Kreatur, wie überall im Spiel): auch eine einzeln gewählte Kreatur darf auf einen Helden mit Surprise umgeleitet werden.
// Lesart B (Heute): `canHeroRedirect` verlangt `selected.type === 'hero'` (alleria-the-queen-of-spiders.js) – Kreaturen-Wahl lässt keine Umleitung zu.
// Erwartung hier nach Lesart A; ✗ = heutiges Verhalten (Lesart B).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const heroes = [['Alleria, the Queen of Spiders', H.BLANK_HEROES[1], H.BLANK_HEROES[2]], [H.BLANK_HEROES[0], H.BLANK_HEROES[1], H.BLANK_HEROES[2]]];
  const t = await H.fresh({ heroes, hand: [['ZZ Filler'], ['Fireball']], deckSize: 30, active: 1 });
  t.putSurprise(0, 2, 'Spider Avalanche');
  const c = t.put(0, 1, 0, H.INERT.big);
  t.script.push({ match: d => d.type === 'confirm' && /Alleria/.test(d.title || ''), answer: () => ({ confirmed: true }) });
  t.targetFn = (valid) => [valid.find(v => v.type === 'equip' && v.owner === 0).id];
  await t.play(1, 'Fireball', { hero: 0 });
  const gefragt = t.prompts.filter(p => /Alleria/.test(p.d.title || '')).length;
  R.note('Fireball auf eine einzelne eigene Kreatur', `Kreatur HP=${c.counters.currentHp ?? 'voll'}, Held 2 HP=${t.hp(0, 2)}`);
  R.check('Alleria bietet die Umleitung bei genau 1 gewählter Kreatur an (Lesart A)', gefragt === 1, gefragt);
  R.finish();
})();
