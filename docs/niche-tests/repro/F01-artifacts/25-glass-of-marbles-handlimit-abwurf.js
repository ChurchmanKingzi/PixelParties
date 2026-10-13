'use strict';
// F01-artifacts-25 · Glass of Marbles zieht 2 Karten, wenn es als Handlimit-Abwurf am Zugende abgelegt wird (Frage an Al)
// Kartentext: „When this card is discarded or deleted from your hand by an effect, draw 2 cards. You can only activate this effect of "Glass of Marbles" once per turn."
// Aufbau: Sitz 0 beendet den Zug mit 9 Handkarten (inkl. Glass of Marbles, 8 Füller); die Handlimit-Abfrage (7) wird mit Glass of Marbles beantwortet.
// Wörtliche Lesart: Der Handlimit-Abwurf ist eine Spielregel, kein Karteneffekt („by an effect") – kein Ziehen.
// Beobachtet: Das Handlimit ruft den Hook mit `_fromHand: true` (`_engine.js` Z. 16944: `runHooks(hookName, { …, _fromHand: true … })`); Glass of Marbles zieht 2 (Log `glass_of_marbles`),
//   danach muss der Spieler wegen der gezogenen Karten weitere Karten abwerfen (4 Abfragen).
// Skript: `glass-of-marbles.js` Kopf: „ctx._fromHand … set by the engine on all effect-forced discards from hand – not on voluntary plays" (das Handlimit wird dort nicht gesondert ausgeschlossen).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Glass of Marbles', ...Array(8).fill('ZZ Filler')], []], deck: [Array(20).fill('ZZ Dummy'), Array(20).fill('ZZ Dummy')] });
  t.script.push({ match: d => d.type === 'forceDiscard', answer: () => { const i = t.gs.players[0].hand.indexOf('Glass of Marbles'); return i >= 0 ? { cardIdx: i, handIdx: i, index: i, cardName: 'Glass of Marbles' } : undefined; } });
  await t.endTurn();
  const gezogen = t.logs.some(l => l.type === 'glass_of_marbles');
  R.check('Handlimit-Abwurf (Regel) löst Glass of Marbles NICHT aus', !gezogen, { logs: t.logs.map(l => l.type).filter(x => /glass|hand_limit/.test(x)), hand: t.pile(0, 'hand').length });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
