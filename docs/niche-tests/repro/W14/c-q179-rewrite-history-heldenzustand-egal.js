'use strict';
// W14c · Q179 (S03-27) Rewrite History: „place" – der Zustand des Helden der Zone ist generell egal (Al 16.10.2026: „Ja. Bei 'place' ist der Zustand des Heroes generell egal!")
// Aufbau je Fall: Held 0 (Magic Arts 3) hat „Lamenting Knight" in Zone 0; der Gegner besiegt sie; danach wird Held 0 besiegt / eingefroren / betäubt / hart negiert;
//   Held 1 (Magic Arts 3) wirkt Rewrite History. Erwartet: die Kreatur steht wieder in Zone 0 von Held 0.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const faelle = {
    besiegt: (t) => { t.gs.players[0].heroes[0].hp = 0; },
    gefroren: (t) => { t.gs.players[0].heroes[0].statuses.frozen = { appliedTurn: 4, duration: 3 }; },
    betaeubt: (t) => { t.gs.players[0].heroes[0].statuses.stunned = { appliedTurn: 4, duration: 3 }; },
    negiert: (t) => { t.gs.players[0].heroes[0].statuses.negated = { appliedTurn: 4, duration: 3 }; },
  };
  for (const [name, setze] of Object.entries(faelle)) {
    const t = await H.fresh({ hand: [['Rewrite History'], []], hp: 800, deckSize: 20 });
    t.setAbilities(0, 0, [['Magic Arts', 'Magic Arts', 'Magic Arts'], [], []]);
    t.setAbilities(0, 1, [['Magic Arts', 'Magic Arts', 'Magic Arts'], [], []]);
    const inst = t.put(0, 0, 0, 'Lamenting Knight');
    await t.engine.actionDealCreatureDamage({ name: 'Fireball', owner: 1, controller: 1 }, inst, 9999, 'destruction_spell', { sourceOwner: 1 });
    setze(t);
    t.script.push({ match: d => d.type === 'cardGallery', answer: (d) => ({ cardName: d.cards[0].name }) });
    const r = await t.play(0, 'Rewrite History', { hero: 1, noGrant: true });
    R.check(`Held 0 ${name}: Kreatur steht wieder in Zone 0`, r === true && (t.gs.players[0].supportZones[0][0] || []).includes('Lamenting Knight'), { r, zone: t.gs.players[0].supportZones[0] });
    R.check(`Held 0 ${name}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }
  R.finish();
})();
