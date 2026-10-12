'use strict';
// C02-creatures-04 · Drill Sergeant (Platzieren) umgeht „You can only control 1" (Ethan, Ellie)
// Kartentexte: Ethan, the Prodigy / Ellie, the Class President: „… You can only control 1 „<Name>"."
//              Drill Sergeant: „You may once per turn choose a level 1 or lower Creature from your hand and place it into a free Support Zone of the corresponding Hero."
// Ruling (CARD_API.md Z. 1965): Platzieren zählt als Effekt-Beschwörung. Ethans Skript lässt die Sperre ausdrücklich für JEDE Beschwörung gelten
//   („`beforeSummon` ist eine Karten-Funktion, die der Motor vor JEDER Beschwörung dieser Karte aufruft", CARD_API.md Z. 15371).
// Aufbau: Sitz 0: Drill Sergeant (Zone 0/0) + Ethan (bzw. Ellie) auf dem Brett (Zone 0/1) + eine zweite Kopie auf der Hand.
// Schritte: Drill Sergeant aktivieren, die Handkopie wählen.
// Erwartung: Die zweite Kopie wird nicht gelegt (bleibt auf der Hand) – es darf nur 1 kontrolliert werden.
// Beobachtet: Die zweite Kopie wird gelegt (2 Ethans → −2 Stufe in beiden Händen; 2 Ellies).
// Ursache: `_engine.js actionPlaceCreature` (~Z. 25949-26290) ruft die Karten-Funktion `beforeSummon` nie auf; `drill-sergeant.js eligibleHandCards` prüft nur Stufe/Art.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const nm of ['Ethan, the Prodigy', 'Ellie, the Class President']) {
    const t = await H.fresh({ hand: [[nm], []] });
    const mk = (s, h, z, n) => { const i = t.put(s, h, z, n); i.turnPlayed = 1; return i; };
    mk(0, 0, 0, 'Drill Sergeant'); mk(0, 0, 1, nm);
    t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: nm }) });
    t.gs.activePlayer = 0; t.phase(2);
    await t.activateCreature(0, 0, 0);
    const n = t.inst(c => c.name === nm && c.zone === 'support').length;
    R.check(nm + ': nur 1 auf dem Brett', n === 1, { n, hand: t.pile(0, 'hand') });
    R.check(nm + ': keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  R.finish();
})();
