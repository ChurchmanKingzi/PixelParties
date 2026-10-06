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
function prepareBase({ env, ps, room, idx }) {
  const p = policy();
  if (p.prepareBase) return p.prepareBase({ env, ps, room, idx });
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

/** Einen Zug spielen. Gibt zurück, ob eine Aktion verbraucht wurde. */
async function takeTurn(room, seat, host, opts = {}) {
  const engine = room.engine, gs = room.gameState, st = gs && gs.skillTest;
  if (!st || gs.result || gs.activePlayer !== seat || st.busy) return false;
  const p = policy();
  const candidates = p.rankActions(room, seat, host, opts) || [];
  const round = st.round, turnsBefore = st.turnsTaken[seat] || 0;
  for (const action of candidates) {
    if (gs.result || gs.activePlayer !== seat) return true;
    try { await action.run(); } catch (e) { console.error('[skilltest bot] Aktion warf:', e && e.message); }
    // Zug verbraucht? (turnsTaken wächst, oder der Sitz ist nicht mehr dran)
    if (gs.result || gs.activePlayer !== seat || (st.turnsTaken[seat] || 0) > turnsBefore || st.round !== round) return true;
  }
  // Nichts hat funktioniert: Round beenden, damit das Spiel nie hängt.
  await rounds.passRound(room, seat, host);
  return false;
}

module.exports = { prepareBase, chooseTargets, takeTurn };
