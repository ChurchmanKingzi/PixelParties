#!/usr/bin/env node
// ═══════════════════════════════════════════
//  PIXEL PARTIES — WINRATE-ÜBERSICHT EINES TRAININGSLAUFS
//
//  Liest data/training/<slug>-iter<N>-<stamp>.jsonl (von train-iterative.js
//  geschrieben) und zeigt Siege/Niederlagen/Unentschieden + Winrate mit
//  95-%-Konfidenzintervall pro Iteration, pro Lauf (Stempel) und gesamt.
//
//  Usage:
//    node scripts/iter-winrate.js "<Deckname>"        (oder der Slug)
//    node scripts/iter-winrate.js "<Deckname>" <Stempel>   nur dieser Lauf
//  Beispiel:
//    cd /opt/pixelparties && node scripts/iter-winrate.js "Spellbound Chaos"
//
//  Iteration 1 läuft ohne Profil (Baseline), ab Iteration 2 spielt das
//  jeweils letzte Profil (DAgger) — die Zeilen sind daher nur bedingt
//  direkt vergleichbar. A/B- und Eval-Dateien werden übersprungen.
// ═══════════════════════════════════════════

'use strict';

const fs = require('fs');
const path = require('path');

const [, , deckArg, stampArg] = process.argv;
if (!deckArg) {
  console.error('Usage: node scripts/iter-winrate.js "<Deckname>" [Stempel]');
  process.exit(1);
}
const slug = deckArg.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const dir = path.join(__dirname, '..', 'data', 'training');

const nameRe = new RegExp('^' + slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '-iter(\\d+)-(.+)\\.jsonl$');
const files = [];
for (const f of fs.readdirSync(dir)) {
  const m = nameRe.exec(f);
  if (m === null) continue;
  if (/(^|-)(EVAL|AB)(-|$)/i.test(m[2])) continue;
  if (stampArg && m[2] !== stampArg) continue;
  files.push({ f, iter: parseInt(m[1], 10), stamp: m[2] });
}
if (files.length === 0) {
  console.error(`Keine Dateien für "${slug}" in ${dir} gefunden.`);
  process.exit(1);
}
files.sort((a, b) => a.stamp.localeCompare(b.stamp) || a.iter - b.iter);

const fmt = (W, L, T) => {
  const n = W + L;
  const p = n > 0 ? W / n : 0;
  const ci = n > 0 ? 1.96 * Math.sqrt(p * (1 - p) / n) : 0;
  return `${String(W).padStart(5)}W ${String(L).padStart(5)}L ${String(T).padStart(3)}T  `
    + `${(100 * p).toFixed(1).padStart(5)}% ±${(100 * ci).toFixed(1)}`;
};

const total = { W: 0, L: 0, T: 0 };
const byStamp = new Map();
let curStamp = null;
const flush = () => {
  if (curStamp === null) return;
  const s = byStamp.get(curStamp);
  console.log(`  ${'Lauf gesamt'.padEnd(12)} ${fmt(s.W, s.L, s.T)}\n`);
};

for (const { f, iter, stamp } of files) {
  if (stamp !== curStamp) {
    flush();
    curStamp = stamp;
    byStamp.set(stamp, { W: 0, L: 0, T: 0 });
    console.log(`Lauf ${stamp} (UTC)`);
  }
  let W = 0, L = 0, T = 0, bad = 0;
  for (const line of fs.readFileSync(path.join(dir, f), 'utf-8').split('\n')) {
    if (line.trim() === '') continue;
    let g;
    try { g = JSON.parse(line); } catch { bad++; continue; }
    if (g.outcome === 1) W++;
    else if (g.outcome === 0) L++;
    else T++;
  }
  const s = byStamp.get(stamp);
  s.W += W; s.L += L; s.T += T;
  total.W += W; total.L += L; total.T += T;
  console.log(`  ${('Iteration ' + iter).padEnd(12)} ${fmt(W, L, T)}${bad ? `  (${bad} defekte Zeilen)` : ''}`);
}
flush();
if (byStamp.size > 1) console.log(`${'ALLE LÄUFE'.padEnd(14)} ${fmt(total.W, total.L, total.T)}`);
