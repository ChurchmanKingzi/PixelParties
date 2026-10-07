'use strict';
// Abschluss-Auswertung eines Lernlaufs: nie (fast nie) gespielte Karten aus der letzten Meilenstein-Liste + Patt-Analyse (<profil>.discards.jsonl).
//   PP_ST_PROFILE=data/skilltest-night/profile.json node scripts/skilltest-final-analysis.js [ausgabe.md]
const fs = require('fs');
const path = require('path');
const dir = path.dirname(path.resolve(process.env.PP_ST_PROFILE || path.join(__dirname, '..', 'data', 'skilltest-night', 'profile.json')));
const ms = fs.readdirSync(dir + '/profile.milestones').filter(n => /^milestone-\d+\.json$/.test(n)).sort((a, b) => parseInt(a.slice(10)) - parseInt(b.slice(10)));
const last = JSON.parse(fs.readFileSync(dir + '/profile.milestones/' + ms[ms.length - 1], 'utf-8'));
const db = require('../cards/effects/_card-db').getCardDB();
const out = [];
out.push(`# Nie (fast nie) gespielte Karten — Stand ${last.games} Partien`, '');
out.push('Behaltene Exemplare, die im Kampf mindestens einmal gespielt wurden (`Genutzt`); nur Karten mit ≥ 20 behaltenen Exemplaren (`n`) und < 3 % Nutzung. „Wert" = Prep-Wert aus der Liste.', '');
const never = last.rows.filter(r => r.us != null && r.usn >= 20 && r.us < 0.03 && !['Hero', 'Ability'].includes(r.t));
const bySub = {};
for (const r of never) { const c = db[r.n] || {}; const k = r.t + (c.subtype ? ' / ' + c.subtype : ''); (bySub[k] = bySub[k] || []).push(r); }
for (const k of Object.keys(bySub).sort((a, b) => bySub[b].length - bySub[a].length)) {
  out.push(`## ${k} (${bySub[k].length})`, '');
  for (const r of bySub[k].sort((a, b) => a.us - b.us)) out.push(`- ${r.n} — Genutzt ${(r.us * 100).toFixed(1)} % (n=${r.usn}), Wert ${(r.v >= 0 ? '+' : '') + r.v.toFixed(3)}`);
  out.push('');
}
out.push(`Gesamt: ${never.length} Karten (von ${last.rows.filter(r => r.us != null && r.usn >= 20 && !['Hero', 'Ability'].includes(r.t)).length} mit Nutzungsdaten).`, '');
// Patt-Analyse
const f = path.join(dir, 'profile.discards.jsonl');
if (fs.existsSync(f)) {
  const L = fs.readFileSync(f, 'utf-8').trim().split('\n').filter(Boolean).map(JSON.parse);
  out.push(`# Verworfene Partien (Patt) — ${L.length} Fälle`, '');
  const cnt = (arr) => arr.reduce((a, k) => (a[k] = (a[k] || 0) + 1, a), {});
  out.push('Grund: ' + JSON.stringify(cnt(L.map(d => d.reason))), '');
  out.push('Überlebende Sitze am Ende: ' + JSON.stringify(cnt(L.map(d => String(d.board.filter(b => b.heroes.length).length)))), '');
  const stat = {}; const heroes = {}; let oneHp = 0, allBlind = 0;
  for (const d of L) {
    const alive = d.board.filter(b => b.heroes.length);
    for (const b of alive) for (const h of b.heroes) {
      const m = h.match(/^(.*):(\d+)(?:\[(.*)\])?$/); if (!m) continue;
      heroes[m[1]] = (heroes[m[1]] || 0) + 1; if (+m[2] <= 10) oneHp++;
      for (const s of (m[3] || '').split(',').filter(Boolean)) stat[s] = (stat[s] || 0) + 1;
    }
    if (alive.length && alive.every(b => b.heroes.every(h => /blinded/.test(h)))) allBlind++;
  }
  out.push('Status überlebender Helden: ' + JSON.stringify(stat), '');
  out.push(`Überlebende Helden mit ≤ 10 HP: ${oneHp}; Partien, in denen alle Überlebenden blinded waren: ${allBlind}`, '');
  out.push('Häufigste überlebende Helden: ' + Object.entries(heroes).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([h, n]) => h + ' ×' + n).join(', '), '');
}
fs.writeFileSync(process.argv[2] || path.join(dir, 'final-analysis.md'), out.join('\n'), { encoding: 'utf-8' });
console.log('geschrieben:', process.argv[2] || path.join(dir, 'final-analysis.md'), '—', never.length, 'Karten mit < 3 % Nutzung');
