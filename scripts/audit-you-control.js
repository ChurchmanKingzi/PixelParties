#!/usr/bin/env node
'use strict';
// Audit „you control = aktuelle Kontrolle (Kontrolleur), nie Besitzer" (Welle 28 / W28a, Al 21.10.2026).
// Liest `data/cards.json`, filtert Karten, deren Text „you control" / „you permanently control" enthält, und sucht im zugehörigen Skript
// (`cards/effects/<name>.js`, dazu die lokal per `require('./_*-shared')` eingebundenen Hilfsmodule) nach
//   • BESITZ-/BRETTSEITEN-Lesarten:  `.owner ===/!== <Spieler>` auf Instanzen, Schleifen über `players[x].heroes` / `ps.heroes`, `supportZones` der eigenen Seite, `physicalSide`
//   • KONTROLL-Lesarten:              `heroesControlledBy`, `heroSideOf`, `kontrolleurVon`, `.controller`, `effektiveSeiten`, `kreaturPasstZurSeite`, `nachKontrolle`, `kopienAnKontrolliertenHelden`, `cardOwner` (Kontext liefert den Kontrolleur)
// Ausgabe: je Karte die Befund-Klasse
//   A = Besitz-Lesart OHNE jede Kontroll-Lesart  → prüfen (Verdacht)
//   B = beides gemischt                           → Stichprobe
//   C = nur Kontroll-Lesart / keine Besitz-Lesart → unauffällig
// Aufruf: node scripts/audit-you-control.js [--json] [--klasse=A]
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const EFF = path.join(ROOT, 'cards/effects');
const cards = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/cards.json'), 'utf8'));
const { nameToFile } = (() => { try { return require(path.join(EFF, '_loader.js')); } catch { return {}; } })();
const slug = (n) => (typeof nameToFile === 'function' ? nameToFile(n) : n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));

const RISK = [
  ['owner-vergleich', /\b(?:inst|c|i|ci|card|creature|k|x|e|h|a|it|target|t|ally|unit|cr)\.owner\s*(?:===|!==|==|!=)\s*(?:pi|ownerIdx|playerIdx|me|self|cardOwner|owner|ctx\.cardOwner|p|idx|seat|side)\b/g],
  ['owner-vergleich-umgekehrt', /\b(?:pi|ownerIdx|playerIdx|me|cardOwner|ctx\.cardOwner)\s*(?:===|!==)\s*(?:inst|c|i|ci|card|creature|k|x|e|h|a|it|target|t|cr)\.owner\b/g],
  ['helden-der-seite', /(?:players\[\s*(?:pi|ownerIdx|playerIdx|me|ctx\.cardOwner|cardOwner|owner|idx|p)\s*\]|\b(?:ps|myPs|ownPs|me|player)\b)\.heroes\b/g],
  ['support-der-seite', /(?:players\[\s*(?:pi|ownerIdx|playerIdx|me|ctx\.cardOwner|cardOwner|owner|idx|p)\s*\]|\b(?:ps|myPs|ownPs)\b)\.supportZones\b/g],
  ['brettseite', /\bphysicalSide\s*\(/g],
];
// STARK = ausdrückliche Kontroll-Lesarten; `cardOwner`/`getFreeSupportZones` etc. sind schwach (der Kontext liefert den Kontrolleur, sagt aber nichts über die Wirt-/Zielsammlung).
const KONTROLLE = [
  'heroesControlledBy', 'heroSideOf', 'kontrolleurVon', 'kontrolleurVonHeld', '.controller', 'effektiveSeiten', 'kreaturPasstZurSeite',
  'nachKontrolle', 'kopienAnKontrolliertenHelden', 'getKontrollAusruestZiele', 'zonenRechtAmHeld',
  'fremdAusruestHelden', 'candidateHosts', 'eligibleSummonZones', 'stolenBy', 'charmedBy', 'permaControlBy', 'kontrollRechte',
  'getControlledHeroTargets', 'heroImmunGegenEigene',
];

function quellen(file) {
  const out = [{ file, src: fs.readFileSync(file, 'utf8') }];
  const re = /require\(\s*['"](\.\/_[\w-]+(?:\.js)?)['"]\s*\)/g;
  let m;
  while ((m = re.exec(out[0].src))) {
    const f = path.join(EFF, m[1].endsWith('.js') ? m[1] : m[1] + '.js');
    if (fs.existsSync(f) && /shared|helpers|summon-eligibility/.test(f)) out.push({ file: f, src: fs.readFileSync(f, 'utf8'), geteilt: true });
  }
  return out;
}

// W31a (Al, 22.10.2026): `--form=your-heroes` prueft statt „you control" die Ausnahme-Form „one of your Heroes" / „your (other) Heroes" / „each of your Heroes" …
// (gleiche Regel: nach aktueller KONTROLLE; ausser durch die Kontrolle ausdruecklich immun gegen eigene Karten — `engine.getControlledHeroTargets(pi, { ausserImmun: true })`).
// Possessiv-Formen („one of your Heroes' Support Zones") sind Zonen-Formen und zaehlen hier nicht.
const FORM = (process.argv.find(a => a.startsWith('--form=')) || '').split('=')[1];
const RE_YOUR_HEROES = /[^.]*(?:\b(?:one|any|each|all|both|another|other|up to \d+|at least \d+|\d+) of your (?:other |starting |defeated |undefeated )?(?:\w+ )?Heroes?(?![\u2019'a-z])|\byour (?:other |defeated |undefeated )?Heroes?(?![\u2019'a-z])|Hero of yours)[^.]*\./gi;

const zeilen = [];
for (const c of cards) {
  const text = String(c.effect || '').replace(/\s+/g, ' ');
  const treffer = FORM === 'your-heroes' ? text.match(RE_YOUR_HEROES) : text.match(/[^.]*\byou (?:permanently )?control\b[^.]*\./gi);
  if (!treffer) continue;
  const file = path.join(EFF, slug(c.name) + '.js');
  if (!fs.existsSync(file)) { zeilen.push({ name: c.name, typ: c.cardType, klasse: '-', grund: 'kein Skript', saetze: treffer.length }); continue; }
  const qs = quellen(file);
  const eigen = qs[0].src;
  const risk = {}; let rn = 0;
  for (const q of qs) for (const [k, re] of RISK) { const n = (q.src.match(re) || []).length; if (n) { risk[k] = (risk[k] || 0) + n; rn += n; } }
  let kn = 0; const kontrolle = [];
  for (const q of qs) for (const k of KONTROLLE) { const n = q.src.split(k).length - 1; if (n) { kn += n; if (!kontrolle.includes(k)) kontrolle.push(k); } }
  const klasse = rn === 0 ? 'C' : (kn === 0 ? 'A' : 'B');
  zeilen.push({ name: c.name, typ: c.cardType, klasse, risk, kontrolle: kontrolle.slice(0, 6), saetze: treffer.length, text: treffer.slice(0, 2).join(' | ').slice(0, 220), datei: path.basename(file) });
}
const want = (process.argv.find(a => a.startsWith('--klasse=')) || '').split('=')[1];
const sel = want ? zeilen.filter(z => z.klasse === want) : zeilen;
if (process.argv.includes('--json')) console.log(JSON.stringify(sel, null, 1));
else {
  const n = { A: 0, B: 0, C: 0, '-': 0 }; for (const z of zeilen) n[z.klasse]++;
  console.log(`Karten mit ${FORM === 'your-heroes' ? '„your Heroes"-Form' : '„you control"'}: ${zeilen.length} · A (Besitz ohne Kontrolle): ${n.A} · B (gemischt): ${n.B} · C (unauffällig): ${n.C} · ohne Skript: ${n['-']}`);
  for (const z of sel) if (z.klasse !== 'C') console.log(`${z.klasse} ${z.name} [${z.typ}] ${JSON.stringify(z.risk || {})} kontrolle=${(z.kontrolle || []).join(',')}\n    ${z.text || z.grund}`);
}
