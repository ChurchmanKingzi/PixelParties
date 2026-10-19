'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const b = require('../lib/bracket');

const mk = n => ({ name: 'T', status: 'signup', players: Array.from({ length: n }, (_, i) => 'p' + (i + 1)) });
const seeded = () => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; };

/** Spielt ein Turnier durch; Sieger = Spieler mit der kleineren Nummer. */
function playOut(state) {
  let guard = 0;
  while (state.status === 'running' && guard++ < 100) {
    const m = b.pendingMatches(state)[0];
    const w = Number(m.a.slice(1)) < Number(m.b.slice(1)) ? m.a : m.b;
    const r = b.report(state, w);
    assert.ok(r.ok, r.error);
  }
  return state;
}

test('2 bis 33 Spieler: genau ein Sieger, immer der beste (p1), jeder Spieler spielt höchstens log2-viele Runden', () => {
  for (let n = 2; n <= 33; n++) {
    const s = b.start(mk(n), seeded());
    playOut(s);
    assert.equal(s.status, 'finished', 'n=' + n);
    assert.equal(s.champion, 'p1', 'n=' + n);
    assert.ok(s.rounds.length <= Math.log2(b.nextPow2(n)) + 0, 'n=' + n);
  }
});

test('Freilose: nie zwei Freilose in einem Spiel, jeder Spieler kommt vor', () => {
  for (let n = 3; n <= 20; n++) {
    const s = b.start(mk(n), seeded());
    const first = s.rounds[0];
    const seen = first.flatMap(m => [m.a, m.b]).filter(Boolean);
    assert.equal(new Set(seen).size, n, 'n=' + n);
    assert.equal(first.filter(m => !m.b).length, b.nextPow2(n) - n);
    assert.ok(first.every(m => m.a), 'n=' + n);
  }
});

test('4 Spieler: Meldungen, nächste Runde entsteht, falscher Spieler wird abgelehnt', () => {
  const s = b.start(mk(4), seeded());
  assert.equal(b.pendingMatches(s).length, 2);
  const [m1, m2] = b.pendingMatches(s);
  assert.equal(b.report(s, 'nobody').ok, false);
  assert.equal(b.report(s, m1.a).ok, true);
  assert.equal(b.report(s, m1.b).ok, false, 'Match schon entschieden');
  const r = b.report(s, m2.b);
  assert.equal(r.newMatches.length, 1);
  assert.equal(s.rounds.length, 2);
  const fin = b.report(s, m1.a);
  assert.equal(fin.champion, m1.a);
  assert.equal(s.status, 'finished');
  assert.equal(b.report(s, 'p1').ok, false);
});

test('Ausschluss: Anmeldung und laufendes Turnier', () => {
  const s = mk(4);
  assert.equal(b.disqualify(s, 'p2').ok, true);
  assert.deepEqual(s.players, ['p1', 'p3', 'p4']);
  assert.equal(b.disqualify(s, 'zzz').ok, false);
  b.start(s, seeded());
  const m = b.pendingMatches(s).find(x => x.b);
  const r = b.disqualify(s, m.a);
  assert.equal(r.ok, true);
  assert.equal(m.winner, m.b);
});

test('mindestens 2 Spieler', () => {
  assert.throws(() => b.start(mk(1)));
});

test('describe: eine Gruppe je Runde, Finale benannt', () => {
  const s = b.start(mk(4), seeded());
  const d = b.describe(s);
  assert.equal(d[0].title, 'Semifinals');
  playOut(s);
  assert.equal(b.describe(s).at(-1).title, 'Final');
});
