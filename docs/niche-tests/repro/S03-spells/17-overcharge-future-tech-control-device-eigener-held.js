'use strict';
// S03-17 · Overcharge rüstet „Future Tech Control Device" (nur an Helden des GEGNERS ausrüstbar) an den eigenen Helden aus
// Kartentexte: Overcharge: „… choose an equippable Artifact with a Cost between 1 and 10 Gold higher than the discarded one from your deck and equip it to the same Hero."
//   Future Tech Control Device: „Equip this card to a Hero **your opponent controls**." (Skript: `placesOnOpponentBoard: true`, normaler Spielweg legt sie in die Zone des Gegners)
// Aufbau: Held 0 (Magic Arts 1) trägt „Glass Sword" (Kosten 2); Deck [ZZ Dummy, Future Tech Control Device (Kosten 4), ZZ Dummy]; Galerie-Antwort „Future Tech Control Device".
// Erwartet: Die Karte wird nicht als „equippable" angeboten (analog zu Wiederbelebungs-Effekten, die `placesOnOpponentBoard` beachten: `_hooks.js` `isOwnSideSummonableCreature`,
//   `_engine.js` ~12163 `getKontrollAusruestZiele`), oder sie landet am Helden des Gegners.
// Beobachtet: Sie steht in der Galerie und liegt danach in der Support Zone des EIGENEN Helden (Gegnerseite leer); ihr Effekt (Übernahme des Wirtshelden) kann dort nie greifen
//   (`canActivateEquipEffect`: der „Gegner"-Held ist der eigene) – die Aufwertung ist verschwendet, die Karte widerspricht ihrem Text.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Overcharge'], []], hp: 800, deck: [['ZZ Dummy', 'Future Tech Control Device', 'ZZ Dummy'], []] });
  t.setAbilities(0, 0, [['Magic Arts'], [], []]);
  t.put(0, 0, 1, 'Glass Sword');
  let galerie = null;
  t.script.push({ match: d => d.type === 'cardGallery', answer: (d) => { galerie = d.cards.map(c => c.name); return { cardName: 'Future Tech Control Device' }; } });
  const r = await t.play(0, 'Overcharge', { hero: 0, noGrant: true });
  const eigene = t.gs.players[0].supportZones[0].flat();
  R.check('Future Tech Control Device wird nicht als Kandidat angeboten', !(galerie || []).includes('Future Tech Control Device'), { galerie });
  R.check('Future Tech Control Device liegt nicht an einem eigenen Helden', !eigene.includes('Future Tech Control Device'), { r, eigene });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
