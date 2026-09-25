'use strict';
// ════════════════════════════════════════════════════════════════
//  PIXEL PARTIES — ABLAGE→FELD-WÄCHTER (v1389, Als Vorgabe 25.9.)
//
//  Eine Creature kommt NUR über die EINE Stelle der Engine aus der
//  Ablage aufs Feld:
//    • engine.summonFromDiscard(pi, pileOwner, what, heroIdx, slotIdx,
//        { mode: 'summon' | 'place' | 'revive', … })
//    • oder, für eigene Inszenierungen, die Bausteine
//        engine.ablageEntnahme → (eigene Platzierung) →
//        engine.ablageLandung  (bei Fehlschlag engine.ablageRueckgabe)
//  Dort liegen Sperre („cannot be revived" / Ifrit), Lethe-Stempel,
//  das Signal `_summonedFromDiscard`, Heimkehr-Besitzer und SC-Zählung.
//  Siehe CARD_API.md ★ „AUS DER ABLAGE AUFS FELD".
//
//  Der Wächter meldet:
//   1. `takeFromPile(…, 'discard', …)` in einer Datei, die auch
//      Creatures aufs Brett bringt (summonCreatureWithHooks,
//      summonCreature, actionPlaceCreature, safePlaceInSupport,
//      _trackCard(…'support'…)) — bis v1388 der Weg, auf dem das
//      Signal mal gesetzt wurde und mal nicht.
//   2. Ein handgesetztes `_summonedFromDiscard: true` — das Signal
//      setzt ausschließlich die Engine.
//
//  Dateien, die die Ablage aus ANDEREN Gründen anfassen, stehen mit
//  Begründung in ERLAUBT.
//
//  Aufruf: node scripts/check-discard-summon.js   (Exit 1 bei Verstoß)
// ════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'cards', 'effects');

const ERLAUBT = {
  '_engine.js': 'die Engine ist die Ablage-Stelle selbst',
  'cool-repair.js': 'rüstet ein Artifact aus der Ablage aus, keine Creature',
  'future-tech-copy-device.js': 'mischt ein Artifact aus der Ablage ins Deck',
  'hipdall-protector-of-coolness.js': 'holt aus der Ablage auf die Hand',
  'the-shapeshifter.js': 'rüstet einen Helden aus der Ablage aus, keine Creature',
};

const RE_ENTNAHME = /takeFromPile\([^)]*'discard'/;
const RE_BRETT = /summonCreatureWithHooks\(|summonCreature\(|actionPlaceCreature\(|safePlaceInSupport\(|_trackCard\([^)]*'support'/;
const RE_SIGNAL = /_summonedFromDiscard\s*:\s*true/;

const befunde = [];
for (const f of fs.readdirSync(DIR).filter(f => f.endsWith('.js'))) {
  if (ERLAUBT[f]) continue;
  const zeilen = fs.readFileSync(path.join(DIR, f), 'utf8').split('\n');
  const code = (l) => { const t = l.trim(); return t && !t.startsWith('//') && !t.startsWith('*'); };
  const brett = zeilen.some(l => code(l) && RE_BRETT.test(l));
  zeilen.forEach((l, i) => {
    if (!code(l)) return;
    if (brett && RE_ENTNAHME.test(l)) befunde.push(`${f}:${i + 1}  eigene Ablage-Entnahme neben Brett-Platzierung → engine.summonFromDiscard / ablageEntnahme`);
    if (RE_SIGNAL.test(l)) befunde.push(`${f}:${i + 1}  handgesetztes _summonedFromDiscard → setzt die Engine (ablageLandung / summonFromDiscard)`);
  });
}

if (befunde.length) {
  console.error(`[check-discard-summon] ${befunde.length} Verstoß/Verstöße:`);
  for (const b of befunde) console.error('  ' + b);
  process.exit(1);
}
console.log('[check-discard-summon] OK — Creatures kommen nur über die Engine-Stelle aus der Ablage.');
