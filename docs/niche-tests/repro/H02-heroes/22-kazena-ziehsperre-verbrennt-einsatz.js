// H02-heroes-22 · Kazena: unter Ziehsperre / bei leerem Deck wird der Heldeneffekt angeboten, bejaht und der Einsatz „once per turn" ohne Wirkung verbraucht
//
// Kartentext Kazena: „You may once per turn draw until you have 7 cards in your hand. If you do, you cannot draw or add cards to your hand for the rest of the turn afterwards."
// Das Skript sperrt die Aktivierung bei `handLocked` und bei ≥ 7 Handkarten (`canActivateHeroEffect`), kennt aber `drawLocked` (Sacred Jewel) und das leere Deck nicht.
// Erwartung (Analogie zur Handsperre): der Effekt ist nicht aktivierbar bzw. verbraucht nichts, wenn 0 Karten gezogen werden können.
// Beobachtung: Rückfrage „Draw 5 cards (to 7)?" erscheint, nach „Ja" werden 0 Karten gezogen, der Effekt gilt als benutzt (`hero-effect:Kazena…`) – ein zweiter Versuch im Zug (nach Aufheben der Sperre) ist weg.
// Aufruf: node docs/niche-tests/repro/H02-heroes/22-kazena-ziehsperre-verbrennt-einsatz.js   (✗ = Fehler tritt auf)
const H = require('../../lib/h.js');
const KZ = 'Kazena, the Storming Rebel';
(async () => {
  const R = H.runner();
  const mk = (o = {}) => H.fresh({ heroes: [[KZ, H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], hand: [['ZZ Filler', 'ZZ Filler'], []], ...o });
  { const t = await mk(); t.gs.players[0].drawLocked = true;
    const r = await t.activateHero(0, 0, { effect: KZ, phase: 2 });
    R.check('Ziehsperre: Effekt nicht aktivierbar oder ohne verbrauchten Einsatz', r !== true || Object.keys(t.gs.hoptUsed || {}).length === 0, { r, prompts: t.prompts.length, hopt: t.gs.hoptUsed, hand: t.pile(0, 'hand').length }); }
  { const t = await mk({ deckSize: 0 });
    const r = await t.activateHero(0, 0, { effect: KZ, phase: 2 });
    R.check('leeres Deck: Effekt nicht aktivierbar oder ohne verbrauchten Einsatz', r !== true || Object.keys(t.gs.hoptUsed || {}).length === 0, { r, hopt: t.gs.hoptUsed, hand: t.pile(0, 'hand').length }); }
  R.finish();
})();
