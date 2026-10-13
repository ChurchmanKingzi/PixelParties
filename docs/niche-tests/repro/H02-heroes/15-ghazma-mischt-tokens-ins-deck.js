// H02-heroes-15 · Ghazma – am Zugende werden besiegte TOKEN-Kreaturen aus dem Gelöscht-Stapel ins Deck gemischt (und zählen für das Ziehen)
//
// Kartentext Ghazma: „Creatures that are defeated are deleted. At the end of every turn, the turn player's deleted Creatures that were not deleted this turn are shuffled back into their owner's deck. Then, the turn player draws that many cards (max 2)."
// Engine-Konvention (README/B-Bericht, A05-02, `_engine.js` ~47686 `_addCardToState`): Tokens sind keine Karten; sie liegen nie in Hand, Deck oder Ablage (sie gehen ins Gelöscht, ohne je zurückzukehren).
// Beobachtung: ein im Schadensweg besiegter Mummy/Invader/Leprochaun/Biomancy Token liegt (korrekt) im Gelöscht-Stapel seines Besitzers. Ist Ghazma auf dem Brett, nimmt `ghazma-the-worm-feeder.js` onTurnEnd
//   jede gelöschte Karte, für die `hasCardType(cd, 'Creature')` gilt – der Token-Typ „Token/Creature" gehört dazu. Folge: der Token liegt als Karte im Deck (Kartenbilanz +1, Token-Karte kann gezogen werden)
//   und zählt für „draws that many cards". Ohne Ghazma bleibt er im Gelöscht-Stapel (Kontrolle grün).
// Aufruf: node docs/niche-tests/repro/H02-heroes/15-ghazma-mischt-tokens-ins-deck.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
const GH = 'Ghazma, the Worm Feeder';
(async () => {
  const R = H.runner();
  for (const tok of ['Mummy Token', 'Biomancy Token']) {
    for (const withGhazma of [false, true]) {
      // Sitz 0: Ghazma (oder neutral); Sitz 1 am Zug, hat den Token auf dem Brett; Token stirbt im Zug von Sitz 1, Zugende wird dreimal durchlaufen.
      const t = await H.fresh({ heroes: [[withGhazma ? GH : H.BLANK_HEROES[0], H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], active: 1, deckSize: 5 });
      const c = t.put(1, 0, 0, tok);
      await t.run(() => t.engine.actionDealCreatureDamage({ name: 'Test', owner: 0, heroIdx: 0 }, c, 999, 'spell'));
      R.check(`${tok}: nach dem Tod im Gelöscht-Stapel des Besitzers`, t.pile(1, 'deletedPile').includes(tok), t.pile(1, 'deletedPile'));
      await t.endTurn(); await t.endTurn(); await t.endTurn();   // Zugende Sitz 1 (gleicher Zug), Sitz 0, Sitz 1 (spätere Runde)
      const deck = t.pile(1, 'mainDeck'), hand = t.pile(1, 'hand'), disc = t.pile(1, 'deletedPile');
      const imDeck = deck.filter(n => n === tok).length + hand.filter(n => n === tok).length;
      R.check(`${tok}${withGhazma ? ' (Ghazma auf dem Brett)' : ' (Kontrolle ohne Ghazma)'}: Token landet NICHT als Karte in Deck/Hand`, imDeck === 0, { deck: deck.length, hand, gelöscht: disc });
      R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
    }
  }
  R.finish();
})();
