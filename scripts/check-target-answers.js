#!/usr/bin/env node
// ═══════════════════════════════════════════
//  WAECHTER: Antworten der Zielwahl sind IDs, keine Zielobjekte (v1172)
//
//  `promptEffectTarget` liefert die IDs der gewaehlten Ziele
//  (`'hero-1-0'`, `'equip-0-2-1'`). Wer die Antwort direkt wie ein
//  Zielobjekt liest (`wahl[0].heroIdx`), bekommt `undefined` — die Karte
//  bricht dann still ab. Genau so lagen „Ricochet" (v1150) und
//  „Alluring Light" (v1172).
//
//  Erlaubt ist:
//    • Rueckfuehrung ueber die angebotene Liste:  ziele.find(t => t.id === id)
//    • ein Helfer, dessen Name mit `zielVonAntwort` beginnt
//    • nur die ID lesen (String-Vergleich, `includes`, Weitergabe)
// ═══════════════════════════════════════════
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'cards', 'effects');
const FELDER = '\\.(?:heroIdx|slotIdx|cardInstance|owner|type)\\b';

let treffer = 0;
for (const datei of fs.readdirSync(DIR).filter(f => f.endsWith('.js')).sort()) {
  const text = fs.readFileSync(path.join(DIR, datei), 'utf8');
  if (!text.includes('promptEffectTarget')) continue;

  const re = /(?:const|let)\s+(\w+)\s*=\s*await\s+[\w.]*promptEffectTarget\(/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const varName = m[1];
    const rest = text.slice(m.index + m[0].length, m.index + m[0].length + 1600);
    if (/\.find\(\s*\w+\s*=>\s*\w+\.id\s*===/.test(rest)) continue;   // Rueckfuehrung da
    if (/zielVonAntwort\s*\(/.test(rest)) continue;                     // Helfer benutzt

    // Abgeleitete Variablen: `const x = Array.isArray(v) ? v[0] : v;` / `const x = v[0];`
    const namen = [varName];
    const abl = new RegExp(
      `(?:const|let)\\s+(\\w+)\\s*=\\s*(?:Array\\.isArray\\(${varName}\\)\\s*\\?\\s*${varName}\\[0\\]\\s*:\\s*${varName}|${varName}\\[0\\])`, 'g');
    let a;
    while ((a = abl.exec(rest)) !== null) namen.push(a[1]);

    for (const n of namen) {
      const zugriff = new RegExp(`\\b${n}(?:\\[0\\])?${FELDER}`);
      if (zugriff.test(rest)) {
        console.log(`  ${datei}: Antwort \`${varName}\` wird wie ein Zielobjekt gelesen (\`${n}\`)`);
        treffer++;
        break;
      }
    }
  }
}

if (treffer > 0) {
  console.log(`\n[check-target-answers] ${treffer} Stelle(n) — Antwort ueber \`ziele.find(t => t.id === id)\` zurueckfuehren.`);
  process.exit(1);
}
console.log('[check-target-answers] OK — jede Zielwahl-Antwort wird auf ihr Zielobjekt zurueckgefuehrt.');
