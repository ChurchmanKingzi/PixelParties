'use strict';
// W24 · N3-19 Absicherung: Spirit als erste Kreatur, danach Cannon A (erste ANDERE Kreatur → Haste, heutige Lesart, N3-20 bleibt Frage an Al), Cannon B (zweite → keine Haste);
// ohne Spirit-Vorgänger bekommt die erste Kreatur des Zuges Haste.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const HAM = 'Earth-Shattering Hammer, Relic of Deri', SP = 'Spirit of the Relic Hammer';
  const t = await H.fresh({ hand: [[SP, 'Field Cannon', 'Field Cannon'], []] });
  t.setAbilities(0, 0, [['Summoning Magic', 'Summoning Magic', 'Summoning Magic'], [], []]);
  t.setAbilities(0, 1, [['Summoning Magic', 'Summoning Magic', 'Summoning Magic'], [], []]);
  t.put(0, 0, 0, HAM);
  await t.play(0, SP, { hero: 0, slot: 1, noGrant: true });
  await t.play(0, 'Field Cannon', { hero: 1, slot: 0, noGrant: true });
  await t.play(0, 'Field Cannon', { hero: 1, slot: 1, noGrant: true });
  const k = t.inst(c => c.name === 'Field Cannon' && c.zone === 'support');
  R.check('Spirit zuerst: die erste andere Kreatur (Cannon A) bekommt Haste', k.length === 2 && !!k[0].counters._hasHaste, k.map(c => Object.keys(c.counters)));
  R.check('die zweite andere Kreatur (Cannon B) bekommt keine', k.length === 2 && !k[1].counters._hasHaste);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
