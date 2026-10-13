'use strict';
// F01-artifacts-17 · Bow of the Hunt Goddess: der Karteneffekt ist nirgends umgesetzt
// Kartentext: „Equip this card to a Hero you control. Once per turn, when the equipped Hero performs an Attack, you may search your deck for an "Arrow" Artifact and play it
//   directly from your deck in reaction to the Attack. You still need to pay its Cost."
// Aufbau: Sitz 0: Held 0 trägt den Bow (per t.put), Deck [Flame Arrow, Poisoned Arrow, Füller], 100 Gold; Hand [Attack]. Sitz 1 hat keine Reaktionen.
// Erwartung: Beim Angriff erscheint das Angebot „Arrow aus dem Deck suchen und spielen" (Galerie der Arrow-Artefakte im Deck); bei Annahme wird der Pfeil gespielt und bezahlt.
// Beobachtet: Kein Angebot, kein Prompt, das Deck bleibt unverändert. Das Skript `bow-of-the-hunt-goddess.js` enthält nur `isEquip`/`equipOwnSideOnly` und behauptet „die Karte wirkt über ihre
//   Kartendaten"; weder `_arrows-shared.js` noch `_engine.js`/`server.js` kennen den Namen (Treffer für „Hunt Goddess" gibt es nur in `scripts/curate-skilltest-legal.js`).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Attack'], []], deck: [['Flame Arrow', 'Poisoned Arrow', 'ZZ Dummy', 'ZZ Dummy', 'ZZ Dummy'], undefined], gold: [100, 100] });
  t.put(0, 0, 0, 'Bow of the Hunt Goddess');
  t.policy.confirm = true;
  t.targetFn = (valid) => [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
  const deckVorher = t.pile(0, 'mainDeck').length;
  await t.play(0, 'Attack', { hero: 0 });
  const arrowsInDeck = t.pile(0, 'mainDeck').filter(n => /Arrow/.test(n)).length;
  const arrowGespielt = t.pile(0, 'discardPile').some(n => /Arrow/.test(n));
  const galerie = t.prompts.some(p => p.d.type === 'cardGallery' || /Bow/.test(p.d.title || ''));
  R.check('Bow: Angebot, einen Arrow aus dem Deck zu suchen und zu spielen', galerie || arrowGespielt || arrowsInDeck < 2, { prompts: t.prompts.map(p => p.d.type + ':' + (p.d.title || '')), deckVorher, deckNachher: t.pile(0, 'mainDeck').length, discard: t.pile(0, 'discardPile') });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
