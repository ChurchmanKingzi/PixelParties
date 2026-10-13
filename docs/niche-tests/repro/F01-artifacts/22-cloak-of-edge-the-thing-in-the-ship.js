'use strict';
// F01-artifacts-22 · The Thing in the Ship hält die Cloak of Edge („treated as an Ability") nicht auf
// Kartentext Thing: „While this Creature remains on the board, neither player can activate the active effects of their Abilities."
// Kartentext Cloak: „…While this card is equipped to a Hero, it is treated as an Ability with the following effect: "You may once per turn permanently increase this Hero's Attack stat by 20."";
//   Skriptkopf: „Innerhalb der Support-Zone zählt sie als ABILITY, nicht mehr als Artifact … Effekte, die Abilities wählen oder negieren, KÖNNEN sie wählen."
// Aufbau: Sitz 0 trägt die Cloak an Held 0; Sitz 1 hat The Thing in the Ship auf dem Brett (`engine.abilityActivationBlocked()` = true). Sitz 0 aktiviert die Cloak.
// Erwartung: Die Aktivierung ist gesperrt (Gegenprobe: eine echte Ability mit aktivem Effekt, Adventurousness, ist es).
// Beobachtet: Die Cloak lässt sich aktivieren, ATK +20 permanent.
// Ursache: Die Sperre sitzt nur in den Ability-Sammlern (`_engine.js` Z. 40871 ff. `abilityHasActiveEffect(script) && abilityActivationBlocked()`); die Cloak wird über den Equip-Weg
//   (`getActivatableEquips` / `doActivateEquipEffect`, `cloak-of-edge.js` `equipEffect`) aktiviert, der `abilityActivationBlocked` nicht kennt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  {   // Gegenprobe: echte Ability
    const t = await H.fresh({ hand: [[], []], gold: [100, 100] });
    t.setAbilities(0, 0, [['Adventurousness'], [], []]);
    t.put(1, 0, 0, 'The Thing in the Ship');
    const g0 = t.gs.players[0].gold;
    const r = await t.activateAbility(0, 0, 0, { phase: 3 });
    R.check('Gegenprobe: Adventurousness (echte Ability) ist unter The Thing gesperrt', t.gs.players[0].gold === g0, { r, gold: t.gs.players[0].gold - g0, blockiert: t.engine.abilityActivationBlocked() });
  }
  {
    const t = await H.fresh({ hand: [['Cloak of Edge'], []], gold: [100, 100] });
    const basis = t.hero(0, 0).atk;
    await t.play(0, 'Cloak of Edge', { hero: 0 });
    t.put(1, 0, 0, 'The Thing in the Ship');
    const r = await t.activateEquip(0, 0, 0);
    R.check('Cloak (zählt als Ability) ist unter The Thing in the Ship nicht aktivierbar', t.hero(0, 0).atk === basis, { r, atkPlus: t.hero(0, 0).atk - basis, blockiert: t.engine.abilityActivationBlocked() });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
