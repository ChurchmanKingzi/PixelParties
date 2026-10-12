'use strict';
// A03-futuretech-03 · Future Tech Magic Modifier senkt die Stufe ALLER gleichnamigen Zauber, nicht nur des aufgedeckten
//
// Kartentext: „Reveal a Spell in your hand until the end of the turn. That Spell's level is reduced by the number of
//   "Future Tech Magic Modifier" cards in your discard pile while it stays revealed."
// Erwartung: Nur die aufgedeckte Karte ist um 1 Stufe niedriger. Die zweite, NICHT aufgedeckte Fireball (Lv 2) bleibt Lv 2 und
//   ist mit Destruction Magic Lv 1 weiter nicht spielbar.
// Beobachtet: Die zweite Fireball wird gewirkt (150 Schaden), obwohl sie nie aufgedeckt wurde.
// Ursache: cards/effects/future-tech-magic-modifier.js:103-105 trägt `{ cardName, amount }` in `ps._magicLevelReductions` ein;
//   _engine.js:43967-43970 vergleicht nur den Kartennamen (kein Handindex, keine „aufgedeckt"-Markierung wie `_revealedHandIndices`).
const H = require('../../lib/h.js');
const MM = 'Future Tech Magic Modifier';
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [[MM, 'Fireball', 'Fireball'], []], discard: [[MM], []], gold: 100 });
  t.setAbilities(0, 0, [['Destruction Magic'], [], []]);                  // Lv 1: reicht nicht für Fireball (Lv 2)
  t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
  const k = await t.play(0, 'Fireball', { hero: 0, noGrant: true, handIndex: 2 });
  R.check('Kontrolle: ohne Aufdecken ist Fireball (Lv 2) mit Destruction Lv 1 nicht spielbar', k === false && t.hp(1, 0) === 800, { k, hp: t.hp(1, 0) });
  t.script.push({ match: d => d.type === 'pickHandCard', answer: () => ({ cardName: 'Fireball', handIndex: 1 }), once: true });   // aufgedeckt wird die ERSTE Fireball
  await t.play(0, MM, { hero: 0 });
  const r = await t.play(0, 'Fireball', { hero: 0, noGrant: true, handIndex: t.pile(0, 'hand').length - 1 });    // die andere, nicht aufgedeckte Kopie
  R.check('Die NICHT aufgedeckte zweite Fireball bleibt Lv 2 und ist nicht spielbar', r === false && t.hp(1, 0) === 800, { r, hp: t.hp(1, 0), hand: t.pile(0, 'hand') });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
