#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════
//  WÄCHTER: VARIABLE KOSTEN TRAGEN IHR KOSTENLABEL
//
//  ANLASS (19.10., Als Vorgabe): Manche Artifacts haben MODULARE Kosten —
//  Beer „4X", Dark Gear „5X", Cool Repair einfach „X" —, auf der Karte,
//  im Tooltip und bei `!show` / `!card` im Discord-Bot soll das auch so
//  stehen. `cards.json` führt dafür neben der Zahl in `cost` (die der
//  Server weiter rechnet) das Feld `costLabel`; Karte, Tooltips und Bot
//  zeigen es statt der Zahl. Vergisst man es bei einer NEUEN Karte mit
//  variablen Kosten, steht dort still eine falsche feste Zahl.
//
//  Geprüft wird:
//
//    1. SKRIPT MIT `manualGoldCost: true` → die Karte trägt ein
//       `costLabel` (das Skript rechnet den Preis selbst; die Zahl in
//       `cost` ist dann nur Grundwert oder Platzhalter).
//
//    2. FORMAT — `costLabel` ist „nX" oder „X" (n = Ganzzahl > 0) und
//       steht nur an Artifacts mit `cost`.
//
//    3. ZAHL PASST — bei „nX" ist n gleich `cost`; die Server-Rechnung
//       multipliziert diese Zahl.
//
//  Bedingte Auf- und Abschläge (Cool Cheese, Cute Camera, Laser Cannon,
//  Master's Key …) behalten ihren festen Grundpreis und brauchen kein
//  Label. Karten, deren Kosten sich nur im Kartentext ändern, aber kein
//  Skript mit `manualGoldCost` haben (Possessed Blade, Tool Freezer,
//  Future Tech Copy Device), tragen es trotzdem — sie stehen in
//  `EXTRA_VARIABEL` unten.
//
//  Aufruf:  node scripts/check-cost-label.js
//  Rückgabe 0 = sauber, 1 = mindestens ein Mangel.
// ════════════════════════════════════════════════════════════════
'use strict';

const fs = require('fs');
const path = require('path');

const WURZEL = path.join(__dirname, '..');
const EFFEKTE = path.join(WURZEL, 'cards', 'effects');
const KARTEN = path.join(WURZEL, 'data', 'cards.json');

// Variable Kosten ohne `manualGoldCost` im Skript (Preis hängt vom Kartentext ab, nicht von einer Eigenrechnung).
const EXTRA_VARIABEL = new Set([
  'Possessed Blade of Sinister Vengeance',   // Kosten × Anzahl der Abilities am Helden
  'Tool Freezer',                            // doppelte Kosten des negierten Artifacts
  'Future Tech Copy Device',                 // Kosten des kopierten Future-Tech-Artifacts
]);

/** Kartenname → Dateiname, identisch zu `nameToFile` im Loader. */
function nameZuDatei(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** Kommentare raus — geprüft wird nur CODE (wie in `_loader.js`). */
function ohneKommentare(src) {
  return String(src || '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/([^:'"`])\/\/.*$/gm, '$1');
}

const karten = JSON.parse(fs.readFileSync(KARTEN, 'utf8'));
const maengel = [];
let geprueft = 0;

for (const karte of karten) {
  const label = karte.costLabel;

  // 2. Format und Ort
  if (label != null) {
    if (karte.cardType !== 'Artifact' || karte.cost == null) {
      maengel.push(`${karte.name}: costLabel „${label}" steht an einer Karte ohne Artifact-Kosten.`);
    }
    if (!/^([1-9]\d*)?X$/.test(String(label))) {
      maengel.push(`${karte.name}: costLabel „${label}" hat nicht die Form „nX" oder „X".`);
    } else {
      // 3. Zahl passt
      const n = String(label).slice(0, -1);
      if (n !== '' && Number(n) !== karte.cost) {
        maengel.push(`${karte.name}: costLabel „${label}", aber cost ist ${karte.cost} — der Faktor muss gleich cost sein.`);
      }
    }
  }

  // 1. Skript mit manualGoldCost → Label
  const datei = path.join(EFFEKTE, nameZuDatei(karte.name) + '.js');
  const rechnetSelbst = fs.existsSync(datei) && /\bmanualGoldCost\s*:\s*true\b/.test(ohneKommentare(fs.readFileSync(datei, 'utf8')));
  if (karte.cardType === 'Artifact' && (rechnetSelbst || EXTRA_VARIABEL.has(karte.name))) {
    geprueft++;
    if (label == null) {
      maengel.push(`${karte.name}: ${rechnetSelbst ? 'das Skript rechnet den Preis selbst (manualGoldCost)' : 'variable Kosten (EXTRA_VARIABEL)'}, aber cards.json hat kein costLabel.`);
    }
  }
}

if (maengel.length) {
  console.error('[check-cost-label] ' + maengel.length + ' Mangel/Mängel:');
  for (const m of maengel) console.error('  • ' + m);
  process.exit(1);
}
console.log(`[check-cost-label] sauber — ${geprueft} Artifacts mit variablen Kosten tragen ihr costLabel.`);
