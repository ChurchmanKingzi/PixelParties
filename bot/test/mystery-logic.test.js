'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const m = require('../lib/mystery');

const real = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'cards.json'), 'utf8'));
const card = n => real.find(c => c.name === n);

test('Tipp: exakt, ohne Großschreibung/Leerzeichen, Tippfehler, nur Hero-Vorname → richtig', () => {
  const t = card('Teocuilatl, the Embodiment of Gods');
  for (const g of ['Teocuilatl, the Embodiment of Gods', 'teocuilatl the embodiment of gods', 'Teocuilatl', 'teocuilat', 'TEOCUILATL!!']) {
    assert.equal(m.judgeGuess(real, t, g).kind, 'correct', g);
  }
  assert.equal(m.judgeGuess(real, card('Fireball'), 'fire ball').kind, 'correct');
});

test('Tipp: andere Karte → wrong (mit der erkannten Karte); Unsinn/zu kurz → unknown; mehrdeutig → ambiguous', () => {
  const t = card('Acid Rain');
  const w = m.judgeGuess(real, t, 'Fireball');
  assert.equal(w.kind, 'wrong');
  assert.equal(w.best.name, 'Fireball');
  assert.equal(m.judgeGuess(real, t, 'qzxwvkj').kind, 'unknown');
  assert.equal(m.judgeGuess(real, t, 'ac').kind, 'unknown');
  assert.equal(m.judgeGuess(real, t, '  ').kind, 'unknown');
  // „Alice“ passt auf mehrere Heroes gleich gut → weder richtig noch falsch gezählt
  const alice = card('Alice, the Puppeteer Girl');
  assert.equal(m.judgeGuess(real, alice, 'Alice').kind, 'ambiguous');
  assert.equal(m.judgeGuess(real, alice, 'Alice, the Puppeteer Girl').kind, 'correct');
  assert.equal(m.judgeGuess(real, alice, 'alice puppeteer').kind, 'correct');
  assert.equal(m.judgeGuess(real, card('Alice, the Transfer Student'), 'Alice puppeteer girl').kind, 'wrong');
});

test('Belohnung: 20 SC, −2 je eigenem falschem Tipp, nie unter 0', () => {
  assert.equal(m.reward(20, 2, 0), 20);
  assert.equal(m.reward(20, 2, 1), 18);
  assert.equal(m.reward(20, 2, 7), 6);
  assert.equal(m.reward(20, 2, 10), 0);
  assert.equal(m.reward(20, 2, 50), 0);
});

test('Tageskontingent folgt dem Berliner Kalendertag; nächste Mitternacht auch über die Zeitumstellung', () => {
  const t1 = Date.UTC(2026, 5, 10, 21, 59, 0);      // 23:59 Berlin (Sommerzeit)
  const t2 = Date.UTC(2026, 5, 10, 22, 1, 0);       // 00:01 Berlin am Folgetag
  assert.equal(m.berlinDay(t1), '2026-06-10');
  assert.equal(m.berlinDay(t2), '2026-06-11');
  assert.deepEqual(m.dayState({ date: '2026-06-10', count: 4 }, t1), { date: '2026-06-10', count: 4 });
  assert.deepEqual(m.dayState({ date: '2026-06-10', count: 5 }, t2), { date: '2026-06-11', count: 0 });
  assert.deepEqual(m.dayState(null, t1), { date: '2026-06-10', count: 0 });
  assert.equal(m.nextBerlinMidnightSec(t1), Math.floor(Date.UTC(2026, 5, 10, 22, 0, 0) / 1000));
  assert.equal(m.nextBerlinMidnightSec(Date.UTC(2026, 0, 10, 12, 0, 0)), Math.floor(Date.UTC(2026, 0, 10, 23, 0, 0) / 1000), 'Winterzeit');
  // Umstellung 29.3.2026 (Berlin springt 02→03 Uhr): Mitternacht davor 23:00 UTC, danach 22:00 UTC
  assert.equal(m.nextBerlinMidnightSec(Date.UTC(2026, 2, 28, 12, 0, 0)), Math.floor(Date.UTC(2026, 2, 28, 23, 0, 0) / 1000));
  assert.equal(m.nextBerlinMidnightSec(Date.UTC(2026, 2, 29, 12, 0, 0)), Math.floor(Date.UTC(2026, 2, 29, 22, 0, 0) / 1000));
});

test('Kartenauswahl: nur mit Kunst, keine Token, möglichst nicht die letzten', () => {
  const cards = [{ name: 'A', cardType: 'Spell' }, { name: 'B', cardType: 'Token' }, { name: 'C', cardType: 'Hero' }, { name: 'D', cardType: 'Creature' }];
  const has = n => n !== 'D';
  assert.deepEqual(m.eligibleCards(cards, has, []).map(c => c.name), ['A', 'C']);
  assert.deepEqual(m.eligibleCards(cards, has, ['A']).map(c => c.name), ['C']);
  assert.deepEqual(m.eligibleCards(cards, has, ['A', 'C']).map(c => c.name), ['A', 'C'], 'sind alle zuletzt dran, gilt wieder der ganze Vorrat');
});
