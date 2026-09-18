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

let funde = 0;
let anschluesse = 0;

for (const name of fs.readdirSync(PUBLIC)) {
  if (!name.endsWith('.jsx') || TOT.has(name)) continue;
  const quelle = fs.readFileSync(path.join(PUBLIC, name), 'utf8');
  quelle.split('\n').forEach((zeile, i) => {
    // Kommentare zählen nicht — dort steht die Erklärung.
    const code = zeile.replace(/\/\/.*$/, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
    if (/<FoilOverlay[\s/>]/.test(code)) {
      // Die eine erlaubte Stelle: der Rumpf von CardFoil.
      const davor = quelle.slice(0, quelle.indexOf(zeile));
      const letzteFn = davor.lastIndexOf('function ');
      const inCardFoil = davor.slice(letzteFn).startsWith('function CardFoil(');
      if (inCardFoil) { anschluesse++; return; }
      console.error(`[check-foil] KOPIE: public/${name}:${i + 1} rendert <FoilOverlay> direkt.`);
      console.error('             Foil-Karten werden über <CardFoil card={…} /> angeschlossen.');
      funde++;
    }
  });
}

if (funde > 0) {
  console.error(`[check-foil] ${funde} Stelle(n) am zentralen Anschluss vorbei.`);
  process.exit(1);
}
if (anschluesse !== 1) {
  console.error(`[check-foil] CardFoil rendert <FoilOverlay> ${anschluesse}× — erwartet: genau 1×.`);
  process.exit(1);
}
console.log('[check-foil] OK — die Foil-Schicht hat genau eine Anschlussstelle (CardFoil).');
