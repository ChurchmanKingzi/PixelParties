'use strict';
// F02-01 · Mana-Consuming Blade hat keinen Effekt (+10 ATK fehlt)
// Kartentext: „Equip this card to a Hero you control. The equipped Hero's Attack stat is increased by 10. Additionally, the equipped Hero is unaffected by the effects of all Mana Spells."
// Aufbau: Sitz 0 hat die Karte auf der Hand, Held 0 (Tushu, 40 ATK), Phase Main 1.
// Schritte: 1. Karte über den echten Weg (doPlayArtifact) an Held 0 ausrüsten. 2. ATK des Helden vergleichen.
// Erwartet: ATK 40 → 50.
// Beobachtet: ATK bleibt 40. `cards/effects/mana-consuming-blade.js` enthält nur `{ isEquip: true, equipOwnSideOnly: true }` (Kopfkommentar: „die Karte wirkt über ihre Kartendaten"),
//   aber `data/cards.json` hat kein ATK-Feld für die Karte und die Engine liest den Text nicht – nichts gewährt +10. (Der zweite Satz „Mana Spells" ist unabhängig davon
//   nicht prüfbar: im Kartenpool gibt es weder eine Schule „Mana" noch Zauber, die sich so nennen.)
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Mana-Consuming Blade'], []] });
  const vorher = t.hero(0, 0).atk;
  const r = await t.play(0, 'Mana-Consuming Blade', { hero: 0 });
  R.check('Klinge wurde ausgerüstet', r === true && t.zone(0, 0, 0) === 'Mana-Consuming Blade', { r, zone: t.zone(0, 0, 0) });
  R.check('ATK des Trägers um 10 erhöht', t.hero(0, 0).atk === vorher + 10, { vorher, nachher: t.hero(0, 0).atk });
  R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  R.finish();
})();
