'use strict';
// W17a · Willy (H04-08, Al 19.10.2026): „Ja, wenn Willy irgendwie ‚deaktiviert' ist, ist das Handlimit wieder da."
//
// Kartentext: „You do not have a hand size limit until the start of your second turn."
// Regel: die handlimitfreie Phase gilt nur, solange Willy aktiv ist (lebt, nicht gefroren/betäubt/negiert). Sie ist kein Spielerzustand,
//   sondern wird aus Willys aktuellem Zustand abgeleitet (`bypassHandLimit` im Skript, gelesen von `_shouldBypassHandLimit`): Tod/Deaktivierung -> Limit sofort
//   wieder da; endet die Deaktivierung vor dem zweiten Zug, gilt die Freiheit wieder; ab dem zweiten Zug gilt das Limit in jedem Fall.
// Exit 0 = korrekt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const WI = 'Willy, the Valiant Leprechaun';
  const deck = Array(40).fill(H.INERT.creature);
  const mk = async () => {
    const t = await H.fresh({ heroes: [[WI, 'Tushu, the Knowledge Keeper', 'Rick, the Trigger Happy Undertaker']], hand: [Array(5).fill(H.INERT.filler), []], deck: [deck, deck], turn: 1, phase: 2, active: 0 });
    await t.run(() => t.engine.runHooks('onGameStart', {}));
    const tok = t.put(0, 1, 0, 'Pollution Token'); tok.turnPlayed = 0; tok.counters.handLimitReduction = 2;   // reaktives Handlimit 7 - 2 = 5
    t.script.push({ match: d => d.type === 'optionPicker' && /Willy/.test(d.title || ''), answer: () => ({ optionId: 'draw' }), once: true });
    await t.endTurn();                         // Willys Zugende Zug 1: 5 Karten -> Hand 10; jetzt Zug 2 (Gegnerrunde)
    t.reset();
    return t;
  };
  const byp = (t) => t.engine._shouldBypassHandLimit(0);
  const hand = (t) => t.pile(0, 'hand').length;
  const zieh = async (t) => { await t.run(() => t.engine.actionDrawCards(0, 1, { source: 'Gegner' })); };

  { const t = await mk();
    R.check('Kontrolle: Willy aktiv, Zug 2 -> Bypass', byp(t) === true && t.gs.turn === 2, { turn: t.gs.turn });
    await zieh(t);
    R.check('Kontrolle: kein Zwangsabwurf (Hand 11)', hand(t) === 11, hand(t)); }

  { const t = await mk();
    t.gs.players[0].heroes[0].hp = 0;
    R.check('Willy tot: Handlimit gilt sofort wieder', byp(t) === false); }

  for (const st of ['frozen', 'stunned', 'negated']) {
    const t = await mk();
    t.heroStatus(0, 0, st);
    R.check(`Willy ${st}: Handlimit gilt wieder`, byp(t) === false);
    await zieh(t);
    R.check(`Willy ${st}: Zug durch Gegnereffekt löst das Pollution-Limit aus (Hand <= 5)`, hand(t) <= 5, { hand: hand(t), del: t.pile(0, 'deletedPile').length });
    delete t.gs.players[0].heroes[0].statuses[st];
    R.check(`Willy ${st} abgeklungen: Freiheit wieder da (vor dem zweiten Zug)`, byp(t) === true, { st: t.gs.players[0].heroes[0].statuses });
  }

  { const t = await mk();
    await t.endTurn();                         // Zug 3 = Willys zweiter Zug
    R.check('Ab dem Start des zweiten Zuges: kein Bypass mehr (Zug 3)', t.gs.turn === 3 && byp(t) === false, { turn: t.gs.turn });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors); }

  R.finish();
})();
