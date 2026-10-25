'use strict';
// W75 · Darion — Lunatic Hawk: „2+: Whenever you equip an Artifact to a Hero, its controller draws 1 card." zaehlt jede Karte des Stapels einzeln; die „verschiedenen Lunatic Cycle auf dem Brett" werden je Karte gezaehlt, nicht je Zone (Audit P4b, Klasse B/E).
// Kartentext: „1+: While you control no Creatures, summoning this counts as an additional Action. 2+: Whenever you equip an Artifact to a Hero, its controller draws 1 card. …" (Stufe nach der Zahl verschiedener „Lunatic Cycle"-Karten auf dem Brett.)
// Erwartet: New Moon + Crescent + Half Moon + Gibbous Moon liegen in EINEM Platz = 4 verschiedene Karten; jedes Anlegen ab dem zweiten zieht eine Karte; Stufe 4 ist erreicht.
// Aufruf: node docs/niche-tests/repro/W75/h-P4b-08-lunatic-hawk-zieht-je-equip-im-stapel.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const LS = require('../../../../cards/effects/_lunatic-shared.js');
const D = 'Darion, the Blood-Crazy Groundskeeper', F = H.INERT.filler;
const NM = 'Lunatic Cycle - New Moon', CM = 'Lunatic Cycle - Crescent Moon', HM = 'Lunatic Cycle - Half Moon', GM = 'Lunatic Cycle - Gibbous Moon';
function stapel(t, seat, namen, slot = 1, hi = 0) {
  const ps = t.gs.players[seat]; ps.supportZones[hi][slot] = [];
  return namen.map(n => { ps.supportZones[hi][slot].push(n); const i = t.engine._trackCard(n, seat, 'support', hi, slot); i.turnPlayed = 1; return i; });
}
(async () => {
  const R = H.runner();
  const t = await H.fresh({ active: 0, heroes: [[D, 'Tushu, the Knowledge Keeper', null], [F, null, null]], hand: [[HM, GM, F], [F]], gold: 100 });
  const h = t.put(0, 1, 0, 'Lunatic Hawk'); h.turnPlayed = 1;
  stapel(t, 0, [NM, CM], 1, 0);
  R.check('2 verschiedene Lunatic Cycle in einem Platz = 2', LS.countDistinctLunaticCycle(t.engine) === 2, LS.countDistinctLunaticCycle(t.engine));

  const h0 = t.pile(0, 'hand').length;
  await t.play(0, HM, { hero: 0 });
  R.check('Half Moon liegt im Stapel (Platz 1)', JSON.stringify(t.gs.players[0].supportZones[0][1]) === JSON.stringify([NM, CM, HM]), t.gs.players[0].supportZones[0]);
  R.check('Hawk zog 1 Karte (Hand: -1 Half Moon, +1)', t.pile(0, 'hand').length === h0, [h0, t.pile(0, 'hand').length]);

  t.resetActions(0);
  const h1 = t.pile(0, 'hand').length;
  await t.play(0, GM, { hero: 0 });
  R.check('Gibbous Moon liegt oben im Stapel', JSON.stringify(t.gs.players[0].supportZones[0][1]) === JSON.stringify([NM, CM, HM, GM]), t.gs.players[0].supportZones[0]);
  R.check('Hawk zog wieder 1 Karte', t.pile(0, 'hand').length === h1, [h1, t.pile(0, 'hand').length]);
  R.check('4 verschiedene Lunatic Cycle in einem Platz = 4', LS.countDistinctLunaticCycle(t.engine) === 4, LS.countDistinctLunaticCycle(t.engine));

  R.check('sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  R.finish();
})();
