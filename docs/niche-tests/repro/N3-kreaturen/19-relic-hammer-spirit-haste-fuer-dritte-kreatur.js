'use strict';
// N3-19 · Spirit of the Relic Hammer: die Haste geht an die erste Kreatur NACH dem Spirit, nicht an die erste Kreatur des Zuges
// Kartentext: „The first Creature each player summons during each of their turns may use its active effects the turn it is summoned."
// Konvention (Welle 10 / Q47, FIXES-WELLE-10.md, `engine.zaehleBeschwoerung`): „Die erste Kreatur, die du beschwörst" liest den Zugzähler `ps._creaturesSummonedThisTurn` (jede Platzierung und Beschwörung zählt;
//   Xuanwu, Vullary, Stellin, Klaus, Pawn/Rook of Kings …). Der Spirit führt stattdessen einen eigenen Stempel (`ps._relicHammerTurn`, erster Eintritt NACH ihm).
// Aufbau: Sitz 0, Held 0 trägt den Hammer. Reihenfolge im selben Zug (je eine Aktion): Field Cannon A, dann der Spirit, dann Field Cannon B. A ist die erste, der Spirit die zweite, B die DRITTE Kreatur des Zuges.
// Erwartet: B bekommt keine Haste (sie ist nicht die erste Kreatur des Zuges).   Beobachtet: B bekommt `_hasHaste` und könnte sofort aktivieren.
// Ursache: cards/effects/spirit-of-the-relic-hammer.js `onCardEnterZone` (Z. 100): prüft nur `rein.turnPlayed === gs.turn` und den eigenen Stempel, nicht `_creaturesSummonedThisTurn`.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const HAM = 'Earth-Shattering Hammer, Relic of Deri', SP = 'Spirit of the Relic Hammer';
  const t = await H.fresh({ hand: [['Field Cannon', 'Field Cannon', SP], []] });
  t.setAbilities(0, 0, [['Summoning Magic', 'Summoning Magic', 'Summoning Magic'], [], []]);
  t.setAbilities(0, 1, [['Summoning Magic', 'Summoning Magic', 'Summoning Magic'], [], []]);
  t.put(0, 0, 0, HAM);
  const hat = (i) => !!(i && i.counters && i.counters._hasHaste);
  await t.play(0, 'Field Cannon', { hero: 1, slot: 0, noGrant: true });
  const a = t.inst(c => c.name === 'Field Cannon' && c.zone === 'support')[0];
  await t.play(0, SP, { hero: 0, slot: 1, noGrant: true });
  R.check('Aufbau: Spirit liegt auf dem Brett', !!t.find(SP, 'support'));
  await t.play(0, 'Field Cannon', { hero: 1, slot: 1, noGrant: true });
  const b = t.inst(c => c.name === 'Field Cannon' && c.zone === 'support').find(c => c.id !== a.id);
  R.check('Aufbau: A und B liegen auf dem Brett, drei Kreaturen in diesem Zug beschworen', !!a && !!b && t.gs.players[0]._creaturesSummonedThisTurn === 3, t.gs.players[0]._creaturesSummonedThisTurn);
  R.check('Kreatur A (erste des Zuges, vor dem Spirit): keine Haste', !hat(a));
  R.check('Kreatur B (dritte des Zuges): keine Haste („the first Creature … summons")', !hat(b), b && Object.keys(b.counters));
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
