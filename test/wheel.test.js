'use strict';
// Glücksrad (wheel.js): Tabellen, Downgrade-Schwerpunkt, gleiche Erwartungswerte der Boards, Wirtschaft (kein Geld-Kreislauf), Würfeln.
const test = require('node:test');
const assert = require('node:assert');
const R = require('../rarities');
const W = require('../wheel');

function seeded(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const sum = (t) => Object.keys(t).reduce((s, k) => s + t[k], 0);
const isMechanic = (k) => k === 'none' || k.startsWith('boost:');

test('24 Tabellen: Summe 100, nur bekannte Preisarten, keine negativen Gewichte', () => {
  for (const r of W.INPUT_RARITIES) for (const id of W.BOARD_IDS) {
    const t = W.table(r, id);
    assert.ok(Math.abs(sum(t) - 100) < 1e-6, `${r}/${id}: Summe ${sum(t)}`);
    for (const k of Object.keys(t)) {
      assert.ok(t[k] >= 0, `${r}/${id}: ${k} negativ`);
      assert.ok(k === 'none' || k.startsWith('boost:') || k.startsWith('card:') || k.startsWith('ticket:') ||
        ['booster', 'golden', 'jackpot', 'avatar', 'sleeve', 'skin', 'spin3', 'sc10', 'sc20', 'sc50'].includes(k), `${r}/${id}: unbekannt ${k}`);
      if (k.startsWith('card:') || k.startsWith('ticket:')) assert.ok(R.isRarity(k.split(':')[1]));
    }
  }
});

test('Der Schwerpunkt ist ein Downgrade: höchstens ~22 % Break-even/Gewinn, mindestens 8 %', () => {
  for (const r of W.INPUT_RARITIES) {
    const vin = R.DISPLAY_PRICE[r];
    for (const id of W.BOARD_IDS) {
      const t = W.table(r, id);
      let up = 0;
      for (const k of Object.keys(t)) if (!isMechanic(k) && W.valueOf(k) >= vin) up += t[k];
      assert.ok(up <= 22, `${r}/${id}: ${up.toFixed(1)} % Break-even oder besser`);
      assert.ok(up >= 8, `${r}/${id}: nur ${up.toFixed(1)} % Chance auf Break-even oder besser`);
      assert.ok(W.expectedValue(t) < 0.75 * vin, `${r}/${id}: Erwartungswert ${W.expectedValue(t).toFixed(1)} zu nah am Einsatz (${vin})`);
    }
  }
});

test('„Nichts“: Uncommon ~75–85 %, Umbra genau 0, nie negativ; Jackpot überall 0,01 %', () => {
  for (const id of W.BOARD_IDS) {
    const n = W.table('uncommon', id).none;
    assert.ok(n >= 75 && n <= 85, `uncommon/${id}: ${n}`);
    assert.strictEqual(W.table('umbra', id).none || 0, 0);
    for (const r of W.INPUT_RARITIES) {
      assert.ok((W.table(r, id).none || 0) >= 0);
      assert.strictEqual(W.table(r, id).jackpot < 0.02 && W.table(r, id).jackpot > 0.005, true, `${r}/${id}: Jackpot ${W.table(r, id).jackpot}`);
    }
  }
  // Umbra: nie kleinere Karten als Super Rare (kein „random Uncommon“-Trost)
  for (const id of W.BOARD_IDS) for (const k of ['card:uncommon', 'card:rare', 'card:prismatic']) assert.ok(!W.table('umbra', id)[k]);
});

test('Boards sind verschieden, aber keines ist objektiv besser: gleicher Erwartungswert (Umbra ±8 %)', () => {
  for (const r of W.INPUT_RARITIES) {
    const evs = W.BOARD_IDS.map(id => W.expectedValue(W.table(r, id)));
    const tol = r === 'umbra' ? 0.08 : 0.005;
    const mean = evs.reduce((a, b) => a + b, 0) / evs.length;
    for (const e of evs) assert.ok(Math.abs(e - mean) / mean <= tol, `${r}: EV ${evs.map(x => x.toFixed(2))}`);
    // wirklich verschieden: mindestens ein Preis weicht um > 10 % relativ ab
    const A = W.table(r, 'A'), B = W.table(r, 'B'), C = W.table(r, 'C');
    assert.ok(Object.keys(A).some(k => Math.abs((B[k] || 0) - A[k]) / Math.max(A[k], 1e-9) > 0.1 && A[k] > 0.1), `${r}: A und B zu ähnlich`);
    assert.ok(Object.keys(A).some(k => Math.abs((C[k] || 0) - A[k]) / Math.max(A[k], 1e-9) > 0.1 && A[k] > 0.1), `${r}: A und C zu ähnlich`);
  }
});

test('+3-Pfeile-Felder sind rar genug: Kettenfaktor 3·p ≪ 1', () => {
  for (const r of W.INPUT_RARITIES) for (const id of W.BOARD_IDS) {
    const p = (W.table(r, id).spin3 || 0) / 100;
    assert.ok(W.SPIN_ARROWS * p <= 0.1, `${r}/${id}: Kettenfaktor ${W.SPIN_ARROWS * p}`);
  }
});

test('Wirtschaft: Alle Karten eines Packs einsetzen und den Ertrag wieder einsetzen schrumpft (Kreislauf-Faktor < 0,8)', () => {
  // Verteilung einer Pack-Karte
  const rs = W.INPUT_RARITIES, n = {};
  rs.forEach(r => { n[r] = 0; });
  for (const st of R.PACK_STAGES) for (const k of Object.keys(st)) n[k] += 3 * st[k] / 100;
  for (const id of W.BOARD_IDS) {
    // Je Karte einer Rarity: erwartete Karten zurück + Packs (Booster, SC/20) — Golden-Pack zählt wie ein Pack mit doppeltem Gewicht, Jackpot wie 9 Umbra
    const step = (r) => {
      const t = W.table(r, id), p = (t.spin3 || 0) / 100, m = 1 / (1 - W.SPIN_ARROWS * p);
      const c = {}; rs.forEach(q => { c[q] = 0; }); let packs = 0;
      for (const k of Object.keys(t)) {
        if (k === 'none' || k === 'spin3' || k.startsWith('boost:')) continue;
        const pr = t[k] / 100 * m;
        if (k.startsWith('card:')) c[k.slice(5)] += pr;
        else if (k === 'booster') packs += pr;
        else if (k === 'golden') packs += 2 * pr;
        else if (k === 'jackpot') c.umbra += 9 * pr;
        else if (W.SC_AMOUNT[k]) packs += pr * W.SC_AMOUNT[k] / R.PACK_PRICE;
      }
      return { c, packs };
    };
    let x = Object.assign({}, n), rho = 0;
    for (let g = 0; g < 200; g++) {
      const nx = {}; rs.forEach(q => { nx[q] = 0; }); let np = 0;
      for (const r of rs) { const { c, packs } = step(r); for (const q of rs) nx[q] += x[r] * c[q]; np += x[r] * packs; }
      for (const q of rs) nx[q] += np * n[q];
      const s = rs.reduce((a, q) => a + nx[q], 0), s0 = rs.reduce((a, q) => a + x[q], 0);
      rho = s / s0; x = nx;
      if (s < 1e-12) break;
    }
    assert.ok(rho < 0.8, `Board ${id}: Kreislauf-Faktor ${rho.toFixed(3)}`);
  }
});

test('rollThrow: Anzahl, Bonus-Pfeile aus +3-Feldern, Determinismus mit Seed', () => {
  const a = W.rollThrow('rare', 'B', 40, seeded(7)), b = W.rollThrow('rare', 'B', 40, seeded(7));
  assert.deepStrictEqual(a, b);
  const paid = a.arrows.filter(x => !x.bonus).length, bonus = a.arrows.filter(x => x.bonus).length;
  assert.strictEqual(paid, 40);
  assert.strictEqual(bonus, W.SPIN_ARROWS * a.arrows.filter(x => x.kind === 'spin3').length);
  a.arrows.forEach((x, i) => assert.strictEqual(x.i, i));
  assert.throws(() => W.rollThrow('rare', 'A', 0), /Einsatz/);
  assert.throws(() => W.rollThrow('rare', 'A', W.MAX_STAKE + 1), /Einsatz/);
  assert.throws(() => W.rollThrow('common', 'A', 1), /Rarity/);
});

test('rollThrow: Umbra liefert nie „Nichts“; Häufigkeiten folgen der Tabelle (Monte-Carlo)', () => {
  const rand = seeded(42);
  const N = 200000, cnt = {};
  const { arrows } = W.rollThrow('uncommon', 'A', 400, rand);
  assert.ok(arrows.length >= 400);
  const u = W.rollThrow('umbra', 'C', 400, rand);
  assert.ok(u.arrows.every(x => x.kind !== 'none'));
  // Häufigkeit „Nichts“ bei Uncommon/A über viele Pfeile (ohne Boosts: direkt rollOne)
  const t = W.table('uncommon', 'A');
  for (let i = 0; i < N; i++) { const k = W.rollOne(t, rand); cnt[k] = (cnt[k] || 0) + 1; }
  assert.ok(Math.abs(cnt.none / N * 100 - t.none) < 0.6, `none ${cnt.none / N * 100} vs ${t.none}`);
});

test('Glücks-Boost: überdeckt „Nichts“ nur für FOLGENDE Pfeile und bläht große Würfe nicht auf (EV je Pfeil ≤ +15 %)', () => {
  for (const r of W.INPUT_RARITIES) for (const id of W.BOARD_IDS) for (const bk of W.BOOST_KINDS) {
    const spec = W.boostSpec(r, id, bk), t = W.table(r, id), eff = W.applyBoosts(t, [spec]);
    assert.ok(spec.share > 0 && spec.share < 0.5, `${r}/${id}/${bk}: Größe ${spec.share}`);
    assert.ok(Math.abs(sum(eff) - 100) < 1e-9);
    assert.ok(eff[spec.make] > t[spec.make], `${r}/${id}/${bk}: ${spec.make} wächst nicht`);
    const gain = (W.expectedValue(eff) - W.expectedValue(t)) / W.expectedValue(t);
    assert.ok(Math.abs(gain - W.BOOST_GAIN[W.BOOST_KINDS.indexOf(bk)]) < 0.02, `${r}/${id}/${bk}: Aufwertung ${gain}`);
  }
  // wertvollerer Preis → kleineres Feld (Uncommon: 10 SC gegenüber Skin)
  assert.ok(W.boostSpec('uncommon', 'A', 'boost:3').share < W.boostSpec('uncommon', 'A', 'boost:1').share);
  // erster Pfeil ist nie „boosted“
  assert.strictEqual(W.rollThrow('uncommon', 'A', 5, seeded(3)).arrows[0].boosted, false);
  for (const r of ['uncommon', 'prismatic', 'storm', 'umbra']) {
    const rand = seeded(99);
    let tot = 0, cntArrows = 0;
    const runs = 300;
    for (let i = 0; i < runs; i++) {
      const th = W.rollThrow(r, 'A', 400, rand);
      for (const a of th.arrows) { if (a.kind !== 'spin3' && !a.kind.startsWith('boost:')) tot += W.valueOf(a.kind); cntArrows++; }
    }
    // Erwartungswert je Pfeil (ohne die Spin-Rekursion, die schon in cntArrows steckt)
    const t0 = W.table(r, 'A');
    let direct = 0; for (const k of Object.keys(t0)) if (!isMechanic(k) && k !== 'spin3') direct += t0[k] * W.valueOf(k) / 100;
    const perArrow = tot / cntArrows;
    assert.ok(perArrow <= direct * 1.15, `${r}: ${perArrow.toFixed(2)} je Pfeil vs ${direct.toFixed(2)} ohne Boost`);
  }
});

test('Notbremse: MAX_ARROWS wird nie überschritten', () => {
  // Zufall, der immer das +3-Feld trifft → Kette bis zur Grenze
  const always = () => 0.0;
  const stuck = { 'x': 0 };
  const orig = W.table('uncommon', 'A');
  assert.ok(orig);
  // rand()=0 trifft das erste Feld der Tabelle; ein Feld-Spin wird über eine Zufallsfolge erzwungen, die nur den Spin-Bereich trifft
  const t = W.table('uncommon', 'A'); const keys = Object.keys(t);
  let before = 0; for (const k of keys) { if (k === 'spin3') break; before += t[k]; }
  const forced = () => (before + t.spin3 / 2) / 100;
  const r = W.rollThrow('uncommon', 'A', 1, forced);
  assert.ok(r.arrows.length <= W.MAX_ARROWS);
  assert.strictEqual(r.capped, true);
  void always; void stuck;
});
