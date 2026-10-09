#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════
//  WÄCHTER: FOIL-SCHICHT HAT GENAU EINE ANSCHLUSSSTELLE
//
//  ANLASS (18.9., Als Befund): „Der Foil-Effekt ist irgendwann
//  kaputt gegangen." Die Schicht bestand aus drei Lagen — Funken
//  (reines CSS), Schimmerfolie und die Glanzbänder, die als
//  einzige aus JavaScript kommen (`useFoilBands`). Jede
//  Anzeigestelle trug ihre EIGENE Kopie derselben sechs
//  Anschlusszeilen. Beim Herauslösen des großen Tooltips in
//  `CardTooltipContent` fiel die Band-Quelle weg und wurde mit
//  `bands={[]}` stillgelegt: die Karte funkelte weiter, aber kein
//  Band lief je über sie. Eine zweite Stelle (Stapel-Vorschau in
//  app-board) rechnete `isFoil` aus und zeichnete gar nichts.
//
//  Seit v1203 gibt es `CardFoil` (app-shared): eine Komponente,
//  die Bänder, Schimmerphase und Funkenversatz selbst hält.
//  Aufrufer schreiben nur noch `<CardFoil card={…} />`.
//
//  Diese Prüfung hält das fest: `<FoilOverlay …>` darf NUR noch in
//  `CardFoil` stehen. Jede weitere Fundstelle ist eine neue Kopie
//  — und damit die nächste, die still halb angeschlossen bleibt.
//
//  Aufruf:  node scripts/check-foil.js
//  Rückgabe 0 = sauber, 1 = mindestens eine Kopie gefunden.
// ════════════════════════════════════════════════════════════════
'use strict';

const fs = require('fs');
const path = require('path');

const WURZEL = path.join(__dirname, '..');
const PUBLIC = path.join(WURZEL, 'public');

// `app.jsx` ist der tote Monolith (weder index.html noch build.js
// verweisen darauf) — er wird nicht ausgeliefert und nicht geprüft.
const TOT = new Set(['app.jsx']);

// `<FoilOverlay>` (Foil der Seltenheit), `<SkinHolo>` (Foil der Skin-Karten) und `<FoilName>` (Namensglanz der
// Super-/Diamond-Rare-Karten) `<FoilHatch>` (Schraffur der Fullart-/Super-/Diamond-Rare-Karten) und `<FoilRim>` (Rahmenglanz) haengen
// alle NUR an CardFoil.
const ROHTEILE = ['FoilOverlay', 'SkinHolo', 'FoilName', 'FoilHatch', 'FoilRim'];
let funde = 0;
const anschluesse = Object.fromEntries(ROHTEILE.map(n => [n, 0]));

for (const name of fs.readdirSync(PUBLIC)) {
  if (!name.endsWith('.jsx') || TOT.has(name)) continue;
  const quelle = fs.readFileSync(path.join(PUBLIC, name), 'utf8');
  quelle.split('\n').forEach((zeile, i) => {
    // Kommentare zählen nicht — dort steht die Erklärung.
    const code = zeile.replace(/\/\/.*$/, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
    for (const teil of ROHTEILE) {
      if (!new RegExp('<' + teil + '[\\s/>]').test(code)) continue;
      // Die eine erlaubte Stelle: der Rumpf von CardFoil.
      const davor = quelle.slice(0, quelle.indexOf(zeile));
      const letzteFn = davor.lastIndexOf('function ');
      const inCardFoil = davor.slice(letzteFn).startsWith('function CardFoil(');
      if (inCardFoil) { anschluesse[teil]++; continue; }
      console.error(`[check-foil] KOPIE: public/${name}:${i + 1} rendert <${teil}> direkt.`);
      console.error('             Foil-Karten werden über <CardFoil card={…} skin={…} /> angeschlossen.');
      funde++;
    }
  });
}

if (funde > 0) {
  console.error(`[check-foil] ${funde} Stelle(n) am zentralen Anschluss vorbei.`);
  process.exit(1);
}
for (const teil of ROHTEILE) {
  if (anschluesse[teil] !== 1) {
    console.error(`[check-foil] CardFoil rendert <${teil}> ${anschluesse[teil]}× — erwartet: genau 1×.`);
    process.exit(1);
  }
}
// ── Gleiche Karte = gleicher Foil-Zustand ──
// Alles Gewürfelte der Foil-Schichten muss aus `foilZufall(<Schlüssel der Karte>)` kommen, nie aus `Math.random()`: sonst sieht
// jede Kopie einer Karte anders aus und läuft in anderer Phase (Nutzerbefund: der Foil-Zustand springt beim Wechsel zwischen Kopien).
// Erlaubt ist nur der Standardwert `rnd = Math.random` (ohne Klammern) der Hilfsfunktionen.
{
  const q = fs.readFileSync(path.join(PUBLIC, 'app-shared.jsx'), 'utf8');
  const von = q.indexOf('function foilSamen(');
  const bis = q.indexOf('\nfunction ppUmrissFarbe(');
  if (von < 0 || bis < 0) { console.error('[check-foil] Foil-Abschnitt in app-shared.jsx nicht gefunden (foilSamen … ppUmrissFarbe).'); process.exit(1); }
  const abschnitt = q.slice(von, bis);
  let n = 0;
  abschnitt.split('\n').forEach((zeile, i) => {
    const code = zeile.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
    if (/Math\.random\s*\(/.test(code)) { console.error(`[check-foil] Math.random() im Foil-Abschnitt (app-shared.jsx, Zeile ${q.slice(0, von).split('\n').length + i}): foilZufall(<Kartenschlüssel>) verwenden, sonst unterscheiden sich Kopien derselben Karte.`); n++; }
  });
  if (n > 0) process.exit(1);
  if (!/data-foil-key=\{fkey\}/.test(abschnitt) || (abschnitt.match(/data-foil-key=/g) || []).length < 6) {
    console.error('[check-foil] Foil-Schichten ohne data-foil-key: die gemeinsame Foil-Uhr (foilUhrStellen) erkennt sie sonst nicht.');
    process.exit(1);
  }
}
console.log('[check-foil] OK — die Foil-Schicht hat genau eine Anschlussstelle (CardFoil), auch für Skin-Holo und Namensglanz; Zufall nur je Karte, alle Schichten an der Foil-Uhr.');
