'use strict';
// Lookahead der Bots (skilltest/mcts.js), headless:
//  • Die Suche lässt den echten Spielzustand EXAKT unverändert (Spielzustand, Kartenobjekte, Lernprotokoll).
//  • Simulierte Partien enden nur im Spielzustand (genau ein „Ende" je Partie, kein SC, keine Sendungen).
//  • Zeitbudget, Persona-Schalter (lookahead 0), Überlast-Rückfall.
//  • Mit Lookahead enden Partien aller Tischgrößen ohne Fehler und Hänger.
process.env.PP_ST_SIM = '1';
const mcts = require('../../skilltest/mcts');
const { runGame } = require('../../skilltest/sim');
let fails = 0;
const check = (name, cond, info) => { if (cond) console.log('  ✓', name); else { fails++; console.log('  ✗', name, info !== undefined ? '→ ' + JSON.stringify(info).slice(0, 300) : ''); } };

/** Stabile Zustandsprobe: Spielzustand + Kartenobjekte + Zähler, die ein Rollout NICHT verändern darf. */
function probe(room) {
  const gs = room.gameState, engine = room.engine;
  const inst = engine.cardInstances.map(c => [c.id, c.name, c.zone, c.owner, c.heroIdx, c.zoneSlot, c.counters]);
  return JSON.stringify({ gs, inst, eventId: engine.eventId, learn: (gs.skillTest.learnLog || []).length, fast: engine._fastMode, sim: !!engine._inMctsSim, stSim: gs._stSimulating });
}

(async () => {
  console.log('Zustand bleibt unverändert');
  const origRank = mcts.rank;
  let searches = 0, mismatches = 0, firstDiff = null, changed = 0;
  mcts.rank = async function (room, seat, host, cands) {
    const before = probe(room);
    const out = await origRank.apply(this, arguments);
    const after = probe(room);
    searches++;
    if (before !== after) { mismatches++; if (!firstDiff) { let i = 0; while (before[i] === after[i]) i++; firstDiff = { at: i, before: before.slice(Math.max(0, i - 80), i + 80), after: after.slice(Math.max(0, i - 80), i + 80) }; } }
    if (out[0] !== cands[0]) changed++;
    return out;
  };
  const endLines = [];
  const origLog = console.log;
  console.log = (...a) => { const f = typeof a[0] === 'string' ? a[0] : ''; if (/^\[skilltest\] Raum .*Ende nach/.test(f)) endLines.push(f); else if (!/^\[(skilltest\] Raum|deck-profile|heap-guard|build|DB)/.test(f)) origLog(...a); };
  const errors = [];
  const origErr = console.error;
  console.error = (...a) => { errors.push(a.join(' ').slice(0, 240)); };
  const games = +process.env.ST_GAMES || 12;
  let finished = 0, t0 = Date.now(), rollouts = 0;
  for (let g = 0; g < games; g++) {
    const seats = 2 + (g % 5);                                  // 2 … 6 Sitze
    const r = await runGame({ seats, mcts: true, mctsCfg: { MAX_MS: 0, ROLLOUTS: 2, TOP_K: 4 }, record: true, returnRoom: true });
    if (r.winnerIdx != null && r.reason !== 'sim_turn_limit') finished++;
    rollouts += (r.room.skillTest.mctsStats || {}).rollouts || 0;
  }
  console.error = origErr; console.log = origLog;
  check(`Alle ${games} Partien (2–6 Sitze) enden mit einem Sieger`, finished === games, { finished });
  check(`Suchen liefen (${searches}) und haben Rollouts gespielt (${rollouts})`, searches > 20 && rollouts > 50, { searches, rollouts });
  check('Die Suche ändert den Spielzustand nicht (Spielzustand, Kartenobjekte, Lernprotokoll, Flags)', mismatches === 0, firstDiff || { mismatches });
  check('Genau ein „Ende" je Partie — simulierte Partien beenden nichts', endLines.length === games, endLines.length);
  check('Die Suche ändert manchmal die Reihenfolge (sie ist nicht nur Heuristik)', changed > 0, { changed, searches });
  check('Keine Fehlermeldungen', errors.length === 0, errors.slice(0, 4));
  console.log(`  (${searches} Suchen, ${rollouts} Rollouts, ${Math.round((Date.now() - t0) / 1000)} s, Reihenfolge geändert: ${changed})`);
  mcts.rank = origRank;

  console.log('Schalter, Zeitbudget, Überlast');
  // Persona-Schalter: lookahead 0 → keine Suche
  let used = 0;
  mcts.rank = async function () { used++; return origRank.apply(this, arguments); };
  await runGame({ seats: 3, mcts: true, weights: [{ lookahead: 0 }, { lookahead: 0 }, { lookahead: 0 }] });
  check('Persona lookahead = 0 schaltet die Suche aus', used === 0, used);
  used = 0;
  await runGame({ seats: 3, mcts: [1] });
  check('mcts: [Sitze] beschränkt die Suche auf diese Sitze', used > 0);
  used = 0;
  await runGame({ seats: 3 });
  check('Ohne mcts-Option sucht die Simulation nicht (Training bleibt schnell)', used === 0, used);
  mcts.rank = origRank;
  // Zeitbudget: mit 1 ms stoppt die Suche nach der ersten Runde über alle Kandidaten
  const rt = await runGame({ seats: 3, mcts: true, mctsCfg: { MAX_MS: 1, ROLLOUTS: 6, TOP_K: 5 }, returnRoom: true });
  const stt = rt.room.skillTest.mctsStats;
  check('Zeitbudget begrenzt die Rollouts (je Suche höchstens eine Runde über die Kandidaten + wenige)', stt.rollouts <= stt.searches * 7, stt);
  // Überlast: snapshot wirft _mctsOverload → Rückfall auf die Heuristik, in dieser Round keine Suche mehr
  const { GameEngine } = require('../../cards/effects/_engine');
  const origSnap = GameEngine.prototype.snapshot;
  let thrown = 0;
  GameEngine.prototype.snapshot = function () { if (this.gs && this.gs.skillTest && thrown < 3) { thrown++; const e = new Error('MCTS_OVERLOAD (Test)'); e._mctsOverload = true; throw e; } return origSnap.apply(this, arguments); };
  const w = console.warn; console.warn = () => {};
  const ro = await runGame({ seats: 3, mcts: true, mctsCfg: { MAX_MS: 0 }, returnRoom: true });
  console.warn = w; GameEngine.prototype.snapshot = origSnap;
  check('Überlast: Suche bricht ab, Partie läuft mit der Heuristik weiter und endet', thrown === 3 && ro.winnerIdx != null && (ro.room.skillTest.mctsStats.overloads >= 1), { thrown, o: ro.room.skillTest.mctsStats });
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
