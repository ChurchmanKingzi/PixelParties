'use strict';
// ════════════════════════════════════════════════════════════════
//  PIXEL PARTIES — STATUS-VERURSACHER-WÄCHTER (v1399, Als Auftrag 25.9.)
//
//  Jeder negative Status trägt seinen Verursacher (Spieler, Held/Creature,
//  Karte). Gesetzt wird das zentral in addHeroStatus / actionAddStatus /
//  applyCreatureStatus. Schreibt ein Kartenskript einen NEGATIVEN
//  Status-Eintrag ausnahmsweise selbst (`hero.statuses.x = { … }`), muss
//  in den nächsten Zeilen `engine._heldenStatusVerursacher(…)` folgen.
//  Siehe CARD_API.md ★ „STATUS-VERURSACHER".
//
//  Aufruf: node scripts/check-status-verursacher.js   (Exit 1 bei Verstoß)
// ════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const { STATUS_EFFECTS } = require('../cards/effects/_hooks');
const DIR = path.join(__dirname, '..', 'cards', 'effects');
const NEGATIV = new Set(Object.entries(STATUS_EFFECTS || {}).filter(([, d]) => d?.negative).map(([k]) => k));
const RE = /\.statuses(?:\.([a-z_]+)|\[([A-Z_]+|'[a-z_]+')\])\s*=\s*\{/;
const befunde = [];
for (const f of fs.readdirSync(DIR).filter(f => f.endsWith('.js') && f !== '_engine.js' && f !== '_cpu.js')) {
  const L = fs.readFileSync(path.join(DIR, f), 'utf8').split('\n');
  L.forEach((l, i) => {
    const t = l.trim();
    if (t.startsWith('//') || t.startsWith('*')) return;
    const m = RE.exec(l);
    if (!m) return;
    const name = m[1] || (m[2] || '').replace(/'/g, '');
    // Konstante (STATUS_NAME, STATUS): unbekannt → prüfen; bekannter Name nur, wenn negativ.
    if (m[1] && !NEGATIV.has(name)) return;
    const danach = L.slice(i, i + 10).join('\n');
    if (/_heldenStatusVerursacher\(/.test(danach) || /\.\.\.fremd\.obj/.test(l)) return;
    befunde.push(`${f}:${i + 1}  „${name}" selbst geschrieben ohne engine._heldenStatusVerursacher`);
  });
}
if (befunde.length) {
  console.error(`[check-status-verursacher] ${befunde.length} Verstoß/Verstöße:`);
  for (const b of befunde) console.error('  ' + b);
  process.exit(1);
}
console.log(`[check-status-verursacher] OK — ${NEGATIV.size} negative Status, jeder Eintrag trägt seinen Verursacher.`);
