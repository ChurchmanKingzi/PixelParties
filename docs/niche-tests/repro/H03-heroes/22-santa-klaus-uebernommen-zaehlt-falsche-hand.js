'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  H03-heroes-22 · Santa Klaus (dauerhaft übernommen): die Spielbarkeits-Sperre zählt die Hand des ALTEN Besitzers
//
//  Karten: Santa Klaus (`cards/effects/santa-klaus.js`, `canPlayCard(gs, pi, heroIdx, …)`); Vergleich Saint Nicolas (`saint-nicolas.js:heldUndHand`: „Die Engine ruft mit der
//          Brettseite … oder mit dem Kontrolleur … Die Hand gehört immer dem Kontrolleur")
//  Kartentext/Ruling (Al 14.9.): „He cannot act while the player has fewer than 2 cards in hand (not counting the card used for the Action)." – „the player" = wer ihn führt.
//  Aufbau: Sitz 1 besitzt Santa (Held 0), Sitz 0 übernimmt ihn dauerhaft und handelt mit ihm (`charmedOwner: 1`).
//  Erwartung: Es zählt die Hand des Kontrolleurs (Sitz 0): a) Hand [Attack, Heal, Heal] ⇒ spielbar; b) Hand [Attack] ⇒ nicht spielbar, auch wenn der alte Besitzer 5 Karten hält.
//  Beobachtung (✗): `validateActionPlay` ruft `canPlayCard` mit der BRETTSEITE (`heroOwner` = 1): Santa zählt Sitz 1s Hand. a) wird abgelehnt (Sitz 1 hat 0 Karten),
//  b) wird gespielt – ohne dass der Preis gezahlt werden kann (der gespielte Attack selbst wandert in die Gegnerhand, vgl. 12).
//  Aufruf: node docs/niche-tests/repro/H03-heroes/22-santa-klaus-uebernommen-zaehlt-falsche-hand.js   (✗ = Fehler tritt auf)
// ═══════════════════════════════════════════════════════════════════════════
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const fill = ['Tushu, the Knowledge Keeper', 'Zwei, the Lucky Thief'];
  async function lauf(h0, h1) {
    const t = await H.fresh({ heroes: [['Atta, Speaker of Desires', 'Hulijing, the Foxdemon', 'George, the Demigod'], ['Santa Klaus', ...fill]], hp: 600, hand: [h0, h1] });
    await t.run(() => t.engine.runHooks('onGameStart', {}));
    await t.run(() => t.engine.actionTakeHeroPermanently(0, 1, 0));
    t.script.push({ match: d => d.type === 'pickHandCard', answer: (d) => ({ handIndex: d.eligibleIndices[d.eligibleIndices.length - 1] }) });
    t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 1).id];
    const r = await t.play(0, 'Attack', { hero: 0, charmedOwner: 1, noGrant: true });
    return { r, h0: t.pile(0, 'hand'), h1: t.pile(1, 'hand'), t };
  }
  const a = await lauf(['Attack', 'Heal', 'Heal'], []);
  R.note('a) Kontrolleur 3 Karten, alter Besitzer 0', { r: a.r, h0: a.h0, h1: a.h1 });
  R.check('a) mit 3 Handkarten (Attack + 2 Reserve) ist der Attack spielbar', a.r === true, a.r);
  const b = await lauf(['Attack'], ['Heal', 'Heal', 'Heal', 'Heal', 'Heal']);
  R.note('b) Kontrolleur 1 Karte, alter Besitzer 5', { r: b.r, h0: b.h0, h1: b.h1 });
  R.check('b) mit nur dem Attack auf der Hand ist der Attack NICHT spielbar', b.r === false, b.r);
  R.check('keine Engine-Fehler', a.t.errors.length === 0 && b.t.errors.length === 0, [a.t.errors, b.t.errors]);
  R.finish();
})();
