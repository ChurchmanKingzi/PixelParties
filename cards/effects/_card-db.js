// ═══════════════════════════════════════════
//  KARTENDATENBANK — EINMAL LESEN, NICHT JE AUSLÖSUNG
//
//  `data/cards.json` ist 0,83 MB. Wer die Datei in einem Hook liest und
//  parst, erzeugt je Auslösung mehrere MB Müll (Dateiinhalt als String,
//  das geparste Objektnetz aus ~800 Karten, die daraus gebaute Map) —
//  und blockiert dabei den Event-Loop mit synchroner Platten-E/A.
//
//  Im normalen Spiel fällt das kaum auf. Im MCTS ist es fatal: jeder
//  Rollout spielt dieselben Karten erneut, also feuert derselbe Hook
//  dutzendfach je Zug. Gemessen im Absturzlauf vom 11.8.: 60 Rollouts
//  einer einzigen Action Phase allozierten 247 MB, bei einem Brett von
//  32 Instanzen und einer Snapshot-Größe von 15 KB. Die Zuordnung je
//  Hook (MCTS_HOOK_HEAP_PROFILE=1) wies davon den größten Einzelposten
//  `onPlay@Shadowy Slime` zu — genau so einer Stelle.
//
//  Die Kartendatenbank ist unveränderlich, ein prozessweiter Cache also
//  unbedenklich. Die Engine hat mit `engine._getCardDB()` bereits einen
//  eigenen; dieses Modul ist für Kartendateien gedacht, die an ihrer
//  Aufrufstelle keine Engine-Referenz zur Hand haben.
// ═══════════════════════════════════════════

'use strict';

const fs = require('fs');
const path = require('path');

let _cache = null;

/**
 * Liefert die Kartendatenbank als `{ [kartenname]: kartendaten }`.
 * Erster Aufruf liest und parst, jeder weitere gibt dieselbe Map zurück.
 * @param {object} [engine] Optional — hat die Engine schon eine geladen,
 *                          wird deren Map genommen (spart den zweiten Satz).
 */
function getCardDB(engine) {
  if (engine && typeof engine._getCardDB === 'function') {
    try { return engine._getCardDB(); } catch { /* Rückfall auf den eigenen Cache */ }
  }
  if (_cache) return _cache;
  const roh = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/cards.json'), 'utf-8'));
  const db = {};
  roh.forEach(c => { db[c.name] = c; });
  _cache = db;
  return _cache;
}

module.exports = { getCardDB };
