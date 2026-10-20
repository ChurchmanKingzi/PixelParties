'use strict';
// N3-20 · Spirit of the Relic Hammer: zählt der Spirit selbst als „erste Kreatur des Zuges"? (Stufe C)
// Kartentext: „The first Creature each player summons during each of their turns may use its active effects the turn it is summoned."
// Lesart A (wörtlich): Wird der Spirit als ERSTE Kreatur des Zuges beschworen, ist er „die erste Kreatur" (er hat keinen aktiven Effekt) – die zweite Kreatur bekommt keine Haste, erst ab dem nächsten Zug.
// Lesart B (heute): der Spirit zählt nicht mit; die erste ANDERE Kreatur nach ihm bekommt Haste (`rein.name === CARD_NAME → return` in `onCardEnterZone`, Stempel erst bei Vergabe).
// Aufbau: Spirit als erste Kreatur, danach Field Cannon. Prüft Lesart A (✗ = heute Lesart B).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const HAM = 'Earth-Shattering Hammer, Relic of Deri', SP = 'Spirit of the Relic Hammer';
  const t = await H.fresh({ hand: [[SP, 'Field Cannon'], []] });
  t.setAbilities(0, 0, [['Summoning Magic', 'Summoning Magic', 'Summoning Magic'], [], []]);
  t.setAbilities(0, 1, [['Summoning Magic', 'Summoning Magic', 'Summoning Magic'], [], []]);
  t.put(0, 0, 0, HAM);
  await t.play(0, SP, { hero: 0, slot: 1, noGrant: true });
  await t.play(0, 'Field Cannon', { hero: 1, slot: 0, noGrant: true });
  const c = t.find('Field Cannon', 'support');
  R.check('Aufbau: Spirit zuerst, Cannon als zweite Kreatur des Zuges', !!c && t.gs.players[0]._creaturesSummonedThisTurn === 2, t.gs.players[0]._creaturesSummonedThisTurn);
  R.check('Lesart A: die zweite Kreatur des Zuges (Cannon) bekommt keine Haste', !(c && c.counters._hasHaste), c && Object.keys(c.counters));
  R.finish();
})();
