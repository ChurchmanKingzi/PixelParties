'use strict';
// N5-07 · Potion of Greed: „Draw 2 cards from your Potion Deck. Skip your Action Phase this turn."
// Regel D1 (Al; Kopf von potion-of-greed.js und `_draw-block-shared.js`): „Zug + Nachteil — der Zug ist der ganze Nutzen: unter Zieh-/Hand-Sperre nicht spielbar" — ist das Ziehen unmöglich, bleibt nur der
// Nachteil „Skip your Action Phase", also sperrt die Karte. Potion Juggler (Ziehen aus dem Potion Deck + Nachteil) sperrt deshalb auch bei `ps.potionDrawBanned` und bei zu kleinem Potion Deck.
// Potion of Greed prüft nur `drawWouldBeBlocked` (Tuscan Artist), `handLocked` und die Phase — `potionDrawBanned` (Chaos-Diamond/Pinta-Starthelden: kein Ziehen aus dem Potion Deck)
// und ein leeres Potion Deck lassen sie spielbar: nichts wird gezogen, die Aktionsphase entfällt trotzdem.
// Erwartet: Potion of Greed ist bei Potion-Deck-Zieh-Sperre nicht spielbar (Karte bleibt auf der Hand, `_skipActionPhaseTurn` nicht gesetzt).
// Beobachtet: gespielt, 0 Karten gezogen, `_skipActionPhaseTurn` gesetzt.
// Aufruf: node docs/niche-tests/repro/N5-sonstige/07-potion-of-greed-spielbar-ohne-ziehmoeglichkeit.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const seat of [0, 1]) {
    for (const [name, anzahl, gebannt, soll] of [['Potion Deck 5 (Gegenprobe)', 5, false, true], ['Potion Deck 5, potionDrawBanned', 5, true, false], ['Potion Deck leer', 0, false, false]]) {
      const hand = [[], []]; hand[seat] = ['Potion of Greed'];
      const pd = [[], []]; pd[seat] = Array(anzahl).fill('Healing Potion');
      const t = await H.fresh({ active: seat, hand, potionDeck: pd });
      const ps = t.gs.players[seat];
      if (gebannt) ps.potionDrawBanned = true;
      const r = await t.play(seat, 'Potion of Greed', {});
      const gespielt = r === true && !t.pile(seat, 'hand').includes('Potion of Greed');
      // W24e: „Potion Deck leer" ist die schwächere Lesart (kein Ruling; wie Elixir of Quickness mit leerem Hauptdeck bleibt die Karte spielbar) – Frage an Al, hier nur eine Notiz.
      if (anzahl === 0) R.note(`Sitz ${seat} · ${name}: Potion of Greed ${gespielt ? 'spielbar' : 'nicht spielbar'} (Regelfrage an Al, kein Fehlerkriterium)`, { r });
      else R.check(`Sitz ${seat} · ${name}: Potion of Greed ${soll ? 'spielbar' : 'nicht spielbar'}`, gespielt === soll, { r, gezogen: t.pile(seat, 'hand').filter(n => n === 'Healing Potion').length, skip: ps._skipActionPhaseTurn });
      R.check('sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
    }
  }
  R.finish();
})();
