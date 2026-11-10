'use strict';
// Wertnetz der CPU (Stufe 2): Merkmale (cards/effects/_value-features.js) und Inferenz (cards/effects/_value-net.js).
// Die Paritätsprobe vergleicht gegen eine Python-Rechnung (scripts/value/train.py), siehe scripts/value/make-parity-fixture.py.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const V = require('../cards/effects/_value-encode');
const F = require('../cards/effects/_value-features');
const { ValueNet } = require('../cards/effects/_value-net');

const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'value-net-parity.json'), { encoding: 'utf-8' }));

function featFromFixture(ex) {
  const f = new F.Features();
  ex.sides.forEach((groups, s) => groups.forEach((g, gi) => {
    const t = f.sides[s][gi];
    t.n = g.ids.length;
    g.ids.forEach((v, k) => { t.ids[k] = v; t.own[k] = g.own[k]; });
    t.x.set(g.x);
  }));
  f.glob.set(ex.glob);
  return f;
}

// Eine kleine, aber vollständige Stellung (Zwischenform wie in test/value-encode.test.js)
const seat = (k) => ({
  sc: Object.fromEntries(V.SEAT_SCALARS.map((n, i) => [n, k * 7 + i])),
  heroes: [[11 + k, 0, 350, 400, 30, 5, 1], [12 + k, 1, 0, 300, 20, 0, 0], [13 + k, 2, 200, 300, 60, 2 ** 24, 3]],
  abil: [[0, 0, 7, 3], [1, 2, 9, 1], [2, 1, 9, 2]],
  sup: [[0, 1, 21, 140, 0, 4, 0, 2, 1], [1, 0, 22, 60, 0, 1 + 2, 3, 0, 0], [2, 2, 23, 0, 0, 0, 40, 805, 3]],
  sur: [[0, 0, 31], [2, 1, 32]],
  area: [41], perm: [51, 52],
  disc: [[5, 2], [6, 1]], del: [[8, 1]], hand: [[3, 1], [4, 2]],
});
const state = (over = {}) => ({ trig: 1, turn: 6, phase: 2, active: 0, seats: [seat(0), seat(1)], ev: [123, -123], extra: [], ...over });

test('Parität: JS-Inferenz liefert dieselben Zahlen wie die Python-Rechnung', () => {
  const net = new ValueNet(fixture.head, Float32Array.from(fixture.floats));
  assert.equal(fixture.examples.length, fixture.expected.length);
  fixture.examples.forEach((ex, i) => {
    const r = net.predict(featFromFixture(ex));
    const [logit, ev, rem] = fixture.expected[i];
    assert.ok(Math.abs(r.logit - logit) < 1e-6 * (1 + Math.abs(logit)), `Logit ${i}: ${r.logit} != ${logit}`);
    assert.ok(Math.abs(r.ev - ev) < 1e-6 * (1 + Math.abs(ev)), `Evaluator-Kopf ${i}: ${r.ev} != ${ev}`);
    assert.ok(Math.abs(r.rem - rem) < 1e-6 * (1 + Math.abs(rem)), `Restzüge ${i}: ${r.rem} != ${rem}`);
  });
});

test('Kalibrierung: logitCal = a·logit + b, ohne Eintrag im Kopf bleibt der Roh-Logit; κ wird gelesen', () => {
  const plain = new ValueNet(fixture.head, Float32Array.from(fixture.floats));
  const cal = new ValueNet({ ...fixture.head, calib: { a: 0.8, b: -0.25 }, kappa: { std: 900, reg: 600 } }, Float32Array.from(fixture.floats));
  assert.equal(plain.calib, null); assert.equal(plain.kappa, null);
  assert.deepEqual(cal.kappa, { std: 900, reg: 600 });
  for (const ex of fixture.examples) {
    const r0 = { ...plain.predict(featFromFixture(ex)) };
    const r1 = { ...cal.predict(featFromFixture(ex)) };
    assert.equal(r0.logitCal, r0.logit, 'ohne Eintrag: gleich dem Roh-Logit');
    assert.equal(r1.logit, r0.logit, 'der Roh-Logit ändert sich nicht');
    assert.ok(Math.abs(r1.logitCal - (0.8 * r0.logit - 0.25)) < 1e-12);
    assert.equal(r1.ev, r0.ev);
  }
  assert.equal(new ValueNet({ ...fixture.head, calib: { a: NaN, b: 0 } }, Float32Array.from(fixture.floats)).calib, null, 'unbrauchbare Werte werden ignoriert');
});

test('Parität: das Ergebnis hängt nicht von Resten früherer Aufrufe ab', () => {
  const net = new ValueNet(fixture.head, Float32Array.from(fixture.floats));
  const a = fixture.examples.map(ex => ({ ...net.predict(featFromFixture(ex)) }));
  const b = fixture.examples.slice().reverse().map(ex => ({ ...net.predict(featFromFixture(ex)) })).reverse();
  assert.deepEqual(a, b);
});

test('Laden: Dateien schreiben und lesen; falsche Version, falsches Layout und abgeschnittene Gewichte werden abgelehnt', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ppnet-'));
  const write = (head, floats) => {
    fs.writeFileSync(path.join(dir, 'net.json'), JSON.stringify(head), { encoding: 'utf-8' });
    fs.writeFileSync(path.join(dir, 'net.f32'), Buffer.from(Float32Array.from(floats).buffer));
  };
  write(fixture.head, fixture.floats);
  const net = ValueNet.load(dir);
  const r = net.predict(featFromFixture(fixture.examples[0]));
  assert.ok(Math.abs(r.logit - fixture.expected[0][0]) < 1e-5);
  write({ ...fixture.head, featuresVersion: F.VERSION + 1 }, fixture.floats);
  assert.throws(() => ValueNet.load(dir), /Merkmale Version/);
  write({ ...fixture.head, groups: fixture.head.groups.slice(1) }, fixture.floats);
  assert.throws(() => ValueNet.load(dir), /Gruppenaufbau/);
  write(fixture.head, fixture.floats.slice(0, 100));
  assert.throws(() => ValueNet.load(dir), /net\.f32 hat/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('Merkmale: Zahlen endlich, Token gezählt, Gegnerhand fehlt', () => {
  const f = new F.Features().fill(V.honestView(state(), 0));
  for (const v of f.glob) assert.ok(Number.isFinite(v));
  const count = (side, name) => f.sides[side][F.G[name]].n;
  assert.equal(count(0, 'hero'), 3);
  assert.equal(count(0, 'abil'), 3);
  assert.equal(count(0, 'sup'), 3);
  assert.equal(count(0, 'sur'), 2);
  assert.equal(count(0, 'hand'), 2);
  assert.equal(count(1, 'hand'), 0, 'Gegnerhand darf nicht als Token auftauchen');
  assert.equal(f.glob[F.SEAT_GLOB + 1], Math.fround(seat(1).sc.hand / 10), 'nur die Größe der Gegnerhand ist sichtbar');
  for (const side of f.sides) for (const g of side) for (let i = 0; i < g.n * g.nx; i++) assert.ok(Number.isFinite(g.x[i]));
  const hero = f.sides[0][F.G.hero];
  assert.equal(hero.ids[2], 13);
  assert.equal(hero.x[2 * hero.nx + 10 + 24], 1, 'Statusbit 24 beim dritten Helden');
  assert.equal(hero.x[hero.nx + 4], 0, 'toter Held');
});

test('Merkmale: verdeckte Gegnerkarten und die Gegnerhand ändern die Eingabe nicht', () => {
  const a = state();
  const b = state();
  b.seats[1].hand = [[99, 3], [98, 1]];
  b.seats[1].sur = b.seats[1].sur.map(t => [t[0], t[1], t[2] + 100]);
  b.seats[1].sup = b.seats[1].sup.map(t => ((t[5] & 1) ? [t[0], t[1], t[2] + 100, ...t.slice(3)] : t));
  const fa = new F.Features().fill(V.honestView(a, 0));
  const fb = new F.Features().fill(V.honestView(b, 0));
  assert.deepEqual(fa.glob, fb.glob);
  for (let s = 0; s < 2; s++) for (let g = 0; g < F.GROUPS.length; g++) {
    const x = fa.sides[s][g], y = fb.sides[s][g];
    assert.equal(x.n, y.n);
    assert.deepEqual(x.ids.subarray(0, x.n), y.ids.subarray(0, y.n));
    assert.deepEqual(x.x.subarray(0, x.n * x.nx), y.x.subarray(0, y.n * y.nx));
  }
  // dagegen: die EIGENE Hand und der EIGENE verdeckte Support zählen
  const c = state();
  c.seats[0].hand = [[99, 3]];
  const fc = new F.Features().fill(V.honestView(c, 0));
  assert.notDeepEqual(fc.sides[0][F.G.hand].ids.subarray(0, 1), fa.sides[0][F.G.hand].ids.subarray(0, 1));
});

test('Netz: Reihenfolge der Token spielt keine Rolle, die Seite schon', () => {
  const net = new ValueNet(fixture.head, Float32Array.from(fixture.floats));
  const ex = fixture.examples.find(e => e.sides[0][F.G.abil].ids.length >= 2 && e.sides[1][F.G.disc].ids.length >= 2);
  assert.ok(ex, 'Fixture braucht ein Beispiel mit mehreren Token');
  const base = { ...net.predict(featFromFixture(ex)) };
  const rev = JSON.parse(JSON.stringify(ex));
  for (const side of rev.sides) for (let gi = 0; gi < side.length; gi++) {
    const g = side[gi], nx = F.GROUPS[gi].nx, n = g.ids.length;
    const order = [...Array(n).keys()].reverse();
    const x = []; for (const k of order) x.push(...g.x.slice(k * nx, (k + 1) * nx));
    side[gi] = { ids: order.map(k => g.ids[k]), own: order.map(k => g.own[k]), x };
  }
  const r = net.predict(featFromFixture(rev));
  assert.ok(Math.abs(r.logit - base.logit) < 1e-9 && Math.abs(r.ev - base.ev) < 1e-9);
  const swapped = JSON.parse(JSON.stringify(ex));
  swapped.sides.reverse();
  const q = net.predict(featFromFixture(swapped));
  assert.ok(Math.abs(q.logit - base.logit) > 1e-6, 'Tauschen von „ich" und „Gegner" muss die Ausgabe ändern');
});

test('Netz: von der Stellung (honestView) bis zur Ausgabe läuft ohne Fehler und deterministisch', () => {
  const net = new ValueNet(fixture.head, Float32Array.from(fixture.floats));
  const feat = new F.Features();
  // Die Fixture-Gewichte haben nur wenige Kartenzeilen; Nummern außerhalb gelten als 0 (unbekannt)
  const S = state();
  const clampIds = (view) => {
    for (const s of [view.self, view.opp]) {
      const lim = fixture.head.vocabSize;
      s.heroes.forEach(t => { t[0] %= lim; });
      s.abil.forEach(t => { t[2] %= lim; });
      s.sup.forEach(t => { t[2] %= lim; });
      s.sur.forEach(t => { t[2] %= lim; });
      s.area = s.area.map(i => i % lim); s.perm = s.perm.map(i => i % lim);
      for (const k of ['disc', 'del', 'hand']) s[k] = s[k].map(([i, n]) => [i % lim, n]);
    }
    return view;
  };
  const r1 = { ...net.predict(feat.fill(clampIds(V.honestView(S, 0)))) };
  const r2 = { ...net.predict(feat.fill(clampIds(V.honestView(S, 0)))) };
  assert.deepEqual(r1, r2);
  for (const v of Object.values(r1)) assert.ok(Number.isFinite(v));
});

test('Blattbewertung: ohne Schalter zuständig ist niemand (null), Horizont und Rollouts bleiben unverändert', () => {
  const L = require('../cards/effects/_value-leaf');
  assert.equal(L.score({ gs: {} }, 0, 'greedy'), null, 'Ort „greedy" ist nur im Modus greedy aktiv');
  assert.equal(L.score({ gs: { result: 1 } }, 0, 'rollout'), null, 'Partieende: der Evaluator liefert die Sieg-/Niederlagenwerte');
  assert.equal(L.horizonFor({}, 0, 3), 3);
  assert.equal(L.pullsFor({}, 0, 24), 24);
});

test('Greedy-Beobachtung: zählt, wie oft die Netz-Köpfe denselben Zug wie der Evaluator wählen', () => {
  const L = require('../cards/effects/_value-leaf');
  const eng = {};
  // Evaluator: Kandidat 0 vorn. Logit wählt Kandidat 1 (Verlust 50 Punkte), der Kopf wählt Kandidat 0.
  L.probeDone(eng, [{ ev: 100, logit: 90, head: 100 }, { ev: 50, logit: 95, head: 40 }, { ev: 10, logit: 0, head: 5 }]);
  const P = eng._greedyProbe;
  assert.equal(P.n, 1); assert.equal(P.cands, 3); assert.equal(P.clear, 1, 'Abstand 50 > Toleranz 5: eindeutige Entscheidung');
  assert.equal(P.top1.head, 1); assert.equal(P.top1.logit, 0);
  assert.equal(P.near.head, 1); assert.equal(P.near.logit, 0);
  assert.equal(P.regret.head, 0); assert.equal(P.regret.logit, 50);
  assert.equal(P.clearTop1.head, 1); assert.equal(P.clearRegret.logit, 50);
  assert.ok(Math.abs(P.regret.rand - (100 - 160 / 3)) < 1e-9 && Math.abs(P.top1.rand - 1 / 3) < 1e-9, 'Zufallsmaß: 1/k und mittlerer Abstand zum Besten');
  // Enge Entscheidung (Abstand innerhalb der Toleranz): zählt, ist aber nicht „eindeutig"
  L.probeDone(eng, [{ ev: 100, logit: 1, head: 1 }, { ev: 98, logit: 2, head: 2 }]);
  assert.equal(P.n, 2); assert.equal(P.clear, 1); assert.equal(P.near.logit, 1, 'der Verlust 2 liegt innerhalb der Toleranz');
  assert.equal(P.top1.logit, 0);
  // Ein einziger Kandidat ist keine Entscheidung
  const e2 = {}; L.probeDone(e2, [{ ev: 1, logit: 1, head: 1 }]);
  assert.equal(e2._greedyProbe, undefined);
});

test('ausgelieferte Gewichte (data/cpu-value) laden, passen zum Vokabular und rechnen endlich', () => {
  const net = ValueNet.load();                                  // Standardordner = data/cpu-value
  const vocab = V.loadVocab();
  const kopf = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'cpu-value', 'net.json'), { encoding: 'utf-8' }));
  assert.ok(vocab.names.length >= kopf.vocabSize, 'Das Vokabular wächst nur anhängend: es darf nie kürzer sein als das, womit das Netz trainiert wurde');
  const cards = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'cards.json'), { encoding: 'utf-8' }));
  const fehlt = (Array.isArray(cards) ? cards : Object.values(cards)).filter(c => c && c.name && !vocab.idOfName.has(c.name)).map(c => c.name);
  // Neue Karten ohne Vokabel laufen als „unbekannt" durch das Netz (siehe Plan); sie sollen aber bewusst sein, nicht still entstehen.
  assert.ok(fehlt.length < 40, `${fehlt.length} Karten ohne Vokabel: ${fehlt.slice(0, 5).join(', ')} — Vokabular anhängend erweitern und Netz neu trainieren`);
  const r = net.predict(featFromFixture(fixture.examples[0]));
  for (const k of ['logit', 'logitCal', 'ev', 'rem']) assert.ok(Number.isFinite(r[k]), k);
  assert.ok(net.kappa && net.kappa.std > 0 && net.calib, 'Kalibrierung und κ stehen in net.json');
});
