'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const px = require('../lib/pixle');

const real = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'cards.json'), 'utf8'));
const cell = (r, key) => r.cells.find(c => c.key === key);
const C = (o = {}) => ({ name: 'X', cardType: 'Spell', subtype: 'Normal', level: 1, hp: null, atk: null, cost: null, archetype: '', setID: 'PP A', spellSchool1: 'Magic Arts', spellSchool2: null, ...o });

test('Vergleich: gleiche Karte → alles grün; Spalten und Reihenfolge stimmen', () => {
  const a = C({ name: 'A' });
  const r = px.compareCards(a, a);
  assert.equal(r.correct, true);
  assert.deepEqual(r.cells.map(c => c.key), px.COLUMNS);
  assert.ok(r.cells.every(c => c.status === 'match' && !c.arrow));
});

test('Zahlen: gleich = grün; nah dran = gelb mit Pfeil; weit weg = rot mit Pfeil; Pfeil zeigt, wo die GEHEIME Karte liegt', () => {
  const secret = C({ hp: 500, atk: 80, level: 2, cost: 5 });
  const guess = C({ name: 'G', hp: 450, atk: 200, level: 1, cost: 9 });
  const r = px.compareCards(guess, secret);
  assert.deepEqual([cell(r, 'hp').status, cell(r, 'hp').arrow, cell(r, 'hp').text], ['partial', 'up', '450'], 'HP 450 vs 500: nah dran (≤15 %), geheime Karte hat mehr');
  assert.deepEqual([cell(r, 'atk').status, cell(r, 'atk').arrow], ['miss', 'down'], 'ATK 200 vs 80: weit weg, geheime hat weniger');
  assert.deepEqual([cell(r, 'level').status, cell(r, 'level').arrow], ['partial', 'up'], 'Level ±1 ist nah dran');
  assert.deepEqual([cell(r, 'cost').status, cell(r, 'cost').arrow], ['miss', 'down']);
  assert.equal(px.closeEnough('hp', 10, 40), false);
  assert.equal(px.closeEnough('hp', 10, 25), true, 'bei kleinen Werten gilt mindestens 20');
});

test('fehlende Werte: beide ohne = grün „–“; nur eine Seite hat den Wert = rot ohne Pfeil', () => {
  const r = px.compareCards(C({ hp: null }), C({ hp: null }));
  assert.deepEqual([cell(r, 'hp').text, cell(r, 'hp').status], ['–', 'match']);
  const r2 = px.compareCards(C({ hp: 300 }), C({ hp: null }));
  assert.deepEqual([cell(r2, 'hp').status, cell(r2, 'hp').arrow], ['miss', null]);
  const r3 = px.compareCards(C({ hp: null }), C({ hp: 300 }));
  assert.deepEqual([cell(r3, 'hp').status, cell(r3, 'hp').arrow, cell(r3, 'hp').text], ['miss', null, '–']);
});

test('Schule: gleiche Menge = grün; gemeinsame = gelb; keine gemeinsame = rot; beide ohne = grün', () => {
  const sec = C({ spellSchool1: 'Decay Magic', spellSchool2: 'Support Magic' });
  assert.equal(cell(px.compareCards(C({ spellSchool1: 'Support Magic', spellSchool2: 'Decay Magic' }), sec), 'school').status, 'match', 'Reihenfolge egal');
  assert.equal(cell(px.compareCards(C({ spellSchool1: 'Decay Magic' }), sec), 'school').status, 'partial');
  assert.equal(cell(px.compareCards(C({ spellSchool1: 'Fighting' }), sec), 'school').status, 'miss');
  assert.equal(cell(px.compareCards(C({ spellSchool1: null }), sec), 'school').status, 'miss');
  assert.equal(cell(px.compareCards(C({ spellSchool1: null }), C({ spellSchool1: null })), 'school').status, 'match');
  assert.equal(cell(px.compareCards(C({ spellSchool1: 'Decay Magic', spellSchool2: 'Support Magic' }), sec), 'school').text, 'Decay+Support');
});

test('Typ, Subtyp, Set: exakt; Hero ↔ Ascended Hero ist gelb; leere Werte vergleichen sich als gleich; der Archetyp ist KEIN Hinweis', () => {
  const r = px.compareCards(C({ cardType: 'Hero', subtype: '', archetype: 'X', setID: 'PP Z' }), C({ cardType: 'Ascended Hero', subtype: '', archetype: 'Y', setID: 'PP A' }));
  assert.equal(r.cells.some(c => c.key === 'archetype'), false, 'keine Archetyp-Spalte');
  assert.deepEqual(px.COLUMNS, ['type', 'subtype', 'level', 'hp', 'atk', 'cost', 'school', 'set']);
  assert.equal(cell(r, 'type').status, 'partial');
  assert.equal(cell(r, 'type').text, 'Hero');
  assert.equal(cell(r, 'subtype').status, 'match');
  assert.equal(cell(r, 'subtype').text, '–');
  assert.equal(cell(r, 'set').status, 'miss');
  assert.equal(cell(px.compareCards(C({ cardType: 'Spell' }), C({ cardType: 'Creature' })), 'type').status, 'miss');
  assert.equal(px.compareCards(C({ archetype: 'Pollution' }), C({ archetype: 'Doom Clock' })).cells.every(c => c.status === 'match'), true, 'verschiedener Archetyp ändert nichts');
});

test('Farbvarianten ([B]/[W]) gelten als dieselbe Karte', () => {
  const b = C({ name: 'Rook of Kings [B]' }), w = C({ name: 'Rook of Kings [W]' });
  assert.equal(px.compareCards(b, w).correct, true);
  assert.equal(px.compareCards(C({ name: 'Rook of Kings [B]' }), C({ name: 'Queen of Kings [B]' })).correct, false);
});

test('Tipp auflösen: Name, Tippfehler, Leerzeichen; unbekannt und mehrdeutig zählen nicht', () => {
  const name = t => { const r = px.resolveCard(real, t); return r.kind === 'ok' ? r.card.name : r.kind; };
  assert.equal(name('Acid Rain'), 'Acid Rain');
  assert.equal(name('acid  rain!'), 'Acid Rain');
  assert.equal(name('fire ball'), 'Fireball');
  assert.equal(name('Teocuilatl'), 'Teocuilatl, the Embodiment of Gods');
  assert.equal(name('qzxwvkj'), 'unknown');
  assert.equal(name('  '), 'unknown');
  assert.equal(name('Alice'), 'ambiguous');
  assert.ok(px.resolveCard(real, 'Alice').alternatives.length >= 1);
  // jede Karte findet sich mit ihrem vollen Namen selbst (außer den bewusst gleichnamigen Varianten)
  for (const c of real) {
    const r = px.resolveCard(real, c.name);
    assert.equal(r.kind, 'ok', `${c.name}: ${r.kind}`);
    assert.equal(require('../lib/mystery').plainName(r.card.name), require('../lib/mystery').plainName(c.name), c.name);
  }
});

test('Belohnung: 30 SC, −3 je falschem Tipp davor, mindestens 3', () => {
  assert.equal(px.reward(30, 3, 0), 30);
  assert.equal(px.reward(30, 3, 1), 27);
  assert.equal(px.reward(30, 3, 9), 3);
  assert.equal(px.reward(30, 3, 20), 3);
  assert.equal(px.reward(2, 1, 5), 2, 'Mindestbetrag überschreitet nie den Grundbetrag');
});

test('Tageswechsel folgt dem Berliner Kalendertag, auch über die Zeitumstellung', () => {
  const t1 = Date.UTC(2026, 5, 10, 21, 59, 0), t2 = Date.UTC(2026, 5, 10, 22, 1, 0);
  assert.equal(px.berlinDay(t1), '2026-06-10');
  assert.equal(px.berlinDay(t2), '2026-06-11');
  assert.equal(px.nextBerlinMidnightSec(t1), Math.floor(Date.UTC(2026, 5, 10, 22, 0, 0) / 1000));
  assert.equal(px.nextBerlinMidnightSec(Date.UTC(2026, 0, 10, 12, 0, 0)), Math.floor(Date.UTC(2026, 0, 10, 23, 0, 0) / 1000));
  assert.equal(px.nextBerlinMidnightSec(Date.UTC(2026, 2, 28, 12, 0, 0)), Math.floor(Date.UTC(2026, 2, 28, 23, 0, 0) / 1000));
  assert.equal(px.nextBerlinMidnightSec(Date.UTC(2026, 2, 29, 12, 0, 0)), Math.floor(Date.UTC(2026, 2, 29, 22, 0, 0) / 1000));
});

test('geheime Karte: aus dem Vorrat, nicht eine der zuletzt gespielten, zufällig (nicht aus dem Datum ableitbar)', () => {
  const pool = [C({ name: 'A' }), C({ name: 'B' }), C({ name: 'C' })];
  assert.equal(px.pickSecret(pool, ['A', 'B'], () => 0).name, 'C');
  assert.equal(px.pickSecret(pool, ['A', 'B', 'C'], () => 0).name, 'A', 'sind alle zuletzt dran, gilt wieder der ganze Vorrat');
  assert.equal(px.pickSecret([], []), null);
  const seen = new Set();
  for (let i = 0; i < 60; i++) seen.add(px.pickSecret(pool, []).name);
  assert.equal(seen.size, 3, 'echter Zufall');
});
