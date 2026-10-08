#!/usr/bin/env node
'use strict';
// Zeigt, was die Skill-Test-Bots gelernt haben: Vergleichsspiele (trainiert gegen untrainiert) und die nach Wert
// sortierte Kartenliste samt „Behalten statt Recyceln" (mit Kontext aus Hand und Brett). Liest die Dateien des Trainers
// (siehe skilltest/learn/ranking.js), läuft jederzeit.
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

const benchAll = ranking.readBench({ max: 400 });
const bench = benchAll.filter(r => !r.kind);
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

const lookahead = benchAll.filter(r => r.kind === 'mcts');
if (lookahead.length) {
  console.log('\n═══ Lookahead (Suche) gegen denselben Agenten ohne Suche ═══');
  console.log('Partien  Spiele  Siegquote  Erwartung  Vorsprung    z   Platzierungsgüte');
  for (const r of lookahead) {
    const t = r.total;
    console.log(`${String(r.trainedGames).padStart(7)}  ${String(t.games).padStart(6)}  ${pct(t.winRate).padStart(9)}  ${pct(t.expectedWinRate).padStart(9)}  ${(sgn(t.edge * 100, 1) + ' pp').padStart(10)}  ${sgn(t.z, 1).padStart(5)}  ${sgn(t.meanPlaceScore).padStart(16)}`);
  }
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

// Behalten statt Recyceln: gelernt mit der restlichen Hand und dem Brett als Kontext (skilltest/learn/keepmodel.js)
if (data.keepContext && data.keepContext.length) {
  console.log('\n═══ Behalten statt Recyceln (Vorteil in Platzierungsgüte; Kontext = restliche Hand + Brett) ═══');
  console.log('— Kontext-Effekte über Karten hinweg (fit = Lücke zur Stufenanforderung, fitH = Lücke nach Abilities auf der Hand, syn = Archetyp-Synergie, rc = Recycler-Stand) —');
  data.keepContext.slice(0, 20).forEach(c => console.log(`  ${sgn(c.edge).padStart(7)}  n=${String(c.n).padStart(6)}  ${c.feature}`));
  if (data.keepPairs.length) {
    console.log('— Stärkste Paar-Effekte (Karte | Mitspieler auf Hand oder Brett) —');
    data.keepPairs.slice(0, 20).forEach(p => console.log(`  ${sgn(p.edge).padStart(7)}  n=${String(p.n).padStart(5)}  ${p.card}  |  ${p.other}`));
  }
  const kr = data.rows.filter(r => r.keepEdge != null && r.keepN >= 20).sort((a, b) => b.keepEdge - a.keepEdge);
  if (kr.length) {
    console.log('— Karten, die man am ehesten behält / am ehesten recycelt (nur die Karte selbst) —');
    kr.slice(0, 10).forEach(r => console.log(`  ${sgn(r.keepEdge).padStart(7)}  n=${String(r.keepN).padStart(5)}  ${r.name}`));
    if (kr.length > 10) {
      console.log('  …');
      kr.slice(Math.max(10, kr.length - 10)).forEach(r => console.log(`  ${sgn(r.keepEdge).padStart(7)}  n=${String(r.keepN).padStart(5)}  ${r.name}`));
    }
  }
}

// „Wann Mulligans durchführen?" (skilltest/mulligan.js): erkundete Entscheidungen je Kontext-Eimer und Arm
try {
  const prof = require('../skilltest/learn/profile').load();
  const keys = Object.keys(prof.mullX || {});
  if (keys.length) {
    console.log('\n═══ Mulligan-Kanal „Wann Mulligans durchführen?" (Platzierungsgüte nach der Entscheidung; nur erkundete Fälle) ═══');
    console.log('Eimer = Zahl schwacher Handkarten (w0–w3), b = Bonus-Zug, p0/p1/p2 = frühe/mittlere/späte Round; Arme: skip = nichts tun, weak = schwache Karten zurück, more = auch Grenzfälle');
    const buckets = [...new Set(keys.map(k => k.split('|')[0]))].sort();
    for (const b of buckets) {
      const cell = (a) => { const e = prof.mullX[b + '|' + a]; return e && e.n ? `${sgn(e.sum / e.n, 2)} (n=${e.n})` : '–'; };
      console.log(`  ${b.padEnd(8)}  skip ${cell('skip').padEnd(16)} weak ${cell('weak').padEnd(16)} more ${cell('more')}`);
    }
  }
} catch { /* ohne Profil */ }
