'use strict';
// W17a · Kazena (H02-22, Al 19.10.2026): „Doch, Kazenas Effekt KANN bei leerem Deck aktiviert werden – und führt dann zu Niederlage durch Deck-Out."
//
// Kartentext: „You may once per turn draw until you have 7 cards in your hand. If you do, you cannot draw or add cards to your hand for the rest of the turn afterwards."
// Regel: der Effekt ist bei leerem Deck aktivierbar; gezogen wird regulär (`actionDrawCards`), das Ziehen aus dem leeren Deck ist das normale Deck-Out
//   (Niederlage des Spielers, Grund 'deck_out'). Hat der Spieler schon >= 7 Karten, ist der Effekt nicht aktivierbar (nichts wird gezogen, kein Deck-Out).
// Exit 0 = korrekt.
const H = require('../../lib/h.js');
const KZ = 'Kazena, the Storming Rebel';
(async () => {
  const R = H.runner();
  const mk = (o = {}) => H.fresh({ heroes: [[KZ, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], hand: [['ZZ Filler', 'ZZ Filler'], []], ...o });
  { const t = await mk({ deckSize: 0 });
    const r = await t.activateHero(0, 0, { effect: KZ, phase: 2 });
    R.check('leeres Deck, Hand 2: Effekt ist aktivierbar (Rückfrage erschien, Einsatz verbraucht)', r === true && t.prompts.length >= 1, { r, prompts: t.prompts.length });
    R.check('leeres Deck: Niederlage durch Deck-Out (Sitz 0 verliert, Sitz 1 gewinnt)', t.engine.over?.winnerIdx === 1 && t.engine.over?.reason === 'deck_out', t.engine.over);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors); }
  { const t = await mk({ deckSize: 2 });
    const r = await t.activateHero(0, 0, { effect: KZ, phase: 2 });
    R.check('Deck 2 Karten, Hand 2 (5 zu ziehen): 2 Karten gezogen, dann Deck-Out', r === true && t.engine.over?.winnerIdx === 1 && t.engine.over?.reason === 'deck_out' && t.pile(0, 'hand').length === 4, { r, over: t.engine.over, hand: t.pile(0, 'hand').length });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors); }
  { const t = await mk({ deckSize: 0, hand: [Array(7).fill('ZZ Filler'), []] });
    const r = await t.activateHero(0, 0, { effect: KZ, phase: 2 });
    R.check('leeres Deck, Hand 7: nichts wird gezogen, kein Deck-Out', !t.engine.over?.called && t.pile(0, 'hand').length === 7, { r, over: t.engine.over, hand: t.pile(0, 'hand').length });
    R.check('leeres Deck, Hand 7: Einsatz nicht verbraucht', Object.keys(t.gs.hoptUsed || {}).length === 0, t.gs.hoptUsed);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors); }
  { const t = await mk({ deckSize: 20 });
    const r = await t.activateHero(0, 0, { effect: KZ, phase: 2 });
    R.check('Gegenprobe volles Deck: Hand 7, kein Deck-Out, Ziehsperre danach', r === true && t.pile(0, 'hand').length === 7 && !t.engine.over?.called && !!t.gs.players[0].handLocked, { r, hand: t.pile(0, 'hand').length, over: t.engine.over, locked: t.gs.players[0].handLocked });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors); }
  R.finish();
})();
