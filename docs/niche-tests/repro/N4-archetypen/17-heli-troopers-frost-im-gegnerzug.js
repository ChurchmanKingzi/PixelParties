'use strict';
// N4-archetypen-17 · Mischief Militia - Heli Troopers: „Freeze it for 1 turn" – stirbt die Kreatur im Zug des Gegners, trifft das Einfrieren dessen Held nur noch für den Rest dieses Zuges (Stufe C – Lesart)
// Kartentext (Heli Troopers): „When this Creature is defeated, you may choose a target on the board and Freeze it for 1 turn."
// Heute: `applyFreezeToTarget(engine, target, 1, pi)` setzt immer Dauer 1; der Frost tickt zum Zugende der Seite des Ziels ab. Tötet der Gegner (Sitz 1) die Troopers in SEINEM Zug und Sitz 0 friert dessen
//   Helden ein, endet der Frost am Ende desselben Zuges – kein einziger ganzer Zug des Gegners wird beeinträchtigt (nur der Rest des laufenden Zuges, falls der Held noch nicht gehandelt hat).
// Lesart A (heute): „for 1 turn" = bis zum Ende des Zuges, in dem das Ziel gerade ist (bzw. bis zum Ende seines nächsten Zuges, wenn es nicht am Zug ist).
// Lesart B: „for 1 turn" = der nächste volle Zug des Ziels wird übersprungen/gesperrt (wie Icy Slime „bis zum Ende deines nächsten Zuges": eigene Ziele 2 Zugenden, fremde 1).
// Erwartung hier nach Lesart B: der Gegnerheld ist zu Beginn von Zug 7 (seinem nächsten vollen Zug) noch eingefroren; ✗ = heutiges Verhalten (Lesart A).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['ZZ Filler'], ['ZZ Filler']], deckSize: 30, active: 1 });   // Zug 5 gehört dem Gegner (Sitz 1)
  const heli = t.put(0, 0, 0, 'Mischief Militia - Heli Troopers'); heli.turnPlayed = 1;
  t.put(1, 0, 0, H.INERT.big);
  t.script.push({ match: d => d.type === 'confirm', answer: () => ({ confirmed: true }) });
  t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
  t.gs.activePlayer = 1;
  await t.run(() => t.engine.actionDealCreatureDamage({ name: 'X', owner: 1, heroIdx: 0 }, heli, 500, 'creature', { sourceOwner: 1 }));
  const verlauf = [`Zug ${t.gs.turn} (Sitz ${t.gs.activePlayer}) nach dem Tod: ${t.hero(1, 0).statuses.frozen ? 'F' : '-'}`];
  R.check('Aufbau: Gegnerheld wurde eingefroren', !!t.hero(1, 0).statuses.frozen, verlauf[0]);
  await t.endTurn(); verlauf.push(`Beginn Zug ${t.gs.turn} (Sitz ${t.gs.activePlayer}): ${t.hero(1, 0).statuses.frozen ? 'F' : '-'}`);
  await t.endTurn(); verlauf.push(`Beginn Zug ${t.gs.turn} (Sitz ${t.gs.activePlayer}): ${t.hero(1, 0).statuses.frozen ? 'F' : '-'}`);
  const z8 = !!t.hero(1, 0).statuses.frozen;
  R.note('Verlauf', verlauf.join(' | '));
  R.check('Gegnerheld ist zu Beginn seines nächsten vollen Zuges (Zug 7, Sitz 1) noch eingefroren (Lesart B)', z8, verlauf);
  R.finish();
})();
