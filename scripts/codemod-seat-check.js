#!/usr/bin/env node
'use strict';
// ════════════════════════════════════════════════════════════════
//  CODEMOD — „gültiger Spielerindex" (x === 0 || x === 1) → isSeat(gs, x)
//
//  Viele Stellen prüfen, ob ein Wert ein Spielerindex ist, so:
//      (heroOwner === 0 || heroOwner === 1) ? heroOwner : pi
//  Mit mehr als zwei Sitzen (Skill Test) fallen die Sitze 2–7 durch und
//  der Wert wird still durch den Wirker ersetzt (Zielwahl trifft den
//  falschen Helden …). `isSeat(gs, x)` (cards/effects/_opp.js) ist im
//  Normalspiel bit-identisch (`gs.players.length === 2`), im Skill Test
//  gilt jeder Sitz.
//
//  Das Skript ersetzt nur Fundstellen, die als EIGENER Operand stehen
//  (Klammer/Zuweisung/return davor, Klammer/?/;/,/Zeilenende dahinter) —
//  so ändert sich die Operator-Präzedenz nie. Übrige Fundstellen werden
//  gemeldet. Als Zustandsobjekt dient der nächste deklarierte Name
//  (`gs`, sonst `engine`, in der Engine-Klasse `this`).
//
//    node scripts/codemod-seat-check.js          # anwenden
//    node scripts/codemod-seat-check.js --dry    # nur zählen/melden
// ════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DRY = process.argv.includes('--dry');
// Zwei-Spieler-Inseln (siehe scripts/n-player-allow.json) bleiben unangetastet.
const SKIP = new Set(['_cpu.js', '_sc-tracking.js', '_train-recorder.js', '_deck-profile.js', '_decision-log.js', '_demo-recorder.js', '_opp.js']);

const EXPR = String.raw`([A-Za-z_$][\w$]*(?:\??\.[\w$]+|\[[^\]]+\])*)`;
const EQ = new RegExp(EXPR + String.raw`\s*===\s*0\s*\|\|\s*\1\s*===\s*1`, 'g');
const NE = new RegExp(EXPR + String.raw`\s*!==\s*0\s*&&\s*\1\s*!==\s*1`, 'g');

const BEFORE_OK = /(?:\(|=\s|return\s|\?\s|:\s|\[|,\s|!\()$/;
const AFTER_OK = /^(?:\)|\s*\?|\s*;|\s*,|\s*\]|\s*$)/;

/** Welches Zustandsobjekt ist an Zeile `lineIdx` greifbar? */
function stateExpr(lines, lineIdx, file) {
  const from = Math.max(0, lineIdx - 400);
  const win = lines.slice(from, lineIdx + 1).join('\n');
  if (/\b(?:const|let|var)\s+gs\b|\(\s*gs\b|\bgs\s*[,)]|\{\s*gs\b|,\s*gs\b|\bgs\s*=\s*/.test(win)) return 'gs';
  if (/\b(?:const|let|var)\s+engine\b|\(\s*engine\b|\bengine\s*[,)]|\{\s*engine\b|,\s*engine\b/.test(win)) return 'engine';
  if (path.basename(file) === '_engine.js') return 'this';
  return null;
}

function processFile(file) {
  const src = fs.readFileSync(file, { encoding: 'utf-8' });
  const lines = src.split('\n');
  let count = 0;
  const skipped = [];
  let out = src;
  // Zeilenweise, damit wir das Zustandsobjekt je Zeile bestimmen können.
  const newLines = lines.map((line, idx) => {
    let changed = line;
    for (const [re, neg] of [[EQ, false], [NE, true]]) {
      changed = changed.replace(re, (m, x, offset, whole) => {
        const before = whole.slice(0, offset);
        const after = whole.slice(offset + m.length);
        if (!BEFORE_OK.test(before) || !AFTER_OK.test(after)) { skipped.push(`${path.relative(ROOT, file)}:${idx + 1}: ${line.trim().slice(0, 120)}`); return m; }
        const st = stateExpr(lines, idx, file);
        if (!st) { skipped.push(`${path.relative(ROOT, file)}:${idx + 1} (kein gs/engine greifbar): ${line.trim().slice(0, 100)}`); return m; }
        count++;
        // `!(`-Präfix: `!(x !== 0 && x !== 1)` bleibt gültig (`!(!isSeat(...))`).
        return (neg ? '!' : '') + `isSeat(${st}, ${x})`;
      });
    }
    return changed;
  });
  if (!count) return { count: 0, skipped };
  out = newLines.join('\n');
  // Import ergänzen.
  const isServer = path.basename(file) === 'server.js';
  const reqPath = isServer ? './cards/effects/_opp' : './_opp';
  const existing = out.match(new RegExp(String.raw`const \{([^}]*)\} = require\('${reqPath.replace(/[./]/g, m => '\\' + m)}'\);`));
  if (existing) {
    if (!/\bisSeat\b/.test(existing[1])) out = out.replace(existing[0], existing[0].replace('{', '{ isSeat,'));
  } else {
    const use = out.match(/^(['"])use strict\1;?\n/m);
    const decl = `const { isSeat } = require('${reqPath}');   // N-Spieler: gültiger Sitzindex\n`;
    if (use) out = out.replace(use[0], use[0] + decl);
    else out = decl + out;
  }
  if (!DRY) fs.writeFileSync(file, out, { encoding: 'utf-8' });
  return { count, skipped };
}

const files = fs.readdirSync(path.join(ROOT, 'cards', 'effects'))
  .filter(f => f.endsWith('.js') && !SKIP.has(f)).map(f => path.join(ROOT, 'cards', 'effects', f));
files.push(path.join(ROOT, 'server.js'));

let total = 0; const allSkipped = [];
for (const f of files) {
  const r = processFile(f);
  total += r.count; allSkipped.push(...r.skipped);
}
console.log(`${DRY ? '[dry] ' : ''}${total} Stelle(n) umgestellt.`);
if (allSkipped.length) { console.log(`${allSkipped.length} nicht automatisch umgestellt:`); allSkipped.forEach(s => console.log('  ' + s)); }
