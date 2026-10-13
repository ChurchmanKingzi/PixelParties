'use strict';
// S03-05 · Missing People legt einen Token unten ins Deck
// Kartentext: „Choose a Creature your opponent controls and place it at the bottom of their deck."
// Regel: Token verlassen das Brett nie in Deck/Ablage/Hand, sie werden gelöscht (vgl. A05-02, CARD_API „Tokens … überall verboten", `_enforceSupportZoneLock`: „Token → Deleted").
// Aufbau: Sitz 1 hat einen „Mummy Token" (Support Zone) und ein Deck aus 3 Dummys.
// Erwartet: Der Token wird gelöscht (oder ist kein Ziel); im Deck des Gegners liegt kein „Mummy Token".
// Beobachtet: Der Token wird als Ziel angeboten und liegt danach als gewöhnliche Karte unten im Deck; beim Ziehen landet er als nicht spielbare Handkarte beim Gegner.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const t = await H.fresh({ hand: [['Missing People'], []], deckSize: 3 });
  t.put(1, 0, 0, 'Mummy Token');
  t.targetFn = (valid) => { const v = valid.find(q => q.type === 'equip'); return v ? [v.id] : null; };
  const r = await t.play(0, 'Missing People', { hero: 0 });
  R.check('Missing People gespielt', r === true, r);
  R.check('kein Token im Deck des Gegners', !t.pile(1, 'mainDeck').includes('Mummy Token'), t.pile(1, 'mainDeck'));
  await t.engine.actionDrawCards(1, 4);
  R.check('Gegner hat keinen Token auf der Hand', !t.pile(1, 'hand').includes('Mummy Token'), t.pile(1, 'hand'));
  R.finish();
})();
