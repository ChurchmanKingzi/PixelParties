'use strict';
// Der Trainingsmodus läuft ohne Datenbank (Kopf von runTrainingBatch): ein Spiel muss auch gegen eine LEERE Datenbankdatei ohne Schema durchlaufen.
// Vorher scheiterte jede Partie mit `SQLITE_ERROR: no such table: users` (setupGameState schlug das CPU-Konto nach) — auf Rechnern, auf denen der
// Spielserver nie lief (frischer Trainingsserver), kamen so gar keine Daten zustande. Außerdem: ein systematischer Fehler bricht nach 10 Spielen ab.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const lauf = (extra, spiele) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pp-train-nodb-'));
  const env = { ...process.env, PP_DB_PATH: path.join(dir, 'leer.db'), PP_TRAIN: '1', PP_TRAIN_DECK: 'Pew-Pew', PP_TRAIN_GAMES: String(spiele),
    PP_TRAIN_HORIZON: '1', PP_MCTS_BUDGET_MS: '300', PP_MCTS_PULLS: '2', PP_TRAIN_OUT: path.join(dir, 'g.jsonl'), PP_TRAIN_JOBS: '1',
    PP_DISABLE_PROFILES: '1', PP_GAME_TIMEOUT_MS: '120000', ...extra };
  const r = spawnSync(process.execPath, ['--max-old-space-size=2048', path.join(ROOT, 'server.js')], { cwd: ROOT, env, encoding: 'utf-8', timeout: 150000 });
  const rows = fs.existsSync(env.PP_TRAIN_OUT) ? fs.readFileSync(env.PP_TRAIN_OUT, 'utf-8').split('\n').filter(Boolean) : [];
  return { r, rows, out: (r.stdout || '') + (r.stderr || ''), env };
};

test('Training: ein Spiel läuft gegen eine leere Datenbank ohne Schema durch', () => {
  const { r, rows, out } = lauf({}, 1);
  assert.equal(r.status, 0, out.slice(-600));
  assert.equal(rows.length, 1, 'eine Partie in der Ausgabedatei');
  assert.ok(!/SQLITE_ERROR|threw/.test(out), out.slice(-600));
});

test('Training: ein systematischer Fehler bricht nach 10 Spielen mit Exit-Code 4 ab, statt alle durchzulaufen', () => {
  const { r, out } = lauf({ PP_TRAIN_TEST_THROW: '1' }, 200);   // der Schalter lässt jedes Spiel mit einem Fehler abbrechen
  assert.equal(r.status, 4, out.slice(-600));
  assert.match(out, /10 Spiele hintereinander/);
  assert.ok((out.match(/threw:/g) || []).length <= 10, 'nicht mehr als 10 Fehlversuche');
});
