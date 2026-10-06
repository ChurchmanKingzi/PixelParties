'use strict';
// ═══════════════════════════════════════════════════════════════════
//  SKILL TEST — LOOKAHEAD (Monte-Carlo-Suche) DER BOTS
//
//  Die MCTS des Normalspiels (cards/effects/_cpu.js) ist auf zwei Spieler und „einen ganzen Zug" gebaut (Rollout bis zum
//  Zugende, dann Gegner und Ich im Wechsel) und im Modus abgeschaltet. Übertragbar ist der Unterbau der Engine —
//  `snapshot()`/`restore()` (setzt Spielzustand und Kartenobjekte an Ort und Stelle zurück), der Simulationsmodus
//  (`_inMctsSim`, `enterFastMode()`: keine Pausen, keine Sendungen, alle Prompts beantwortet die CPU) und die Sicherungen
//  (Schnappschuss-Deckel, Speicherwächter). Der Rest ist hier für den Skill Test neu gebaut:
//
//    Kandidat  = eine verbrauchende Aktion der Policy (policy.rankActions: Angriff, Effekte, Zauber, Beschwörungen …)
//    Rollout   = Schnappschuss → Kandidat wirklich ausführen (über dieselben Handler und denselben Rundentreiber wie im
//                Spiel) → alle anderen Sitze spielen mit der Standard-Policy, bis der Sitz wieder an der Reihe ist
//                (Reaktionen der Gegner inklusive) → Stellung bewerten → Zustand zurücksetzen
//    Bewertung = eigener Stellungswert minus Gegner (Mittel, zum Teil der Stärkste) plus Ausscheiden/Sieg
//    Auswahl   = UCB1 über die Kandidaten, Ergebnis ist die neu geordnete Kandidatenliste (bester zuerst)
//
//  Der Bot führt danach wie gewohnt die Liste von vorn aus; die Suche ändert nur die Reihenfolge.
//
//  Sicherheit: Während eines Rollouts laufen nur Microtasks (im Fast-Mode lösen alle Pausen sofort auf), es können also
//  keine Socket-Ereignisse dazwischenkommen; zwischen den Rollouts ist der Zustand zurückgesetzt und der Event-Loop frei.
//  Simulierte Partien enden nur im Spielzustand (battle.js onOver), Planung/Timer ruhen (`_stOnTurn`), Lernprotokolle und
//  Clients bekommen nichts mit (`gs._stSimulating`, `_inMctsSim`).
// ═══════════════════════════════════════════════════════════════════
const { CONFIG } = require('./config');

const lazy = (m) => { let x; return () => x || (x = require(m)); };
const policy = lazy('./policy');
const bot = lazy('./bot');

/** Wirksame Einstellungen eines Raums (CONFIG.MCTS + Überschreibungen aus Tests/Simulation: room.skillTest.mctsCfg). */
function configOf(room) {
  return Object.assign({}, CONFIG.MCTS, (room.skillTest && room.skillTest.mctsCfg) || {});
}

/** Darf dieser Sitz jetzt suchen? */
function enabled(room, seat, opts = {}) {
  const engine = room.engine, gs = room.gameState, st = gs && gs.skillTest;
  if (!engine || !st || engine._inMctsSim || opts.forced) return false;
  const forced = room.skillTest && room.skillTest.mcts;          // Simulation/Training: true | [Sitze] | false
  let on;
  if (forced !== undefined) on = forced === true || (Array.isArray(forced) && forced.includes(seat));
  else on = !!CONFIG.MCTS.ENABLED && process.env.PP_ST_MCTS !== '0';
  if (!on) return false;
  if (st._mctsOffRound === st.round) return false;              // in dieser Round hat die Suche eine Überlast gemeldet
  const w = policy().weightsOf(room, seat);
  return (w.lookahead == null ? 1 : w.lookahead) > 0;
}

// ── Bewertung ──────────────────────────────────────────────────────

/** Stellung des Sitzes gegen die lebenden Gegner: der eigene Wert minus (Mittel, zum Teil der Stärkste) der Gegner. */
function relativeValue(engine, seat, cfg) {
  const gs = engine.gs, st = gs.skillTest, p = policy();
  const others = gs.players.map((_, i) => i).filter(i => i !== seat && !st.eliminated.includes(i));
  const own = p.sideValue(engine, seat);
  if (!others.length) return own;
  const vals = others.map(i => p.sideValue(engine, i));
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  return own - ((1 - cfg.LEADER_BLEND) * mean + cfg.LEADER_BLEND * Math.max(...vals));
}

function evaluate(engine, seat, cfg, before) {
  const gs = engine.gs, st = gs.skillTest;
  let v = relativeValue(engine, seat, cfg);
  const newly = st.eliminated.filter(s => !before.eliminated.includes(s));
  v += cfg.ELIM_BONUS * newly.filter(s => s !== seat).length;
  if (st.eliminated.includes(seat)) v -= cfg.LOSS_PENALTY;
  else if (gs.result && gs.result.winnerIdx === seat) v += cfg.WIN_BONUS;
  return v;
}

// ── Ein Rollout ────────────────────────────────────────────────────

/** Einen Kandidaten probeweise spielen und die Stellung danach bewerten. `null`, wenn der Rollout nicht auswertbar war. */
async function rollout(room, seat, host, cand, cfg) {
  const engine = room.engine, gs = room.gameState, st = gs.skillTest;
  const snap = engine.snapshot();                        // wirft bei Überlast (_mctsOverload) — der Aufrufer fängt es
  const prev = { inSim: engine._inMctsSim, cpu: engine._cpuPlayerIdx, meter: engine._stMeter, counts: engine._stPromptCounts, rx: engine._stRx };
  engine._inMctsSim = true;
  gs._stSimulating = true;                               // emitToOpponentsGs & Co. senden nichts
  engine.enterFastMode();
  let value = null;
  try {
    const before = { eliminated: st.eliminated.slice(), turns: st.turnsTaken[seat] || 0 };
    await cand.run();
    const consumed = (st.turnsTaken[seat] || 0) > before.turns || !!gs.result;
    // Die übrigen Sitze spielen (Standard-Policy), bis der Sitz wieder an der Reihe ist.
    const bots = bot();
    let returns = 0, guard = 0;
    while (!gs.result && guard++ < cfg.MAX_SIM_TURNS) {
      if (gs.activePlayer === seat) {
        if (++returns >= cfg.ROUNDS) break;
      }
      const who = gs.activePlayer;
      if (st.eliminated.includes(who)) break;
      await bots.takeTurn(room, who, host, { sim: true });
    }
    value = evaluate(engine, seat, cfg, before) - (consumed ? 0 : cfg.FAIL_PENALTY);
  } catch (e) {
    if (e && e._mctsOverload) throw e;
    value = null;                                        // Hänger/Fehler im Rollout (z. B. Schrittbudget): nicht auswerten
  } finally {
    try { engine.restore(snap); } finally {
      delete gs._stSimulating;
      engine._inMctsSim = prev.inSim;
      engine._cpuPlayerIdx = prev.cpu;
      engine._stMeter = prev.meter;
      engine._stPromptCounts = prev.counts;
      engine._stRx = prev.rx;
      engine.exitFastMode();
    }
  }
  return value;
}

// ── Suche ──────────────────────────────────────────────────────────

const yieldLoop = () => new Promise(r => setImmediate(r));

/**
 * Kandidaten neu ordnen. `candidates` kommt sortiert nach Heuristik (bester zuerst); zurück kommt dieselbe Liste, in der die
 * ersten TOP_K nach Simulationsergebnis (plus kleinem Heuristik-Vorsprung) geordnet sind.
 */
async function rank(room, seat, host, candidates) {
  const engine = room.engine, gs = room.gameState, st = gs.skillTest;
  const cfg = configOf(room);
  const w = policy().weightsOf(room, seat);
  const per = Math.max(1, Math.round(cfg.ROLLOUTS * (w.lookahead == null ? 1 : w.lookahead)));
  const pool = candidates.slice(0, cfg.TOP_K);
  if (pool.length < 2) return candidates;
  const stats = (room.skillTest.mctsStats = room.skillTest.mctsStats || { searches: 0, rollouts: 0, ms: 0, overloads: 0, changed: 0 });
  const t0 = Date.now();
  const arms = pool.map((c, i) => ({ c, i, n: 0, sum: 0, sumSq: 0 }));
  // Eigene Obergrenze der Schnappschüsse je Entscheidung (die der Engine zählt je Round, und im Modus ist eine Round lang).
  engine._snapshotsThisTurn = 0; engine._mctsKilledThisTurn = false;
  const total = pool.length * per;
  let done = 0;
  try {
    for (let k = 0; k < total; k++) {
      if (cfg.MAX_MS > 0 && k >= pool.length && Date.now() - t0 > cfg.MAX_MS) break;
      let arm;
      if (k < pool.length) arm = arms[k];
      else {
        // UCB1: Mittelwert + Erkundungsbonus (Skala: gemeinsame Streuung der bisherigen Ergebnisse)
        const seen = arms.filter(a => a.n > 0);
        const mean = seen.reduce((a, b) => a + b.sum, 0) / Math.max(1, seen.reduce((a, b) => a + b.n, 0));
        const varr = seen.reduce((a, b) => a + b.sumSq, 0) / Math.max(1, seen.reduce((a, b) => a + b.n, 0)) - mean * mean;
        const sigma = Math.max(25, Math.sqrt(Math.max(0, varr)));
        const N = arms.reduce((a, b) => a + b.n, 0) + 1;
        arm = arms.reduce((best, a) => {
          const u = a.n ? a.sum / a.n + 0.7 * sigma * Math.sqrt(Math.log(N) / a.n) : Infinity;
          return !best || u > best.u ? { a, u } : best;
        }, null).a;
      }
      const v = await rollout(room, seat, host, arm.c, cfg);
      if (gs.result || gs.activePlayer !== seat) break;         // der Zustand hat sich außerhalb der Suche geändert (Aufgabe, Timer)
      if (v != null) { arm.n++; arm.sum += v; arm.sumSq += v * v; done++; }
      if (cfg.MAX_MS > 0) await yieldLoop();                    // zwischen den Rollouts ist alles zurückgesetzt: Event-Loop freigeben
    }
  } catch (e) {
    if (e && e._mctsOverload) { stats.overloads++; st._mctsOffRound = st.round; console.warn('[skilltest] Lookahead abgebrochen (Überlast), Heuristik gilt in dieser Round'); return candidates; }
    throw e;
  }
  stats.searches++; stats.rollouts += done; stats.ms += Date.now() - t0;
  const rated = arms.filter(a => a.n > 0);
  if (rated.length < 2) return candidates;
  // Heuristik-Vorsprung in Einheiten der Streuung: der bestplatzierte Kandidat bekommt PRIOR_WEIGHT · σ, linear abfallend.
  const all = rated.reduce((a, b) => a + b.n, 0);
  const mean = rated.reduce((a, b) => a + b.sum, 0) / all;
  const sigma = Math.max(25, Math.sqrt(Math.max(0, rated.reduce((a, b) => a + b.sumSq, 0) / all - mean * mean)));
  const score = (a) => a.sum / a.n + cfg.PRIOR_WEIGHT * sigma * (pool.length - a.i) / pool.length;
  const ordered = rated.slice().sort((a, b) => score(b) - score(a)).map(a => a.c);
  const unrated = arms.filter(a => a.n === 0).map(a => a.c);
  const out = [...ordered, ...unrated, ...candidates.slice(pool.length)];
  if (out[0] !== candidates[0]) stats.changed++;
  return out;
}

module.exports = { enabled, rank, rollout, evaluate, relativeValue, configOf };
