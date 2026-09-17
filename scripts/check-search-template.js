#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════
//  WÄCHTER: SUCH-EFFEKTE FOLGEN DEM TEMPLATE
//
//  Anlass (v1121, Als Vorgabe 15.9.: „Füge dem Spiel Search-Lock als
//  extrem wichtigen Test für künftige Karten hinzu … Idealerweise haben
//  alle Such-Effekte ein ähnliches Template/eine ähnliche Bauweise, auf
//  der künftige Karten ganz automatisch aufbauen.")
//
//  Das Template steht in `cards/effects/_search-shared.js` und kennt
//  vier Bauformen. Dieses Skript prüft die eine Sache, die man am
//  leichtesten vergisst und die still danebengeht:
//
//    ★ Wer eine Galerie/ein Angebot öffnet UND danach auf die Hand
//      sucht, muss die Abfrage als Hand-Suche KENNZEICHNEN
//      (`searchToHand: true`). Ohne das erscheint der Dialog unter einer
//      Such-Sperre, der Spieler wählt — und dann passiert nichts.
//
//  Erkannt wird eine Hand-Suche daran, dass die Datei einen der
//  kanonischen Hand-Add-Wege aus DECK oder ABLAGE aufruft. Wer nur ins
//  Spiel sucht (Garius) oder aus der Hand wählt, ist nicht betroffen.
//
//  Aufruf:  node scripts/check-search-template.js
//  Rückgabe 0 = sauber, 1 = ungekennzeichnete Such-Abfragen.
// ════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

const EFFEKTE = path.join(__dirname, '..', 'cards', 'effects');

// Karten, die BEGRÜNDET keine Kennzeichnung tragen.
const AUSNAHMEN = new Map([
  ['soul-shard-ren.js',
   'Bauform ③: die Galerie DARF öffnen — nur die Hand-OPTION fällt weg (Als Ruling 15.9.)'],
]);

// Die kanonischen Wege, eine Karte aus Deck/Ablage auf die Hand zu holen.
const HAND_ADD = /actionAddCardFromDeckToHand\(|addCardFromDiscardToHand\(|addFromPileToHand\(|takeFromPile\([^)]*toHand:\s*true/;
// Eine Abfrage, die eine Karte auswählen lässt.
const ABFRAGE = /type: '(?:cardGallery|cardGalleryMulti|deckSearchReveal)'|promptCardGallery\(|promptCardGalleryMulti\(/;

function stripKommentare(src) {
  const leeren = (m) => m.replace(/[^\n]/g, ' ');
  return src
    .replace(/\/\*[\s\S]*?\*\//g, leeren)
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + leeren(m.slice(p1.length)));
}

const fehlt = [];
for (const datei of fs.readdirSync(EFFEKTE).filter(f => f.endsWith('.js'))) {
  if (AUSNAHMEN.has(datei)) continue;
  const roh = fs.readFileSync(path.join(EFFEKTE, datei), 'utf8');
  const src = stripKommentare(roh);
  if (!ABFRAGE.test(src)) continue;
  if (!HAND_ADD.test(src)) continue;          // sucht nicht auf die Hand
  if (/searchToHand:\s*true/.test(src)) continue;
  fehlt.push(`  ✗ cards/effects/${datei}`);
}

if (fehlt.length === 0) {
  console.log('[check-search-template] OK — jede Hand-Suche kennzeichnet ihre Abfrage.');
  process.exit(0);
}
console.log(`[check-search-template] ${fehlt.length} ungekennzeichnete Such-Abfrage(n):\n`);
console.log(fehlt.join('\n'));
console.log('\n  Die Karte öffnet eine Auswahl UND holt danach eine Karte aus Deck/Ablage');
console.log('  auf die Hand — kennzeichnet die Abfrage aber nicht. Unter einer Such-Sperre');
console.log('  erscheint der Dialog trotzdem, der Spieler wählt, und nichts passiert.\n');
console.log('  Lösung — das Template (cards/effects/_search-shared.js):');
console.log("    const { suchAbfrage } = require('./_search-shared');");
console.log("    await ctx.promptCardGallery(karten, { ...suchAbfrage('deck'), title, … });\n");
console.log('  Sucht die Karte NUR (oder ist die Suche Schritt 1 und notwendig), gehört');
console.log('  zusätzlich `blockedBySearchLock: true` ans Kartenskript — dann ist sie');
console.log('  unter der Sperre gar nicht erst spielbar.\n');
process.exit(1);
