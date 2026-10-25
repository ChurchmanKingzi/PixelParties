'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const config = require('../config');

test('.env-Leser: Kommentare, Anführungszeichen, leere Werte; bereits gesetzte Variablen gewinnen', () => {
  const f = path.join(os.tmpdir(), 'pp-env-test-' + process.pid);
  fs.writeFileSync(f, ['# Kommentar', 'T_A=123   # Hinweis', 'T_B=', 'T_C=   # nur Kommentar', 'T_D="mit # Raute"', "T_E='x y'", 'T_F=plain', 'T_SET=aus_datei', ''].join('\n'));
  process.env.T_SET = 'aus_umgebung';
  config._loadEnvFile(f);
  assert.equal(process.env.T_A, '123');
  assert.equal(process.env.T_B, '');
  assert.equal(process.env.T_C, '');
  assert.equal(process.env.T_D, 'mit # Raute');
  assert.equal(process.env.T_E, 'x y');
  assert.equal(process.env.T_F, 'plain');
  assert.equal(process.env.T_SET, 'aus_umgebung');
  fs.unlinkSync(f);
});

test('.env.example lädt als „alles aus“: keine Kanal-ID und kein Token wird versehentlich aus Kommentaren gelesen', () => {
  const keys = fs.readFileSync(path.join(__dirname, '..', '.env.example'), 'utf8').split('\n').filter(l => /^[A-Z_]+=/.test(l)).map(l => l.split('=')[0]);
  assert.ok(keys.includes('WELCOME_CHANNEL_ID') && keys.includes('DISCORD_TOKEN'));
  for (const k of keys) delete process.env[k];
  config._loadEnvFile(path.join(__dirname, '..', '.env.example'));
  for (const k of keys) assert.equal(process.env[k] || '', '', k);
});

test('Kanal für neue Karten ist fest 774670375303905291 — eine NEW_CARDS_CHANNEL_ID in der .env/Umgebung ändert nichts', () => {
  const { execFileSync } = require('child_process');
  const lauf = env => execFileSync(process.execPath, ['-e', "console.log(require('./config').channels.newCards)"], { cwd: path.join(__dirname, '..'), env: { ...process.env, ...env }, encoding: 'utf8' }).trim().split('\n').pop();
  assert.equal(lauf({ NEW_CARDS_CHANNEL_ID: '' }), '774670375303905291');
  assert.equal(lauf({ NEW_CARDS_CHANNEL_ID: '123456789' }), '774670375303905291');
  assert.equal(lauf({ NEW_CARDS_CHANNEL_ID: '0' }), '774670375303905291');
});
