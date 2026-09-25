'use strict';
// ════════════════════════════════════════════════════════════════
//  PIXEL PARTIES — HAND-ZUGANGS-WÄCHTER (v1395, Als Auftrag 25.9.)
//
//  Karten kommen NUR über die Engine in die Hand:
//    • Suche im Deck:        engine.addFromPileToHand(pi, 'deck', …) /
//                            takeFromPile(…, { toHand: true }) + handZugang({ von: 'deck' })
//    • aus der Ablage:       engine.addFromPileToHand(pi, 'discard', …) /
//                            takeFromPile(…, { toHand: true }) + handZugang({ von: 'ablage' })
//    • Rückgabe/Bounce/neu:  engine.handZugangSync(pi, name, { von, … })
//    • an eine Stelle:       engine.returnToPile(pi, 'hand', name, idx)
//  Dort liegen Hand-Instanz, Auto-Aufdecken, Log, Abgleich und die Such-
//  Hooks (ON_CARD_ADDED_TO_HAND / …_FROM_DISCARD_TO_HAND). Bis v1394
//  schoben ~80 Module selbst per `hand.push` — ohne Instanz, ohne Hooks,
//  teils an der Such-Sperre vorbei.
//
//  Gemeldet wird jedes `.hand.push(` in einem Kartenskript. Ausgenommen:
//  die Engine selbst und CPU-Rollouts, die eine SIMULIERTE Hand ohne
//  Engine-Logik durchspielen (Begründung in ERLAUBT).
//
//  Aufruf: node scripts/check-hand-push.js   (Exit 1 bei Verstoß)
// ════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'cards', 'effects');
const ERLAUBT = {
  '_engine.js': 'die Engine ist die Hand-Stelle selbst',
  '_cpu.js': 'Was-wäre-wenn-Bewertung (sofort zurückgesetzt)',
  'smuggler-s-pier.js': 'CPU-Rollout auf der simulierten Engine',
  'soul-shard-ren.js': 'CPU-Was-wäre-wenn-Bewertung (push + sofort pop, keine Engine-Logik)',
};
const RE = /\.hand\.push\(/;
const befunde = [];
for (const f of fs.readdirSync(DIR).filter(f => f.endsWith('.js'))) {
  if (ERLAUBT[f]) continue;
  fs.readFileSync(path.join(DIR, f), 'utf8').split('\n').forEach((l, i) => {
    const t = l.trim();
    if (!t || t.startsWith('//') || t.startsWith('*')) return;
    if (RE.test(l)) befunde.push(`${f}:${i + 1}  direktes hand.push → engine.handZugang(Sync) / addFromPileToHand / returnToPile`);
  });
}
if (befunde.length) {
  console.error(`[check-hand-push] ${befunde.length} Verstoß/Verstöße:`);
  for (const b of befunde) console.error('  ' + b);
  process.exit(1);
}
console.log('[check-hand-push] OK — Karten kommen nur über die Engine in die Hand.');
