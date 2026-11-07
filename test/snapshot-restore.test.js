'use strict';
// Snapshot/Restore der Engine (Grundlage jeder CPU-Suche): nach dem Zurückspielen muss der Zustand EXAKT der vom Schnappschuss sein —
// Inhalt, Identität von gs/players/players[i], Kartenkopien mit Prototyp und alter Kennung, Schlüsselreihenfolge wie beim bisherigen
// „alles löschen, in Quell-Reihenfolge neu anlegen". Dazu: leere Objekte (statuses/counters) werden nie zwischen Schnappschuss und Zustand geteilt.
const test = require('node:test');
const assert = require('node:assert/strict');
const v8 = require('node:v8');
const { GameEngine, CardInstance } = require('../cards/effects/_engine');

function neueEngine() {
  const gs = {
    turn: 3, activePlayer: 0, currentPhase: 2, log: [],
    players: [
      { name: 'A', hand: ['x', 'y'], heroes: [{ hp: 10, name: 'H1' }], gold: 5, deck: ['a', 'b', 'c'] },
      { name: 'B', hand: [], heroes: [{ hp: 7, name: 'H2' }], gold: 1, deck: [] },
    ],
  };
  const e = new GameEngine({ gameState: gs }, null, () => {});
  e.cardInstances.push(new CardInstance('Fireball', 0, 'hand'), new CardInstance('Ice', 1, 'support', 0, 2), new CardInstance('Rock', 1, 'hand'));
  e.cardInstances[1].counters.foo = 3;
  e.cardInstances[1].statuses.frozen = { duration: 2 };
  return e;
}

// Das bisherige Verhalten von restore() für gs und Spielerobjekte, als Referenz.
function altesVerhalten(origGs, newGs) {
  for (let i = 0; i < newGs.players.length; i++) {
    const origPs = origGs.players[i], newPs = newGs.players[i];
    for (const k of Object.keys(origPs)) delete origPs[k];
    for (const k of Object.keys(newPs)) origPs[k] = newPs[k];
  }
  for (const k of Object.keys(origGs)) { if (k !== 'players') delete origGs[k]; }
  for (const k of Object.keys(newGs)) { if (k !== 'players') origGs[k] = newGs[k]; }
}

const zustand = (e) => JSON.stringify([e.gs, e.cardInstances]);

test('Roundtrip: Inhalt, Identität und Kartenkopien stimmen nach dem Zurückspielen', () => {
  const e = neueEngine();
  const gs = e.gs, players = gs.players, p0 = players[0], p1 = players[1];
  const vorher = JSON.stringify(e.cardInstances);
  const ids = e.cardInstances.map(c => c.id);
  const s = e.snapshot();
  gs.turn = 9; gs.neu = { x: 1 }; p0.gold = 99; p0.extra = [1]; delete p1.gold; p0.hand.push('z');
  e.cardInstances.length = 0;
  e.restore(s);
  assert.equal(e.gs, gs); assert.equal(e.gs.players, players); assert.equal(e.gs.players[0], p0); assert.equal(e.gs.players[1], p1);
  assert.equal(gs.turn, 3); assert.equal('neu' in gs, false); assert.equal(p0.gold, 5); assert.equal('extra' in p0, false);
  assert.equal(p1.gold, 1); assert.deepEqual(p0.hand, ['x', 'y']);
  assert.equal(JSON.stringify(e.cardInstances), vorher);
  assert.deepEqual(e.cardInstances.map(c => c.id), ids, 'alte Kennungen bleiben');
  for (const c of e.cardInstances) { assert.ok(c instanceof CardInstance); assert.equal(c.script, null); }
});

test('Schlüsselreihenfolge von gs und Spielern wie beim bisherigen Zurückspielen (Wert geändert / Schlüssel dazu / Schlüssel weg)', () => {
  for (const eingriff of [
    (gs) => { gs.turn = 9; gs.players[0].gold = 0; },
    (gs) => { gs.neu = 1; gs.players[0].extra = 2; },
    (gs) => { delete gs.currentPhase; delete gs.players[1].deck; },
    (gs) => { delete gs.turn; gs.turn = 5; delete gs.players[0].name; gs.players[0].name = 'Q'; },
  ]) {
    const e = neueEngine(), ref = neueEngine();
    const s = e.snapshot(), refSnap = structuredClone(ref.snapshot().gs);
    eingriff(e.gs); eingriff(ref.gs);
    e.restore(s);
    altesVerhalten(ref.gs, refSnap);
    // gs: wie bisher bis auf die Stelle von `players` in der Schlüsselliste (bleibt jetzt stehen statt nach vorn zu rutschen)
    assert.deepEqual(Object.keys(e.gs).filter(k => k !== 'players'), Object.keys(ref.gs).filter(k => k !== 'players'));
    for (let i = 0; i < 2; i++) assert.deepEqual(Object.keys(e.gs.players[i]), Object.keys(ref.gs.players[i]));
    const ohneSpieler = (g) => JSON.stringify(Object.fromEntries(Object.entries(g).filter(([k]) => k !== 'players')));
    assert.equal(ohneSpieler(e.gs), ohneSpieler(ref.gs));
    assert.equal(JSON.stringify(e.gs.players), JSON.stringify(ref.gs.players));
  }
});

test('leere statuses/counters der Kartenkopien werden nie mit dem Schnappschuss geteilt', () => {
  const e = neueEngine();
  const s = e.snapshot();
  e.restore(s);
  e.cardInstances[0].counters.mutiert = 1; e.cardInstances[0].statuses.x = { y: 1 };
  e.restore(s);
  assert.deepEqual(e.cardInstances[0].counters, {});
  assert.deepEqual(e.cardInstances[0].statuses, {});
  assert.notEqual(e.cardInstances[0].counters, e.cardInstances[2].counters);
  const nochmal = e.snapshot();
  e.cardInstances[1].counters.foo = 4; e.cardInstances[1].statuses.frozen.duration = 0;
  e.restore(nochmal);
  assert.equal(e.cardInstances[1].counters.foo, 3); assert.equal(e.cardInstances[1].statuses.frozen.duration, 2);
});

test('mehrfaches Zurückspielen desselben Schnappschusses ist stabil', () => {
  const e = neueEngine();
  const s = e.snapshot(), vorher = zustand(e);
  for (let i = 0; i < 4; i++) {
    e.gs.turn += 1; e.gs.players[0].gold += 1; e.cardInstances[0].zone = 'discard'; e.gs.players[1].hand.push('q');
    e.restore(s);
    assert.equal(zustand(e), vorher);
  }
});

test('gs und Spielerobjekte bleiben im schnellen V8-Modus (Dictionary-Modus verlangsamt jeden Zugriff der Simulation)', (t) => {
  let schnell;
  try { v8.setFlagsFromString('--allow-natives-syntax'); schnell = new Function('o', 'return %HasFastProperties(o)'); } catch { return t.skip('V8-Intrinsics nicht verfügbar'); }
  const e = neueEngine();
  if (!schnell(e.gs.players[0]) || !schnell(e.gs)) return t.skip('Testobjekte starten schon im Dictionary-Modus');
  const s = e.snapshot();
  for (let i = 0; i < 3; i++) { e.gs.turn += 1; e.gs.players[0].gold += 1; e.restore(s); }
  assert.equal(schnell(e.gs.players[0]), true, 'players[0]');
  assert.equal(schnell(e.gs.players[1]), true, 'players[1]');
  assert.equal(schnell(e.gs), true, 'gs');
});
