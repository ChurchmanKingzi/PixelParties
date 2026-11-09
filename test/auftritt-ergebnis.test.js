'use strict';
// Auftritts-Puffer (`_auftrittZustandHalten`): Ein Spielergebnis darf nie zurückgehalten werden, und ein hängender Puffer gibt den Zustand nach
// AUFTRITT_HALTE_MAX_MS von selbst frei. Sonst bleibt ein Spieler nach Aufgabe/Heldentod/Ausscheiden ohne Ergebnis im Brett hängen.
const test = require('node:test');
const assert = require('node:assert/strict');
const { GameEngine } = require('../cards/effects/_engine');

function engine({ result = null, frageOffen = false } = {}) {
  const gesendet = [], emits = [];
  const io = { to: (sid) => ({ emit: (ev, data) => emits.push([sid, ev, data]) }) };
  const e = Object.create(GameEngine.prototype);
  Object.assign(e, {
    gs: { turn: 1, players: [{ socketId: 's0' }, { socketId: 's1' }], _pendingCardReveal: { cardName: 'Fireball', ownerIdx: 0 }, result },
    io, room: { spectators: [{ socketId: 'spec' }] },
    sendGameState: (room, i) => gesendet.push(['spieler', i]), sendSpectatorGameState: () => gesendet.push(['zuschauer']),
    playerCount: () => 2, _feuereZusageAuftritte() {}, _firePendingPlayLog() {}, _fuehreCommitAktionenAus() {},
  });
  if (frageOffen) { e.gs.effectPrompt = { ownerIdx: 0 }; e._pendingGenericPrompt = {}; }
  return { e, gesendet, emits };
}

test('ohne Ergebnis hält die Vormerkung den Zustand vom Gegner zurück (unverändert)', () => {
  const { e } = engine();
  assert.equal(e._auftrittZustandHalten(1), 'halten');
  assert.ok(e.gs._pendingCardReveal, 'Vormerkung bleibt offen');
  e._auftrittWaechterStellen && clearTimeout(e._auftrittWaechter && e._auftrittWaechter.t);
});

test('mit Ergebnis: nichts wird zurückgehalten, Auftritt und Zustand gehen sofort raus (auch bei `_holdCardReveal`)', () => {
  const { e, gesendet, emits } = engine({ result: { winnerIdx: 1 } });
  e.gs._holdCardReveal = true;
  assert.equal(e._auftrittZustandHalten(1), false);
  assert.equal(e.gs._pendingCardReveal, undefined, 'Vormerkung ausgeliefert');
  assert.ok(emits.some(([sid, ev]) => sid === 's1' && ev === 'card_reveal'), 'Gegner sieht den Auftritt');
  assert.equal(e._auftrittZustandHalten(-1), false, 'Zuschauer ebenso');
  assert.ok(gesendet.length === 0 || gesendet.every(g => g[0] !== 'spieler' || g[1] === 1));
});

test('mit Ergebnis halten auch die direkten Sendungen nichts zurück', () => {
  const { e } = engine({ result: { winnerIdx: 0 } });
  assert.equal(e._auftrittHaelt(0, 'action_log', {}, 'gegner'), false);
});

test('Fail-safe: ein hängender Puffer gibt den Zustand nach AUFTRITT_HALTE_MAX_MS frei', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { e, gesendet } = engine();
  assert.equal(e._auftrittZustandHalten(1), 'halten');
  t.mock.timers.tick(3999);
  assert.ok(e.gs._pendingCardReveal, 'noch gehalten');
  t.mock.timers.tick(2);
  assert.equal(e.gs._pendingCardReveal, undefined, 'freigegeben');
  assert.ok(gesendet.some(g => g[0] === 'spieler' && g[1] === 1), 'der zurückgehaltene Zustand wurde nachgeliefert');
});

test('Fail-safe: mit offener Frage des Besitzers (er überlegt noch) bleibt der Auftritt gehalten', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { e } = engine({ frageOffen: true });
  assert.equal(e._auftrittZustandHalten(1), 'huelle');
  t.mock.timers.tick(9000);
  assert.ok(e.gs._pendingCardReveal, 'Vormerkung bleibt, solange die Frage offen ist');
  e.gs.effectPrompt = null; e._pendingGenericPrompt = null;   // Frage beantwortet, aber kein Commit gekommen
  t.mock.timers.tick(4100);
  assert.equal(e.gs._pendingCardReveal, undefined, 'danach greift das Fail-safe');
});

test('das Ergebnis-Spielende gibt auch einen gewachten Puffer sofort frei', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { e } = engine();
  assert.equal(e._auftrittZustandHalten(1), 'halten');
  e.gs.result = { winnerIdx: 1 };
  assert.equal(e._auftrittZustandHalten(1), false);
  assert.equal(e.gs._pendingCardReveal, undefined);
});
