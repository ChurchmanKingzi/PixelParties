'use strict';
// ════════════════════════════════════════════════════════════════
//  PIXEL PARTIES — SPLICE-WÄCHTER (v820, Als Regel 7.9.)
//
//  Kartenskripte splicen NIE selbst an Deck, Ablage oder Gelöscht-
//  Stapel — dafür gibt es die Stapel-Schicht der Engine
//  (`takeFromPile`, `summonFromPile`, `placeFromPile`,
//  `addFromPileToHand`, `deleteFromPile`, `takeTop`, `reorderDeck`;
//  siehe CARD_API.md ★ „KEIN DIREKTES SPLICEN").
//
//  Der v819-Sweep hat 127 Altstellen mit Guards versehen, die noch
//  nicht migriert sind. Damit der Wächter trotzdem sofort nützt,
//  arbeitet er als RATCHET: `no-splice-baseline.json` hält je Datei
//  die bekannte Zahl; gemeldet wird jede Datei, die NEU spliced oder
//  MEHR spliced als bekannt. Jede Migration senkt die Zahl — danach
//  `--update`, und der Stand kann nie wieder steigen.
//
//  Aufruf:
//    node scripts/check-no-splice.js             Ratchet prüfen (Exit 1 bei Verstoß)
//    node scripts/check-no-splice.js --all       alle verbliebenen Stellen listen
//    node scripts/check-no-splice.js --update    Baseline auf den Ist-Stand setzen
// ════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'cards', 'effects');
const BASELINE = path.join(__dirname, 'no-splice-baseline.json');
// Die Engine ist die Stapel-Schicht selbst.
const ALLOW = new Set(['_engine.js']);
const RE = /\b(mainDeck|discardPile|deletedPile)\.splice\(/g;

const args = process.argv.slice(2);
const showAll = args.includes('--all');
const update = args.includes('--update');

const current = {};
const sites = {};
for (const f of fs.readdirSync(DIR).filter(f => f.endsWith('.js') && !ALLOW.has(f))) {
  const lines = fs.readFileSync(path.join(DIR, f), 'utf8').split('\n');
  let n = 0;
  lines.forEach((l, i) => {
    if (l.trim().startsWith('//') || l.trim().startsWith('*')) return;
    const hits = l.match(RE);
    if (!hits) return;
    n += hits.length;
    (sites[f] = sites[f] || []).push(i + 1);
  });
  if (n > 0) current[f] = n;
}

if (update) {
  fs.writeFileSync(BASELINE, JSON.stringify(current, null, 2) + '\n', 'utf8');
  const total = Object.values(current).reduce((a, b) => a + b, 0);
  console.log(`[check-no-splice] Baseline gesetzt: ${total} Stelle(n) in ${Object.keys(current).length} Datei(en).`);
  process.exit(0);
}

let baseline = {};
try { baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8')); } catch { /* keine Baseline = alles neu */ }

const violations = [];
for (const [f, n] of Object.entries(current)) {
  const known = baseline[f] || 0;
  if (n > known) violations.push({ f, n, known });
}
const total = Object.values(current).reduce((a, b) => a + b, 0);
const knownTotal = Object.values(baseline).reduce((a, b) => a + b, 0);

if (showAll) {
  for (const f of Object.keys(current).sort()) console.log(`${f}: Zeile ${sites[f].join(', ')}`);
  console.log(`\n[check-no-splice] ${total} verbliebene Stelle(n) in ${Object.keys(current).length} Datei(en) (Baseline: ${knownTotal}).`);
}

if (violations.length === 0) {
  const improved = knownTotal - total;
  console.log(`[check-no-splice] OK — ${total} bekannte Stelle(n)${improved > 0 ? `, ${improved} weniger als die Baseline (→ --update)` : ''}.`);
  process.exit(0);
}
console.log(`[check-no-splice] ${violations.length} Datei(en) splicen NEU oder MEHR als bekannt:`);
for (const v of violations) console.log(`  ${v.f}: ${v.n} (bekannt ${v.known}) — Zeile ${sites[v.f].join(', ')}`);
console.log('Kartenskripte nutzen die Stapel-Schicht (CARD_API.md ★ „KEIN DIREKTES SPLICEN").');
process.exit(1);
