'use strict';
// Worker-Thread des Lernsystems: spielt auf Zuruf EINE Partie headless (skilltest/sim.js) und meldet die Aufzeichnung zurück.
// Läuft in einem eigenen Thread, damit eine hängende Partie (Endlosschleife einer Karte) den Trainer nicht lahmlegt —
// der Trainer beendet den Worker nach einer Zeitüberschreitung und startet einen neuen (learn/train.js, WorkerPool).
const { parentPort } = require('worker_threads');
process.env.PP_ST_SIM = '1';
if (!process.env.NODE_ENV) process.env.NODE_ENV = 'production';

// Protokollzeilen der Spiel-Engine stumm schalten (Hunderte Partien würden die Konsole fluten).
const origLog = console.log.bind(console);
console.log = (...a) => {
  const first = typeof a[0] === 'string' ? a[0] : '';
  if (/^\[(skilltest\] Raum|deck-profile|heap-guard|build|DB)/.test(first)) return;
  origLog(...a);
};

const { runGame } = require('../sim');

parentPort.on('message', async (job) => {
  try {
    if (job.opts && job.opts.reloadProfile) require('./profile').reset();      // Vergleichsspiele sehen den frisch gespeicherten Stand
    const rec = await runGame(job.opts);
    delete rec.room;
    parentPort.postMessage({ id: job.id, ok: true, rec });
  } catch (e) {
    parentPort.postMessage({ id: job.id, ok: false, error: String((e && e.message) || e) });
  }
});
parentPort.postMessage({ ready: true });
