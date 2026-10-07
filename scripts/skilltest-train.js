#!/usr/bin/env node
'use strict';
// Lernlauf der Skill-Test-Bots (Selbstspiel, 2–8 Sitze gemischt) — siehe skilltest/learn/train.js.
//
//   node scripts/skilltest-train.js --games 500                 # 500 Partien, Profil danach speichern
//   node scripts/skilltest-train.js --games 300 --seats 4       # nur 4er-Tische
//   node scripts/skilltest-train.js --games 2000 --workers 3    # 3 Worker-Threads parallel (Standard: Kerne − 1, höchstens 3)
//   node scripts/skilltest-train.js --games 300 --seats 3-6
//   Lange Läufe auf einem Server (Beispiel):
//     node scripts/skilltest-train.js --forever --hours 12 --workers 7 --seats 2-8 --bench-every 2000 --bench-games 80 --mcts-bench-every 6000
//       --forever / --games 0   ohne Partiezahl, bis --hours/--minutes ablaufen oder Strg+C (speichert sauber)
//       --workers N             Worker-Threads (Standard: Kerne − 1);  --worker-mem MB je Worker (Standard 1536)
//       --game-timeout S        Obergrenze je Partie in s (Standard 240; wirksam: ≥ 60 s, ~12 × übliche Dauer);  Hänger → <profil>.hangs.jsonl
//       --save-every N          Speichern alle N Partien (Standard 100);  --checkpoint-minutes M  Sicherungskopien (Standard 60, die letzten 4)
//       --bench-every N         Vergleich trainiert gegen untrainiert alle N Partien (Standard 300);  --mcts-bench-every N  Lookahead-Vergleich (Standard aus)
//       --progress S            Fortschrittszeile alle S s (Standard 60)
//       --max-turns N           Zuggrenze je Partie (Standard 3000; echte Partien enden nach ~100 Zügen, p99 ≈ 240) — Pattpartien kosten sonst unnötig Zeit
//       --milestone-every N     alle N Partien eine Kartenliste schreiben (Prep-Wert, Veränderung zur Vorliste und zur ersten Liste, Partner): <profil>.milestones/
//   node scripts/skilltest-train.js --evaluate 60 --seats 4     # Vergleich: gelernt gegen Standard (--mode full|profile|persona)
//   node scripts/skilltest-train.js --daemon --duty 0.25        # Dauerbetrieb (Hintergrundlernen), 25 % Rechenanteil
//   node scripts/skilltest-train.js --export data/skilltest-profile.json --min-n 4   # kompaktes Profil zum Einchecken
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
  if (arg('export', null)) {
    // Kompaktes Profil schreiben (Standard: das gelernte Profil → data/skilltest-profile.json, ohne seltene Einträge).
    const { exportCompact } = require('../skilltest/learn/train');
    const profileMod = require('../skilltest/learn/profile');
    const out = String(arg('export', 'data/skilltest-profile.json'));
    const compact = exportCompact(profileMod.load(), Number(arg('min-n', 4)));
    require('fs').writeFileSync(out, JSON.stringify(compact), { encoding: 'utf-8' });
    console.log(`[skilltest-train] Profil exportiert: ${out} (${Math.round(JSON.stringify(compact).length / 1024)} KB, ${Object.keys(compact.cardValue).length} Karten, ${Object.keys(compact.pairValue).length} Paare, ${Object.keys(compact.playValue).length} Spielwerte)`);
    process.exit(0);
  }
  const daemon = !!arg('daemon', false);
  if (daemon) { try { os.setPriority(0, 19); } catch { /* egal */ } }
  let stop = false;
  for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => { stop = true; });
  const duty = daemon ? Math.min(1, Math.max(0.02, Number(arg('duty', 0.25)) || 0.25)) : 0;
  const num = (name, def) => { const v = arg(name, null); return v === null || v === true ? def : Number(v); };
  const forever = !!arg('forever', false) || num('games', 100) === 0;
  await train({
    games: daemon || forever ? null : num('games', 100),
    seats: seats || [2, 8],
    dutyCycle: duty,
    // Auf einem Trainingsrechner: alle Kerne bis auf einen (Hauptprozess), sonst `--workers N`. Daemon (Hintergrundlernen im Server): 1.
    workers: daemon ? 1 : num('workers', Math.max(1, os.cpus().length - 1)),
    gameTimeoutMs: num('game-timeout', 240) * 1000,          // Obergrenze je Partie; wirksam ist ein Vielfaches der üblichen Dauer (mind. 60 s)
    workerMemMb: num('worker-mem', 1536),
    maxTurns: num('max-turns', 3000),                         // Obergrenze der Züge je Partie (Patt-Schutz); über dem Wert zählt die Partie nicht
    saveEvery: num('save-every', daemon ? 25 : 100),
    benchEvery: num('bench-every', 300), benchGames: num('bench-games', 40),
    mctsBenchEvery: num('mcts-bench-every', 0), mctsBenchGames: num('mcts-bench-games', 40),
    milestoneEvery: num('milestone-every', 0),               // Kartenliste samt Veränderungen und Partnern je N Partien (<profil>.milestones/)
    progressEverySec: daemon ? 0 : num('progress', 60),
    maxMinutes: num('hours', 0) * 60 || num('minutes', 0),
    checkpointMinutes: num('checkpoint-minutes', daemon ? 0 : 60),
    quiet: !!daemon && !process.env.PP_ST_TRAIN_VERBOSE,
    shouldStop: () => stop,
  });
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
