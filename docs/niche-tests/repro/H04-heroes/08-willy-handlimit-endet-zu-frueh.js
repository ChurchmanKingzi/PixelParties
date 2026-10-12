'use strict';
// H04-08 · Willy: „no hand size limit until the start of your second turn" endet schon mit Zug 1 (Gegnerrunde unterliegt wieder dem Limit)
//
// Kartentext (Willy, the Valiant Leprechaun): „At the end of your first turn, draw 5 cards or gain 30 Gold. You do not have a hand size
//   limit until the start of your second turn."
// Erwartung: In der Gegnerrunde zwischen Willys erstem und zweitem Zug (Zug 2) gilt für Willys Spieler kein Handlimit – auch nicht das
//   reaktive Pollution-Limit (Pollution Token: `handLimitReduction`), das sofort beim Ziehen erzwungen wird.
// Beobachtet: `ps._noHandLimitUntilTurn = firstTurn` und `_shouldBypassHandLimit` prüft `turn <= firstTurn` → in Zug 2 ist der Bypass weg;
//   ein Zug durch Gegnereffekt löst den Pollution-Zwangsabwurf aus (hier 10 → 5 Karten, 6 Karten gelöscht).
// Ursache: willy-the-valiant-leprechaun.js `onGameStart` setzt die Grenze auf `firstTurn` statt `firstTurn + 1` (bzw. bis Beginn des eigenen Zuges `firstTurn + 2`).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const WI = 'Willy, the Valiant Leprechaun';
  const deck = Array(40).fill(H.INERT.creature);
  const t = await H.fresh({ heroes: [[WI, 'Tushu, the Knowledge Keeper', 'Rick, the Trigger Happy Undertaker']], hand: [Array(5).fill(H.INERT.filler), []], deck: [deck, deck], turn: 1, phase: 2, active: 0 });
  await t.run(() => t.engine.runHooks('onGameStart', {}));
  const tok = t.put(0, 1, 0, 'Pollution Token'); tok.turnPlayed = 0; tok.counters.handLimitReduction = 2;   // reaktives Handlimit 7 - 2 = 5
  t.script.push({ match: d => d.type === 'optionPicker' && /Willy/.test(d.title || ''), answer: () => ({ optionId: 'draw' }), once: true });
  await t.endTurn();
  R.check('Vorbereitung: Willy zog am Ende von Zug 1 fünf Karten (Hand 10), nichts gelöscht', t.pile(0, 'hand').length === 10 && t.pile(0, 'deletedPile').length === 0, { hand: t.pile(0, 'hand').length, del: t.pile(0, 'deletedPile').length });
  t.reset();
  await t.run(() => t.engine.actionDrawCards(0, 1, { source: 'Gegner' }));     // Zug 2 (Gegnerrunde): Sitz 0 zieht durch einen Gegnereffekt
  R.check('Gegnerrunde (Zug 2, vor Willys zweitem Zug): kein Zwangsabwurf (Hand 11)', t.pile(0, 'hand').length === 11, { turn: t.gs.turn, hand: t.pile(0, 'hand').length, geloescht: t.pile(0, 'deletedPile').length });
  R.finish();
})();
