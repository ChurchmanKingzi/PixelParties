'use strict';
// ════════════════════════════════════════════════════════════════
//  PIXEL PARTIES — DECK→FELD-WÄCHTER (v1393, Als Auftrag 25.9.)
//
//  Eine Creature kommt NUR über die EINE Stelle der Engine aus dem Deck
//  aufs Feld:
//    • engine.summonFromDeck(pi, what, heroIdx, slotIdx, { mode, … })
//    • oder die Bausteine engine.deckEntnahme → (eigene Platzierung) →
//      engine.deckLandung / Hook-Extras engine.deckHookExtras()
//      (bei Fehlschlag engine.deckRueckgabe)
//  Dort liegen Deck-Sperren, Mischen, Flug und das Signal
//  `_summonedFromDeck` (Cosmic Manipulation). Siehe CARD_API.md ★ „AUS
//  DEM DECK AUFS FELD".
//
//  Gemeldet werden: eigenes `takeFromPile(…, 'deck', …)` in einer Datei,
//  die Creatures aufs Brett bringt, und jedes handgesetzte
//  `_summonedFromDeck: true`. Dateien, die das Deck aus anderen Gründen
//  anfassen, stehen mit Begründung in ERLAUBT.
//
//  Aufruf: node scripts/check-deck-summon.js   (Exit 1 bei Verstoß)
// ════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'cards', 'effects');

const ERLAUBT = {
  '_engine.js': 'die Engine ist die Deck-Stelle selbst',
  '_crusader-shared.js': 'Deck → Ablage (Crusader-Kosten), keine Creature aufs Feld',
  '_idej-shared.js': 'rüstet Idej-Karten aus dem Deck aus, keine Beschwörung',
  'bill-the-angry-auctioneer.js': 'rüstet ein Artifact aus dem Deck aus',
  'criminal-monkee.js': 'Deck → Ablage',
  'cute-annoyance-mini.js': 'Deck → Hand (Suche)',
  'deepsea-treasure.js': 'Deck → Hand (Suche)',
  'hel-the-bound-specter.js': 'rüstet Hel aus dem Deck aus',
  'legendary-explorer-dajan.js': 'Deck → Ablage/Hand',
  'life-searcher-from-the-cosmic-depths.js': 'Deck → Hand (Suche); die Beschwörung läuft über deckEntnahme',
  'overcharge.js': 'rüstet ein Artifact aus dem Deck aus, keine Creature',
  'the-shapeshifter.js': 'rüstet einen Helden aus dem Deck aus',
  'thrysh-robber-of-coolness.js': 'Deck/Coolness Stack → Hand',
  'trapping.js': 'legt eine Surprise aus dem Deck in die Surprise-Zone',
  'treasure-hunter-s-backpack.js': 'rüstet ein Artifact aus dem Deck aus',
};

const RE_ENTNAHME = /takeFromPile\([^)]*'deck'/;
const RE_BRETT = /summonCreatureWithHooks\(|summonCreature\(|actionPlaceCreature\(|safePlaceInSupport\(|_trackCard\([^)]*'support'/;
const RE_SIGNAL = /_summonedFromDeck\s*:\s*true/;

const befunde = [];
for (const f of fs.readdirSync(DIR).filter(f => f.endsWith('.js'))) {
  if (ERLAUBT[f]) continue;
  const zeilen = fs.readFileSync(path.join(DIR, f), 'utf8').split('\n');
  const code = (l) => { const t = l.trim(); return t && !t.startsWith('//') && !t.startsWith('*'); };
  const brett = zeilen.some(l => code(l) && RE_BRETT.test(l));
  zeilen.forEach((l, i) => {
    if (!code(l)) return;
    if (brett && RE_ENTNAHME.test(l)) befunde.push(`${f}:${i + 1}  eigene Deck-Entnahme neben Brett-Platzierung → engine.summonFromDeck / deckEntnahme`);
    if (RE_SIGNAL.test(l)) befunde.push(`${f}:${i + 1}  handgesetztes _summonedFromDeck → setzt die Engine (deckHookExtras / summonFromDeck)`);
  });
}

if (befunde.length) {
  console.error(`[check-deck-summon] ${befunde.length} Verstoß/Verstöße:`);
  for (const b of befunde) console.error('  ' + b);
  process.exit(1);
}
console.log('[check-deck-summon] OK — Creatures kommen nur über die Engine-Stelle aus dem Deck.');
