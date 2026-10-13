'use strict';
// H04-18 · Heldeneffekte mit Deck-Zugriff ignorieren die Such-Sperre (True Fairy Crestina, Stellan, Taio Absorber)
//
// Cats of the Pharaoh: „… you cannot search or add cards to your hand for the rest of the turn afterwards (but you can still draw)."
// Engine (`_engine.js` ~10683 `_isSearchBlocked`; CARD_API.md „Cats of the Pharaoh (v1068)"): `searchLocked` sperrt Deck-Suche und Adds;
//   `handLocked` sperrt ebenfalls Suchen. Galerien, die eine Suche sind, werden mit `searchToHand: true, searchPile: 'deck'` gekennzeichnet
//   (Vorbild Tempeluna) – dann geht der Dialog unter der Sperre gar nicht erst auf.
// Erwartung: True Fairy Crestina („search any card from your deck") bietet unter `searchLocked` keine Suche; Stellan/Taio Absorber (Deck-Weg)
//   nehmen unter der Sperre keine Karte aus dem Deck (Lesart: Deck-Zugriff = Suche; Frage C).
// Beobachtet: alle drei greifen ungehindert ins Deck (Galerie erscheint, Karte kommt aus dem Deck).
// Ursache: true-fairy-crestina-the-primordial-goddess.js (`onPhaseStart`, `cardGallery` ohne `searchToHand`, `takeFromPile`),
//   stellan-the-calm-cat.js (Deck-Zweig), taio-absorber-of-the-mountain-s-heart.js (`_collectCandidates` + `_castAsAdditionalAction`).
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const TF = 'True Fairy Crestina, the Primordial Goddess', ST = 'Stellan, the Calm Cat', TA = "Taio, Absorber of the Mountain's Heart";
  const fill = Array(10).fill(H.INERT.filler);
  const start = async (heroes, hand0, deck0, lock) => {
    const t = await H.fresh({ heroes: [heroes], hand: [hand0, ['Fireball']], deck: [deck0, fill] });
    await t.run(() => t.engine.runHooks('onGameStart', {}));
    if (lock) t.gs.players[0][lock] = true;
    return t;
  };
  const hitFirst = (t, hi) => { t.targetFn = (valid) => { const v = valid.find(x => x.type === 'hero' && x.owner === 0 && x.heroIdx === hi); return v ? [v.id] : null; }; return t.play(1, 'Fireball', { hero: 0 }); };

  // True Fairy Crestina, Resource Phase
  for (const lock of ['searchLocked', 'handLocked']) {
    const t = await start([TF, 'Tushu, the Knowledge Keeper', 'Rick, the Trigger Happy Undertaker'], [], ['Fireball', 'Icebolt', H.INERT.filler, H.INERT.filler], lock);
    t.script.push({ match: d => d.type === 'confirm' && d.title === TF, answer: () => ({ confirmed: true }) });
    t.script.push({ match: d => d.type === 'cardGallery' && d.title === TF, answer: () => ({ cardName: 'Fireball' }) });
    t.gs.activePlayer = 0; t.gs.currentPhase = 1;
    await t.run(() => t.engine.runHooks('onPhaseStart', { phase: 'Resource', phaseIndex: 1 }));
    R.check(`Crestina: unter ${lock} keine Deck-Suche`, (t.gs.players[0].creationZone || []).length === 0, { vorrat: t.gs.players[0].creationZone });
  }
  // Stellan Deck-Weg
  {
    const t = await start([ST, 'Tushu, the Knowledge Keeper', 'Rick, the Trigger Happy Undertaker'], ['Bird'], ['Cheering Rabbit', 'Doomed Pirate', H.INERT.creature, H.INERT.creature], 'searchLocked');
    t.script.push({ match: d => d.type === 'optionPicker', answer: () => ({ optionId: 'deck' }) });
    t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: 'Cheering Rabbit' }) });
    await hitFirst(t, 0);
    R.check('Stellan: unter searchLocked kommt keine Kreatur aus dem Deck', t.zone(0, 0, 0) === null, { zone: t.zone(0, 0, 0) });
  }
  // Taio Absorber Deck-Weg
  {
    const t = await start([TA, 'Tushu, the Knowledge Keeper', 'Rick, the Trigger Happy Undertaker'], ['Burning Finger'], ['Quick Attack', H.INERT.creature, H.INERT.creature], 'searchLocked');
    t.script.push({ match: d => d.type === 'cardGallery' && d.title === TA, answer: () => ({ cardName: 'Quick Attack', source: 'deck' }), once: true });
    t.targetFn = (valid) => { const v = valid.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0); return v ? [v.id] : null; };
    await t.play(0, 'Burning Finger', { hero: 0, noGrant: true });
    R.check('Taio Absorber: unter searchLocked wird nichts aus dem Deck gewirkt', t.pile(0, 'mainDeck').includes('Quick Attack'), { deck: t.pile(0, 'mainDeck'), ablage: t.pile(0, 'discardPile') });
  }
  R.finish();
})();
