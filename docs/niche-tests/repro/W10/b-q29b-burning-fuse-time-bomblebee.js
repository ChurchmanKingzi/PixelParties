'use strict';
// W10b · Q29b (A05-07) · Burning Fuse erfasst Time Bomblebee: Counter ja, Zerstörung nein
//
// Kartentexte: Time Bomblebee: „Whenever a target your opponent controls is defeated, place a Bomb Counter onto this Creature. While this Creature has
//   Bomb Counters on it, it cannot take damage or be defeated…"; Burning Fuse: „Activate the effects of all "Bomblebee" Creatures you control that were
//   not summoned this turn as if a target your opponent controls was defeated… Defeat all affected "Bomblebee" Creatures afterwards."
// ENTSCHIEDEN (Al, Welle 10, Q29b): „Ja, wird erfasst, erhält einen Counter durch das Fake-Gegner-Death-Ereignis und wird dann dank seiner eigenen
//   Immunität *nicht* zerstört."
// Geprüft: (a) Fuse mit NUR einer Time Bomblebee ist spielbar; (b) Time Bomblebee bekommt 1 Bomb Counter und bleibt auf dem Brett; (c) mit einer
//   zweiten Bomblebee (ohne Counter-Immunität) wird die normale Biene besiegt, die Time Bomblebee bleibt mit Counter stehen.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  let t = await H.fresh({ hand: [['Burning Fuse'], []] });
  t.setAbilities(0, 0, [['Summoning Magic'], [], []]);
  const time = t.put(0, 0, 0, 'Time Bomblebee'); time.turnPlayed = 1;
  t.put(1, 0, 0, H.INERT.big);
  t.targetFn = (valid) => [valid[0].id];
  const r = await t.play(0, 'Burning Fuse', { hero: 0, phase: 3 });
  R.check('(a) Fuse nur mit Time Bomblebee spielbar', r === true && t.pile(0, 'discardPile').includes('Burning Fuse'), { r, ablage: t.pile(0, 'discardPile') });
  R.check('(b) Time Bomblebee: 1 Bomb Counter, steht noch auf dem Brett', time.counters.bombCounters === 1 && time.zone === 'support' && t.engine.cardInstances.includes(time), { counters: time.counters, zone: time.zone });
  R.check('keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);

  t = await H.fresh({ hand: [['Burning Fuse'], []] });
  t.setAbilities(0, 0, [['Summoning Magic'], [], []]);
  const tb = t.put(0, 0, 0, 'Time Bomblebee'); tb.turnPlayed = 1;
  const bee = t.put(0, 0, 1, 'Bomblebee'); bee.turnPlayed = 1;
  t.put(1, 0, 0, H.INERT.big);
  t.targetFn = (valid) => [valid[0].id];
  await t.play(0, 'Burning Fuse', { hero: 0, phase: 3 });
  R.check('(c) normale Bomblebee besiegt, Time Bomblebee bleibt mit Counter', bee.zone !== 'support' && tb.zone === 'support' && tb.counters.bombCounters === 1, { bee: bee.zone, tb: tb.zone, counters: tb.counters.bombCounters });
  R.check('keine Engine-Fehler (2)', t.errors.length === 0, t.errors);
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
