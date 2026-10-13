// A08-09 · Distracting Crystal erfasst nur Karten mit der Marke `shufflesFromHandOrDiscardIntoDeck` – drei Karten mit genau diesem Effekt haben sie nicht
//
// Kartentext Distracting Crystal: „While this card is in your hand, you cannot activate effects that include adding cards
//   from your hand or discard pile to your deck."
// Staff of the Teleporter: „Shuffle any number of cards from your hand into your deck and draw the same number of cards. …"
// Brainstorming:           „… Then, shuffle 4 cards with the same name from your discard pile back into your deck." (Spell)
// Priest of Luna:          „You may shuffle 5 Creatures with different names from your discard pile back into your deck to summon this Creature as an additional Action."
//
// Erwartung: Mit Distracting Crystal auf der Hand sind diese Effekte nicht aktivierbar (wie Horn in a Bottle/Leadership/Renewable Energy, die die Marke tragen).
// Beobachtet: Alle drei laufen normal durch (`staff-of-the-teleporter.js`, `brainstorming.js`, `priest-of-luna.js`/`_priest-shared.js` tragen die Marke nicht;
//   die Tore in server.js lesen nur sie). Vergleichslauf ohne Kristall gleich. (Priest of Tempeste teilt `_priest-shared.js`.)
// Aufruf: node docs/niche-tests/repro/A08-pacman/09-distracting-crystal-ungekennzeichnete-karten.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const F = H.INERT.filler, A = H.INERT.artifact, D = H.INERT.creature;
  // 1) Staff of the Teleporter
  {
    const t = await H.fresh({ gold: [100, 100], hand: [[], []], deck: [Array(20).fill(F), Array(20).fill(F)] });
    t.engine.handZugangSync(0, 'Distracting Crystal');
    for (const n of [F, F, F]) t.engine.handZugangSync(0, n);
    t.script.push({ match: d => d.type === 'handPick', answer: (d) => ({ selectedCards: [{ handIndex: 1, cardName: t.pile(0, 'hand')[1] }] }) });
    const r = await t.play(0, 'Staff of the Teleporter');
    R.check('Staff of the Teleporter wird mit Distracting Crystal auf der Hand abgelehnt (play = false)', r === false, { play: r, hand: t.pile(0, 'hand'), prompts: t.prompts.map(p => p.d.type) });
    R.check('Staff: keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  // 2) Brainstorming (4 gleiche in der Ablage)
  {
    const t = await H.fresh({ gold: [100, 100], hand: [[], []], deck: [[A, F, F, F, F, F, F, F, F, F, F, F], Array(20).fill(F)] });
    t.engine.handZugangSync(0, 'Distracting Crystal');
    t.setDiscard(0, [F, F, F, F]);
    t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: A }) });
    const d0 = t.pile(0, 'discardPile').length;
    const r = await t.play(0, 'Brainstorming');
    R.check('Brainstorming wird mit Distracting Crystal auf der Hand abgelehnt (play = false) bzw. mischt nichts zurück', r === false || t.pile(0, 'discardPile').length >= d0, { play: r, ablage: t.pile(0, 'discardPile'), deck: t.pile(0, 'mainDeck').length });
    R.check('Brainstorming: keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  // 3) Priest of Luna (Zusatzbeschwörung gegen 5 Kreaturen aus der Ablage ins Deck)
  {
    const t = await H.fresh({ gold: [100, 100], hand: [[], []], deck: [Array(20).fill(F), Array(20).fill(F)] });
    t.engine.handZugangSync(0, 'Distracting Crystal');
    const names = [D, 'ZZ Dummy Big', 'ZZ Dummy Frail', 'Paraseed', 'Chatty Town Guard'];
    t.setDiscard(0, names.slice());
    let i = 0;
    t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: names[i++ % 5] }) });
    const r = await t.play(0, 'Priest of Luna', { hero: 0, phase: 2 });
    R.check('Priest of Luna kann nicht per „5 Kreaturen ins Deck mischen" beschworen werden (play = false)', r === false, { play: r, ablage: t.pile(0, 'discardPile'), brett: t.gs.players[0].supportZones[0] });
    R.check('Priest: keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
