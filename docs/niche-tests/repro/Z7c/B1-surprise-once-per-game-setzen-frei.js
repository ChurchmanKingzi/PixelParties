'use strict';
// Z7c-B1 · Surprise mit „once per game" (Tharxian Horse): erst die AKTIVIERUNG verbraucht die Grenze, das verdeckte Setzen nicht.
// Al (Welle 3): „Erst die Aktivierung soll das once per game verbrauchen! Es soll auch möglich sein, dass zB mehrere Heroes die gleiche
//   beschränkte Surprise verdeckt liegen haben!"
// Kartentext Tharxian Horse: „… You can only play 1 \"Tharxian Horse\" per game." – Z7c liest das als Aktivierungsgrenze.
// Erwartung: (a) zwei Kopien lassen sich an zwei Helden verdeckt setzen, ohne dass `_oncePerGameUsed` gestempelt wird;
//            (b) die zweite Kopie ist in der Hand nicht ausgegraut; (c) Kontrolle: eine ANDERE Surprise (ohne Grenze) verhält sich unverändert.
// Aufruf: node docs/niche-tests/repro/Z7c/B1-surprise-once-per-game-setzen-frei.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Tharxian Horse', 'Tharxian Horse', 'Tharxian Horse'], []], phase: 2 });
  t.grantFor(0, 0, 'Tharxian Horse'); t.grantFor(0, 1, 'Tharxian Horse'); t.grantFor(0, 2, 'Tharxian Horse');
  const r0 = await t.play(0, 'Tharxian Horse', { hero: 0 });
  R.check('erste Kopie an Held 0 gesetzt', r0 === true && (t.gs.players[0].surpriseZones[0] || []).length === 1, { r0, z: t.gs.players[0].surpriseZones[0] });
  R.check('Setzen stempelt die Grenze NICHT', !t.gs.players[0]._oncePerGameUsed?.has('Tharxian Horse'), [...(t.gs.players[0]._oncePerGameUsed || [])]);
  R.check('zweite Kopie in der Hand nicht ausgegraut (getBlockedSpells)', !t.engine.getBlockedSpells(0).includes('Tharxian Horse'), t.engine.getBlockedSpells(0));
  const r1 = await t.play(0, 'Tharxian Horse', { hero: 1 });
  R.check('zweite Kopie an Held 1 gesetzt', r1 === true && (t.gs.players[0].surpriseZones[1] || []).length === 1, { r1, z: t.gs.players[0].surpriseZones[1] });
  const r2 = await t.play(0, 'Tharxian Horse', { hero: 2 });
  R.check('dritte Kopie an Held 2 gesetzt (beliebig viele)', r2 === true && (t.gs.players[0].surpriseZones[2] || []).length === 1, { r2 });
  R.check('Grenze weiterhin unverbraucht', !t.gs.players[0]._oncePerGameUsed?.has('Tharxian Horse'));
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.check('Zustand sauber', t.audit().length === 0, t.audit());
  R.finish();
})();
