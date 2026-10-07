#!/usr/bin/env node
'use strict';
// Gepaarter Vergleich zweier Spielweisen auf Sieg (siehe skilltest/learn/tune.js).
//
//   node scripts/skilltest-tune.js --a '{}' --b '{"weights":{"focusLeader":-1}}' --seeds 400 --from 1000 --workers 4
//   node scripts/skilltest-tune.js --a '{}' --b '{"mcts":true}' --seeds 100 --seat-counts 3,4
//     --a / --b      Variante als JSON: { weights?: {…Kampfgewichte}, mcts?: bool, mctsCfg?: {…} }   (Standard: {} = Standard-Policy)
//                    --b darf eine LISTE von Varianten sein ([{…},{…}]): A läuft einmal, jede B-Variante wird gepaart gegen A verglichen.
//     --seeds N      Anzahl Seeds (Partien je Variante);  --from S  erster Seed
//     --seat-counts  Liste, z. B. 3,4,6 (Standard 2–8)
//     --workers N    Worker-Threads;  --out datei.json  Ergebnis speichern
const arg = (name, def) => { const i = process.argv.indexOf('--' + name); return i >= 0 ? (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true) : def; };
(async () => {
  process.env.PP_ST_SIM = '1';
  if (!process.env.NODE_ENV) process.env.NODE_ENV = 'production';
  const { WorkerPool } = require('../skilltest/learn/train');
  const T = require('../skilltest/learn/tune');
  const A = JSON.parse(String(arg('a', '{}'))), B = JSON.parse(String(arg('b', '{}')));
  const n = Number(arg('seeds', 200)), from = Number(arg('from', 1000)), workers = Number(arg('workers', 3));
  const seatCounts = arg('seat-counts', null) ? String(arg('seat-counts')).split(',').map(Number) : null;
  const seeds = Array.from({ length: n }, (_, i) => from + i);
  const opts = seatCounts ? { seatCounts } : {};
  const pool = new WorkerPool(workers, 900000);
  const t0 = Date.now();
  const Bs = Array.isArray(B) ? B : [B];
  let ra; const rbs = [];
  try {
    ra = await T.runVariant(pool, A, seeds, opts);
    console.error(`[tune] A fertig (${Math.round((Date.now() - t0) / 1000)} s)`);
    for (const b of Bs) { rbs.push(await T.runVariant(pool, b, seeds, opts)); console.error(`[tune] B${rbs.length} fertig (${Math.round((Date.now() - t0) / 1000)} s)`); }
  } finally { pool.close(); }
  const pct = (x) => (x * 100).toFixed(1) + ' %';
  const sa = T.summarize(ra);
  console.log(`A: ${sa.games} Partien (ungültig ${sa.voided}, Patt ${sa.stalemates})  Sieg ${pct(sa.winRate)}  Erwartung ${pct(sa.expected)}  z ${sa.z.toFixed(2)}  Platzierung ${sa.meanScore.toFixed(3)}`);
  const outAll = [];
  rbs.forEach((rb, k) => {
    const sb = T.summarize(rb), cmp = T.compare(ra, rb);
    console.log(`B${rbs.length > 1 ? k + 1 : ''}: ${JSON.stringify(Bs[k]).slice(0, 120)}`);
    console.log(`   ${sb.games} Partien (ungültig ${sb.voided}, Patt ${sb.stalemates})  Sieg ${pct(sb.winRate)}  Erwartung ${pct(sb.expected)}  z ${sb.z.toFixed(2)}  Platzierung ${sb.meanScore.toFixed(3)}`);
    console.log(`   gepaart (${cmp.pairs} Paare): B − A = ${(cmp.delta * 100 >= 0 ? '+' : '') + (cmp.delta * 100).toFixed(1)} Prozentpunkte Siegquote  (nur A gewinnt ${cmp.discordant.aOnly}, nur B gewinnt ${cmp.discordant.bOnly}, McNemar-z ${cmp.z.toFixed(2)});  Platzierung ${cmp.scoreDelta >= 0 ? '+' : ''}${cmp.scoreDelta.toFixed(3)} ± ${cmp.scoreSE.toFixed(3)}`);
    const bsA = T.bySeats(ra), bsB = T.bySeats(rb);
    console.log('   nach Sitzen (A → B):  ' + bsA.map((a, i) => `${a.seats}: ${(a.winRate * 100).toFixed(0)}→${bsB[i] ? (bsB[i].winRate * 100).toFixed(0) : '–'} %`).join('  '));
    outAll.push({ B: Bs[k], sb, cmp, rb });
  });
  const out = arg('out', null);
  if (out && out !== true) require('fs').writeFileSync(out, JSON.stringify({ A, seeds: [from, n], sa, ra, results: outAll }), { encoding: 'utf-8' });
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
