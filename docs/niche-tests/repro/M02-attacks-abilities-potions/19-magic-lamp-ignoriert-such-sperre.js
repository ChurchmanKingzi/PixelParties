'use strict';
// M02-19 · Magic Lamp ignoriert die Such-Sperre (durchsucht das Deck und fügt der eigenen Hand Karten hinzu)
// Kartentext Magic Lamp: „Choose 3 different cards from your deck and reveal them. Your opponent chooses 1 of them. Add that card to your opponent's hand and the other 2 to your hand."
// Such-Sperre (Cats of the Pharaoh: „you cannot search or add cards to your hand for the rest of the turn afterwards (but you can still draw)"; `_engine.js` ~10630 „sperrt NUR Suchen und Adds"):
//   Magnetic Potion / Gate to the Armory u. a. sind unter der Sperre nicht spielbar bzw. fügen nichts hinzu.
// Erwartung: unter `ps.searchLocked` ist Magic Lamp nicht spielbar (oder fügt mindestens der eigenen Hand nichts hinzu); Kontrolle: Magnetic Potion fügt unter der Sperre nichts hinzu.
// Beobachtet: Magic Lamp läuft vollständig: Galerie wird geöffnet, der Gegner bekommt eine Karte, die eigene Hand bekommt zwei Karten aus dem Deck.
// Ursache: `magic-lamp.js` trägt weder `blockedBySearchLock` (der Lader erkennt `takeFromPile(ps,'deck',…)` + `handZugangSync` nicht) noch fragt es `engine._isSearchBlocked` / `_cardBlockedBySearchLock`.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const lauf = async (name) => {
    const t = await H.fresh({ hand: [[name], ['ZZ Filler']], hp: 800, deck: [['Fighting', 'Toughness', 'Wealth', 'ZZ Dummy'], ['ZZ Dummy']], turn: 5 });
    t.gs.players[0].searchLocked = true;
    t.policy.confirm = true;
    t.script.push({ match: d => d.type === 'cardGalleryMulti', answer: (d) => ({ selectedCards: d.cards.slice(0, 3).map(c => c.name) }) });
    t.script.push({ match: d => d.type === 'cardGallery', answer: (d) => ({ cardName: d.cards[0].name, source: d.cards[0].source }) });
    const r = await t.play(0, name, { hero: 0 });
    return { t, r, hand0: t.pile(0, 'hand'), hand1: t.pile(1, 'hand') };
  };
  const mp = await lauf('Magnetic Potion');
  R.check('Kontrolle: Magnetic Potion fügt unter der Such-Sperre keine Karte hinzu', !mp.hand0.some(c => ['Fighting', 'Toughness', 'Wealth', 'ZZ Dummy'].includes(c)), mp.hand0);
  const ml = await lauf('Magic Lamp');
  R.check('Magic Lamp: eigene Hand bekommt unter der Such-Sperre keine Karten', !ml.hand0.some(c => ['Fighting', 'Toughness', 'Wealth'].includes(c)), ml.hand0);
  R.finish();
})();
