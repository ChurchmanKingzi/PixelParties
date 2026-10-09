'use strict';
// ═══════════════════════════════════════════════════════════════════
//  RENDER-VERSION — Fingerabdruck dessen, woraus der Browser Karten zeichnet
//
//  Der Browser setzt jede Karte zur Laufzeit zusammen (public/card-render.js, card-image-shim.js) und merkt sie sich
//  dauerhaft in IndexedDB. Damit ein Update SOFORT bei allen ankommt (Vorgabe, siehe server.js „Aktualitaet“), gilt ein
//  gemerktes Kartenbild nur zur passenden Version: aendert sich irgendeine Datei, aus der eine Karte entsteht — Zeichner,
//  Rahmen und Symbole, Schrift, Kunst-Atlas, Kartentexte, Seltenheiten, Skins —, aendert sich dieser Fingerabdruck und
//  der Browser verwirft seinen Vorrat.
//
//  INHALT statt Zeitstempel: Entpacken/Deployen setzt Zeitstempel neu (gleiche Falle wie beim Bundle-Hash in
//  scripts/build.js), und ein Cache, der bei jedem Deploy ohne Aenderung ungueltig wuerde, waere kaum einen Cache wert. Der
//  Hash wird je Datei nur neu gerechnet, wenn sich Zeit oder Groesse aendern (der Atlas ist 12 MB, ein Aufruf kostet
//  dadurch nur ein paar `stat`).
// ═══════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Alles, was in eine gezeichnete Karte oder in die Foil-Texturen eingeht (relativ zum Projektordner)
const DATEIEN = [
  'public/card-render.js', 'public/card-image-shim.js',
  'public/cardgen/sprites.png', 'public/cardgen/sprites.json', 'public/cardgen/glyphs.json',
  'public/cardgen/art.json', 'public/cardgen/art.png',
  'data/cards.json', 'data/card-render.json', 'data/skins.json',
];
const ORDNER = ['public/cardgen/art'];          // einzelne Kunstdateien in Vollaufloesung

const memo = new Map();                          // absoluter Pfad -> { sig, hash }
function dateiHash(abs) {
  let st;
  try { st = fs.statSync(abs); } catch (e) { return 'fehlt'; }
  const sig = st.mtimeMs + ':' + st.size;
  const m = memo.get(abs);
  if (m && m.sig === sig) return m.hash;
  const hash = crypto.createHash('sha1').update(fs.readFileSync(abs)).digest('hex');
  memo.set(abs, { sig, hash });
  return hash;
}

/** Fingerabdruck (16 Hex-Zeichen) aller Render-Dateien unter `root`. */
function renderVersion(root) {
  const alle = DATEIEN.map(f => path.join(root, f));
  for (const o of ORDNER) {
    let namen = [];
    try { namen = fs.readdirSync(path.join(root, o)).sort(); } catch (e) { /* kein Ordner: nichts */ }
    for (const n of namen) alle.push(path.join(root, o, n));
  }
  const h = crypto.createHash('sha1');
  for (const abs of alle) h.update(path.relative(root, abs) + ':' + dateiHash(abs) + '\n');
  return h.digest('hex').slice(0, 16);
}

module.exports = { renderVersion };
