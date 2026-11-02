#!/usr/bin/env node
// Auswertung eines Schattenlaufs (PP_VALUE_NET=shadow, Stufe 2): Kosten, Übereinstimmung mit dem Evaluator, Trefferquote auf den
// Stellungen, die die Suche besucht, und die Umrechnung Netz → Bewertungspunkte (κ).
//
//   PP_VALUE_NET=shadow PP_VALUE_NET_DIR=<Gewichte> PP_TRAIN=1 … node server.js     # normaler Sammellauf, schreibt <out>.jsonl
//   node scripts/value/shadow-report.js <out>.jsonl [weitere.jsonl …]
//
// Gelesen wird je Zeile `valueShadow` (siehe cards/effects/_value-shadow.js) zusammen mit dem Ausgang der Partie (`winnerIdx`).
'use strict';
const fs = require('fs');

const files = process.argv.slice(2);
if (!files.length) { console.error('Aufruf: node scripts/value/shadow-report.js <out>.jsonl …'); process.exit(1); }

const sum = () => ({ n: 0, sx: 0, sy: 0, sxx: 0, syy: 0, sxy: 0, sh: 0, shh: 0, sxh: 0 });
const tot = { sim: sum(), real: sum() };
let games = 0, calls = 0, msEnc = 0, msNet = 0;
const pairs = { sim: [], real: [] };     // [ev, logit, evKopf, gewonnen]

for (const f of files) {
  for (const line of fs.readFileSync(f, { encoding: 'utf-8' }).split('\n')) {
    if (!line.trim()) continue;
    const r = JSON.parse(line);
    const sh = r.valueShadow;
    if (!sh) continue;
    games++; calls += sh.calls; msEnc += sh.msEnc; msNet += sh.msNet;
    for (const k of ['sim', 'real']) for (const key of Object.keys(tot[k])) tot[k][key] += sh[k][key];
    for (const [ev, lg, eh, , seat, inSim] of sh.pairs) pairs[inSim ? 'sim' : 'real'].push([ev, lg, eh, seat === r.winnerIdx ? 1 : 0]);
  }
}
if (!games) { console.error('Keine Zeilen mit valueShadow gefunden.'); process.exit(1); }

function corr(a, xk, yk, sxy, sxx, syy) {
  const n = a.n, mx = a[xk] / n, my = a[yk] / n;
  const cov = a[sxy] / n - mx * my, vx = a[sxx] / n - mx * mx, vy = a[syy] / n - my * my;
  return { r: cov / Math.sqrt(vx * vy), slope: cov / vy };      // slope = Steigung der Regression von x auf y
}
function auc(score, y) {
  const idx = score.map((_, i) => i).sort((a, b) => score[a] - score[b]);
  let rank = 1, sumPos = 0, n1 = 0;
  for (let i = 0; i < idx.length;) {
    let j = i; while (j + 1 < idx.length && score[idx[j + 1]] === score[idx[i]]) j++;
    const avg = rank + (j - i) / 2;
    for (let k = i; k <= j; k++) if (y[idx[k]]) { sumPos += avg; n1++; }
    rank += j - i + 1; i = j + 1;
  }
  const n0 = idx.length - n1;
  return n1 && n0 ? (sumPos - n1 * (n1 + 1) / 2) / (n1 * n0) : NaN;
}
const f3 = (v) => (Number.isFinite(v) ? v.toFixed(3) : '–');

console.log(`${games} Spiele · ${calls} Bewertungen (${(calls / games).toFixed(0)} je Spiel)`);
console.log(`Kosten je Bewertung: Kodieren ${(1000 * msEnc / calls).toFixed(0)} µs · Netz ${(1000 * msNet / calls).toFixed(0)} µs`);
for (const k of ['sim', 'real']) {
  const a = tot[k];
  if (a.n < 10) continue;
  const lg = corr(a, 'sx', 'sy', 'sxy', 'sxx', 'syy');
  const eh = corr(a, 'sx', 'sh', 'sxh', 'sxx', 'shh');
  const p = pairs[k];
  const y = p.map(q => q[3]);
  console.log(`\n${k === 'sim' ? 'Stellungen INNERHALB der Suche (Rollouts, Kandidaten)' : 'Echte Entscheidungsstellungen (außerhalb der Suche)'}: ${a.n} Bewertungen, ${p.length} Stichproben`);
  console.log(`  Evaluator ↔ Logit: r = ${f3(lg.r)} · Evaluator ↔ Evaluator-Kopf: r = ${f3(eh.r)}`);
  console.log(`  κ (Bewertungspunkte je Logit-Einheit, Regression Evaluator auf Logit): ${lg.slope.toFixed(0)}`);
  console.log(`  AUC gegen den Ausgang (Stichprobe): Evaluator ${f3(auc(p.map(q => q[0]), y))} · Netz ${f3(auc(p.map(q => q[1]), y))} · Evaluator-Kopf ${f3(auc(p.map(q => q[2]), y))}`);
}
