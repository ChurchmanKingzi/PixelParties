'use strict';
// W66a-06 · Bug-Klasse „verzögerte Wirkung hängt an einer Karteninstanz im Stapel": Teleportation Powder
//
// Kartentext: „… remove it … from the game completely. At the beginning of your next turn, return those cards to the Zones they were removed from. A player does not lose the game, even if all their other Heroes are defeated."
// Der Auftrag steht im Spielstand (`gs._teleportPending`), ausgelöst wurde die Rückkehr aber nur vom Hook der Potion-Instanz im LÖSCHSTAPEL (`_ensurePileListeners`). Verließ die Potion den Löschstapel
//   (Aurora Borealis, Guardian Beast Yang, Ghazma, Kartenwege „aus dem Löschstapel nehmen" …), kam der Held NIE zurück und `ps._teleportedAway` hielt die Niederlage auf.
// W66a: die Engine ruft die Rückkehr zusätzlich direkt nach dem frühen Zugbeginn-Hook (`rueckkehrNachholen`, verbraucht den Auftrag — kein Doppelfeuer).
// Szene (je Sitz): Wirker spielt Teleportation Powder auf Gegner-Held 1; die Potion wird (a) aus dem Löschstapel genommen / (b) bleibt liegen; echter Zugwechsel bis zum nächsten eigenen Zug.
// Exit 0 = korrekt.
const H = require('../../lib/h.js');
const TP = 'Teleportation Powder';
(async () => {
  const R = H.runner();
  for (const seat of [0, 1]) {
    const opp = 1 - seat;
    for (const [name, weg] of [['Potion bleibt im Löschstapel (Kontrolle)', null], ['Potion wird per Engine-Stapelweg aus dem Löschstapel genommen (takeFromPileSync: Aurora Borealis, Guardian Beast Yang, Ghazma …)', 'engine'], ['Potion verlässt den Löschstapel (in die Hand zurückgeholt)', 'hand'], ['Potion ist aus dem Löschstapel verschwunden (anderes Ziel)', 'ablage']]) {
      const hand = [[], []]; hand[seat] = [TP];
      const t = await H.fresh({ hand, turn: 5, active: seat, deckSize: 20 });
      t.targetFn = (v) => { const x = v.find(q => q.type === 'hero' && q.owner === opp && q.heroIdx === 1); return x ? [x.id] : undefined; };
      const vorher = t.hero(opp, 1).name;
      const r = await t.play(seat, TP, { hero: 0 });
      const weg0 = t.gs.players[opp].heroes[1].name === '';
      const ps = t.gs.players[seat];
      if (weg === 'engine') await t.run(() => t.engine.takeFromPileSync(seat, 'deleted', TP, { source: 'Test' }));
      if (weg === 'hand') { const i = ps.deletedPile.indexOf(TP); if (i >= 0) ps.deletedPile.splice(i, 1); ps.hand.push(TP); for (const c of t.inst(c => c.name === TP && c.zone === 'deleted')) t.engine._untrackCard(c.id); }
      if (weg === 'ablage') { const i = ps.deletedPile.indexOf(TP); if (i >= 0) ps.deletedPile.splice(i, 1); for (const c of t.inst(c => c.name === TP && c.zone === 'deleted')) t.engine._untrackCard(c.id); }
      R.check(`[S${seat}] ${name}: Teleportation Powder gespielt, Gegner-Held 1 ist weg`, r === true && weg0, { r, weg0 });
      await t.endTurn();           // eigenes Zugende → Gegnerzug
      const mitten = t.gs.players[opp].heroes[1].name === '';
      await t.endTurn();           // Gegnerzug-Ende → Beginn des NÄCHSTEN eigenen Zuges: Rückkehr
      const zurueck = t.gs.players[opp].heroes[1].name === vorher && t.gs.players[opp].heroes[1].hp > 0;
      R.check(`[S${seat}] ${name}: der Held fehlt im Gegnerzug und kehrt zu Beginn des nächsten eigenen Zuges zurück`, mitten && zurueck && t.gs.turn === 7 && t.gs.activePlayer === seat, { mitten, zurueck, turn: t.gs.turn });
      R.check(`[S${seat}] ${name}: Auftrag verbraucht, Niederlage-Zähler weg, keine Fehler`, !t.gs._teleportPending && !t.gs.players[opp]._teleportedAway && t.errors.length === 0 && t.audit().length === 0, { p: t.gs._teleportPending, z: t.gs.players[opp]._teleportedAway, e: t.errors });
    }
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
