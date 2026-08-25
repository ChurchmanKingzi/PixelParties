#!/usr/bin/env node
// Liest einen frisch gesammelten Trainings-Satz und beantwortet die eine
// Frage, die vor einem mehrtägigen Sammellauf zählt: KOMMT DER
// ENTSCHEIDUNGS-KANAL ÜBERHAUPT AN?
//
//   node scripts/smoke-decisions.js data/training/_smoke.jsonl
//
// Uninstrumentierte Spiele lassen sich nicht nachträglich
// instrumentieren — deshalb diese Prüfung VOR dem großen Lauf.
'use strict';
const fs = require('fs');
const datei = process.argv[2] || 'data/training/_smoke.jsonl';
let zeilen = [];
try {
  zeilen = fs.readFileSync(datei, 'utf-8').split('\n').filter(Boolean).map(l => JSON.parse(l));
} catch (err) { console.error(`Kann ${datei} nicht lesen: ${err.message}`); process.exit(1); }
if (!zeilen.length) { console.error(`${datei} ist leer.`); process.exit(1); }

const summe = { gen: 0, tgt: 0, roll: 0, fremd: 0, voll: 0, schrieb: 0 };
const wrapper = {}; const arten = {}; let mitFeld = 0, zeilenGesamt = 0, mitDEval = 0, mitEnde = 0;
for (const g of zeilen) {
  const d = g.decisionDiag;
  if (d) {
    mitFeld++;
    for (const k of Object.keys(summe)) summe[k] += (d[k] || 0);
    wrapper[d.wrapper || '—'] = (wrapper[d.wrapper || '—'] || 0) + 1;
  }
  for (const z of (g.decisions || [])) {
    zeilenGesamt++;
    arten[z.a] = (arten[z.a] || 0) + 1;
    if (z.r && Number.isFinite(z.r.dEval)) { mitDEval++; if (z.r.end) mitEnde++; }
  }
}
const n = zeilen.length;
const pf = (b) => (b ? '✓' : '✗');
console.log('═'.repeat(64));
console.log(`  RAUCHTEST ENTSCHEIDUNGS-KANAL — ${n} Spiele aus ${datei}`);
console.log('═'.repeat(64));
console.log(`  Spiele mit decisionDiag ... ${mitFeld}/${n}`);
console.log(`  Wrapper-Status ............ ${Object.entries(wrapper).map(([k, v]) => `${k}:${v}`).join(' ')}`);
console.log(`  Trichter durchlaufen ...... promptGeneric ${summe.gen}, promptEffectTarget ${summe.tgt}`);
console.log(`  Rollouts ausgeschlossen ... ${summe.roll}`);
console.log(`  Gegnerseite gefiltert ..... ${summe.fremd}`);
console.log(`  Am 4000er-Deckel .......... ${summe.voll}`);
console.log(`  Zeilen geschrieben ........ ${summe.schrieb}  (${(zeilenGesamt / n).toFixed(1)} je Spiel)`);
console.log(`  Arten ..................... ${Object.entries(arten).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(' ') || '—'}`);
console.log(`  Verzögert bewertet ........ ${mitDEval}/${zeilenGesamt} (davon ${mitEnde} gegen den Endstand)`);
console.log('─'.repeat(64));

const proben = [
  ['decisionDiag in jedem Spiel', mitFeld === n,
    'Der Recorder liefert das Feld nicht — läuft ein alter Build?'],
  ['Hülle nirgends überschrieben', !!wrapper.ok && Object.keys(wrapper).length === 1,
    'Jemand hüllt promptGeneric NACH dem Recorder ein — genau die v589-Lage.'],
  ['Trichter werden durchlaufen', summe.gen > 0,
    'promptGeneric wurde nie erreicht. Ohne das kann nichts geschrieben werden.'],
  ['Zeilen kommen an', summe.schrieb > 0,
    summe.fremd > summe.schrieb
      ? 'Fast alles fiel auf die Gegnerseite — pinnedIdx prüfen.'
      : 'Trichter laufen, aber nichts wird geschrieben.'],
  ['Rollouts werden ausgeschlossen', summe.roll > 0,
    'roll=0 heißt: der Ausschluss hatte nichts zu tun. Bei 24–80 Pulls je Zug ist das unplausibel.'],
  ['Deckel nicht gerissen', summe.voll === 0,
    'Der 4000-Zeilen-Deckel greift — das Protokoll ist unvollständig.'],
  ['Ablehnungen werden erfasst', zeilenGesamt === 0 || (zeilen.some(g => (g.decisions || []).some(z => z.f === 0))),
    'Keine einzige abgelehnte Entscheidung. Ohne Nullen gibt es keine Grundrate.'],
  ['Verzögerte Bewertung greift', mitDEval > 0,
    'Kein r.dEval — der Nachtrag am Zugbeginn läuft nicht.'],
];
let rot = 0;
for (const [name, ok, hinweis] of proben) {
  console.log(`  ${pf(ok)} ${name}`);
  if (!ok) { console.log(`      → ${hinweis}`); rot++; }
}
console.log('─'.repeat(64));
if (rot === 0) console.log('  ALLES GRÜN — der große Sammellauf kann starten.');
else console.log(`  ${rot} Prüfung(en) rot — NICHT sammeln, erst klären.`);
process.exit(rot === 0 ? 0 : 1);
