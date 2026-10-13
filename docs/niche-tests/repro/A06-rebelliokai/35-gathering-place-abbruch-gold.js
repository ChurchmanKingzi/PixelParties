'use strict';
// A06-rebelliokai-35 · War Council Gathering Place: die 8 Gold sind weg, wenn die Zielwahl des Ratgebers danach abgebrochen wird
// Kartentext: „Whenever a player summons a "War Counselor" Creature, they may spend 8 Gold to immediately have it use its active effect."
// Beobachtung: `war-council-gathering-place.js` bucht die 8 Gold nach dem Ja (actionSpendGold) und ruft dann erst `onCreatureEffect` auf.
//   Harpthenean (Modus „Schaden") fragt danach eine abbrechbare Zielwahl; bricht der Spieler ab, ist die Wirkung nicht passiert,
//   die 8 Gold bleiben ausgegeben. Regel 23.9 (Abbruch = nichts ist passiert) ist für Karten mit Zielwahl formuliert; hier ist es eine Zusatzzahlung
//   einer Area, die die Kette selbst nicht kennt.
// Erwartung (Lesart A: Abbruch = nichts ist passiert): Gold unverändert gegenüber vor der Beschwörung.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const HARP = 'Harpthenean War Counselor';
  const t = await H.fresh({ hand: [[HARP], []] });
  t.putArea(0, 'War Council Gathering Place');
  t.script.push({ match: d => d.type === 'optionPicker' && d.title === HARP, answer: () => ({ optionId: 'damage' }) });
  t.policy.cancelTargets = true;
  const g0 = t.gs.players[0].gold;
  const r = await t.play(0, HARP, { hero: 0, slot: 0 });
  const delta = t.gs.players[0].gold - g0;
  R.check('Harpthenean beschworen (Aufbau)', r === true && t.zone(0, 0, 0) === HARP, { r, z: t.zone(0, 0, 0) });
  R.check('Gathering Place wurde angeboten und bezahlt (Aufbau)', t.logs.some(l => l.type === 'gathering_place_trigger'), t.logs.map(l => l.type));
  R.check('Zielwahl abgebrochen → kein Goldverlust', delta === 0, { delta, hp1: [0, 1, 2].map(i => t.hp(1, i)) });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
