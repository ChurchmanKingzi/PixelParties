'use strict';
// W26a · Entscheidung Al (21.10.2026, N5-07, Frage 1 „ja"): Potion of Greed („Draw 2 cards from your Potion Deck. Skip your Action Phase this turn.")
// ist bei LEEREM Potion Deck nicht spielbar (zusätzlich zu `potionDrawBanned`, Konvention D1: „ein Effekt, der nicht feuern kann, ist nicht aktivierbar").
// Gegenproben: 1 Karte im Potion Deck → spielbar, zieht nur diese eine (Skip der Aktionsphase greift); 2 Karten → zieht 2; Elixir of Quickness bleibt bei leerem Potion Deck spielbar.
// Aufruf: node docs/niche-tests/repro/W26/a-01-potion-of-greed-leeres-potion-deck.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const seat of [0, 1]) {
    R.section(`Sitz ${seat}`);
    for (const [anzahl, soll] of [[0, false], [1, true], [2, true]]) {
      const hand = [[], []]; hand[seat] = ['Potion of Greed'];
      const pd = [[], []]; pd[seat] = Array(anzahl).fill('Healing Potion');
      const t = await H.fresh({ active: seat, hand, potionDeck: pd });
      const ps = t.gs.players[seat];
      const r = await t.play(seat, 'Potion of Greed', {});
      const gespielt = r === true && !t.pile(seat, 'hand').includes('Potion of Greed');
      const gezogen = t.pile(seat, 'hand').filter(n => n === 'Healing Potion').length;
      R.check(`Potion Deck ${anzahl}: Potion of Greed ${soll ? 'spielbar' : 'nicht spielbar'}`, gespielt === soll, { r, gespielt });
      if (soll) R.check(`Potion Deck ${anzahl}: zieht ${anzahl} und überspringt die Aktionsphase`, gezogen === anzahl && ps._skipActionPhaseTurn === t.gs.turn, { gezogen, skip: ps._skipActionPhaseTurn });
      else R.check('Potion Deck leer: Karte bleibt auf der Hand, kein Aktionsphasen-Skip', t.pile(seat, 'hand').includes('Potion of Greed') && ps._skipActionPhaseTurn !== t.gs.turn, { skip: ps._skipActionPhaseTurn });
      R.check('sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
    }
    { // Gegenprobe: andere Tränke unverändert (Elixir of Quickness bei leerem Potion Deck)
      const hand = [[], []]; hand[seat] = ['Elixir of Quickness'];
      const t = await H.fresh({ active: seat, hand, potionDeck: [[], []] });
      const r = await t.play(seat, 'Elixir of Quickness', { hero: 0 });
      R.check('Elixir of Quickness mit leerem Potion Deck weiterhin spielbar', r === true && !t.pile(seat, 'hand').includes('Elixir of Quickness'), { r });
      R.check('sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
    }
  }
  R.finish();
})();
