'use strict';
// ═══════════════════════════════════════════════════════════════════
//  SKILL TEST — BOT (CPU-Sitze)
//
//  Version 1: regelbasiert, mit austauschbarer Policy (`policy.js`) und
//  lernbaren Gewichten (siehe skilltest/learn/). Der Bot spielt über
//  EXAKT dieselben Wege wie ein Mensch (Zugwächter `rounds.act`,
//  do*-Handler des Servers) — „was im normalen Spiel funktioniert,
//  funktioniert auch hier".
// ═══════════════════════════════════════════════════════════════════
const rounds = require('./rounds');
const Rules = require('../public/skilltest-rules.js');
const { autoBuild } = require('./autoprep');

let _policy = null;
function policy() { return _policy || (_policy = require('./policy')); }

/** Basisaufbau in der Vorbereitung. */
function prepareBase({ env, ps, room, idx, pool }) {
  const p = policy();
  if (p.prepareBase) return p.prepareBase({ env, ps, room, idx, pool });
  return autoBuild(env, ps);
}

/** Ziele für Engine-Prompts (Angriffe, Schaden …) wählen. `base` ist die Standardantwort der Engine. */
function chooseTargets(engine, seat, validTargets, config, base) {
  const p = policy();
  if (p.chooseTargets) {
    const r = p.chooseTargets(engine, seat, validTargets, config, base);
    if (r !== undefined) return r;
  }
  return base(validTargets, config, seat);
}

/** Spielerwahl (Flächenschaden, „choose a player"): Policy entscheidet. */
function choosePlayer(engine, seat, candidates) {
  const p = policy();
  if (p.choosePlayer) { const r = p.choosePlayer(engine, seat, candidates); if (r != null) return r; }
  return candidates[0];
}

/** Beobachtung für das Lernen festhalten (nur wenn der Raum aufzeichnet: Simulation/Training). */
function record(room, seat, key, dv) {
  const st = room.gameState.skillTest;
  if (!st.record || !key || !Number.isFinite(dv)) return;
  (st.learnLog || (st.learnLog = [])).push({ seat, round: st.round, key, dv: Math.round(dv * 100) / 100 });
}

/** Einen Zug spielen. Gibt zurück, ob eine Aktion verbraucht wurde. */
async function takeTurn(room, seat, host, opts = {}) {
  const engine = room.engine, gs = room.gameState, st = gs && gs.skillTest;
  if (!st || gs.result || gs.activePlayer !== seat || st.busy) return false;
  const p = policy();
  const measure = !!st.record && !!p.stateValue;

  // A) Freie Spielzüge der Main Phase (Artifacts ausrüsten, Surprises legen): verbrauchen den Zug nicht.
  if (p.freeActions) {
    const tried = new Set();
    for (let guard = 0; guard < 16; guard++) {
      const free = (p.freeActions(room, seat, host) || []).filter(a => !tried.has(a.key));
      if (!free.length) break;
      const a = free[0];
      tried.add(a.key);
      const v0 = measure ? p.stateValue(engine, seat) : 0;
      let ok = false;
      try { ok = await a.run(); } catch (e) { console.error('[skilltest bot] freie Aktion warf:', e && e.message); }
      if (gs.result || gs.activePlayer !== seat) return true;
      if (ok && measure) record(room, seat, a.learnKey, p.stateValue(engine, seat) - v0);
    }
  }

  // B) Verbrauchende Aktionen (Zug gibt weiter), beste zuerst.
  const candidates = p.rankActions(room, seat, host, opts) || [];
  const round = st.round, turnsBefore = st.turnsTaken[seat] || 0;
  for (const action of candidates) {
    if (gs.result || gs.activePlayer !== seat) return true;
    const v0 = measure ? p.stateValue(engine, seat) : 0;
    try { await action.run(); } catch (e) { console.error('[skilltest bot] Aktion warf:', e && e.message); }
    // Zug verbraucht? (turnsTaken wächst, oder der Sitz ist nicht mehr dran)
    const used = gs.result || gs.activePlayer !== seat || (st.turnsTaken[seat] || 0) > turnsBefore || st.round !== round;
    if (used) {
      if (measure && !gs.result) record(room, seat, action.key, p.stateValue(engine, seat) - v0);
      return true;
    }
  }
  // Nichts hat funktioniert: Round beenden, damit das Spiel nie hängt.
  await rounds.passRound(room, seat, host);
  return false;
}

module.exports = { prepareBase, chooseTargets, choosePlayer, takeTurn };
