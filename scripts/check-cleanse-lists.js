#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════
//  WÄCHTER: HEIL-KARTEN BAUEN IHRE STATUS-LISTE NICHT SELBST
//
//  Anlass (v1101, Als Nachfrage 15.9.: „Bist du sicher, dass diese drei
//  die einzigen Karten sind, die 'bestimmte' Statuseffekte cleansen
//  können? Was ist mit Tea, Coffee, Elixir of Recovery usw.?")
//
//  Sie waren es nicht. NEUNZEHN Karten rufen `cleanseHeroStatuses`,
//  und SIEBEN davon bauen dem Spieler eine Auswahlliste. Ich hatte drei
//  umgestellt — die übrigen vier hätten „Decisive Defeat" und
//  „Forbidden Curse of Aging" nie angezeigt.
//
//  Der Fehler ist strukturell: das Muster
//
//      getCleansableStatuses()
//        .filter(k => hero.statuses[k])
//        .map(k => ({ key: k, label: …, icon: … }))
//
//  ist siebenmal kopiert worden. Jede Kopie kennt nur ECHTE Status,
//  keine Anhängsel — und die nächste Heil-Karte würde es wieder
//  kopieren. Deshalb ab jetzt EIN Bauer:
//
//      engine.cleansableHeroEntries(pi, heroIdx)
//
//  Dieses Skript meldet jede neue Handkopie.
//
//  Aufruf:  node scripts/check-cleanse-lists.js
//  Rückgabe 0 = sauber, 1 = Handkopien gefunden.
// ════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

const EFFEKTE = path.join(__dirname, '..', 'cards', 'effects');

// Karten, die BEWUSST nicht über den Bauer gehen: sie cleansen einen
// FESTEN Status, ohne den Spieler wählen zu lassen. Ein Anhängsel hat
// dort nichts zu suchen.
const AUSNAHMEN = new Set([
  'curse.js',                          // legt Status an, cleanst nur eigene Spur
  'mischief-militia-thaw-blader.js',   // taut gezielt Frozen auf
  'crimson-web.js',
  'candlestick-squire.js',
  'divine-gift-of-coolness.js',
  'lunatic-cycle-gibbous-moon.js',
  'stinky-stables.js',
]);

function stripKommentare(src) {
  const leeren = (m) => m.replace(/[^\n]/g, ' ');
  return src
    .replace(/\/\*[\s\S]*?\*\//g, leeren)
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + leeren(m.slice(p1.length)));
}

// Die Handkopie — und zwar NUR die für HELDEN.
//
// ★ Die KREATUR-Zweige derselben Karten bauen ihre Liste ebenfalls
// selbst, und das ist richtig so: Anhängsel hängen an HELDEN, eine
// Kreaturenliste soll sie gar nicht enthalten. Erkennbar am Speisewerk:
// Heldenlisten filtern über `<x>.statuses[k]`, Kreaturenlisten über
// `inst.counters[k]` oder `getCleansableCreatureStatusKeys`.
//
// Der erste Entwurf dieses Wächters unterschied das nicht und meldete
// vier korrekte Stellen als Fehler.
const HANDKOPIE = /getCleansableStatuses\(\)\s*\n?\s*\.filter\(\s*k\s*=>\s*\w+\.statuses\[k\]\)[\s\S]{0,260}?STATUS_EFFECTS\[k\]\.label/;

const fehler = [];
for (const datei of fs.readdirSync(EFFEKTE).filter(f => f.endsWith('.js'))) {
  if (datei.startsWith('_')) continue;
  if (AUSNAHMEN.has(datei)) continue;
  const roh = fs.readFileSync(path.join(EFFEKTE, datei), 'utf8');
  if (!roh.includes('cleanseHeroStatuses')) continue;
  const src = stripKommentare(roh);
  if (!HANDKOPIE.test(src)) continue;
  const zeile = src.slice(0, src.search(HANDKOPIE)).split('\n').length;
  fehler.push(`  ✗ cards/effects/${datei}:${zeile}`);
}

if (fehler.length === 0) {
  console.log('[check-cleanse-lists] OK — jede Auswahlliste kommt aus `cleansableHeroEntries`.');
  process.exit(0);
}
console.log(`[check-cleanse-lists] ${fehler.length} handgebaute Status-Liste(n):\n`);
console.log(fehler.join('\n'));
console.log('\n  Grund: eine selbstgebaute Liste kennt nur ECHTE Status. Anhängsel, die');
console.log('  „als Statuseffekt zählen" (Decisive Defeat, Forbidden Curse of Aging),');
console.log('  tauchen dort NICHT auf und lassen sich mit dieser Karte nicht heilen.');
console.log('  Stattdessen: engine.cleansableHeroEntries(pi, heroIdx)');
console.log('  Cleanst die Karte einen FESTEN Status ohne Auswahl, gehört sie in die');
console.log('  Ausnahmeliste dieses Skripts — mit Begründung.\n');
process.exit(1);
