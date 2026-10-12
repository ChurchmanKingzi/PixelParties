'use strict';
// A01-pollution-12 · Reality Crack (Engine `removeAllAreas`) dupliziert eine Area in der Ablage, wenn das Area-Limit sinkt
// Kartentext Reality Crack: „Send all Areas on the board to the discard pile. …“
// Aufbau (legal): Sitz 0 kontrolliert 3 Areas dank Spatial Crevice (Limit 3): Spatial Crevice (zuerst gelegt), The Fourth Circle of Hell, Acid Rain.
// Erwartung: alle drei Areas liegen danach je EINMAL in der Ablage; Kartenbilanz unverändert (nur Reality Crack wandert von der Hand in die Ablage).
// Beobachtet: `removeAllAreas` arbeitet eine Momentaufnahme der Area-Instanzen ab und ruft `removeArea` je Instanz. Das Entfernen von Spatial Crevice senkt das
//   Limit auf 1 → `enforceAreaLimit` (am Ende von `removeArea`) entfernt eine weitere Area („Too many Areas“-Wahl) → die Schleife ruft `removeArea` für diese
//   Instanz ein zweites Mal; `removeArea` prüft `cardInstance.zone` nicht und schiebt den Namen erneut in die Ablage → eine Karte ist doppelt (Kartenbilanz +1).
// Ursache: cards/effects/_engine.js `removeAllAreas` (~27550) bzw. `removeArea` (~27440): kein Zonenwächter (`deleteArea` hat einen: `cardInstance.zone !== 'area' → return`).
// Aufruf: node docs/niche-tests/repro/A01-pollution/12-reality-crack-dupliziert-area-bei-limit.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Reality Crack'], []] });
  for (const n of ['Spatial Crevice', 'The Fourth Circle of Hell', 'Acid Rain']) t.putArea(0, n);
  t.gs.players[0].deletedPile.push('Fireball', 'Heal');
  const vorher = t.census();
  t.policy.confirm = true;
  t.script.push({ match: d => d && d.type === 'cardGallery' && d.title === 'Reality Crack', answer: () => ({ cancelled: true }) });
  const r = await t.play(0, 'Reality Crack', { hero: 0 });
  const nachher = t.census();
  const diff = t.censusDiff(vorher, nachher).filter(x => !/^Magic Arts/.test(x));      // Magic Arts: die Harness gibt dem Helden die Schule für Reality Crack
  R.check('Reality Crack gespielt, alle Areas weg', r === true && t.gs.areaZones[0].length === 0, t.gs.areaZones);
  R.check('jede Area liegt genau einmal in der Ablage (Kartenbilanz unverändert)', diff.length === 0, diff);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
