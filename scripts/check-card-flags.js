// ════════════════════════════════════════════════════════════════
//  WÄCHTER: PFLICHTFLAGGEN AN KARTENSKRIPTEN
//
//  Manche Spielwege prüfen eine Flagge am Skript und steigen sonst
//  STILL aus — kein Fehler, kein Log, die Karte reagiert einfach nicht.
//  Genau so verhielt sich „Sword in a Bottle" (Als Befund 12.9.): im
//  Client als nutzbar hervorgehoben, aber Klick und Drag liefen ins
//  Leere, weil `isPotion: true` fehlte und `doUsePotion` gleich in der
//  ersten Zeile zurückkam:
//
//      if (!script?.isPotion) return false;
//
//  Der Wächter prüft für jede Karte mit Skript, ob die Flagge zu ihrem
//  `cardType` in cards.json vorhanden ist.
//
//  Aufruf:  node scripts/check-card-flags.js
//  Rückgabe 0 = sauber, 1 = mindestens eine Flagge fehlt.
// ════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

const WURZEL = path.join(__dirname, '..');
const EFFEKTE = path.join(WURZEL, 'cards', 'effects');
const KARTEN = path.join(WURZEL, 'data', 'cards.json');

// cardType → { flagge, warum }. Erweitern, sobald ein weiterer Spielweg
// eine Flagge ZWINGEND verlangt (erkennbar an einem
// `if (!script?.xyz) return false;` im Server).
const PFLICHT = {
  Potion: {
    flagge: 'isPotion',
    warum: '`doUsePotion` in server.js steigt ohne sie still aus',
  },
};

/** Kartenname → Dateiname, identisch zu `nameToFile` im Loader. */
function nameZuDatei(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function ohneKommentare(src) {
  return String(src || '')
    .replace(/\/\*[\s\S]*?\*\//g, (m) => '\n'.repeat((m.match(/\n/g) || []).length))
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/([^:'"`])\/\/.*$/gm, '$1');
}

const karten = JSON.parse(fs.readFileSync(KARTEN, 'utf8'));
const funde = [];
let geprueft = 0;

for (const karte of karten) {
  const regel = PFLICHT[karte.cardType];
  if (!regel) continue;
  const datei = path.join(EFFEKTE, nameZuDatei(karte.name) + '.js');
  if (!fs.existsSync(datei)) continue;      // noch nicht implementiert
  geprueft++;
  const code = ohneKommentare(fs.readFileSync(datei, 'utf8'));
  const re = new RegExp(`^\\s*${regel.flagge}\\s*:\\s*true\\s*,`, 'm');
  if (!re.test(code)) {
    funde.push({ name: karte.name, datei: path.basename(datei), ...regel });
  }
}

if (funde.length === 0) {
  console.log(`[check-card-flags] OK — ${geprueft} Karte(n) geprüft, alle Pflichtflaggen gesetzt.`);
  process.exit(0);
}

console.error(`[check-card-flags] ${funde.length} fehlende Pflichtflagge(n):\n`);
for (const f of funde) {
  console.error(`  ✗ ${f.datei}  (${f.name})`);
  console.error(`      erwartet: \`${f.flagge}: true,\` — ${f.warum}`);
}
console.error('');
process.exit(1);
