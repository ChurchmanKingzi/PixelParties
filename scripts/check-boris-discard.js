#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════
//  WÄCHTER: ABWURF VON DER HAND OHNE BORIS-FENSTER (Welle 74 / W74c)
//
//  Al: „Ich finde gerade eine Menge Interaktionen, bei denen Boris schlicht nicht funktioniert."
//  Boris, the Guardian of Blackport: „You may once per turn ignore any effect that would force you to discard cards from your hand
//  (including as a cost)." Damit Boris EINMAL PRO ABWURF-STAPEL gefragt wird (vor der Zahlung), darf ein Kartenskript Karten nur über
//  die zentralen Wege von der Hand abwerfen:
//    • `engine.actionPromptForceDiscard`            (fragt selbst; für Kosten mit Folgewirkung `engine.zahleAbwurfKosten`)
//    • `engine.borisVerzicht(pi, n, opts)`          (Eigenbau mit eigener Kartenwahl: nach der Wahl, vor `actionDiscardHandCard`)
//    • `engine.borisStapel(pi, opts)`               (Eigenbau-Schleifen: eine Frage für den ganzen Stapel)
//    • `engine.fremdAbwurfEntfaellt(opfer, n, opts)` (Eigenbau-Zwangsabwurf: ERST Ambush the Scout, DANN Boris)
//    • `engine.actionDiscardCards` / `…Animated`    (blinder Mehrfach-Abwurf, fragt selbst)
//
//  Gemeldet wird jede Skriptdatei, die `engine.actionDiscardHandCard(` aufruft, ohne einen dieser Wege zu benutzen. (Grobe, dateiweise Prüfung;
//  die genaue Messung macht der dynamische Wächter-Sweep `docs/niche-tests/repro/W74/c-boris-04…07` — lokal, nicht im Repository.)
//  Ausnahmen mit Begründung: `AUSNAHMEN`.
//
//  Aufruf: node scripts/check-boris-discard.js   (0 = sauber, 1 = Fund)
// ════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs');
const path = require('path');
const EFFEKTE = path.join(__dirname, '..', 'cards', 'effects');

const AUSNAHMEN = {
  '_engine.js': 'die Primitive selbst',
  '_loader.js': 'Kontext-Hüllen (`ctx.discardCards` → actionDiscardCards fragt selbst)',
  '_cpu.js': 'CPU-Prompt-Antworten, kein Spielzug',
  '_decision-log.js': 'Lernkanal, kein Spielzug',
  'cute-hydra.js': 'Batch-Abwurf mit Bestätigung und Boris beim Confirm — Welle 74 / W74b',
};
const WEGE = /\b(borisVerzicht|borisStapel|fremdAbwurfEntfaellt|zahleAbwurfKosten|actionPromptForceDiscard|offerDiscardSkip|actionDiscardCards(Animated)?)\b/;
const ohneKommentare = (s) => String(s || '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/([^:'"`])\/\/.*$/gm, '$1');

const funde = [];
for (const datei of fs.readdirSync(EFFEKTE).filter(f => f.endsWith('.js')).sort()) {
  if (AUSNAHMEN[datei]) continue;
  const quelle = ohneKommentare(fs.readFileSync(path.join(EFFEKTE, datei), 'utf8'));
  if (!/\bactionDiscardHandCard\s*\(/.test(quelle)) continue;
  if (WEGE.test(quelle)) continue;
  funde.push(datei);
}

if (funde.length === 0) {
  console.log('[check-boris-discard] OK — jeder Skript-Abwurf von der Hand läuft über einen der zentralen Boris-Wege.');
  process.exit(0);
}
console.log(`[check-boris-discard] ${funde.length} Skript(e) werfen von der Hand ab, ohne Boris zu fragen:\n`);
for (const f of funde) console.log(`  ✗ cards/effects/${f}`);
console.log(`
  Abwurf von der Hand läuft über die zentralen Wege (siehe Kopf dieser Datei und cards/effects/CARD_API.md „Welle 74 / W74c"):
    • Karten, die der Spieler wählt: nach der Wahl, VOR dem Abwurf
        if (await engine.borisVerzicht(pi, anzahl, { source: CARD_NAME })) { /* Karte bleibt, Kosten erlassen */ } else { await engine.actionDiscardHandCard(…); }
    • Zwangsabwurf gegen den Gegner: \`if (await engine.fremdAbwurfEntfaellt(opfer, anzahl, { source, sourceOwner })) return;\`
    • Standard: \`engine.actionPromptForceDiscard\` / \`engine.zahleAbwurfKosten\`
`);
process.exit(1);
