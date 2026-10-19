'use strict';
// W16d · d-03 (zu A08-07): Extra Life (Trial of Coolness) greift bei „defeat" (Zerstörung), aber NICHT bei einem OPFER (ein Opfer ist kein
// „defeat" - sonst wären Opferkosten umsonst); die Kreatur geht normal in die Ablage.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const D = H.INERT.creature;
  const t = await H.fresh({});
  const c = t.put(0, 0, 0, D); c.turnPlayed = 1;
  t.engine.addExtraLife(c.counters, { by: 'Trial of Coolness' });
  await t.run(() => t.engine.actionDestroyCard({ name: 'Opfer', owner: 0, heroIdx: 0 }, c, { isSacrifice: true }));
  R.check('Opfer: die Kreatur ist weg (kein Extraleben)', !t.gs.players[0].supportZones[0][0].length, t.gs.players[0].supportZones[0]);
  R.check('Opfer: Kreatur liegt in der Ablage', t.pile(0, 'discardPile').includes(D), t.pile(0, 'discardPile'));
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
