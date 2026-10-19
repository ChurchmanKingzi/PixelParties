'use strict';
// W16c · A06-30 (Gegenprobe): Tuscan Artist negiert nur Züge von GENAU 2 oder 3 Karten. Der Timid Tanuki mit nur 1 verschiedenem Rebelliokai
// in der Ablage zieht 1 Karte und bleibt aktivierbar; mit 2 verschiedenen (Zug von 2) ist er gesperrt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const K = 'Rebelliokai ';
  for (const [ablage, soll] of [[[K + 'Kind Kitsune'], true], [[K + 'Kind Kitsune', K + 'Backup Bakus'], false]]) {
    const t = await H.fresh({ discard: [ablage, []], deck: [Array(6).fill(H.INERT.creature), []] });
    t.put(0, 0, 0, K + 'Timid Tanuki').turnPlayed = t.gs.turn - 1;
    t.put(1, 0, 0, 'Tuscan Artist');
    t.gs.currentPhase = 2; t.resetActions(0);
    const h0 = t.pile(0, 'hand').length;
    const r = await t.activateCreature(0, 0, 0);
    const gezogen = t.pile(0, 'hand').length - h0;
    R.check(`${ablage.length} verschiedene in der Ablage: ${soll ? 'zieht 1' : 'gesperrt, zieht nichts'}`, soll ? (r === true && gezogen === 1) : (r === false && gezogen === 0), { r, gezogen });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
