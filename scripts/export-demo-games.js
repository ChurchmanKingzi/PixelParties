// ═══════════════════════════════════════════════════════════════════
//  Aufgezeichnete Partien aus der Datenbank holen
// ═══════════════════════════════════════════════════════════════════
//  Auf Render ist das Dateisystem flüchtig — `data/demo-games/` ist nach
//  jedem Deploy leer. Die Aufnahmen liegen deshalb dauerhaft in der
//  Tabelle `demo_games` (lokal SQLite, live Turso), gzip-gepackt.
//
//  Aufrufe:
//    node scripts/export-demo-games.js                 # letzte 20 auflisten
//    node scripts/export-demo-games.js --list 100      # mehr auflisten
//    node scripts/export-demo-games.js --all           # alle entpacken
//    node scripts/export-demo-games.js --id demo-…     # eine bestimmte
//    node scripts/export-demo-games.js --mode pvp      # nur PvP
//    node scripts/export-demo-games.js --min-turns 10  # nur längere
//
//  Zielordner: data/demo-games/ (wird angelegt), Dateiname = id + .json
//
//  Für Turso müssen TURSO_DATABASE_URL und TURSO_AUTH_TOKEN gesetzt
//  sein — dieselben Variablen wie im Live-Betrieb. Ohne sie greift das
//  Skript auf die lokale SQLite zu.
// ═══════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const db = require('../db');

const OUT_DIR = path.join(__dirname, '..', 'data', 'demo-games');

function arg(name, fallback = null) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? (process.argv[i + 1] ?? true) : fallback;
}

(async () => {
  const wantAll = process.argv.includes('--all');
  const id = arg('--id');
  const mode = arg('--mode');
  const minTurns = parseInt(arg('--min-turns', '0'), 10) || 0;
  const listN = parseInt(arg('--list', '20'), 10) || 20;

  const where = [];
  const args = [];
  if (id) { where.push('id = ?'); args.push(id); }
  if (mode) { where.push('mode = ?'); args.push(mode); }
  if (minTurns) { where.push('turns >= ?'); args.push(minTurns); }
  const sql = `SELECT id, created_at, mode, players, heroes, winner_idx, reason,
                      turns, events, bytes${wantAll || id ? ', payload' : ''}
               FROM demo_games
               ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
               ORDER BY created_at DESC
               ${wantAll || id ? '' : 'LIMIT ' + listN}`;

  let rows;
  try {
    rows = await db.all(sql, args);
  } catch (e) {
    console.error('Abfrage fehlgeschlagen:', e.message);
    console.error('Gibt es die Tabelle schon? Sie entsteht bei der ersten '
      + 'aufgezeichneten Partie (mindestens 5 Runden).');
    process.exit(1);
  }
  if (!rows || rows.length === 0) {
    console.log('Keine Aufnahmen gefunden.');
    return;
  }

  if (!wantAll && !id) {
    console.log(`${rows.length} Aufnahmen (neueste zuerst):\n`);
    console.log('  ' + 'Datum'.padEnd(20) + 'Modus'.padEnd(6) + 'Runden'.padStart(7)
      + 'Ereign.'.padStart(9) + '  Spieler');
    for (const r of rows) {
      const d = new Date((r.created_at || 0) * 1000).toISOString().replace('T', ' ').slice(0, 19);
      let sp = '';
      try { sp = (JSON.parse(r.players || '[]') || []).join(' vs '); } catch { }
      console.log('  ' + d.padEnd(20) + String(r.mode || '?').padEnd(6)
        + String(r.turns).padStart(7) + String(r.events).padStart(9) + '  ' + sp);
      console.log('    ' + r.id);
    }
    console.log('\nZum Entpacken: --id <id>  oder  --all');
    return;
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  let ok = 0;
  for (const r of rows) {
    try {
      // libsql liefert BLOBs je nach Treiber als Buffer oder Uint8Array.
      const buf = Buffer.isBuffer(r.payload) ? r.payload : Buffer.from(r.payload);
      const json = zlib.gunzipSync(buf).toString('utf-8');
      const file = path.join(OUT_DIR, `${r.id}.json`);
      fs.writeFileSync(file, json, { encoding: 'utf-8' });
      console.log(`  ✔ ${file}  (${r.turns} Runden, ${r.events} Ereignisse)`);
      ok++;
    } catch (e) {
      console.error(`  ✘ ${r.id}: ${e.message}`);
    }
  }
  console.log(`\n${ok} von ${rows.length} entpackt → ${OUT_DIR}`);
})().catch(e => { console.error(e); process.exit(1); });
