'use strict';
// F01-artifacts-06 · Charm of Balance: die gerade gespielte Karte zählt noch zur Hand – und Handzugänge ohne Hook werden nicht bemerkt
// Kartentext: „If you ever have more than 7 cards in your hand, send this equipped card to the discard pile."
// (a) Aufbau: Charm liegt am Helden; Hand = exakt 7 Karten, darunter Boomerang / Capture Net (Gegnerkreatur) / Cool Cheese / Cute Cheese; die Karte holt 1 Karte auf die Hand.
//     Nach dem Ausspielen sind es 6 + 1 = 7 Karten – nicht „more than 7".
//     Erwartung: Charm bleibt liegen. Beobachtet: Charm landet in der Ablage (die gespielte Karte steckt bis zum Ende der Auflösung noch in der Hand: Hand = 8 beim Hook;
//     `server.js doConfirmPotion` / `doUseArtifactEffect` entnehmen die Karte erst nach `resolve`). Die Engine-Konvention dafür ist `handSizeWithoutResolving(ps)`
//     (`_hand-resolve.js` Z. 195, CARD_API.md „Handlimit und Pollution rechnen jetzt ebenso"); `charm-of-balance.js` Z. 58 liest stattdessen `ps.hand.length`.
// (b) Aufbau: Charm-Besitzer (Sitz 0) hat 7 Karten; Sitz 1 spielt Birthday Present und schenkt ihm eine Karte → Hand 8.
//     Erwartung: Charm sofort in der Ablage (das ist ein Handzugang, „ever more than 7"). Beobachtet: Charm bleibt liegen – `birthday-present.js` Z. 215 nutzt `handZugangSync`
//     (feuert weder onCardAddedToHand noch onDraw); `charm-of-balance.js` fängt das erst im `onTurnStart`-Sweep (Z. ~178).
const H = require('../../lib/h.js');
const charmOn = (t) => t.gs.players[0].supportZones[0].flat().includes('Charm of Balance');
(async () => {
  const R = H.runner();
  // (a)
  for (const [card, mk] of [['Boomerang', null], ['Capture Net', (t) => { t.put(1, 0, 0, H.INERT.creature); }], ['Cool Cheese', null], ['Cute Cheese', null]]) {
    const t = await H.fresh({ hand: [['Charm of Balance'], []], deck: [['Fireball', 'Attack', 'ZZ Dummy', 'Beer', 'Coffee', 'Cool Cheese', 'ZZ Dummy', 'ZZ Dummy', 'ZZ Dummy', 'ZZ Dummy', 'ZZ Dummy', 'ZZ Dummy'], undefined], discard: [['Club of Gobbo', 'Beer'], []], gold: [100, 100] });
    await t.play(0, 'Charm of Balance', { hero: 0 });
    t.setHand(0, [card, ...Array(6).fill(H.INERT.filler)]);
    mk && mk(t);
    t.targetFn = (valid) => valid.length ? [valid.find(v => v.type === 'equip')?.id ?? valid[0].id] : [];
    t.script.push({ match: d => d.type === 'cardGallery', answer: (d) => ({ cardName: d.cards[0].name }) });
    await t.play(0, card, { hero: 0 });
    const hand = t.pile(0, 'hand').length;
    R.check('(a) ' + card + ': Hand danach ' + hand + ' (nicht mehr als 7) → Charm bleibt liegen', hand === 7 && charmOn(t), { hand, charm: charmOn(t) });
    R.check('(a) ' + card + ': keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  // (b)
  {
    const t = await H.fresh({ hand: [['Charm of Balance'], []], deck: [['Beer', 'Coffee', 'Fireball', 'ZZ Dummy', 'ZZ Dummy', 'ZZ Dummy'], undefined] });
    await t.play(0, 'Charm of Balance', { hero: 0 });
    t.setHand(0, Array(7).fill(H.INERT.filler));
    t.setHand(1, ['Birthday Present']); t.setDeck(1, ['Beer', 'Coffee', 'Fireball', 'ZZ Dummy', 'ZZ Dummy']);
    t.script.push({ match: d => d.type === 'birthdayPresentPick', answer: () => ({ cardName: 'Beer' }) });
    await t.play(1, 'Birthday Present', { hero: 0 });
    const hand = t.pile(0, 'hand').length;
    R.check('(b) Geschenk auf Hand 8 → Charm sofort abgeworfen', hand <= 7 || !charmOn(t), { hand, charm: charmOn(t) });
  }
  R.finish();
})();
