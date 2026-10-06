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

let _fails = 0;
function check(name, cond, info) {
  if (cond) console.log('  ✓', name);
  else { _fails++; console.log('  ✗', name, info !== undefined ? '→ ' + JSON.stringify(info).slice(0, 400) : ''); }
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function finish() { console.log(_fails ? `\n${_fails} Prüfung(en) FEHLGESCHLAGEN` : '\nAlles bestanden'); return _fails; }

module.exports = { startServer, guestClient, check, sleep, finish, BASE };
