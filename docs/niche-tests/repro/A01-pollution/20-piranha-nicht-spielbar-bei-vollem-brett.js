'use strict';
// A01-pollution-20 · Pollution Piranha ist bei komplett belegtem Brett nicht spielbar, obwohl der Token den Platz freimachen würde
// Kartentext: „You must remove a Pollution Token from your side of the board to summon this Creature. Summoning this Creature counts as an additional Action. …“
// Skript-Beschreibung im Zonen-Dialog: „Choose a Pollution Token to consume and summon Pollution Piranha **in its place**.“
// Erwartung: sind alle Support Zonen belegt und mindestens eine davon ein eigener Pollution Token, kann die Piranha beschworen werden: der Token wird entfernt (Kosten),
//   die Piranha landet in der frei gewordenen Zone (Muster: `canBypassFreeZoneRequirement` / Drop auf belegten Slot wie bei den Teocuilatl-Kreaturen).
// Beobachtet: bei 9 belegten Zonen (alle Pollution Tokens) lehnt `doPlayCreature` die Piranha ab (`false`), noch bevor `beforeSummon` den Token entfernen könnte. Dabei ist
//   gerade ein mit Tokens zugelegtes Brett der Normalfall, in dem die Piranha helfen soll. Mit einer einzigen freien Zone funktioniert sie.
// Ursache: cards/effects/pollution-piranha.js – kein `canBypassFreeZoneRequirement` / `canPlaceOnOccupiedSlot`.
// Aufruf: node docs/niche-tests/repro/A01-pollution/20-piranha-nicht-spielbar-bei-vollem-brett.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
const tokens = (t, seat) => t.inst(c => c.name === 'Pollution Token' && c.owner === seat).length;
(async () => {
  const R = H.runner();
  for (const [label, frei] of [['1 freie Zone (Kontrolle)', 1], ['0 freie Zonen, 9 Tokens', 0]]) {
    const t = await H.fresh({ hand: [['Pollution Piranha'], []] });
    for (let hi = 0; hi < 3; hi++) for (let z = 0; z < 3; z++) { if (frei && hi === 0 && z === 0) continue; t.put(0, hi, z, 'Pollution Token', { counters: { placedOnTurn: 1 } }); }
    const r = await t.play(0, 'Pollution Piranha', { hero: 0, slot: 0 });
    R.check(label + ': Piranha beschworen, genau 1 Token entfernt', r === true && !!t.find('Pollution Piranha', 'support') && tokens(t, 0) === (frei ? 7 : 8), { r, hand: t.pile(0, 'hand'), tokens: tokens(t, 0) });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
