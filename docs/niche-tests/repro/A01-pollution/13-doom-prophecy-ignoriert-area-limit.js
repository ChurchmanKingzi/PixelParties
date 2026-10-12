'use strict';
// A01-pollution-13 · Doom Prophecy ignoriert das Area-Limit (Grundwert 1 pro Spieler)
// Kartentext: „Search your deck for a „Doom Clock“ and place it into your Area Zone. If the user has at least Decay Magic 2, you may place it into your
//   opponent's Area Zone instead.“
// Regel (_engine.js `areaLimitFor`/`canPlaceAnotherArea`/`enforceAreaLimit`, Als Ruling 14.9.): jeder Spieler kontrolliert höchstens 1 Area (3 mit Spatial Crevice);
//   zwei Kopien DERSELBEN Area sind nie zugleich kontrollierbar; Überhang wird vom Besitzer durch Ablegen aufgelöst.
// Erwartung: nach Doom Prophecy kontrolliert jeder Spieler höchstens 1 Area (der Zonen-Besitzer wählt, welche geht – bzw. die Uhr ersetzt die alte).
// Beobachtet: Doom Prophecy ruft `placeArea` ohne Limitprüfung; liegt schon eine Area (Cosmic Depths) in der Zielzone, liegen danach 2 Areas dort, beide wirksam;
//   ebenso zwei Doom Clocks nebeneinander in derselben Zone, wenn die eigene Zone schon eine Uhr hält.
// Ursache: cards/effects/doom-prophecy.js – `engine.placeArea(ziel, inst)` ohne `canPlaceAnotherArea` / ohne anschließendes `enforceAreaLimit(ziel)`.
// Aufruf: node docs/niche-tests/repro/A01-pollution/13-doom-prophecy-ignoriert-area-limit.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const [name, wahl, vorhanden, seat] of [['Gegner-Zone mit fremder Area', 'opp', 'Cosmic Depths', 1], ['eigene Zone, schon eine Doom Clock', 'self', 'Doom Clock', 0]]) {
    R.section(name);
    const t = await H.fresh({ hand: [['Doom Prophecy'], []], deck: [['Doom Clock', ...Array(10).fill(H.INERT.creature)], []], abilities: { 0: { 0: [['Decay Magic', 'Decay Magic'], [], []] } } });
    t.putArea(seat, vorhanden);
    t.script.push({ match: d => d && d.type === 'optionPicker' && d.title === 'Doom Prophecy', answer: () => ({ optionId: wahl }) });
    t.script.push({ match: d => d && d.type === 'cardGallery' && d.title === 'Too many Areas', answer: (d) => ({ cardName: d.cards[0].name }) });
    await t.play(0, 'Doom Prophecy', { hero: 0 });
    R.check('Zonen-Besitzer kontrolliert höchstens 1 Area (Limit 1)', t.gs.areaZones[seat].length <= 1, t.gs.areaZones[seat]);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
