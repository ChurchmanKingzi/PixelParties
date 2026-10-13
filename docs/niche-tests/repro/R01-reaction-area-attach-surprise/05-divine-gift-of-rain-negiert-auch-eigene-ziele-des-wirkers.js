'use strict';
// R01-05 · Divine Gift of Rain negiert die GANZE Karte – auch die Wirkung auf die Ziele des Gegners
// Kartentext: „Play this card immediately when one or more targets you control would be affected by an opponent's card or effect. Negate any effects that card or
//   effect would have on targets you control."
// Vergleich: Barrier of Faith / Glass Wall nutzen `engine.grantEffectImmunity` (nur der geschützte Held), `divine-gift-of-rain.js` gibt dagegen `{ effectNegated: true }` zurück
//   (Kopfkommentar dort: „Negates the effect entirely").
// Aufbau: Sitz 0 hat Armageddon auf der Hand („Deal 50 damage to all targets, including the user"), Sitz 1 hat Divine Gift of Rain (Magic Arts 2 per grantFor).
// Schritte: 1. Sitz 0 spielt Armageddon. 2. Sitz 1 antwortet mit Divine Gift of Rain.
// Erwartet: Sitz 1 bleibt unversehrt (800/800/800), aber Sitz 0 – die Ziele des Wirkers – nimmt weiter 50 (750/750/750).
// Beobachtet: Beide Seiten bleiben bei 800; Armageddon ist komplett negiert (ebenso Cataclysm).
// Ursache: `cards/effects/divine-gift-of-rain.js` `postTargetResolve` → `return { effectNegated: true }` statt `engine.grantEffectImmunity(pi, heroIdx, sourceCard)` je eigenem Ziel.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Armageddon'], ['Divine Gift of Rain']] });
  t.grantFor(1, 0, 'Divine Gift of Rain');
  await t.play(0, 'Armageddon', { hero: 0 });
  R.check('Divine Gift of Rain wurde gespielt', t.pile(1, 'discardPile').includes('Divine Gift of Rain'), t.pile(1, 'discardPile'));
  R.check('Sitz 1 (Reagierender) bleibt unversehrt', [0, 1, 2].every(h => t.hp(1, h) === 800), [0, 1, 2].map(h => t.hp(1, h)));
  R.check('Sitz 0 (Wirker, nicht geschützt) nimmt weiter 50', [0, 1, 2].every(h => t.hp(0, h) === 750), [0, 1, 2].map(h => t.hp(0, h)));
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
