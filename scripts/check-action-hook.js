#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════
//  WÄCHTER: `onAnyActionResolved` IN JEDEM AKTIONSWEG (v1284)
//
//  Das Fenster ist der Sammelpunkt ALLER Aktionswege. Karten, die
//  Ereignisse während eines Flächentreffers nur vormerken und danach
//  einlösen (Pseudonia, Elixir of Immortality), hängen daran: fehlt es
//  in einem Weg, wartet die Wirkung bis zum nächsten Zauber oder bis
//  zum Zugende (Als Befund 22.9.: „Book of Doom tötet einen Helden,
//  Pseudonia reagiert nicht").
//
//  Geprüft wird, dass jede der unten genannten Server-Funktionen das
//  Fenster in ihrem eigenen Rumpf feuert.
//
//  Aufruf: node scripts/check-action-hook.js   (0 = sauber, 1 = Fund)
// ════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs');
const path = require('path');
const quelle = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const zeilen = quelle.split('\n');

const WEGE = [
  'doPlaySpell', 'doPlayCreature', 'doActivateAbility',
  'doUseArtifactEffect', 'doUsePotion',
  // v1285: ZIELENDE Artefakte und Tränke lösen hier auf (Book of Doom).
  'doConfirmPotion',
];

function rumpf(name) {
  const start = zeilen.findIndex(z => new RegExp(`^async function ${name}\\(`).test(z));
  if (start < 0) return null;
  for (let i = start + 1; i < zeilen.length; i++) {
    if (zeilen[i] === '}') return zeilen.slice(start, i + 1).join('\n');
  }
  return zeilen.slice(start).join('\n');
}

const funde = [];
for (const name of WEGE) {
  const code = rumpf(name);
  if (code == null) { funde.push(`${name}: Funktion nicht gefunden`); continue; }
  if (!code.includes("runHooks('onAnyActionResolved'")) funde.push(`${name}: feuert 'onAnyActionResolved' nicht`);
}
if (funde.length) {
  console.error(`[check-action-hook] ${funde.length} Fund(e):`);
  for (const f of funde) console.error('  ✗ ' + f);
  process.exit(1);
}
console.log(`[check-action-hook] sauber — ${WEGE.length} Aktionswege feuern 'onAnyActionResolved'.`);
