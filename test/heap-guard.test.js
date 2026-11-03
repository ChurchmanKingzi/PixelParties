'use strict';
// Heap-Wächter: `heapSample()` ist der billige Ersatz für `process.memoryUsage()` (RSS nur bei jeder 8. Probe neu gelesen); der Wächter
// (`heapGuardExceeded`) trippt bei Heap-Überschreitung wie vorher und lässt den RSS-Vergleich bei einem veralteten RSS aus.
const test = require('node:test');
const assert = require('node:assert/strict');
const { _heapSample: heapSample, _heapGuardExceeded: heapGuardExceeded } = require('../cards/effects/_engine');

test('heapSample: dieselben Heap-Zahlen wie process.memoryUsage(), RSS nur jede 8. Probe frisch', () => {
  const mu = process.memoryUsage();
  const fresh = [];
  let s;
  for (let i = 0; i < 32; i++) { s = heapSample(); fresh.push(s.rssFresh); }
  assert.equal(fresh.filter(Boolean).length, 4, 'in 32 Proben genau vier frische RSS-Lesungen');
  const first = fresh.indexOf(true);
  assert.ok(first >= 0 && first < 8);
  for (let i = first; i < 32; i += 8) assert.equal(fresh[i], true, 'frisch im Abstand von 8');
  assert.ok(Number.isFinite(s.rss) && s.rss > 0, 'veralteter Wert bleibt eine Zahl');
  assert.ok(Math.abs(s.heapUsed - mu.heapUsed) < 64 * 1048576, 'heapUsed wie process.memoryUsage()');
  assert.ok(Math.abs(s.heapTotal - mu.heapTotal) < 64 * 1048576, 'heapTotal wie process.memoryUsage()');
});

test('heapGuardExceeded: Heap-Überschreitung trippt, veralteter RSS wird nicht verglichen', () => {
  const MB = 1048576;
  const calm = { rss: 200 * MB, rssFresh: true, heapTotal: 100 * MB, heapUsed: 50 * MB };
  assert.equal(heapGuardExceeded(calm), null);
  assert.match(heapGuardExceeded({ ...calm, heapUsed: 1e6 * MB }), /heapUsed/);
  assert.match(heapGuardExceeded({ ...calm, heapTotal: 1e6 * MB }), /heapTotal/);
  // Heap im „unruhigen" Bereich (über der Hälfte der heapUsed-Schwelle), sonst zieht der Wächter eine hohe RSS-Probe als Grundlast nach.
  const limit = require('v8').getHeapStatistics().heap_size_limit / MB;
  const busy = { rss: 200 * MB, rssFresh: true, heapTotal: 0.45 * limit * MB, heapUsed: 0.4 * limit * MB };
  assert.equal(heapGuardExceeded(busy), null);
  assert.match(heapGuardExceeded({ ...busy, rss: 1e6 * MB }), /^rss /, 'frischer RSS über der Schwelle trippt');
  assert.equal(heapGuardExceeded({ ...busy, rss: 1e6 * MB, rssFresh: false }), null, 'veralteter RSS wird nicht verglichen');
  assert.match(heapGuardExceeded({ ...calm, heapUsed: 1e6 * MB, rssFresh: false }), /heapUsed/, 'Heap-Schwellen gelten auch bei veraltetem RSS');
  assert.equal(heapGuardExceeded({ rss: 200 * MB, heapTotal: 100 * MB, heapUsed: 50 * MB }), null, 'Form von process.memoryUsage() (ohne rssFresh) gilt als frisch');
});
