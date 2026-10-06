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
function prepareBase({ env, ps, room, idx, pool, noProfile, weights, record }) {
  const p = policy();
  if (p.prepareBase) return p.prepareBase({ env, ps, room, idx, pool, noProfile, weights, record });
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
function choosePlayer(engine, seat, candidates, promptData) {
  // The Golden Abomination: den Gegner mit dem meisten Gold wählen (nur sein Start-Gold-Tick wird umgelenkt, und nur bei Gold ≠ 0).
  if (promptData && promptData.purpose === 'stealGold') {
    const gold = (i) => (engine.gs.players[i] && engine.gs.players[i].gold) || 0;
    return candidates.slice().sort((a, b) => gold(b) - gold(a))[0];
  }
  const p = policy();
  if (p.choosePlayer) { const r = p.choosePlayer(engine, seat, candidates); if (r != null) return r; }
  return candidates[0];
}

// ── Reaktionen und freiwillige Karteneffekte ───────────────────────
const CONFIRM_YES = { confirmed: true };

/** Ist dieser Confirm eine Reaktions-/Surprise-Frage? */
function isReactionPrompt(promptData) {
  if (promptData.type !== 'confirm' || !promptData.cancellable) return false;
  const title = promptData.showCardLeft || promptData.title;
  if (promptData._handReactionWindow === true) return true;
  if (!title) return false;
  try {
    const s = require('../cards/effects/_loader').loadCardEffect(title);
    return !!(s && (s.isReaction || s.isSurprise || s.isHeroReaction) && (promptData.showCard || promptData.showCardLeft || /activate/i.test(promptData.confirmLabel || '')));
  } catch { return false; }
}

/** Freiwilliger Karteneffekt („you may …"): eine Karte fragt, ob ihr Effekt ausgelöst werden soll. */
function isOptionalEffectPrompt(promptData) {
  return promptData.type === 'confirm' && promptData.cancellable === true && !!promptData.title
    && (!!promptData.showCard || /activate/i.test(promptData.confirmLabel || ''));
}

/** Kostet ein „Ja" eine Ressource (Aktion, Gold, Karte)? Dann lehnt der Bot ohne eigene Karten-Antwort ab. */
function confirmCostsResource(engine, seat, promptData) {
  try {
    const s = require('../cards/effects/_loader').loadCardEffect(promptData.title);
    const c = s && s.cpuMeta && s.cpuMeta.confirmCostsResource;
    return typeof c === 'function' ? c(engine, seat, promptData) === true : c === true;
  } catch { return false; }
}

/** Reaktion für das Lernen vormerken: Stellungswert jetzt; am Ende der laufenden Aktion kommt die Differenz (flushReactions). */
function noteReaction(engine, seat, cardName, fired) {
  const st = engine.gs.skillTest, p = policy();
  if (!st || !st.record || engine._inMctsSim || !p.stateValue) return;
  (engine._stRx || (engine._stRx = [])).push({ seat, key: (fired ? 'react-fire:' : 'react-hold:') + cardName, v0: p.stateValue(engine, seat) });
}
function flushReactions(room) {
  const engine = room && room.engine, list = engine && engine._stRx;
  if (!list || !list.length) return;
  engine._stRx = [];
  const p = policy();
  for (const r of list) record(room, r.seat, r.key, p.stateValue(engine, r.seat) - r.v0);
}

/**
 * Antwort auf Reaktionen und freiwillige Karteneffekte. `r` ist die Engine-Vorgabe (lehnt jede freiwillige Frage ab,
 * außer die Karte hat ein eigenes `cpuResponse`). Die Heuristik der Karte hat das Veto; Persona, gelernter Wert und
 * Neugier (policy.reactionVerdict) entscheiden danach, ob gefeuert wird.
 */
function shapeReaction(engine, seat, promptData, r, ask) {
  const p = policy();
  if (!promptData || !p.reactionVerdict || engine._inMctsSim) return r;
  const fireOrNot = (card) => {
    if (!p.reactionHeuristic(engine, seat, promptData, card)) return false;
    const fire = p.reactionVerdict(engine, seat, card);
    noteReaction(engine, seat, card, fire);
    return fire;
  };
  if (promptData.type === 'cardGallery' && promptData.title === 'Chain a Reaction?') {
    const cards = promptData.cards || [];
    for (const c of cards) {
      if (fireOrNot(c.name)) return { cardName: c.name, source: c.source };
    }
    return null;
  }
  if (promptData.type !== 'confirm') return r;
  if (isReactionPrompt(promptData)) return fireOrNot(promptData.showCardLeft || promptData.title) ? CONFIRM_YES : null;
  if (isOptionalEffectPrompt(promptData)) {
    if (p.saysYes(r)) return r;                                        // eigene Antwort der Karte
    if (r !== null && r !== undefined) return r;
    if (confirmCostsResource(engine, seat, promptData)) return null;
    // Schutz vor Endlos-„darf erneut"-Schleifen derselben Karte innerhalb einer Aktion
    const counts = engine._stPromptCounts || (engine._stPromptCounts = {});
    const key = 'opt:' + seat + ':' + promptData.title;
    if ((counts[key] = (counts[key] || 0) + 1) > 24) return null;
    return CONFIRM_YES;
  }
  return r;
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
      flushReactions(room);
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

module.exports = { prepareBase, chooseTargets, choosePlayer, takeTurn, shapeReaction, flushReactions };
