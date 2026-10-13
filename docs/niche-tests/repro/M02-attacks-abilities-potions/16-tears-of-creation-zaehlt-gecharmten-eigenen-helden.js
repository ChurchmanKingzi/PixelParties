'use strict';
// M02-16 · Tears of Creation zählt einen eigenen, vom Gegner GECHARMTEN Helden als „target you control"
// Kartentext: „Gain 5 Gold for every target you control."
// Engine-Definition der Kontrolle: `engine.heroesControlledBy(pi)` (Kontrolle hängt an `hero.charmedBy`, nicht am Status; CARD_API.md Charme-Abschnitt) – hier: 2 statt 3.
// Erwartung: 3 Helden, einer vom Gegner gecharmt ⇒ 2 Ziele ⇒ 10 Gold. Gegenprobe: ein vom Spieler gecharmter Gegnerheld zählt mit (20 Gold) ✓.
// Beobachtet: 15 Gold (der gecharmte eigene Held zählt weiter). Ursache: `tears-of-creation.js` zählt `ps.heroes` mit hp > 0 ohne `charmedBy`-Prüfung (Z. ~38–44),
//   nur die Gegnerseite wird auf `charmedBy === pi` geprüft.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const faelle = [
    ['kein Charm', t => {}, 15],
    ['eigener Held 1 vom Gegner gecharmt', t => { const h = t.gs.players[0].heroes[1]; h.charmedBy = 1; h.statuses = { ...(h.statuses || {}), charmed: { duration: 5 } }; }, 10],
    ['Gegnerheld 0 von mir gecharmt', t => { const h = t.gs.players[1].heroes[0]; h.charmedBy = 0; h.statuses = { ...(h.statuses || {}), charmed: { duration: 5 } }; }, 20],
  ];
  for (const [label, setup, soll] of faelle) {
    const t = await H.fresh({ hand: [[], []], hp: 800, gold: 20 });
    setup(t);
    const g = t.gs.players[0].gold;
    await t.play(0, 'Tears of Creation', {});
    const gewinn = t.gs.players[0].gold - g;
    R.check(`${label}: ${soll} Gold`, gewinn === soll, { gewinn, kontrolliert: t.engine.heroesControlledBy(0).length });
  }
  R.finish();
})();
