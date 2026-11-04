// ═══════════════════════════════════════════
//  PIXEL PARTIES — Wertnetz als Blattbewertung der CPU-Suche (Stufe 3)
//
//  Schalter: `PP_VALUE_NET=leaf` (Gewichte aus `data/cpu-value/` oder `PP_VALUE_NET_DIR`). `_cpu.js` ruft `score()` an den Stellen,
//  wo die Suche eine Stellung am Ende eines Rollouts bewertet (`leafScore`): Rollout-Ende, die Gates der Aktivierungen und die
//  Optionswahl. Alle übrigen Aufrufer von `evaluateState` (Handwahl, Kartenskripte) bleiben beim Evaluator.
//
//  `PP_VALUE_NET=greedy` (Stufe 4) tut dasselbe und nimmt zusätzlich den Ort `greedy`: die Eval-Greedy-Auswahl INNERHALB der Rollouts
//  (`rankCandidatesEvalGreedy`, rund 4.500 Bewertungen je Partie) bewertet die Stellung nach jedem Kandidaten mit dem Netz.
//  `PP_VALUE_GREEDY_HEAD=ev` nimmt dafür den Destillationskopf (Evaluator-Wert, Bewertungspunkte) statt des kalibrierten Logits.
//  `PP_VALUE_GREEDY_PROBE=1` ändert nichts am Spiel (die Auswahl bleibt beim Evaluator), rechnet aber an jeder Greedy-Entscheidung beide
//  Netz-Köpfe mit und zählt, wie oft sie denselben Zug wählen würden wie der Evaluator (`engine._greedyProbe`, Zeile `greedyProbe`).
//
//  Rückgabe: Bewertungspunkte (κ × kalibrierter Logit „mein Sitz gewinnt") — die Suche und ihre Schwellen rechnen in denselben Punkten
//  wie beim Evaluator. `null` heißt: das Netz ist hier nicht zuständig, der Aufrufer nimmt den Evaluator. Das gilt
//    · für Partieende (der Evaluator liefert dort die Sieg-/Niederlagenwerte),
//    · für Sitze, die die Sitz-Maske `engine._valueLeafSide` ausschließt (Spiegel-A/B: nur eine Seite pilotiert mit dem Netz),
//    · wenn das Netz nicht geladen werden kann (Meldung einmal, danach immer Evaluator).
//
//  Umgebungsvariablen: `PP_VALUE_KAPPA` überschreibt κ (sonst `kappa.std` aus net.json, sonst 1000), `PP_VALUE_LEAF_SITES`
//  (kommagetrennt aus rollout,gate,pick; Standard alle) beschränkt, wo das Netz bewertet.
//
//  `PP_VALUE_LEAF_HORIZON` (Zahl): Rollout-Horizont (Folgezüge nach dem eigenen Zug) für Suchen, die das Netz bewertet — der Gewinn an
//  Rechenzeit entsteht erst, wenn die Suche weniger Folgezüge simuliert (0 = Blatt direkt nach dem eigenen Zug).
//
//  `PP_VALUE_LEAF_PULLS` (Zahl): Obergrenze der Rollouts je Entscheidung für die Netz-Seite (sonst PP_MCTS_PULLS) — damit lässt sich die
//  gesparte Rechenzeit in mehr Rollouts umsetzen.
//
//  `PP_VALUE_BLEND` (Zahl in (0,1)): Gewicht des Netzes im Blattwert, der Rest kommt vom Evaluator (Messschalter, Standard: nur Netz).
//
//  Je Partie hängt `engine._valueLeaf = { calls, ms: [Sitz0, Sitz1] }` an der Engine (Kosten des Netzes, für die Auswertung).
// ═══════════════════════════════════════════
'use strict';

const enc = require('./_value-encode');
const F = require('./_value-features');
const { ValueNet, DEFAULT_DIR } = require('./_value-net');

let _net = null, _failed = false, _kappa = 1000;
const _feat = new F.Features();
const SITES = new Set((process.env.PP_VALUE_LEAF_SITES || (process.env.PP_VALUE_NET === 'greedy' ? 'rollout,gate,pick,greedy' : 'rollout,gate,pick')).split(',').map(s => s.trim()).filter(Boolean));
const GREEDY_EV = process.env.PP_VALUE_GREEDY_HEAD === 'ev';
const PROBE = process.env.PP_VALUE_GREEDY_PROBE === '1';

function net() {
  if (_net || _failed) return _net;
  try {
    _net = ValueNet.load(process.env.PP_VALUE_NET_DIR || DEFAULT_DIR);
    const env = parseFloat(process.env.PP_VALUE_KAPPA);
    _kappa = Number.isFinite(env) && env > 0 ? env : (_net.kappa ? _net.kappa.std : 1000);
    if (!_net.calib) console.error('[value-net] Hinweis: Gewichte ohne Kalibrierung (calib) — Blattwerte aus dem Roh-Logit');
    console.error(`[value-net] Blattbewertung aktiv: κ = ${_kappa}, Orte: ${[...SITES].join(',')}`);
  } catch (e) {
    _failed = true;
    console.error(`[value-net] Blattbewertung aus (Evaluator bleibt): ${e.message}`);
  }
  return _net;
}

/** Bewertungspunkte für `cpuIdx` oder null (= Evaluator zuständig). Wirft nie. */
function score(engine, cpuIdx, site) {
  try {
    if (!SITES.has(site) || (PROBE && site === 'greedy')) return null;
    const side = engine._valueLeafSide;
    if (side != null && side !== cpuIdx) return null;
    if (!engine.gs || engine.gs.result) return null;
    const n = net();
    if (!n) return null;
    const t0 = process.hrtime.bigint();
    const S = enc.extractState(engine, 0, null, { top: false });
    if (!S) return null;
    _feat.fill(enc.honestView(S, cpuIdx));
    const r = n.predict(_feat);
    const st = engine._valueLeaf || (engine._valueLeaf = { calls: 0, ms: [0, 0] });
    st.calls++;
    st.ms[cpuIdx === 1 ? 1 : 0] += Number(process.hrtime.bigint() - t0) / 1e6;
    return site === 'greedy' && GREEDY_EV ? r.ev : _kappa * r.logitCal;
  } catch { return null; }
}

/** Beobachtung (PP_VALUE_GREEDY_PROBE=1): beide Köpfe für die aktuelle Stellung in Bewertungspunkten, oder null. Wirft nie. */
function probeScores(engine, cpuIdx) {
  try {
    const side = engine._valueLeafSide;
    if (side != null && side !== cpuIdx) return null;
    if (!engine.gs || engine.gs.result) return null;
    const n = net();
    if (!n) return null;
    const S = enc.extractState(engine, 0, null, { top: false });
    if (!S) return null;
    _feat.fill(enc.honestView(S, cpuIdx));
    const r = n.predict(_feat);
    return { logit: _kappa * r.logitCal, ev: r.ev };
  } catch { return null; }
}

/**
 * `rows` = je Kandidat { ev: Evaluator, logit: Netz-Logit, head: Netz-Evaluator-Kopf } (alles in Punkten, inkl. Aktions-Bonus), nur
 * Kandidaten mit endlichen Werten. Zählt je Entscheidung, ob das Netz denselben Kandidaten wie der Evaluator vorn hat.
 */
function probeDone(engine, rows) {
  if (rows.length < 2) return;
  const P = engine._greedyProbe || (engine._greedyProbe = {
    n: 0, cands: 0, clear: 0,
    top1: { logit: 0, head: 0, rand: 0 }, near: { logit: 0, head: 0 }, regret: { logit: 0, head: 0, rand: 0 },
    clearTop1: { logit: 0, head: 0 }, clearNear: { logit: 0, head: 0 }, clearRegret: { logit: 0, head: 0, rand: 0 },
  });
  const k = rows.length;
  let best = -Infinity, second = -Infinity, bi = -1, mean = 0;
  rows.forEach((r, i) => { mean += r.ev / k; if (r.ev > best) { second = best; best = r.ev; bi = i; } else if (r.ev > second) second = r.ev; });
  const eps = Math.max(5, Math.abs(best) * 0.015);          // dieselbe Toleranz wie in der Sortierung von rankCandidatesEvalGreedy
  const clear = best - second > eps;
  P.n++; P.cands += k; P.top1.rand += 1 / k; P.regret.rand += best - mean;
  if (clear) { P.clear++; P.clearRegret.rand += best - mean; }
  for (const key of ['logit', 'head']) {
    let pi = 0;
    rows.forEach((r, i) => { if (r[key] > rows[pi][key]) pi = i; });
    const reg = best - rows[pi].ev;
    if (pi === bi) P.top1[key]++;
    if (reg <= eps) P.near[key]++;
    P.regret[key] += reg;
    if (clear) { if (pi === bi) P.clearTop1[key]++; if (reg <= eps) P.clearNear[key]++; P.clearRegret[key] += reg; }
  }
}

const HORIZON = process.env.PP_VALUE_LEAF_HORIZON != null && process.env.PP_VALUE_LEAF_HORIZON !== '' ? parseInt(process.env.PP_VALUE_LEAF_HORIZON, 10) : null;
/** Horizont für einen Rollout, dessen Wurzel der Sitz `rootIdx` ist (sonst der allgemeine Wert `dflt`). */
function horizonFor(engine, rootIdx, dflt) {
  if (HORIZON === null || !Number.isInteger(HORIZON) || HORIZON < 0 || !SITES.has('rollout')) return dflt;
  const side = engine._valueLeafSide;
  return side != null && side !== rootIdx ? dflt : HORIZON;
}

const PULLS = process.env.PP_VALUE_LEAF_PULLS ? parseInt(process.env.PP_VALUE_LEAF_PULLS, 10) : null;
/** Obergrenze der Rollouts je Entscheidung für den Sitz `rootIdx` (sonst `dflt`). */
function pullsFor(engine, rootIdx, dflt) {
  if (PULLS === null || !Number.isInteger(PULLS) || PULLS < 1) return dflt;
  const side = engine._valueLeafSide;
  return side != null && side !== rootIdx ? dflt : PULLS;
}

// `PP_VALUE_BLEND` (Zahl zwischen 0 und 1, Messschalter): Gewicht des Netzes im Blattwert, der Rest kommt vom Evaluator
// (blend * Netz + (1 - blend) * Evaluator). Ohne den Schalter (oder bei 0 und 1) bewertet das Netz allein.
const _bl = parseFloat(process.env.PP_VALUE_BLEND);
const BLEND = Number.isFinite(_bl) && _bl > 0 && _bl < 1 ? _bl : 1;

module.exports = { score, horizonFor, pullsFor, probeScores, probeDone, PROBE, BLEND };
