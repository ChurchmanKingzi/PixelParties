'use strict';
// W77b: Mehrfachtreffer-Spells rechnen ihre Schlagzahl über `zweitwurfSchlaege` (Bartas' Zweitwurf trifft nur EINMAL; scripts/check-zweitwurf-schlaege.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const { pruefe, trifftMehrfach } = require('../scripts/check-zweitwurf-schlaege');
const { zweitwurfSchlaege } = require('../cards/effects/_second-target-shared');
const CARDS = require('../data/cards.json');

test('jeder Normal-Spell/-Attack mit „as many times as"/„Trigger this effect" benutzt zweitwurfSchlaege', () => {
  const { fehlend, gepruefte } = pruefe({ karten: CARDS });
  assert.deepEqual(fehlend, [], 'ohne zweitwurfSchlaege: ' + fehlend.join(', '));
  assert.ok(gepruefte.includes('Kirin Firebreath') && gepruefte.includes('Future Tech Barrage'), 'Orakel findet die bekannten Karten: ' + gepruefte.join(', '));
});

test('Wächter-Selbsttest: Mehrfachtreffer-Text ohne Baustein wird gemeldet, Multiplikatoren nicht', () => {
  assert.ok(trifftMehrfach('Choose a target and deal 50 damage to it as many times as you have X.'));
  assert.ok(trifftMehrfach('Choose a target and deal 180 damage to it. Trigger this effect as many times as there are cards.'));
  assert.ok(trifftMehrfach('Deal 100 damage to a target 3 times.'));
  assert.ok(!trifftMehrfach('Deal damage equal to 70 times the number of removed counters.'));
  assert.ok(!trifftMehrfach("Deal damage equal to twice the attacker's Attack stat."));
  assert.ok(!trifftMehrfach('Choose up to 3 targets and deal 50 damage to them.'));
  const karten = [
    { name: 'A', cardType: 'Spell', subtype: 'Normal', spellSchool1: 'Destruction Magic', effect: 'Deal 50 damage to it as many times as you like.' },
    { name: 'B', cardType: 'Spell', subtype: 'Normal', spellSchool1: 'Destruction Magic', effect: 'Deal 50 damage to it as many times as you like.' },
    { name: 'C', cardType: 'Spell', subtype: 'Normal', spellSchool1: 'Support Magic', effect: 'Deal 50 damage to it as many times as you like.' },
  ];
  const src = { A: 'x zweitwurfSchlaege(gs, n) x', B: 'nichts' , C: 'nichts' };
  assert.deepEqual(pruefe({ karten, ladeQuelle: (n) => src[n] }).fehlend, ['B']);
});

test('zweitwurfSchlaege: Hauptwurf volle Zahl, Zweitwurf genau 1', () => {
  assert.equal(zweitwurfSchlaege({}, 5), 5);
  assert.equal(zweitwurfSchlaege({ _zweitzielWurf: true }, 5), 1);
  assert.equal(zweitwurfSchlaege({ _zweitzielWurf: true }, 0), 0);
  assert.equal(zweitwurfSchlaege({ _bartasSecondCast: true }, 4), 4);
});
