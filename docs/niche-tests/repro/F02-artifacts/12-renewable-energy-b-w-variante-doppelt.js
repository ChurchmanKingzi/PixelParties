'use strict';
// F02-12 · Renewable Energy: „Pawn of Kings [B]" und „[W]" zählen als „different names"
// Kartentext: „Choose up to 3 cards with different names from your discard pile and shuffle them back into your deck. Delete this card."
// Regel (CARD_API.md ~Z. 4590, Al 11.9.): „[B]/[W] sind KOSMETIK, kein Namensbestandteil" – beide heißen im Spiel „Pawn of Kings".
// Aufbau: Sitz 0: Hand [Renewable Energy], Ablage [Pawn of Kings [B], Pawn of Kings [W], Fireball, Fireball].
// Schritte: 1. Renewable Energy spielen; die Galerie ansehen; 2. beide Bauern + Fireball wählen.
// Erwartet: Galerie zeigt „Pawn of Kings" nur einmal; die Wahl von [B] UND [W] wird nicht als zwei verschiedene Namen akzeptiert (höchstens 2 Karten wandern ins Deck).
// Beobachtet: Galerie bietet [B] und [W] getrennt an; alle 3 Karten (beide Bauern + Fireball) wandern ins Deck.
// Vermutete Ursache: renewable-energy.js, Galerie-Aufbau: `if (seen.has(baseCardName(name))) continue; seen.add(name);` – es wird der Vollname gemerkt, geprüft wird der Basisname.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Renewable Energy'], []], gold: [100, 100], discard: [['Pawn of Kings [B]', 'Pawn of Kings [W]', 'Fireball', 'Fireball'], []] });
  let seen = null;
  t.script.push({ match: d => d.type === 'cardGalleryMulti' && d.title === 'Renewable Energy', answer: (d) => { seen = d.cards.map(c => c.name); return { selectedCards: ['Pawn of Kings [B]', 'Pawn of Kings [W]', 'Fireball'] }; }, once: true });
  const deck0 = t.pile(0, 'mainDeck').length;
  const r = await t.play(0, 'Renewable Energy');
  R.check('Renewable Energy gespielt', r === true, r);
  R.check('Galerie bietet „Pawn of Kings" nur einmal an', seen && seen.filter(n => n.startsWith('Pawn of Kings')).length === 1, seen);
  const plus = t.pile(0, 'mainDeck').length - deck0;
  R.check('höchstens 2 verschiedene Karten wandern ins Deck', plus <= 2, { plus, disc: t.pile(0, 'discardPile') });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
