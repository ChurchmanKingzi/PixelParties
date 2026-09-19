#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════
//  WÄCHTER: NACH DEM HAND-FLUG WIRD ABGEGLICHEN
//
//  ANLASS (18.9., Als Befund zu „Dive Down"): „Nach ihrer
//  Move-from-hand-to-discard-Animation erscheint die Karte für
//  einen Moment wieder in der Hand."
//
//  Der Client verdeckt den Startplatz einer abfliegenden
//  Handkarte, aber nur solange die Hand noch so groß ist wie beim
//  Abflug — der Schlüssel trägt die Handgröße (v1063). Die
//  Verdeckung fällt also von selbst weg, sobald der nächste `sync`
//  die Hand kürzt; ein Zeitgeber ist nur der Notnagel. Bleibt der
//  `sync` aus, hebt der Zeitgeber die Verdeckung auf, während die
//  Karte im Zustand noch in der Hand liegt — und da steht sie dann
//  wieder.
//
//  REGEL: Wer `play_pile_transfer` mit `from: 'hand'` sendet und
//  die Karte danach aus `hand` splict, ruft innerhalb der nächsten
//  20 Zeilen `sync()`.
//
//  Wer die Stapel-Schicht benutzt (`takeFromPile` & Co.), braucht
//  nichts zu tun: `_takeFromPileCore` gleicht Hand-Abgänge seit
//  v1222 selbst ab.
//
//  Aufruf:  node scripts/check-hand-flight-sync.js
//  Rückgabe 0 = sauber, 1 = mindestens eine Stelle ohne Abgleich.
// ════════════════════════════════════════════════════════════════
'use strict';

const fs = require('fs');
const path = require('path');

const WURZEL = path.join(__dirname, '..');
const EFFEKTE = path.join(WURZEL, 'cards', 'effects');

const FENSTER_SPLICE = 18;   // Zeilen vom Broadcast bis zum Splice
// ★ 30 statt 20: an mehreren Stellen liegt zwischen Splice und
// Abgleich noch das Ablage-Routing samt Erklaerung. Mit 20 meldete der
// Waechter dort falschen Alarm — und ein Waechter, der falsch meldet,
// wird ueberklebt statt gelesen.
const FENSTER_SYNC   = 30;   // Zeilen vom Splice bis zum Abgleich

const dateien = [
  ...fs.readdirSync(EFFEKTE).filter(f => f.endsWith('.js')).map(f => path.join(EFFEKTE, f)),
  path.join(WURZEL, 'server.js'),
];

let geprueft = 0;
let funde = 0;

for (const pfad of dateien) {
  const zeilen = fs.readFileSync(pfad, 'utf8').split('\n');
  for (let i = 0; i < zeilen.length; i++) {
    if (!zeilen[i].includes('play_pile_transfer')) continue;
    const kopf = zeilen.slice(i, i + 14).join('\n');
    if (!kopf.includes("from: 'hand'")) continue;

    // Splice suchen — ohne ihn bewegt diese Stelle die Hand nicht
    // selbst (Stapel-Schicht, Hand→Hand-Diebstahl, reine Optik).
    let sp = -1;
    for (let j = i; j < Math.min(i + FENSTER_SPLICE, zeilen.length); j++) {
      if (/hand\.splice\(/.test(zeilen[j])) { sp = j; break; }
    }
    if (sp < 0) continue;

    geprueft++;
    const fenster = zeilen.slice(sp, sp + FENSTER_SYNC).join('\n');
    if (!/\bsync\(\)/.test(fenster)) {
      const rel = path.relative(WURZEL, pfad);
      console.error(`[check-hand-flight-sync] OHNE ABGLEICH: ${rel}:${sp + 1}`);
      console.error('             Nach dem Splice fehlt `sync()` — die Karte taucht');
      console.error('             nach ihrem Flug wieder in der Hand auf.');
      funde++;
    }
  }
}

if (funde > 0) {
  console.error(`[check-hand-flight-sync] ${funde} von ${geprueft} Hand-Abgängen ohne Abgleich.`);
  process.exit(1);
}
console.log(`[check-hand-flight-sync] OK — ${geprueft} Hand-Abgänge mit Flug, alle gleichen sofort ab.`);
