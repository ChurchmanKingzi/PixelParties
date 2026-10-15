// W12b · Q93 (F01-25) · Glass of Marbles: NUR Karteneffekte, nicht das Hand-Size-Limit
// Al: „NUR Karteneffekte, nicht das Hand-Size-Limit." Text: „When this card is discarded or deleted from your hand by an effect, draw 2 cards."
// Erwartung: (1) Handlimit-Abwurf am Zugende (Regel) löst NICHT aus; (2) Abwurf durch einen Karteneffekt (actionDiscardHandCard mit Quelle) löst aus (Gegenprobe);
//   (3) Löschen durch das Pollution-Handlimit (Karteneffekt, deleteMode) löst aus (Gegenprobe). Exit 0 = korrekt.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const GM = 'Glass of Marbles';
  { // (1) Zugende-Handlimit
    const t = await H.fresh({ hand: [[GM, ...Array(8).fill('ZZ Filler')], []], deck: [Array(20).fill('ZZ Dummy'), Array(20).fill('ZZ Dummy')] });
    t.script.push({ match: d => d.type === 'forceDiscard', answer: () => { const i = t.gs.players[0].hand.indexOf(GM); return i >= 0 ? { cardIdx: i, handIdx: i, index: i, cardName: GM } : undefined; } });
    await t.endTurn();
    R.check('Handlimit-Abwurf (Regel) löst Glass of Marbles NICHT aus', !t.logs.some(l => l.type === 'glass_of_marbles'), t.logs.map(l => l.type).filter(x => /glass|hand_limit/.test(x)));
    R.check('Glass of Marbles liegt in der Ablage (wurde abgeworfen)', t.pile(0, 'discardPile').includes(GM), t.pile(0, 'discardPile'));
    R.check('(1) keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  { // (2) Karteneffekt-Abwurf
    const t = await H.fresh({ hand: [[GM, 'ZZ Filler'], []], deck: [Array(20).fill('ZZ Dummy'), Array(20).fill('ZZ Dummy')] });
    const idx = t.gs.players[0].hand.indexOf(GM);
    await t.run(() => t.engine.actionDiscardHandCard(0, GM, idx, { source: 'Test' }));
    R.check('Karteneffekt-Abwurf löst Glass of Marbles aus (Gegenprobe)', t.logs.some(l => l.type === 'glass_of_marbles') && t.pile(0, 'hand').length === 3, { hand: t.pile(0, 'hand') });
  }
  { // (3) Pollution-Handlimit (deleteMode) = Karteneffekt
    const t = await H.fresh({ hand: [[GM, 'ZZ Filler', 'ZZ Filler', 'ZZ Filler'], []], deck: [Array(20).fill('ZZ Dummy'), Array(20).fill('ZZ Dummy')] });
    t.script.push({ match: d => d.type === 'forceDiscard', answer: () => { const i = t.gs.players[0].hand.indexOf(GM); return i >= 0 ? { cardIdx: i, handIdx: i, index: i, cardName: GM } : undefined; } });
    await t.run(() => t.engine.enforceHandLimit(0, { maxSize: 3, deleteMode: true, title: 'Pollution' }));
    R.check('Pollution-Löschen (Karteneffekt) löst Glass of Marbles aus (Gegenprobe)', t.logs.some(l => l.type === 'glass_of_marbles'), { hand: t.pile(0, 'hand'), del: t.pile(0, 'deletedPile') });
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
