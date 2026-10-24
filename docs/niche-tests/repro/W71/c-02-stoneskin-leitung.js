'use strict';
// W71c-02 · Stoneskin: Leitung auf BEIDEN Sitzen — Wirtswahl abbrechbar, Auftritt erst nach der Wahl.
const W = require('../../lib/wire.js');
const CARD = 'Stoneskin';
(async () => {
  const R = W.runner();
  for (const seat of [0, 1]) {
    const label = `[S${seat}] ${CARD}`;
    R.section(label);
    const mk = () => W.reicheSzene({ seat, karten: [CARD], board: async (t) => { t.grantFor(seat, 0, CARD); } });
    const answer = (e) => {
      if (e.kind === 'target') { const v = (e.valid || []).filter(x => !x.ineligible && x.type === 'hero' && x.owner === seat); return v.length ? [v[0].id] : undefined; }
      return undefined;
    };
    const d = await W.durchlauf(mk, seat, CARD, { seat, hero: 0, maxCancel: 3, answer });
    W.pruefeDurchlauf(R, label, d, { seat, nCanc: 1, nEcht: 1 });
    const c = d.clean;
    R.check(`${label}: Stoneskin liegt am Brett`, c.t.gs.players[seat].supportZones.some(z => z.some(s => (s || []).includes(CARD))), c.t.gs.players[seat].supportZones);
  }
  R.finish();
})();
