'use strict';
// F01-artifacts-14 · Gigantisaur Skull ist im eigenen Zug proaktiv spielbar (Frage an Al)
// Kartentext: „Choose any Creature on the board and Freeze it for 1 turn. You can only activate this card during your opponent's turn in reaction to an opponent's Creature
//   activating its active effect, and if you do, you must choose that Creature."
// Wörtliche Lesart: Aktivierung NUR im Gegnerzug als Reaktion auf einen aktiven Kreatureneffekt des Gegners.
// Aufbau: Sitz 0 am Zug (Zug 5, Main Phase 1/2) mit Skull auf der Hand, Gegner-Kreatur auf dem Brett; keine Kreaturenaktivierung des Gegners.
// Beobachtet: Skull wird ganz normal aus der Hand gespielt (4 Gold), die Kreatur ist 1 Zug gefroren.
// Skript: `gigantisaur-skull.js` Kopf („Dual-mode (mirrors Juice's proactive/reactive artifact pattern) … PROACTIVE (own turn) — plays like a Normal Artifact"), `proactivePlay: true` (Z. 86).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Gigantisaur Skull'], []], gold: [100, 100] });
  const c = t.put(1, 0, 0, H.INERT.creature);
  t.targetFn = (valid) => [valid.find(v => v.type === 'equip' && v.owner === 1).id];
  const r = await t.play(0, 'Gigantisaur Skull', { hero: 0 });
  R.check('Skull im eigenen Zug ohne gegnerische Kreaturenaktivierung NICHT spielbar (wörtlich)', r === false || !c.counters.frozen, { r, frozen: c.counters.frozen, gold: t.gs.players[0].gold });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
