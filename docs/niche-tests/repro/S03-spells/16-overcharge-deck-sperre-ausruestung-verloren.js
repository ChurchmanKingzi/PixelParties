'use strict';
// S03-16 · Overcharge: unter Knight of Kings [B] (Deck-Sperre) wird die alte Ausrüstung abgelegt, die neue bleibt im Deck – Ausrüstung verloren
// Kartentext: „Choose an Artifact equipped to a Hero you control and send it to the discard pile. Then, choose an equippable Artifact with a Cost between 1 and 10 Gold higher
//   than the discarded one from your deck and equip it to the same Hero."
// Skriptvorgabe (overcharge.js Kopf, 5.9.): „Ein Equip ohne Nachfolger steht gar nicht erst zur Wahl – sonst wirft man seine Ausrüstung weg und bekommt nichts zurück."
// Aufbau: Held 0 (Magic Arts 1) trägt „Glass Sword" (Kosten 2); Deck [ZZ Dummy, Club of Gobbo (Kosten 4), ZZ Dummy]; Sitz 1 kontrolliert Knight of Kings [B] + Rook of Kings [B], Board of Kings liegt
//   (`engine.pileOutAllowed(0, 'deck')` = false). Die Galerie wird mit „Club of Gobbo" beantwortet.
// Erwartet: Karte nicht spielbar bzw. nichts abgelegt (Ausrüstung bleibt), solange die neue Ausrüstung nicht aus dem Deck geholt werden darf.
// Beobachtet: `spellPlayCondition`/`zulaessigeZiele` kennen die Sperre nicht; Z. 273 legt „Glass Sword" ab, `takeFromPile` (Z. 277) verweigert, `onPlay` kehrt still zurück:
//   Overcharge verbraucht, Glass Sword in der Ablage, Club of Gobbo im Deck, Held ohne Ausrüstung.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Overcharge'], []], hp: 800, deck: [['ZZ Dummy', 'Club of Gobbo', 'ZZ Dummy'], []] });
  t.setAbilities(0, 0, [['Magic Arts'], [], []]);
  t.put(0, 0, 1, 'Glass Sword');
  t.putArea(0, 'Board of Kings'); t.put(1, 0, 0, 'Knight of Kings [B]'); t.put(1, 0, 1, 'Rook of Kings [B]');
  R.check('Ausgangslage: Deck-Entnahme ist gesperrt', t.engine.pileOutAllowed(0, 'deck', { sourceOwner: 0 }) === false);
  t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: 'Club of Gobbo' }) });
  const r = await t.play(0, 'Overcharge', { hero: 0, noGrant: true });
  const zone = t.gs.players[0].supportZones[0].flat();
  const verloren = !zone.includes('Glass Sword') && !zone.includes('Club of Gobbo');
  R.check('Ausrüstung geht nicht verloren (Glass Sword bleibt oder Club of Gobbo kommt)', !verloren, { r, zone, ablage: t.pile(0, 'discardPile'), deck: t.pile(0, 'mainDeck') });
  R.check('Overcharge nicht wirkungslos verbraucht (Karte auf der Hand oder Tausch vollzogen)', t.pile(0, 'hand').includes('Overcharge') || zone.includes('Club of Gobbo'), { hand: t.pile(0, 'hand') });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
