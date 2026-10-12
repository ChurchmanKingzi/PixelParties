'use strict';
// A01-pollution-07 · Doom Prophecy: legt man die Doom Clock in die GEGNERISCHE Area-Zone, verschwindet die Zauberkarte
// Kartentext: „Search your deck for a „Doom Clock“ and place it into your Area Zone. If the user has at least Decay Magic 2, you may place it
//   into your opponent's Area Zone instead. Then, place 3 Doom Counters onto it. Immediately end your turn afterwards.“
// Erwartung: wie jeder gespielte Zauber landet Doom Prophecy nach der Auflösung in der Ablage des Spielers (Kartenbilanz: Hand −1, Ablage +1,
//   Uhr aus dem Deck aufs Brett).
// Beobachtet: bei der Wahl „Opponent's Area Zone“ ist Doom Prophecy in KEINEM Stapel mehr (Hand leer, Ablage leer, Gelöscht leer; Kartenbilanz −1)
//   (außerdem bleibt eine zusätzliche Instanz der Karte in Zone 'hand' zurück). Bei der Wahl „My Area Zone“ landet sie korrekt in der Ablage.
// Ursache: Engine `placeArea(playerIdx, …)` (cards/effects/_engine.js:~27386) liest `_resolvingCard` vom Besitzer der AREA-Zone
//   (`gs.players[playerIdx]`). Legt Doom Prophecy die Uhr in die Zone des Gegners, ist dort `_resolvingCard` leer → `gs._spellPlacedOnBoard = true`
//   („der gerade aufgelöste Zauber hat sich selbst aufs Brett gelegt“) → doPlaySpell legt Doom Prophecy nicht in die Ablage.
// Aufruf: node docs/niche-tests/repro/A01-pollution/07-doom-prophecy-gegnerzone-karte-verschwindet.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const wahl of ['self', 'opp']) {
    R.section('Wahl: ' + (wahl === 'opp' ? 'gegnerische Area-Zone' : 'eigene Area-Zone'));
    const t = await H.fresh({ hand: [['Doom Prophecy'], []], deck: [['Doom Clock', ...Array(10).fill(H.INERT.creature)], []], abilities: { 0: { 0: [['Decay Magic', 'Decay Magic'], [], []] } } });
    t.script.push({ match: d => d && d.type === 'optionPicker' && d.title === 'Doom Prophecy', answer: () => ({ optionId: wahl }) });
    const vorher = t.census();
    const r = await t.play(0, 'Doom Prophecy', { hero: 0 });
    const diff = t.censusDiff(vorher, t.census());
    R.check('Doom Prophecy gespielt, Uhr liegt in der gewählten Area-Zone', r === true && t.gs.areaZones[wahl === 'opp' ? 1 : 0].includes('Doom Clock'), t.gs.areaZones);
    R.check('Doom Prophecy liegt in der Ablage des Spielers (Karte nicht verschwunden)', t.pile(0, 'discardPile').includes('Doom Prophecy'), { ablage: t.pile(0, 'discardPile'), bilanz: diff });
    R.check('Kartenbilanz ausgeglichen', diff.length === 0, diff);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
