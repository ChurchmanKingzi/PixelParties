'use strict';
// A04-cute-01 · Wowhalla legt beim Ausspielen ZWEI Karten auf den Coolness Stack
//
// Kartentext (Wowhalla, the Hall of the Cool): "When this card comes into play, place the top card of your deck
//   face-up in front of you. It becomes your Coolness Stack. At the end of each of your turns, place the top card
//   of your deck face-up onto your Coolness Stack. …"
// Erwartung: nach dem Ausspielen liegt GENAU 1 Karte (die Deckoberseite) im Stack; nach einem Zugende 2.
// Beobachtet: nach dem Ausspielen liegen 2 Karten im Stack (Deck um 2 kleiner), nach dem Zugende 3.
// Ursache: cards/effects/wowhalla-the-hall-of-the-cool.js – onPlay ruft erst `engine.placeArea(...)`; placeArea feuert
//   `onCardEnterZone`, und Wowhallas eigener Hook (Zeile 89-94, "Stack auch bei Nicht-Hand-Herkunft anlegen") sieht noch
//   keinen Stack (`hasCoolnessStack` falsch) und seedet ihn. Danach seedet onPlay (Zeile 53) ein zweites Mal.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const W = 'Wowhalla, the Hall of the Cool';
  for (const seed of [1, 7, 99]) {
    R.section('Seed ' + seed);
    const t = await H.fresh({ seed, hand: [[W], []], deck: [['Cute Bunny', 'Cute Cat', 'Cute Dog', 'Cute Bird', H.INERT.creature, H.INERT.creature], []] });
    await t.play(0, W, { hero: 0 });
    const st = t.gs.players[0].coolnessStack;
    R.check('nach dem Ausspielen genau 1 Karte im Coolness Stack', st.length === 1, { stack: st.slice(), deck: t.pile(0, 'mainDeck').length });
    await t.endTurn();
    R.check('nach dem ersten Zugende genau 2 Karten', t.gs.players[0].coolnessStack.length === 2, t.gs.players[0].coolnessStack.slice());
    R.check('keine Engine-Fehler', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
