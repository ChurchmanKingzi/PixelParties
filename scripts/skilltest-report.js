#!/usr/bin/env node
'use strict';
// Zeigt, was die Skill-Test-Bots gelernt haben: Vergleichsspiele (trainiert gegen untrainiert) und die nach Wert
// sortierte Kartenliste.  Liest die Dateien des Trainers (siehe skilltest/learn/ranking.js), läuft jederzeit.
//
//   node scripts/skilltest-report.js                 # Verlauf der Vergleichsspiele + Top/Flop 20 Karten
//   node scripts/skilltest-report.js --cards 100     # die ersten 100 Karten der Liste
//   node scripts/skilltest-report.js --type Hero     # nur ein Kartentyp (Hero, Creature, Spell, Artifact, Ability, Attack, Potion)
//   node scripts/skilltest-report.js --all           # komplette Liste
//   node scripts/skilltest-report.js --md out.md     # komplette Liste als Markdown-Datei schreiben
//   PP_ST_PROFILE=/pfad/profil.json …                # anderes Profil
const fs = require('fs');
const ranking = require('../skilltest/learn/ranking');

const arg = (name, def) => { const i = process.argv.indexOf('--' + name); return i >= 0 ? (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true) : def; };
const pct = (x) => (x * 100).toFixed(1) + ' %';
const sgn = (x, d = 3) => (x >= 0 ? '+' : '') + x.toFixed(d);

const bench = ranking.readBench({ max: 200 });
const status = ranking.readStatus();
console.log('═══ Vergleichsspiele: trainierte CPU gegen untrainierte CPUs ═══');
if (status) console.log(`Trainer: PID ${status.pid}, ${status.games} Partien insgesamt (Sitzung: ${status.session}, ~${status.ratePerMin}/min), Lebenszeichen vor ${Math.round((Date.now() - status.t) / 1000)} s`);
if (!bench.length) console.log('(noch keine Vergleichsspiele — sie laufen automatisch alle 300 Trainingspartien)');
else {
  console.log('Partien  Spiele  Siegquote  Erwartung  Vorsprung    z   Platzierungsgüte  Persona');
  for (const r of bench) {
    const t = r.total;
    console.log(`${String(r.trainedGames).padStart(7)}  ${String(t.games).padStart(6)}  ${pct(t.winRate).padStart(9)}  ${pct(t.expectedWinRate).padStart(9)}  ${(sgn(t.edge * 100, 1) + ' pp').padStart(10)}  ${sgn(t.z, 1).padStart(5)}  ${sgn(t.meanPlaceScore).padStart(16)}  ${r.persona || ''}`);
  }
  const last = bench[bench.length - 1];
  console.log('\nLetzter Stand nach Tischgröße:');
  for (const b of last.bySeats) console.log(`  ${b.seats} Sitze: ${b.wins}/${b.games} gewonnen (${pct(b.winRate)}, Erwartung ${pct(b.expectedWinRate)}), Platzierungsgüte ${sgn(b.meanPlaceScore)}`);
  if (last.games) console.log(`  Einzelspiele des letzten Vergleichs: ${last.games.map(g => `${g.seats}P:${g.won ? 'S' : g.place + '.'}`).join(' ')}`);
}

const data = ranking.readRanking();
console.log(`\n═══ Kartenliste nach Wert (${data.rows.length} Karten, ${data.games} Trainingspartien, Stand ${data.updated || '–'}) ═══`);
let rows = data.rows;
const type = arg('type', null);
if (type && type !== true) rows = rows.filter(r => r.type.toLowerCase() === String(type).toLowerCase());
const fmt = (r) => `${String(r.rank).padStart(4)}  ${sgn(r.value).padStart(7)}  n=${String(r.valueN).padStart(5)}  ${(r.baseN ? sgn(r.baseValue) : '     –').padStart(7)}  ${(r.playValue == null ? '     –' : sgn(r.playValue, 2).padStart(6))}  ${r.delta == null ? '      ' : sgn(r.delta).padStart(6)}  ${r.type.padEnd(9)} ${r.name}`;
console.log('Rang  Wert     Austeil. Aufbau  Spiel   Δ      Typ       Karte');
if (arg('md', null) && arg('md', null) !== true) {
  const out = String(arg('md', 'ranking.md'));
  const lines = [`# Skill Test — Karten nach gelerntem Wert`, '', `Stand: ${data.updated}, ${data.games} Trainingspartien. Wert = mittlere Platzierungsgüte (+1 Sieg … −1 Letzter) aller Spiele, in denen die Karte ausgeteilt wurde (Starthand/Recycler), geschrumpft (Prior ${data.prior}).`, '',
    '| Rang | Karte | Typ | Wert | Ausgeteilt (n) | Aufbauwert | Spielwert | Δ |', '| ---: | --- | --- | ---: | ---: | ---: | ---: | ---: |',
    ...data.rows.map(r => `| ${r.rank} | ${r.name} | ${r.type} | ${sgn(r.value)} | ${r.valueN} | ${r.baseN ? sgn(r.baseValue) : '–'} | ${r.playValue == null ? '–' : sgn(r.playValue, 2)} | ${r.delta == null ? '' : sgn(r.delta)} |`)];
  fs.writeFileSync(out, lines.join('\n') + '\n', { encoding: 'utf-8' });
  console.log(`Markdown geschrieben: ${out}`);
} else if (arg('all', false)) rows.forEach(r => console.log(fmt(r)));
else {
  const k = Number(arg('cards', 20)) || 20;
  console.log(`— Die ${k} besten —`); rows.slice(0, k).forEach(r => console.log(fmt(r)));
  console.log(`— Die ${k} schwächsten —`); rows.slice(-k).forEach(r => console.log(fmt(r)));
}
