'use strict';
// W16c · A05-20 (Gegenprobe): Lehnt der Besitzer das Winged-Skeleton-Angebot ab, wirkt Burning Skeleton normal (Archer brennt, bleibt im Spiel);
// nimmt er es an, wird die Wirkung negiert und der Archer liegt auf seiner Hand (Winged Skeleton einmal pro Zug).
const H = require('../../lib/h.js');
const wing = (t) => t.prompts.filter(p => p.d.type === 'confirm' && p.d.title === 'Winged Skeleton').length;
(async () => {
  const R = H.runner();
  for (const annehmen of [false, true]) {
    const t = await H.fresh({});
    t.put(0, 0, 0, 'Winged Skeleton').turnPlayed = 1;
    const arch = t.put(0, 0, 1, 'Skeleton Archer'); arch.turnPlayed = 1;
    t.put(1, 0, 0, 'Burning Skeleton').turnPlayed = 1;
    t.script.push({ match: d => d.type === 'confirm' && d.title === 'Winged Skeleton', answer: () => (annehmen ? { confirmed: true } : null) });
    t.targetFn = (valid) => { const v = valid.find(x => x.cardName === 'Skeleton Archer' && x.owner === 0); return [v ? v.id : valid[0].id]; };
    t.gs.activePlayer = 1; t.phase(2);
    await t.activateCreature(1, 0, 0);
    R.check(`(${annehmen ? 'annehmen' : 'ablehnen'}) Angebot erschien genau einmal`, wing(t) === 1, wing(t));
    if (annehmen) {
      R.check('angenommen: Archer ist auf der Hand, nicht verbrannt', t.pile(0, 'hand').includes('Skeleton Archer') && !arch.counters.burned, { hand: t.pile(0, 'hand'), burned: arch.counters.burned });
    } else {
      R.check('abgelehnt: Archer brennt und bleibt auf dem Brett', !!arch.counters.burned && !!t.find('Skeleton Archer', 'support'), { burned: arch.counters.burned });
    }
    R.check('keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
