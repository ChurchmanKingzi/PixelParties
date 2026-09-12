// ════════════════════════════════════════════════════════════════
//  WÄCHTER: SCHADENSTYP-VOKABULAR
//
//  Der `type`-Parameter jedes Schadensaufrufs hatte bis v905 weder
//  Registrierung noch Validierung — ein Tippfehler fällt nirgends auf,
//  er ändert nur stillschweigend das Verhalten. Genau so überlebte
//  `'normal'` bis v519 in vier Kreaturmodulen: kein gültiger Typ, nie
//  einer gewesen, und er verhielt sich wie ein unbekannter Wert.
//
//  Mit `'hero'` (v905) kommt ein Typ dazu — der richtige Moment, das
//  Vokabular festzunageln. Geprüft werden LITERALE in den
//  Schadensaufrufen der Kartenskripte; wird der Typ über eine Variable
//  gereicht, kann dieser Wächter nichts sagen und schweigt.
//
//  Aufruf:  node scripts/check-damage-types.js
//  Rückgabe 0 = sauber, 1 = mindestens ein unbekannter Typ.
// ════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

const EFFEKTE = path.join(__dirname, '..', 'cards', 'effects');

// Das vollständige Vokabular — identisch zur Tabelle in CARD_API.md.
// Wer hier etwas hinzufügt, trägt es DORT ebenfalls ein.
const VOKABULAR = new Set([
  'attack',             // Angriff eines Helden
  'creature',           // Kreatureffekt — der Normalfall für Creatures
  'hero',               // Heldeneffekt (v905)
  'destruction_spell',  // Zauberschaden
  'artifact',           // Artefaktschaden
  'potion',             // Potion-Schaden (v907)
  'decay_spell',        // Verfallszauber (v907)
  'recoil',             // Rückstoß
  'status', 'poison', 'fire', 'burn',   // Status-Ticks, von der Engine gesetzt
  'other',              // Selbstverletzung als Kosten u.ä. — bewusste Wahl
]);

// `actionDealDamage(quelle, ziel, menge, typ, opts)` — der Typ ist das
// VIERTE Argument. Eine Regex reicht dafür nicht: die ersten drei
// Argumente enthalten regelmäßig Objektliterale mit eigenen Klammern,
// Kommas und Strings, und ein `[\s\S]*?` läuft dann über das Ende des
// Aufrufs hinaus und greift sich ein Stringliteral aus der nächsten
// Anweisung (erster Anlauf meldete so `'decay_spell'` und `'discard'`
// als Schadenstypen, obwohl beide zu ganz anderen Aufrufen gehörten).
// Deshalb wird die Argumentliste mit einem Klammerzähler abgelaufen
// und an den Kommas der OBERSTEN Ebene getrennt.
const AUFRUF_START = /\bengine\.action(?:DealDamage|DealCreatureDamage)\s*\(/g;

/**
 * Liest ab der öffnenden Klammer die Argumente der obersten Ebene.
 * Zählt Klammern und Klammerpaare mit, überspringt Strings (inklusive
 * Escapes) und Template-Literale. Gibt null zurück, wenn die Klammer
 * nicht geschlossen wird (abgeschnittene Datei).
 */
function argumenteLesen(code, von) {
  const args = [];
  let tiefe = 0, start = von + 1, i = von;
  let quote = null;
  for (; i < code.length; i++) {
    const c = code[i];
    if (quote) {
      if (c === '\\') { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') { quote = c; continue; }
    if (c === '(' || c === '[' || c === '{') { tiefe++; continue; }
    if (c === ')' || c === ']' || c === '}') {
      tiefe--;
      if (tiefe === 0 && c === ')') { args.push(code.slice(start, i)); return args; }
      continue;
    }
    if (c === ',' && tiefe === 1) { args.push(code.slice(start, i)); start = i + 1; }
  }
  return null;
}

function ohneKommentare(src) {
  // Blockkommentare durch ihre EIGENEN Zeilenumbrueche ersetzen: sonst
  // verrutschen die Zeilennummern im Bericht gegenueber der Datei
  // (bei grossen Kopfkommentaren um zweistellige Betraege).
  return String(src || '')
    .replace(/\/\*[\s\S]*?\*\//g, (m) => '\n'.repeat((m.match(/\n/g) || []).length))
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/([^:'"`])\/\/.*$/gm, '$1');
}

const funde = [];
let dateien = 0;
let aufrufe = 0;

for (const name of fs.readdirSync(EFFEKTE).sort()) {
  if (!name.endsWith('.js')) continue;
  if (name === '_engine.js') continue;   // die Engine selbst definiert die Typen
  dateien++;
  const code = ohneKommentare(fs.readFileSync(path.join(EFFEKTE, name), 'utf8'));
  const zeilen = code.split('\n');
  AUFRUF_START.lastIndex = 0;
  let m;
  while ((m = AUFRUF_START.exec(code)) !== null) {
    aufrufe++;
    const args = argumenteLesen(code, AUFRUF_START.lastIndex - 1);
    if (!args || args.length < 4) continue;          // Typ weggelassen
    const roh = args[3].trim();
    const lit = /^(['"])([a-z_]+)\1$/.exec(roh);
    if (!lit) continue;                              // Variable/Ausdruck — nicht prüfbar
    if (VOKABULAR.has(lit[2])) continue;
    const zeile = code.slice(0, m.index).split('\n').length;
    funde.push({ datei: name, zeile, typ: lit[2], text: (zeilen[zeile - 1] || '').trim().slice(0, 100) });
  }
}

// ── Ratchet gegen die Grundlinie ────────────────────────────────────
// Wie `check-no-splice`: der Bestand darf stehen bleiben, NEUES nicht.
// Die Grundlinie hält fest, welche Datei welchen unbekannten Typ heute
// noch führt; jede Bereinigung senkt sie (`--update`), und Exit 1 gibt
// es, sobald eine Datei NEU auftaucht oder einen weiteren unbekannten
// Typ dazubekommt.
const GRUNDLINIE = path.join(__dirname, 'damage-types-baseline.json');
const jetzt = {};
for (const f of funde) {
  (jetzt[f.datei] = jetzt[f.datei] || new Set()).add(f.typ);
}
const jetztFlach = Object.fromEntries(
  Object.entries(jetzt).map(([d, t]) => [d, [...t].sort()]),
);

if (process.argv.includes('--update')) {
  fs.writeFileSync(GRUNDLINIE, JSON.stringify(jetztFlach, null, 2) + '\n', 'utf8');
  console.log(`[check-damage-types] Grundlinie aktualisiert — ${Object.keys(jetztFlach).length} Datei(en).`);
  process.exit(0);
}

let alt = {};
if (fs.existsSync(GRUNDLINIE)) {
  try { alt = JSON.parse(fs.readFileSync(GRUNDLINIE, 'utf8')); } catch { alt = {}; }
}

const neuFunde = funde.filter(f => !(alt[f.datei] || []).includes(f.typ));

if (neuFunde.length === 0) {
  const rest = Object.keys(jetztFlach).length;
  console.log(`[check-damage-types] OK — ${aufrufe} Schadensaufruf(e) in ${dateien} Datei(en)`
    + (rest ? `, ${rest} bekannte Altlast(en).` : ', alle Typen bekannt.'));
  process.exit(0);
}

console.error(`[check-damage-types] ${neuFunde.length} NEUE(R) unbekannte(r) Schadenstyp(en):\n`);
for (const f of neuFunde) {
  console.error(`  ✗ ${f.datei}:${f.zeile}  Typ '${f.typ}'`);
  console.error(`      ${f.text}`);
}
console.error(`\n  Bekanntes Vokabular: ${[...VOKABULAR].join(', ')}`);
console.error('  Neuer Typ? Erst in CARD_API.md eintragen, dann hier.');
console.error('  Altlast bereinigt? `node scripts/check-damage-types.js --update`.\n');
process.exit(1);
