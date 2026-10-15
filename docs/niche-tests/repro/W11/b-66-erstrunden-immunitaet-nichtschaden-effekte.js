// W11b · Q66 (B-05) · Erste-Runden-Immunität gegen Nicht-Schadens-Effekte
// Al: „Ja, sollte auch davor ‚schützen‘ und entsprechende Effekte uneinsetzbar machen."
// Erwartung: In Zug 1 (echter Spielstart, Sitz 1 geschützt) sind Karten, die den Gegner nur mit Nicht-Schadens-Effekten treffen (Deck-Zug, Platzieren, Ausrüsten,
//   Gold zurücksetzen, schenken, Zwangssuche, Ziehen für beide, Stun auf alle gegnerischen Ziele), UNSPIELBAR: die Karte bleibt auf der Hand, kein Gold bezahlt, keine Aktion
//   verbraucht, Sitz 1 unverändert. Ohne Schutz (normaler Zug) sind dieselben Karten spielbar (Gegenprobe). Der eine Prüfer ist `engine.ersterZugGeschuetzt`. Exit 0 = korrekt.
const H = require('../../lib/h.js');
const KARTEN = ['Love Shot', 'Plant Golem', 'Elusive Hind', 'Future Tech Control Device', 'Market Crash', 'Pillar of Light', 'Birthday Present', 'Cool Presents',
  'Powder Keg', 'The Sacred Jewel', "Medusa's Curse"];
(async () => {
  const R = H.runner();
  const FILL = 'ZZ Filler';
  async function start(card) {
    const t = await H.fresh({ hand: [[card, FILL, 'ZZ Trinket'], Array(5).fill(FILL)], deck: [Array(20).fill(H.INERT.creature), Array(20).fill(H.INERT.creature)], gold: [0, 20], turn: 0, phase: 0 });
    t.gs.turn = 0; t.gs.activePlayer = 0; t.gs.currentPhase = 0;
    t.grantFor(0, 0, card);
    await t.run(() => t.engine.startGame());
    t.gs.players[0].gold = 30;
    if (t.gs.currentPhase === 2 && !['Artifact', 'Potion'].includes(H.DB[card].cardType)) await t.engine.advancePhase(0);
    t.script.push({ match: d => d && d.type === 'zonePick', answer: () => ({ heroIdx: 0, slotIdx: 0 }) });
    t.targetFn = (valid) => { const x = valid.find(v => v.type === 'hero' && v.owner === 1); return x ? [x.id] : (valid.length ? [valid[0].id] : []); };
    t.reset();
    return t;
  }
  const snap1 = (t) => JSON.stringify({ h: t.pile(1, 'hand'), d: t.pile(1, 'mainDeck').length, g: t.gs.players[1].gold, s: t.gs.players[1].supportZones, dp: t.pile(1, 'discardPile'),
    st: t.gs.players[1].heroes.map(h => Object.keys(h.statuses || {}).sort()) });
  for (const card of KARTEN) {
    const t = await start(card);
    const before = snap1(t), gold0 = t.gs.players[0].gold, act0 = t.gs.players[0]._actionsPlayedThisPhase || 0;
    const r = await t.play(0, card, { hero: 0, noGrant: true, phase: t.gs.currentPhase, keepActions: true, targetOwner: 1 });
    R.check(`${card}: in Zug 1 gegen den geschützten Gegner unspielbar (bleibt auf der Hand)`, t.pile(0, 'hand').includes(card) && !t.pile(0, 'discardPile').includes(card), { r, hand: t.pile(0, 'hand') });
    R.check(`${card}: nichts bezahlt, keine Aktion verbraucht, Sitz 1 unverändert`, snap1(t) === before && t.gs.players[0].gold === gold0 && (t.gs.players[0]._actionsPlayedThisPhase || 0) === act0, { gold: t.gs.players[0].gold });
    R.check(`${card}: keine Engine-/Audit-Fehler`, t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  // Gegenprobe: ohne Erste-Runden-Schutz sind sie spielbar
  for (const card of KARTEN) {
    const t = await H.fresh({ hand: [[card, FILL, 'ZZ Trinket'], Array(5).fill(FILL)], deck: [Array(20).fill(H.INERT.creature), Array(20).fill(H.INERT.creature)], gold: [60, 20] });
    t.targetFn = (valid) => { const x = valid.find(v => v.type === 'hero' && v.owner === 1); return x ? [x.id] : (valid.length ? [valid[0].id] : []); };
    t.script.push({ match: d => d && d.type === 'zonePick', answer: () => ({ heroIdx: 0, slotIdx: 0 }) });
    const r = await t.play(0, card, { hero: 0, targetOwner: 1 });
    R.check(`${card}: ohne Schutz spielbar (Gegenprobe)`, r === true && !t.pile(0, 'hand').includes(card), { r });
  }
  { // Prüfer-Einheit
    const t = await H.fresh({});
    t.gs.firstTurnProtectedPlayer = 1;
    R.check('Prüfer: Sitz 1 gegen Sitz 0 geschützt', t.engine.ersterZugGeschuetzt(1, 0) === true);
    R.check('Prüfer: Sitz 1 gegen sich selbst nicht geschützt', t.engine.ersterZugGeschuetzt(1, 1) === false);
    R.check('Prüfer: Sitz 0 nicht geschützt', t.engine.ersterZugGeschuetzt(0, 1) === false);
    delete t.gs.firstTurnProtectedPlayer;
    R.check('Prüfer: ohne Schutz nie', t.engine.ersterZugGeschuetzt(1, 0) === false);
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
