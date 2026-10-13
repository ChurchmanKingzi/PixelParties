'use strict';
// A02-deepsea-36 · Deepsea Primordium: die Zusatzaktion beendet die Action Phase, obwohl die Hauptaktion unverbraucht ist
//
// Kartentext (Primordium): „You may add a "Deepsea" Creature … to your hand to place this Creature into the same Support Zone. When you summon this Creature,
//   you may summon a "Deepsea" Creature from your hand as an additional Action this turn."
// Aufbau: Held 0 (Summoning Magic Lv2) mit Deepsea Bats (eine Runde alt) in Slot 0; Hand: Primordium, Deepsea Werewolf. Action Phase, Hauptaktion frei.
// Schritte: 1. Primordium per Bounce-Place über die Bats (gratis, `inherentAction`) – die Hauptaktion bleibt frei, Phase 3. 2. Werewolf mit der Primordium-Zusatzaktion.
// Erwartung (Quelle: „as an additional Action"; additional = ZUSÄTZLICH zur Hauptaktion, auch CARD_API ~Z. 19700: „sonst beendet jede Zusatzaktion in der Action Phase sie"
//   – Cute Crown setzt dafür `freeInActionPhase`): Die Phase bleibt offen (3), die Hauptaktion (z. B. Fireball) ist weiter spielbar.
// Beobachtet: Nach dem Werewolf steht die Phase auf 4 (Main 2); die Hauptaktion ist verloren, ohne dass sie je gespielt wurde.
// Ursache: `server.js` doPlayCreature (~Z. 10290): `if (isActionPhase && usingAdditional && !additionalIsFree) … advanceToPhase(pi, 4)`; die Primordium-Registrierung
//   (`deepsea-primordium.js` `registerAdditionalActionType`) setzt `freeInActionPhase` nicht.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Deepsea Primordium', 'Deepsea Werewolf', 'Fireball'], []] });
  t.put(0, 0, 0, 'Deepsea Bats').turnPlayed = 1;
  t.setAbilities(0, 0, [['Summoning Magic', 'Summoning Magic'], ['Destruction Magic']]);
  t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1).id];
  let r = await t.play(0, 'Deepsea Primordium', { hero: 0, slot: 0, noGrant: true, keepActions: true });
  R.check('Vorbedingung: Primordium (gratis) gespielt, Phase 3, Hauptaktion frei', r === true && t.gs.currentPhase === 3 && (t.gs.players[0].heroesActedThisTurn || []).length === 0,
    { r, phase: t.gs.currentPhase, acted: t.gs.players[0].heroesActedThisTurn });
  r = await t.play(0, 'Deepsea Werewolf', { hero: 0, slot: 1, keepActions: true });
  R.check('Werewolf per Zusatzaktion gespielt', r === true && t.zone(0, 0, 1) === 'Deepsea Werewolf', { r });
  R.check('die Action Phase bleibt offen (Phase 3), die Hauptaktion ist nicht verloren', t.gs.currentPhase === 3, { phase: t.gs.currentPhase, acted: t.gs.players[0].heroesActedThisTurn });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
