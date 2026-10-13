'use strict';
// R01-07 · Divine Gift of the Guardian macht ALLE eigenen Kreaturen immun, nicht nur „those Creatures"
// Kartentext: „You can only activate 1 "Divine Gift" card per game. Play this card immediately when 1 or more Creatures you control would take damage.
//   Negate any damage **those** Creatures would take until the beginning of your next turn."
// Skriptkopf (divine-gift-of-the-guardian.js): „grants ALL the player's Creatures complete damage immunity until the start of the player's next turn".
// Aufbau: Sitz 1 hat 3 Kreaturen (Held 0/1/2) und Divine Gift of the Guardian auf der Hand; Sitz 0 spielt Fireball auf die Kreatur an Held 0, danach (selber Zug) Fireball auf die an Held 1.
// Erwartet: Die erste Kreatur ist geschützt (200 HP), die beiden anderen („those Creatures" = die, die Schaden erleiden würden) sind NICHT immun – der zweite Fireball trifft (HP 50).
// Beobachtet: Alle drei Kreaturen bekommen `_guardianImmune`; der zweite Fireball prallt ab (HP 200).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Fireball', 'Fireball'], ['Divine Gift of the Guardian']] });
  t.grantFor(1, 0, 'Divine Gift of the Guardian');
  const a = t.put(1, 0, 0, H.INERT.creature), b = t.put(1, 1, 0, H.INERT.creature), c = t.put(1, 2, 0, H.INERT.creature);
  t.targetFn = (valid) => [valid.find(x => x.type === 'equip' && x.owner === 1 && x.heroIdx === 0).id];
  await t.play(0, 'Fireball', { hero: 0 });
  R.check('Divine Gift of the Guardian hat reagiert, erste Kreatur unversehrt', a.counters.currentHp === 200 && t.pile(1, 'discardPile').includes('Divine Gift of the Guardian'), { hp: a.counters.currentHp });
  R.check('nur die betroffene Kreatur ist als immun markiert', !!a.counters._guardianImmune && !b.counters._guardianImmune && !c.counters._guardianImmune, [a, b, c].map(x => !!x.counters._guardianImmune));
  t.targetFn = (valid) => [valid.find(x => x.type === 'equip' && x.owner === 1 && x.heroIdx === 1).id];
  await t.play(0, 'Fireball', { hero: 0 });
  R.check('Fireball auf eine andere (nicht betroffene) Kreatur trifft: HP 50', b.counters.currentHp === 50, b.counters.currentHp);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
