'use strict';
// S02-19 · Fire Bolts: „target your opponent controls" / „a target you control" werden nach Brettspalte statt nach Kontrolle angeboten (weiterer Betroffener der Wurzel von S03-06)
// Fire Bolts: „Choose a target your opponent controls and deal 100 damage to it. Then, choose a target you control and deal 50 damage to it."
// Aufbau: Sitz 0 besitzt X (vom Gegner gestohlen: Besitzer 0, Kontrolle 1) und M (eigene); Sitz 1 besitzt Y (von Sitz 0 gestohlen: Besitzer 1, Kontrolle 0) und Z (normale).
// Erwartet: 1. Liste („opponent controls"): Helden des Gegners, Z, X – NICHT Y. 2. Liste („you control"): eigene Helden, M, Y – NICHT X.
// Beobachtet: 1. Liste enthält Z und Y (nicht X); 2. Liste enthält X, Y, M (Y in BEIDEN Listen, X unterstellt dem Gegner und trotzdem „meins").
// Ursache (vermutet): `_engine.js` promptDamageTarget ~4880–4940 (`side: 'enemy'` liest die physische Spalte; siehe S03-06); fire-bolts.js Z. 183 `side: 'enemy'`.
const H = require('../../lib/h.js');
const settle = () => new Promise(r => setTimeout(r, 250));   // die Steal-Kette läuft kurz nach und sperrt Handkarten
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Fire Bolts'], []], deckSize: 30 });
  const mk = (seat, hi, slot) => { const c = t.put(seat, hi, slot, H.INERT.big); c.counters.currentHp = 1000; c.counters.maxHp = 1000; return c; };
  const X = mk(0, 1, 0), M = mk(0, 0, 1), Z = mk(1, 0, 0), Y = mk(1, 1, 1);
  await t.engine.actionStealCreature(1, X); await t.engine.actionStealCreature(0, Y); await settle();
  const nm = (v) => v.cardInstance === X ? 'X' : v.cardInstance === Y ? 'Y' : v.cardInstance === Z ? 'Z' : v.cardInstance === M ? 'M' : null;
  const listen = [];
  t.targetFn = (valid) => { listen.push(valid.map(nm).filter(Boolean)); return [valid[0].id]; };
  await t.play(0, 'Fire Bolts', { hero: 0 });
  R.note('Listen', JSON.stringify(listen));
  R.check('Liste 1 („opponent controls") enthält X (vom Gegner kontrolliert)', (listen[0] || []).includes('X'), listen[0]);
  R.check('Liste 1 enthält Y NICHT (von mir kontrolliert)', !(listen[0] || []).includes('Y'), listen[0]);
  R.check('Liste 2 („you control") enthält Y (von mir kontrolliert)', (listen[1] || []).includes('Y'), listen[1]);
  R.check('Liste 2 enthält X NICHT (vom Gegner kontrolliert)', !(listen[1] || []).includes('X'), listen[1]);
  R.finish();
})();
