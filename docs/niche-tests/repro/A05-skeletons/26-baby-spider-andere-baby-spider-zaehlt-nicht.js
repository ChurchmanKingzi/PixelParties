'use strict';
// A05-skeletons-26 · Baby Spider: eine andere Baby Spider zählt nicht als „another Spider Creature"
// Kartentext (Baby Spider): „While you control another "Spider" Creature, summoning this Creature counts as an additional Action. You can only summon 1 "Baby Spider" with this effect per turn. …"
// Der Satz „only 1 Baby Spider with this effect per turn" setzt voraus, dass mehrere Baby Spiders im Spiel sein können; eine bereits liegende Baby Spider ist eine ANDERE Spider Creature.
// Aufbau: Main Phase 2 (keine Aktion mehr), Hand [Baby Spider], auf dem Brett nur eine Baby Spider bzw. (Kontrolle) eine Cute Spider.
// Erwartung: In beiden Fällen ist die Baby Spider als Zusatzaktion beschwörbar.
// Beobachtet: Mit liegender Cute Spider ✓; mit liegender Baby Spider wird die Beschwörung abgelehnt.
// Ursache: baby-spider.js `controlsAnotherSpider`: `if (inst.name === CARD_NAME) continue;` schließt alle Baby Spiders aus, nicht nur die zu beschwörende Karte (die liegt zu dem Zeitpunkt noch gar nicht auf dem Brett).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const andere of ['Cute Spider', 'Baby Spider']) {
    const t = await H.fresh({ hand: [['Baby Spider'], []] });
    t.setAbilities(0, 0, [['Summoning Magic'], [], []]);
    const a = t.put(0, 0, 1, andere); a.turnPlayed = 1;
    t.gs.activePlayer = 0; t.phase(4);
    const r = await t.play(0, 'Baby Spider', { hero: 0, slot: 0, phase: 4 });
    R.check(`Main Phase 2: Baby Spider beschwörbar mit liegender ${andere}`, r === true && t.gs.players[0].supportZones[0][0].length === 1, { r });
  }
  R.finish();
})();
