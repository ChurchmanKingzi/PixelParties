'use strict';
// Zustandslog fürs CPU-Wertnetz (cards/effects/_value-encode.js): Bytes, Rückrechnung, ehrliche Sicht, Dateien, Erweiterbarkeit.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const V = require('../cards/effects/_value-encode');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ppv-'));

// Eine kleine, aber vollständige Stellung (Zwischenform), für Rückrechnung und Dateien.
const seat = (k) => ({
  sc: Object.fromEntries(V.SEAT_SCALARS.map((n, i) => [n, k * 100 + i - 3])),   // enthält auch negative Werte
  heroes: [[11, 0, 350, 350, 30, 5, 1], [12, 1, 0, 300, 20, 0, 0]],
  abil: [[0, 0, 7, 3], [1, 2, 9, 1]],
  sup: [[0, 1, 21, 140, 0, 4, 0, 2, 1], [1, 0, 22, 60, 8, 1 + 2, 3, 0, 0]],
  sur: [[0, 0, 31], [2, 1, 32]],
  area: [41, 42], perm: [51],
  disc: [[5, 2], [6, 1]], del: [[8, 1]], hand: [[3, 1], [4, 2]],
});
const state = (over = {}) => ({ trig: 1, turn: 6, phase: 2, active: 0, seats: [seat(0), seat(1)], ev: [123, -123], extra: [], ...over });

test('Zickzack-Zahlen und LEB128: Randwerte kommen unverändert zurück', () => {
  const w = new V.Writer(4);
  const vals = [0, 1, -1, 63, 64, -64, 127, 128, -129, 16383, 16384, 2 ** 31, -(2 ** 31), 2 ** 40, -(2 ** 40)];
  for (const v of vals) w.sv(v);
  for (const v of [0, 1, 127, 128, 2 ** 35]) w.uv(v);
  const r = new V.Reader(Buffer.from(w.bytes()));
  for (const v of vals) assert.equal(r.sv(), v);
  for (const v of [0, 1, 127, 128, 2 ** 35]) assert.equal(r.uv(), v);
  assert.throws(() => r.u8(), /Ende/);
});

test('Zustand → Bytes → Zustand: gleich, auch mit Bewertung und ohne', () => {
  for (const S of [state(), state({ ev: [null, null] }), state({ ev: [null, -7] }), state({ trig: 0, turn: 0 })]) {
    assert.deepEqual(V.readState(V.writeState(S)), S);
  }
});

test('Vergleichsteil ignoriert Auslöser, nicht aber die Stellung', () => {
  const a = V.bodyOf(V.writeState(state({ trig: 0 }))), b = V.bodyOf(V.writeState(state({ trig: 1 })));
  assert.ok(a.equals(b), 'nur der Auslöser unterscheidet sich');
  const S = state(); S.seats[0].sc.gold += 1;
  assert.ok(!V.bodyOf(V.writeState(S)).equals(b), 'anderes Gold = andere Stellung');
});

test('unbekannte Zusatzblöcke überleben das Lesen (Erweiterbarkeit)', () => {
  const S = state({ extra: [{ type: 200, bytes: Buffer.from([1, 2, 3]) }, { type: 201, bytes: Buffer.alloc(0) }] });
  const back = V.readState(V.writeState(S));
  assert.deepEqual(back.extra.map(e => [e.type, [...e.bytes]]), [[200, [1, 2, 3]], [201, []]]);
});

test('ehrliche Sicht: Gegnerhand und verdeckte Gegnerkarten fehlen, die eigenen bleiben', () => {
  const S = state();
  const v0 = V.honestView(S, 0), v1 = V.honestView(S, 1);
  assert.deepEqual(v0.self.hand, S.seats[0].hand);
  assert.deepEqual(v0.opp.hand, [], 'Gegnerhand unsichtbar');
  assert.equal(v0.opp.sc.hand, S.seats[1].sc.hand, 'nur ihre Größe ist öffentlich');
  assert.ok(v0.opp.sur.every(t => t[2] === 0) && v0.opp.sur.length === S.seats[1].sur.length, 'Surprises: Anzahl ja, Name nein');
  assert.equal(v0.opp.sup[1][2], 0, 'verdeckte Support-Karte des Gegners ohne Namen');
  assert.equal(v0.opp.sup[0][2], S.seats[1].sup[0][2], 'offene Support-Karte sichtbar');
  assert.deepEqual(v0.self.sur, S.seats[0].sur, 'eigene Surprises sichtbar');
  assert.equal(v0.myTurn, true); assert.equal(v1.myTurn, false);
  assert.equal(v0.ev, 123); assert.equal(v1.ev, -123);
  assert.deepEqual(S.seats[1].hand, seat(1).hand, 'die Eingabe bleibt unverändert');
});

test('extractState liest eine Engine-Stellung (Helden, Fähigkeiten, Support, Ablage) und lässt sie unberührt', () => {
  const vocab = V.loadVocab();
  const ids = (...n) => n.map(x => vocab.idOfName.get(x));
  assert.ok(ids('Deepsea Idol', 'Skeleton Bard', 'Cosmic Skeleton').every(Boolean), 'Testkarten stehen im Vokabular');
  const gs = {
    turn: 6, currentPhase: 2, activePlayer: 1,
    areaZones: [[], ['Cosmic Skeleton']],
    players: [
      { gold: 8, hand: ['Deepsea Idol', 'Deepsea Idol', 'Skeleton Bard'], mainDeck: new Array(20).fill('x'), potionDeck: [], discardPile: ['Skeleton Bard'], deletedPile: [],
        heroes: [{ name: 'Cute Nerd Magenta', hp: 350, maxHp: 350, atk: 30, statuses: { burned: true } }, { name: '', hp: 0 }],
        abilityZones: [[['Necromancy', 'Necromancy', 'Necromancy'], [], []], [[], [], []]], surpriseZones: [['Cosmic Skeleton'], []],
        supportZones: [[[], [], []]], permanents: [], coolnessStack: [], heroesActedThisTurn: [0], summonLocked: true },
      { gold: 3, hand: [], mainDeck: [], potionDeck: [], discardPile: [], deletedPile: [], heroes: [], abilityZones: [], surpriseZones: [], permanents: [{ name: 'Deepsea Idol' }], coolnessStack: [] },
    ],
  };
  const eng = {
    gs,
    physicalSide: (i) => i.owner,
    cardInstances: [
      { zone: 'support', owner: 1, controller: 0, name: 'Cosmic Skeleton', heroIdx: 0, zoneSlot: 2, counters: { currentHp: 140, buffs: { a: 1 }, extra: 2 }, statuses: {}, turnPlayed: 4, faceDown: false },
      { zone: 'hand', owner: 0, name: 'Deepsea Idol', counters: {} },
    ],
  };
  const before = JSON.stringify(gs);
  const S = V.extractState(eng, 1, [5, -5]);
  assert.equal(JSON.stringify(gs), before, 'reine Abfrage');
  assert.equal(S.turn, 6); assert.equal(S.active, 1); assert.deepEqual(S.ev, [5, -5]);
  const a = S.seats[0];
  assert.equal(a.sc.gold, 8); assert.equal(a.sc.hand, 3); assert.equal(a.sc.deck, 20); assert.equal(a.sc.acted, 1);
  assert.equal(a.sc.locks & 1, 1, 'Sperre „summonLocked" gesetzt');
  assert.equal(a.heroes.length, 1, 'leere Heldenplätze fehlen');
  assert.deepEqual(a.heroes[0].slice(1, 5), [0, 350, 350, 30]);
  assert.equal(a.heroes[0][6], 1 + 2, 'lebt und hat gehandelt');
  assert.deepEqual(a.abil, [[0, 0, vocab.idOfName.get('Necromancy'), 3]]);
  assert.deepEqual(a.hand, [...ids('Deepsea Idol').map(i => [i, 2]), ...ids('Skeleton Bard').map(i => [i, 1])].sort((x, y) => x[0] - y[0]));
  assert.deepEqual(a.sur, [[0, 0, vocab.idOfName.get('Cosmic Skeleton')]]);
  assert.deepEqual(S.seats[1].area, ids('Cosmic Skeleton'));
  assert.deepEqual(S.seats[1].perm, ids('Deepsea Idol'));
  const sup = S.seats[1].sup;
  assert.equal(sup.length, 1, 'Support-Karte liegt auf der Brettseite 1');
  assert.deepEqual(sup[0].slice(0, 4), [0, 2, vocab.idOfName.get('Cosmic Skeleton'), 140]);
  assert.equal(sup[0][5] & 2, 2, 'geliehen: Kontrolleur ≠ Brettseite');
  assert.equal(sup[0][6], 2, 'Alter = Zug 6 − gelegt in Zug 4');
  assert.equal(sup[0][7], 2, 'Zähler ohne currentHp'); assert.equal(sup[0][8], 1, 'eine Verstärkung');
  assert.deepEqual(V.readState(V.writeState(S)), S, 'und die Bytes geben es wieder her');
});

test('Spielblock: packen, finden, lesen; Dateien zusammenführen; abgeschnittenes Ende reparieren', () => {
  const dir = tmp();
  try {
    const mk = (idx, win, n) => {
      const states = Array.from({ length: n }, (_, i) => V.writeState(state({ turn: i })));
      const w = new V.Writer();
      for (const s of states) { w.uv(s.length); w.raw(s); }
      return V.packBlock(idx, n, win, 1, Buffer.from(w.bytes()));
    };
    const fA = path.join(dir, 'a.states'), fB = path.join(dir, 'b.states'), out = path.join(dir, 'm.states');
    V.appendBlock(fA, mk(5, 0, 3)); V.appendBlock(fA, mk(2, 1, 1));
    V.appendBlock(fB, mk(3, -1, 2)); V.appendBlock(fB, mk(5, 1, 9));   // 5 gibt es doppelt: der erste (aus a) gewinnt
    const scan = V.scanFile(fA);
    assert.deepEqual(scan.blocks.map(b => b.gameIdx), [5, 2]);
    const blk = V.readBlock(V.readBlockBytes(fA, scan.blocks[0]));
    assert.equal(blk.gameIdx, 5); assert.equal(blk.winner, 0); assert.equal(blk.pinned, 1); assert.equal(blk.states.length, 3);
    assert.deepEqual(blk.states.map(s => s.turn), [0, 1, 2]);
    assert.equal(V.readBlock(V.readBlockBytes(fA, scan.blocks[1])).winner, 1);

    const m = V.mergeFiles(out, [fA, fB], new Set([2, 3, 5]));
    assert.equal(m.games, 3);
    const merged = V.scanFile(out).blocks;
    assert.deepEqual(merged.map(b => b.gameIdx), [2, 3, 5], 'nach gameIdx sortiert');
    assert.equal(merged[2].nStates, 3, 'bei doppeltem Spiel zählt der erste Block');
    assert.equal(V.mergeFiles(out, [out], new Set([3])).games, 1, '`keep` beschränkt auf Spiele der jsonl');

    // Absturz mitten im Schreiben: halber Block am Ende
    fs.appendFileSync(fA, mk(7, 0, 4).subarray(0, 40));
    assert.equal(V.scanFile(fA).blocks.length, 2, 'der halbe Block zählt nicht');
    assert.ok(V.repairFile(fA) > 0);
    assert.equal(V.repairFile(fA), 0);
    V.appendBlock(fA, mk(8, 0, 1));
    assert.deepEqual(V.scanFile(fA).blocks.map(b => b.gameIdx), [5, 2, 8], 'danach geht es sauber weiter');
    assert.deepEqual(V.scanFile(path.join(dir, 'gibtsnicht')).blocks, []);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('ValueLog: lässt Wiederholungen, Simulationen, Spielende und offene Zauber aus; stört den Zufallsstrom nicht', () => {
  const gs = {
    turn: 3, currentPhase: 2, activePlayer: 0, areaZones: [[], []],
    players: [0, 1].map(() => ({ gold: 4, hand: [], mainDeck: [], potionDeck: [], discardPile: [], deletedPile: [], heroes: [], abilityZones: [], surpriseZones: [], permanents: [], coolnessStack: [] })),
  };
  let calls = 0;
  const eng = { gs, cardInstances: [], physicalSide: (i) => i.owner, _cpuEvaluateState: (seat) => { calls++; Math.random(); return seat === 0 ? 10.4 : -10.4; } };
  const log = new V.ValueLog(eng);

  const rnd = Math.random; let seed = 0.25;
  Math.random = () => (seed = (seed * 3.7) % 1);        // erkennbarer Strom
  try {
    const expected = []; let s2 = 0.25; for (let i = 0; i < 3; i++) expected.push(s2 = (s2 * 3.7) % 1);
    log.capture(0);
    assert.equal(log.states.length, 1);
    assert.equal(calls, 2, 'eine Bewertung je Sitz');
    assert.equal(Math.random(), expected[0], 'die Bewertung verbrauchte keine Zufallszahl des Spiels');
    log.capture(1);                                      // gleiche Stellung → nicht nochmal
    assert.equal(log.states.length, 1);
    gs.players[0].gold = 5; log.capture(1);
    assert.equal(log.states.length, 2);
    eng._inMctsSim = true; gs.players[0].gold = 6; log.capture(1); eng._inMctsSim = false;
    gs._spellResolutionDepth = 1; log.capture(1); gs._spellResolutionDepth = 0;
    gs.result = { winnerIdx: 0 }; log.capture(1);
    assert.equal(log.states.length, 2, 'Simulation, offener Zauber und Spielende zählen nicht');
    const s = V.readState(log.states[0]);
    assert.deepEqual(s.ev, [10, -10]); assert.equal(s.trig, 0);
    const blk = V.readBlock(log.pack(9, 1, 0));
    assert.equal(blk.gameIdx, 9); assert.equal(blk.winner, 1); assert.equal(blk.states.length, 2);
    assert.equal(new V.ValueLog(eng).pack(1, 0, 0), null, 'ohne Zustände kein Block');
  } finally { Math.random = rnd; }
});

test('ein Fehler im Log stört nie das Spiel', () => {
  const eng = { get gs() { throw new Error('kaputt'); } };
  assert.doesNotThrow(() => new V.ValueLog(eng).capture(0));
});

test('Vokabular: Kartennummern sind stabil, 0 = unbekannt, jede Karte aus cards.json steht drin', () => {
  const vocab = V.loadVocab();
  assert.equal(vocab.names[0], '');
  assert.equal(V.idOf('Karte die es nicht gibt'), 0);
  assert.ok(V.unknownNames().has('Karte die es nicht gibt'));
  assert.equal(V.nameOf(V.idOf('Skeleton Bard')), 'Skeleton Bard');
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'cards.json'), { encoding: 'utf-8' }));
  const names = [...new Set((Array.isArray(raw) ? raw : Object.values(raw)).map(c => c && c.name).filter(Boolean))];
  const missing = names.filter(n => !vocab.idOfName.has(n));
  assert.deepEqual(missing, [], 'neue Karten: node scripts/value/build-vocab.js ausführen');
  assert.ok(vocab.statuses.length <= 32);
});
