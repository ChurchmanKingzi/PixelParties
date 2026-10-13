'use strict';
// H01-heroes-15 · Alice, the Transfer Student: der Zonen-Teil-Effekt hängt an der Spalte, nicht am Kontrolleur
//
// Kartentext: „Creatures with identical names in the Support Zones of a Hero you control share 1 Support Zone. This effect persists even when this Hero
//   is defeated and cannot be negated."
// Regel (CARD_API.md „Übernommene Helden gelten als Helden des Kontrolleurs"): „you/your" = Kontrolleur (Styx 28.9.).
// Aufbau: Sitz 0 hat Alice auf Held 0; Sitz 1 übernimmt sie dauerhaft (`actionTakeHeroPermanently`). Je zwei gleichnamige Dummys werden nacheinander auf
//   denselben Platz gespielt: Sitz 1 auf Alices Zonen (`charmedOwner: 0`), Sitz 0 auf Held 1.
// Erwartet: Sitz 1 (neuer Kontrolleur) darf die zweite Kreatur auf den belegten Alice-Platz legen; Sitz 0 (kontrolliert Alice nicht mehr) nicht auf seinen eigenen.
// Beobachtet: genau umgekehrt – Sitz 1 wird abgelehnt, Sitz 0 teilt weiter.
// Ursache: `_alice-shared.js` `sharingActive` (~Z. 66): prüft `gs.players[pi].heroes` (Spalte) auf den Namen und setzt `ps._aliceShareActive` dauerhaft;
//   keine `heroesControlledBy`-Auswertung (gleiche Klasse wie -03/-04).
// Hinweis: nach dem Kopfkommentar von `alice-the-transfer-student.js` hat die Karte noch kein Kartenbild (Oberfläche offen) – Auswirkung im echten Spiel derzeit gering.
const H = require('../../lib/h.js');
const AL = 'Alice, the Transfer Student', D = H.INERT.creature;
(async () => {
  const R = H.runner();
  const t = await H.fresh({ heroes: [[AL, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], hand: [[D, D, D], [D, D, D]] });
  await t.run(() => t.engine.actionTakeHeroPermanently(1, 0, 0, { sourceName: 'Test' }));
  t.gs.activePlayer = 1;
  const a = await t.play(1, D, { hero: 0, slot: 0, noGrant: true, charmedOwner: 0 });
  t.resetActions(1);
  const b = await t.play(1, D, { hero: 0, slot: 0, noGrant: true, charmedOwner: 0 });
  R.check('Sitz 1 (Kontrolleur): 1. Kreatur gelegt', a === true, a);
  R.check('Sitz 1 (Kontrolleur): 2. gleichnamige Kreatur darf auf den belegten Platz', b === true, [b, t.gs.players[0].supportZones[0][0]]);
  t.gs.activePlayer = 0; t.resetActions(0);
  const c = await t.play(0, D, { hero: 1, slot: 0, noGrant: true });
  t.resetActions(0);
  const d = await t.play(0, D, { hero: 1, slot: 0, noGrant: true });
  R.check('Sitz 0 (Alice verloren): 1. Kreatur gelegt', c === true, c);
  R.check('Sitz 0 (kontrolliert Alice nicht mehr): 2. gleichnamige Kreatur darf NICHT auf den belegten Platz', d === false, [d, t.gs.players[0].supportZones[1][0]]);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
