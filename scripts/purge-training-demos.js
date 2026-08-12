#!/usr/bin/env node
// ═══════════════════════════════════════════
//  PIXEL PARTIES — CPU-GEGEN-CPU-AUFNAHMEN AUSRÄUMEN
//
//  Bis v318 hängte sich der Demo-Recorder an JEDES Spiel — auch an
//  jedes Trainingsspiel. Ergebnis: eine Datenbank voller Aufnahmen von
//  CPU gegen CPU, die niemand je auswerten wird, und ein ebenso voller
//  data/demo-games/-Ordner. Ab v318 entstehen keine neuen mehr; dieses
//  Skript räumt die vorhandenen weg.
//
//  Nutzung:
//    node scripts/purge-training-demos.js            → NUR ANZEIGEN (nichts wird gelöscht)
//    node scripts/purge-training-demos.js --yes      → wirklich löschen
//
//  Zusätzlich:
//    --db-only      nur Datenbankzeilen, Dateien bleiben liegen
//    --files-only   nur Dateien, Datenbank bleibt unberührt
//    --no-vacuum    kein VACUUM (SQLite gibt den Platz dann nicht frei)
//
//  VOR DEM ERSTEN ECHTEN LAUF: data/pixel-parties.db einmal kopieren.
//  Gelöschte Zeilen sind weg; das Skript legt selbst keine Sicherung an.
// ═══════════════════════════════════════════

'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const demoDir = path.join(root, 'data', 'demo-games');
const dbFile = process.env.PP_DB_PATH
  ? path.resolve(process.env.PP_DB_PATH)
  : path.join(root, 'data', 'pixel-parties.db');

const args = process.argv.slice(2);
const apply = args.includes('--yes') || args.includes('--apply');
const dbOnly = args.includes('--db-only');
const filesOnly = args.includes('--files-only');
const noVacuum = args.includes('--no-vacuum');

// ── WAS IST EINE CPU-GEGEN-CPU-AUFNAHME? ───────────────────────────
// Jede Raum-ID trägt das Präfix ihres Erzeugers, und genau drei davon
// erzeugen Partien ohne Menschen am Steuer:
//   train-    Headless-Training  (server.js, runHeadlessTrainingGame)
//   sp-test-  Self-Play-Batch    (debug_self_play_run)
//   cvc-      cpu_vs_cpu-Zuschauermodus
// Die Präfixe der Menschen-Partien sind sp- (Singleplayer) und pz-
// (Puzzle); PvP-Räume tragen wieder andere. WICHTIG: `sp-test-` fängt
// mit `sp-` an — deshalb wird auf das VOLLE Präfix geprüft und nie auf
// `sp-` allein.
const CPU_ROOM_PREFIXES = ['train-', 'sp-test-', 'cvc-'];

function isCpuRoomId(roomId) {
  const id = String(roomId || '');
  return CPU_ROOM_PREFIXES.some(p => id.startsWith(p));
}

// SICHERHEITSNETZ, zweite unabhängige Prüfung: sieht einer der beiden
// Spielernamen nach einem Menschen aus, wird die Zeile NICHT angefasst —
// egal, was die Raum-ID sagt. CPU-Namen sind 'CPU', 'CPU-A'/'CPU-B'
// (Training) und 'CPU · <Deckname>' (Zuschauermodus). Das Trennzeichen
// hinter CPU ist Pflicht, damit ein Spieler namens "CPUmaster" nicht
// versehentlich als CPU durchgeht.
function looksLikeCpuName(name) {
  return /^CPU([-\s·]|$)/.test(String(name || '').trim());
}

function hasHumanPlayer(playersJson) {
  let namen;
  try { namen = JSON.parse(playersJson || '[]'); } catch { return false; }
  if (!Array.isArray(namen) || namen.length === 0) return false;
  return namen.some(n => n && !looksLikeCpuName(n));
}

const mb = (bytes) => (bytes / 1048576).toFixed(1) + ' MB';

async function purgeDatabase() {
  let db;
  try { db = require('../db'); }
  catch (err) {
    console.error('  Datenbank nicht erreichbar:', err.message);
    return;
  }

  let rows;
  try {
    rows = await db.all('SELECT id, room_id, players, bytes FROM demo_games');
  } catch (err) {
    console.log('  Keine Tabelle demo_games vorhanden — nichts zu tun.');
    return;
  }

  const weg = [];
  const geschuetzt = [];
  let behaltenZeilen = 0, behaltenBytes = 0;
  const nachPraefix = Object.create(null);

  for (const r of rows) {
    if (isCpuRoomId(r.room_id)) {
      if (hasHumanPlayer(r.players)) { geschuetzt.push(r); continue; }
      const p = CPU_ROOM_PREFIXES.find(x => String(r.room_id).startsWith(x));
      const eintrag = nachPraefix[p] || (nachPraefix[p] = { n: 0, bytes: 0 });
      eintrag.n++; eintrag.bytes += (r.bytes || 0);
      weg.push(r.id);
    } else {
      behaltenZeilen++; behaltenBytes += (r.bytes || 0);
    }
  }

  console.log(`  Zeilen gesamt: ${rows.length}`);
  for (const [p, e] of Object.entries(nachPraefix)) {
    console.log(`    ${p.padEnd(9)} ${String(e.n).padStart(6)} Zeilen   ${mb(e.bytes).padStart(10)}   → löschen`);
  }
  console.log(`    ${'behalten'.padEnd(9)} ${String(behaltenZeilen).padStart(6)} Zeilen   ${mb(behaltenBytes).padStart(10)}   → Menschen-Partien`);
  if (geschuetzt.length > 0) {
    console.log(`  ⚠️  ${geschuetzt.length} Zeile(n) mit CPU-Raum-ID, aber menschlichem Spielernamen — NICHT angefasst:`);
    for (const r of geschuetzt.slice(0, 10)) console.log(`        ${r.room_id}  ${r.players}`);
  }
  if (weg.length === 0) { console.log('  Nichts zu löschen.'); return; }
  if (!apply) return;

  // In Blöcken löschen: ein IN (…) mit 10 000 Platzhaltern sprengt die
  // Parameter-Grenze von SQLite.
  const BLOCK = 400;
  let geloescht = 0;
  for (let i = 0; i < weg.length; i += BLOCK) {
    const teil = weg.slice(i, i + BLOCK);
    const fragezeichen = teil.map(() => '?').join(',');
    const res = await db.run(`DELETE FROM demo_games WHERE id IN (${fragezeichen})`, teil);
    geloescht += (res?.rowsAffected ?? teil.length);
    process.stdout.write(`\r  gelöscht: ${Math.min(i + BLOCK, weg.length)}/${weg.length}`);
  }
  console.log(`\r  ${geloescht} Zeilen gelöscht.                    `);

  if (noVacuum) {
    console.log('  VACUUM übersprungen (--no-vacuum) — die Datei bleibt vorerst so groß wie bisher.');
    return;
  }
  // SQLite gibt den Platz einer gelöschten Zeile NICHT von selbst ans
  // Dateisystem zurück — ohne VACUUM bleibt die .db-Datei genauso groß
  // und füllt den frei gewordenen Raum nur intern wieder auf.
  //
  // ZWEITER SCHRITT, ohne den die Messung lügt: die Datenbank läuft im
  // WAL-Modus. VACUUM schreibt die neue, kleine Datenbank zunächst ins
  // Write-Ahead-Log; die Hauptdatei wird erst bei einem Checkpoint
  // gekürzt. Ohne `wal_checkpoint(TRUNCATE)` meldet dieses Skript
  // unmittelbar nach dem VACUUM also unverändert die alte Größe,
  // obwohl alles geklappt hat (im Test: 110 MB → 110 MB angezeigt,
  // tatsächlich 0,6 MB nach dem Checkpoint).
  const vorher = fs.existsSync(dbFile) ? fs.statSync(dbFile).size : null;
  process.stdout.write('  VACUUM läuft … ');
  try {
    await db.run('VACUUM');
    try { await db.run('PRAGMA wal_checkpoint(TRUNCATE)'); }
    catch { /* kein WAL-Modus oder nicht erlaubt — unten abgefangen */ }
    const nachher = fs.existsSync(dbFile) ? fs.statSync(dbFile).size : null;
    if (vorher != null && nachher != null) {
      console.log(`fertig: ${mb(vorher)} → ${mb(nachher)}`);
      if (nachher >= vorher * 0.9) {
        console.log('  Die Datei ist noch nicht kleiner geworden — das holt SQLite spätestens nach,');
        console.log('  wenn der Server die Datenbank das nächste Mal sauber schließt. Die Zeilen sind weg.');
      }
    } else {
      console.log('fertig.');
    }
  } catch (err) {
    console.log('fehlgeschlagen:', err.message);
    console.log('  (Die Zeilen sind trotzdem weg. VACUUM später nachholen, wenn der Server steht.)');
  }
}

function purgeFiles() {
  if (!fs.existsSync(demoDir)) { console.log('  Kein Ordner data/demo-games — nichts zu tun.'); return; }
  const dateien = fs.readdirSync(demoDir).filter(f => /^demo-.*\.json$/.test(f));

  const weg = [];
  let behalten = 0, behaltenBytes = 0, unklar = 0, wegBytes = 0;
  for (const f of dateien) {
    const voll = path.join(demoDir, f);
    let groesse = 0;
    try { groesse = fs.statSync(voll).size; } catch { continue; }
    // Der Kopf reicht: `meta` steht am Anfang des Dokuments. Nur wenn
    // die Raum-ID dort nicht auftaucht, wird die ganze Datei gelesen —
    // sonst wären es bei tausend Aufnahmen hunderte MB.
    let roomId = null;
    try {
      const fd = fs.openSync(voll, 'r');
      const puffer = Buffer.alloc(8192);
      const gelesen = fs.readSync(fd, puffer, 0, 8192, 0);
      fs.closeSync(fd);
      let kopf = puffer.slice(0, gelesen).toString('utf-8');
      let m = /"roomId"\s*:\s*"([^"]*)"/.exec(kopf);
      if (!m) {
        const ganz = fs.readFileSync(voll, 'utf-8');
        m = /"roomId"\s*:\s*"([^"]*)"/.exec(ganz);
      }
      if (m) roomId = m[1];
    } catch { /* unlesbar → behalten */ }

    if (roomId == null) { unklar++; behalten++; behaltenBytes += groesse; continue; }
    if (isCpuRoomId(roomId)) { weg.push(voll); wegBytes += groesse; }
    else { behalten++; behaltenBytes += groesse; }
  }

  console.log(`  Dateien gesamt: ${dateien.length}`);
  console.log(`    ${String(weg.length).padStart(6)} Dateien   ${mb(wegBytes).padStart(10)}   → löschen (CPU gegen CPU)`);
  console.log(`    ${String(behalten).padStart(6)} Dateien   ${mb(behaltenBytes).padStart(10)}   → behalten`
    + (unklar > 0 ? ` (davon ${unklar} ohne erkennbare Raum-ID — im Zweifel behalten)` : ''));
  if (weg.length === 0 || !apply) return;

  let n = 0;
  for (const voll of weg) { try { fs.unlinkSync(voll); n++; } catch { /* schon weg */ } }
  console.log(`  ${n} Dateien gelöscht.`);
}

(async () => {
  console.log(apply
    ? '\n═══ CPU-gegen-CPU-Aufnahmen werden GELÖSCHT ═══'
    : '\n═══ NUR ANZEIGE — es wird nichts gelöscht (zum Löschen: --yes) ═══');

  if (!filesOnly) {
    console.log('\nDatenbank:');
    await purgeDatabase();
  }
  if (!dbOnly) {
    console.log('\nDateien (data/demo-games):');
    purgeFiles();
  }

  if (!apply) {
    console.log('\nSieht das richtig aus? Dann:');
    console.log('  1. data/pixel-parties.db einmal kopieren (Sicherung)');
    console.log('  2. node scripts/purge-training-demos.js --yes');
  }
  console.log();
  process.exit(0);
})().catch(err => {
  console.error('Abbruch:', err?.stack || err);
  process.exit(1);
});
