'use strict';
// W16c · A05-16/-17 (Gegenprobe): The Bonegrinder in der AREA fragt weiter nach Löschen+Ziehen (eigenes Skelett → eigene Ablage);
// die Handkopie daneben reagiert nicht doppelt. Ein gestohlenes Gegner-Skelett (Ablage des Gegners) löst die Area nicht aus.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  let t = await H.fresh({ hand: [['The Bonegrinder'], []], deck: [Array(6).fill(H.INERT.creature), []] });
  t.putArea(0, 'The Bonegrinder');
  const a = t.put(0, 0, 0, 'Skeleton Archer'); a.turnPlayed = 1;
  let fragen = 0;
  t.script.push({ match: d => d.type === 'confirm' && d.title === 'The Bonegrinder', answer: () => { fragen++; return { confirmed: true }; } });
  const h0 = t.pile(0, 'hand').length;
  await t.run(() => t.engine.actionDestroyCard({ name: 'x', owner: 1 }, a));
  R.check('Area + Handkopie: genau EINE Abfrage', fragen === 1, fragen);
  R.check('Skelett gelöscht, 1 Karte gezogen', t.pile(0, 'deletedPile').includes('Skeleton Archer') && t.pile(0, 'hand').length === h0 + 1, { del: t.pile(0, 'deletedPile'), plus: t.pile(0, 'hand').length - h0 });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
