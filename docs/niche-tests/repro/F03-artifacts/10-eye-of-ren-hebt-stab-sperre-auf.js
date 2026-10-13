'use strict';
// F03-artifacts-10 · The Eye of Ren + Staff: der 6-Gold-Freikauf des Auges hebt die HARTE Ablage-Sperre der Stäbe auf
// Kartentexte: Eye of Ren „You cannot move cards out of your discard pile for the rest of the turn unless you spend an additional 6 Gold."
//              Staff of Uncontrollable Destruction / Staff of the Teleporter „You cannot draw (cards or) move any cards out of your discard pile for the rest of the turn."
// Erwartung: Gelten beide Sperren im selben Zug, gilt die strengere (der Stab hat keine Ausnahme): keine Karte verlässt die Ablage, auch nicht gegen 6 Gold – in beiden Spielreihenfolgen.
// Beobachtet (✗): Der Freikauf wird angeboten und bezahlt (−6 Gold), die Karte wandert aus der Ablage auf die Hand.
// Ursache: Die Stäbe stempeln nur `ps._discardLockedTurn` (staff-of-uncontrollable-destruction.js:102, staff-of-the-teleporter.js:158). `engine._discardOutAllowed` (_engine.js ~2566)
//   erkennt die „harte Sperre" nur am FEHLEN von `ps._discardLockBuyout` – das Auge setzt es (the-eye-of-ren.js:73), kein Stab löscht es / merkt sich die harte Sperre.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const EYE = 'The Eye of Ren', STAFF = 'Staff of Uncontrollable Destruction', TELE = 'Staff of the Teleporter';
  for (const [first, second] of [[EYE, STAFF], [STAFF, EYE], [EYE, TELE], [TELE, EYE]]) {
    const t = await H.fresh({ hand: [[first, second, 'Bird'], []], discard: [['Fireball'], []], gold: 100, deckSize: 20 });
    t.script.push({ match: d => d.type === 'cardGallery' && d.title === EYE, answer: (d) => ({ cardName: d.cards[0].name, source: 'deck' }), once: false });
    t.script.push({ match: d => d.type === 'handPick', answer: () => ({ selectedCards: [] }), once: false });
    t.script.push({ match: d => d.type === 'confirm' && d.title === EYE, answer: () => ({ confirmed: true }), once: false });
    await t.play(0, first);
    await t.play(0, second, { keepActions: true });
    const g0 = t.gs.players[0].gold;
    const res = await t.run(() => t.engine.actionRecycleCards(0, ['Fireball']));   // Karte aus der Ablage zurück ins Deck (läuft durch `_discardOutAllowed`)
    const bewegt = !t.pile(0, 'discardPile').includes('Fireball');
    R.check(`${first} dann ${second}: Fireball verlässt die Ablage NICHT (auch nicht gegen 6 Gold)`, !bewegt, { bewegt, goldDelta: g0 - t.gs.players[0].gold, res });
  }
  R.finish();
})();
