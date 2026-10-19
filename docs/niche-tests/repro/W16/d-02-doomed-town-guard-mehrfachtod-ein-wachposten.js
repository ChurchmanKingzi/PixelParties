'use strict';
// W16d · d-02 (zu C02-03): „one or more targets … are defeated" - ein Mehrfachtod in EINEM Vorgang (Zerstörungsschleife / Flächenschlag)
// bringt nur EINEN Wachposten (zwei Kopien auf der Hand), zwei getrennte Tode bringen je einen (C02-03).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const DTG = 'Doomed Town Guard';
  const t = await H.fresh({ hand: [[DTG, DTG], []] });
  const mk = (s, h, z, n) => { const i = t.put(s, h, z, n); i.turnPlayed = 1; return i; };
  const x = mk(0, 0, 0, H.INERT.creature), y = mk(0, 1, 0, H.INERT.creature);
  const quelle = { name: 'Field Cannon', owner: 1, controller: 1 };
  await t.run(async () => {
    t.engine.beginDestroyScope(2);
    try { await t.engine.actionDestroyCard(quelle, x); await t.engine.actionDestroyCard(quelle, y); }
    finally { t.engine.endDestroyScope(); }
  });
  const n = t.inst(c => c.name === DTG && c.zone === 'support').length;
  R.check('zwei Tode in einem Vorgang, zwei Kopien auf der Hand: nur EIN Wachposten', n === 1, { n, hand: t.pile(0, 'hand') });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
