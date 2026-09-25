'use strict';
// ════════════════════════════════════════════════════════════════
//  PIXEL PARTIES — MEHRFACHTREFFER-WÄCHTER (v1392, Als Auftrag 25.9.)
//
//  Schaden an mehreren Zielen in EINEM Schlag läuft über die EINE
//  Stelle der Engine:
//    • engine.dealDamageToTargets(quelle, ziele, opts)  /  ctx.dealDamageToTargets
//      (Helden/Kreaturen-Aufteilung, Brett-Wächter, Surprise- und
//      Hand-Reaktionen, Interference + Idol-Fenster, EIN Kreatur-Stapel)
//    • ctx.aoeHit(…) sammelt nach Seite ein und ruft dieselbe Stelle;
//    • wer seine Treffer sichtbar NACHEINANDER austeilt (Chain
//      Lightning, Flame Pillars), klammert mit `beginAoeStrike` —
//      das öffnet beide Fenster.
//  Siehe CARD_API.md ★ „SCHADEN AN MEHREREN ZIELEN".
//
//  Gemeldet wird jede rohe `beginMultiHit(`-Klammer in einem Kartenskript:
//  genau die Bauform, mit der bis v1391 Book of Doom, Gangster Angel,
//  Dark Deepsea God & Co. das Idol-Fenster oder die Brett-Wächter
//  verfehlten.
//
//  Aufruf: node scripts/check-aoe-central.js   (Exit 1 bei Verstoß)
// ════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'cards', 'effects');
const ERLAUBT = {
  '_engine.js': 'die Engine stellt die Klammer bereit',
  '_loader.js': 'erkennt die Klammer nur als Muster',
};
const RE = /\bbeginMultiHit\(/;

const befunde = [];
for (const f of fs.readdirSync(DIR).filter(f => f.endsWith('.js'))) {
  if (ERLAUBT[f]) continue;
  fs.readFileSync(path.join(DIR, f), 'utf8').split('\n').forEach((l, i) => {
    const t = l.trim();
    if (!t || t.startsWith('//') || t.startsWith('*')) return;
    if (RE.test(l)) befunde.push(`${f}:${i + 1}  rohe beginMultiHit-Klammer → engine.dealDamageToTargets (gleichzeitig) oder beginAoeStrike (nacheinander)`);
  });
}
if (befunde.length) {
  console.error(`[check-aoe-central] ${befunde.length} Verstoß/Verstöße:`);
  for (const b of befunde) console.error('  ' + b);
  process.exit(1);
}
console.log('[check-aoe-central] OK — Mehrfachtreffer laufen über dealDamageToTargets / beginAoeStrike.');
