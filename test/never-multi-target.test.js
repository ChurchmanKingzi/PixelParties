'use strict';
// W75b: Text-Wächter „can never hit more than 1 target" ⇒ `neverMultiTarget: true` (scripts/check-never-multi-target.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const { pruefe, hatWendung } = require('../scripts/check-never-multi-target');
const CARDS = require('../data/cards.json');

test('jede Spell-/Attack-Karte mit „can never hit more than 1 target" trägt neverMultiTarget (Bartas bietet dann keinen Zweitwurf an)', () => {
  const { fehlend, gepruefte } = pruefe({ karten: CARDS });
  assert.deepEqual(fehlend, [], 'ohne neverMultiTarget: ' + fehlend.join(', '));
  assert.ok(gepruefte.includes('Eraser Beam') && gepruefte.includes('Basketskull'), 'Orakel findet die bekannten Karten: ' + gepruefte.join(', '));
});

test('Wächter-Selbsttest: eine Karte mit der Wendung ohne Merkmal wird gemeldet, mit Merkmal nicht', () => {
  const karten = [
    { name: 'A', cardType: 'Spell', effect: 'Choose a target. This Spell can never hit more than 1 target.' },
    { name: 'B', cardType: 'Attack', effect: 'This Attack can never hit more than 1 target at once.' },
    { name: 'C', cardType: 'Spell', effect: 'Choose up to 3 targets and deal 50 damage to them.' },
    { name: 'D', cardType: 'Hero', effect: 'This Hero can never hit more than 1 target with a Destruction Spell.' },
  ];
  const mods = { A: { neverMultiTarget: true }, B: {}, C: {}, D: {} };
  const r = pruefe({ karten, ladeModul: (n) => mods[n] });
  assert.deepEqual(r.fehlend, ['B']);
  assert.ok(hatWendung('This Spell can never affect more than 1 target.'));
  assert.ok(!hatWendung('Choose up to 3 targets.'));
});
