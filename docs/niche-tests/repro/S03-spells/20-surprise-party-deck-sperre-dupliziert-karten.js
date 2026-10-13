'use strict';
// S03-20 · Surprise Party unter Knight of Kings [B] (Deck-Sperre): die Deckoberkarte wird 200-mal „aufgedeckt" und 200-mal ins Deck zurückgelegt
// Kartentext: „Reveal the top card of your deck until you reveal a level 3 or lower Creature. … Shuffle all other revealed cards back into your deck."
// Knight of Kings [B]: „your opponent cannot move cards from their deck or discard pile to anywhere else" (`pileOutAllowed(pi, 'deck')` = false).
// Aufbau: Held 0 mit Support Magic 2; Deck [Rockfall, Meteor Crash, ZZ Dummy (Creature), Slow]; Sitz 1 kontrolliert Knight + Rook of Kings [B], Board of Kings liegt.
// Erwartet: Die Karte ist nicht spielbar bzw. wirkungslos, Kartenbilanz ±0 (Deck bleibt bei 4 Karten).
// Beobachtet: `takeFromPileSync(ps, 'deck', 0, …)` (surprise-party.js Z. 106) verweigert die Entnahme, die Schleife liest aber immer wieder `ps.mainDeck[0]` („Rockfall") und
//   schiebt den Namen in `zurueck`, bis der Wächter (`wache < 200`) greift; `zurueckMischen` legt 200 Kopien ins Deck (Deck 4 → 204, Bilanz „Rockfall +200").
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Surprise Party'], []], hp: 800, deck: [['Rockfall', 'Meteor Crash', H.INERT.creature, 'Slow'], ['ZZ Dummy', 'ZZ Dummy', 'ZZ Dummy']] });
  t.setAbilities(0, 0, [['Support Magic', 'Support Magic'], [], []]);
  t.putArea(0, 'Board of Kings'); t.put(1, 0, 0, 'Knight of Kings [B]'); t.put(1, 0, 1, 'Rook of Kings [B]');
  R.check('Ausgangslage: Deck-Entnahme ist gesperrt', t.engine.pileOutAllowed(0, 'deck', { sourceOwner: 0 }) === false);
  const vorher = t.census();
  const r = await t.play(0, 'Surprise Party', { hero: 0, noGrant: true });
  const diff = t.censusDiff(vorher, t.census());
  R.check('Deck bleibt bei 4 Karten', t.pile(0, 'mainDeck').length === 4, { deck: t.pile(0, 'mainDeck').length, r });
  R.check('Kartenbilanz ±0 (keine Duplikate)', diff.length === 0, diff);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  {
    // Variante: die Deckoberkarte ist selbst die gesuchte Creature ⇒ sie wird platziert und liegt zugleich noch im Deck.
    const u = await H.fresh({ hand: [['Surprise Party'], []], hp: 800, deck: [[H.INERT.creature, 'Meteor Crash', 'Slow'], ['ZZ Dummy', 'ZZ Dummy', 'ZZ Dummy']] });
    u.setAbilities(0, 0, [['Support Magic', 'Support Magic'], [], []]);
    u.putArea(0, 'Board of Kings'); u.put(1, 0, 0, 'Knight of Kings [B]'); u.put(1, 0, 1, 'Rook of Kings [B]');
    const v2 = u.census();
    await u.play(0, 'Surprise Party', { hero: 0, noGrant: true });
    const d2 = u.censusDiff(v2, u.census());
    R.check('Variante Creature oben: keine Duplikate (Kartenbilanz ±0)', d2.length === 0, { diff: d2, deck: u.pile(0, 'mainDeck'), zonen: u.gs.players[0].supportZones[0] });
  }
  R.finish();
})();
