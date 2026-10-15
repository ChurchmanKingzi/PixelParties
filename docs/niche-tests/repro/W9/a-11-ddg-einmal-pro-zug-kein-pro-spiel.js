'use strict';
// W9a · Q11 (A02-deepsea-15) · Al, 15.10.2026: „Ja, die once per game Klausel kann einfach weg“ und früher „Es sollte einmal pro Runde sein.“
// Erwartet: (0) Kartentext in data/cards.json enthält die Klausel „once per game“ nicht mehr, aber weiter „This effect can only occur once per turn.“
//   (1) Der 150-Schaden löst im selben Zug nur EINMAL aus (zweiter DDG im selben Zug: kein weiterer Schaden),
//   (2) in einem späteren Zug löst er erneut aus (keine Pro-Spiel-Sperre).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const cards = require('../../../../data/cards.json');
  const txt = (cards.find(c => c.name === 'Dark Deepsea God') || {}).effect || '';
  R.check('(0) Kartentext ohne „once per game“-Satz', !/once per game/i.test(txt), txt);
  R.check('(0) Kartentext behält „can only occur once per turn“', /can only occur once per turn/.test(txt), txt);
  const t = await H.fresh({ hand: [['Dark Deepsea God', 'Dark Deepsea God'], []], hp: 800 });
  t.script.push({ match: d => d.type === 'zonePick', answer: (d) => ({ heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx, owner: d.zones[0].owner }) });
  t.targetFn = (valid) => valid.filter(v => v.type === 'equip').map(v => v.id);
  const hpOpp = () => [0, 1, 2].map(i => t.hp(1, i));
  const tribut = () => { const a = t.put(0, 1, 0, 'Deepsea Werewolf'), b = t.put(0, 2, 0, 'Deepsea Siren'); a.turnPlayed = b.turnPlayed = 1; };
  const a0 = t.put(0, 0, 0, 'Deepsea Werewolf'), b0 = t.put(0, 0, 1, 'Deepsea Siren'); a0.turnPlayed = b0.turnPlayed = 1;
  await t.play(0, 'Dark Deepsea God', { hero: 0, slot: 0, noGrant: true });
  R.check('Vorbedingung: DDG #1 trifft (800 → 650)', hpOpp().every(h => h === 650), hpOpp());
  // zweiter DDG im SELBEN Zug
  tribut();
  await t.play(0, 'Dark Deepsea God', { hero: 1, slot: 0, noGrant: true });
  R.check('(1) Vorbedingung: zweiter DDG wurde gespielt', t.inst(c => c.name === 'Dark Deepsea God' && c.zone === 'support').length === 2, t.inst(c => c.name === 'Dark Deepsea God').map(c => c.zone));
  R.check('(1) zweiter DDG im selben Zug: kein weiterer Schaden', hpOpp().every(h => h === 650), hpOpp());
  // späterer Zug
  await t.endTurn(); await t.endTurn();
  for (const d of t.inst(c => c.name === 'Dark Deepsea God' && c.zone === 'support')) await t.run(() => t.engine.actionDestroyCard({ name: 'Test', owner: 1 }, d));
  t.setHand(0, ['Dark Deepsea God']);
  const c = t.put(0, 1, 0, 'Deepsea Werewolf'), d = t.put(0, 2, 0, 'Deepsea Siren'); c.turnPlayed = d.turnPlayed = 1;
  await t.play(0, 'Dark Deepsea God', { hero: 0, slot: 0, noGrant: true });
  R.check('(2) späterer Zug: Schaden löst erneut aus (650 → 500)', hpOpp().every(h => h === 500), hpOpp());
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
