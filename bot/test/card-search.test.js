'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { searchCards, closeAlternatives, norm } = require('../lib/card-search');

const real = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'cards.json'), 'utf8'));
const top = (q, cards = real) => searchCards(cards, q)[0]?.card.name;

test('Beispiel aus der Aufgabe: Teocuilatl → der Hero, nicht die Karte „Assault for …“', () => {
  assert.equal(top('Teocuilatl'), 'Teocuilatl, the Embodiment of Gods');
  assert.equal(top('teocuilatl'), 'Teocuilatl, the Embodiment of Gods');
  assert.equal(top('Teocuilat'), 'Teocuilatl, the Embodiment of Gods');   // Tippfehler
  assert.ok(real.some(c => /Assault for Teocuilatl/i.test(c.name)), 'Vergleichskarte existiert in den echten Daten');
});

test('exakter Name schlägt Hero-Bonus', () => {
  const cards = [
    { name: 'Fireball', cardType: 'Spell' },
    { name: 'Fireball, the Burning Hero', cardType: 'Hero' },
  ];
  assert.equal(top('Fireball', cards), 'Fireball');
  assert.equal(top('fire ball', cards), 'Fireball');
});

test('bei ähnlicher Nähe gewinnt der Hero', () => {
  const cards = [
    { name: 'Assault for Zed', cardType: 'Spell' },
    { name: 'Zed, the Sharp', cardType: 'Hero' },
    { name: 'Zed Strike', cardType: 'Attack' },
  ];
  assert.equal(top('Zed', cards), 'Zed, the Sharp');
});

test('Wortfolge in der Mitte, Teilsuche, Satzzeichen', () => {
  assert.equal(top('assault for teocuilatl'), 'Assault for Teocuilatl');
  assert.equal(top('bloom continent'), '"Bloom", the Continent Corruptor');
  assert.equal(top('acid rain'), 'Acid Rain');
  assert.equal(top('ACID   RAIN!!'), 'Acid Rain');
});

test('mehrdeutiger Hero-Anfang liefert Alternativen', () => {
  const r = searchCards(real, 'Alice');
  assert.match(r[0].card.name, /^Alice,/);
  assert.ok(closeAlternatives(r).length >= 1);
});

test('Unsinn findet nichts', () => {
  assert.deepEqual(searchCards(real, 'qzxwvkj'), []);
  assert.deepEqual(searchCards(real, '   '), []);
});

test('jeder Kartenname findet sich selbst', () => {
  for (const c of real) {
    const best = searchCards(real, c.name)[0];
    assert.equal(norm(best.card.name), norm(c.name), `Karte "${c.name}" fand "${best?.card.name}"`);
  }
});
