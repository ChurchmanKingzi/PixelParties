'use strict';
// W63c-04 · Alle Wege, auf denen eine Karte in die Hand des ANDEREN Spielers wandert, lassen sie Eigentum ihres Besitzers bleiben:
//   · `actionStealFromHand` (Thieving Strike, Loot the Leftovers, Gather Intel, Live Show, Charme-ähnliche Griffe) — Dieb nimmt aus der Gegnerhand,
//   · `actionTransferCardToOppHand` (Cool Presents, Live Show, Hat of Madness, Santa Klaus, Chatty Town Guard, Crystal Well, Saint Nicolas) — Geschenk in die Gegnerhand.
// Danach verlässt die Karte die fremde Hand auf allen Wegen (Abwerfen, Zwangsabwurf, Spell spielen, Zurückmischen, Mulligan, Löschen, Handlimit).
// Alter Stand: `actionStealFromHand` und `actionTransferCardToOppHand` nahmen die Instanz mit, ließen aber die Platz-Herkunftsmarke weg —
// Abwerfen/Mischen/Spielen schickte die Karte in Ablage bzw. Deck des Halters (des Diebs bzw. Beschenkten).
const B = require('../../lib/besitzer.js');
const { H } = B;
(async () => {
  const R = H.runner();
  const frisch = async (holder, besitzer, weg) => {
    const hand = [[], []]; hand[besitzer] = ['Fireball', 'ZZ Filler']; hand[holder] = ['ZZ Filler'];
    const t = await H.fresh({ hand, deck: [Array(10).fill('ZZ Trinket'), Array(10).fill('ZZ Trinket')] });
    t.dieb = holder; t.besitzer = besitzer;
    if (weg === 'steal') {
      const r = await t.run(() => t.engine.actionStealFromHand(holder, { sourceName: 'Test', preselectedIndices: [t.pile(besitzer, 'hand').indexOf('Fireball')] }));
      R.check(`${weg}: Karte gestohlen`, r && r.stolen && r.stolen[0] === 'Fireball', r);
    } else {
      const r = await t.run(() => t.engine.actionTransferCardToOppHand(besitzer, t.pile(besitzer, 'hand').indexOf('Fireball'), {}));
      R.check(`${weg}: Karte verschenkt`, r === true, r);
    }
    return t;
  };
  const exits = [
    ['gezielter Abwurf', 'discardPile', (t) => t.run(() => t.engine.actionDiscardHandCard(t.dieb, 'Fireball', t.pile(t.dieb, 'hand').indexOf('Fireball'), {}))],
    ['Zwangsabwurf', 'discardPile', async (t) => {
      t.script.push({ match: d => d.type === 'forceDiscard', answer: () => ({ cardName: 'Fireball', handIndex: t.pile(t.dieb, 'hand').indexOf('Fireball') }) });
      await t.run(() => t.engine.actionPromptForceDiscard(t.dieb, 1, { selfInflicted: true }));
    }],
    ['Zwangs-Löschen', 'deletedPile', async (t) => {
      t.script.push({ match: d => d.type === 'forceDiscard', answer: () => ({ cardName: 'Fireball', handIndex: t.pile(t.dieb, 'hand').indexOf('Fireball') }) });
      await t.run(() => t.engine.actionPromptForceDiscard(t.dieb, 1, { selfInflicted: true, deleteMode: true }));
    }],
    ['Spell spielen', 'discardPile', async (t) => {
      t.targetFn = v => [v.find(x => x.type === 'hero' && x.owner === t.besitzer && x.heroIdx === 0).id];
      await t.play(t.dieb, 'Fireball', { hero: 0 });
    }],
    ['zurückmischen', 'mainDeck', (t) => t.run(() => t.engine.actionShuffleBackToDeck(t.dieb, ['Fireball'], 'Test'))],
    ['Mulligan', 'mainDeck', (t) => t.run(() => t.engine.actionMulliganCards(t.dieb, ['Fireball'], [t.pile(t.dieb, 'hand').indexOf('Fireball')]))],
    ['Handlimit', 'discardPile', async (t) => {
      t.script.push({ match: d => d.type === 'forceDiscard', answer: () => ({ cardName: 'Fireball', handIndex: t.pile(t.dieb, 'hand').indexOf('Fireball') }) });
      await t.run(() => t.engine.enforceHandLimit(t.dieb, { maxSize: 1 }));
    }],
  ];
  for (const holder of [0, 1]) for (const weg of ['steal', 'transfer']) {
    R.section(`── ${weg}: Halter = Sitz ${holder}, Besitzer = Sitz ${1 - holder} ──`);
    // Bei 'transfer' gibt der BESITZER; der Halter ist der Beschenkte.
    for (const [name, stapel, fn] of exits) {
      const t = await frisch(holder, 1 - holder, weg);
      await fn(t);
      B.erwarteStapel(R, t, `${weg} / ${name} (Halter ${holder})`, 'Fireball', 1 - holder, stapel);
    }
  }

  // Hin und zurück: Karte wandert zum Dieb und per Geschenk wieder zurück → danach gehört sie wieder in die eigenen Stapel des Besitzers
  {
    R.section('── hin und zurück ──');
    const t = await frisch(0, 1, 'steal');                   // Sitz 0 stiehlt Fireball von Sitz 1
    const r = await t.run(() => t.engine.actionTransferCardToOppHand(0, t.pile(0, 'hand').indexOf('Fireball'), {}));   // Sitz 0 schenkt sie zurück
    R.check('zurückgeschenkt', r === true, r);
    R.check('Fireball wieder in der Hand von Sitz 1', B.anzahl(t, 1, 'hand', 'Fireball') === 1 && B.anzahl(t, 0, 'hand', 'Fireball') === 0, B.ort(t, 'Fireball'));
    await t.run(() => t.engine.actionDiscardHandCard(1, 'Fireball', t.pile(1, 'hand').indexOf('Fireball'), {}));
    B.erwarteStapel(R, t, 'nach Rückgabe abgeworfen', 'Fireball', 1, 'discardPile');
  }
  // Zweimal klauen: Sitz 0 klaut von 1, Sitz 1 klaut ihre ursprüngliche Karte von Sitz 0 zurück (Griff in die Hand), dann gelöscht.
  {
    const t = await frisch(0, 1, 'steal');
    const r = await t.run(() => t.engine.actionStealFromHand(1, { sourceName: 'Test', preselectedIndices: [t.pile(0, 'hand').indexOf('Fireball')] }));
    R.check('zurückgeklaut', r && r.stolen && r.stolen[0] === 'Fireball', r);
    await t.run(() => t.engine.actionDiscardHandCard(1, 'Fireball', t.pile(1, 'hand').indexOf('Fireball'), {}));
    B.erwarteStapel(R, t, 'zweimal geklaut, beim Eigentümer abgeworfen', 'Fireball', 1, 'discardPile');
  }
  // Mehrfach: zwei Kopien gleichen Namens, eine eigene und eine gestohlene → getrennt
  {
    const t = await H.fresh({ hand: [['Fireball', 'ZZ Filler'], ['Fireball', 'ZZ Filler']], deck: [Array(10).fill('ZZ Trinket'), Array(10).fill('ZZ Trinket')] });
    await t.run(() => t.engine.actionStealFromHand(0, { sourceName: 'Test', preselectedIndices: [0] }));   // Sitz 1 gibt SEINE Fireball
    R.check('zwei Kopien in der Hand von Sitz 0', t.pile(0, 'hand').filter(x => x === 'Fireball').length === 2, t.pile(0, 'hand'));
    // Plätze: [Fireball(eigen), ZZ Filler, Fireball(gestohlen)]
    await t.run(() => t.engine.actionDiscardHandCard(0, 'Fireball', 2, {}));   // gestohlene Kopie
    R.check('gestohlene Kopie → Ablage von Sitz 1', B.anzahl(t, 1, 'discardPile', 'Fireball') === 1 && B.anzahl(t, 0, 'discardPile', 'Fireball') === 0, B.ort(t, 'Fireball'));
    await t.run(() => t.engine.actionDiscardHandCard(0, 'Fireball', 0, {}));   // eigene Kopie
    R.check('eigene Kopie → Ablage von Sitz 0', B.anzahl(t, 0, 'discardPile', 'Fireball') === 1 && B.anzahl(t, 1, 'discardPile', 'Fireball') === 1, B.ort(t, 'Fireball'));
  }
  // Echte Karten: Cool Presents (Geschenk) und Thieving Strike (Diebstahl)
  {
    R.section('── echte Karten ──');
    let t = await H.fresh({ hand: [['Cool Presents', 'Fireball', 'ZZ Filler'], ['ZZ Filler']], gold: [100, 100], deck: [Array(10).fill('ZZ Trinket'), Array(10).fill('ZZ Trinket')] });
    t.targetFn = v => v.filter(x => x.type === 'hand' && x.owner === 0 && x.cardName === 'Fireball').map(x => x.id);
    await t.play(0, 'Cool Presents', { hero: 0 });
    R.check('Cool Presents: Fireball liegt in der Hand von Sitz 1', B.anzahl(t, 1, 'hand', 'Fireball') === 1, B.ort(t, 'Fireball'));
    await t.run(() => t.engine.actionDiscardHandCard(1, 'Fireball', t.pile(1, 'hand').indexOf('Fireball'), {}));
    B.erwarteStapel(R, t, 'Cool Presents → Beschenkter wirft ab', 'Fireball', 0, 'discardPile');

    t = await H.fresh({ hand: [['Thieving Strike'], ['Fireball']], deck: [Array(10).fill('ZZ Trinket'), Array(10).fill('ZZ Trinket')] });
    t.targetFn = v => [v.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 0).id];
    t.script.push({ match: d => d.type === 'blindHandPick', answer: () => ({ selectedIndices: [0] }) });
    await t.play(0, 'Thieving Strike', { hero: 0 });
    R.check('Thieving Strike: Fireball liegt in der Hand von Sitz 0', B.anzahl(t, 0, 'hand', 'Fireball') === 1, B.ort(t, 'Fireball'));
    await t.run(() => t.engine.actionPromptForceDiscard(0, 1, { selfInflicted: true }));
    B.erwarteStapel(R, t, 'Thieving Strike → Dieb wirft ab', 'Fireball', 1, 'discardPile');
  }
  R.finish();
})();
