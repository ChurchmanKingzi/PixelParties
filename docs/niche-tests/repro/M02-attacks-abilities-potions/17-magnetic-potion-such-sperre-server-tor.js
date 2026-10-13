'use strict';
// M02-17 · Magnetic Potion (und Elixir of Mana) sind unter der Such-Sperre auf dem SERVER spielbar und verbrauchen sich ohne Wirkung
// Kartentext Magnetic Potion: „Choose a card from your deck, reveal it and add it to your hand. You can only play 1 "Magnetic Potion" per turn."
// Ruling (CARD_API.md/_engine.js ~10690, v1069, Al 14.9.): „Karten, die NUR suchen, sollen gar nicht erst spielbar sein." — Skript trägt `blockedBySearchLock`.
// Erwartung: unter `ps.searchLocked` ist der Trank nicht spielbar (`doUsePotion` lehnt ab; Karte bleibt auf der Hand, kein Stempel).
// Beobachtet: der Client graut ihn aus (`searchLockBlockedCards`), `doUsePotion` (server.js ~11886) prüft aber nur HandLock/PileLock/SummonLock, nicht
//   `engine._cardBlockedBySearchLock` (anders als der Zauber-/Attackenweg `validateActionPlay`, _engine.js ~20963). Folge: der Trank wird gespielt, kommt in den
//   Löschstapel, der Zug-Stempel (`magnetic-potion:0`) sitzt, die Galerie öffnet sich, und es kommt keine Karte auf die Hand.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const [name, lock] of [['Magnetic Potion', { searchLocked: true }], ['Elixir of Mana', { searchLocked: true, searchLockedIncludesDiscard: true }]]) {
    const t = await H.fresh({ hand: [[], []], hp: 800, deck: [['Fighting', 'Toughness', 'Wealth', 'ZZ Dummy'], ['ZZ Dummy']], discard: [['Fighting', 'Fireball'], []] });
    Object.assign(t.gs.players[0], lock);
    t.setHand(0, [name, 'ZZ Filler']);
    t.script.push({ match: d => d.type === 'cardGallery', answer: (d) => ({ cardName: d.cards[0].name, source: d.cards[0].source }) });
    const r = await t.play(0, name, { hero: 0, noGrant: true, handIndex: 0 });
    R.check(`${name} unter Such-Sperre: nicht spielbar (Karte bleibt auf der Hand)`, r === false && t.pile(0, 'hand').includes(name) && !t.pile(0, 'deletedPile').includes(name),
      { r, hand: t.pile(0, 'hand'), deleted: t.pile(0, 'deletedPile'), hopt: t.gs.hoptUsed });
  }
  R.finish();
})();
