'use strict';
// M01-11 · Adventurousness (Action-Ability) lässt sich von einem gefrorenen/betäubten/verstrickten Wirtsheld aktivieren
// Kartentext Adventurousness: „You may once per turn use your Action to gain 10/20/30 Gold." – der Wirtsheld nutzt SEINE Aktion.
// Spezifikation Status (Client-Tooltips `app-shared.jsx:7705/7731`): „Frozen/Stunned: Cannot act and has its effects and Abilities negated."
// Engine-Konvention: frozen/stunned/webbed Helden dürfen weder Spells/Attacks spielen (Kontrolle unten) noch FREIE Abilities aktivieren (`doActivateFreeAbility`, server.js ~9535).
// Skript: `adventurousness.js` ist `actionCost: true` → läuft über `doActivateAbility` (server.js ~10332), das den Heldenstatus nicht prüft.
// Erwartet: Aktivierung abgelehnt (false), kein Gold. Beobachtet: true, Gold +10.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const state of ['frozen', 'stunned', 'webbed']) {
    // Kontrolle: ein Held in diesem Zustand darf nicht angreifen
    const c = await H.fresh({ hand: [['Attack'], []], abilities: { 0: { 0: [['Fighting'], [], []] } } });
    c.hero(0, 0).statuses[state] = { appliedTurn: 0 };
    c.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0).id];
    const rCtl = await c.play(0, 'Attack', { hero: 0, noGrant: true });
    // Prüfling: Adventurousness
    const t = await H.fresh({ gold: 50, abilities: { 0: { 0: [['Adventurousness'], [], []] } } });
    t.hero(0, 0).statuses[state] = { appliedTurn: 0 };
    const g0 = t.gs.players[0].gold;
    const r = await t.activateAbility(0, 0, 0, { phase: 3 });
    R.note(`${state}: Kontrolle Attack = ${rCtl}; Adventurousness r=${r}, Gold ${g0} -> ${t.gs.players[0].gold}`);
    R.check(`Wirtsheld ${state}: Adventurousness darf nicht aktivierbar sein (wie Attack/Spell und freie Abilities)`, r !== true && t.gs.players[0].gold === g0, { r, gold: t.gs.players[0].gold });
    R.check(`${state}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }
  R.finish();
})();
