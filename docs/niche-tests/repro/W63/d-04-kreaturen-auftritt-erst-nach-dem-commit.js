'use strict';
// W63d-04 · Kreaturen mit abbrechbaren Kosten-/Zonenfragen vor dem Landen: Flug, Beschwörungsschein und Protokoll erst nach dem Commit (Al, 22.10.2026)
//
// Regel (CARD_API „Auftritt streamen — erst nach dem Commit"): die Beschwörung hat abbrechbare Stellen VOR dem Landen — Tribut-/Opferwahl (`paySummonCost`), Fragen von `beforeSummon`.
// Vorher: bricht der Spieler dort ab, schrieb der Server eine Protokollzeile `creature_fizzle` / `sacrifice_cancelled` MIT dem Kartennamen an den Gegner (die Karte blieb auf der Hand!), und die
//   Opferwahl-Animationen liefen ebenfalls vor dem Commit an den Gegner. Jetzt: stumme Vormerkung (`stumm: true`, kein `card_reveal` — die Kreatur zeigt sich durch Flug + Schein), die beim Landen
//   freigegeben wird; jeder Abbruchzweig löscht sie samt Puffer.
// Szene: reiche Standard-Szene (eigene Kreaturen als Opfer); MENSCH-Modus. Je Karte ein Durchlauf + ein Abbruch an jeder abbrechbaren Stelle. Exit 0 = korrekt.
const W = require('../../lib/wire.js');
// [Karte, Mindestzahl abbrechbarer Stellen, auch Sitz 1?]
const KARTEN = [
  ['Archer of Teocuilatl', 1, true], ['Warrior of Teocuilatl', 1, false], ['Guardian of Teocuilatl', 1, false],
  ['500 Piranhas in a Monster Suit', 1, false], ['Doctor Fester', 1, false], ['Knight of Kings [W]', 1, false],
  ['The Egg of God', 1, false],
];
(async () => {
  const R = W.runner();
  for (const [karte, nCanc, auchSitz1] of KARTEN) {
    for (const seat of auchSitz1 ? [0, 1] : [0]) {
      const label = `${karte}${seat ? ' (Sitz 1)' : ''}`;
      R.section(label);
      const mk = () => W.reicheSzene({ seat, karten: [karte] });
      const d = await W.durchlauf(mk, seat, karte, { seat, hero: 0, maxCancel: 4 });
      W.pruefeDurchlauf(R, label, d, { seat, nCanc });
    }
  }
  R.finish();
})();
