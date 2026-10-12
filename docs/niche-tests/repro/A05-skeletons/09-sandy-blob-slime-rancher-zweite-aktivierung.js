'use strict';
// A05-skeletons-09 · Sandy Blob reagiert nur auf die erste Aktivierung, wenn Slime Rancher den On-Summon-Effekt verdoppelt
// Kartentext Slime Rancher: „While you control this Creature, the effects of "Slime" Creatures that activate when they are summoned are activated an additional time."
// Kartentext Sandy Blob: „Up to 3 times per turn, when the on-summon effect of a Creature you control activates, … deal 50 damage to it."
// Erwartung: Shiny Slime beschworen bei Rancher + Blob: Effekt aktiviert zweimal (zieht doppelt) → Blob darf zweimal feuern (bis 3×/Zug).
// Beobachtet: Shiny zieht doppelt (Rancher wirkt), aber Blob öffnet sein Fenster nur einmal.
// Ursache: sandy-blob.js hört auf `onCardEnterZone`; slime-rancher.js löst die zweite Aktivierung als `runHooks('onPlay', {_onlyCard})` aus, ohne erneutes Eintrittssignal.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Shiny Slime'], []] });
  t.setAbilities(0, 0, [['Summoning Magic', 'Summoning Magic'], [], []]);
  t.setAbilities(0, 1, [['Summoning Magic'], [], []]);
  const blob = t.put(0, 0, 2, 'Sandy Blob'); blob.turnPlayed = 1;
  const ranch = t.put(0, 1, 0, 'Slime Rancher'); ranch.turnPlayed = 1;
  t.put(1, 0, 0, H.INERT.big);
  t.targetFn = (valid) => [valid[0].id];
  const hand0 = t.pile(0, 'hand').length;
  await t.play(0, 'Shiny Slime', { hero: 0, slot: 0 });
  const gezogen = t.pile(0, 'hand').length - (hand0 - 1);
  const n = t.targets.filter(x => x.config && x.config.title === 'Sandy Blob').length;
  R.note('gezogen (zwei Aktivierungen × Slimes mit Level 0 gezählt)', gezogen);
  R.check('Kontrolle: Shiny Slime wurde doppelt aktiviert (mehr als 1 Aktivierung gezählt)', gezogen >= 2, gezogen);
  R.check('Sandy Blob feuert für jede der zwei Aktivierungen', n === 2, n);
  R.finish();
})();
