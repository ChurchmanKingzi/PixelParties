'use strict';
// F01-artifacts-23 · Explosivo's Sword lässt sich an einen GEGNERISCHEN Helden anlegen, obwohl der Text „Equip this card to a Hero you control" lautet
// Kartentext: „Equip this card to a Hero you control. The equipped Hero's Attack stat is increased by 10. …"; Regel CARD_API.md Z. 7118 ff. (5.9.): „Steht auf einer Equipment-Karte „Equip this card to a Hero
//   you control", gehört die Fahne `equipOwnSideOnly` gesetzt" – der Durchlauf betraf die 49 NICHT gebannten Equipment-Karten; Explosivo's Sword ist gebannt und hat die Fahne nicht.
// Aufbau: Sitz 0 spielt Explosivo's Sword auf Held 0 von Sitz 1 (`targetOwner: 1`); Gegenprobe: Blade of the Swamp Witch (gleiche Klausel, Fahne gesetzt).
// Erwartung: Das Anlegen am gegnerischen Helden wird abgelehnt, die Karte bleibt auf der Hand.
// Beobachtet: Das Schwert liegt beim Gegner (+10 ATK für seinen Helden).
// Ursache: `cards/effects/explosivo-s-sword.js` exportiert kein `equipOwnSideOnly: true` (Blade of the Swamp Witch/Frostbringer u. a. tun es).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const karte of ['Blade of the Swamp Witch', "Explosivo's Sword"]) {
    const t = await H.fresh({ hand: [[karte], []], gold: [200, 100] });
    await t.play(0, karte, { hero: 0, targetOwner: 1 });
    const beimGegner = t.gs.players[1].supportZones[0].flat().includes(karte);
    R.check(karte + ': Anlegen an den gegnerischen Helden wird abgelehnt', !beimGegner, { beimGegner, hand: t.pile(0, 'hand') });
    R.check(karte + ': keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.finish();
})();
