'use strict';
// M02-18 · Magic Lamp: wird der Einfüge-Schritt durch „Ambush the Scout" negiert, verschwinden die drei gewählten Karten aus dem Spiel
// Kartentext Magic Lamp: „Choose 3 different cards from your deck and reveal them. Your opponent chooses 1 of them. Add that card to your opponent's hand and the other 2 to your hand."
// Kartentext Ambush the Scout (Reaction, Decay Magic Lv1): „Play this card immediately when your opponent activates an effect that would interact with your hand. Negate that effect. …"
// Erwartung: nach der Negierung ist keine Karte verloren (Kartenbilanz ±0): entweder bleiben die 3 Karten im Deck (ganze Karte negiert) oder die 2 eigenen kommen auf die Hand / die Karte des Gegners wandert in die Ablage.
// Beobachtet: Fighting, Toughness, Wealth sind weder im Deck noch auf einer Hand noch in einer Ablage (Bilanz −1 je Karte). Ohne Ambush läuft alles sauber (Gegner nimmt eine, ich bekomme zwei).
// Ursache: `magic-lamp.js` nimmt die 3 Karten VOR dem Fenster per `takeFromPile` aus dem Deck (Z. 95) und kehrt bei `checkHandInteractionReaction(oppIdx,'insert',…)` (Z. 150) mit `return` zurück,
//   ohne sie zurückzulegen oder die zwei eigenen auf die Hand zu geben.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Magic Lamp'], ['Ambush the Scout', 'ZZ Filler', 'ZZ Filler', 'ZZ Filler']], hp: 800, deck: [['Fighting', 'Toughness', 'Wealth', 'ZZ Dummy'], ['ZZ Dummy']], turn: 5 });
  t.setAbilities(1, 0, [['Decay Magic'], [], []]);
  t.policy.confirm = true;
  t.script.push({ match: d => d.type === 'cardGalleryMulti', answer: () => ({ selectedCards: ['Fighting', 'Toughness', 'Wealth'] }) });
  t.script.push({ match: d => d.type === 'cardGallery', answer: (d) => ({ cardName: d.cards[0].name, source: d.cards[0].source }) });
  const vorher = t.census();
  await t.play(0, 'Magic Lamp', { hero: 0 });
  const diff = t.censusDiff(vorher, t.census());
  R.check('Ambush hat das Einfügen tatsächlich negiert (Voraussetzung)', t.pile(1, 'discardPile').includes('Ambush the Scout'), t.pile(1, 'discardPile'));
  R.check('Kartenbilanz: keine Karte verschwunden (außer der Lamp selbst bewegt)', diff.filter(x => !x.startsWith('Magic Lamp')).length === 0, diff);
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
