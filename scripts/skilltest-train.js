#!/usr/bin/env node
'use strict';
// Lernlauf der Skill-Test-Bots (Selbstspiel, 2–8 Sitze gemischt) — siehe skilltest/learn/train.js.
//
//   node scripts/skilltest-train.js --games 500                 # 500 Partien, Profil danach speichern
//   node scripts/skilltest-train.js --games 300 --seats 4       # nur 4er-Tische
//   node scripts/skilltest-train.js --games 2000 --workers 3    # 3 Worker-Threads parallel (Standard: Kerne − 1, höchstens 3)
//   node scripts/skilltest-train.js --games 300 --seats 3-6
//   node scripts/skilltest-train.js --evaluate 60 --seats 4     # Vergleich: gelernt gegen Standard (--mode full|profile|persona)
//   node scripts/skilltest-train.js --daemon --duty 0.25        # Dauerbetrieb (Hintergrundlernen), 25 % Rechenanteil
//   PP_ST_PROFILE=/pfad/profil.json …                           # anderes Profil
const os = require('os');

const arg = (name, def) => { const i = process.argv.indexOf('--' + name); return i >= 0 ? (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true) : def; };
const seatsArg = arg('seats', null);
let seats = null;
if (seatsArg && seatsArg !== true) seats = String(seatsArg).includes('-') ? String(seatsArg).split('-').map(Number) : Number(seatsArg);

(async () => {
  process.env.PP_ST_SIM = '1';
  if (!process.env.NODE_ENV) process.env.NODE_ENV = 'production';
  const { train, evaluate } = require('../skilltest/learn/train');
  if (arg('evaluate', null)) {
    const r = await evaluate({ games: Number(arg('evaluate', 50)), seats: typeof seats === 'number' ? seats : 4, mode: arg('mode', 'full'), workers: arg('workers', null) ? Number(arg('workers', 1)) : Math.max(1, Math.min(3, os.cpus().length - 1)) });
    console.log(`[skilltest-train] Vergleich [${r.mode}] (${r.games} Partien): Persona „${r.persona}“ gegen Standard-Bots ohne Profil — mittlere Platzierungsgüte ${r.meanPlaceScore.toFixed(3)} (0 = ausgeglichen), Siegquote ${(r.winRate * 100).toFixed(1)} %`);
    process.exit(0);
  }
  const daemon = !!arg('daemon', false);
  if (daemon) { try { os.setPriority(0, 19); } catch { /* egal */ } }
  let stop = false;
  for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => { stop = true; });
  const duty = daemon ? Math.min(1, Math.max(0.02, Number(arg('duty', 0.25)) || 0.25)) : 0;
  await train({
    games: daemon ? null : Number(arg('games', 100)),
    seats: seats || [2, 8],
    dutyCycle: duty,
    workers: daemon ? 1 : (arg('workers', null) ? Number(arg('workers', 1)) : Math.max(1, Math.min(3, os.cpus().length - 1))),
    quiet: !!daemon && !process.env.PP_ST_TRAIN_VERBOSE,
    shouldStop: () => stop,
  });
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
