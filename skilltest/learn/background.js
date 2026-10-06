'use strict';
// ═══════════════════════════════════════════════════════════════════
//  SKILL TEST — LERNEN IM HINTERGRUND (passives Selbstspiel auf dem Server)
//
//  Mit `PP_ST_TRAIN_BG=1` (oder einem Rechenanteil wie `0.2`) startet der Server
//  beim Hochfahren einen Kindprozess, der unablässig CPU-only-Partien mit 2–8
//  Sitzen spielt (scripts/skilltest-train.js --daemon) und das Profil
//  (data/skilltest-profile.json) fortschreibt. Der Prozess läuft mit niedrigster
//  Priorität und ruht zwischen den Partien, damit der Spielbetrieb nie leidet;
//  der Server liest das Profil alle ~30 s nach (learn/profile.js).
//
//    PP_ST_TRAIN_BG=1        Rechenanteil 25 %
//    PP_ST_TRAIN_BG=0.1      Rechenanteil 10 %
//    PP_ST_TRAIN_VERBOSE=1   Kindprozess protokolliert mit
//    PP_ST_PROFILE=<pfad>    anderes Profil
// ═══════════════════════════════════════════════════════════════════
const path = require('path');
const { fork } = require('child_process');

let child = null, stopping = false, restarts = [];

function dutyFromEnv() {
  const v = parseFloat(process.env.PP_ST_TRAIN_BG);
  if (!Number.isFinite(v) || v <= 0) return 0;
  return v >= 1 ? 0.25 : Math.max(0.02, v);
}

function spawnChild(duty) {
  const script = path.join(__dirname, '..', '..', 'scripts', 'skilltest-train.js');
  child = fork(script, ['--daemon', '--duty', String(duty)], {
    execArgv: ['--max-old-space-size=2048'],
    env: { ...process.env, PP_ST_TRAIN_CHILD: '1' },
    stdio: process.env.PP_ST_TRAIN_VERBOSE ? 'inherit' : ['ignore', 'ignore', 'ignore', 'ipc'],
  });
  child.on('exit', (code, sig) => {
    child = null;
    if (stopping) return;
    // Höchstens 5 Neustarts pro Stunde, danach Ruhe (kaputte Umgebung nicht im Kreis jagen).
    const now = Date.now();
    restarts = restarts.filter(t => now - t < 3600 * 1000);
    if (restarts.length >= 5) { console.warn('[skilltest] Hintergrund-Lernen beendet (zu viele Abstürze).'); return; }
    restarts.push(now);
    console.warn(`[skilltest] Hintergrund-Lernen beendet (${sig || code}) — Neustart in 30 s`);
    setTimeout(() => { if (!stopping) spawnChild(duty); }, 30 * 1000).unref();
  });
}

/** Startet das Hintergrund-Lernen, falls `PP_ST_TRAIN_BG` gesetzt ist. Kehrt sofort zurück. */
function start() {
  const duty = dutyFromEnv();
  if (!duty || child || process.env.PP_ST_TRAIN_CHILD) return false;
  stopping = false;
  spawnChild(duty);
  console.log(`[skilltest] Hintergrund-Lernen läuft (Rechenanteil ${Math.round(duty * 100)} %, PID ${child.pid})`);
  const stop = () => { stopping = true; if (child) { try { child.kill('SIGTERM'); } catch { /* egal */ } } };
  process.once('exit', stop);
  process.once('SIGTERM', () => { stop(); process.exit(0); });
  return true;
}

function stop() { stopping = true; if (child) { try { child.kill('SIGTERM'); } catch { /* egal */ } child = null; } }

module.exports = { start, stop };
