// ════════════════════════════════════════════════════════════════
//  WÄCHTER: ERFUNDENE gameState-FELDER
//
//  Ein Kartenskript, das `gs.currentPlayer` liest, bekommt `undefined`
//  zurück — leise. Kein Fehler, kein Log, die Bedingung ist einfach
//  immer falsch und der Effekt läuft nie. Genau so fiel Rha'Bis
//  Rückhol-Hook aus (Als Befund 12.9.): das Feld heißt `activePlayer`,
//  `currentPlayer` gibt es im ganzen Spiel nicht. Schlimmer noch, der
//  Prüfstand hatte denselben Tippfehler in seinem Spielstand stehen und
//  bestätigte das kaputte Verhalten.
//
//  Geprüft werden NUR Felder ohne führenden Unterstrich. `gs._foo` ist
//  die etablierte Form für karteneigenen Kramzustand (39 Stellen im
//  Bestand: `_bsMarks`, `_puppetActiveLock`, `_staffIllusions` …) —
//  die gehören der Karte und tauchen in der Engine naturgemäß nicht
//  auf. Alles OHNE Unterstrich ist dagegen ein Feld des gemeinsamen
//  Spielstands und muss in `_engine.js` oder `server.js` vorkommen.
//
//  Aufruf:  node scripts/check-gamestate-fields.js
//  Rückgabe 0 = sauber, 1 = mindestens ein unbekanntes Feld.
// ════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

const WURZEL  = path.join(__dirname, '..');
const EFFEKTE = path.join(WURZEL, 'cards', 'effects');

function ohneKommentare(src) {
  return String(src || '')
    .replace(/\/\*[\s\S]*?\*\//g, (m) => '\n'.repeat((m.match(/\n/g) || []).length))
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/([^:'"`])\/\/.*$/gm, '$1');
}

// Alles, was die Engine oder der Server am Spielstand anfasst, gilt als
// real — egal ob lesend oder schreibend.
const engineQuelle =
  fs.readFileSync(path.join(EFFEKTE, '_engine.js'), 'utf8')
  + fs.readFileSync(path.join(WURZEL, 'server.js'), 'utf8');
const BEKANNT = new Set(
  [...engineQuelle.matchAll(/\b(?:gs|gameState|this\.gs)\.([A-Za-z_$][\w$]*)/g)].map(m => m[1]),
);

const funde = [];
let dateien = 0;

for (const name of fs.readdirSync(EFFEKTE).sort()) {
  if (!name.endsWith('.js') || name === '_engine.js') continue;
  dateien++;
  const code = ohneKommentare(fs.readFileSync(path.join(EFFEKTE, name), 'utf8'));
  const zeilen = code.split('\n');
  // Felder, die DIESE Datei selbst anlegt, gehören ihr — `_cpu.js`
  // fuehrt so seinen `gerryPassed`-Zaehler. Der verraeterische Fall ist
  // das Feld, das NUR GELESEN und nirgends je geschrieben wird: dann
  // liefert es stillschweigend `undefined`.
  const selbstGesetzt = new Set(
    [...code.matchAll(/\b(?:gs|gameState|engine\.gs|ctx\._engine\.gs)\.([A-Za-z_$][\w$]*)\s*(?:=[^=]|\|\|=|\?\?=)/g)]
      .map(mm => mm[1]),
  );

  for (const m of code.matchAll(/\b(?:gs|gameState|engine\.gs|ctx\._engine\.gs)\.([A-Za-z_$][\w$]*)/g)) {
    const feld = m[1];
    if (feld.startsWith('_')) continue;          // karteneigener Kramzustand
    if (BEKANNT.has(feld)) continue;
    if (selbstGesetzt.has(feld)) continue;       // legt die Datei selbst an
    const zeile = code.slice(0, m.index).split('\n').length;
    funde.push({ datei: name, zeile, feld, text: (zeilen[zeile - 1] || '').trim().slice(0, 96) });
  }
}

if (funde.length === 0) {
  console.log(`[check-gamestate-fields] OK — ${dateien} Datei(en) geprüft, keine erfundenen Felder.`);
  process.exit(0);
}

console.error(`[check-gamestate-fields] ${funde.length} unbekannte(s) gameState-Feld(er):\n`);
for (const f of funde) {
  console.error(`  ✗ ${f.datei}:${f.zeile}  gs.${f.feld}`);
  console.error(`      ${f.text}`);
}
console.error('\n  Tippfehler? Das Feld existiert in _engine.js / server.js nicht.');
console.error('  Karteneigener Zustand? Dann mit führendem Unterstrich schreiben.\n');
process.exit(1);
