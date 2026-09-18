'use strict';
// ════════════════════════════════════════════════════════════════
//  PIXEL PARTIES — FLUG-ZIELFELDER (v1190, Als Befund 18.9.)
//
//  `play_pile_transfer` löst Quelle und Ziel über ZWEI getrennte
//  Feldsätze auf:
//
//      QUELLE:  from, fromOwner?, fromHeroIdx, fromSlotIdx, fromHandIdx, fromPermId
//      ZIEL:    to,   toOwner?,   toHeroIdx,   toSlotIdx,   toHandIdx
//
//  Und er steigt STILL aus, wenn eines der beiden Elemente nicht
//  gefunden wird (`if (!srcEl || !tgtEl) return;`). Wer beim Ziel die
//  Quellnamen schreibt — `heroIdx` statt `toHeroIdx`, `zoneSlot` statt
//  `toSlotIdx` —, bekommt also GAR KEINE Bewegung: kein Fehler, keine
//  Meldung, die Karte erscheint einfach ohne Flug an ihrem Platz.
//  Aufgelaufen sind daran „Tempeluna" und „???, the Shapeshifter".
//
//  Dieser Wächter prüft jedes `play_pile_transfer` mit einem
//  BRETT-Ziel (support / ability / surprise / hero) darauf, dass die
//  nötigen `to*`-Felder gesetzt sind.
//
//  Aufruf:  node scripts/check-flight-targets.js
//  Rückgabe 0 = sauber, 1 = Flüge ohne auflösbares Ziel.
// ════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');

const EFFEKTE = path.join(__dirname, '..', 'cards', 'effects');

// Brett-Ziele und die Felder, ohne die der Handler sie nicht findet.
const ZIELFELDER = {
  support:  ['toHeroIdx', 'toSlotIdx'],
  ability:  ['toHeroIdx', 'toSlotIdx'],
  surprise: ['toHeroIdx'],
  hero:     ['toHeroIdx'],
};

function stripKommentare(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');
}

const fehlt = [];
for (const datei of fs.readdirSync(EFFEKTE).filter(f => f.endsWith('.js'))) {
  const src = stripKommentare(fs.readFileSync(path.join(EFFEKTE, datei), 'utf8'));
  for (const m of src.matchAll(/_broadcastEvent\(\s*'play_pile_transfer'\s*,\s*\{([\s\S]*?)\}\s*\)/g)) {
    const block = m[1];
    const zielM = block.match(/\bto:\s*'(\w+)'/);
    if (!zielM) continue;
    const ziel = zielM[1];
    const noetig = ZIELFELDER[ziel];
    if (!noetig) continue;                       // Stapel-Ziele brauchen nichts
    const offen = noetig.filter(k => !new RegExp(`\\b${k}\\s*:`).test(block));
    if (offen.length === 0) continue;
    // Häufigster Fehlgriff: die QUELLnamen am Ziel.
    const verwechselt = /\bheroIdx\s*:/.test(block) || /\bzoneSlot\s*:/.test(block)
      || /(^|[,{\s])slotIdx\s*:/.test(block);
    fehlt.push(`  ✗ ${datei} — to: '${ziel}' ohne ${offen.join(' / ')}`
      + (verwechselt ? '  (sieht nach Quellnamen am Ziel aus)' : ''));
  }
}

if (fehlt.length) {
  console.error('[check-flight-targets] ✖ Flüge ohne auflösbares Ziel:\n');
  for (const z of fehlt) console.error(z);
  console.error('\n  Quelle und Ziel haben GETRENNTE Feldsätze:');
  console.error('    from… : fromHeroIdx, fromSlotIdx, fromHandIdx, fromPermId');
  console.error('    to…   : toHeroIdx,   toSlotIdx,   toHandIdx');
  console.error('  Fehlt das Zielelement, bricht der Handler STILL ab —');
  console.error('  die Karte erscheint ohne Bewegung (siehe CARD_API).\n');
  process.exit(1);
}
console.log('[check-flight-targets] ✓ alle Brett-Flüge nennen ihr Ziel vollständig.');
process.exit(0);
