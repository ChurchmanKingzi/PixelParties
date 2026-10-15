// W12b · B-06 · Erste-Runden-Immunität: Karten mit komplett nutzloser Wirkung sind nicht spielbar
// Al: „Wäre besser, wenn sie gar nicht erst spielbar wären, wenn ihre Effekte komplett nutzlos wären."
// Prinzip (CARD_API.md): „Eine Karte, deren Effekt komplett nutzlos wäre, ist nicht spielbar." Umsetzung: Flag `blockedByFirstTurnProtection` (Welle 11) + Prüfer `engine.ersterZugGeschuetzt`.
// Erwartung: In Zug 1 (echter Spielstart, Sitz 1 geschützt) bleiben die 16 reinen Gegner-Karten aus B-06 (und Boulder in a Bottle, M01-25) auf der Hand: kein Gold bezahlt,
//   keine Aktion verbraucht, kein „once per game"-/Einmal-pro-Zug-Stempel, Sitz 1 unverändert. Gegenprobe: ohne Schutz (normaler Zug) sind sie spielbar. Exit 0 = korrekt.
const H = require('../../lib/h.js');
const KARTEN = ['Butterfly Cloud', 'Flame Avalanche', 'Boiling Oil', 'Rain of Arrows', 'Forbidden Zone', 'Future Tech Bomb', 'Laser Volley', 'Poisoned Well', 'Smoke Vial', 'Iceage',
  'Trial of Dominance', 'Trial of Annoyance', 'Divine Gift of Forgetting', 'Slow', 'Chain Lightning', 'Big Oopsie', 'Boulder in a Bottle'];
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
    t.targetFn = (valid) => { const x = valid.find(v => v.type === 'hero' && v.owner === 1); return x ? [x.id] : (valid.length ? [valid[0].id] : []); };
    t.reset();
    return t;
  }
  const snap1 = (t) => JSON.stringify({ h: t.pile(1, 'hand'), d: t.pile(1, 'mainDeck').length, g: t.gs.players[1].gold, dp: t.pile(1, 'discardPile'), s: t.gs.players[1].supportZones,
    st: t.gs.players[1].heroes.map(h => [h.hp, Object.keys(h.statuses || {}).sort()]) });
  for (const card of KARTEN) {
    const t = await start(card);
    const before = snap1(t), gold0 = t.gs.players[0].gold, act0 = t.gs.players[0]._actionsPlayedThisPhase || 0;
    const r = await t.play(0, card, { hero: 0, noGrant: true, phase: t.gs.currentPhase, keepActions: true });
    R.check(`${card}: in Zug 1 nicht spielbar (bleibt auf der Hand, nicht in Ablage/gelöscht)`, t.pile(0, 'hand').includes(card) && !t.pile(0, 'discardPile').includes(card) && !t.pile(0, 'deletedPile').includes(card), { r, hand: t.pile(0, 'hand') });
    R.check(`${card}: kein Gold, keine Aktion, kein Einmal-Stempel, Sitz 1 unverändert`, snap1(t) === before && t.gs.players[0].gold === gold0 && (t.gs.players[0]._actionsPlayedThisPhase || 0) === act0
      && !(t.gs.players[0]._oncePerGameUsed && t.gs.players[0]._oncePerGameUsed.size), { gold: t.gs.players[0].gold, once: t.gs.players[0]._oncePerGameUsed && [...t.gs.players[0]._oncePerGameUsed] });
    R.check(`${card}: keine Engine-/Audit-Fehler`, t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  // Gegenprobe: ohne Erste-Runden-Schutz bleiben sie spielbar (Flag sperrt nur bei geschütztem Gegner)
  for (const card of KARTEN) {
    const t = await H.fresh({ hand: [[card, FILL, 'ZZ Trinket'], Array(5).fill(FILL)], deck: [Array(20).fill(H.INERT.creature), Array(20).fill(H.INERT.creature)], gold: [60, 20] });
    t.targetFn = (valid) => { const x = valid.find(v => v.type === 'hero' && v.owner === 1); return x ? [x.id] : (valid.length ? [valid[0].id] : []); };
    t.script.push({ match: d => d && d.type === 'zonePick', answer: () => ({ heroIdx: 0, slotIdx: 0 }) });
    if (card === 'Future Tech Bomb') t.setDiscard(0, ['Future Tech Control Device']);
    if (card === 'Rain of Arrows') t.put(0, 0, 0, H.INERT.creature);
    const r = await t.play(0, card, { hero: 0 });
    R.check(`${card}: ohne Schutz spielbar (Gegenprobe)`, r === true && !t.pile(0, 'hand').includes(card), { r, hand: t.pile(0, 'hand') });
  }
  { // Zug 3 (Sitz 0 zum zweiten Mal am Zug, Schutz längst aufgehoben): Poisoned Well spielbar
    const t = await start('Poisoned Well');
    await t.endTurn(); await t.endTurn();
    R.check('Schutz nach Zug 1 aufgehoben', t.gs.firstTurnProtectedPlayer == null, t.gs.firstTurnProtectedPlayer);
    const r = await t.play(0, 'Poisoned Well', { hero: 0 });
    R.check('Poisoned Well in Zug 3 spielbar', r === true && !t.pile(0, 'hand').includes('Poisoned Well'), { r });
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
