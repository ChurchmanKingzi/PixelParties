'use strict';
// A07-28 · Mao: die Negation „bis zum Beginn deines nächsten Zuges" endet nie
//
// Kartentext Mao: „… Negate that Creature's effects until the beginning of your next turn afterwards."
// Erwartung: nach dem Gegnerzug (6) bleibt die Bestie negiert; zu Beginn des eigenen nächsten Zuges (7) ist die Negation weg.
// Beobachtet (mao-the-vengeful-guardian.js ~169): Buff `mao_negated` mit expiresAtTurn = gs.turn + 1 und expiresForPlayer = pi.
//   `gs.turn` zählt pro Spielerwechsel, Zug T+1 gehört dem GEGNER. `_ablaufFaellig` (_engine.js:17957) verlangt
//   expiresForPlayer === activePlayer UND expiresAtTurn === currentTurn – diese Kombination tritt nie ein
//   (Vullary rechnet richtig: `activePlayer === pi ? turn + 2 : turn + 1`). Die Bestie bleibt für den Rest der Partie negiert.
const H = require('../../lib/h.js');
const F = H.INERT.filler;

(async () => {
  const R = H.runner();
  const GB = ['Guardian Beast Gou', 'Guardian Beast Hou', 'Guardian Beast Hu'];
  const t = await H.fresh({ heroes: [['Mao, the Vengeful Guardian', H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null],
    discard: [[...GB, ...Array(5).fill(F)], Array(8).fill(F)] });
  const ma = t.put(0, 0, 0, 'Guardian Beast Ma');   // frisch beschworen (turnPlayed = aktueller Zug)
  t.gs.activePlayer = 0; t.phase(2);
  t.script.push({ match: d => d && d.type === 'cardGalleryMulti', once: true, answer: (d) => { const idx = [0, 1, 2, 3, 4]; return { selectedIndices: idx, selectedCards: idx.map(i => d.cards[i].name) }; } });
  t.targetFn = (v) => [v.find(x => x.cardName === 'Guardian Beast Ma').id];
  const r = await t.activateHero(0, 0, {});
  R.check('Mao hat gefeuert und Ma negiert', r === true && !!ma.counters.negated, { r, negated: ma.counters.negated });
  await t.endTurn();   // Zug 6 (Gegner)
  R.check('im Gegnerzug (6) noch negiert', !!ma.counters.negated, ma.counters.negated);
  await t.endTurn();   // Zug 7 (eigener nächster Zug)
  R.check('zu Beginn des eigenen nächsten Zuges (7) ist die Negation weg', !ma.counters.negated, { turn: t.gs.turn, negated: ma.counters.negated, buffs: ma.counters.buffs });
  await t.endTurn(); await t.endTurn();
  R.check('auch zwei Runden später nicht mehr negiert', !ma.counters.negated, { turn: t.gs.turn, negated: ma.counters.negated });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
