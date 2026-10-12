'use strict';
// Erste-Runden-Immunität (CARD_API.md „Turn-1 Immunity"): „during turn 1, every card belonging to the non-turn player is completely immune to anything the turn player can do."
// (`engine.startGame()` setzt `firstTurnProtectedPlayer` und legt auf jeden Helden des zweiten Spielers den Status `shielded`.)
// Aufbau wie im echten Spielstart (`engine.startGame()`), Sitz 0 spielt in seinem ersten Zug eine Karte gegen den (noch leeren) Sitz 1.
// Geprüft wird: Sitz 1 hat danach noch dieselben Hände/Decks/Gold/Brett wie vorher.
//   ✗ = Karte wirkt trotz Immunität auf den geschützten Spieler.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const FILL = 'ZZ Filler';
  async function start(card) {
    const t = await H.fresh({ hand: [[card], [FILL, FILL, FILL, FILL, FILL]], deck: [Array(20).fill(H.INERT.creature), Array(20).fill(H.INERT.creature)], gold: [0, 20], turn: 0, phase: 0 });
    t.gs.turn = 0; t.gs.activePlayer = 0; t.gs.currentPhase = 0;
    t.grantFor(0, 0, card);
    await t.run(() => t.engine.startGame());
    if (t.gs.currentPhase === 2 && H.DB[card].cardType !== 'Artifact') await t.engine.advancePhase(0);   // Main 1 → Action Phase (echte Phasenhooks); Artefakte gehören in die Main Phase
    t.script.push({ match: d => d && d.type === 'zonePick', answer: () => ({ heroIdx: 0, slotIdx: 0 }) });
    t.targetFn = (valid) => { const x = valid.find(v => v.type === 'hero' && v.owner === 1); return x ? [x.id] : (valid.length ? [valid[0].id] : []); };
    t.reset();
    return t;
  }
  const snap1 = (t) => JSON.stringify({ hand: t.pile(1, 'hand'), deck: t.pile(1, 'mainDeck').length, gold: t.gs.players[1].gold, sup: t.gs.players[1].supportZones, disc: t.pile(1, 'discardPile') });
  const T = [
    ['Love Shot', 'Karte wird aus dem Deck des geschützten Spielers gezogen (Text: „Draw a card from your opponent’s deck“)'],
    ['Plant Golem', 'Golem wird in die Support Zone eines geschützten Helden gesetzt (sperrt dessen Aktionen über die Erst-Runde hinaus)'],
    ['Elusive Hind', 'Hind wird in die Support Zone eines geschützten Helden gesetzt'],
    ['Future Tech Control Device', 'Control Device wird an einen geschützten Helden ausgerüstet („Equip this card to a Hero your opponent controls")'],
    ['Market Crash', 'Gold des geschützten Spielers wird auf 0 gesetzt (Text: „Both players’ Gold becomes 0“; die Gold-Bedingung gilt nur für die Zusatzaktion)'],
    ['Birthday Present', 'schenkt dem geschützten Spieler eine Handkarte (eher Stufe C: nützliche Wirkung)'],
    ['Pillar of Light', 'zwingt den geschützten Spieler zur Deck-Suche und Handkarte (eher Stufe C)'],
  ];
  for (const [card, what] of T) {
    const t = await start(card);
    const before = snap1(t);
    const r = await t.play(0, card, { hero: 0, noGrant: true, phase: t.gs.currentPhase, keepActions: true });
    const after = snap1(t);
    const gespielt = r === true && !t.pile(0, 'hand').includes(card);
    if (!gespielt) { R.note(`${card}: im Test nicht ausspielbar (r=${JSON.stringify(r)}) – übersprungen`, { phase: t.gs.currentPhase, hand: t.pile(0, 'hand') }); continue; }
    R.check(`${card}: Sitz 1 bleibt unverändert – ${what}`, before === after, { vorher: JSON.parse(before), nachher: JSON.parse(after) });
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
