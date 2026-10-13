'use strict';
// F03-artifacts-13 · Staff of Illusions: unspielbar unter 10 Gold, obwohl die Kosten einer Level-0-Kreatur 0 betragen (Stufe C)
// Kartentext: „Choose a level 3 or lower Creature from your deck or hand and place it into the Support Zone of any Hero you control. This Artifact's Cost is multiplied by the Creature's level."
// Der Skriptkopf sagt selbst „Cost = 10 × chosen Creature's level" und das Skript rechnet eine Level-0-Kreatur (auch effektiv Level 0 durch Rabatte) mit 0 Gold ab.
// Aufbau: Sitz 0 hat nur eine Level-0-Kreatur (Bird) auf der Hand, Gold 0 / 9 / 10; Staff of Illusions wird gespielt.
// Erwartung (Lesart A, Text wörtlich): bei jedem Goldstand spielbar, Kosten 0, Bird liegt auf dem Brett. Lesart B (Skript heute): Mindestgold 10 als Pauschalgate.
// Beobachtet: bei Gold 0 und 9 nicht spielbar (`canActivate`: `gold < 10 ⇒ false`, staff-of-illusions.js Z. ~63), bei Gold 10 spielbar (Kosten 0).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const gold of [0, 9, 10]) {
    const t = await H.fresh({ hand: [['Staff of Illusions', 'Bird'], []], gold, deckSize: 20 });
    t.script.push({ match: d => d.type === 'cardGallery' && d.title === 'Staff of Illusions', answer: () => ({ cardName: 'Bird', source: 'hand' }), once: false });
    const r = await t.play(0, 'Staff of Illusions');
    const aufBrett = [0, 1, 2].some(h => [0, 1, 2].some(s => t.zone(0, h, s) === 'Bird'));
    R.check(`Gold ${gold}: Staff spielbar, Bird (Lv0, Kosten 0) liegt auf dem Brett`, r === true && aufBrett && t.gs.players[0].gold === gold, { r, aufBrett, gold: t.gs.players[0].gold, hand: t.pile(0, 'hand') });
  }
  R.finish();
})();
