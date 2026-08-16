// ═══════════════════════════════════════════
//  GOLD-ABZUEGE — Prueflauf beim Serverstart
//
//  Hintergrund
//  ───────────
//  Zustandsbasierte Gold-Regeln (Logan: „If you ever have 0 Gold …")
//  und Zahlungs-Regeln (Criminal Monkee: „when you pay exactly 4
//  Gold") haengen daran, dass JEDE Goldbewegung durch eine der
//  Engine-Primitiven laeuft. Wer `ps.gold -= x` schreibt, umgeht beide
//  lautlos — die Karte funktioniert, und zwei andere Karten hoeren
//  einfach auf zu reagieren. Ohne Fehlermeldung.
//
//  Genau das ist am 16.8. DREIMAL hintereinander passiert:
//    · v404: 19 rohe Kosten-Abzuege in `_engine.js` und `server.js`
//      → Logan sah Artefaktkosten nicht.
//    · v405: dieselben Stellen feuerten keinen Zahlungs-Hook
//      → Criminal Monkee sah sie nicht.
//    · v406: 18 WEITERE rohe Abzuege in KARTENSKRIPTEN (Karten mit
//      `manualGoldCost` rechnen ihre Kosten selbst aus) → Al fand es
//      an „Book of Doom" auf ein Ziel, exakt 4 Gold, keine Reaktion.
//
//  Dreimal derselbe Fehler heisst: die naechste Karte macht ihn auch.
//  Also meldet er sich ab jetzt selbst — gleiche Bauform wie
//  `_hand-interaction-registry.js` (Als Vorgabe 4.8.: „die Variante,
//  die sich nicht ueberlesen laesst — ein Prueflauf, der beim
//  Serverstart meckert").
//
//  WAS ZU TUN IST, wenn der Prueflauf anschlaegt
//  ─────────────────────────────────────────────
//    · Kosten, die der Kartenbesitzer zahlt:
//        await engine._payCardCost(pi, betrag)
//    · Gewinn / Zahlung ausserhalb von Kartenkosten:
//        actionGainGold / actionSpendGold
//    · Gold auf einen festen Wert setzen (Wipe):
//        actionSetGold
//    · Gold vom Gegner nehmen:
//        actionStealGold
//  Ist der Zugriff wirklich eine Ausnahme (reines Lesen in einer
//  Rechnung, ein Test-Cheat), gehoert die Datei in ALLOWLIST — mit
//  Begruendung.
// ═══════════════════════════════════════════

'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Rohe SCHREIBzugriffe auf `…gold`. Bewusst breit: `-=`, `+=`, `=`,
 * `++`, `--`. Lesende Vergleiche (`if (ps.gold < cost)`) trifft das
 * nicht — dort steht kein Zuweisungsoperator hinter `gold`.
 */
const RAW_GOLD_WRITE = /\.gold\s*(?:\+=|-=|\*=|\/=|\+\+|--|=(?!=))/;

/**
 * Dateien, die roh schreiben DUERFEN, je mit Grund. Eine Datei hier
 * einzutragen ist eine Entscheidung, keine Abkuerzung.
 */
const ALLOWLIST = {
  '_engine.js': 'Die Primitiven selbst (actionGainGold / actionSpendGold / '
    + 'actionSetGold / actionStealGold / _payCardCost) buchen hier — '
    + 'das IST die eine erlaubte Stelle.',

  'swagdri-forger-of-coolness.js':
    'KEINE Goldbewegung, sondern ein Anzeige-Trick: die Karte hebt den '
    + 'Stand kurz um einen Puffer an, laesst ein verschachteltes Artefakt '
    + 'aufloesen (dessen Kosten sonst einen roten -999-Floater erzeugen '
    + 'wuerden) und setzt danach exakt den Ausgangswert zurueck. Vorher '
    + 'und nachher steht dasselbe Gold da; es gibt nichts zu melden.',

  'tool-freezer.js':
    'RUECKERSTATTUNG, keine Zahlung und kein Gewinn. Kartentext: „Your '
    + 'opponent does not have to pay the negated Artifact\'s costs." Der '
    + 'Gegner hat also nie gezahlt — die Buchung macht eine Zahlung '
    + 'rueckgaengig. Ein Gewinn-Ausloeser (Monkee: „when you gain 4 or '
    + 'more Gold through an effect") darf darauf NICHT anspringen. '
    + 'Zustandsregeln koennen ebenfalls nicht betroffen sein: eine '
    + 'Erstattung ERHOEHT das Gold, und die einzige Zustandsregel im '
    + 'Spiel (Logan) greift bei 0. Sollte je eine Regel auf einen oberen '
    + 'Schwellenwert schauen, gehoert diese Stelle neu bewertet. '
    + 'ALS RULING (16.8., bindend): „Die Rueckerstattung zaehlt nicht als '
    + 'gaining Gold. Regeltechnisch wird das Gold einfach nie bezahlt." '
    + 'Der Eintrag ist damit endgueltig, keine offene Frage mehr.',
};

/** Alle Kartenskripte (ohne die `_`-Module, die keine Karten sind). */
function cardScriptFiles(effectsDir) {
  try {
    return fs.readdirSync(effectsDir)
      .filter(f => f.endsWith('.js') && !f.startsWith('_'));
  } catch { return []; }
}

/**
 * Prueflauf. Rein diagnostisch — bricht nie etwas ab.
 *
 * @returns {{checked:number, warnings:string[]}}
 */
function auditGoldWrites(effectsDir = __dirname) {
  const warnings = [];
  let checked = 0;

  for (const file of cardScriptFiles(effectsDir)) {
    if (ALLOWLIST[file]) continue;
    let src = '';
    try { src = fs.readFileSync(path.join(effectsDir, file), 'utf8'); }
    catch { continue; }
    checked++;
    const treffer = [];
    src.split(/\r?\n/).forEach((zeile, i) => {
      // Kommentarzeilen zaehlen nicht — die Datei darf ueber Gold reden.
      const ohneKommentar = zeile.replace(/^\s*(\/\/|\*).*$/, '');
      if (RAW_GOLD_WRITE.test(ohneKommentar)) treffer.push(i + 1);
    });
    if (treffer.length === 0) continue;
    warnings.push(
      `[gold-audit] "${file}" schreibt roh auf .gold (Zeile ${treffer.join(', ')}). `
      + `Dadurch sehen zustandsbasierte Regeln (Logan) und Zahlungs-Regeln `
      + `(Criminal Monkee) diese Bewegung NICHT. Kartenkosten laufen ueber `
      + `\`await engine._payCardCost(pi, betrag)\`; sonst actionGainGold / `
      + `actionSpendGold / actionSetGold / actionStealGold. Echte Ausnahme? `
      + `Dann in die ALLOWLIST in cards/effects/_gold-audit.js — mit Grund.`
    );
  }
  return { checked, warnings };
}

/** Bequemer Aufruf beim Start: schreibt die Warnungen nach stderr. */
function reportGoldAudit(effectsDir) {
  const { checked, warnings } = auditGoldWrites(effectsDir);
  for (const w of warnings) console.warn(w);
  return { checked, warnings };
}

/**
 * Rohe BEZAHLBARKEITS-Vergleiche gegen `…gold`.
 *
 * Der Zwilling des Schreib-Prueflaufs oben, und aus demselben Anlass:
 * Al fand am 16.8., dass „Book of Doom" mit Kent nicht funktioniert —
 * der Ziel-Waehler rechnete `Math.floor(ps.gold / cost)` und wusste
 * nichts vom Kreditrahmen. Wer gegen den rohen Kontostand prueft,
 * sperrt Zahlungen, die die Engine laengst erlaubt.
 *
 * Richtig sind `engine.canAffordGold(pi, cost, cardName)` (Ja/Nein) und
 * `engine.goldBudget(pi, cardName)` (Betrag, fuer X-Kosten-Karten).
 *
 * NUR INFORMATIV: anders als beim Schreib-Prueflauf sind hier viele
 * Treffer legitim (Zustandsabfragen wie `gold < 0`, Anzeige-Texte,
 * Statistik). Deshalb eine eigene Liste, die beim Start NICHT als
 * Warnkasten erscheint — sie soll beim naechsten Umbau helfen, nicht
 * jeden Serverstart zumuellen.
 */
const RAW_GOLD_COMPARE = /\.gold\s*(?:\|\|\s*0\s*\))?\s*(?:<|>=)(?!=)/;

/** Dateien, deren Vergleiche geprueft und in Ordnung sind. */
const COMPARE_ALLOWLIST = new Set([
  '_debt-o-tron-shared.js',            // `gold < 0` — Zustand, keine Bezahlbarkeit
  'kent-the-indebted-apprentice.js',   // dito
  '_gold-audit.js',
]);

function auditGoldCompares(effectsDir = __dirname) {
  const treffer = [];
  for (const file of cardScriptFiles(effectsDir)) {
    if (COMPARE_ALLOWLIST.has(file)) continue;
    let src = '';
    try { src = fs.readFileSync(path.join(effectsDir, file), 'utf8'); } catch { continue; }
    const zeilen = [];
    src.split(/\r?\n/).forEach((z, i) => {
      const ohneKommentar = z.replace(/^\s*(\/\/|\*).*$/, '');
      if (RAW_GOLD_COMPARE.test(ohneKommentar)) zeilen.push(i + 1);
    });
    if (zeilen.length) treffer.push({ file, lines: zeilen });
  }
  return treffer;
}

module.exports = {
  RAW_GOLD_WRITE, ALLOWLIST, auditGoldWrites, reportGoldAudit,
  RAW_GOLD_COMPARE, COMPARE_ALLOWLIST, auditGoldCompares,
};
