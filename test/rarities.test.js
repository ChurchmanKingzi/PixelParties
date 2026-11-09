'use strict';
// Rarity-System (rarities.js): Gewichte, Sortierung, Masken-Fallback, Besitzprüfung, Pack-Pools, Draft-Würfeln, Kopienvorrat.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const R = require('../rarities');

const root = path.join(__dirname, '..');
const cards = JSON.parse(fs.readFileSync(path.join(root, 'data', 'cards.json'), 'utf8'));
const art = JSON.parse(fs.readFileSync(path.join(root, 'data', 'card-art', 'index.json'), 'utf8'));
const masks = new Set(Object.keys(JSON.parse(fs.readFileSync(path.join(root, 'data', 'subject-masks.json'), 'utf8')).cards));

/** Deterministischer Zufall (mulberry32). */
function seeded(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

test('Reihenfolge, Namen und Rang', () => {
  assert.deepStrictEqual(R.ORDER, ['common', 'uncommon', 'rare', 'prismatic', 'super', 'diamond', 'spectral', 'stained', 'umbra']);
  assert.strictEqual(R.LABEL.super, 'Super Rare');
  assert.strictEqual(R.LABEL.stained, 'Stained Rare');
  for (const id of R.ORDER) { assert.ok(R.isRarity(id)); assert.ok(R.LABEL[id]); }
  R.ORDER.forEach((id, i) => assert.strictEqual(R.rank(id), i));
  assert.strictEqual(R.rank('foil'), 0);
  assert.ok(!R.isRarity('foil') && !R.isRarity(undefined));
});

test('Gewichte: jede Tabellenzeile ergibt 100 Prozent', () => {
  assert.strictEqual(R.PACK_STAGES.length, 3);
  for (const t of [...R.PACK_STAGES, R.DRAFT_TABLE]) {
    assert.ok(Math.abs(R.tableSum(t) - 100) < 1e-9, JSON.stringify(t));
    for (const id of Object.keys(t)) assert.ok(R.isRarity(id), id);
  }
  assert.ok(!('common' in R.PACK_STAGES[0]) && !('common' in R.PACK_STAGES[2]));
  assert.ok(!('uncommon' in R.PACK_STAGES[2]));
  assert.strictEqual(R.DRAFT_TABLE.common, 90);
});

test('rollFromTable folgt den Gewichten', () => {
  const rand = seeded(7);
  const n = 40000, cnt = {};
  for (let i = 0; i < n; i++) { const id = R.rollFromTable(R.DRAFT_TABLE, rand); cnt[id] = (cnt[id] || 0) + 1; }
  assert.ok(Math.abs(cnt.common / n - 0.9) < 0.01, 'common ~90%');
  assert.ok(cnt.uncommon / n > 0.03 && cnt.uncommon / n < 0.05, 'uncommon ~4%');
  // Randwerte
  assert.strictEqual(R.rollFromTable({ a: 1, b: 1 }, () => 0), 'a');
  assert.strictEqual(R.rollFromTable({ a: 1, b: 1 }, () => 0.999999), 'b');
});

test('Pack-Pools: alle neun nicht leer, ohne Tokens und ohne Karten ohne Motiv', () => {
  const seen = new Map();
  for (const id of R.PACK_IDS) {
    const pool = R.cardsOfPack(id, cards, art);
    assert.ok(pool.length >= 9, id + ': Pool zu klein (' + pool.length + ')');
    for (const c of pool) {
      assert.ok(!/Token/.test(c.cardType) && c.setID !== 'PP TOKEN', c.name + ' ist ein Token');
      assert.ok(art[c.name], c.name + ' hat kein Kartenbild');
      // Überschneidungen sind gewollt wie im Katalog (scripts/booster/catalog.py): Ability-/Hero-Pack zusätzlich zum Set-Pack. Die Set-Packs untereinander sind disjunkt.
      if (id !== 'ability' && id !== 'hero') {
        if (seen.has(c.name)) assert.fail(c.name + ' liegt in zwei Set-Packs: ' + seen.get(c.name) + ', ' + id);
        seen.set(c.name, id);
      }
    }
  }
  assert.ok(R.cardsOfPack('ability', cards, art).every(c => c.cardType === 'Ability'));
  assert.ok(R.cardsOfPack('hero', cards, art).every(c => c.cardType === 'Hero' || c.cardType === 'Ascended Hero'));
  // Archetyp-Sonderfall: Lunatic gehört zu Dreadful Future, egal welches Set
  const lun = cards.find(c => c.archetype === 'Lunatic' && c.cardType !== 'Ability' && !/Hero/.test(c.cardType) && art[c.name]);
  if (lun) assert.strictEqual(R.packOfCard(lun), 'future');
  assert.strictEqual(R.packOfSet(R.normSet('PP MS1')), 'world1');
  assert.strictEqual(R.packOfSet(R.normSet('PP ART')), 'trials');
});

test('rollPack: neun Karten, nach Rarity aufsteigend sortiert, Stufen', () => {
  const pool = R.cardsOfPack('trials', cards, art);
  for (let seed = 1; seed <= 300; seed++) {
    const pack = R.rollPack(pool, { rand: seeded(seed), hasMask: n => masks.has(n) });
    assert.strictEqual(pack.length, 9);
    for (let i = 1; i < 9; i++) assert.ok(R.rank(pack[i - 1].rarity) <= R.rank(pack[i].rarity), 'Sortierung ' + JSON.stringify(pack.map(c => c.rarity)));
    for (const c of pack) {
      assert.ok(pool.some(p => p.name === c.name), c.name + ' nicht im Pool');
      assert.notStrictEqual(c.rarity, 'common', 'Packs enthalten kein Common');
      if (R.NEEDS_MASK[c.rarity]) assert.ok(masks.has(c.name), c.name + ' hat keine Maske, ist aber ' + c.rarity);
    }
    // Die letzten drei Würfe sind mindestens Rare (Stufe 3 hat kein Uncommon)
    assert.ok(R.rank(pack[8].rarity) >= R.rank('rare'));
  }
});

test('rollPack: gleiche Rarity behält die Reihenfolge der Würfe (stabile Sortierung)', () => {
  // Alles Uncommon aus Stufe 1/2 und Rare in Stufe 3 → Namen in Wurfreihenfolge
  const rand = (() => { const seq = []; return () => 0; })();
  const pool = ['A', 'B', 'C'].map(name => ({ name }));
  const pack = R.rollPack(pool, { rand, hasMask: () => true });
  assert.deepStrictEqual(pack.map(c => c.rarity), ['uncommon', 'uncommon', 'uncommon', 'uncommon', 'uncommon', 'uncommon', 'rare', 'rare', 'rare']);
  assert.ok(pack.every(c => c.name === 'A'));
});

test('Masken-Fallback: Umbra/Stained nur mit Maske, die Rarity bleibt', () => {
  // Pool: nur "X" hat eine Maske. Immer Stained würfeln (rand = 0.9999 → seltenste Rarity der Stufe).
  const pool = [{ name: 'A' }, { name: 'B' }, { name: 'X' }, { name: 'C' }];
  const rand = () => 0.99999;   // seltenste Rarity der Stufe (Umbra), letzte Karte des Pools (C, ohne Maske)
  const pack = R.rollPack(pool, { rand, hasMask: n => n === 'X' });
  assert.ok(pack.every(c => c.rarity === 'umbra'), JSON.stringify(pack));
  assert.ok(pack.every(c => c.name === 'X'), 'jede Umbra-Karte muss die mit Maske sein');
  // Pool ohne jede Maske: nie Umbra/Stained
  for (let seed = 1; seed <= 200; seed++) {
    const p = R.rollPack(pool, { rand: seeded(seed), hasMask: () => false });
    assert.ok(p.every(c => !R.NEEDS_MASK[c.rarity]));
  }
  // Standardmäßig (ohne hasMask) gilt jede Karte als maskiert
  assert.strictEqual(R.rollPack(pool, { rand: seeded(3) }).length, 9);
});

test('Draft-Würfeln: Verteilung, Umbra/Stained nur mit Maske', () => {
  const rand = seeded(11);
  const n = 30000, cnt = {};
  for (let i = 0; i < n; i++) { const id = R.rollDraftRarity('Karte', rand, true); cnt[id] = (cnt[id] || 0) + 1; }
  assert.ok(Math.abs(cnt.common / n - 0.9) < 0.01);
  assert.ok(cnt.stained > 0 && cnt.umbra > 0);
  const r2 = seeded(12), c2 = {};
  for (let i = 0; i < n; i++) { const id = R.rollDraftRarity('Karte', r2, false); c2[id] = (c2[id] || 0) + 1; }
  assert.ok(!c2.umbra && !c2.stained, 'ohne Maske kein Umbra/Stained');
  assert.ok(c2.common / n > 0.9, 'neu gewürfelt: Common wird etwas häufiger');
  // hasMask als Funktion
  assert.ok(R.isRarity(R.rollDraftRarity('Y', seeded(1), (nm) => nm === 'Y')));
});

function deck() {
  return {
    mainDeck: ['Fireball', 'Fireball', 'Heal', ''], potionDeck: ['Elixir'], sideDeck: ['Fireball'],
    heroes: [{ hero: 'Ida', ability1: 'Fighting', ability2: 'Fighting' }, { hero: null, ability1: null, ability2: null }],
  };
}

test('Deck-Rarities: Normalisierung (fehlend = common, Länge folgt den Karten)', () => {
  const d = deck();
  const n = R.normalizeDeckRarities(d, undefined);
  assert.deepStrictEqual(n.main, ['common', 'common', 'common', 'common']);
  assert.deepStrictEqual(n.potion, ['common']);
  assert.strictEqual(n.heroes.length, 2);
  const m = R.normalizeDeckRarities(d, { main: ['rare', 'bogus'], heroes: [{ hero: 'super' }], side: ['umbra', 'rare', 'rare'] });
  assert.deepStrictEqual(m.main, ['rare', 'common', 'common', 'common']);
  assert.deepStrictEqual(m.side, ['umbra']);
  assert.strictEqual(m.heroes[0].hero, 'super');
  assert.strictEqual(m.heroes[1].hero, 'common');
  assert.ok(R.hasAnyRarity(m) && !R.hasAnyRarity(n));
});

test('Besitzprüfung: pro (Karte, Rarity) über ALLE Zonen, Common unbegrenzt', () => {
  const d = deck();
  const rar = { main: ['rare', 'rare', 'common', 'common'], potion: ['common'], side: ['rare'], heroes: [{ hero: 'super', ability1: 'common', ability2: 'common' }, {}] };
  // Fireball Rare x3 (2 main + 1 side), Ida Super x1
  assert.strictEqual(R.firstOwnershipViolation(d, rar, { Fireball: { rare: 3 }, Ida: { super: 1 } }), null);
  const v = R.firstOwnershipViolation(d, rar, { Fireball: { rare: 2 }, Ida: { super: 1 } });
  assert.deepStrictEqual(v, { card: 'Fireball', rarity: 'rare', need: 3, have: 2 });
  const v2 = R.firstOwnershipViolation(d, rar, { Fireball: { rare: 3 } });
  assert.strictEqual(v2.card, 'Ida');
  assert.strictEqual(R.firstOwnershipViolation(d, undefined, {}), null, 'nur Common ist immer erlaubt');
  assert.deepStrictEqual(R.rarityUsage(d, rar), { Fireball: { rare: 3 }, Ida: { super: 1 } });
});

test('Herabstufen: Kopien über den Besitz hinaus werden Common', () => {
  const d = deck();
  const rar = { main: ['rare', 'rare', 'common', 'common'], potion: ['common'], side: ['rare'], heroes: [{ hero: 'super', ability1: 'common', ability2: 'common' }, {}] };
  const out = R.downgradeToOwned(d, rar, { Fireball: { rare: 2 } });
  assert.deepStrictEqual(out.main, ['rare', 'rare', 'common', 'common']);
  assert.deepStrictEqual(out.side, ['common']);
  assert.strictEqual(out.heroes[0].hero, 'common');
  assert.strictEqual(R.firstOwnershipViolation(d, out, { Fireball: { rare: 2 } }), null);
});

test('Kopienvorrat: k-te sichtbare Kopie bekommt die k-te Rarity, Verdecktes bleibt Common', () => {
  const d = deck();
  const rar = { main: ['rare', 'common', 'common', 'common'], potion: [], side: ['uncommon'], heroes: [{ hero: 'super' }, {}] };
  const led = R.deckLedger(d, rar);
  assert.deepStrictEqual(led, { Fireball: ['rare', 'uncommon'], Ida: ['super'] });
  assert.strictEqual(R.deckLedger(d, undefined), null);
  const pv = {
    heroes: [{ name: 'Ida' }, { name: null }],
    abilityZones: [[[], ['Fighting', 'Fighting'], []]],
    supportZones: [[[['Fireball']], [[]]]],
    surpriseZones: [[], ['?']], hand: ['Fireball', 'Heal', 'Fireball'], discardPile: ['Fireball'],
  };
  const out = R.annotatePlayer(pv, led, { area: [] });
  assert.strictEqual(out.heroes[0], 'super');
  assert.strictEqual(out.supportZones[0][0][0], 'rare');     // Support kommt vor der Hand
  assert.deepStrictEqual(out.hand, ['uncommon', null, null]);
  assert.deepStrictEqual(out.discardPile, [null]);
  assert.strictEqual(R.annotatePlayer(pv, null), null);
  assert.strictEqual(R.annotatePlayer({ heroes: [{ name: 'Zzz' }] }, led), null, 'nichts Seltenes sichtbar → null');
  assert.deepStrictEqual(R.annotateNames(['Fireball', '?', 'Fireball'], led), ['rare', null, 'uncommon']);
});
