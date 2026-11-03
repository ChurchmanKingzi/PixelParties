// ═══════════════════════════════════════════
//  PIXEL PARTIES — Wertnetz als Blattbewertung der CPU-Suche (Stufe 3)
//
//  Schalter: `PP_VALUE_NET=leaf` (Gewichte aus `data/cpu-value/` oder `PP_VALUE_NET_DIR`). `_cpu.js` ruft `score()` an den Stellen,
//  wo die Suche eine Stellung am Ende eines Rollouts bewertet (`leafScore`): Rollout-Ende, die Gates der Aktivierungen und die
//  Optionswahl. Alle übrigen Aufrufer von `evaluateState` (Eval-Greedy-Auswahl, Handwahl, Kartenskripte) bleiben beim Evaluator.
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
//  Je Partie hängt `engine._valueLeaf = { calls, ms: [Sitz0, Sitz1] }` an der Engine (Kosten des Netzes, für die Auswertung).
// ═══════════════════════════════════════════
'use strict';

const enc = require('./_value-encode');
const F = require('./_value-features');
const { ValueNet, DEFAULT_DIR } = require('./_value-net');

let _net = null, _failed = false, _kappa = 1000;
const _feat = new F.Features();
const SITES = new Set((process.env.PP_VALUE_LEAF_SITES || 'rollout,gate,pick').split(',').map(s => s.trim()).filter(Boolean));

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
    if (!SITES.has(site)) return null;
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
    return _kappa * r.logitCal;
  } catch { return null; }
}

const HORIZON = process.env.PP_VALUE_LEAF_HORIZON != null && process.env.PP_VALUE_LEAF_HORIZON !== '' ? parseInt(process.env.PP_VALUE_LEAF_HORIZON, 10) : null;
/** Horizont für einen Rollout, dessen Wurzel der Sitz `rootIdx` ist (sonst der allgemeine Wert `dflt`). */
function horizonFor(engine, rootIdx, dflt) {
  if (HORIZON === null || !Number.isInteger(HORIZON) || HORIZON < 0 || !SITES.has('rollout')) return dflt;
  const side = engine._valueLeafSide;
  return side != null && side !== rootIdx ? dflt : HORIZON;
}

module.exports = { score, horizonFor };
