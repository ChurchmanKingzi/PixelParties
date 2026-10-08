'use strict';
// Schwächste Karten des aktuellen Profils (nur Karten, die JETZT im Skill-Test-Pool sind).
//   PP_ST_PROFILE=data/skilltest-night/profile.json node scripts/skilltest-bottom.js [N=100] [ausgabe.md]
// Grundlage: letzte Meilenstein-Liste des Profils (`profile.milestones/`). Rang = Prep-Wert (`v`, mittlere Platzierungsgüte mit der Karte im Aufbau,
// bereinigt); `Nutzung` = Anteil behaltener Exemplare, die im Kampf gespielt wurden; `Spielwert` = mittlere Stellungsverbesserung nach dem Ausspielen.
const fs = require('fs');
const path = require('path');
const N = Number(process.argv[2]) || 100;
const dir = path.dirname(path.resolve(process.env.PP_ST_PROFILE || path.join(__dirname, '..', 'data', 'skilltest-night', 'profile.json')));
const ms = fs.readdirSync(dir + '/profile.milestones').filter(n => /^milestone-\d+\.json$/.test(n)).sort((a, b) => parseInt(a.slice(10)) - parseInt(b.slice(10)));
const last = JSON.parse(fs.readFileSync(dir + '/profile.milestones/' + ms[ms.length - 1], 'utf-8'));
const cards = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'cards.json'), 'utf-8'));
const list = Array.isArray(cards) ? cards : Object.values(cards.cards || cards);
const byName = Object.fromEntries(list.map(c => [c.name, c]));
const hasImage = require('../skilltest/pool').imageFilter(byName);
const legal = (n) => { const c = byName[n]; return !!(c && c.skilltestLegal && !c.banned && hasImage(n)); };
const rows = last.rows.filter(r => legal(r.n));
const poolN = list.filter(c => legal(c.name)).length;
const sorted = rows.slice().sort((a, b) => a.v - b.v);
const bottom = sorted.slice(0, N);
const pct = (x) => x == null ? '–' : (x * 100).toFixed(0) + ' %';
const why = (r) => {
  const w = [];
  if (r.us != null && r.usn >= 15 && r.us < 0.05) w.push('wird fast nie gespielt');
  else if (r.us != null && r.usn >= 15 && r.us < 0.3) w.push('selten gespielt');
  if (r.pl != null && r.pln >= 30 && r.pl < 0) w.push('Ausspielen verschlechtert die Stellung');
  if (!w.length) w.push('schwacher Prep-Wert');
  return w.join('; ');
};
const out = [];
out.push(`# Die ${N} schwächsten Karten im aktuellen Skill-Test-Pool`, '');
out.push(`Stand: ${last.games} Lernpartien (letzte Meilenstein-Liste). Pool jetzt: ${poolN} Karten, davon ${rows.length} mit Messwerten; Rang 1 = schwächste.`, '');
out.push('`Prep` = Prep-Wert (mittlere Platzierungsgüte mit der Karte im Aufbau, bereinigt; n = Zahl der Austeilungen), `Genutzt` = Anteil behaltener Exemplare, die im Kampf gespielt wurden (n = behaltene), `Spielwert` = mittlere Stellungsverbesserung nach dem Ausspielen (n = Ausspielungen).', '');
out.push('| # | Karte | Typ | Prep (n) | Behalten | Genutzt (n) | Spielwert (n) | Befund | Effekt |', '|--:|---|---|---|---|---|---|---|---|');
bottom.forEach((r, i) => {
  const c = byName[r.n] || {};
  const eff = String(c.effect || '').replace(/\s+/g, ' ').replace(/\|/g, '/').slice(0, 110);
  out.push(`| ${i + 1} | ${r.n} | ${r.t}${c.subtype ? ' / ' + c.subtype : ''} | ${(r.v >= 0 ? '+' : '') + r.v.toFixed(3)} (${r.vn}) | ${r.t === 'Hero' ? '–' : pct(r.k)} | ${pct(r.us)}${r.us != null ? ' (' + r.usn + ')' : ''} | ${r.t === 'Hero' ? '–' : (r.pl != null && r.pln ? r.pl.toFixed(2) + ' (' + r.pln + ')' : '–')} | ${why(r)} | ${eff} |`);
});
out.push('');
const byType = {};
for (const r of bottom) byType[r.t] = (byType[r.t] || 0) + 1;
out.push('Verteilung nach Typ: ' + Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([t, n]) => t + ' ' + n).join(', '), '');
const never = bottom.filter(r => r.us != null && r.usn >= 15 && r.us < 0.05);
out.push(`Davon „wird fast nie gespielt“ (< 5 % Nutzung bei ≥ 15 behaltenen): ${never.length}`, '');
// Kandidaten zum Aussortieren: Karten ohne Helden, die die Bots (fast) nie behalten oder nie spielen — unabhängig vom Prep-Rang.
const cand = rows.filter(r => !['Hero'].includes(r.t) && ((r.k != null && r.vn >= 1000 && r.k < 0.03) || (r.us != null && r.usn >= 15 && r.us < 0.08)))
  .sort((a, b) => (a.us == null ? -1 : a.us) - (b.us == null ? -1 : b.us) || a.v - b.v);
out.push(`## Kandidaten zum Aussortieren (ohne Helden): ${cand.length}`, '');
out.push('Karten, die die Bots in < 3 % der Austeilungen behalten **oder** von behaltenen Exemplaren in < 8 % im Kampf spielen. (Ein Bot-Befund, kein Beweis: eine Karte kann für Menschen taugen, die Bots aber nicht bedienen können.)', '');
out.push('| Karte | Typ | Prep (n) | Behalten | Genutzt (n) | Spielwert | Effekt |', '|---|---|---|---|---|---|---|');
for (const r of cand) {
  const c = byName[r.n] || {};
  out.push(`| ${r.n} | ${r.t}${c.subtype ? ' / ' + c.subtype : ''} | ${(r.v >= 0 ? '+' : '') + r.v.toFixed(3)} (${r.vn}) | ${pct(r.k)} | ${pct(r.us)}${r.us != null ? ' (' + r.usn + ')' : ''} | ${r.pl != null && r.pln ? r.pl.toFixed(2) : '–'} | ${String(c.effect || '').replace(/\s+/g, ' ').replace(/\|/g, '/').slice(0, 110)} |`);
}
out.push('');
const file = process.argv[3] || path.join(__dirname, '..', 'docs', 'skilltest-bottom' + N + '.md');
fs.writeFileSync(file, out.join('\n'), { encoding: 'utf-8' });
console.log('geschrieben:', file);
console.log(cand.length + ' Kandidaten ohne Helden');
console.log(bottom.map((r, i) => `${String(i + 1).padStart(3)} ${r.n} [${r.t}] v${(r.v >= 0 ? '+' : '') + r.v.toFixed(2)} n${r.vn} gen${pct(r.us)}(${r.usn}) pl${r.pl != null && r.pln ? r.pl.toFixed(1) : '-'} — ${why(r)}`).join('\n'));
