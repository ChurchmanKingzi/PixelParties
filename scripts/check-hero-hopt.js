#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════
//  WÄCHTER: EINMAL-PRO-ZUG-SPERREN VON HELDENEFFEKTEN (v1275)
//
//  Als Ruling 22.9. (Pseudonia): „Hero-Effekte, die once per turn sind,
//  sind generell IMMER hard once per turn" — pro SPIELER, unless
//  specified otherwise. Die Sperre darf deshalb NICHT am Heldenplatz
//  oder an einer Karteninstanz haengen: sonst haette ein zweiter Traeger
//  desselben Effekts (Pseudonia mit aufgenommenem Effekt, das
//  wiederbelebte Original) seinen eigenen Ausloeser.
//
//  Gemeldet wird in Skripten von Helden und Ascended Heroes:
//    • `hoptUsed`-Schluessel mit Heldenplatz (`${heroIdx}`, `${hi}`,
//      `${ctx.cardHeroIdx}`, `….heroIdx}`),
//    • Zugstempel an Instanz oder Held
//      (`counters._xTurn === gs.turn`, `hero._xTurn = gs.turn` …),
//    • Benutzt-Merker an Held oder Instanz (`flags.xUsedThisTurn = true`).
//  Richtig: `_hero-hopt-shared.js` bzw. `engine.heroHoptKey(name, pi)`.
//
//  Aufruf: node scripts/check-hero-hopt.js   (0 = sauber, 1 = Fund)
// ════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs');
const path = require('path');
const WURZEL = path.join(__dirname, '..');
const EFFEKTE = path.join(WURZEL, 'cards', 'effects');
const karten = JSON.parse(fs.readFileSync(path.join(WURZEL, 'data', 'cards.json'), 'utf8'));
const nameZuDatei = (n) => n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const ohneKommentare = (s) => String(s || '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/([^:'"`])\/\/.*$/gm, '$1');

const MUSTER = [
  [/hoptUsed[^\n;]*\$\{\s*(heroIdx|hi|ctx\.cardHeroIdx|[A-Za-z_.]+\.heroIdx)\s*\}/, 'hoptUsed-Schluessel mit Heldenplatz'],
  [/const\s+\w+\s*=\s*\([^)]*\)\s*=>\s*`[^`]*\$\{\s*(heroIdx|hi)\s*\}[^`]*`/, 'Schluessel-Funktion mit Heldenplatz'],
  [/const\s+\w*([Hh]opt|HOPT)\w*\s*=\s*`[^`]*\$\{\s*(heroIdx|hi|ctx\.cardHeroIdx|[\w.]+\.heroIdx)\s*\}[^`]*`/, 'Schluessel-Konstante mit Heldenplatz'],
  [/counters\??\.\s*_\w*(Turn|turn)\s*(===|=)\s*(engine\.)?gs\??\.\s*turn/, 'Zugstempel an der Karteninstanz'],
  [/hero\??\.\s*_\w*(Turn|turn)\s*(===|=)\s*(engine\.)?gs\??\.\s*turn/, 'Zugstempel am Heldenobjekt'],
  [/(flags|counters|hero)\??\.\s*\w*Used\w*\s*=\s*true/, 'Benutzt-Merker an Held/Instanz (zu Zugbeginn zurueckgesetzt)'],
];

const funde = [];
let geprueft = 0;
for (const k of karten) {
  if (k.cardType !== 'Hero' && k.cardType !== 'Ascended Hero') continue;
  const text = (k.effect || '').toLowerCase();
  if (!text.includes('once per turn')) continue;
  const datei = path.join(EFFEKTE, nameZuDatei(k.name) + '.js');
  if (!fs.existsSync(datei)) continue;
  geprueft++;
  const code = ohneKommentare(fs.readFileSync(datei, 'utf8'));
  for (const [re, was] of MUSTER) {
    const alle = code.match(new RegExp(re.source, 'g')) || [];
    for (const treffer of alle) {
      // Keine Sperren, sondern Zustandsfelder mit Zugbezug: Ablaufdaten
      // geliehener Formen (`_identityExpiresTurn`), der Engine-Vertrag
      // `_effectLockedTurn` (fremde Kreatur), Schadens-/Spielzeitpunkte.
      if (/_\w*(Expires|Locked|Taken|Played|Damaged|Placed|Summoned)\w*Turn/i.test(treffer)) continue;
      funde.push(`${k.name}: ${was} — „${treffer.slice(0, 90)}"`);
    }
  }
}
if (funde.length) {
  console.error(`[check-hero-hopt] ${funde.length} Fund(e) in ${geprueft} Heldenskripten mit „once per turn":`);
  for (const f of funde) console.error('  ✗ ' + f);
  process.exit(1);
}
console.log(`[check-hero-hopt] sauber — ${geprueft} Heldenskripte mit „once per turn" geprüft.`);
