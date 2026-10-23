'use strict';
// W66a-07 · Bug-Klasse „verzögerte Wirkung hängt an einer Karteninstanz in der Ablage": Ladder to the Sky
//
// Kartentext: „Sacrifice a Creature you control that was not summoned this turn to play this card. At the beginning of your next turn, you may search your deck for a Creature whose level is up to 1 higher
//   than that of the sacrificed Creature and place it into a free Support Zone of any Hero you control. That Creature may use its once per turn effect the turn it's summoned."
// Vorher: Stufe des Opfers und „scharf gestellt" standen als Zähler an der Artefakt-Instanz in der Ablage (`_ladderLevel`, `_ladderArmedTurn`); verließ die Karte die Ablage vor dem nächsten Zug
//   (Meditation, Magic Sapphire, Mischen ins Deck …), ging die Suche verloren. Jetzt: Auftrag am Spieler (`ps._ladderPending`), die Engine löst ihn nach den Zugbeginn-Hooks aus.
// Szene (je Sitz): Opfer-Kreatur (Stufe 0) und Zielkreatur im Deck; Ladder gespielt; Karte (a) bleibt in der Ablage, (b) kommt auf die Hand zurück, (c) wird ins Deck gemischt, (d) ist gelöscht;
//   echter Zugwechsel bis zum nächsten eigenen Zug; Gegenproben: nicht im selben Zug, nicht im Gegnerzug, nur einmal.
// Exit 0 = korrekt.
const H = require('../../lib/h.js');
const LD = 'Ladder to the Sky', OPFER = H.INERT.creature, ZIEL = 'Cute Bunny';
(async () => {
  const R = H.runner();
  for (const seat of [0, 1]) {
    for (const [name, weg] of [['Karte bleibt in der Ablage', null], ['Karte zurück auf die Hand', 'hand'], ['Karte ins Deck gemischt', 'deck'], ['Karte gelöscht', 'deleted']]) {
      const hand = [[], []]; hand[seat] = [LD];
      const deck = [Array(16).fill(H.INERT.creature), Array(16).fill(H.INERT.creature)]; deck[seat] = [ZIEL].concat(Array(15).fill(H.INERT.creature));
      const t = await H.fresh({ hand, deck, turn: 5, active: seat, gold: 100 });
      const o = t.put(seat, 0, 0, OPFER); o.turnPlayed = 1;
      const galerien = [];
      t.script.push({ match: d => d.type === 'cardGallery' && d.title === LD, answer: (d) => { galerien.push(d.cards.map(c => c.name)); return { cardName: ZIEL, source: 'deck' }; } });
      t.script.push({ match: d => d.type === 'zonePick' && d.title === LD, answer: (d) => ({ heroIdx: d.zones[0].heroIdx, slotIdx: d.zones[0].slotIdx, owner: d.zones[0].owner }) });
      t.script.push({ match: d => /sacrifice/i.test(d.title || '') || d.type === 'sacrificePick' || d.type === 'cardGalleryMulti', answer: () => undefined });
      t.targetFn = (v) => { const x = v.find(q => q.owner === seat && q.type === 'equip'); return x ? [x.id] : undefined; };
      const r = await t.play(seat, LD, { noGrant: true });
      const ps = t.gs.players[seat];
      R.check(`[S${seat}] ${name}: Ladder gespielt (Opfer bezahlt), Auftrag am Spieler`, r === true && (ps._ladderPending || []).length === 1, { r, p: ps._ladderPending });
      if (weg === 'hand') { const i = ps.discardPile.indexOf(LD); if (i >= 0) ps.discardPile.splice(i, 1); ps.hand.push(LD); }
      if (weg === 'deck') { const i = ps.discardPile.indexOf(LD); if (i >= 0) ps.discardPile.splice(i, 1); ps.mainDeck.push(LD); }
      if (weg === 'deleted') { const i = ps.discardPile.indexOf(LD); if (i >= 0) ps.discardPile.splice(i, 1); ps.deletedPile.push(LD); }
      for (const c of t.inst(c => c.name === LD && c.zone !== 'hand')) t.engine._untrackCard(c.id);   // keine Instanz irgendwo: der Auftrag trägt allein
      await t.endTurn();
      R.check(`[S${seat}] ${name}: im Gegnerzug passiert nichts (Auftrag steht noch)`, galerien.length === 0 && (ps._ladderPending || []).length === 1, { g: galerien.length });
      await t.endTurn();
      const auf = t.inst(c => c.name === ZIEL && c.zone === 'support' && c.owner === seat);
      R.check(`[S${seat}] ${name}: zu Beginn des NÄCHSTEN eigenen Zuges wird die Suche angeboten (Stufe ≤ 1) und die Kreatur platziert`, galerien.length === 1 && galerien[0].includes(ZIEL) && auf.length === 1 && t.gs.turn === 7, { g: galerien, n: auf.length, turn: t.gs.turn });
      R.check(`[S${seat}] ${name}: Auftrag verbraucht (nur einmal), keine Fehler, kein Geist`, !ps._ladderPending && t.errors.length === 0 && t.audit().length === 0, { p: ps._ladderPending, e: t.errors, a: t.audit() });
      await t.endTurn(); await t.endTurn();
      R.check(`[S${seat}] ${name}: zwei Zugwechsel später kein zweites Mal`, galerien.length === 1, { g: galerien.length });
    }
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
