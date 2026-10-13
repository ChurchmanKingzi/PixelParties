'use strict';
// F03-artifacts-17 · Spice Mortar unter der Such-Sperre (Cats of the Pharaoh): fügt trotzdem eine Karte der Hand hinzu (Stufe C, Regelfrage)
// Kartentext Cats of the Pharaoh: „… you cannot search or add cards to your hand for the rest of the turn afterwards (but you can still draw)."
// Kartentext Spice Mortar: „Reveal the top 10 cards of your opponent's deck. Add a Potion from among those cards to your hand, if possible."
// Aufbau: Sitz 0 trägt die Such-Sperre (`ps.searchLocked = true`, so setzt sie Cats); Gegner-Deck enthält Acid Vial unter den obersten 10 Karten.
// Lesart A: „add cards to your hand" ist wörtlich gesperrt ⇒ Mortar unspielbar/ohne Zugriff (CARD_API.md Gruppe A/B: reine Deck-/Ablage-Sucher sind unter der Sperre unspielbar).
// Lesart B (heute): Sperre gilt nur für das EIGENE Deck/Ablage (Tabelle D: „Add aus BRETT oder GEGNERHAND: nicht betroffen"); der Griff ins GEGNERDECK ist dort nicht eingeordnet.
// Beobachtet: Lesart B – Mortar spielbar, Acid Vial landet auf der Hand.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const potionDeck = ['Acid Vial', 'Bird', 'Bird', 'Bird', 'Bird', 'Bird', 'Bird', 'Bird', 'Bird', 'Bird', 'Bird', 'Bird'];
  const t = await H.fresh({ hand: [['Spice Mortar'], []], deck: [[], potionDeck] });
  t.gs.players[0].searchLocked = true;
  t.script.push({ match: d => d.type === 'deckPeekPick' && d.title === 'Spice Mortar', answer: () => ({ cardName: 'Acid Vial', source: 'deck' }), once: false });
  t.script.push({ match: d => d.type === 'confirm' && d.title === 'Spice Mortar', answer: () => ({ confirmed: false }), once: false });
  const r = await t.play(0, 'Spice Mortar');
  R.check('Lesart A: unter der Such-Sperre kommt keine Karte auf die Hand', !t.pile(0, 'hand').includes('Acid Vial'), { r, hand: t.pile(0, 'hand') });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
