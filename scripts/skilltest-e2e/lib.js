'use strict';
// Gemeinsame Helfer der Skill-Test-End-to-End-Tests.
//
// Voraussetzung: `socket.io-client` ist NICHT Teil des Projekts. Einmalig
// irgendwo installieren und per NODE_PATH bekannt machen:
//   mkdir -p /tmp/st-tools && cd /tmp/st-tools && npm init -y && npm i socket.io-client@4
//   NODE_PATH=/tmp/st-tools/node_modules node scripts/skilltest-e2e/lobby.test.js
const { spawn } = require('child_process');
const path = require('path');
const { io } = require('socket.io-client');

const ROOT = path.join(__dirname, '..', '..');
const PORT = parseInt(process.env.ST_PORT || '3991', 10);
const BASE = `http://127.0.0.1:${PORT}`;

function startServer(extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['server.js'], {
      cwd: ROOT,
      env: { ...process.env, PORT: String(PORT), NODE_ENV: 'production', PP_DEMO_RECORD: '0', ...extraEnv },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    const onData = (d) => {
      out += d.toString();
      if (out.includes('running on http')) { resolve({ child, log: () => out }); }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', (d) => { out += d.toString(); });
    child.on('exit', (c) => reject(new Error('Server beendet (' + c + '):\n' + out.slice(-2000))));
    setTimeout(() => reject(new Error('Server-Start Timeout:\n' + out.slice(-2000))), 90000);
  });
}

async function guestClient(label) {
  const res = await fetch(BASE + '/api/auth/guest', { method: 'POST' });
  const { token, user } = await res.json();
  const socket = io(BASE, { transports: ['websocket'] });
  const events = [];
  socket.onAny((ev, ...args) => events.push({ ev, args }));
  await new Promise((r) => socket.on('connect', r));
  socket.emit('auth', token);
  await new Promise((r) => socket.once('auth_ok', r));
  return {
    label, socket, user, events,
    last: (ev) => { for (let i = events.length - 1; i >= 0; i--) if (events[i].ev === ev) return events[i].args[0]; return null; },
    waitFor: (ev, pred, ms = 8000) => new Promise((resolve, reject) => {
      const hit = [...events].reverse().find(e => e.ev === ev && (!pred || pred(e.args[0])));
      if (hit) return resolve(hit.args[0]);
      const t = setTimeout(() => { socket.off(ev, h); reject(new Error(`Timeout wartet auf ${ev} (${label})`)); }, ms);
      const h = (d) => { if (!pred || pred(d)) { clearTimeout(t); socket.off(ev, h); resolve(d); } };
      socket.on(ev, h);
    }),
    emit: (...a) => socket.emit(...a),
    close: () => socket.close(),
  };
}

// Echtes (nicht-Gast-)Konto direkt in der lokalen SQLite-DB anlegen. Gäste dürfen
// nur gegen die CPU spielen — für Online-Räume braucht der UI-Test ein Konto.
async function createAccount(username, password = 'test1234') {
  const db = require('../../db');
  const bcrypt = require('bcryptjs');
  const { v4: uuidv4 } = require('uuid');
  const id = uuidv4();
  await db.run(
    'INSERT OR IGNORE INTO users (id, username, password_hash, avatar, color, email, email_verified) VALUES (?, ?, ?, ?, ?, ?, 1)',
    [id, username, bcrypt.hashSync(password, 10), null, '#00f0ff', username.toLowerCase() + '@test.local'],
  );
  return { username, password };
}

let _fails = 0;
function check(name, cond, info) {
  if (cond) console.log('  ✓', name);
  else { _fails++; console.log('  ✗', name, info !== undefined ? '→ ' + JSON.stringify(info).slice(0, 400) : ''); }
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function finish() { console.log(_fails ? `\n${_fails} Prüfung(en) FEHLGESCHLAGEN` : '\nAlles bestanden'); return _fails; }

module.exports = { startServer, guestClient, createAccount, check, sleep, finish, BASE };
