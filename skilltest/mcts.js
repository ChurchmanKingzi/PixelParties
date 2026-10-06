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

/** Kleiner geseedeter Zufallsgenerator (mulberry32) — für gemeinsame Zufallszahlen der Kandidaten (siehe rollout). */
function seeded(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/**
 * Einen Kandidaten probeweise spielen und die Stellung danach bewerten. Rückgabe { value, targeted } — `value` ist `null`, wenn der
 * Rollout nicht auswertbar war; `targeted`: der Kandidat hat unter Gegnern ein Ziel gewählt (dann lohnen Zielvarianten).
 * `seed`: gleiche Zufallszahlen für den k-ten Rollout JEDES Kandidaten (Zielwahl-Rauschen, Würfe der Engine) — die Unterschiede
 * zwischen den Kandidaten sind dann weniger vom Zufall und mehr von der Aktion geprägt (Varianzverringerung).
 * `focus`: Sitz eines Gegners, dessen Ziele die Zielwahl dieser Aktion bevorzugt (Planvariante; null = Standard-Zielwahl).
 */
async function rollout(room, seat, host, cand, cfg, seed, focus) {
  const engine = room.engine, gs = room.gameState, st = gs.skillTest;
  const snap = engine.snapshot();                        // wirft bei Überlast (_mctsOverload) — der Aufrufer fängt es
  const prev = { inSim: engine._inMctsSim, cpu: engine._cpuPlayerIdx, meter: engine._stMeter, counts: engine._stPromptCounts, rx: engine._stRx,
    focus: engine._stFocus, acting: engine._stActing, tp: engine._stTargetPrompts };
  engine._inMctsSim = true;
  gs._stSimulating = true;                               // emitToOpponentsGs & Co. senden nichts
  engine.enterFastMode();
  const realRandom = Math.random;
  if (seed != null && cfg.COMMON_RANDOM) Math.random = seeded(seed);       // nur während des Rollouts (nur Microtasks → kein Fremdcode dazwischen)
  let value = null, targeted = false;
  try {
    const before = { eliminated: st.eliminated.slice(), turns: st.turnsTaken[seat] || 0 };
    engine._stActing = seat; engine._stTargetPrompts = 0;
    engine._stFocus = focus != null ? { by: seat, seat: focus } : null;
    try { await cand.run(); } finally { targeted = engine._stTargetPrompts > 0; engine._stFocus = null; engine._stActing = null; }
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
    Math.random = realRandom;
    try { engine.restore(snap); } finally {
      delete gs._stSimulating;
      engine._inMctsSim = prev.inSim;
      engine._cpuPlayerIdx = prev.cpu;
      engine._stMeter = prev.meter;
      engine._stPromptCounts = prev.counts;
      engine._stRx = prev.rx;
      engine._stFocus = prev.focus; engine._stActing = prev.acting; engine._stTargetPrompts = prev.tp;
      engine.exitFastMode();
    }
  }
  return { value, targeted };
}

// ── Suche ──────────────────────────────────────────────────────────

const yieldLoop = () => new Promise(r => setImmediate(r));
let activeSearches = 0;                                  // gleichzeitig laufende Suchen im Prozess (mehrere Räume, viele Bots)

/** Kandidat mit fester Zielvorgabe: die Zielwahl dieser Aktion bevorzugt die Ziele des Gegners `focus`. */
function withFocus(room, seat, cand, focus) {
  return Object.assign({}, cand, {
    focus,
    run: async () => {
      const e = room.engine, prev = e._stFocus;
      e._stFocus = { by: seat, seat: focus };
      try { return await cand.run(); } finally { e._stFocus = prev; }
    },
  });
}

/**
 * Kandidaten neu ordnen. `candidates` kommt sortiert nach Heuristik (bester zuerst); zurück kommt dieselbe Liste, in der die
 * ersten TOP_K nach Simulationsergebnis (plus kleinem Heuristik-Vorsprung) geordnet sind. Aktionen, die unter Gegnern ein Ziel
 * wählen, werden zusätzlich je Gegner mit „Fokus" probiert (wen angreifen?) — das gewählte Ziel steckt dann im zurückgegebenen Kandidaten.
 */
async function rank(room, seat, host, candidates) {
  const cfg = configOf(room);
  // Server mit vielen Räumen: höchstens MAX_PARALLEL Suchen zugleich — jede weitere Entscheidung fällt sofort nach der Heuristik.
  if (cfg.MAX_PARALLEL > 0 && activeSearches >= cfg.MAX_PARALLEL) return candidates;
  activeSearches++;
  try { return await search(room, seat, host, candidates, cfg); }
  finally { activeSearches--; }
}

async function search(room, seat, host, candidates, cfg) {
  const engine = room.engine, gs = room.gameState, st = gs.skillTest;
  const w = policy().weightsOf(room, seat);
  const per = Math.max(1, Math.round(cfg.ROLLOUTS * (w.lookahead == null ? 1 : w.lookahead)));
  const pool = candidates.slice(0, cfg.TOP_K);
  if (pool.length < 2) return candidates;
  const stats = (room.skillTest.mctsStats = room.skillTest.mctsStats || { searches: 0, rollouts: 0, ms: 0, overloads: 0, changed: 0, focused: 0 });
  const t0 = Date.now();
  const arms = pool.map((c, i) => ({ c, i, focus: null, n: 0, sum: 0, sumSq: 0, targeted: false }));
  // Eigene Obergrenze der Schnappschüsse je Entscheidung (die der Engine zählt je Round, und im Modus ist eine Round lang).
  engine._snapshotsThisTurn = 0; engine._mctsKilledThisTurn = false;
  let done = 0;
  const timeUp = () => cfg.MAX_MS > 0 && Date.now() - t0 > cfg.MAX_MS;
  const pull = async (arm) => {
    const r = await rollout(room, seat, host, arm.c, cfg, (arm.n + 1) * 7919 + (st.round || 0) * 104729 + seat, arm.focus);
    if (gs.result || gs.activePlayer !== seat) return false;        // der Zustand hat sich außerhalb der Suche geändert (Aufgabe, Timer)
    if (r.targeted) arm.targeted = true;
    if (r.value != null) { arm.n++; arm.sum += r.value; arm.sumSq += r.value * r.value; done++; }
    if (cfg.MAX_MS > 0) await yieldLoop();                          // zwischen den Rollouts ist alles zurückgesetzt: Event-Loop freigeben
    return true;
  };
  try {
    // 1) Erkundung: ein Rollout je Kandidat
    for (const arm of arms.slice()) { if (arm.i > 0 && timeUp()) break; if (!(await pull(arm))) return candidates; }
    // 2) Zielvarianten für die vordersten Kandidaten, die unter Gegnern ein Ziel gewählt haben: je lebendem Gegner ein Fokus-Arm
    const others = gs.players.map((_, i) => i).filter(i => i !== seat && !st.eliminated.includes(i));
    if (others.length > 1 && cfg.FOCUS_SEATS > 0) {
      const strength = (i) => policy().sideValue(engine, i);
      const seats = others.sort((a, b) => strength(b) - strength(a)).slice(0, cfg.FOCUS_SEATS);
      for (const base of arms.slice(0, cfg.VARIATION_TOP)) {
        if (!base.targeted) continue;
        for (const f of seats) arms.push({ c: base.c, i: base.i, focus: f, n: 0, sum: 0, sumSq: 0, targeted: true });
      }
    }
    // 3) UCB1 über alle Arme (Kandidat × Fokus); Budget: `per` Rollouts je Arm (die Erkundung zählt mit)
    const total = arms.length * per;
    while (done < total && !timeUp()) {
      const rated = arms.filter(a => a.n > 0), N = Math.max(1, rated.reduce((a, b) => a + b.n, 0));
      const mean = rated.reduce((a, b) => a + b.sum, 0) / N;
      const sigma = Math.max(25, Math.sqrt(Math.max(0, rated.reduce((a, b) => a + b.sumSq, 0) / N - mean * mean)));
      let best = null;
      for (const a of arms) {
        const u = a.n ? a.sum / a.n + 0.7 * sigma * Math.sqrt(Math.log(N + 1) / a.n) : Infinity;
        if (!best || u > best.u) best = { a, u };
      }
      if (!(await pull(best.a))) return candidates;
    }
  } catch (e) {
    if (e && e._mctsOverload) { stats.overloads++; st._mctsOffRound = st.round; console.warn('[skilltest] Lookahead abgebrochen (Überlast), Heuristik gilt in dieser Round'); return candidates; }
    throw e;
  }
  stats.searches++; stats.rollouts += done; stats.ms += Date.now() - t0;
  const rated = arms.filter(a => a.n > 0);
  if (rated.length < 2) return candidates;
  // Wertung je Arm: Mittelwert + Heuristik-Vorsprung (in Einheiten der Streuung: der bestplatzierte Kandidat bekommt PRIOR_WEIGHT · σ,
  // linear abfallend); Fokus-Arme müssen die Standard-Zielwahl deutlich schlagen (FOCUS_PENALTY · σ).
  const all = rated.reduce((a, b) => a + b.n, 0);
  const mean = rated.reduce((a, b) => a + b.sum, 0) / all;
  const sigma = Math.max(25, Math.sqrt(Math.max(0, rated.reduce((a, b) => a + b.sumSq, 0) / all - mean * mean)));
  const score = (a) => a.sum / a.n + cfg.PRIOR_WEIGHT * sigma * (pool.length - a.i) / pool.length - (a.focus != null ? cfg.FOCUS_PENALTY * sigma : 0);
  const bestOf = new Map();
  for (const a of rated) { const cur = bestOf.get(a.c); if (!cur || score(a) > score(cur)) bestOf.set(a.c, a); }
  const ordered = [...bestOf.values()].sort((a, b) => score(b) - score(a)).map(a => (a.focus != null ? withFocus(room, seat, a.c, a.focus) : a.c));
  const unrated = pool.filter(c => !bestOf.has(c));
  const out = [...ordered, ...unrated, ...candidates.slice(pool.length)];
  if (out[0].focus != null) stats.focused++;
  if (out[0] !== candidates[0]) stats.changed++;             // andere Aktion oder dieselbe mit gewähltem Ziel-Fokus (dann ein neues Objekt)
  return out;
}

module.exports = { enabled, rank, rollout, evaluate, relativeValue, configOf };
