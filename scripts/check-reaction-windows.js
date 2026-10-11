// ════════════════════════════════════════════════════════════════
//  WÄCHTER: HAND-REAKTIONSFENSTER MÜSSEN IM „GEGNER WARTET"-MANTEL STECKEN
//
//  Während ein Spieler eine Hand-Reaktion auflöst (Punch in the Box, Fireshield …),
//  meldet der Server dem anderen Client `reactionBusy` — der zeigt „Waiting for
//  opponent…" und sperrt das Brett (Als Befund: ohne das wirkte das Brett frei
//  bedienbar, jede Eingabe verpuffte). Die Meldung hängt an einem Mantel, den die
//  Engine am Dateiende per NAMENSMUSTER um ihre Fenster-Methoden legt:
//      /^_check\w*Reactions$/   und   _preDefeatFensterSeite
//
//  Ein neues Fenster, das ein `_handReactionWindow: true`-Prompt öffnet, aber unter
//  einem anderen Namen steht, bliebe dabei stumm. Dieser Wächter findet es.
//
//  Aufruf:  node scripts/check-reaction-windows.js
//  Rückgabe 0 = sauber, 1 = mindestens ein Fenster außerhalb des Mantels.
// ════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs');
const path = require('path');

const quelle = fs.readFileSync(path.join(__dirname, '..', 'cards', 'effects', '_engine.js'), 'utf8').split('\n');
const KOPF = /^  (?:async )?([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{\s*$/;
const GEDECKT = (n) => /^_check\w*Reactions$/.test(n) || n === '_preDefeatFensterSeite';
// `promptGeneric` selbst wertet das Flag nur aus (kein Fenster).
const AUSGENOMMEN = new Set(['promptGeneric', 'resolveGenericPrompt']);

let methode = null;
const lose = new Map();
for (let i = 0; i < quelle.length; i++) {
  const m = quelle[i].match(KOPF);
  if (m && !/^(if|for|while|switch|catch|function)$/.test(m[1])) methode = m[1];
  if (/^\s*_handReactionWindow\s*:\s*true/.test(quelle[i]) || /\b_handReactionWindow\s*:\s*true\b/.test(quelle[i])) {
    if (!methode || GEDECKT(methode) || AUSGENOMMEN.has(methode)) continue;
    if (!lose.has(methode)) lose.set(methode, []);
    lose.get(methode).push(i + 1);
  }
}
if (lose.size) {
  console.log('[check-reaction-windows] Fenster außerhalb des Mantels (kein „Waiting for opponent" beim Gegner):');
  for (const [n, zeilen] of lose) console.log(`  ${n}  — Zeile ${zeilen.join(', ')}`);
  console.log('  → Methode nach dem Muster /^_check\\w*Reactions$/ benennen oder den Mantel am Dateiende erweitern.');
  process.exit(1);
}
console.log('[check-reaction-windows] OK — alle Hand-Reaktionsfenster liegen im Mantel.');
