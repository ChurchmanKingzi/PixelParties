'use strict';
// ═══════════════════════════════════════════
//  PIXEL PARTIES — Standard für PP_TRAIN_JOBS (parallele Sammlung)
//
//  server.js im PP_TRAIN-Modus verteilt die Spiele einer Sammelrunde auf PP_TRAIN_JOBS Worker-Prozesse (siehe
//  collectTrainingSharded). Ohne die Variable läuft ein Prozess. Die Sammel-Skripte (train-iterative, train-all-decks) setzen sie
//  deshalb selbst: ausdrücklich gesetzte PP_TRAIN_JOBS gewinnt (1 = aus), sonst
//    · Kerne:   höchstens Kernzahl − 1 und höchstens 75 % davon — der Rest bleibt dem Rechner (und dem Spielserver),
//    · Speicher: ein Worker braucht typisch 0,3–1,5 GB (Heap-Limit 4 GB) → höchstens totalmem / 2,5 GB,
//    · nie mehr als 8.
//  Warum nicht „alle Kerne": Die Suche ist wanduhrgesteuert (MCTS-Budget je Zug, Rollout-Limits). Läuft ein Worker auf einem
//  überbuchten Kern, schafft er weniger Rollouts und pilotiert schwächer — das verfälscht die Trainingsdaten.
// ═══════════════════════════════════════════
const os = require('os');

function autoJobs() {
  const env = parseInt(process.env.PP_TRAIN_JOBS || '', 10);
  if (Number.isFinite(env) && env >= 1) return env;
  const cpus = os.cpus().length;
  const byCpu = Math.min(cpus - 1, Math.floor(cpus * 0.75));
  const byMem = Math.floor(os.totalmem() / (2.5 * 1024 ** 3));
  return Math.max(1, Math.min(8, byCpu, byMem));
}

module.exports = { autoJobs };
