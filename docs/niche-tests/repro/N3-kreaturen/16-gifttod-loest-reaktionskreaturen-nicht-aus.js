'use strict';
// N3-16 · Tod durch Gift, das eine Gegnerkarte gesetzt hat, löst „defeated by an opponent's card or effect"-Reaktionen nicht aus (Stufe C)
// Kartentext (Doomed Town Guard): „Immediately summon this Creature when one or more targets you control are defeated by an opponent's card or effect."
// Kartentext (Explosive Drone): „You may immediately summon this Creature as an additional Action when a target you control is defeated by an opponent's card or effect."
// Stand: Kopfkommentar/CARD_API: „Eigene Opferungen, Rückstoß und Statusschaden OHNE VERURSACHER lösen nicht aus." Der Gift-Status kennt seinen Verursacher (`statusVerursacher`, appliedBy = Gegner),
//   der Tick-Tod meldet aber nur `source: { name: 'Poison' }` ohne Besitzer (_engine.js ~Z. 50539, `actionDealDamage({ name: 'Poison' }, …)`) → die Skripte (`srcOwner == null`) steigen aus.
// Aufbau: Held 0/0 von Sitz 0 (5 HP) wird durch eine Gegnerkarte vergiftet (Verursacher Sitz 1); DTG und Drone auf der Hand von Sitz 0; echte Zugwechsel, bis das Gift tötet.
// Beobachtet: Held stirbt am Gift, kein Angebot. Gegenprobe: derselbe Held, direkt durch einen Gegner-Zauber getötet → beide Karten werden angeboten.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  {
    const t = await H.fresh({ hand: [['Doomed Town Guard', 'Explosive Drone'], []], hp: 100 });
    t.hero(0, 0).hp = 5;
    await t.run(() => t.engine.actionDealDamage({ name: 'Fireball', owner: 1, controller: 1, heroIdx: 0 }, t.hero(0, 0), 500, 'spell'));
    R.check('Gegenprobe: direkt durch einen Gegner-Zauber gefallen → DTG und Drone werden angeboten', t.prompts.filter(p => p.d.type === 'confirm').length >= 2, t.prompts.map(p => p.d.title));
  }
  {
    const t = await H.fresh({ hand: [['Doomed Town Guard', 'Explosive Drone'], []], hp: 100 });
    t.hero(0, 0).hp = 5;
    t.gs.activePlayer = 1;
    await t.engine.addHeroStatus(0, 0, 'poisoned', { duration: 3, appliedBy: 1, appliedByCard: 'Poison Pollen', source: { name: 'Poison Pollen', owner: 1 } });
    R.check('Aufbau: Gift liegt auf Held 0/0, Verursacher = Sitz 1', !!t.hero(0, 0).statuses.poisoned && t.engine.statusVerursacher(t.hero(0, 0), 'poisoned')?.spieler === 1, t.hero(0, 0).statuses);
    t.reset();
    await t.endTurn(); await t.endTurn();
    R.check('Held 0/0 ist am Gift gefallen', t.hero(0, 0).hp <= 0, t.hero(0, 0).hp);
    R.check('der Gifttod (Verursacher: Gegnerkarte) bietet DTG/Drone an', t.prompts.filter(p => p.d.type === 'confirm' && /Doomed Town Guard|Explosive Drone/.test(p.d.title || '')).length >= 2, t.prompts.map(p => p.d.title));
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
