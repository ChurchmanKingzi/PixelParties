'use strict';
// A01-pollution-38 · 20. Doom Counter und tödlicher Archer-Schuss im selben Ereignis: der Schuss entscheidet (der Counter-Leger gewinnt statt zu verlieren) – Regelfrage
// Kartentexte: Doom Clock „The player that places the 20th Doom Counter onto this card loses the game.“ ·
//   Archer of Teocuilatl „Whenever a Doom Counter is placed onto a „Doom Clock“ during your turn, you may choose a target and deal 50 damage to it.“
// Aufbau: Sitz 0: Doom Clock mit 19 Countern, Archer auf dem Brett; Sitz 1: nur noch Held 0 mit 40 HP (die anderen tot). Zugende von Sitz 0 legt den 20. Counter (Zugspieler).
// Erwartet (Lesart „der Verlust durch den 20. Counter tritt sofort ein, Auslöser kommen nicht mehr dazu“): Sitz 0 verliert (doom_clock); der Archer-Schuss ändert daran nichts.
// Beobachtet: `placeCounter` ruft zuerst die Hooks (`onDoomCounterPlaced`) – der Archer erschießt den letzten gegnerischen Helden (`all_heroes_dead`, Sieger Sitz 0), erst danach folgt `doom_clock` (Sieger Sitz 1).
//   Der echte Server (`endGame`, `server.js` ~6295) wertet nur den ERSTEN Aufruf (`if (gs.result) return`) → Sitz 0 gewinnt. (Die Harness hält den LETZTEN Aufruf in `engine.over`, daher hier die Reihenfolge direkt mitgeschnitten.)
// Ursache: cards/effects/_doom-clock-shared.js `placeCounter`: Hooks vor dem Test auf `DOOM_LIMIT`.
// Aufruf: node docs/niche-tests/repro/A01-pollution/38-20-counter-und-archer-schuss-gleichzeitig.js   (✗ = Hook-Reihenfolge wie beschrieben)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({});
  const clock = t.putArea(0, 'Doom Clock'); clock.counters.doom = 19;
  t.put(0, 0, 0, 'Archer of Teocuilatl');
  t.gs.players[1].heroes.forEach(h => { h.hp = 0; }); t.gs.players[1].heroes[0].hp = 40;
  const calls = []; const orig = t.engine.onGameOver;
  t.engine.onGameOver = (r, w, reason) => { calls.push({ winner: w, reason }); return orig(r, w, reason); };
  t.targetFn = (v) => [v.find(y => y.type === 'hero' && y.owner === 1 && y.heroIdx === 0).id];
  await t.endTurn();
  R.check('Der 20. Counter liegt', clock.counters.doom === 20, clock.counters.doom);
  R.check('der erste Spielende-Aufruf ist der Verlust durch die Uhr (Sieger Sitz 1)', calls[0] && calls[0].reason === 'doom_clock', calls);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
