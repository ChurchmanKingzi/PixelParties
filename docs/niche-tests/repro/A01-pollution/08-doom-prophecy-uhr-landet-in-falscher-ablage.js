'use strict';
// A01-pollution-08 (Stufe C – Regelfrage) · Doom Prophecy: die in die GEGNERISCHE Area-Zone gelegte Doom Clock landet beim Entfernen in der Ablage des GEGNERS
// Kartentext: „Search your deck for a „Doom Clock“ and place it into your Area Zone. If the user has at least Decay Magic 2, you may place it
//   into your opponent's Area Zone instead.“
// Konvention (cards/effects/CARD_API.md, „Eine Karte in der Zone des GEGNERS“ + „GESTOHLENE KARTEN GEHEN IN DIE ABLAGE IHRES BESITZERS“):
//   `owner` = Gegner (Zonenspiegel), `originalOwner` = Leger; Ablage und Delete-Stapel lesen `originalOwner`. Die Karte kommt aus MEINEM Deck,
//   gehört mir und geht beim Entfernen in MEINE Ablage.
// Frage an Al: Soll die Doom Clock beim Entfernen in die Ablage des Legers (Besitzer der Karte) oder des Zonen-Besitzers gehen? Es gibt keine zweite Karte, die eine
//   Area in die Gegner-Zone legt; `removeArea`/`deleteArea` lesen `cardInstance.owner`, nicht `originalOwner`.
// Beobachtet: Doom Prophecy legt die Instanz mit `_trackCard(…, ziel, 'deck')` an, ohne `originalOwner` zu setzen; nach Reality Crack liegt die
//   Doom Clock in der Ablage des Gegners (mein Deck verliert eine Karte, der Gegner bekommt eine).
// Ursache: cards/effects/doom-prophecy.js – `engine._trackCard(D.CLOCK_NAME, ziel, 'deck')` ohne `inst.originalOwner = pi`.
// Aufruf: node docs/niche-tests/repro/A01-pollution/08-doom-prophecy-uhr-landet-in-falscher-ablage.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Doom Prophecy', 'Reality Crack'], []], deck: [['Doom Clock', ...Array(10).fill(H.INERT.creature)], []], abilities: { 0: { 0: [['Decay Magic', 'Decay Magic'], ['Magic Arts'], []] } } });
  t.script.push({ match: d => d && d.type === 'optionPicker' && d.title === 'Doom Prophecy', answer: () => ({ optionId: 'opp' }) });
  await t.play(0, 'Doom Prophecy', { hero: 0 });
  const uhr = t.find('Doom Clock', 'area');
  R.check('Uhr liegt in der gegnerischen Area-Zone (owner = Gegner)', !!uhr && uhr.owner === 1 && t.gs.areaZones[1].includes('Doom Clock'), t.gs.areaZones);
  R.check('originalOwner der Uhr = Leger (Sitz 0)', uhr && uhr.originalOwner === 0, uhr && uhr.originalOwner);
  t.script.length = 0;
  t.script.push({ match: d => d && d.type === 'cardGallery', answer: () => ({ cancelled: true }) });
  await t.play(0, 'Reality Crack', { hero: 0 });                     // schickt alle Areas in die Ablage
  R.check('Doom Clock landet in MEINER Ablage', t.pile(0, 'discardPile').includes('Doom Clock'), { ablage0: t.pile(0, 'discardPile'), ablage1: t.pile(1, 'discardPile') });
  R.check('Doom Clock nicht in der Ablage des Gegners', !t.pile(1, 'discardPile').includes('Doom Clock'), t.pile(1, 'discardPile'));
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
