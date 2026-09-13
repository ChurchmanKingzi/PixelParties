// ════════════════════════════════════════════════════════════════
//  WÄCHTER: STUFE AUS DER DATENBANK STATT AUS DER INSTANZ
//
//  Eine Karte auf dem Brett kann eine ANDERE Identität tragen als ihr
//  Datenbankeintrag — `counters._cardDataOverride`:
//    • „Inconspicuous Lawn Gnome" setzt seine Stufe frei auf 0–3,
//    • „Boulder in a Bottle" ist als Potion getrackt und auf dem Brett
//      eine Lv-3-Kreatur,
//    • Biomancy-Token tragen den Namen der zugrundeliegenden Potion.
//
//  Wer in so einem Fall `cardDB[inst.name].level` liest — direkt oder
//  über `effectiveCardLevel(cardDB[inst.name], …)` ohne `inst` —
//  rechnet mit der GEDRUCKTEN Stufe. Genau daran lasen Garius und
//  Brackle den Gnom falsch (Als Befund 12.9.).
//
//  RICHTIG ist eins von beiden:
//    engine.getEffectiveCardData(inst).level
//    engine.effectiveCardLevel(cd, pi, { …, inst })     ← seit v989
//
//  GEPRÜFT WIRD: Kartenskripte, die eine Kartendatenbank mit
//  `…inst.name` nachschlagen und das Ergebnis in einem Atemzug nach
//  `.level` fragen oder an `effectiveCardLevel` reichen, ohne die
//  Instanz mitzugeben.
//
//  Aufruf:  node scripts/check-level-source.js
//  Rückgabe 0 = sauber, 1 = mindestens ein Verdachtsfall.
// ════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

const WURZEL = path.join(__dirname, '..');
const EFFEKTE = path.join(WURZEL, 'cards', 'effects');

/** Kommentare raus — geprüft wird nur CODE. */
function ohneKommentare(src) {
  return String(src || '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/([^:'"`])\/\/.*$/gm, '$1');
}

// (1) `cardDB[…inst.name]…level` in EINEM Ausdruck.
const DIREKT = /(?:cardDB|_getCardDB\(\))\s*\[\s*[A-Za-z_$][\w$]*[Ii]nst(?:ance)?\.name\s*\][^;\n]{0,40}\.level/;
// (2) `effectiveCardLevel(<…inst.name-Lookup>, …)` ohne `inst`.
const UEBER_HELFER = /effectiveCardLevel\(\s*(?:cardDB|[A-Za-z_$][\w$]*\._getCardDB\(\))\s*\[\s*[A-Za-z_$][\w$]*[Ii]nst(?:ance)?\.name\s*\][^)]*\)/g;

const verdacht = [];
for (const datei of fs.readdirSync(EFFEKTE)) {
  if (!datei.endsWith('.js')) continue;
  if (datei === '_engine.js') continue;            // die Quelle selbst
  const voll = path.join(EFFEKTE, datei);
  const code = ohneKommentare(fs.readFileSync(voll, 'utf8'));
  const zeilen = code.split('\n');

  for (let i = 0; i < zeilen.length; i++) {
    // Direktzugriff, ein- oder zweizeilig zusammengesetzt.
    const fenster = zeilen.slice(i, i + 2).join(' ');
    if (DIREKT.test(fenster)) {
      verdacht.push({ datei, zeile: i + 1, art: 'cardDB[inst.name].level' });
      continue;
    }
  }
  // Helferaufrufe über mehrere Zeilen zusammengezogen prüfen.
  const flach = code.replace(/\n/g, ' ');
  for (const treffer of flach.match(UEBER_HELFER) || []) {
    if (/\binst\b\s*[,}]|inst\s*:/.test(treffer)) continue;   // gibt die Instanz mit
    verdacht.push({ datei, zeile: null, art: 'effectiveCardLevel(cardDB[inst.name], …) ohne inst' });
  }
}

if (verdacht.length === 0) {
  console.log('[check-level-source] OK — keine Stufe aus der Datenbank, wo eine Instanz vorliegt.');
  process.exit(0);
}

console.log(`[check-level-source] ${verdacht.length} Verdachtsfall/-fälle:\n`);
for (const v of verdacht) {
  console.log(`  ✗ ${v.datei}${v.zeile ? ':' + v.zeile : ''}`);
  console.log(`      · ${v.art}`);
}
console.log('\n  Richtig: `getEffectiveCardData(inst).level` oder');
console.log('  `effectiveCardLevel(cd, pi, { …, inst })` — sonst gilt die');
console.log('  GEDRUCKTE Stufe statt der aktuellen.');
process.exit(1);
