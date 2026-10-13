'use strict';
// S03-11 · Pillar of Light: Gegner KANN nicht suchen (Siege), das Skript wertet es trotzdem als „gefunden"
// Kartentext: „Declare a card name. Your opponent must search their deck for a card with that name and add it to their hand, **if possible**.
//   If they find a card with the declared name, this counts as an additional Action and you may draw a card."
// Siege (Attachment, `blocksSearchFor`): „your opponent cannot add cards from their deck or discard pile to their hand outside their Resource Phase".
// Aufbau: Mein Held 0 trägt Siege; Gegner-Deck enthält 2 × Fireball; ich spiele in Main 1 Pillar of Light (Fireball angesagt).
// Erwartet: Der Gegner kann nicht suchen ⇒ nichts gefunden ⇒ keine Zusatzaktion und keine Zieh-Frage; die kommende Aktion wird verbraucht (wie bei „nicht gefunden").
// Beobachtet: `takeFromPile` wird vom Siege-Riegel verweigert (Fireball bleibt im Deck, Gegnerhand leer), aber das Skript hat den Treffer schon als `gefunden`
//   verbucht ⇒ es kommt die Zieh-Frage („Draw a card?"), ich ziehe 1 Karte und die Zusatzaktion bleibt erhalten.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Pillar of Light'], []], deck: [['ZZ Dummy', 'ZZ Dummy'], ['ZZ Dummy', 'Fireball', 'Fireball']] });
  t.put(0, 0, 0, 'Siege');
  R.check('Ausgangslage: Siege sperrt die Deck-Suche des Gegners', t.engine.searchLockLevel(1).deck === true);
  t.script.push({ match: d => d.type === 'cardNamePicker', answer: () => ({ cardName: 'Fireball' }) });
  const h0 = t.pile(0, 'hand').length;
  const r = await t.play(0, 'Pillar of Light', { hero: 0, phase: 2 });
  R.check('Pillar of Light gespielt', r === true, r);
  R.check('Fireball blieb im Gegner-Deck (Sperre wirkt)', t.pile(1, 'mainDeck').filter(x => x === 'Fireball').length === 2 && t.pile(1, 'hand').length === 0);
  R.check('keine Zieh-Frage an mich („gefunden" ist falsch)', !t.prompts.some(p => p.d.type === 'confirm'), t.prompts.map(p => p.d.type));
  R.check('ich habe keine Karte gezogen', t.pile(0, 'hand').length === h0 - 1, { hand: t.pile(0, 'hand').length, vorher: h0 });
  R.check('die kommende Aktion wurde wie bei „nicht gefunden" verbraucht (Phase ≥ Main 2)', t.gs.currentPhase >= 4, t.gs.currentPhase);
  R.finish();
})();
