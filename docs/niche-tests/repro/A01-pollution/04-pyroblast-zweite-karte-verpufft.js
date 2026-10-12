'use strict';
// A01-pollution-04 · Pyroblast: „You can only play 1 Pyroblast per turn“ wird erst NACH dem Ausspielen geprüft
// Kartentext: „Choose any number of targets and deal 100 damage to them. Place the same number of Pollution Tokens into your free Support
//   Zones. You can only play 1 „Pyroblast“ per turn.“
// Erwartung: die zweite Pyroblast im selben Zug ist nicht spielbar (wie Rain of Arrows / Core Explosion / Laser Volley, die den Stempel
//   `gs.hoptUsed` in `spellPlayCondition` prüfen) – die Karte bleibt auf der Hand.
// Beobachtet: die zweite Pyroblast wird angenommen (doPlaySpell → true), verlässt die Hand, landet in der Ablage und tut nichts
//   (`if (hoptUsed …) return;` in onPlay, nach dem Ausspielen). Karte und Aktion sind verbraucht.
// Ursache: cards/effects/pyroblast.js – die Sperre steht nur in onPlay, es gibt kein `spellPlayCondition`.
// Aufruf: node docs/niche-tests/repro/A01-pollution/04-pyroblast-zweite-karte-verpufft.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Pyroblast', 'Pyroblast'], []] });
  t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0).id];
  const r1 = await t.play(0, 'Pyroblast', { hero: 0 });
  R.check('erste Pyroblast: 100 Schaden, 1 Token', r1 === true && t.hp(1, 0) === 700 && t.inst(c => c.name === 'Pollution Token').length === 1, [t.hp(1, 0)]);
  const r2 = await t.play(0, 'Pyroblast', { hero: 0 });
  R.check('zweite Pyroblast im selben Zug: nicht spielbar bzw. Karte bleibt auf der Hand', r2 === false || t.pile(0, 'hand').includes('Pyroblast'), { r2, hand: t.pile(0, 'hand'), ablage: t.pile(0, 'discardPile') });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
