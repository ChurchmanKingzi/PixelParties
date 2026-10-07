#!/usr/bin/env node
'use strict';
// Großer Vergleich je Persona: EIN Sitz spielt mit Profil + Persona p, alle anderen mit Standard-Gewichten ohne Profil.
// Kontrollgruppen: „profile" (nur Profil, Standard-Gewichte) und „none" (alle Sitze ohne alles → Erwartung 1/Sitze, prüft den Aufbau).
// Gemessen: Siegquote gegen 1/Sitze (z-Wert) und mittlere Platzierungsgüte (+1 Sieg … −1 Letzter) mit Standardfehler.
//
//   PP_ST_PROFILE=data/skilltest-night/profile.json node scripts/skilltest-persona-bench.js --games 80 --workers 4 --seats 3,4,6 --out docs/skilltest-night/persona-bench
const arg = (name, def) => { const i = process.argv.indexOf('--' + name); return i >= 0 ? (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true) : def; };
(async () => {
  process.env.PP_ST_SIM = '1';
  if (!process.env.NODE_ENV) process.env.NODE_ENV = 'production';
  const fs = require('fs');
  const { WorkerPool, placeScore } = require('../skilltest/learn/train');
  const profile = require('../skilltest/learn/profile').load();
  const games = Number(arg('games', 80)), workers = Number(arg('workers', 3));
  const seatList = String(arg('seats', '3,4,6')).split(',').map(Number);
  const out = arg('out', null);
  const personas = (profile.personas || []);
  const variants = [
    { id: 'none', label: 'Kontrolle (alle ohne Profil, Standard)', weights: null, trainedProfile: false, control: true },
    { id: 'profile', label: 'nur Profil (Standard-Gewichte)', weights: null, trainedProfile: true },
    ...personas.map(p => ({ id: p.id, label: p.name + ' (' + p.id + ')', weights: p.weights, trainedProfile: true, persona: p })),
  ];
  const pool = new WorkerPool(workers, 240000);
  const rows = [];
  const t0 = Date.now();
  try {
    for (const v of variants) {
      const per = { id: v.id, label: v.label, seats: {}, games: 0, wins: 0, exp: 0, varsum: 0, scores: [] };
      for (const n of seatList) {
        const jobs = Array.from({ length: games }, (_, i) => ({ seat: i % n }));
        const results = await Promise.all(jobs.map(async (j) => {
          const simOpts = {
            seats: n, maxTurns: 1200, reloadProfile: true,
            weights: Array.from({ length: n }, (_, i) => (i === j.seat && v.weights ? v.weights : null)),
            noProfileSeats: Array.from({ length: n }, (_, i) => i).filter(i => v.control || i !== j.seat || !v.trainedProfile),
          };
          try {
            const rec = await pool.run(simOpts);
            if (!rec || !rec.placements || rec.reason === 'sim_turn_limit' || rec.reason === 'round_limit') return null;
            return { won: rec.winnerIdx === j.seat, score: placeScore(rec.placements[j.seat], n) };
          } catch { return null; }
        }));
        const ok = results.filter(Boolean);
        const wins = ok.filter(r => r.won).length;
        per.seats[n] = { games: ok.length, wins, winRate: ok.length ? wins / ok.length : 0, expected: 1 / n, meanScore: ok.length ? ok.reduce((s, r) => s + r.score, 0) / ok.length : 0 };
        per.games += ok.length; per.wins += wins; per.exp += ok.length / n; per.varsum += ok.length * (1 / n) * (1 - 1 / n);
        for (const r of ok) per.scores.push(r.score);
      }
      const m = per.scores.reduce((a, b) => a + b, 0) / Math.max(1, per.scores.length);
      const sd = Math.sqrt(per.scores.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, per.scores.length - 1));
      per.meanScore = m; per.se = sd / Math.sqrt(Math.max(1, per.scores.length));
      per.z = per.varsum > 0 ? (per.wins - per.exp) / Math.sqrt(per.varsum) : 0;
      per.winRate = per.wins / Math.max(1, per.games); per.expWinRate = per.exp / Math.max(1, per.games);
      delete per.scores;
      rows.push(per);
      console.error(`[persona-bench] ${v.id.padEnd(14)} ${per.games} Partien  Sieg ${(per.winRate * 100).toFixed(1)} % (Erwartung ${(per.expWinRate * 100).toFixed(1)} %, z ${per.z.toFixed(2)})  Platzierung ${per.meanScore.toFixed(3)} ± ${per.se.toFixed(3)}   [${Math.round((Date.now() - t0) / 60000)} min]`);
    }
  } finally { pool.close(); }
  const md = ['# Skill Test — Vergleich je Persona', '',
    `Profil: ${profile.games} Partien, Version ${profile.version}. Je Zeile ${games} Partien pro Sitzzahl (${seatList.join(', ')}); ein Sitz mit Profil + Persona gegen Standard-Bots ohne Profil. Platzierung: +1 Sieg … −1 Letzter (0 = Mitte), ± Standardfehler.`, '',
    '| Variante | Partien | Siegquote | Erwartung | z | Platzierung ± SE | ' + seatList.map(n => n + ' Sitze (Sieg / Platz.)').join(' | ') + ' |',
    '|---|---:|---:|---:|---:|---:|' + seatList.map(() => '---:|').join('')]
    .concat(rows.sort((a, b) => b.meanScore - a.meanScore).map(r => `| ${r.label} | ${r.games} | ${(r.winRate * 100).toFixed(1)} % | ${(r.expWinRate * 100).toFixed(1)} % | ${r.z.toFixed(2)} | ${r.meanScore >= 0 ? '+' : ''}${r.meanScore.toFixed(3)} ± ${r.se.toFixed(3)} | ` + seatList.map(n => r.seats[n] ? `${(r.seats[n].winRate * 100).toFixed(0)} % / ${r.seats[n].meanScore >= 0 ? '+' : ''}${r.seats[n].meanScore.toFixed(2)}` : '–').join(' | ') + ' |'));
  if (out && out !== true) { fs.writeFileSync(out + '.json', JSON.stringify({ profileGames: profile.games, games, seatList, rows }, null, 1), { encoding: 'utf-8' }); fs.writeFileSync(out + '.md', md.join('\n') + '\n', { encoding: 'utf-8' }); }
  console.log(md.join('\n'));
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
