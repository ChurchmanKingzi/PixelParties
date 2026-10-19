'use strict';
// A05-skeletons-28 · Spider Hive auf der HAND senkt bereits die Stufen verdeckter Surprises
// Kartentext (Spider Hive, Area): „The levels of all face-down Surprises on the board are reduced by the number of "Spider" Creatures on the board until they are activated."
// Erwartung: Wirkt nur, solange die Karte als Area ausliegt. Mit dem Hive nur auf der Hand ist Crimson Web (Decay Magic Lv3) für einen Helden mit Decay Magic 1 NICHT auslösbar.
// Beobachtet: Hive auf der Hand + 2 Spinnen auf dem Brett senken Crimson Web auf Stufe 1; das Web löst für den Decay-1-Helden aus (Angriff wird negiert, Web hängt am Angreifer).
// Ursache: spider-hive.js `activeIn: ['hand','area']` + `reduceCardLevel` ohne Zonenprüfung (anders als The Bonegrinder, das `inst.zone !== 'hand'` prüft).
const H = require('../../lib/h.js');
async function lauf(wo) {
  const t = await H.fresh({ hand: [['Fireball', ...(wo === 'hand' ? ['Spider Hive'] : [])], []] });
  t.setAbilities(0, 0, [['Destruction Magic', 'Destruction Magic'], [], []]);   // W16c: Fireball ist Lv2 – mit Destruction Magic 1 wurde der Zauber gar nicht gespielt (alle Läufe zeigten hp 800)
  t.setAbilities(1, 0, [['Decay Magic'], [], []]);            // Decay Magic 1: Crimson Web (Lv3) eigentlich nicht auslösbar
  const s1 = t.put(0, 2, 0, 'Cute Spider'); s1.turnPlayed = 1;
  const s2 = t.put(1, 2, 0, 'Cute Spider'); s2.turnPlayed = 1;
  if (wo === 'area') t.putArea(0, 'Spider Hive');
  t.putSurprise(1, 0, 'Crimson Web');
  t.targetFn = (valid) => [valid.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0).id];
  await t.play(0, 'Fireball', { hero: 0, noGrant: true });
  return { webAusgeloest: t.gs.players[1].surpriseZones[0].length === 0, hp: t.hp(1, 0) };
}
(async () => {
  const R = H.runner();
  const keins = await lauf('kein'), hand = await lauf('hand'), area = await lauf('area');
  R.note('ohne Hive / Hive auf Hand / Hive in Area', { keins, hand, area });
  R.check('Kontrolle: mit Hive in der Area löst das Web (2 Spinnen: Stufe 3→1) aus', area.webAusgeloest === true, area);
  R.check('Kontrolle: ohne Hive löst das Web (Decay 1 < Lv3) nicht aus', keins.webAusgeloest === false, keins);
  R.check('Hive nur auf der Hand: Web löst NICHT aus', hand.webAusgeloest === false, hand);
  R.finish();
})();
