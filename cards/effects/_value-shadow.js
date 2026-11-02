// ═══════════════════════════════════════════
//  PIXEL PARTIES — Wertnetz im Schattenmodus (Stufe 2)
//
//  Schalter: `PP_VALUE_NET=shadow` (Gewichte aus `data/cpu-value/`, oder aus `PP_VALUE_NET_DIR`). Bei JEDEM `evaluateState` rechnet das
//  Netz die Stellung mit und legt Paare (Evaluator, Netz) ab — die Entscheidungen der CPU ändern sich nicht. Ohne Gewichte schaltet
//  sich der Modus mit einer Meldung ab.
//
//  Wozu: (1) die echten Kosten von Kodieren + Rechnen im Spiel, (2) wie das Netz auf den Stellungen REAGIERT, die die Suche besucht
//  (Rollouts, Kandidatenprüfung) — das sind andere als die protokollierten echten Entscheidungsstellungen, auf denen es trainiert
//  wurde —, (3) die Umrechnung Netz → Bewertungspunkte (κ) für Stufe 3.
//
//  Je Partie hängt `engine._valueShadow` an der Engine; der Recorder schreibt es als `valueShadow` in die Trainingszeile:
//    sim / real   — Zähler und Summen getrennt für Stellungen innerhalb der Suche (`_inMctsSim`) und echte
//    pairs        — bis zu MAX_PAIRS Stichproben [Evaluator, Logit, Evaluator-Kopf, Zug, Sitz, in der Suche]
//    ms           — Zeit fürs Kodieren und fürs Netz (Millisekunden, über die ganze Partie)
//  Die Auswertung macht `scripts/value/shadow-report.js` (zusammen mit dem Ausgang der Partie).
// ═══════════════════════════════════════════
'use strict';

const enc = require('./_value-encode');
const F = require('./_value-features');
const { ValueNet, DEFAULT_DIR } = require('./_value-net');

const MAX_PAIRS = 600;
const TERMINAL = 50000;      // Siegbewertung ±100000 würde jede Korrelation sprengen

let _net = null, _failed = false;
const _feat = new F.Features();

function enabled() { return process.env.PP_VALUE_NET === 'shadow'; }

function net() {
  if (_net || _failed) return _net;
  try { _net = ValueNet.load(process.env.PP_VALUE_NET_DIR || DEFAULT_DIR); } catch (e) {
    _failed = true;
    console.error(`[value-net] Schattenmodus aus: ${e.message}`);
  }
  return _net;
}

const newAcc = () => ({ n: 0, sx: 0, sy: 0, sxx: 0, syy: 0, sxy: 0, sh: 0, shh: 0, sxh: 0 });
const addPair = (a, x, y, h) => {
  a.n++; a.sx += x; a.sy += y; a.sxx += x * x; a.syy += y * y; a.sxy += x * y; a.sh += h; a.shh += h * h; a.sxh += x * h;
};

/** Aus `evaluateState` gerufen, nachdem der Evaluator `ev` für `cpuIdx` berechnet hat. Wirft nie, ändert nichts am Spiel. */
function observe(engine, cpuIdx, ev) {
  try {
    if (!Number.isFinite(ev) || Math.abs(ev) >= TERMINAL || !engine.gs || engine.gs.result) return;
    const n = net();
    if (!n) return;
    const t0 = process.hrtime.bigint();
    const S = enc.extractState(engine, 0, null);
    if (!S) return;
    _feat.fill(enc.honestView(S, cpuIdx));
    const t1 = process.hrtime.bigint();
    const r = n.predict(_feat);
    const t2 = process.hrtime.bigint();

    const sh = engine._valueShadow || (engine._valueShadow = { sim: newAcc(), real: newAcc(), pairs: [], seen: 0, msEnc: 0, msNet: 0, calls: 0 });
    const inSim = engine._inMctsSim ? 1 : 0;
    addPair(inSim ? sh.sim : sh.real, ev, r.logit, r.ev);
    sh.calls++;
    sh.msEnc += Number(t1 - t0) / 1e6;
    sh.msNet += Number(t2 - t1) / 1e6;
    // Stichprobe gleichmäßig über die ganze Partie (Reservoir), reproduzierbar ohne Math.random: jede k-te Beobachtung bei wachsendem k
    sh.seen++;
    const rec = [Math.round(ev), +r.logit.toFixed(3), Math.round(r.ev), engine.gs.turn || 0, cpuIdx, inSim];
    if (sh.pairs.length < MAX_PAIRS) sh.pairs.push(rec);
    else {
      const j = (Math.imul(sh.seen, 2654435761) >>> 0) % sh.seen;   // deterministische Streuung (Mischfunktion statt Math.random)
      if (j < MAX_PAIRS) sh.pairs[j] = rec;
    }
  } catch { /* der Schatten darf das Spiel nie stören */ }
}

/** Zusammenfassung für die Trainingszeile (oder null, wenn nichts beobachtet wurde). */
function summary(engine) {
  const sh = engine._valueShadow;
  if (!sh) return null;
  const round = (a) => Object.fromEntries(Object.entries(a).map(([k, v]) => [k, +v.toPrecision(10)]));
  return {
    sim: round(sh.sim), real: round(sh.real), calls: sh.calls, msEnc: +sh.msEnc.toFixed(1), msNet: +sh.msNet.toFixed(1),
    pairs: sh.pairs,
  };
}

module.exports = { enabled, observe, summary, MAX_PAIRS };
