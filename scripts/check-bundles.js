#!/usr/bin/env node
// ═══════════════════════════════════════════
//  BUNDLE-WAECHTER
//
//  Anlass (18.8., v496): das v495-Paket enthielt ein VERALTETES
//  `public/dist/app-board.js`. Die Quelle hatte beide Fixes der Runde,
//  das gebuendelte Artefakt nur einen halben — Al testete dadurch
//  Verhalten, das ich Stunden vorher schon behoben hatte, und beide
//  Fehlerberichte waren die logische Folge.
//
//  Dieses Skript stellt sicher, dass so etwas auffaellt, BEVOR ein
//  Paket rausgeht: es baut frisch und vergleicht byteweise gegen das,
//  was gerade in `public/dist/` liegt. Jede Abweichung ist ein Fehler.
// ═══════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'public', 'dist');

const vorher = {};
for (const f of fs.readdirSync(DIST).filter(f => f.endsWith('.js'))) {
  vorher[f] = fs.readFileSync(path.join(DIST, f));
}

execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'build.js'), '--force'],
  { cwd: ROOT, stdio: 'ignore' });

let abweichungen = 0;
for (const f of Object.keys(vorher)) {
  const jetzt = fs.readFileSync(path.join(DIST, f));
  if (!vorher[f].equals(jetzt)) {
    console.error(`[check-bundles] VERALTET: public/dist/${f} entsprach der Quelle nicht`);
    abweichungen++;
  }
}
if (abweichungen > 0) {
  console.error(`[check-bundles] ${abweichungen} Bundle(s) waren veraltet — jetzt neu gebaut. NICHT paketieren, ohne die frischen Dateien mitzunehmen.`);
  process.exit(1);
}
console.log(`[check-bundles] ${Object.keys(vorher).length} Bundles entsprechen der Quelle.`);
