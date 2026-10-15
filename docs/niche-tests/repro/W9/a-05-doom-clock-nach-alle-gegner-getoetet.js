'use strict';
// W9a · Q7 (A01-pollution-38) · Al, 15.10.2026: „Generell gewinnt zuerst ‚alle Gegner getötet', ehe man durch Doom Clock verliert.“
// Erwartet: (1) 20. Counter + Archer-Schuss tötet den letzten gegnerischen Helden im selben Ereignis → der Counter-Leger GEWINNT (all_heroes_dead, Sieger Sitz 0),
//   die Doom-Clock-Niederlage wird nicht mehr gewertet (genau ein Spielende-Aufruf). (2) Tötet der Schuss nicht → der Counter-Leger verliert durch die Uhr (Sieger Sitz 1).
//   (3) Ohne Archer: der 20. Counter allein verliert wie bisher.
const H = require('../../lib/h.js');
async function lauf({ archer, letzter }) {
  const t = await H.fresh({});
  const clock = t.putArea(0, 'Doom Clock'); clock.counters.doom = 19;
  if (archer) t.put(0, 0, 0, 'Archer of Teocuilatl');
  t.gs.players[1].heroes.forEach(h => { h.hp = 0; });
  t.gs.players[1].heroes[0].hp = letzter ? 40 : 400;
  const calls = []; const orig = t.engine.onGameOver;
  t.engine.onGameOver = (r, w, reason) => { calls.push({ winner: w, reason }); return orig(r, w, reason); };
  t.targetFn = (v) => [v.find(y => y.type === 'hero' && y.owner === 1 && y.heroIdx === 0).id];
  await t.endTurn();
  return { t, calls, clock };
}
(async () => {
  const R = H.runner();
  let r = await lauf({ archer: true, letzter: true });
  R.check('(1) Der 20. Counter liegt', r.clock.counters.doom === 20, r.clock.counters.doom);
  R.check('(1) Schuss tötet den letzten Helden: genau ein Spielende, Sieger Sitz 0 (all_heroes_dead)', r.calls.length === 1 && r.calls[0].reason === 'all_heroes_dead' && r.calls[0].winner === 0, r.calls);
  R.check('(1) Endergebnis Sieger Sitz 0', r.t.engine.over.winnerIdx === 0 && r.t.engine.over.reason === 'all_heroes_dead', r.t.engine.over);
  R.check('(1) keine Engine-Fehler', r.t.errors.length === 0, r.t.errors);
  r = await lauf({ archer: true, letzter: false });
  R.check('(2) Schuss tötet nicht: Uhr entscheidet, Sieger Sitz 1', r.calls.length === 1 && r.calls[0].reason === 'doom_clock' && r.calls[0].winner === 1, r.calls);
  r = await lauf({ archer: false, letzter: true });
  R.check('(3) ohne Archer: Uhr entscheidet, Sieger Sitz 1', r.calls.length === 1 && r.calls[0].reason === 'doom_clock' && r.calls[0].winner === 1, r.calls);
  R.finish();
})();
