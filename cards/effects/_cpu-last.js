'use strict';
// ═══════════════════════════════════════════════════════════════
//  LASTABHAENGIGES RECHENBUDGET DER CPU
//
//  Die CPU rechnet ihre Zuege im selben Node-Prozess wie alle Sockets.
//  Je mehr Partien gleichzeitig laufen, desto laenger blockiert jede
//  Rechenschleife die anderen (Lasttest: ab ~10 gleichzeitigen CPU-
//  Partien antwortet der Server auf Zuege erst nach 1–5 s). Das
//  Wanduhr-Budget der MCTS-Suche (`MCTS_RANK_BUDGET_MS`) frisst unter
//  Last zudem MEHR Rechenzeit, nicht weniger.
//
//  `budgetFaktor()` misst die Verzoegerung der Ereignisschleife
//  (alle 2 s ein Fenster, geglaettet) und liefert einen Faktor 0,25…1,
//  mit dem die Suche ihr Budget skaliert: bei ruhigem Server 1 (volle
//  Staerke), bei stark belastetem bis auf ein Viertel. Rasch runter,
//  langsam wieder hoch (kein Pendeln). Selbstspiel/Training
//  (`PP_NO_ADAPT=1` oder `engine._isSelfPlay`) bleibt unberuehrt.
// ═══════════════════════════════════════════════════════════════
const { monitorEventLoopDelay } = require('perf_hooks');

const AUS = process.env.PP_NO_ADAPT === '1' || process.env.PP_TRAIN === '1' || !!process.env.PP_MCTS_BUDGET_MS;
const RUHIG_MS = 40;     // p95-Verzoegerung bis hierhin: voller Faktor
const VOLL_MS = 400;     // ab hier: Mindestfaktor
const MIN_FAKTOR = 0.25;
let faktor = 1, hist = null, timer = null, letzteP95 = 0;

function messen() {
  if (!hist) return;
  const p95 = hist.percentile(95) / 1e6;     // ns -> ms
  hist.reset();
  letzteP95 = p95;
  const ziel = p95 <= RUHIG_MS ? 1 : p95 >= VOLL_MS ? MIN_FAKTOR : 1 - (1 - MIN_FAKTOR) * (p95 - RUHIG_MS) / (VOLL_MS - RUHIG_MS);
  // runter sofort (halber Weg), hoch nur langsam
  faktor = ziel < faktor ? faktor + (ziel - faktor) * 0.6 : Math.min(1, faktor + 0.05);
}
function start() {
  if (AUS || timer) return;
  try {
    hist = monitorEventLoopDelay({ resolution: 10 }); hist.enable();
    timer = setInterval(messen, 2000); if (timer.unref) timer.unref();
  } catch { /* ohne Messung bleibt der Faktor 1 */ }
}
start();

/** Faktor 0,25…1 fuer das Suchbudget; 1 im Selbstspiel/Training. */
function budgetFaktor(engine) {
  if (AUS || (engine && engine._isSelfPlay)) return 1;
  return faktor;
}
module.exports = { budgetFaktor, _debug: () => ({ faktor, letzteP95 }) };
