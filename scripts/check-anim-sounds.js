'use strict';
// ════════════════════════════════════════════════════════════════
//  PIXEL PARTIES — JEDE ANIMATION BRAUCHT EINEN KLANG
//
//  Jede Zonen-Animation in `ANIM_REGISTRY` (public/app-board.jsx) muss einen Eintrag in `ZONE_ANIM_SFX`
//  (public/app-shared.jsx) mit echtem Klang haben (nicht `null`). Eine neue Animation OHNE Klang lässt den
//  Test durchfallen.
//
//  Altbestand: `scripts/anim-sounds-baseline.json` listet die Animationen, die schon vor dem Test stumm waren.
//  Das ist eine Ratsche, kein Freibrief:
//    • neue stumme Animation            → FEHLER (Klang eintragen!)
//    • Baseline-Eintrag hat jetzt Klang
//      oder die Animation gibt es nicht
//      mehr                              → FEHLER (Eintrag aus der Baseline streichen:
//                                          `node scripts/check-anim-sounds.js --update`)
//  Die Baseline darf also nur schrumpfen.
//
//  Aufruf:  node scripts/check-anim-sounds.js [--update]
//  Rückgabe 0 = sauber, 1 = Verstöße.
// ════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const board = fs.readFileSync(path.join(ROOT, 'public', 'app-board.jsx'), 'utf8');
const shared = fs.readFileSync(path.join(ROOT, 'public', 'app-shared.jsx'), 'utf8');
const BASELINE = path.join(__dirname, 'anim-sounds-baseline.json');

/** Text des Objektliterals, das nach `anker` beginnt (bis zur schließenden Klammer in Spalte 0). */
function block(text, anker) {
  const a = text.indexOf(anker);
  if (a < 0) throw new Error(`Anker nicht gefunden: ${anker}`);
  const start = text.indexOf('{', a);
  const ende = text.indexOf('\n};', start);
  return text.slice(start, ende);
}

// Registry-Schlüssel: Zeilen mit genau zwei Leerzeichen Einzug `  name:` bzw. `  'name':`
const registry = new Set([...block(board, 'const ANIM_REGISTRY = ').matchAll(/^ {2}(?:'([\w-]+)'|([A-Za-z_][\w]*))\s*:/gm)].map(m => m[1] || m[2]));

// Klang-Einträge: Schlüssel → Wert (erste Zeile). `null` = stumm.
const klang = new Map();
for (const m of block(shared, 'const ZONE_ANIM_SFX = ').matchAll(/^ {2}(?:'([\w-]+)'|([A-Za-z_][\w]*))\s*:\s*(.*)$/gm)) {
  klang.set(m[1] || m[2], m[3].trim());
}
const hatKlang = (k) => klang.has(k) && !/^null\b/.test(klang.get(k));

const stumm = [...registry].filter(k => !hatKlang(k)).sort();

if (process.argv.includes('--update')) {
  fs.writeFileSync(BASELINE, JSON.stringify({ stumm }, null, 2) + '\n', 'utf8');
  console.log(`[check-anim-sounds] Baseline geschrieben: ${stumm.length} stumme Animationen.`);
  process.exit(0);
}

let basis = [];
try { basis = JSON.parse(fs.readFileSync(BASELINE, 'utf8')).stumm || []; } catch { basis = []; }
const basisSet = new Set(basis);

const neu = stumm.filter(k => !basisSet.has(k));
const erledigt = basis.filter(k => !stumm.includes(k));

if (neu.length || erledigt.length) {
  if (neu.length) {
    console.error('[check-anim-sounds] ✖ Animationen OHNE Klang (ZONE_ANIM_SFX in app-shared.jsx ergänzen):\n');
    for (const k of neu) console.error(`  ✗ ${k}`);
  }
  if (erledigt.length) {
    console.error('\n[check-anim-sounds] ✖ Diese Baseline-Einträge haben jetzt einen Klang (oder es gibt die Animation nicht mehr) — aus der Baseline streichen (`--update`):\n');
    for (const k of erledigt) console.error(`  ✓ ${k}`);
  }
  process.exit(1);
}
console.log(`[check-anim-sounds] ${registry.size} Animationen, alle mit Klang außer ${stumm.length} Altfälle (Baseline darf nur schrumpfen).`);
