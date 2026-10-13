'use strict';
// M01-24 · doUsePotion prüft weder die Such-Sperre (Auto-Erkennung) noch `blockedByDrawLock`: Elixir of Mana wird unter der starken Such-Sperre verbraucht, ohne zu wirken
// Kartentext Elixir of Mana: „Choose up to 3 Spells with different names from your discard pile and add them to your hand."
// Engine-Vertrag (server.js:12125 für Artefakte, validateActionPlay server.js:7527): `_cardBlockedBySearchLock(script, cardData, ps, pi)` ⇒ die Karte ist unspielbar; der Lader markiert Elixir of Mana als `blockedBySearchLockDiscard`.
// Aufbau: Sitz 0, Hand [Elixir of Mana, ZZ Filler], Ablage [Fireball, Heal]; `ps.searchLocked = true` und `ps.searchLockedIncludesDiscard = true` (Cats of the Pharaoh, starke Stufe).
// Erwartet: `t.play` lehnt ab (`false`), Trank bleibt auf der Hand. Kontrolle: unter der schwachen Stufe (nur Deck) ist der Trank spielbar und holt die Zauber.
// Beobachtet: `true`; der Trank liegt im Gelöscht-Stapel, die Ablage ist unverändert, die Hand hat keine Zauber bekommen.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  {
    const t = await H.fresh({ hand: [['Elixir of Mana', 'ZZ Filler'], []], discard: [['Fireball', 'Heal'], []], deckSize: 20 });
    t.gs.players[0].searchLocked = true;
    t.script.push({ match: d => d.type === 'cardGalleryMulti', answer: (d) => ({ selectedCards: d.cards.slice(0, 2).map(c => c.name) }) });
    const r = await t.play(0, 'Elixir of Mana');
    R.check('Kontrolle schwache Stufe (nur Deck): Trank spielbar und holt die Zauber', r === true && t.pile(0, 'hand').includes('Fireball'), { r, hand: t.pile(0, 'hand') });
  }
  {
    const t = await H.fresh({ hand: [['Elixir of Mana', 'ZZ Filler'], []], discard: [['Fireball', 'Heal'], []], deckSize: 20 });
    t.gs.players[0].searchLocked = true; t.gs.players[0].searchLockedIncludesDiscard = true;
    t.script.push({ match: d => d.type === 'cardGalleryMulti', answer: (d) => ({ selectedCards: d.cards.slice(0, 2).map(c => c.name) }) });
    const r = await t.play(0, 'Elixir of Mana');
    const verbraucht = t.pile(0, 'deletedPile').includes('Elixir of Mana');
    R.check('starke Stufe: Trank wird abgelehnt oder wirkt (nicht still verbraucht)', !(r === true && verbraucht && !t.pile(0, 'hand').includes('Fireball')),
      { r, hand: t.pile(0, 'hand'), deleted: t.pile(0, 'deletedPile'), discard: t.pile(0, 'discardPile') });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
