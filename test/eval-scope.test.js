'use strict';
// Auswertungs-Scope der Engine (`_scoped` & Co.): reine Abfragen werden innerhalb EINER CPU-Bewertung nur einmal gerechnet, Proben mit
// vorübergehend verändertem Zustand bekommen einen frischen Scope, außerhalb gibt es keinen Cache.
const test = require('node:test');
const assert = require('node:assert/strict');
const { GameEngine } = require('../cards/effects/_engine');

const newEngine = () => Object.create(GameEngine.prototype);

test('ohne Scope wird jedes Mal neu gerechnet', () => {
  const e = newEngine();
  let n = 0; const f = () => ++n;
  assert.equal(e._scoped('x', 'a', f), 1);
  assert.equal(e._scoped('x', 'a', f), 2);
});

test('im Scope: einmal je Name und Schlüssel; Schließen stellt den äußeren Zustand wieder her', () => {
  const e = newEngine();
  let n = 0; const f = () => ++n;
  const prev = e._evalScopeOpen();
  assert.equal(prev, undefined);
  assert.equal(e._scoped('x', 'a', f), 1);
  assert.equal(e._scoped('x', 'a', f), 1, 'Treffer');
  assert.equal(e._scoped('x', 'b', f), 2, 'anderer Schlüssel');
  assert.equal(e._scoped('y', 'a', f), 3, 'anderer Name');
  e._evalScopeClose(prev);
  assert.equal(e._evalScope, undefined);
  assert.equal(e._scoped('x', 'a', f), 4, 'nach dem Schließen wieder ungecacht');
});

test('Probe mit verändertem Zustand: frischer Scope darin, äußerer unverändert danach', () => {
  const e = newEngine();
  const state = { hp: 0 };
  const alive = () => state.hp > 0;
  const prev = e._evalScopeOpen();
  assert.equal(e._scoped('alive', 'h0', alive), false);
  const inProbe = e._withFreshEvalScope(() => {
    state.hp = 100;                                           // vorübergehend „wiederbelebt"
    try { return e._scoped('alive', 'h0', alive); } finally { state.hp = 0; }
  });
  assert.equal(inProbe, true, 'in der Probe zählt der veränderte Zustand, nicht der Cache davor');
  assert.equal(e._scoped('alive', 'h0', alive), false, 'danach gilt wieder der Treffer des äußeren Scopes');
  e._evalScopeClose(prev);
});

test('die Probe-Hilfe stellt den Scope auch bei einer Ausnahme zurück', () => {
  const e = newEngine();
  const prev = e._evalScopeOpen();
  const outer = e._evalScope;
  assert.throws(() => e._withFreshEvalScope(() => { throw new Error('boom'); }), /boom/);
  assert.equal(e._evalScope, outer);
  e._evalScopeClose(prev);
});
