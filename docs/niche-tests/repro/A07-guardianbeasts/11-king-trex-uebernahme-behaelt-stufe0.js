'use strict';
// A07-11 · Gigantisaur King Trex: nach Kontrollwechsel behält der frühere Kontrolleur die „Stufe 0"-Absenkung
//
// Kartentext King Trex: „… While you control this Creature, the levels of all "Gigantisaur" Creatures in your hand are
//   reduced to 0."
// Erwartung: Wechselt die Kontrolle (Dark Gear, Diplomacy, Capture … → `actionTransferCreature`), endet die Absenkung für
//   den früheren Kontrolleur sofort.
// Beobachtet: King Trex stempelt `levelOverrideCards[<alle Gigantisaur-Namen>] = 0` auf jeden Helden seines Kontrolleurs
//   (gigantisaur-king-trex.js `_applyOverrides`, onPlay/onTurnStart) und räumt nur in `onCardLeaveZone` auf – ein
//   Kontrollwechsel ist kein Verlassen der Zone. Der frühere Kontrolleur behält die Stufe-0-Absenkung dauerhaft;
//   der neue Kontrolleur bekommt sie zusätzlich beim nächsten Zugbeginn.
const H = require('../../lib/h.js');

(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Gigantisaur Spinor'], []], deckSize: 10 });
  const cd0 = H.DB['Gigantisaur Spinor'];
  R.check('Basislinie: ohne Trex ist Spinor (Lv3) für Held 1 nicht spielbar', t.engine.heroMeetsLevelReq(0, 1, cd0) === false);
  const trex = t.put(0, 0, 0, 'Gigantisaur King Trex'); trex.turnPlayed = 1;
  await t.engine.runHooks('onPlay', { _onlyCard: trex, playedCard: trex, zone: 'support', cardZone: 'support' });
  const cd = H.DB['Gigantisaur Spinor'];                                    // Lv3, Summoning Magic
  R.check('Vorbedingung: mit Trex ist Spinor (Lv3) für Held 1 spielbar', t.engine.heroMeetsLevelReq(0, 1, cd) === true);

  const r = await t.engine.actionTransferCreature(trex, 1, 0, 0, {});        // dauerhafte Übernahme durch Sitz 1
  R.check('Vorbedingung: Sitz 1 kontrolliert Trex jetzt', r && r.success && trex.controller === 1, { r, controller: trex.controller });
  await t.endTurn(); await t.endTurn();                                      // ein voller Zugwechsel-Zyklus
  R.check('Sitz 0 kontrolliert Trex nicht mehr → Spinor (Lv3) ist für Held 1 wieder NICHT ohne Stufe spielbar',
    t.engine.heroMeetsLevelReq(0, 1, cd) === false, { overrides: Object.keys(t.hero(0, 1).levelOverrideCards || {}).length });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
