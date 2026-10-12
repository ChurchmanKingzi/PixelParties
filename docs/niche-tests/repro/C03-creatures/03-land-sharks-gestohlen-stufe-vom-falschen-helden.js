'use strict';
// C03-creatures-03 · Land Sharks (gestohlen): die Zielzahl richtet sich nach dem Helden des DIEBES in derselben Spalte, nicht nach dem Wirtsheld
// Kartentext: „…choose up to 1/2/3 targets on the board, depending on the corresponding Hero's current Summoning Magic level, and deal 100 damage to them."
// Skript-Ruling (land-sharks.js Kopf): „Massgeblich ist der Held, in dessen Zonen die Kreatur sitzt."
// Aufbau: Land Sharks auf Sitz 0 / Held 0 (Slot 0, Slots 1–2 als _ZoneBlocked-Platzhalter). Sitz 0 Held 0 hat Summoning Magic 3; Sitz 1 Held 0 hat KEINE.
//   Sitz 1 stiehlt die Haie und aktiviert sie (charmedOwner = 0).
// Erwartung: Wirtsheld (Sitz 0 / Held 0, SM 3) ⇒ bis zu 3 Ziele.
// Beobachtet: maxTotal = 1 (es zählt der Held 0 des Diebes mit SM 0). Umgekehrt (Wirt SM 0, Dieb SM 3) ⇒ 3 statt 1.
// Ursache: cards/effects/land-sharks.js zielzahl(): `heroAbilityLevel(engine, pi = ctx.cardOwner (Kontrolleur), heroIdx = ctx.cardHeroIdx (Spalte des Wirts), …)`.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const [hostSM, thiefSM, erwartet] of [[3, 0, 3], [0, 3, 1]]) {
    R.section(`Wirtsheld SM ${hostSM}, Dieb-Held (gleiche Spalte) SM ${thiefSM} ⇒ erwartet ${erwartet} Ziele`);
    const t = await H.fresh({});
    t.setAbilities(0, 0, [Array(hostSM).fill('Summoning Magic'), [], []]);
    t.setAbilities(1, 0, [Array(thiefSM).fill('Summoning Magic'), [], []]);
    const g = t.put(0, 0, 0, 'Land Sharks'); g.turnPlayed = 1;
    t.gs.players[0].supportZones[0][1] = ['_ZoneBlocked']; t.gs.players[0].supportZones[0][2] = ['_ZoneBlocked'];
    t.engine.actionStealCreature(1, g);
    t.gs.activePlayer = 1; t.phase(2);
    const r = await t.run(() => t.host.doActivateCreatureEffect(t.room, 1, { heroIdx: 0, zoneSlot: 0, charmedOwner: 0 }));
    const max = t.targets[0] && t.targets[0].config && t.targets[0].config.maxTotal;
    R.check(`Aktivierung behandelt, Wahlfenster geöffnet`, r === true && max != null, [r, max]);
    R.check(`maxTotal = ${erwartet} (Stufe des Wirtsheldes)`, max === erwartet, max);
  }
  R.finish();
})();
